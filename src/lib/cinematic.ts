import { clamp, smoothstep } from '@/lib/utils/math';

/**
 * Chorégraphie de l'ouverture (« larguer les amarres »), en secondes depuis le clic :
 *
 *  0,00  l'anneau se contracte (anticipation), le diaphragme s'ouvre sur l'eau ;
 *  0,86  le bateau touche l'eau : la carte ondule et se dissout, l'onde de lumière part ;
 *  1,2   le moteur toussote (avant qui se lève, bouffées sombres), les mouettes s'envolent ;
 *  1,6   la grue s'élève en panotant de gauche à droite : les îles surgissent l'une après
 *        l'autre dans le sens du regard (ressort, nappes d'eau, anneaux d'écume), leurs
 *        arbres, maisons et pontons jaillissent en cascade (pop GPU) ;
 *  4,4   la caméra plonge vers le bateau et se pose ; le nom a rejoint le HUD ;
 *  6,45  la cloche du port ; 7,2 : la main au visiteur.
 *
 * Une seule horloge (`gameTransition`, 0 → 1, pilotée par useWorldReveal) synchronise le
 * brouillard, la lumière, la caméra, la carte et l'apparition des îles.
 */
export const INTRO_DURATION = 7.2;
/** Part de la cinématique consacrée à l'anticipation (la caméra et la carte « inspirent »). */
export const INTRO_ANTICIPATION = 0.03;

/** Rien n'est dévoilé avant le clic : seul l'anneau de lanterne brille sur la carte. */
export const INTRO_RADIUS_START = 0;
/** Rayon de l'anneau de chargement, centré sur le point de chute du bateau. */
export const INTRO_RING_RADIUS = 6.5;
/** Instant (en fraction de la cinématique) où le bateau touche l'eau : l'onde part de là. */
export const INTRO_SPLASH_AT = 0.12;
/** Même instant, en secondes. */
export const SPLASH_SECONDS = INTRO_SPLASH_AT * INTRO_DURATION;
/** Rayon final de l'onde quand le monde est entièrement révélé. */
export const INTRO_RADIUS_END = 132;
/** Épaisseur du bord lumineux. */
export const INTRO_FEATHER = 6.5;

type Key = readonly [number, number];

/**
 * Courbe monotone (Hermite de Fritsch-Carlson) à travers des clés [temps, valeur] : aucune
 * oscillation parasite entre deux clés. `startSlope` / `endSlope` imposent les vitesses aux bouts.
 */
function monotoneCurve(keys: readonly Key[], startSlope?: number, endSlope?: number) {
  const count = keys.length;
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index++) {
    slopes.push((keys[index + 1][1] - keys[index][1]) / (keys[index + 1][0] - keys[index][0]));
  }
  const tangents: number[] = keys.map((_, index) => {
    if (index === 0) return startSlope ?? slopes[0];
    if (index === count - 1) return endSlope ?? slopes[count - 2];
    const before = slopes[index - 1];
    const after = slopes[index];
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  for (let index = 0; index < count - 1; index++) {
    const slope = slopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index] / slope;
    const b = tangents[index + 1] / slope;
    const length = a * a + b * b;
    if (length > 9) {
      const limit = 3 / Math.sqrt(length);
      tangents[index] = limit * a * slope;
      tangents[index + 1] = limit * b * slope;
    }
  }
  return (time: number) => {
    if (time <= keys[0][0]) return keys[0][1];
    if (time >= keys[count - 1][0]) return keys[count - 1][1];
    let index = 0;
    while (index < count - 2 && time > keys[index + 1][0]) index += 1;
    const [t0, v0] = keys[index];
    const [t1, v1] = keys[index + 1];
    const span = t1 - t0;
    const u = (time - t0) / span;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0
      + (u3 - 2 * u2 + u) * span * tangents[index]
      + (-2 * u3 + 3 * u2) * v1
      + (u3 - u2) * span * tangents[index + 1];
  };
}

/**
 * Onde de lumière (rayon, m) après l'impact : éclatement vif autour du bateau (l'îlot de départ
 * surgit aussitôt), longue glissade régulière à travers l'archipel, puis arrêt en douceur.
 */
