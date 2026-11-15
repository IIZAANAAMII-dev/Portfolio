'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { hash } from '@/lib/utils/math';
import { BOAT_FRAME } from './BoatModel';

/**
 * Éclaboussure : déclenchée par `triggerSplash`, elle dessine deux anneaux d'écume qui
 * s'élargissent et une gerbe de gouttelettes balistiques (une seule InstancedMesh).
 */
export const splashState = { time: -1, x: 0, z: 0, strength: 1 };

export function triggerSplash(time: number, x: number, z: number, strength = 1) {
  splashState.time = time;
  splashState.x = x;
  splashState.z = z;
  splashState.strength = strength;
}

const DROPS = 46;
const DURATION = 1.6;
const GRAVITY = 16;
const UP = new Vector3(0, 1, 0);
const heading = new Vector3();

export function Splash() {
  const drops = useRef<InstancedMesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const seeds = useMemo(
    () => Array.from({ length: DROPS }, (_, i) => ({
      angle: hash(i * 3.17) * Math.PI * 2,
      speed: 3.5 + hash(i * 5.31) * 6,
      lift: 6 + hash(i * 7.77) * 9,
      size: 0.08 + hash(i * 9.13) * 0.15,
    })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime - splashState.time;
    const active = splashState.time >= 0 && t >= 0 && t < DURATION;
    if (drops.current) drops.current.visible = active;
    if (ringA.current) ringA.current.visible = active;
    if (ringB.current) ringB.current.visible = active;
    if (!active) return;
    const k = splashState.strength;

    if (drops.current) {
      seeds.forEach((seed, i) => {
        const height = seed.lift * k * t - 0.5 * GRAVITY * t * t;
        const reach = seed.speed * k * t;
        dummy.position.set(
          splashState.x + Math.cos(seed.angle) * (1.4 + reach),
          Math.max(height, -1),
          splashState.z + Math.sin(seed.angle) * (1.4 + reach),
        );
        const fade = height < 0 ? 0 : 1 - t / DURATION;
        // Gouttes étirées dans le sens de leur vol : on lit de l'eau projetée, pas des cailloux.
        const rise = seed.lift * k - GRAVITY * t;
        const along = seed.speed * k;
        heading.set(Math.cos(seed.angle) * along, rise, Math.sin(seed.angle) * along).normalize();
        dummy.quaternion.setFromUnitVectors(UP, heading);
        const size = seed.size * (0.6 + fade * 0.8);
        const stretch = 1 + Math.min(Math.hypot(along, rise) * 0.09, 1.4);
        dummy.scale.set(size, size * stretch, size);
        dummy.updateMatrix();
        drops.current!.setMatrixAt(i, dummy.matrix);
      });
      drops.current.instanceMatrix.needsUpdate = true;
    }
    const rings: [Mesh | null, number][] = [[ringA.current, 0], [ringB.current, 0.22]];
    rings.forEach(([ring, delay]) => {
      if (!ring) return;
      const local = Math.max(0, t - delay);
      const grow = 1 - Math.exp(-local * 2.4);
      ring.position.set(splashState.x, 0.12, splashState.z);
      ring.scale.setScalar(1.5 + grow * 9 * k);
      (ring.material as MeshBasicMaterial).opacity = Math.max(0, 0.75 * (1 - local / (DURATION - delay)));
    });
  });

  return (
    <>
      <instancedMesh ref={drops} args={[undefined, undefined, DROPS]} frustumCulled={false} visible={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#eefbf8" emissive="#a9e3dc" emissiveIntensity={0.45} roughness={0.3} />
      </instancedMesh>
      <mesh ref={ringA} rotation-x={-Math.PI / 2} renderOrder={7} visible={false}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial color="#f4fbf8" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation-x={-Math.PI / 2} renderOrder={7} visible={false}>
        <ringGeometry args={[0.86, 1, 48]} />
        <meshBasicMaterial color="#f4fbf8" transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

/**
 * Embruns d'étrave : en route, l'étrave fend la houle et jette des gouttes de chaque bord
 * (« moustaches ») ; un choc en projette une gerbe (`sprayState.burst`). Gouttes balistiques
 * en coordonnées monde, une seule InstancedMesh.
 */
export const sprayState = { burst: 0 };

const SPRAY = 44;
const sprayDummy = new Object3D();
type Drop = { born: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number };

export function BowSpray() {
  const mesh = useRef<InstancedMesh>(null);
  const drops = useRef<Drop[] | null>(null);
  const cursor = useRef(0);
  const budget = useRef(0);

  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    // Débit sur le temps réel (borné) : la durée de vie des gouttes suit aussi l'horloge.
    const dt = Math.min(delta, 0.25);
    const time = state.clock.elapsedTime;
    const { phase, quality } = useWorld.getState();
    target.visible = (phase === 'playing' || phase === 'docked') && quality !== 'low';
    if (!target.visible) return;
    drops.current ??= Array.from({ length: SPRAY }, () => ({ born: -99, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, size: 0 }));
    const list = drops.current;
    const speed = boatState.speed;
    const rate = Math.min(Math.max((speed - 4.5) / 9, 0), 1);
    budget.current = Math.min(budget.current + dt * rate * 38 + sprayState.burst * 14, SPRAY / 2);
    const burst = sprayState.burst;
    sprayState.burst = 0;
    const forwardX = Math.cos(boatState.heading);
    const forwardZ = Math.sin(boatState.heading);
    while (budget.current >= 1) {
      budget.current -= 1;
      const drop = list[cursor.current];
      cursor.current = (cursor.current + 1) % SPRAY;
      const side = Math.random() < 0.5 ? -1 : 1;
      const strength = Math.max(rate, burst * 0.8);
      const bowX = boatState.position.x + forwardX * BOAT_FRAME.bow * 0.66 - forwardZ * side * 0.42;
      const bowZ = boatState.position.z + forwardZ * BOAT_FRAME.bow * 0.66 + forwardX * side * 0.42;
      const out = (1.2 + Math.random() * 1.8) * (0.6 + strength);
      drop.born = time;
      drop.x = bowX;
      drop.y = waveHeight(bowX, bowZ, time) + 0.12;
      drop.z = bowZ;
      drop.vx = -forwardZ * side * out + forwardX * speed * 0.55;
      drop.vy = (1.5 + Math.random() * 1.9) * (0.6 + strength * 0.7);
      drop.vz = forwardX * side * out + forwardZ * speed * 0.55;
      drop.size = 0.045 + Math.random() * 0.06;
    }
    for (let index = 0; index < SPRAY; index++) {
      const drop = list[index];
      const age = time - drop.born;
      const y = drop.y + drop.vy * age - 5.5 * age * age;
      if (age < 0 || age > 1.2 || y < drop.y - 0.25) {
        sprayDummy.position.set(0, -50, 0);
        sprayDummy.scale.setScalar(0);
      } else {
        sprayDummy.position.set(drop.x + drop.vx * age, y, drop.z + drop.vz * age);
        sprayDummy.scale.setScalar(drop.size * (1 - age * 0.55));
      }
      sprayDummy.updateMatrix();
      target.setMatrixAt(index, sprayDummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPRAY]} frustumCulled={false} raycast={() => null} visible={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#eefbf8" emissive="#a9e3dc" emissiveIntensity={0.4} roughness={0.35} />
    </instancedMesh>
  );
}
