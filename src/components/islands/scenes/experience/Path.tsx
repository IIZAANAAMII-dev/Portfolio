'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { hash } from '@/lib/utils/math';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import { ClearingAt } from '../../kit';
import { Builder, paintMaterial, type V3 } from './build';
import { HARBOR, HARBOR_STAIRS, OFFICE, PATH, SUMMIT_STAIRS, toWorld } from './layout';
import { Lanterns, Merged } from './parts';

/**
 * Le chemin des années : marches de pierre taillées dans les falaises (du quai au plateau,
 * du plateau au sommet), dalles posées dans l'herbe d'une étape à l'autre, et quelques
 * lanternes pour la nuit (l'une d'elles coiffe la veilleuse de l'île, déjà en place).
 */

interface Flight {
  from: readonly [number, number];
  to: readonly [number, number];
  y0: number;
  y1: number;
  halfWidth: number;
  steps: number;
}

const FLIGHTS: Flight[] = [
  {
    from: toWorld(HARBOR.frame, HARBOR_STAIRS.from[0], HARBOR_STAIRS.from[1]),
    to: toWorld(HARBOR.frame, HARBOR_STAIRS.to[0], HARBOR_STAIRS.to[1]),
    y0: HARBOR.quay.y,
    y1: 4.24,
    halfWidth: HARBOR_STAIRS.halfWidth,
    steps: 12,
  },
  {
    from: SUMMIT_STAIRS.from,
    to: SUMMIT_STAIRS.to,
    y0: SUMMIT_STAIRS.y0,
    y1: OFFICE.y,
    halfWidth: SUMMIT_STAIRS.halfWidth,
    steps: 12,
  },
];

/** Réverbères du chemin ; le premier est posé sous la veilleuse existante de l'île. */
const PATH_LAMPS: [number, number, number][] = [
  [4.8, -1.5, 5.5],
  [4.45, -9.75, 0],
  [7.25, -6.45, 0],
  [8.95, 1.15, 0],
];

const STEP = new BoxGeometry(1, 1, 1);
const STONE = new CylinderGeometry(1, 1.08, 1, 7);
const STEP_MATERIAL = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
const STONE_MATERIAL = new MeshStandardMaterial({ color: '#d8cdb9', roughness: 1, flatShading: true });

function stepMatrices() {
  const matrices: Matrix4[] = [];
  const colors: Color[] = [];
  const dummy = new Object3D();
  const base = new Color('#e4d6bc');
  const shade = new Color('#cbb894');
  FLIGHTS.forEach((flight, flightIndex) => {
    const dx = flight.to[0] - flight.from[0];
    const dz = flight.to[1] - flight.from[1];
    const run = Math.hypot(dx, dz);
    const rise = flight.y1 - flight.y0;
    const yaw = Math.atan2(dx, dz);
    for (let index = 0; index < flight.steps; index++) {
      const t = (index + 0.5) / flight.steps;
      const top = flight.y0 + ((index + 1) / flight.steps) * rise;
      const height = rise / flight.steps + 0.3;
      dummy.position.set(flight.from[0] + dx * t, top - height / 2, flight.from[1] + dz * t);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(flight.halfWidth * 2 - 0.08, height, run / flight.steps + 0.02);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(base.clone().lerp(shade, hash(flightIndex * 31 + index * 1.7)));
    }
  });
  return { matrices, colors };
}

/** Murets de part et d'autre des escaliers et poteaux des réverbères. */
function wallsGeometry(sampler: HeightSampler) {
  const b = new Builder();
  FLIGHTS.forEach((flight) => {
    const dx = flight.to[0] - flight.from[0];
    const dz = flight.to[1] - flight.from[1];
    const run = Math.hypot(dx, dz);
    const sx = dz / run;
    const sz = -dx / run;
    for (const side of [-1, 1]) {
      const offset = flight.halfWidth + 0.08;
      const from: V3 = [flight.from[0] + sx * offset * side, flight.y0 + 0.28, flight.from[1] + sz * offset * side];
      const to: V3 = [flight.to[0] + sx * offset * side, flight.y1 + 0.28, flight.to[1] + sz * offset * side];
      const length = Math.hypot(run, flight.y1 - flight.y0);
      const pitch = Math.atan2(flight.y1 - flight.y0, run);
      b.slab([0.18, 0.5, length + 0.1], '#d9c7a4', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], Math.atan2(dx, dz), -pitch, 0.03);
    }
  });
  PATH_LAMPS.forEach(([x, z, top]) => {
    const ground = groundAt(sampler, x, z, 0.2) - 0.04;
    const head = top > 0 ? top : ground + 2.0;
    b.cylinder(0.11, 0.14, 0.22, 8, '#27302c', [x, ground + 0.11, z]);
    b.cylinder(0.04, 0.05, head - ground - 0.2, 6, '#27302c', [x, (ground + head - 0.2) / 2 + 0.1, z]);
    b.cylinder(0.09, 0.06, 0.1, 8, '#27302c', [x, head - 0.18, z]);
  });
  return b.build();
}

export function Path({ sampler }: { sampler: HeightSampler }) {
  const steps = useRef<InstancedMesh>(null);
  const stones = useRef<InstancedMesh>(null);
  const flights = useMemo(() => stepMatrices(), []);
  const walls = useMemo(() => wallsGeometry(sampler), [sampler]);
  const curve = useMemo(() => new CatmullRomCurve3(PATH.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal'), []);
  const count = Math.max(8, Math.round(curve.getLength() / 0.78));
  const lanterns = useMemo<V3[]>(() => PATH_LAMPS.slice(1).map(([x, z]) => [x, groundAt(sampler, x, z, 0.2) + 2.06, z]), [sampler]);

  useLayoutEffect(() => {
    const target = steps.current;
    if (!target) return;
    flights.matrices.forEach((m, index) => target.setMatrixAt(index, m));
    flights.colors.forEach((c, index) => target.setColorAt(index, c));
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [flights]);

  useLayoutEffect(() => {
    const target = stones.current;
    if (!target) return;
    const dummy = new Object3D();
    const point = new Vector3();
    for (let index = 0; index < count; index++) {
      curve.getPointAt(index / (count - 1), point);
      const jitter = (hash(index * 3.3) - 0.5) * 0.3;
      const x = point.x + jitter;
      const z = point.z - jitter * 0.6;
      dummy.position.set(x, groundAt(sampler, x, z, 0.3) + 0.03, z);
      dummy.rotation.set(0, hash(index * 1.9) * Math.PI, 0);
      const size = 0.3 + hash(index * 7.1) * 0.12;
      dummy.scale.set(size, 0.12, size * (0.8 + hash(index * 2.2) * 0.3));
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [count, curve, sampler]);

  return (
    <>
      {PATH.filter((_, index) => index % 2 === 0).map(([x, z]) => (
        <ClearingAt key={`${x}:${z}`} x={x} z={z} radius={1.25} />
      ))}
      <instancedMesh ref={steps} args={[STEP, STEP_MATERIAL, flights.matrices.length]} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={stones} args={[STONE, STONE_MATERIAL, count]} receiveShadow raycast={() => null} />
      <Merged geometry={walls} material={paintMaterial()} />
      <Lanterns points={lanterns} />
    </>
  );
}
