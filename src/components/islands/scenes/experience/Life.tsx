'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DoubleSide, Group } from 'three';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import type { IslandConfig } from '@/types';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import { Builder, flatMaterial, paintMaterial } from './build';
import { pointuGeometry } from './Harbor';
import { Merged } from './parts';

/**
 * Petite vie de l'île : des promeneurs en figurines (dandinement de jouet, pause au bout du
 * chemin, regard qui balaie le paysage) et un pointu qui tire des bords au large, sa voile
 * latine gonflée. Un appel de dessin par figurine.
 */

type XZ = readonly [number, number];

export interface Figure {
  shirt: string;
  pants: string;
  skin: string;
  hat?: 'straw' | 'cap' | 'beret';
  hatColor?: string;
  carry?: string;
}

function figureGeometry({ shirt, pants, skin, hat, hatColor = '#e9d9a6', carry }: Figure) {
  const b = new Builder();
  for (const x of [-0.085, 0.085]) {
    b.box([0.13, 0.6, 0.15], pants, [x, 0.3, 0]);
    b.box([0.14, 0.08, 0.22], '#3a2d24', [x, 0.04, 0.03]);
  }
  b.box([0.38, 0.5, 0.25], shirt, [0, 0.86, 0]);
  for (const x of [-0.245, 0.245]) b.box([0.1, 0.46, 0.12], shirt, [x, 0.85, carry ? 0.1 : 0], carry ? [-0.9, 0, 0] : [0, 0, 0]);
  b.sphere(0.145, skin, [0, 1.27, 0], 1, [9, 7]);
  if (hat === 'straw') {
    b.cylinder(0.27, 0.27, 0.03, 12, hatColor, [0, 1.36, 0]);
    b.cylinder(0.13, 0.15, 0.12, 10, hatColor, [0, 1.42, 0]);
    b.cylinder(0.152, 0.152, 0.035, 10, '#c8643b', [0, 1.38, 0]);
  } else if (hat === 'cap') {
    b.sphere(0.152, hatColor, [0, 1.32, 0], [1, 0.6, 1], [9, 6]);
    b.box([0.2, 0.025, 0.14], hatColor, [0, 1.32, 0.16]);
  } else if (hat === 'beret') {
    b.cylinder(0.16, 0.15, 0.06, 10, hatColor, [0, 1.39, -0.01]);
  }
  if (carry) {
    b.box([0.46, 0.22, 0.32], carry, [0, 0.98, 0.34]);
    b.box([0.47, 0.04, 0.33], '#f4f1ea', [0, 1.1, 0.34]);
  }
  return b.build();
}

/**
 * Promeneur : va et vient sur une ligne brisée (repère de l'île), marque une pause à
 * chaque bout. Démarche de jouet : il se dandine d'un pied sur l'autre en rebondissant.
 */
