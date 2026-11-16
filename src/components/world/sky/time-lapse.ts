/**
 * Avance rapide du cycle jour/nuit (bouton Jour/Nuit du HUD), état partagé hors React.
 *
 * Le bouton ne fait plus sauter l'horloge : il demande une heure (`timeLapseTarget` dans le
 * store) et Lighting y fait filer le cycle en quelques secondes — soleil qui plonge ou se
 * lève, ombres qui tournent, ciel qui traverse l'heure dorée, fenêtres et lampions qui
 * s'allument un à un, étoiles qui paraissent — avant de rendre la main au pas naturel.
 * Le défilement n'est pas uniforme : il file à travers le plein jour et la pleine nuit et
 * s'attarde autour du passage du soleil sur l'horizon (heure dorée, crépuscule, aube).
 * Lighting tient cet état à jour une fois par image (priorité -10, avant tout le monde) :
 *  - `active` : une avance rapide est en cours ;
 *  - `rate` : vitesse du cycle rapportée à son pas naturel (1 = normal, ≈ 30 au plus fort) ;
 *  - `cloudLead` : avance accumulée (s) de l'horloge des ombres de nuages, qui filent avec.
 */
export const timeLapse = { active: false, rate: 1, cloudLead: 0 };

/** Pas naturel du cycle : un tour complet en 5 minutes (fraction de journée par seconde). */
export const NATURAL_RATE = 1 / 300;

/** Les ombres de nuages filent au plus à ce multiple de leur vitesse (≈ 20 m/s). */
const CLOUD_RACE_MAX = 22;
/** Pas de la table de défilement (progression → heure). */
const STEPS = 64;

export interface Lapse {
  /** Heures de départ et d'arrivée, déroulées (`to` > `from`, en fractions de journée). */
  from: number;
  to: number;
  /** Heure demandée au store : un nouveau clic se reconnaît à une autre valeur. */
  target: number;
  /** Vitesse de départ (progression / s) : un second clic repart sans à-coup. */
  v0: number;
  elapsed: number;
  duration: number;
  /** Progression cumulée (0 → 1) aux STEPS + 1 heures régulièrement réparties. */
  table: Float32Array;
}

/** Durée de l'avance selon le chemin à parcourir (fraction de journée) : 4,5 à 6,5 s. */
function lapseDuration(span: number) {
  return Math.min(6.5, Math.max(4.5, 3.6 + span * 4.6));
}

/** Poids d'une heure dans le défilement : on s'attarde quand le soleil rase l'horizon. */
function weight(time: number) {
  const elevation = Math.sin((time - 0.25) * Math.PI * 2);
  return 1 + 3.2 * Math.exp(-(((elevation + 0.04) / 0.2) ** 2));
}

/** Heure (déroulée) atteinte pour une progression `p` (0..1). */
function timeAt(lapse: Lapse, p: number) {
  const { table } = lapse;
  const clamped = Math.min(Math.max(p, 0), 1);
  let index = 0;
  while (index < STEPS - 1 && table[index + 1] < clamped) index += 1;
  const span = table[index + 1] - table[index];
  const local = span > 1e-6 ? (clamped - table[index]) / span : 0;
  return lapse.from + ((index + local) / STEPS) * (lapse.to - lapse.from);
}

/**
 * Prépare une avance rapide de l'heure `from` (0..1) jusqu'à `target`, toujours en avant
 * (le soleil ne recule jamais). `rate` : vitesse actuelle du cycle (fraction de journée par
 * seconde), pour enchaîner deux clics. Null si l'heure visée est déjà là.
 */
export function planLapse(from: number, target: number, rate = NATURAL_RATE): Lapse | null {
  const span = (((target - from) % 1) + 1) % 1;
  if (span < 0.004) return null;
  const duration = lapseDuration(span);
  const table = new Float32Array(STEPS + 1);
  let total = 0;
  for (let step = 0; step < STEPS; step++) {
    total += weight(from + ((step + 0.5) / STEPS) * span);
    table[step + 1] = total;
  }
  for (let step = 1; step <= STEPS; step++) table[step] /= total;
  const lapse: Lapse = { from, to: from + span, target, v0: 0, elapsed: 0, duration, table };
  // Vitesse de départ convertie en progression : l'heure n'avance ni ne cale d'un coup.
  const slope = (timeAt(lapse, 0.01) - from) / 0.01;
  lapse.v0 = Math.min(Math.max(rate, 0) / Math.max(slope, 1e-6), 2.4 / duration);
  return lapse;
}

const sample = { time: 0, rate: 0 };

/** Progression d'Hermite (départ à la vitesse `v0`, arrivée au repos). */
function progress(lapse: Lapse, seconds: number) {
  const u = Math.min(Math.max(seconds / lapse.duration, 0), 1);
  const u2 = u * u;
  const u3 = u2 * u;
  return (-2 * u3 + 3 * u2) + (u3 - 2 * u2 + u) * lapse.v0 * lapse.duration;
}

/**
 * Heure déroulée et vitesse (fraction de journée / s) de l'avance `seconds` après son départ :
 * ralenti, accéléré, ralenti, et le passage du soleil sur l'horizon étiré.
 */
export function lapseAt(lapse: Lapse, seconds: number) {
  sample.time = timeAt(lapse, progress(lapse, seconds));
  const ahead = timeAt(lapse, progress(lapse, seconds + 0.02));
  sample.rate = Math.max((ahead - sample.time) / 0.02, 0);
  return sample;
}

/** Fait avancer l'horloge des nuages avec le cycle (appelé une fois par image par Lighting). */
export function raceClouds(rate: number, dt: number) {
  timeLapse.rate = rate / NATURAL_RATE;
  timeLapse.cloudLead += (Math.min(Math.max(timeLapse.rate, 1), CLOUD_RACE_MAX) - 1) * dt;
}