const front = monotoneCurve(
  [
    [SPLASH_SECONDS, INTRO_RING_RADIUS],
    [1.2, 25],
    [1.9, 44],
    [4.3, 102],
    [5.6, INTRO_RADIUS_END],
  ],
  80,
  0,
);

/** Rayon de l'onde `seconds` après le clic (avant l'impact : l'anneau de départ). */
export function frontRadius(seconds: number) {
  return seconds <= SPLASH_SECONDS ? INTRO_RING_RADIUS : front(seconds);
}

/** Instant (s) où l'onde atteint `radius` (inverse de frontRadius, par dichotomie). */
export function frontSeconds(radius: number) {
  if (radius <= INTRO_RING_RADIUS) return SPLASH_SECONDS;
  if (radius >= INTRO_RADIUS_END) return 5.6;
  let low = SPLASH_SECONDS;
  let high = 5.6;
  for (let step = 0; step < 32; step++) {
    const middle = (low + high) / 2;
    if (front(middle) < radius) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Lumière du monde (brouillard, ciel, soleil) : la nuit de la carte s'ouvre sur le jour. */
const dawn = monotoneCurve(
  [
    [0, 0],
    [SPLASH_SECONDS, 0],
    [1.35, 0.2],
    [2.0, 0.42],
    [2.8, 0.61],
    [3.6, 0.76],
    [4.6, 0.88],
    [5.8, 0.965],
    [INTRO_DURATION, 1],
  ],
  0,
  0,
);

/** Secondes écoulées depuis le clic pour une progression 0 → 1 de la cinématique. */
export function introSeconds(progress: number) {
  return clamp(progress, 0, 1) * INTRO_DURATION;
}

/** Quintic smootherstep: vitesse et accélération nulles aux deux extrémités. */
export function cinematicEase(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** La caméra part avant le décor : les premières centaines de ms ont ainsi du poids. */
export function cameraProgress(progress: number) {
  return cinematicEase((progress - INTRO_ANTICIPATION) / (1 - INTRO_ANTICIPATION));
}

/** Révélation de l'atmosphère (0 → 1) pour une progression de la cinématique. */
export function worldRevealProgress(progress: number) {
  return clamp(dawn(introSeconds(progress)), 0, 1);
}

export function introLightStrength(progress: number) {
  const anticipationPulse = Math.sin(smoothstep(0, INTRO_ANTICIPATION, progress) * Math.PI) * 0.08;
  return clamp(1 + anticipationPulse - smoothstep(0.24, 0.9, progress), 0, 1.08);
}

/** Rayon du cercle révélateur en world space, lié au temps de la cinématique. */
export function introRadiusFromGameTransition(t: number) {
  const seconds = introSeconds(t);
  if (seconds < SPLASH_SECONDS) {
    // Au clic, le diaphragme s'ouvre sur l'eau (léger dépassement), puis attend le bateau.
    const open = clamp((seconds - 0.1) / 0.42, 0, 1);
    const back = open - 1;
    return INTRO_RING_RADIUS * (1 + 2.2 * back * back * back + 1.2 * back * back);
  }
  return frontRadius(seconds);
}

/** Intensité du halo au bord du cercle : un éclat à l'impact, puis la lisière s'apaise. */
export function introGlowFromGameTransition(t: number) {
  const seconds = introSeconds(t);
  if (seconds < SPLASH_SECONDS) return 0.9 * smoothstep(0.1, 0.45, seconds);
  const since = seconds - SPLASH_SECONDS;
  return (0.85 + 1.15 * Math.exp(-since * 1.8)) * (1 - smoothstep(4.4, 6.2, seconds));
}

/** Apparition locale de la faune : même cercle que les îles, overshoot deux fois plus discret. */
export function animalRevealScale(distance: number, introRadius: number, stagger = 0) {
  const raw = smoothstep(distance - 5 + stagger, distance + 1.5 + stagger, introRadius);
  const bounce = 1 + 0.045 * Math.sin(raw * Math.PI) * (1 - raw);
  return clamp(raw * bounce, 0, 1.025);
}
