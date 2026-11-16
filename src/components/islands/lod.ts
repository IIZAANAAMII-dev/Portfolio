import { Object3D, type Camera } from 'three';
import { perfOff, QUALITY_LEVELS, TIER_LEVELS, tierQuality, type QualityLevel } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import type { FrameGate } from './frame-gate';

/**
 * LOD de distance du décor d'une île (paliers « Très léger » à « Équilibré », voir
 * `decorRange` dans lib/quality.ts). La distance compte depuis le point que vise la caméra
 * (son axe optique au niveau de la mer : le bateau en navigation, l'île à quai), pas depuis
 * la caméra elle-même, perchée à 60 m : ce qui est au centre de l'image garde tout son décor,
 * une île au loin ne garde que son relief, ses arbres et son ponton. L'île où l'on est à quai
 * (ou vers laquelle on navigue) reste toujours détaillée. En s'approchant, le décor remonte
 * du sol, comme un décor de théâtre qui sort des dessous. En haute qualité, rien ne change.
 *
 * Un décor masqué dort complètement : ses `useFrame` ne sont plus appelés (porte, voir
 * frame-gate.tsx) et ses matrices ne sont plus recalculées à chaque image.
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

/** Matrices d'un décor masqué : rien à recalculer (une mise à jour complète suit sa réapparition). */
function sleepingUpdateMatrixWorld(this: Object3D, force?: boolean) {
  if (this.visible) Object3D.prototype.updateMatrixWorld.call(this, force);
}

/**
 * À appeler dans un useFrame. `x, z` : centre de l'île (monde), `radius` : son rayon,
 * `depth` : profondeur d'où le décor remonte. `keep` : toujours affiché (île à quai, cap
 * en cours). `docked` : bateau à quai (portée réduite, voir `dockedDecorRange`).
 * `instant` : pas d'animation (île encore invisible, mouvement réduit). `gate` : porte des
 * animations du décor (fermée tant qu'il est masqué ou que l'île l'est).
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
  gate?: FrameGate,
) {
  // Le palier réel affine les portées (« Très léger » : plus courtes) ; un appelant qui
  // passe un autre niveau que le courant garde les portées de ce niveau.
  const tier = useWorld.getState().tier;
  const level = tierQuality(tier) === quality ? TIER_LEVELS[tier] : QUALITY_LEVELS[quality];
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
  if (perfOff) {
    if (gate) gate.open = true;
    return;
  }
  if (group.updateMatrixWorld !== sleepingUpdateMatrixWorld) group.updateMatrixWorld = sleepingUpdateMatrixWorld;
  if (gate) {
    let parentVisible = true;
    for (let node = group.parent; node; node = node.parent) {
      if (!node.visible) {
        parentVisible = false;
        break;
      }
    }
    gate.open = group.visible && parentVisible;
  }
}
