'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { hash } from '@/lib/utils/math';
import type { SkillZoneId } from '@/types';
import { ClearingAt } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { Merger, pose, type Vec3 } from './geometry';
import { DOCK_ANGLE, HUB, pathSpecs, PLAZA_TOP, STAIR_TOP, ZONE_SPOTS, type PathSpec } from './layout';
import { flowMaterial, glowMaterial, paintMaterial } from './materials';
import { noRaycast } from './Zone';

/**
 * Le sol du laboratoire : allées de gravier clair parcourues d'une ligne de lumière
 * (les impulsions vont de l'escalier au noyau, puis du noyau vers chaque zone),
 * lampadaires, escalier de bois du ponton, rochers de la grève et touffes de fleurs.
 */

const GRAVEL = new Color('#dccaa3');
const GRAVEL_EDGE = new Color('#c2ad84');

/** Points régulièrement espacés le long d'une allée (lissée si elle a plus de deux points). */
function sample(spec: PathSpec, step = 0.22) {
  const points = spec.points.map(([x, z]) => new Vector3(x, 0, z));
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const count = Math.max(2, Math.ceil(curve.getLength() / step));
  return curve.getSpacedPoints(count);
}

interface Built {
  paint: BufferGeometry;
  glow: BufferGeometry;
  flow: BufferGeometry;
}

