'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Box3,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import { Prop } from '@/components/islands/decor';
import { WRECK_SITES } from '@/data/biomes';
import { boatState } from '@/lib/boat-state';
import { MODEL } from '@/lib/models';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

const WRECK_URL = '/models/living-ocean/ship-wreck.glb';

function nearBoat(center: readonly [number, number], distance: number) {
  return Math.hypot(boatState.position.x - center[0], boatState.position.z - center[1]) < distance;
}

function WreckSite({ index }: { index: number }) {
  const site = WRECK_SITES[index];
  const group = useRef<Group>(null);
  const gltf = useGLTF(WRECK_URL);
  const wreck = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    const scalar = 9 / Math.max(size.x, size.y, size.z, 0.001);
    clone.scale.setScalar(scalar * site.scale);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return clone;
  }, [gltf, site.scale]);
  useFrame(() => {
    if (!group.current) return;
    const quality = useWorld.getState().quality;
    group.current.visible = quality !== 'low' && nearBoat(site.center, quality === 'high' ? 78 : 58);
  });
  return (
    <group ref={group} position={[site.center[0], -2.05, site.center[1]]} rotation={[0.08, site.rotation, -0.13]}>
      {site.kind === 'ship' ? <primitive object={wreck} /> : <group scale={1.35}><Prop name={MODEL.rowBoat} /></group>}
      <WreckDetails seed={site.seed} />
    </group>
  );
}

function WreckDetails({ seed }: { seed: number }) {
  const crates = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!crates.current) return;
    for (let index = 0; index < 7; index++) {
      const angle = hash(seed + index * 3.7) * Math.PI * 2;
      const radius = 3 + hash(seed + index * 6.1) * 5;
      dummy.position.set(Math.cos(angle) * radius, -0.08, Math.sin(angle) * radius);
      dummy.rotation.set(hash(seed + index), angle, hash(seed + index * 2.2));
      const scalar = 0.3 + hash(seed + index * 9.1) * 0.45;
      dummy.scale.setScalar(scalar);
      dummy.updateMatrix();
      crates.current.setMatrixAt(index, dummy.matrix);
    }
    crates.current.instanceMatrix.needsUpdate = true;
  }, [dummy, seed]);
  return (
    <instancedMesh ref={crates} args={[undefined, undefined, 7]}>
      <boxGeometry args={[1, 0.7, 1]} />
      <meshStandardMaterial color="#70513a" roughness={1} flatShading />
    </instancedMesh>
  );
}

export function UnderwaterWorld({ mobile }: { mobile: boolean }) {
  return (
    <group>
      {!mobile && WRECK_SITES.map((_, index) => <WreckSite key={index} index={index} />)}
    </group>
  );
}
