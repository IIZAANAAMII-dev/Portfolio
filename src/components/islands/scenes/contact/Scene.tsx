'use client';

import { useCallback, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Vector3 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { skyState } from '@/lib/sky';
import { SubstanceProp } from '../../bell-island';
import { facingDock, on, type SceneProps } from '../../kit';

/**
 * ÎLE CONTACT — racine du décor.
 */
/* ------------------------------------------------------------------------------------ */
/* CONTACT — le clocher : « sonnez, je réponds ». Un phare tourne à son sommet.          */
/* ------------------------------------------------------------------------------------ */
export default function ContactScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const light = useRef<Group>(null);
  const point = useRef<PointLight>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const quality = useWorld((state) => state.quality);
  const base = on(sampler, hillX, hillZ, 1.6, 0.15);
  const rotation = facingDock(island, hillX, hillZ);
  const dockX = Math.cos(island.dockAngle) * island.radius * 0.62;
  const dockZ = Math.sin(island.dockAngle) * island.radius * 0.62;

  const bell = useRef<Object3D | null>(null);
  const struck = useRef(-100);
  const chimes = useRef(0);
  const clock = useThree((state) => state.clock);

  // La grosse cloche pend à son joug : on l'accroche à un pivot placé en haut de la cloche.
  const onModel = useCallback((model: Object3D) => {
    if (bell.current) return;
    let found: Mesh | null = null;
    model.traverse((child) => {
      if (!found && (child as Mesh).isMesh && child.name.startsWith('main_bell')) found = child as Mesh;
    });
    const mesh = found as Mesh | null;
    if (!mesh || !mesh.parent) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const pivotAt = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    mesh.updateMatrix();
    pivotAt.applyMatrix4(mesh.matrix);
    const pivot = new Object3D();
    pivot.position.copy(pivotAt);
    mesh.parent.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(mesh);
    bell.current = pivot;
  }, []);

  const ring = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    struck.current = clock.elapsedTime;
    chimes.current = 1;
    ambience.bell();
    logbook.stamp('bell');
  }, [clock]);

  useFrame((state) => {
    if (light.current) light.current.rotation.y = state.clock.elapsedTime * 0.8;
    if (point.current) point.current.intensity = skyState.dayNight * 26;
    if (lamp.current) lamp.current.emissiveIntensity = 0.35 + skyState.dayNight * 2.15;
    // Volée amortie ; la cloche retinte à chaque aller-retour, de plus en plus doucement.
    const since = state.clock.elapsedTime - struck.current;
    if (bell.current) bell.current.rotation.z = since < 9 ? Math.sin(since * 3.4) * 0.42 * Math.exp(-since * 0.42) : 0;
    const swing = Math.floor((since * 3.4) / Math.PI);
    if (since < 6 && swing > chimes.current && swing % 2 === 0) {
      chimes.current = swing;
      ambience.bell(Math.exp(-since * 0.5));
    }
  });

  return (
    <>
      <SubstanceProp name="bell-tower" position={base} rotation={rotation} scale={1.25} onModel={onModel} onClick={ring} />
      <group ref={light} position={[hillX, base[1] + 6.05, hillZ]}>
        <mesh>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial ref={lamp} color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={0.35} />
        </mesh>
        {quality === 'high' && <pointLight ref={point} color="#ffd9a0" intensity={0} distance={44} decay={2} />}
      </group>
      <SubstanceProp name="cymbal" position={on(sampler, dockX, dockZ, 0.8)} rotation={facingDock(island, dockX, dockZ) + Math.PI / 2} />
    </>
  );
}