function buildGrounds(sampler: HeightSampler, specs: PathSpec[]): Built {
  const ribbons: number[] = [];
  const ribbonColors: number[] = [];
  const strips: number[] = [];
  const stripColors: number[] = [];
  const stripFlow: number[] = [];
  const tint = new Color();

  const pushStrip = (a: Vector3, b: Vector3, ya: number, yb: number, width: number, flowA: number, flowB: number, color: Color) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (-(b.z - a.z) / length) * (width / 2);
    const nz = ((b.x - a.x) / length) * (width / 2);
    const quad: [number, number, number, number][] = [
      [a.x + nx, ya, a.z + nz, flowA], [b.x + nx, yb, b.z + nz, flowB], [a.x - nx, ya, a.z - nz, flowA],
      [a.x - nx, ya, a.z - nz, flowA], [b.x + nx, yb, b.z + nz, flowB], [b.x - nx, yb, b.z - nz, flowB],
    ];
    for (const [x, y, z, flow] of quad) {
      strips.push(x, y, z);
      stripFlow.push(flow);
      stripColors.push(color.r, color.g, color.b);
    }
  };

  const plazaY = HUB.level + PLAZA_TOP + 0.006;
  specs.forEach((spec, specIndex) => {
    const points = sample(spec);
    const color = new Color(spec.color);
    const toward = (point: Vector3, radius: number) => new Vector3(point.x, 0, point.z).normalize().multiplyScalar(radius);
    // Les allées des zones commencent sur la place (ligne incrustée), celle de
    // l'escalier y finit.
    const isEntry = specIndex === 0;
    const hubEnd = isEntry ? points[points.length - 1] : points[0];
    const inner = toward(hubEnd, 1.45);
    const outer = toward(hubEnd, HUB.radius - 0.02);
    let flow = 0;
    if (!isEntry) {
      pushStrip(inner, outer, plazaY, plazaY, 0.09, 0, 1.05, color);
      flow = 1.05;
    }
    // Ruban de gravier (bords plus sombres) et ligne de lumière au milieu.
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index];
      const b = points[index + 1];
      const ya = sampler(a.x, a.z);
      const yb = sampler(b.x, b.z);
      const length = a.distanceTo(b);
      const direction = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      const side = new Vector3(-direction.z, 0, direction.x);
      const half = (index: number) => (spec.width / 2) * (0.92 + hash(specIndex * 31 + index * 1.7) * 0.16);
      const rows = [-1, 0, 1];
      const vertexAt = (point: Vector3, y: number, row: number, segment: number): Vec3 => {
        const reach = row * half(segment);
        return [point.x + side.x * reach, y + 0.035 + (row === 0 ? 0.008 : 0), point.z + side.z * reach];
      };
      for (let row = 0; row < 2; row++) {
        const r0 = rows[row];
        const r1 = rows[row + 1];
        const a0 = vertexAt(a, ya, r0, index);
        const a1 = vertexAt(a, ya, r1, index);
        const b0 = vertexAt(b, yb, r0, index + 1);
        const b1 = vertexAt(b, yb, r1, index + 1);
        // Les deux triangles du quadrilatère, face vers le ciel.
        const quad: [Vec3, number][] = [[a0, r0], [a1, r1], [b0, r0], [b0, r0], [a1, r1], [b1, r1]];
        for (const [vertex, rowIndex] of quad) {
          ribbons.push(...vertex);
          const jitter = 0.94 + hash(vertex[0] * 3.1 + vertex[2] * 7.3) * 0.1;
          tint.copy(rowIndex === 0 ? GRAVEL : GRAVEL_EDGE).multiplyScalar(jitter);
          ribbonColors.push(tint.r, tint.g, tint.b);
        }
      }
      pushStrip(a, b, ya + 0.052, yb + 0.052, 0.09, flow, flow + length, color);
      flow += length;
    }
    if (isEntry) pushStrip(outer, inner, plazaY, plazaY, 0.09, flow, flow + 1.05, color);
  });

  const paint = new Merger();
  const glow = new Merger();
  const ribbonGeometry = new BufferGeometry();
  ribbonGeometry.setAttribute('position', new BufferAttribute(new Float32Array(ribbons), 3));
  ribbonGeometry.setAttribute('color', new BufferAttribute(new Float32Array(ribbonColors), 3));
  ribbonGeometry.computeVertexNormals();
  paint.addPainted(ribbonGeometry);

  // Lampadaires : le long de l'allée du ponton et au bout de chaque allée de zone.
  const lamps: [number, number][] = [];
  const entry = sample(specs[0]);
  for (const t of [0.3, 0.68]) {
    const point = entry[Math.round(t * (entry.length - 1))];
    const next = entry[Math.min(entry.length - 1, Math.round(t * (entry.length - 1)) + 1)];
    const direction = new Vector3(next.x - point.x, 0, next.z - point.z).normalize();
    for (const sideSign of [-1, 1]) lamps.push([point.x - direction.z * 0.95 * sideSign, point.z + direction.x * 0.95 * sideSign]);
  }
  for (const spot of ZONE_SPOTS) {
    const angle = Math.atan2(spot.z, spot.x);
    const distance = Math.hypot(spot.x, spot.z) - spot.pad - 0.25;
    lamps.push([Math.cos(angle) * distance - Math.sin(angle) * 0.7, Math.sin(angle) * distance + Math.cos(angle) * 0.7]);
  }
  for (const [x, z] of lamps) {
    const y = sampler(x, z) - 0.04;
    paint.cylinder(0.09, 0.12, 0.08, 8, '#5b6472', [x, y + 0.04, z]);
    paint.cylinder(0.03, 0.04, 1.1, 6, '#3d4658', [x, y + 0.58, z], undefined, 0);
    paint.cylinder(0.02, 0.13, 0.08, 8, '#3d4658', [x, y + 1.31, z], undefined, 0);
    glow.box([0.13, 0.17, 0.13], '#ffd98a', [x, y + 1.19, z], undefined, 0);
  }

  // Escalier de bois : du plancher du ponton jusqu'au bord du plateau.
  const dirX = Math.cos(DOCK_ANGLE);
  const dirZ = Math.sin(DOCK_ANGLE);
  const bottomR = 11.75;
  const topR = STAIR_TOP.distance + 0.1;
  const bottomY = 0.8;
  const topY = sampler(dirX * topR, dirZ * topR);
  const steps = Math.max(4, Math.round((topY - bottomY) / 0.2));
  const turn = Math.atan2(dirX, dirZ);
  paint.group(pose([dirX * topR, topY, dirZ * topR], [0, turn, 0]), () => {
    // Repère : +Z descend vers la mer, l'escalier part de l'origine (le haut).
    const run = bottomR - topR;
    const rise = topY - bottomY;
    for (let index = 0; index < steps; index++) {
      const k = (index + 0.5) / steps;
      paint.box([1.0, 0.05, run / steps + 0.05], '#a8774a', [0, -k * rise - 0.025, k * run], undefined, 0.1);
    }
    for (const side of [-0.53, 0.53]) {
      paint.rod([side, 0.0, -0.1], [side, -rise - 0.05, run + 0.05], 0.045, '#7d5534', 4);
      paint.rod([side, 0.0, 0.05], [side, 0.75, 0.05], 0.03, '#6e4a33', 5);
      paint.rod([side, -rise, run], [side, -rise + 0.75, run], 0.03, '#6e4a33', 5);
      paint.rod([side, 0.75, 0.05], [side, -rise + 0.75, run], 0.018, '#d8c49a', 5);
    }
  });

  return { paint: paint.build(), glow: glow.build(), flow: stripGeometry(strips, stripColors, stripFlow) };
}

