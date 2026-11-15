import type { Camera, Object3D } from 'three';
import { QUALITY_LEVELS, type QualityLevel } from '@/lib/quality';
import { damp } from '@/lib/utils/math';

/**
 * LOD de distance du décor d'une île (qualité basse / moyenne, voir `decorRange` dans
 * lib/quality.ts). La distance compte depuis le point que vise la caméra (son axe optique
 * au niveau de la mer : le bateau en navigation, l'île à quai), pas depuis la caméra
 * elle-même, perchée à 60 m : ce qui est au centre de l'image garde tout son décor, une
 * île au loin ne garde que son relief, ses arbres et son ponton. L'île où l'on est à quai
 * (ou vers laquelle on navigue) reste toujours détaillée. En s'approchant, le décor remonte
 * du sol, comme un décor de théâtre qui sort des dessous. En haute qualité, rien ne change.
 */
export interface DecorLod {
  shown: boolean;
  /** Progression de l'apparition (0 → 1) : le décor remonte du sol. */
  grow: number;
}

/** Hystérésis (m) : pas de clignotement à la limite de portée. */
const LOD_MARGIN = 10;

export function createDecorLod(): DecorLod {
  return { shown: true, grow: 1 };
}

/** Distance horizontale entre le point visé par la caméra (axe optique ∩ mer) et (x, z). */
function focusDistance(camera: Camera, x: number, z: number) {
  const e = camera.matrixWorld.elements;
  // Axe optique : -Z local de la caméra, en repère monde.
  const dx = -e[8];
  const dy = -e[9];
  const dz = -e[10];
  // Regard rasant ou vers le ciel : un point loin devant.
  const t = dy < -0.08 ? Math.min(-e[13] / dy, 260) : 160;
  return Math.hypot(e[12] + dx * t - x, e[14] + dz * t - z);
}

/**
 * À appeler dans un useFrame. `x, z` : centre de l'île (monde), `radius` : son rayon,
 * `depth` : profondeur d'où le décor remonte. `keep` : toujours affiché (île à quai, cap
 * en cours). `docked` : bateau à quai (portée réduite, voir `dockedDecorRange`).
 * `instant` : pas d'animation (île encore invisible, mouvement réduit).
 */
export function updateDecorLod(
  group: Object3D,
  lod: DecorLod,
  camera: Camera,
  center: { x: number; z: number; radius: number; depth: number },
  quality: QualityLevel,
  keep: boolean,
  docked: boolean,
  instant: boolean,
  dt: number,
) {
  const level = QUALITY_LEVELS[quality];
  const range = docked ? level.dockedDecorRange : level.decorRange;
  if (keep || !Number.isFinite(range)) {
    lod.shown = true;
  } else {
    const shore = focusDistance(camera, center.x, center.z) - center.radius;
    lod.shown = lod.shown ? shore < range + LOD_MARGIN : shore < range;
  }
  const goal = lod.shown ? 1 : 0;
  lod.grow = instant ? goal : damp(lod.grow, goal, 6.5, dt);
  if (Math.abs(lod.grow - goal) < 0.004) lod.grow = goal;
  group.visible = lod.grow > 0.004;
  // Une translation (jamais une échelle écrasée) : les placements calculés une fois depuis
  // les matrices monde (étincelles des hotspots…) restent justes à tout moment.
  group.position.y = lod.grow > 0.004 ? -(1 - lod.grow) * center.depth : 0;
}
