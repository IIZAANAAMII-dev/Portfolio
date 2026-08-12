'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { hash } from '@/lib/utils/math';

interface ScatterProps {
  count: number;
  radius: number;
  /** Rayon minimum : laisse le sommet de l'île dégagé. */
  innerRadius?: number;
  seed: number;
  y?: number;
  /** Amplitude du balancement (végétation). 0 = statique. */
  sway?: number;
  children: React.ReactNode;
}

/**
 * Disperse un même objet sur une île via un InstancedMesh : arbres, buissons, rochers.
 * Une centaine d'objets pour un seul draw call.
 */
export function Scatter({
  count,
  radius,
  innerRadius = 0,
  seed,
  y = 0,
  sway = 0,
  children,
}: ScatterProps) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const placements = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = hash(seed + i * 1.37) * Math.PI * 2;
        const spread = innerRadius + hash(seed + i * 3.71) * (radius - innerRadius);
        return {
          x: Math.cos(angle) * spread,
          z: Math.sin(angle) * spread,
          // Le relief est en plateaux : plus on est au centre, plus on est haut.
          lift: (1 - spread / radius) * 0.75,
          scale: 0.7 + hash(seed + i * 5.11) * 0.6,
          spin: hash(seed + i * 9.23) * Math.PI * 2,
          phase: hash(seed + i * 2.53) * Math.PI * 2,
        };
      }),
    [count, radius, innerRadius, seed],
  );

  // Sans balancement, la disposition est figée : on n'écrit les matrices qu'une fois.
  const settled = useRef(false);

  useFrame((state) => {
    if (!mesh.current || (!sway && settled.current)) return;
    settled.current = true;
    const t = state.clock.elapsedTime;
    placements.forEach((p, i) => {
      dummy.position.set(p.x, y + p.lift, p.z);
      dummy.rotation.set(
        sway ? Math.sin(t * 0.9 + p.phase) * sway : 0,
        p.spin,
        sway ? Math.cos(t * 0.7 + p.phase) * sway : 0,
      );
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      {children}
    </instancedMesh>
  );
}
