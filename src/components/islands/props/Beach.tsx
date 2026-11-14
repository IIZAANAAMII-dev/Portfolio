'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../terrain-shape';
import { scatterSpots, type ScatterZone } from './scatter';
import { MeshBuilder, type Vec3 } from './shapes';

/**
 * Trésors de la grève : étoiles de mer à cinq bras bombés et coquilles Saint-Jacques
 * côtelées, posées sur le sable mouillé. Un draw call par espèce, sans ombre portée ; la
 * couleur de chaque exemplaire vient de sa palette (corail, orangé, pourpre / crème, rose).
 */

/** Étoile de mer de rayon 1 : arêtes bombées, centre en dôme, tranche épaisse. */
function starfishGeometry() {
  const builder = new MeshBuilder();
  const arms = 5;
  const center: Vec3 = [0, 0.3, 0];
  const tip = (i: number): Vec3 => {
    const angle = (i / arms) * Math.PI * 2;
    return [Math.cos(angle) * 1.0, 0.07, Math.sin(angle) * 1.0];
  };
  const valley = (i: number): Vec3 => {
    const angle = ((i + 0.5) / arms) * Math.PI * 2;
    return [Math.cos(angle) * 0.34, 0.1, Math.sin(angle) * 0.34];
  };
  const ridge = (i: number): Vec3 => {
    const angle = (i / arms) * Math.PI * 2;
    return [Math.cos(angle) * 0.56, 0.22, Math.sin(angle) * 0.56];
  };
  const flank = (i: number, side: number): Vec3 => {
    const angle = (i / arms) * Math.PI * 2;
    const px = -Math.sin(angle) * side;
    const pz = Math.cos(angle) * side;
    return [Math.cos(angle) * 0.56 + px * 0.17, 0.08, Math.sin(angle) * 0.56 + pz * 0.17];
  };
  // Arête claire, creux plus soutenus : le relief se lit même sous un soleil haut.
  const paint = (x: number, y: number, z: number, ny: number, out: Color) => {
    out.setScalar(0.8 + Math.min(1, y / 0.3) * 0.38);
  };
  for (let i = 0; i < arms; i++) {
    const before = valley((i + arms - 1) % arms);
    const after = valley(i);
    const left = flank(i, -1);
    const right = flank(i, 1);
    const top = ridge(i);
    const end = tip(i);
    builder.triangleUp(center, before, left, paint);
    builder.triangleUp(center, left, top, paint);
    builder.triangleUp(center, top, right, paint);
    builder.triangleUp(center, right, after, paint);
    builder.triangleUp(left, end, top, paint);
    builder.triangleUp(top, end, right, paint);
    // Tranche : du contour jusqu'au sable.
    const outline = [before, left, end, right, after];
    for (let k = 0; k < outline.length - 1; k++) {
      const p = outline[k];
      const q = outline[k + 1];
      builder.quad(p, [p[0], -0.02, p[2]], [q[0], -0.02, q[2]], q, (x, y, z, ny, out) => out.setScalar(0.72));
    }
  }
  return builder.build()!;
}

/** Coquille Saint-Jacques de rayon 1 : éventail bombé, côtes rayonnantes, oreillettes. */
function shellGeometry() {
  const builder = new MeshBuilder();
  const ribs = 18;
  const rings = [0.08, 0.45, 0.78, 1];
  const spread = 1.25;
  const point = (k: number, ring: number): Vec3 => {
    const r = rings[ring];
    const angle = -spread + (k / ribs) * spread * 2;
    const crest = k % 2 === 1 ? 0.07 * r : 0;
    const dome = 0.26 * (1 - r * r) + 0.03;
    return [Math.sin(angle) * r, dome + crest, Math.cos(angle) * r - 0.45];
  };
  const paint = (x: number, y: number, z: number, ny: number, out: Color) => {
    // Côtes claires, sillons plus foncés, bord plus vif.
    out.setScalar(0.78 + Math.min(1, y / 0.3) * 0.18 + (Math.hypot(x, z + 0.45) > 0.9 ? 0.1 : 0));
  };
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let k = 0; k < ribs; k++) {
      builder.triangleUp(point(k, ring), point(k + 1, ring), point(k + 1, ring + 1), paint);
      builder.triangleUp(point(k, ring), point(k + 1, ring + 1), point(k, ring + 1), paint);
    }
  }
  // Fond de la coquille côté charnière, et les deux oreillettes.
  const hinge: Vec3 = [0, 0.04, -0.52];
  for (let k = 0; k < ribs; k++) builder.triangleUp(hinge, point(k, 0), point(k + 1, 0), paint);
  for (const side of [-1, 1]) {
    builder.triangleUp([side * 0.06, 0.05, -0.5], [side * 0.3, 0.03, -0.56], [side * 0.26, 0.05, -0.36], paint);
  }
  // Tranche du bord.
  for (let k = 0; k < ribs; k++) {
    const p = point(k, rings.length - 1);
    const q = point(k + 1, rings.length - 1);
    builder.quad(p, q, [q[0], -0.02, q[2]], [p[0], -0.02, p[2]], (x, y, z, ny, out) => out.setScalar(0.7));
  }
  return builder.build()!;
}