export function Walker({
  points,
  sampler,
  figure,
  speed = 0.55,
  pause = 3,
  phase = 0,
  y,
}: {
  points: XZ[];
  sampler: HeightSampler;
  figure: Figure;
  speed?: number;
  pause?: number;
  phase?: number;
  /** Hauteur fixe (quai) ; sinon le promeneur suit le relief. */
  y?: number;
}) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const geometry = useMemo(() => figureGeometry(figure), [figure]);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const route = useMemo(() => {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
    return { lengths, total: lengths.reduce((sum, length) => sum + length, 0) };
  }, [points]);

  useFrame((state) => {
    const target = group.current;
    const figureGroup = body.current;
    if (!target || !figureGroup) return;
    const t = state.clock.elapsedTime + phase;
    const travel = route.total / speed;
    const cycle = (travel + pause) * 2;
    const c = reducedMotion ? 0 : t % cycle;
    // Aller, pause, retour, pause.
    let s: number;
    let walking = true;
    let forward = true;
    if (c < travel) s = (c / travel) * route.total;
    else if (c < travel + pause) {
      s = route.total;
      walking = false;
    } else if (c < travel * 2 + pause) {
      s = route.total - ((c - travel - pause) / travel) * route.total;
      forward = false;
    } else {
      s = 0;
      walking = false;
      forward = false;
    }
    let segment = 0;
    let rest = s;
    while (segment < route.lengths.length - 1 && rest > route.lengths[segment]) {
      rest -= route.lengths[segment];
      segment += 1;
    }
    const [ax, az] = points[segment];
    const [bx, bz] = points[segment + 1];
    const k = route.lengths[segment] > 0 ? Math.min(1, rest / route.lengths[segment]) : 0;
    const x = ax + (bx - ax) * k;
    const z = az + (bz - az) * k;
    const ground = y ?? groundAt(sampler, x, z, 0.12) - 0.02;
    const dirX = (bx - ax) * (forward ? 1 : -1);
    const dirZ = (bz - az) * (forward ? 1 : -1);
    target.position.set(x, ground, z);
    const heading = Math.atan2(dirX, dirZ);
    if (walking) {
      const step = s * 6.2;
      target.rotation.y = heading;
      figureGroup.rotation.z = Math.sin(step) * 0.11;
      figureGroup.position.y = Math.abs(Math.cos(step)) * 0.06;
    } else {
      // À l'arrêt : il regarde autour de lui et respire.
      target.rotation.y = heading + Math.PI + Math.sin(t * 0.6) * 0.5;
      figureGroup.rotation.z = 0;
      figureGroup.position.y = Math.sin(t * 2.1) * 0.008;
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        <Merged geometry={geometry} material={paintMaterial()} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ voile latine */

function sailGeometry() {
  const tack = [1.55, 0.92, 0.07];
  const peak = [-1.3, 2.66, 0.07];
  const clew = [-1.12, 0.6, 0.07];
  // Creux de la voile : un sommet central poussé sous le vent.
  const belly = [(tack[0] + peak[0] + clew[0]) / 3, (tack[1] + peak[1] + clew[1]) / 3, 0.42];
  const positions = new Float32Array([...tack, ...peak, ...belly, ...peak, ...clew, ...belly, ...clew, ...tack, ...belly]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function rigGeometry() {
  const b = new Builder();
  b.rod([0.55, 0.1, 0], [0.62, 2.1, 0], 0.035, '#8a5d3b');
  b.rod([1.72, 0.9, 0.06], [-1.45, 2.78, 0.06], 0.03, '#7a5034');
  b.rod([-1.12, 0.6, 0.07], [-1.55, 0.72, 0], 0.012, '#d9cfb8', 3);
  return b.build();
}

const SAILING = { hull: '#f2c14e', band: '#2f6fc0', inner: '#f4f1ea' };

/** Pointu sous voile, qui tourne lentement au large du Bec de l'Aigle. */
export function SailingPointu({ island, center, radius = 3.8, speed = 0.09 }: { island: IslandConfig; center: XZ; radius?: number; speed?: number }) {
  const group = useRef<Group>(null);
  const hull = useRef<Group>(null);
  const boat = useMemo(() => pointuGeometry(SAILING), []);
  const rig = useMemo(() => rigGeometry(), []);
  const sail = useMemo(() => sailGeometry(), []);
  useEffect(() => () => sail.dispose(), [sail]);
  useFrame((state) => {
    const target = group.current;
    const body = hull.current;
    if (!target || !body) return;
    const t = state.clock.elapsedTime;
    const angle = t * speed + 1.2;
    const x = center[0] + Math.cos(angle) * radius;
    const z = center[1] + Math.sin(angle) * radius;
    target.position.set(x, waveHeight(island.position[0] + x, island.position[1] + z, t) * 0.85 - 0.02, z);
    // L'étrave suit la tangente du cercle ; le bateau gîte un peu et tangue sur la houle.
    target.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    body.rotation.x = -0.12 + Math.sin(t * 1.3) * 0.03;
    body.rotation.z = Math.sin(t * 0.9 + 0.6) * 0.035;
  });
  return (
    <group ref={group}>
      <group ref={hull}>
        <Merged geometry={boat} material={flatMaterial()} />
        <Merged geometry={rig} material={paintMaterial()} />
        <mesh geometry={sail} castShadow raycast={() => null}>
          <meshStandardMaterial color="#f6ead0" roughness={0.85} side={DoubleSide} flatShading />
        </mesh>
      </group>
    </group>
  );
}
