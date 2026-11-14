import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../terrain-shape';

/**
 * Semis déterministes des accessoires (rochers, fleurs, coquillages) : où ils ont le droit
 * de pousser, comment ils se regroupent. Fonctions pures, calculées une fois par île.
 */

/** Zone de semis, dans le repère de l'île (même convention que l'ancien semis Bell Island). */
export interface ScatterZone {
  /** Rayon minimal et maximal autour du centre de l'île. */
  inner: number;
  outer: number;
  /** Altitudes autorisées. */
  minHeight?: number;
  maxHeight?: number;
  /** Pente maximale (0 = plat, 1 = vertical). */
  maxSlope?: number;
  /** Secteur angulaire à laisser libre (le ponton), en radians. */
  avoidAngle?: number;
  avoidWidth?: number;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** Rotation autour de la verticale. */
  yaw: number;
  /** Taille (mètres, ou facteur d'échelle selon l'accessoire). */
  size: number;
  /** Graine propre à l'exemplaire (0 → 1). */
  key: number;
  /** Pente du sol sous l'exemplaire (0 → 1). */
  slope: number;
}

export function slopeAt(sampler: HeightSampler, x: number, z: number) {
  const step = 0.5;
  const dx = sampler(x + step, z) - sampler(x - step, z);
  const dz = sampler(x, z + step) - sampler(x, z - step);
  const gradient = Math.hypot(dx, dz) / (2 * step);
  return gradient / Math.sqrt(1 + gradient * gradient);
}

export function angleGap(a: number, b: number) {
  return Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

/** Hauteur du sol si (x, z) respecte la zone, sinon null. */
export function zoneHeight(sampler: HeightSampler, zone: ScatterZone, x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < zone.inner || r > zone.outer) return null;
  if (zone.avoidAngle !== undefined && angleGap(Math.atan2(z, x), zone.avoidAngle) < (zone.avoidWidth ?? 0.35)) return null;
  const y = sampler(x, z);
  if (zone.minHeight !== undefined && y < zone.minHeight) return null;
  if (zone.maxHeight !== undefined && y > zone.maxHeight) return null;
  if (zone.maxSlope !== undefined && slopeAt(sampler, x, z) > zone.maxSlope) return null;
  return y;
}

interface ScatterOptions {
  /** Tailles extrêmes ; `bias` > 1 favorise les petites. */
  size: [number, number];
  bias?: number;
  /** Écart minimal entre deux exemplaires, en multiples de la somme de leurs tailles / 2. */
  spacing?: number;
}

/** `count` exemplaires répartis uniformément dans la zone (anneau), sans chevauchement. */
export function scatterSpots(sampler: HeightSampler, zone: ScatterZone, count: number, seed: number, options: ScatterOptions) {
  const spots: Spot[] = [];
  const [minSize, maxSize] = options.size;
  const spacing = options.spacing ?? 0;
  for (let attempt = 1; spots.length < count && attempt < count * 16 + 20; attempt++) {
    const angle = hash(seed + attempt * 1.37) * Math.PI * 2;
    const t = hash(seed + attempt * 3.71);
    const spread = Math.sqrt(zone.inner ** 2 + t * (zone.outer ** 2 - zone.inner ** 2));
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const y = zoneHeight(sampler, zone, x, z);
    if (y === null) continue;
    const size = minSize + Math.pow(hash(seed + attempt * 5.11), options.bias ?? 1) * (maxSize - minSize);
    if (spacing > 0 && spots.some((other) => Math.hypot(other.x - x, other.z - z) < (other.size + size) * 0.5 * spacing)) continue;
    spots.push({ x, y, z, yaw: hash(seed + attempt * 9.23) * Math.PI * 2, size, key: hash(seed + attempt * 2.53), slope: slopeAt(sampler, x, z) });
  }
  return spots;
}

/**
 * Groupes : un exemplaire principal et quelques satellites plus petits autour de lui,
 * comme les éboulis au pied d'une falaise ou les galets autour d'un gros rocher.
 */
export function clusterSpots(
  sampler: HeightSampler,
  zone: ScatterZone,
  groups: number,
  seed: number,
  options: ScatterOptions & { satellites: [number, number]; satelliteScale?: [number, number] },
) {
  const heads = scatterSpots(sampler, zone, groups, seed, { ...options, spacing: Math.max(options.spacing ?? 0, 2.2) });
  const spots: Spot[] = [...heads];
  const [minScale, maxScale] = options.satelliteScale ?? [0.3, 0.6];
  // Les satellites peuvent déborder un peu de la zone (en altitude), pas du secteur réservé.
  const loose: ScatterZone = { ...zone, inner: zone.inner * 0.85, outer: zone.outer * 1.08, minHeight: (zone.minHeight ?? -9) - 0.4, maxHeight: (zone.maxHeight ?? 99) + 0.4, maxSlope: undefined };
  heads.forEach((head, index) => {
    const wanted = options.satellites[0] + Math.floor(hash(seed + index * 4.7) * (options.satellites[1] - options.satellites[0] + 1));
    for (let item = 0; item < wanted; item++) {
      const key = seed + index * 13.1 + item * 3.3;
      const angle = hash(key) * Math.PI * 2;
      const size = head.size * (minScale + hash(key + 0.4) * (maxScale - minScale));
      const distance = (head.size + size) * (0.42 + hash(key + 0.8) * 0.3);
      const x = head.x + Math.cos(angle) * distance;
      const z = head.z + Math.sin(angle) * distance;
      const y = zoneHeight(sampler, loose, x, z);
      if (y === null) continue;
      if (spots.some((other) => Math.hypot(other.x - x, other.z - z) < (other.size + size) * 0.4)) continue;
      spots.push({ x, y, z, yaw: hash(key + 1.9) * Math.PI * 2, size, key: hash(key + 2.7), slope: slopeAt(sampler, x, z) });
    }
  });
  return spots;
}
