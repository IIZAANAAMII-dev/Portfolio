/**
 * Avance rapide du cycle jour/nuit (bouton Jour/Nuit du HUD), état partagé hors React.
 *
 * Le bouton ne fait plus sauter l'horloge : il demande une heure (`timeLapseTarget` dans le
 * store) et Lighting y fait filer le cycle en quelques secondes — soleil qui plonge ou se
 * lève, ombres qui tournent, ciel qui traverse l'heure dorée, fenêtres et lampions qui
 * s'allument un à un, étoiles qui paraissent — avant de rendre la main au pas naturel.
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

export interface Lapse {
  /** Heures de départ et d'arrivée, déroulées (`to` > `from`, en fractions de journée). */
  from: number;
  to: number;
  /** Heure demandée au store : un nouveau clic se reconnaît à une autre valeur. */
  target: number;
  /** Vitesse de départ (fraction de journée / s) : un second clic repart sans à-coup. */
  v0: number;
  elapsed: number;
  duration: number;
}

/** Durée de l'avance selon le chemin à parcourir (fraction de journée) : 4 à 6,5 s. */
function lapseDuration(span: number) {
  return Math.min(6.5, Math.max(4, 3.3 + span * 4.6));
}

/**
 * Prépare une avance rapide de l'heure `from` (0..1) jusqu'à `target`, toujours en avant
 * (le soleil ne recule jamais). `v0` : vitesse actuelle, pour enchaîner deux clics.
 * Null si l'heure visée est déjà là.
 */
export function planLapse(from: number, target: number, v0 = NATURAL_RATE): Lapse | null {
  const span = (((target - from) % 1) + 1) % 1;
  if (span < 0.004) return null;
  const duration = lapseDuration(span);
  // Une vitesse de départ trop forte ferait dépasser la cible (Hermite) : bornée.
  const start = Math.min(Math.max(v0, NATURAL_RATE), (2.4 * span) / duration);
  return { from, to: from + span, target, v0: start, elapsed: 0, duration };
}

const sample = { time: 0, rate: 0 };

/**
 * Heure déroulée et vitesse de l'avance `seconds` après son départ : Hermite cubique (départ à
 * la vitesse `v0`, arrivée au pas naturel), soit un ralenti-accéléré-ralenti sans à-coup.
 */
export function lapseAt(lapse: Lapse, seconds: number) {
  const T = lapse.duration;
  const u = Math.min(Math.max(seconds / T, 0), 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const m0 = lapse.v0 * T;
  const m1 = NATURAL_RATE * T;
  sample.time = (2 * u3 - 3 * u2 + 1) * lapse.from + (u3 - 2 * u2 + u) * m0
    + (-2 * u3 + 3 * u2) * lapse.to + (u3 - u2) * m1;
  const slope = (6 * u2 - 6 * u) * lapse.from + (3 * u2 - 4 * u + 1) * m0
    + (-6 * u2 + 6 * u) * lapse.to + (3 * u2 - 2 * u) * m1;
  sample.rate = slope / T;
  return sample;
}

/** Fait avancer l'horloge des nuages avec le cycle (appelé une fois par image par Lighting). */
export function raceClouds(rate: number, dt: number) {
  timeLapse.rate = rate / NATURAL_RATE;
  timeLapse.cloudLead += (Math.min(Math.max(timeLapse.rate, 1), CLOUD_RACE_MAX) - 1) * dt;
}
