import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../../terrain-shape';
import { fromFrame } from './terrain';

/**
 * Placement : orientation vers la caméra à quai et semis déterministes.
 */

/**
 * Position moyenne de la caméra à quai (repère de l'île) : elle tourne avec le soleil
 * entre ~0,1 rad (matin) et ~1,1 rad (soir) ; 0,55 est un bon compromis.
 */
const CAMERA_ANGLE = 0.55;
const CAMERA_X = Math.cos(CAMERA_ANGLE) * 34;
const CAMERA_Z = Math.sin(CAMERA_ANGLE) * 34;

/** rotation.y qui tourne l'avant (+z local) d'un objet vers la caméra à quai. */
export function faceCamera(x: number, z: number, offset = 0) {
  return Math.atan2(CAMERA_X - x, CAMERA_Z - z) + offset;
}

export function slopeAt(sampler: HeightSampler, x: number, z: number) {
  const dx = sampler(x + 0.4, z) - sampler(x - 0.4, z);
  const dz = sampler(x, z + 0.4) - sampler(x, z - 0.4);
  return Math.hypot(dx, dz) / 0.8;
}

export interface Spot {
  x: number;
  z: number;
  y: number;
  u: number;
  v: number;
  /** Nombre aléatoire déterministe propre au point (0 → 1). */
  r: number;
}

/**
 * Semis dans un rectangle du repère (u, v) : `accept` filtre chaque candidat. Les points
 * restent espacés d'au moins `spacing`.
 */
export function scatter(
  sampler: HeightSampler,
  {
    count,
    seed,
    u: [u0, u1],
    v: [v0, v1],
    spacing,
    accept,
  }: {
    count: number;
    seed: number;
    u: [number, number];
    v: [number, number];
    spacing: number;
    accept: (spot: Spot) => boolean;
  },
) {
  const spots: Spot[] = [];
  for (let attempt = 0; attempt < count * 30 && spots.length < count; attempt++) {
    const u = u0 + hash(seed + attempt * 1.618) * (u1 - u0);
    const v = v0 + hash(seed * 1.3 + attempt * 2.414 + 0.5) * (v1 - v0);
    const [x, z] = fromFrame(u, v);
    const spot = { x, z, y: sampler(x, z), u, v, r: hash(seed * 0.7 + attempt * 3.33) };
    if (!accept(spot)) continue;
    if (spots.some((other) => Math.hypot(other.x - x, other.z - z) < spacing)) continue;
    spots.push(spot);
  }
  return spots;
}

/** Distance (u, v) à une liste de points. */
export function farFrom(u: number, v: number, points: [number, number, number][]) {
  return points.every(([pu, pv, radius]) => Math.hypot(u - pu, v - pv) > radius);
}
