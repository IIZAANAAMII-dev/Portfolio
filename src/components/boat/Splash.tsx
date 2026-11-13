'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { hash } from '@/lib/utils/math';

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
      size: 0.12 + hash(i * 9.13) * 0.22,
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
        dummy.scale.setScalar(seed.size * (0.6 + fade * 0.8));
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
        <meshStandardMaterial color="#e9f7f4" roughness={0.3} />
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