const STARFISH = starfishGeometry();
const SHELL = shellGeometry();
const MATERIAL = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.78, metalness: 0, flatShading: true });
MATERIAL.name = 'beach-treasures';

const STAR_COLORS = ['#e8774f', '#e05a48', '#f2a04d', '#b9577e', '#e98a5e'];
const SHELL_COLORS = ['#f3e3cc', '#f0c9b8', '#f5d7a8', '#e9b6a7', '#f7eee0'];

const position = new Vector3();
const rotation = new Quaternion();
const tilt = new Quaternion();
const scale = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const normal = new Vector3();

function Species({
  geometry,
  sampler,
  zone,
  count,
  seed,
  minSize,
  maxSize,
  colors,
}: {
  geometry: BufferGeometry;
  sampler: HeightSampler;
  zone: ScatterZone;
  count: number;
  seed: number;
  minSize: number;
  maxSize: number;
  colors: string[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const zoneKey = JSON.stringify(zone);
  const spots = useMemo(
    () => scatterSpots(sampler, JSON.parse(zoneKey) as ScatterZone, count, seed, { size: [minSize, maxSize], spacing: 3 }),
    [count, maxSize, minSize, sampler, seed, zoneKey],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    const tint = new Color();
    spots.forEach((spot, index) => {
      // Posée à plat sur le sable, épousant la pente de la grève.
      const step = 0.3;
      normal.set(
        sampler(spot.x - step, spot.z) - sampler(spot.x + step, spot.z),
        2 * step,
        sampler(spot.x, spot.z - step) - sampler(spot.x, spot.z + step),
      ).normalize();
      tilt.setFromUnitVectors(yAxis, normal);
      rotation.setFromAxisAngle(yAxis, spot.yaw);
      tilt.multiply(rotation);
      const radius = spot.size / 2;
      position.set(spot.x, spot.y - 0.01, spot.z);
      scale.set(radius, radius * (0.8 + hash(spot.key * 3.1) * 0.4), radius);
      matrix.compose(position, tilt, scale);
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, tint.set(colors[Math.floor(hash(spot.key * 7.3) * colors.length) % colors.length]));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [colors, sampler, spots]);

  if (spots.length === 0) return null;
  return (
    <instancedMesh
      key={spots.length}
      ref={mesh}
      args={[geometry, MATERIAL, spots.length]}
      castShadow={false}
      receiveShadow
      raycast={() => null}
    />
  );
}

/** Étoiles de mer et coquillages sur le sable mouillé d'une île. */
export function BeachTreasures({
  sampler,
  zone,
  starfish = 5,
  shells = 7,
  seed,
}: {
  sampler: HeightSampler;
  zone: ScatterZone;
  starfish?: number;
  shells?: number;
  seed: number;
}) {
  const quality = useWorld((state) => state.quality);
  const density = QUALITY_LEVELS[quality].vegetationDensity;
  return (
    <>
      {starfish > 0 && (
        <Species geometry={STARFISH} sampler={sampler} zone={zone} count={Math.max(1, Math.round(starfish * density))} seed={seed} minSize={0.42} maxSize={0.62} colors={STAR_COLORS} />
      )}
      {shells > 0 && quality !== 'low' && (
        <Species geometry={SHELL} sampler={sampler} zone={zone} count={Math.round(shells * density)} seed={seed + 17} minSize={0.24} maxSize={0.36} colors={SHELL_COLORS} />
      )}
    </>
  );
}
