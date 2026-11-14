'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MeshStandardMaterial } from 'three';
import { useWorld } from '@/lib/store';
import type { HeightSampler } from '../../terrain-shape';
import { BOX, Kit, SPHERE } from './geometry';
import { flatPaint } from './materials';
import { buildRoute, routeAt, routeDistanceNear, type RoutePoint } from './route';
import { fromFrame, smooth, STEP_SPOTS, toFrame } from './terrain';

/**
 * Le petit voyageur : il part du canot, s'arrête devant chaque étape, traverse le pont
 * (son ciré jaune de Breton devient un t-shirt d'été en arrivant à Marseille), puis
 * salue depuis la dernière lanterne, disparaît… et recommence.
 */

/** Position du voyageur, lue par les lanternes (elles brillent à son passage). */
export const walkerState = { x: 0, z: 0, presence: 0 };

const SPEED = 0.85;

interface Phase {
  kind: 'walk' | 'pause' | 'wave' | 'vanish' | 'hidden' | 'appear';
  start: number;
  duration: number;
  from: number;
  to: number;
  /** Cap pendant une pause (vers la lanterne). */
  yaw: number;
}

function planWalk(route: RoutePoint[]) {
  const total = route[route.length - 1].distance;
  const stops = Object.entries(STEP_SPOTS).map(([id, [u, v]]) => {
    const distance = routeDistanceNear(route, u, v);
    const at = routeAt(route, distance, { x: 0, y: 0, z: 0, heading: 0 });
    const [x, z] = fromFrame(u, v);
    return { id, distance: Math.min(distance, total), yaw: Math.atan2(x - at.x, z - at.z) };
  }).sort((a, b) => a.distance - b.distance);
  const phases: Phase[] = [];
  let clock = 0;
  let at = 0;
  const push = (kind: Phase['kind'], duration: number, to = at, yaw = 0) => {
    phases.push({ kind, start: clock, duration, from: at, to, yaw });
    clock += duration;
    at = to;
  };
  push('appear', 0.7, 0, stops[0]?.yaw ?? 0);
  stops.forEach((stop, index) => {
    if (stop.distance > at + 0.05) push('walk', (stop.distance - at) / SPEED, stop.distance);
    const last = index === stops.length - 1;
    push(last ? 'wave' : 'pause', last ? 3.6 : stop.id === 'marseille' ? 2.6 : 1.9, at, stop.yaw);
  });
  if (total > at + 0.05) push('walk', (total - at) / SPEED, total);
  push('vanish', 0.7, at, phases[phases.length - 1].yaw);
  push('hidden', 1.6, 0);
  return { phases, duration: clock };
}

function headGeometry() {
  const kit = new Kit();
  kit.add(SPHERE, '#f0c6a2', { position: [0, 0, 0], scale: [0.15, 0.155, 0.145] });
  // Cheveux bruns (calotte et mèche), nez, yeux.
  kit.add(SPHERE, '#4a3226', { position: [0, 0.05, -0.02], scale: [0.158, 0.13, 0.15] });
  kit.add(BOX, '#4a3226', { position: [0.03, 0.1, 0.11], rotation: [0.3, 0, -0.3], scale: [0.14, 0.04, 0.06] });
  kit.add(SPHERE, '#e9b08d', { position: [0, -0.01, 0.145], scale: 0.025 });
  for (const side of [-1, 1]) kit.add(SPHERE, '#2a2a30', { position: [side * 0.05, 0.02, 0.135], scale: 0.016 });
  // Sac à dos.
  kit.add(BOX, '#8a5a3c', { position: [0, -0.38, -0.17], scale: [0.24, 0.27, 0.1] });
  kit.add(BOX, '#6f4630', { position: [0, -0.28, -0.22], scale: [0.2, 0.06, 0.04] });
  return kit.build();
}

const JACKET = new MeshStandardMaterial({ color: '#f2c230', roughness: 0.6, flatShading: true });
const JEANS = new MeshStandardMaterial({ color: '#3e5a86', roughness: 0.85, flatShading: true });
const CIRE = new Color('#f2c230');
const TSHIRT = new Color('#ee7d5a');

