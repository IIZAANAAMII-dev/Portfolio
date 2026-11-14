import { CatmullRomCurve3, Vector3 } from 'three';
import type { HeightSampler } from '../../terrain-shape';
import { AXIS, BRIDGE_U, bridgeEnds, fromFrame, LANDING, TRAIL_BRETON, TRAIL_PROVENCE } from './terrain';

/**
 * Le pont et le chemin de l'histoire : profil du tablier (bombé), et la route complète
 * crique → chaumière → pont → Panier → calanque, échantillonnée pour le petit voyageur.
 */

/** Débord du pont sur chaque palier, au-delà du bord de l'eau. */
export const BRIDGE_REACH = 1.5;
export const BRIDGE_APEX = 2.18;
export const BRIDGE_WIDTH = 1.6;

/** Le pont en repère local : s le long du pont (de la Bretagne vers Marseille), centré. */
export function bridgeSpan() {
  const { breton, provence } = bridgeEnds();
  const start = breton - BRIDGE_REACH;
  const end = provence + BRIDGE_REACH;
  return { start, end, length: end - start, middle: (start + end) / 2 };
}

/** Hauteur du dessus du tablier en s (0 au milieu). */
export function deckHeight(s: number) {
  const { length } = bridgeSpan();
  const k = Math.min(1, Math.abs(s) / (length / 2));
  return LANDING + 0.12 + (BRIDGE_APEX - LANDING - 0.12) * Math.pow(1 - k * k, 0.75);
}

/** Rotation (y) d'un objet construit avec x local = traversée du chenal (v), z local = u. */
export const FRAME_YAW = Math.PI / 2 - AXIS;

export interface RoutePoint {
  x: number;
  y: number;
  z: number;
  /** Abscisse curviligne (m). */
  distance: number;
}

/** Route complète, un point tous les ~0,25 m, posée sur le sol (ou sur le tablier). */
export function buildRoute(sampler: HeightSampler) {
  const { start, end, middle } = bridgeSpan();
  const toVec = ([u, v]: [number, number]) => {
    const [x, z] = fromFrame(u, v);
    return new Vector3(x, 0, z);
  };
  const bretonCurve = new CatmullRomCurve3(TRAIL_BRETON.map(toVec), false, 'centripetal');
  const provenceCurve = new CatmullRomCurve3(TRAIL_PROVENCE.map(toVec), false, 'centripetal');
  const points: RoutePoint[] = [];
  let distance = 0;
  const push = (x: number, y: number, z: number) => {
    const last = points[points.length - 1];
    if (last) distance += Math.hypot(x - last.x, y - last.y, z - last.z);
    points.push({ x, y, z, distance });
  };
  const sample = (curve: CatmullRomCurve3) => {
    const count = Math.max(8, Math.round(curve.getLength() / 0.25));
    const point = new Vector3();
    for (let index = 0; index <= count; index++) {
      curve.getPointAt(index / count, point);
      push(point.x, sampler(point.x, point.z), point.z);
    }
  };
  sample(bretonCurve);
  // Sur le pont : du bout breton au bout marseillais, en suivant le bombé du tablier.
  const steps = 26;
  for (let index = 0; index <= steps; index++) {
    const v = start + ((end - start) * index) / steps;
    const [x, z] = fromFrame(BRIDGE_U, v);
    push(x, Math.max(deckHeight(v - middle), sampler(x, z)), z);
  }
  sample(provenceCurve);
  return points;
}

/** Point de la route à l'abscisse `distance` (interpolé), écrit dans `out`. */
export function routeAt(route: RoutePoint[], distance: number, out: { x: number; y: number; z: number; heading: number }) {
  const total = route[route.length - 1].distance;
  const d = Math.min(Math.max(distance, 0), total);
  // Recherche dichotomique du segment.
  let low = 0;
  let high = route.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (route[mid].distance < d) low = mid;
    else high = mid;
  }
  const a = route[low];
  const b = route[high];
  const t = b.distance > a.distance ? (d - a.distance) / (b.distance - a.distance) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  out.heading = Math.atan2(b.x - a.x, b.z - a.z);
  return out;
}

/** Abscisse de la route la plus proche d'un point (u, v). */
export function routeDistanceNear(route: RoutePoint[], u: number, v: number) {
  const [x, z] = fromFrame(u, v);
  let best = Infinity;
  let at = 0;
  for (const point of route) {
    const d = Math.hypot(point.x - x, point.z - z);
    if (d < best) {
      best = d;
      at = point.distance;
    }
  }
  return at;
}
