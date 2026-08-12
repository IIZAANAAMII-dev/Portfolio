'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

const COUNT = 48;

type Bird = {
  radius: number;
  height: number;
  speed: number;
  offset: number;
  wingSpeed: number;
  wander: number;
};

/**
 * Nuée de mouettes en vol. Elles se baladent en essaim autour de l'archipel
 * avec des trajectoires ondulantes et un battement d'ailes rapide.
 */
export function Birds() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const flock = useMemo<Bird[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        radius: 50 + hash(i * 1.7) * 95,
        height: 32 + hash(i * 3.3) * 50,
        speed: 0.05 + hash(i * 5.9) * 0.08,
        offset: hash(i * 7.1) * Math.PI * 2,
        wingSpeed: 7 + hash(i * 2.3) * 6,
        wander: hash(i * 4.4) * Math.PI * 2,
      })),
    [],
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const reveal = useWorld.getState().reveal;
    mesh.current.visible = reveal > 0.35;
    if (!mesh.current.visible) return;

    const t = state.clock.elapsedTime;
    flock.forEach((bird, i) => {
      const drift = Math.sin(t * 0.18 + bird.wander) * 0.4;
      const angle = bird.offset + t * bird.speed + drift;
      const flap = Math.sin(t * bird.wingSpeed + bird.offset) * 0.45;
      const r = bird.radius + Math.sin(t * 0.22 + bird.wander) * 12;

      dummy.position.set(
        Math.cos(angle) * r,
        bird.height + Math.sin(t * 0.45 + bird.offset) * 6 + Math.sin(t * 0.17 + bird.wander) * 4,
        Math.sin(angle) * r,
      );

      dummy.rotation.set(Math.PI / 2 + flap, -angle, 0);
      dummy.scale.set(2.6, 0.3, 0.55);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} renderOrder={10}>
      <coneGeometry args={[0.35, 0.35, 3]} />
      <meshBasicMaterial color="#e8f4ff" transparent opacity={0.92} depthWrite={false} />
    </instancedMesh>
  );
}
