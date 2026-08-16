'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Box3,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import { GULL_ROOSTS } from '@/data/biomes';
import { animalRevealScale } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

const URL = '/models/living-ocean/seagull.glb';

function useGullGeometry() {
  const gltf = useGLTF(URL);
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    let found: Mesh | undefined;
    gltf.scene.traverse((child) => {
      if (!found && child instanceof Mesh) found = child;
    });
    if (!found) throw new Error('Seagull GLB contains no mesh');

    const source = found as Mesh;
    const geometry = source.geometry.clone() as BufferGeometry;
    geometry.applyMatrix4(source.matrixWorld);
    // Le GLB Google est Z-up : on le redresse pour qu'il soit pose.
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateZ(-Math.PI / 2);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    geometry.translate(-center.x, -box.min.y, -center.z);
    const scalar = 1.0 / Math.max(size.x, size.y, size.z, 0.001);
    geometry.applyMatrix4(new Matrix4().makeScale(scalar, scalar, scalar));
    geometry.computeVertexNormals();
    const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
    const material = sourceMaterial.clone();
    if ('roughness' in material) (material as { roughness: number }).roughness = 0.82;
    return { geometry, material };
  }, [gltf]);
}

/**
 * Mouettes statiques posees sur les rochers/iles.
 * Le modele actuel est un oiseau en vol ; on le laisse fige,
 * l'animation vol sera reservee a un futur modele dedie (Sketchfab rigged).
 */
export function Birds() {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const { geometry, material } = useGullGeometry();
  const count = GULL_ROOSTS.length;

  useLayoutEffect(() => {
    if (!mesh.current) return;
    for (let index = 0; index < count; index++) {
      const [x, y, z] = GULL_ROOSTS[index];
      const angle = hash(index * 9.7) * Math.PI * 2;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, angle, 0);
      const scale = 0.85 + hash(index * 3.4) * 0.3;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

  useFrame(() => {
    if (!group.current || !mesh.current) return;
    const world = useWorld.getState();
    const quality = world.quality;
    const visibleCount = quality === 'high' ? count : quality === 'medium' ? 8 : 4;
    mesh.current.count = Math.min(visibleCount, count);
    let anyVisible = false;
    for (let index = 0; index < mesh.current.count; index++) {
      const [x, y, z] = GULL_ROOSTS[index];
      const distance = Math.hypot(x - world.introCenter[0], z - world.introCenter[1]);
      const revealScale = world.reducedMotion
        ? (world.reveal > 0.01 ? 1 : 0)
        : animalRevealScale(distance, world.introRadius, hash(index * 5.21) * 2.2);
      anyVisible ||= revealScale > 0.006;
      dummy.position.set(x, y - (1 - revealScale) * 0.28, z);
      dummy.rotation.set(0, hash(index * 9.7) * Math.PI * 2, 0);
      dummy.scale.setScalar((0.85 + hash(index * 3.4) * 0.3) * revealScale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    group.current.visible = anyVisible;
  });

  return (
    <group ref={group} renderOrder={10}>
      <instancedMesh
        ref={mesh}
        args={[geometry, material, count]}
        frustumCulled={false}
        castShadow={false}
      />
    </group>
  );
}
