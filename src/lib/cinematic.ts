import { clamp, smoothstep } from '@/lib/utils/math';

/** Durée de la révélation, anticipation comprise. */
export const INTRO_DURATION = 6.0;
export const INTRO_ANTICIPATION = 0.09;

/** Rien n'est dévoilé avant le clic : seul l'anneau de lanterne brille sur la carte. */
export const INTRO_RADIUS_START = 0;
/** Rayon de l'anneau de chargement, centré sur le point de chute du bateau. */
export const INTRO_RING_RADIUS = 6.5;
/** Instant (en fraction de la cinématique) où le bateau touche l'eau : l'onde part de là. */
export const INTRO_SPLASH_AT = 0.14;
/** Rayon final quand le monde est entièrement révélé. */
export const INTRO_RADIUS_END = 120;
/** Épaisseur du bord lumineux. */
export const INTRO_FEATHER = 6.5;

/** Quintic smootherstep: vitesse et accélération nulles aux deux extrémités. */
export function cinematicEase(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** La caméra part avant le décor : les premières centaines de ms ont ainsi du poids. */
export function cameraProgress(progress: number) {
  return cinematicEase((progress - INTRO_ANTICIPATION) / (1 - INTRO_ANTICIPATION));
}

/** Révélation étagée : aucune apparition sèche, le brouillard couvre les premiers LOD. */
export function worldRevealProgress(progress: number) {
  const earlySilhouette = smoothstep(0.17, 0.48, progress) * 0.24;
  const world = cinematicEase((progress - 0.3) / 0.66) * 0.76;
  return clamp(earlySilhouette + world, 0, 1);
}

export function introLightStrength(progress: number) {
  const anticipationPulse = Math.sin(smoothstep(0, INTRO_ANTICIPATION, progress) * Math.PI) * 0.08;
  return clamp(1 + anticipationPulse - smoothstep(0.24, 0.9, progress), 0, 1.08);
}

/** Rayon du cercle révélateur en world space, lié au temps de la cinématique. */
export function introRadiusFromGameTransition(t: number) {
  // L'anneau attend la chute du bateau, puis l'éclaboussure le pousse en onde de choc :
  // départ vif, arrivée lente (ease-out cubique).
  if (t < INTRO_SPLASH_AT) {
    // Au clic, l'intérieur de l'anneau s'ouvre sur l'eau (≈ 0,35 s) et attend le bateau.
    const open = clamp(t / 0.06, 0, 1);
    return INTRO_RING_RADIUS * (1 - (1 - open) ** 3);
  }
  const x = clamp((t - INTRO_SPLASH_AT) / (1 - INTRO_SPLASH_AT), 0, 1);
  const eased = 1 - (1 - x) ** 3;
  return INTRO_RING_RADIUS + (INTRO_RADIUS_END - INTRO_RING_RADIUS) * eased;
}

/** Intensité du halo au bord du cercle. */
export function introGlowFromGameTransition(t: number) {
  const pulse = Math.sin(smoothstep(0, INTRO_ANTICIPATION, t) * Math.PI) * 0.18;
  const fade = 1 - smoothstep(0.6, 1.0, t);
  return (1.2 + pulse) * fade;
}

/** Apparition locale de la faune : même cercle que les îles, overshoot deux fois plus discret. */
export function animalRevealScale(distance: number, introRadius: number, stagger = 0) {
  const raw = smoothstep(distance - 5 + stagger, distance + 1.5 + stagger, introRadius);
  const bounce = 1 + 0.045 * Math.sin(raw * Math.PI) * (1 - raw);
  return clamp(raw * bounce, 0, 1.025);
}
