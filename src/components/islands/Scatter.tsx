'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

interface ScatterProps {
  count: number;
  radius: number;
  innerRadius?: number;
  seed: number;
  y?: number;
  sway?: number;
  castShadow?: boolean;
  children: React.ReactNode;
}

/** Un draw call par espèce pour les arbres, buissons et rochers répétés. */
export function Scatter({
  count,
  radius,
  innerRadius = 0,
  seed,
  y = 0,
  sway = 0,
  castShadow = false,
  children,
}: ScatterProps) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const elapsed = useRef(0);
  const placements = useMemo(
    () => Array.from({ length: count }, (_, index) => {
      const angle = hash(seed + index * 1.37) * Math.PI * 2;
      const spread = innerRadius + hash(seed + index * 3.71) * (radius - innerRadius);
      return {
        x: Math.cos(angle) * spread,
        z: Math.sin(angle) * spread,
        lift: (1 - spread / radius) * 0.75,
        scale: 0.7 + hash(seed + index * 5.11) * 0.6,
        spin: hash(seed + index * 9.23) * Math.PI * 2,
        phase: hash(seed + index * 2.53) * Math.PI * 2,
      };
    }),
    [count, innerRadius, radius, seed],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, y + placement.lift, placement.z);
      dummy.rotation.set(0, placement.spin, 0);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    if (mesh.current.boundingSphere) mesh.current.boundingSphere.radius += Math.max(1, sway * 3);
  }, [dummy, placements, sway, y]);

  useFrame((state, delta) => {
    if (!mesh.current || !sway) return;
    elapsed.current += delta;
    const quality = useWorld.getState().quality;
    const interval = quality === 'high' ? 1 / 20 : quality === 'medium' ? 1 / 12 : 1 / 8;
    if (elapsed.current < interval) return;
    elapsed.current = 0;

    const time = state.clock.elapsedTime;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, y + placement.lift, placement.z);
      dummy.rotation.set(
        Math.sin(time * 0.9 + placement.phase) * sway,
        placement.spin,
        Math.cos(time * 0.7 + placement.phase) * sway,
      );
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow={castShadow} receiveShadow>
      {children}
    </instancedMesh>
  );
}
