'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape } from 'three';
import { boatState } from '@/lib/boat-state';
import { waveHeight } from '@/lib/waves';
import { damp } from '@/lib/utils/math';
import { useBoatNavigation } from '@/hooks/useBoatNavigation';
import { Wake } from './Wake';

/** Doit rester aligné sur MAX_SPEED de useBoatNavigation. */
const MAX_VISUAL_SPEED = 9.5;

/** Coque : silhouette vue de dessus, extrudée verticalement. Proue vers +X. */
function useHullGeometry() {
  return useMemo(() => {
    const shape = new Shape();
    shape.moveTo(1.85, 0);
    shape.lineTo(1.15, 0.6);
    shape.lineTo(0.1, 0.72);
    shape.lineTo(-1.25, 0.64);
    shape.lineTo(-1.6, 0.46);
    shape.lineTo(-1.6, -0.46);
    shape.lineTo(-1.25, -0.64);
    shape.lineTo(0.1, -0.72);
    shape.lineTo(1.15, -0.6);
    shape.closePath();

    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 2,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.18, 0);
    return geometry;
  }, []);
}

function useSailGeometry() {
  return useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 2.05);
    shape.quadraticCurveTo(0.7, 1.0, 1.15, 0);
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: false,
    });
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, []);
}

export function Boat() {
  const group = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const sail = useRef<Mesh>(null);
  const hullGeometry = useHullGeometry();
  const sailGeometry = useSailGeometry();

  const wood = useMemo(
    () => new MeshStandardMaterial({ color: '#9a6a44', roughness: 0.85, flatShading: true }),
    [],
  );
  const deck = useMemo(
    () => new MeshStandardMaterial({ color: '#e6d9c0', roughness: 0.9, flatShading: true }),
    [],
  );

  useBoatNavigation();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const { position, heading, speed } = boatState;

    if (group.current) {
      const y = waveHeight(position.x, position.z, t);
      group.current.position.set(position.x, y, position.z);
      group.current.rotation.y = -heading;
    }

    if (rocker.current) {
      // Roulis/tangage lus sur la pente réelle de la houle, atténués à vitesse élevée
      // (un bateau lancé « perce » la vague au lieu de la suivre).
      const ahead = waveHeight(
        position.x + Math.cos(heading) * 1.6,
        position.z + Math.sin(heading) * 1.6,
        t,
      );
      const behind = waveHeight(
        position.x - Math.cos(heading) * 1.6,
        position.z - Math.sin(heading) * 1.6,
        t,
      );
      const damping = 1 - Math.min(speed / 14, 0.5);
      rocker.current.rotation.z = damp(
        rocker.current.rotation.z,
        (ahead - behind) * 0.22 * damping,
        4,
        dt,
      );
      rocker.current.rotation.x = damp(
        rocker.current.rotation.x,
        Math.sin(t * 0.9) * 0.05 * damping,
        3,
        dt,
      );
    }

    if (sail.current) {
      // La voile se gonfle avec la vitesse.
      const fill = 1 + Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.35;
      sail.current.scale.z = damp(sail.current.scale.z, fill, 3, dt);
    }
  });

  return (
    <group ref={group}>
      <group ref={rocker}>
        <mesh geometry={hullGeometry} material={wood} castShadow />
        <mesh position={[-0.2, 0.16, 0]} material={deck} castShadow>
          <boxGeometry args={[2.2, 0.08, 1.15]} />
        </mesh>
        <mesh position={[-1.05, 0.42, 0]} material={wood} castShadow>
          <boxGeometry args={[0.7, 0.44, 0.9]} />
        </mesh>
        <mesh position={[0.25, 1.35, 0]} material={wood} castShadow>
          <cylinderGeometry args={[0.055, 0.07, 2.4, 6]} />
        </mesh>
        <mesh ref={sail} geometry={sailGeometry} position={[0.28, 0.35, 0]} castShadow>
          <meshStandardMaterial color="#f4f1ea" roughness={0.95} side={DoubleSide} flatShading />
        </mesh>
        <mesh position={[0.25, 2.62, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#f0b27a" emissive="#f0b27a" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Wake />
    </group>
  );
}
