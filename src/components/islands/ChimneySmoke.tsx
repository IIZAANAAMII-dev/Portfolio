'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Fumée de cheminée : quelques bouffées qui montent, grossissent, dérivent avec le vent
 * et s'effacent. Une InstancedMesh par cheminée, sept instances.
 */
const PUFFS = 7;

export function ChimneySmoke({ position }: { position: [number, number, number] }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const seed = useMemo(() => hash(position[0] * 3.1 + position[2] * 7.7) * 10, [position]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    for (let index = 0; index < PUFFS; index++) {
      const life = (time * 0.2 + index / PUFFS + seed) % 1;
      const wobble = Math.sin(time * 1.3 + index * 2.1) * 0.12 * life;
      dummy.position.set(
        position[0] + life * life * 1.6 + wobble,
        position[1] + 0.1 + life * 3.2,
        position[2] + life * life * 1.0 - wobble,
      );
      // Naît petite, gonfle, puis se dissout en rapetissant sur la fin.
      const grow = 0.18 + life * 0.62;
      const fade = life > 0.72 ? 1 - (life - 0.72) / 0.28 : 1;
      dummy.scale.setScalar(grow * fade);
      dummy.rotation.set(index, time * 0.3 + index, 0);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS]} frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#f3f0ea" roughness={1} flatShading transparent opacity={0.72} depthWrite={false} />
    </instancedMesh>
  );
}
