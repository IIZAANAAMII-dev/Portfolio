import { homeIsland, islands } from '@/data/islands';
import type { Vec2 } from '@/types';

/**
 * Pathfinding maritime.
 *
 * Le monde est un plan d'eau avec quelques obstacles convexes (les îles), tous
 * représentés par des cercles : la forme de collision la moins chère qui existe.
 * Pas besoin de grille ni de navmesh : on trace le segment direct, et si une île le
 * coupe, on insère un point de contournement tangent au cercle gonflé, récursivement.
 * Sur un archipel de 7 îles, le chemin est calculé en quelques dizaines de tests
 * segment/cercle — négligeable, et uniquement au moment d'un clic ou d'un replan.
 */

export type Circle = { x: number; z: number; r: number };

/** Rayon physique du bateau. */
export const BOAT_RADIUS = 2.1;
/** Marge de navigation : le chemin planifié passe à cette distance des côtes. */
const PLAN_MARGIN = 4.6;
const MAX_DEPTH = 9;
// La zone cliquable doit dépasser la limite du léviathan (184). L'ancienne valeur
// 150 rendait la mer interdite littéralement inaccessible par la navigation libre.
export const WORLD_LIMIT = 230;

export const SOLIDS: Circle[] = [
  { x: homeIsland.position[0], z: homeIsland.position[1], r: homeIsland.radius },
  ...islands.map((i) => ({ x: i.position[0], z: i.position[1], r: i.radius })),
];

/** Empêche de cliquer « dans » une île : la cible est repoussée sur le rivage. */
export function pushOutOfLand(point: Vec2, margin = 3): Vec2 {
  let [x, z] = point;
  for (const solid of SOLIDS) {
    const dx = x - solid.x;
    const dz = z - solid.z;
    const distance = Math.hypot(dx, dz);
    const min = solid.r + margin;
    if (distance < min && distance > 0.001) {
      x = solid.x + (dx / distance) * min;
      z = solid.z + (dz / distance) * min;
    }
  }
  const clamp = (v: number) => Math.min(WORLD_LIMIT, Math.max(-WORLD_LIMIT, v));
  return [clamp(x), clamp(z)];
}

/**
 * Premier cercle (gonflé de `margin`) coupé par le segment [a → b].
 * Renvoie aussi `t`, la position du point le plus proche le long du segment,
 * pour traiter les obstacles dans l'ordre où le bateau les rencontrerait.
 */
function firstBlocking(a: Vec2, b: Vec2, margin: number): { circle: Circle; t: number } | null {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const lengthSq = abx * abx + abz * abz;
  let best: { circle: Circle; t: number } | null = null;

  for (const circle of SOLIDS) {
    const inflated = circle.r + margin;
    const acx = circle.x - a[0];
    const acz = circle.z - a[1];
    const t = lengthSq > 0.0001 ? Math.min(1, Math.max(0, (acx * abx + acz * abz) / lengthSq)) : 0;
    const px = a[0] + abx * t;
    const pz = a[1] + abz * t;
    const distance = Math.hypot(circle.x - px, circle.z - pz);
    // Ignore les extrémités déjà « dans » la marge (ex : point d'accostage
    // volontairement proche du rivage) : seule la traversée du cœur compte.
    if (distance >= inflated) continue;
    if (t <= 0.02 || t >= 0.98) {
      const endInside = Math.hypot(circle.x - b[0], circle.z - b[1]) < inflated
        || Math.hypot(circle.x - a[0], circle.z - a[1]) < inflated;
      if (endInside) continue;
    }
    if (!best || t < best.t) best = { circle, t };
  }
  return best;
}

/** Le segment est-il navigable avec cette marge ? */
export function segmentIsClear(a: Vec2, b: Vec2, margin = PLAN_MARGIN): boolean {
  return firstBlocking(a, b, margin) === null;
}

/**
 * Point de contournement autour d'un cercle : on part du pied de la perpendiculaire
 * (le point du segment le plus proche du centre) et on le pousse hors du cercle,
 * du côté qui dévie le moins de la route directe.
 */
function detourPoint(a: Vec2, b: Vec2, circle: Circle, margin: number): Vec2 {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const length = Math.hypot(abx, abz) || 1;
  // Normale unitaire au segment.
  const nx = -abz / length;
  const nz = abx / length;
  // Côté du centre de l'île par rapport à la route : on contourne par l'autre côté.
  const side = (circle.x - a[0]) * nx + (circle.z - a[1]) * nz > 0 ? -1 : 1;
  const push = circle.r + margin * 1.35;
  // Pied de la perpendiculaire projeté depuis le centre.
  const t = ((circle.x - a[0]) * abx + (circle.z - a[1]) * abz) / (length * length);
  const footX = a[0] + abx * Math.min(1, Math.max(0, t));
  const footZ = a[1] + abz * Math.min(1, Math.max(0, t));
  let dirX = footX - circle.x + nx * side * 0.001;
  let dirZ = footZ - circle.z + nz * side * 0.001;
  const dirLength = Math.hypot(dirX, dirZ);
  if (dirLength < 0.01) {
    dirX = nx * side;
    dirZ = nz * side;
  } else {
    // Mélange : moitié « fuir le centre », moitié « côté choisi » — donne des arcs doux.
    dirX = dirX / dirLength * 0.5 + nx * side * 0.5;
    dirZ = dirZ / dirLength * 0.5 + nz * side * 0.5;
    const mixLength = Math.hypot(dirX, dirZ) || 1;
    dirX /= mixLength;
    dirZ /= mixLength;
  }
  return [circle.x + dirX * push, circle.z + dirZ * push];
}

function buildPath(a: Vec2, b: Vec2, margin: number, depth: number, out: Vec2[]): boolean {
  const hit = firstBlocking(a, b, margin);
  if (!hit) {
    out.push(b);
    return true;
  }
  if (depth >= MAX_DEPTH) {
    out.push(b);
    return false;
  }
  const via = pushOutOfLand(detourPoint(a, b, hit.circle, margin), margin);
  const okA = buildPath(a, via, margin, depth + 1, out);
  const okB = buildPath(via, b, margin, depth + 1, out);
  return okA && okB;
}

/** Retire les waypoints inutiles : si a → c est déjà libre, b ne sert à rien. */
function smoothPath(start: Vec2, path: Vec2[], margin: number): Vec2[] {
  const points = [start, ...path];
  const result: Vec2[] = [];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    for (let probe = points.length - 1; probe > anchor + 1; probe--) {
      if (segmentIsClear(points[anchor], points[probe], margin)) {
        next = probe;
        break;
      }
    }
    result.push(points[next]);
    anchor = next;
  }
  return result;
}

/**
 * Chemin complet du bateau vers `goal` : liste de waypoints, destination incluse.
 * `marginScale` < 1 est utilisé par l'anti-blocage pour replanifier plus serré
 * quand la marge normale ne trouve pas de solution.
 */
export function computePath(start: Vec2, goal: Vec2, marginScale = 1): Vec2[] {
  const margin = PLAN_MARGIN * marginScale;
  const raw: Vec2[] = [];
  buildPath(start, goal, margin, 0, raw);
  return smoothPath(start, raw, margin);
}

/** Île (gonflée) la plus proche d'un point — pour l'anti-blocage. */
export function nearestSolid(x: number, z: number): { circle: Circle; distance: number } {
  let best = SOLIDS[0];
  let bestDistance = Infinity;
  for (const circle of SOLIDS) {
    const distance = Math.hypot(circle.x - x, circle.z - z) - circle.r;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = circle;
    }
  }
  return { circle: best, distance: bestDistance };
}
