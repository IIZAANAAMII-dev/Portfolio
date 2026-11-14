import { hash } from '@/lib/utils/math';

/**
 * État partagé de l'île, hors React : calculé une seule fois par image par la racine de
 * l'île (priorité -1), lu par tous les décors (néons, faille, fenêtre, sons). Les néons
 * grésillent chacun à leur rythme, mais la faille les fait tous vaciller en même temps.
 */
export const flicker = {
  /** Lumière de la faille (0 → 1). */
  rift: 1,
  /** Néons sur trépied, gauche et droite. */
  standA: 1,
  standB: 1,
  /** Néon derrière la fenêtre de l'étage. */
  window: 1,
  /** Ampoule du ponton. */
  lamp: 1,
  /** Bouffée de parasites sur la faille (0 → 1). */
  glitch: 0,
  /** Silhouette au fond du couloir, quand la lumière flanche (0 → 1). */
  figure: 0,
  /** 0 si le visiteur préfère les animations réduites. */
  motion: 1,
};

/**
 * Luminosité d'un néon fatigué : allumé presque tout le temps, puis par moments une
 * crise de quelques dixièmes de seconde où il claque et s'éteint à moitié.
 */
export function tube(time: number, seed: number, nervous = 0.18) {
  const slot = Math.floor(time * 0.42 + seed * 7.3);
  if (hash(slot * 1.31 + seed) > nervous) return 1;
  const local = time * 0.42 + seed * 7.3 - slot;
  if (local > 0.32) return 1;
  return hash(Math.floor(time * 26) * 0.37 + seed) > 0.45 ? 1 : 0.12 + hash(slot + seed * 3.1) * 0.25;
}

/** Signal partagé entre la scène 3D et l'interface (voile VHS). */
export const staticSignal = {
  /** 0 loin de l'île → 1 au ponton (position du bateau). */
  proximity: 0,
  /** Forçage de développement (captures d'écran). */
  override: null as number | null,
};

export function proximityNow() {
  return staticSignal.override ?? staticSignal.proximity;
}
