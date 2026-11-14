import { islandById } from '@/data/islands';

/**
 * Plan de l'île Contact (repère local de l'île). Partagé par `config.ts` (le relief est
 * retouché pour accueillir chaque élément) et par le décor.
 *
 *  - le phare sur la butte (centre décalé de l'île), la maison du gardien en contrebas ;
 *  - un escalier monte du ponton au plateau, un second grimpe la butte jusqu'au phare ;
 *  - la boîte aux lettres et la cloche encadrent le haut de l'escalier du ponton ;
 *  - la longue jetée aux lanternes part vers l'est-sud-est, un banc au bout regarde le
 *    couchant (le soleil se couche vers -X, +Z : voir Lighting).
 */

const island = islandById.contact;

export const DOCK_ANGLE = island.dockAngle;
export const DOCK_DIR = { x: Math.cos(DOCK_ANGLE), z: Math.sin(DOCK_ANGLE) };
/** Normale au ponton (vers l'ouest de l'île). */
export const DOCK_SIDE = { x: -DOCK_DIR.z, z: DOCK_DIR.x };

export function polar(angle: number, radius: number) {
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

/** Point sur l'axe du ponton (`along` depuis le centre de l'île, `side` latéral). */
export function onDockAxis(along: number, side = 0) {
  return { x: DOCK_DIR.x * along + DOCK_SIDE.x * side, z: DOCK_DIR.z * along + DOCK_SIDE.z * side };
}

/** Escalier du ponton : du plancher (0,78 m) au plateau. */
export const DOCK_STAIRS = { bottom: 9.85, top: 7.95, steps: 6 };

/** Maison du gardien : position et orientation (sa façade regarde vers le sud-ouest). */
const cottageAt = polar(0.55, 7.3);
export const COTTAGE = { x: cottageAt.x, z: cottageAt.z, yaw: Math.PI / 2 - 1.95, width: 3.0, depth: 2.2 };

/** Longue jetée : angle, départ sur la plage, bout au large ; tête en T avec le banc. */
export const PIER = { angle: 0.85, start: 10.25, end: 19.3, half: 0.82, head: 2.1, headHalf: 1.5 };

/** Direction du couchant (vers où regarde le banc). */
export const SUNSET_DIR = { x: -0.89, z: 0.45 };

export const MAILBOX = onDockAxis(7.35, 1.95);
export const BELL = onDockAxis(7.45, -1.95);

/** Le phare : sur la butte, dont le relief est aplani (voir config). */
export function hillStairs(hillX: number, hillZ: number) {
  const top = onDockAxis(DOCK_STAIRS.top - 0.1);
  const dx = top.x - hillX;
  const dz = top.z - hillZ;
  const length = Math.hypot(dx, dz) || 1;
  return { dirX: dx / length, dirZ: dz / length, from: 2.75, to: 4.95, length };
}
