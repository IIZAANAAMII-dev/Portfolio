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

/** Coque de petit chalutier : proue courte, étrave haute, poupe carrée. Proue vers +X. */
function useHullGeometry() {
  return useMemo(() => {
    const shape = new Shape();
    shape.moveTo(3.2, 0);
    shape.lineTo(2.2, 1.12);
    shape.lineTo(0.8, 1.42);
    shape.lineTo(-1.6, 1.34);
    shape.lineTo(-2.9, 1.05);
    shape.lineTo(-3.2, 0.55);
    shape.lineTo(-3.2, -0.55);
    shape.lineTo(-2.9, -1.05);
    shape.lineTo(-1.6, -1.34);
    shape.lineTo(0.8, -1.42);
    shape.lineTo(2.2, -1.12);
    shape.closePath();

    const geometry = new ExtrudeGeometry(shape, {
      depth: 1.05,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 1,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.32, 0);
    return geometry;
  }, []);
}

/** Filet replié le long du bastingage arrière. */
function useNetGeometry() {
  return useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(2.4, 0);
    shape.quadraticCurveTo(2.2, 0.85, 0.2, 0.85);
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(-2.2, 0.58, 0.8);
    return geometry;
  }, []);
}

export function Boat() {
  const group = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const sail = useRef<Mesh>(null);
  const hullGeometry = useHullGeometry();
  const netGeometry = useNetGeometry();

  const m = useMemo(
    () => ({
      red: new MeshStandardMaterial({ color: '#c44a3a', roughness: 0.75, flatShading: true }),
      white: new MeshStandardMaterial({ color: '#eef2f3', roughness: 0.8, flatShading: true }),
      blue: new MeshStandardMaterial({ color: '#2a5d85', roughness: 0.85, flatShading: true }),
      wood: new MeshStandardMaterial({ color: '#a67c52', roughness: 0.9, flatShading: true }),
      deck: new MeshStandardMaterial({ color: '#cfa676', roughness: 0.95, flatShading: true }),
      metal: new MeshStandardMaterial({ color: '#95a0a6', roughness: 0.45, metalness: 0.3, flatShading: true }),
      glass: new MeshStandardMaterial({ color: '#8fd1e6', roughness: 0.25, flatShading: true }),
      net: new MeshStandardMaterial({ color: '#e3dccd', roughness: 1, side: DoubleSide, flatShading: true }),
      gold: new MeshStandardMaterial({ color: '#ffcf8a', roughness: 0.95, side: DoubleSide, flatShading: true }),
      dark: new MeshStandardMaterial({ color: '#6b6f76', roughness: 0.6, metalness: 0.4, flatShading: true }),
      barrel: new MeshStandardMaterial({ color: '#8a6b4d', roughness: 1, flatShading: true }),
      warmGlow: new MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffd9a0', emissiveIntensity: 3 }),
      redGlow: new MeshStandardMaterial({ color: '#ff5a4a', emissive: '#ff5a4a', emissiveIntensity: 2 }),
    }),
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
      const ahead = waveHeight(
        position.x + Math.cos(heading) * 2.8,
        position.z + Math.sin(heading) * 2.8,
        t,
      );
      const behind = waveHeight(
        position.x - Math.cos(heading) * 2.8,
        position.z - Math.sin(heading) * 2.8,
        t,
      );
      const damping = 1 - Math.min(speed / 14, 0.5);
      rocker.current.rotation.z = damp(
        rocker.current.rotation.z,
        (ahead - behind) * 0.2 * damping,
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
      const fill = 1 + Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.25;
      sail.current.scale.z = damp(sail.current.scale.z, fill, 3, dt);
    }
  });

  return (
    <group ref={group}>
      <group ref={rocker}>
        {/* Coque */}
        <mesh geometry={hullGeometry} material={m.red} castShadow />
        {/* Bande blanche bordé */}
        <mesh position={[0, 0.34, 0]} material={m.white} castShadow>
          <boxGeometry args={[6.0, 0.18, 2.5]} />
        </mesh>
        {/* Ligne bleue stylisée */}
        <mesh position={[0.1, 0.38, 0]} material={m.blue} castShadow>
          <boxGeometry args={[5.4, 0.05, 2.42]} />
        </mesh>

        {/* Pont */}
        <mesh position={[-0.2, 0.46, 0]} material={m.deck} castShadow>
          <boxGeometry args={[5.6, 0.12, 2.15]} />
        </mesh>

        {/* Cabine de timonerie */}
        <mesh position={[-1.8, 1.25, 0]} material={m.white} castShadow>
          <boxGeometry args={[1.9, 1.5, 1.65]} />
        </mesh>
        {/* Toit cabine */}
        <mesh position={[-1.7, 2.15, 0]} material={m.red} castShadow>
          <boxGeometry args={[2.0, 0.12, 1.7]} />
        </mesh>
        {/* Fenêtres */}
        {[-0.88, -1.8].map((x) =>
          [0.82, -0.82].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 1.35, z]} material={m.glass}>
              <boxGeometry args={[0.6, 0.55, 0.08]} />
            </mesh>
          )),
        )}

        {/* Mât */}
        <mesh position={[-0.4, 2.2, 0]} material={m.wood} castShadow>
          <cylinderGeometry args={[0.09, 0.12, 4.2, 6]} />
        </mesh>
        {/* Balcon / portique de pêche */}
        <mesh position={[0.9, 2.45, 0]} material={m.wood} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3.0, 5]} rotation-z={Math.PI / 2} />
        </mesh>
        <mesh position={[0.9, 2.0, 0]} material={m.wood} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.6, 5]} rotation-z={Math.PI / 2} />
        </mesh>
        {/* Petit drapeau */}
        <mesh ref={sail} position={[0.95, 2.6, 0]} material={m.gold} castShadow>
          <boxGeometry args={[1.3, 0.7, 0.05]} />
        </mesh>

        {/* Filet plié sur bâbord */}
        <mesh geometry={netGeometry} material={m.net} castShadow />

        {/* Hublot / radar */}
        <mesh position={[-1.5, 2.4, 0]} material={m.metal} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.35, 8]} />
        </mesh>

        {/* Caisse et tonneau sur le pont */}
        <mesh position={[1.0, 0.58, 0.65]} material={m.deck} castShadow>
          <boxGeometry args={[0.9, 0.55, 0.55]} />
        </mesh>
        <mesh position={[1.05, 0.92, 0.65]} material={m.white} castShadow>
          <boxGeometry args={[0.6, 0.3, 0.35]} />
        </mesh>
        <mesh position={[1.6, 0.55, -0.5]} material={m.barrel} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.62, 10]} />
        </mesh>

        {/* Ancre sur l'étrave */}
        <mesh position={[2.65, 0.18, 0.65]} material={m.dark} castShadow>
          <torusGeometry args={[0.22, 0.07, 5, 10]} />
        </mesh>
        <mesh position={[2.65, 0.18, 0.65]} material={m.dark} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.55, 5]} />
        </mesh>

        {/* Fanal de proue : le point lumineux qui accroche l'œil pendant l'intro. */}
        <mesh position={[3.05, 0.75, 0]} material={m.warmGlow}>
          <sphereGeometry args={[0.12, 8, 6]} />
        </mesh>
        <pointLight position={[3.05, 0.75, 0]} color="#ffcf8a" intensity={8} distance={14} decay={2} />

        {/* Lumière de poupe */}
        <mesh position={[-3.0, 1.05, 0]} material={m.redGlow}>
          <sphereGeometry args={[0.07, 8, 6]} />
        </mesh>
      </group>
      <Wake />
    </group>
  );
}
