'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

const COUNT = 9;

/**
 * Quelques oiseaux au loin. Aucun rôle fonctionnel : ils existent uniquement pour que
 * le ciel ne soit jamais complètement immobile. Un seul draw call.
 */
export function Birds() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const flock = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        radius: 55 + hash(i * 1.7) * 60,
        height: 34 + hash(i * 3.3) * 26,
        speed: 0.05 + hash(i * 5.9) * 0.05,
        offset: hash(i * 7.1) * Math.PI * 2,
      })),
    [],
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const reveal = useWorld.getState().reveal;
    mesh.current.visible = reveal > 0.75;
    if (!mesh.current.visible) return;

    const t = state.clock.elapsedTime;
    flock.forEach((bird, i) => {
      const angle = bird.offset + t * bird.speed;
      dummy.position.set(
        Math.cos(angle) * bird.radius,
        bird.height + Math.sin(t * 0.4 + bird.offset) * 3,
        Math.sin(angle) * bird.radius,
      );
      dummy.rotation.set(Math.sin(t * 6 + bird.offset) * 0.5, -angle, 0);
      dummy.scale.setScalar(1.6);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.35, 1.6, 3]} />
      <meshBasicMaterial color="#2c3440" transparent opacity={0.5} />
    </instancedMesh>
  );
}