export function Walker({ sampler }: { sampler: HeightSampler }) {
  const route = useMemo(() => buildRoute(sampler), [sampler]);
  const plan = useMemo(() => planWalk(route), [route]);
  const head = useMemo(() => headGeometry(), []);
  const root = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const body = useRef<Group>(null);
  const point = useRef({ x: 0, y: 0, z: 0, heading: 0 });
  const heading = useRef(0);

  useFrame((frame, delta) => {
    const group = root.current;
    if (!group) return;
    const reduced = useWorld.getState().reducedMotion;
    const dt = Math.min(delta, 1 / 30);
    const time = reduced ? plan.phases[1]?.start ?? 0 : frame.clock.elapsedTime % plan.duration;
    let phase = plan.phases[plan.phases.length - 1];
    for (const candidate of plan.phases) {
      if (time < candidate.start + candidate.duration) {
        phase = candidate;
        break;
      }
    }
    const k = Math.min(1, Math.max(0, (time - phase.start) / phase.duration));
    const distance = phase.from + (phase.to - phase.from) * k;
    const at = routeAt(route, distance, point.current);
    const walking = phase.kind === 'walk';
    const presence = phase.kind === 'hidden' ? 0 : phase.kind === 'appear' ? smooth(0, 1, k) : phase.kind === 'vanish' ? 1 - smooth(0, 1, k) : 1;
    const stride = walking ? (time - phase.start) * SPEED * 5.2 : 0;
    const bob = walking ? Math.abs(Math.sin(stride)) * 0.05 : 0;
    group.position.set(at.x, at.y + bob - 0.02, at.z);
    // Le cap se tourne en douceur vers la marche, ou vers la lanterne pendant les pauses.
    const goal = walking ? at.heading : phase.yaw;
    let diff = goal - heading.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    heading.current += diff * (1 - Math.exp(-8 * dt));
    group.rotation.y = heading.current;
    group.scale.setScalar(Math.max(presence, 0.001));
    group.visible = presence > 0.01;
    const swing = walking ? Math.sin(stride) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) {
      const wave = phase.kind === 'wave' ? smooth(0, 0.15, k) * (1 - smooth(0.85, 1, k)) : 0;
      armR.current.rotation.x = swing * 0.8 * (1 - wave) - wave * 2.6;
      armR.current.rotation.z = wave * (0.35 + Math.sin(frame.clock.elapsedTime * 9) * 0.3);
    }
    if (body.current) body.current.rotation.z = walking ? Math.sin(stride) * 0.04 : 0;
    // Ciré jaune côté Bretagne, t-shirt d'été côté Marseille.
    const [, v] = toFrame(at.x, at.z);
    JACKET.color.copy(CIRE).lerp(TSHIRT, smooth(-0.5, 2.5, v));
    walkerState.x = at.x;
    walkerState.z = at.z;
    walkerState.presence = presence;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Jambes et bras : pivots à la hanche et à l'épaule. */}
        <group ref={legL} position={[-0.07, 0.4, 0]}>
          <mesh position-y={-0.19} material={JEANS} castShadow>
            <boxGeometry args={[0.12, 0.38, 0.13]} />
          </mesh>
        </group>
        <group ref={legR} position={[0.07, 0.4, 0]}>
          <mesh position-y={-0.19} material={JEANS} castShadow>
            <boxGeometry args={[0.12, 0.38, 0.13]} />
          </mesh>
        </group>
        <mesh position-y={0.59} material={JACKET} castShadow>
          <boxGeometry args={[0.32, 0.38, 0.21]} />
        </mesh>
        <group ref={armL} position={[-0.21, 0.74, 0]}>
          <mesh position-y={-0.15} material={JACKET} castShadow>
            <boxGeometry args={[0.085, 0.32, 0.095]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.21, 0.74, 0]}>
          <mesh position-y={-0.15} material={JACKET} castShadow>
            <boxGeometry args={[0.085, 0.32, 0.095]} />
          </mesh>
        </group>
        <mesh geometry={head} material={flatPaint} position-y={0.93} castShadow />
      </group>
    </group>
  );
}
