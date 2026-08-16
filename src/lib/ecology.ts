import { boatState } from './boat-state';
import { skyState } from './sky';
import { clamp, damp, smoothstep } from './utils/math';

/**
 * Etat ecologique central, mis a jour une seule fois par frame par Lighting.
 * Les composants de faune lisent ces facteurs continus au lieu d'essaimer des
 * `if (night)` : coucher et lever restent progressifs et synchronises.
 */
export const ecologyState = {
  dayFish: 1,
  dayLarge: 1,
  birds: 1,
  jellyfish: 0,
  nocturnalFish: 0,
  plankton: 0,
  predator: 0.35,
  worldLife: 1,
  boundaryWarning: 0,
  boundaryDanger: 0,
  leviathan: 0,
  /** Météo continue : chaque couche possède sa propre inertie. */
  stormCover: 0,
  stormWaves: 0,
  stormWind: 0,
  stormRain: 0,
  /** Etats cinématiques partagés sans provoquer de re-render React par frame. */
  boundaryHush: 0,
  boundaryCinematic: 0,
  boundaryControlLock: 0,
  sequenceActive: 0,
  boundaryStage: 'idle',
  monsterShadow: 0,
  monsterWake: 0,
  monsterSurface: 0,
  monsterEffectTime: 0,
  monsterX: 0,
  monsterZ: 0,
  monsterFromX: 0,
  monsterFromZ: 0,
  monsterToX: 0,
  monsterToZ: 0,
  impact: 0,
  respawnFade: 0,
  /** Flash partagé entre la scène WebGL et le voile HUD. */
  stormFlash: 0,
  /** Progression visuelle de l'engloutissement du bateau (0 -> 1). */
  leviathanAttack: 0,
  distanceFromCenter: 0,
};

export type EcologyActivity = 'day' | 'night' | 'twilight' | 'predator' | 'always';

export const WORLD_LIMITS = {
  normal: 126,
  warning: 145,
  danger: 166,
  leviathan: 184,
} as const;

export function activityFactor(activity: EcologyActivity) {
  switch (activity) {
    case 'day': return ecologyState.dayFish;
    case 'night': return ecologyState.nocturnalFish;
    case 'twilight': return Math.max(0.12, 1 - Math.abs(skyState.dayNight - 0.5) * 1.8);
    case 'predator': return ecologyState.predator;
    default: return 1;
  }
}

/** Facteur spatial stable, pratique pour le LOD de zones centre/rayon. */
export function zoneProximity(center: readonly [number, number], near: number, far: number) {
  const distance = Math.hypot(
    boatState.position.x - center[0],
    boatState.position.z - center[1],
  );
  return 1 - smoothstep(near, far, distance);
}

export function updateEcology(dt: number) {
  const night = skyState.dayNight;
  const distance = Math.hypot(boatState.position.x, boatState.position.z);
  ecologyState.distanceFromCenter = distance;

  // Les populations se chevauchent a l'aube/au crepuscule : aucun pop brutal.
  const dayFishTarget = 1 - smoothstep(0.34, 0.82, night);
  const birdTarget = 1 - smoothstep(0.2, 0.7, night);
  const jellyTarget = smoothstep(0.28, 0.86, night);
  const nocturnalTarget = smoothstep(0.4, 0.92, night);

  const warning = smoothstep(WORLD_LIMITS.normal, WORLD_LIMITS.warning, distance);
  const danger = smoothstep(WORLD_LIMITS.warning, WORLD_LIMITS.danger, distance);
  const leviathan = smoothstep(WORLD_LIMITS.danger, WORLD_LIMITS.leviathan, distance);
  // Avant le monstre, la petite vie se rarefie deja naturellement.
  const worldLifeTarget = 1 - smoothstep(WORLD_LIMITS.normal + 2, WORLD_LIMITS.danger, distance) * 0.94;
  const coverTarget = clamp(warning * 0.52 + danger * 0.48, 0, 1);
  const wavesTarget = clamp(warning * 0.16 + danger * 0.84, 0, 1);
  const windTarget = clamp(warning * 0.34 + danger * 0.66, 0, 1);
  const rainTarget = smoothstep(0.14, 0.78, danger);

  ecologyState.dayFish = clamp(damp(ecologyState.dayFish, dayFishTarget, 0.75, dt), 0, 1);
  ecologyState.dayLarge = clamp(damp(ecologyState.dayLarge, dayFishTarget, 0.42, dt), 0, 1);
  ecologyState.birds = clamp(damp(ecologyState.birds, birdTarget, 0.55, dt), 0, 1);
  ecologyState.jellyfish = clamp(damp(ecologyState.jellyfish, jellyTarget, 0.48, dt), 0, 1);
  ecologyState.nocturnalFish = clamp(damp(ecologyState.nocturnalFish, nocturnalTarget, 0.56, dt), 0, 1);
  ecologyState.plankton = clamp(damp(ecologyState.plankton, nocturnalTarget, 0.7, dt), 0, 1);
  ecologyState.predator = clamp(damp(ecologyState.predator, 0.28 + night * 0.72, 0.4, dt), 0, 1);
  ecologyState.worldLife = clamp(damp(ecologyState.worldLife, worldLifeTarget, 0.75, dt), 0, 1);
  ecologyState.boundaryWarning = damp(ecologyState.boundaryWarning, warning, 0.8, dt);
  ecologyState.boundaryDanger = damp(ecologyState.boundaryDanger, danger, 0.75, dt);
  ecologyState.leviathan = damp(ecologyState.leviathan, leviathan, 0.65, dt);
  // La couverture arrive la première, la pluie en dernier. Les faibles constantes
  // d'amortissement évitent l'ancien basculement brutal de toute l'ambiance.
  ecologyState.stormCover = clamp(damp(ecologyState.stormCover, coverTarget, 0.32, dt), 0, 1);
  ecologyState.stormWaves = clamp(damp(ecologyState.stormWaves, wavesTarget, 0.46, dt), 0, 1);
  ecologyState.stormWind = clamp(damp(ecologyState.stormWind, windTarget, 0.38, dt), 0, 1);
  ecologyState.stormRain = clamp(damp(ecologyState.stormRain, rainTarget, 0.52, dt), 0, 1);
}