function stripGeometry(positions: number[], colors: number[], flows: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('aFlow', new BufferAttribute(new Float32Array(flows), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/* ------------------------------------------------------------ rochers, fleurs */

const rockMaterial = new MeshStandardMaterial({ color: '#a39cad', roughness: 1, flatShading: true });
rockMaterial.name = 'skills-rock';

const FLOWER_COLORS = ['#fff6e8', '#ffd23f', '#ff9fb8', '#c9a7f0'].map((color) => new Color(color));
const dummy = new Object3D();

interface Scatter {
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  turn: number;
  color?: Color;
}

function rockSpots(sampler: HeightSampler): Scatter[] {
  const spots: Scatter[] = [];
  for (let attempt = 0; spots.length < 18 && attempt < 200; attempt++) {
    const angle = hash(attempt * 2.71 + 0.3) * Math.PI * 2;
    const gap = Math.abs(Math.atan2(Math.sin(angle - DOCK_ANGLE), Math.cos(angle - DOCK_ANGLE)));
    if (gap < 0.4) continue;
    const radius = 11.4 + hash(attempt * 5.13) * 2.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = sampler(x, z);
    if (y > 0.85 || y < -0.3) continue;
    const size = 0.28 + hash(attempt * 7.9) * 0.4;
    spots.push({ x, y: y - size * 0.25, z, scale: [size * 1.2, size * 0.75, size], turn: hash(attempt * 3.3) * Math.PI });
  }
  return spots;
}

function flowerSpots(sampler: HeightSampler): Scatter[] {
  const spots: Scatter[] = [];
  const centers = [65, 11, 318, 264, 211, 160, 115].map((degrees) => (degrees * Math.PI) / 180);
  centers.forEach((angle, cluster) => {
    // Au bord du plateau, entre deux zones.
    let edge = 6;
    for (let r = 6; r < 12; r += 0.1) if (sampler(Math.cos(angle) * r, Math.sin(angle) * r) > 2.4) edge = r;
    const cx = Math.cos(angle) * (edge - 1.2);
    const cz = Math.sin(angle) * (edge - 1.2);
    for (let index = 0; index < 9; index++) {
      const key = cluster * 17.3 + index * 3.1;
      const a = hash(key) * Math.PI * 2;
      const r = Math.sqrt(hash(key + 1.7)) * 0.75;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const size = 0.05 + hash(key + 2.9) * 0.03;
      spots.push({
        x,
        y: sampler(x, z) + 0.07 + hash(key + 4.1) * 0.07,
        z,
        scale: [size, size * 0.8, size],
        turn: hash(key + 5.3) * Math.PI,
        color: FLOWER_COLORS[Math.floor(hash(key + 6.7) * FLOWER_COLORS.length) % FLOWER_COLORS.length],
      });
    }
  });
  return spots;
}

function Scattered({ spots, geometry, material, castShadow }: { spots: Scatter[]; geometry: BufferGeometry; material: MeshStandardMaterial; castShadow?: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    spots.forEach((spot, index) => {
      dummy.position.set(spot.x, spot.y, spot.z);
      dummy.rotation.set(0, spot.turn, 0);
      dummy.scale.set(...spot.scale);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      if (spot.color) target.setColorAt(index, spot.color);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [spots]);
  return <instancedMesh ref={mesh} args={[geometry, material, spots.length]} castShadow={castShadow} receiveShadow raycast={noRaycast} />;
}

/* ---------------------------------------------------------------- composant */

export function Grounds({ sampler, accents, islandAccent }: { sampler: HeightSampler; accents: Record<SkillZoneId, string>; islandAccent: string }) {
  const specs = useMemo(() => pathSpecs(accents, islandAccent), [accents, islandAccent]);
  const built = useMemo(() => buildGrounds(sampler, specs), [sampler, specs]);
  const rocks = useMemo(() => rockSpots(sampler), [sampler]);
  const flowers = useMemo(() => flowerSpots(sampler), [sampler]);
  const rock = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const flower = useMemo(() => new Merger().add(new IcosahedronGeometry(1, 0), '#ffffff', undefined, 0).build(), []);
  // Herbe tondue sur les allées : des clairières le long de l'allée du ponton et au milieu
  // de chaque allée de zone (les dalles et la place ont déjà les leurs).
  const clearings = useMemo(() => {
    const list: { x: number; z: number; radius: number }[] = [];
    for (const distance of [3.7, 5.5, 7.3, 9.0]) {
      list.push({ x: Math.cos(DOCK_ANGLE) * distance, z: Math.sin(DOCK_ANGLE) * distance, radius: 0.95 });
    }
    for (const spot of ZONE_SPOTS) {
      const angle = Math.atan2(spot.z, spot.x);
      const middle = (HUB.radius + Math.hypot(spot.x, spot.z) - spot.pad) / 2;
      list.push({ x: Math.cos(angle) * middle, z: Math.sin(angle) * middle, radius: 0.85 });
    }
    return list;
  }, []);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      built.flow.dispose();
      rock.dispose();
      flower.dispose();
    },
    [built, flower, rock],
  );

  return (
    <>
      {clearings.map((clearing) => (
        <ClearingAt key={`${clearing.x.toFixed(2)}:${clearing.z.toFixed(2)}`} x={clearing.x} z={clearing.z} radius={clearing.radius} />
      ))}
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={built.flow} material={flowMaterial} raycast={noRaycast} />
      <Scattered spots={rocks} geometry={rock} material={rockMaterial} castShadow />
      <Scattered spots={flowers} geometry={flower} material={paintMaterial} />
    </>
  );
}
