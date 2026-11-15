'use client';

import { useEffect, useMemo } from 'react';
import { BoxGeometry, Color, CylinderGeometry, MeshStandardMaterial } from 'three';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../terrain-shape';
import { MeshBuilder, perFace, pose, type Vec3 } from './shapes';

/**
 * Sentier de pierres plates : des dalles irrégulières posées le long d'un tracé, et des
 * marches empilées là où le sol monte trop vite (pied de falaise). Un seul maillage.
 */

const STONES = ['#c4b8a6', '#b5aa99', '#cfc3ae', '#ada392'];
const MATERIAL = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.94, metalness: 0, flatShading: true });
MATERIAL.name = 'stone-path';

/** Dalle : un prisme à 6–7 pans un peu irrégulier, le dessus légèrement bombé. */
function slab(builder: MeshBuilder, at: Vec3, radius: number, height: number, yaw: number, seed: number) {
  const sides = 6 + Math.floor(hash(seed) * 2);
  const geometry = new CylinderGeometry(radius, radius * 1.05, height, sides, 1);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const angle = Math.atan2(z, x);
    const wobble = 0.82 + hash(seed + Math.round(angle * 10) * 1.7) * 0.3;
    positions.setX(index, x * wobble * 1.15);
    positions.setZ(index, z * wobble * 0.9);
    if (positions.getY(index) > 0 && Math.hypot(x, z) < 1e-4) positions.setY(index, height / 2 + 0.015);
  }
  const tone = new Color(STONES[Math.floor(hash(seed * 3.1) * STONES.length) % STONES.length]).multiplyScalar(0.92 + hash(seed * 5.7) * 0.14);
  builder.add(geometry, perFace((x, y, z, ny, out) => {
    out.copy(tone).multiplyScalar(ny > 0.6 ? 1.07 : 0.8);
  }), pose([at[0], at[1] - height / 2 + 0.035, at[2]], [0, yaw, 0]));
}

/**
 * Escalier de bois contre une petite falaise : marches régulières entre `from` (en bas,
 * hauteur `bottom`) et `to` (en haut, hauteur `top`), limons et poteaux de main courante.
 */
function stairs(builder: MeshBuilder, from: [number, number], to: [number, number], bottom: number, top: number, width: number) {
  const steps = Math.max(2, Math.round((top - bottom) / 0.2));
  const rise = (top - bottom) / steps;
  const yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const run = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const slope = Math.atan2(top - bottom, run);
  const at = (t: number, side: number, y: number): Vec3 => [
    from[0] + (to[0] - from[0]) * t + Math.cos(yaw) * side,
    y,
    from[1] + (to[1] - from[1]) * t - Math.sin(yaw) * side,
  ];
  for (let index = 0; index < steps; index++) {
    const t = (index + 0.5) / steps;
    const tone = new Color('#b07a4c').multiplyScalar(0.9 + hash(index * 3.7) * 0.18);
    builder.add(new BoxGeometry(width, 0.06, Math.max(0.24, (run / steps) * 1.25)), tone.getStyle(), pose(at(t, 0, bottom + rise * (index + 1) - 0.03), [0, yaw, 0]), 0.2);
  }
  for (const side of [-1, 1]) {
    const length = Math.hypot(run, top - bottom) + 0.2;
    builder.add(new BoxGeometry(0.07, 0.2, length), '#6e4a31', pose(at(0.5, side * (width / 2 + 0.035), (top + bottom) / 2 - 0.08), [-slope, yaw, 0], 1), 0.1);
    // Poteaux de main courante en haut et en bas, et la main courante elle-même.
    for (const t of [0, 1]) {
      const y = t === 0 ? bottom : top;
      builder.add(new BoxGeometry(0.07, 0.8, 0.07), '#6e4a31', pose(at(t, side * (width / 2 + 0.035), y + 0.32)), 0.1);
    }
    builder.add(new BoxGeometry(0.05, 0.05, length), '#8a5d3b', pose(at(0.5, side * (width / 2 + 0.035), (top + bottom) / 2 + 0.68), [-slope, yaw, 0]), 0.15);
  }
}

export function StonePath({
  sampler,
  points,
  spacing = 0.62,
  seed = 1,
  stair,
}: {
  sampler: HeightSampler;
  /** Tracé des dalles (repère de l'île). */
  points: [number, number][];
  spacing?: number;
  seed?: number;
  /** Escalier de bois facultatif : pied, haut, hauteurs et largeur. */
  stair?: { from: [number, number]; to: [number, number]; bottom: number; top: number; width: number };
}) {
  const key = JSON.stringify({ points, stair });
  const geometry = useMemo(() => {
    const plan = JSON.parse(key) as { points: [number, number][]; stair?: { from: [number, number]; to: [number, number]; bottom: number; top: number; width: number } };
    const route = plan.points;
    const builder = new MeshBuilder();
    if (plan.stair) stairs(builder, plan.stair.from, plan.stair.to, plan.stair.bottom, plan.stair.top, plan.stair.width);
    let stone = 0;
    for (let segment = 0; segment < route.length - 1; segment++) {
      const [ax, az] = route[segment];
      const [bx, bz] = route[segment + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.round(length / spacing));
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let index = segment === 0 ? 0 : 1; index <= steps; index++) {
        const t = index / steps;
        // Un peu de zigzag : les pierres ne sont pas alignées au cordeau.
        const side = (hash(seed + stone * 2.3) - 0.5) * 0.22;
        const x = ax + (bx - ax) * t + Math.cos(yaw) * side;
        const z = az + (bz - az) * t - Math.sin(yaw) * side;
        const ground = Math.max(sampler(x, z), sampler(x + 0.25, z), sampler(x - 0.25, z), sampler(x, z + 0.25), sampler(x, z - 0.25));
        slab(builder, [x, ground + 0.02, z], 0.26 + hash(seed + stone * 4.1) * 0.07, 0.16, yaw + hash(seed + stone) * 0.8, seed + stone * 7.7);
        stone += 1;
      }
    }
    return builder.build();
  }, [key, sampler, seed, spacing]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={MATERIAL} receiveShadow castShadow raycast={() => null} />;
}
