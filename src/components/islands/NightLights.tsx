'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import type { IslandConfig } from '@/types';

const LIGHT_LAYOUTS: Record<IslandConfig['id'], [number, number, number][]> = {
  about: [[-3.2, 0.5, 2.5], [2.8, 0.55, 2.2], [0.4, 0.48, -3.3], [4.4, 0.42, -1.1]],
  skills: [[-4, 0.6, -2], [-1.4, 0.75, 3.4], [2.2, 0.7, 2.8], [4.3, 0.58, -1.8]],
  projects: [[-6, 0.8, -2.2], [-2.2, 0.75, 4.8], [3.1, 0.8, 3.7], [6.3, 0.72, -1.2], [0, 0.82, -5.2]],
  experience: [[-4.5, 0.62, -2], [-1.5, 0.7, 2.8], [2.1, 0.74, 3.2], [4.8, 0.66, -1.5]],
  journey: [[-7, 0.44, -1], [-4.2, 0.52, 1.5], [-1.4, 0.6, 2.4], [1.5, 0.68, 2.2], [4.3, 0.76, 0.8], [7, 0.82, -1.4]],
  contact: [[-2.3, 0.38, 1.8], [2.5, 0.38, 1.4]],
};

const COLORS: Record<IslandConfig['id'], string> = {
  about: '#ffb36b',
  skills: '#ff9c5e',
  projects: '#86dcd7',
  experience: '#cfb2ff',
  journey: '#ffc174',
  contact: '#ffe4ad',
};

/** Lanternes groupées : emissif lointain, puis une seule vraie light sur les îles proches. */
export function NightLights({ island }: { island: IslandConfig }) {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const importantLight = useRef<PointLight>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const layout = LIGHT_LAYOUTS[island.id];
  const glow = useMemo(() => new Color(COLORS[island.id]), [island.id]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    layout.forEach(([x, y, z], index) => {
      dummy.position.set(x, island.elevation * y + 0.38, z);
      const scalar = index % 3 === 0 ? 0.34 : 0.25;
      dummy.scale.setScalar(scalar);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, island.elevation, layout]);

  useFrame((_, delta) => {
    if (!group.current || !material.current) return;
    const night = skyState.dayNight;
    group.current.visible = night > 0.025;
    material.current.opacity = night * 0.98;
    material.current.emissiveIntensity = night * (island.id === 'projects' ? 2.65 : 3.25);
    material.current.color.copy(glow).multiplyScalar(0.25 + night * 0.75);
    if (importantLight.current) {
      const worldX = island.position[0];
      const worldZ = island.position[1];
      const distance = Math.hypot(boatState.position.x - worldX, boatState.position.z - worldZ);
      const quality = useWorld.getState().quality;
      const lightRange = quality === 'high' ? 56 : quality === 'medium' ? 42 : 0;
      const nearby = distance < lightRange;
      const target = nearby ? night * (island.id === 'projects' ? 34 : 42) : 0;
      importantLight.current.intensity = damp(importantLight.current.intensity, target, 2.2, Math.min(delta, 1 / 30));
      importantLight.current.visible = importantLight.current.intensity > 0.025;
    }
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, layout.length]} renderOrder={8}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          ref={material}
          color={COLORS[island.id]}
          emissive={COLORS[island.id]}
          emissiveIntensity={0}
          roughness={0.45}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </instancedMesh>
      <pointLight
        ref={importantLight}
        position={[0, island.elevation * 0.48 + 1.2, 0]}
        color={COLORS[island.id]}
        intensity={0}
        distance={30}
        decay={2}
        visible={false}
      />
    </group>
  );
}
