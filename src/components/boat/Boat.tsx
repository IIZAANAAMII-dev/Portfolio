'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Shape, InstancedMesh } from 'three';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { damp, smoothstep } from '@/lib/utils/math';
import { useBoatNavigation } from '@/hooks/useBoatNavigation';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { Wake } from './Wake';
import { BoatModel } from './BoatModel';

/** Doit rester aligné sur MAX_SPEED de useBoatNavigation. */
const MAX_VISUAL_SPEED = MAX_SPEED;

function ExhaustSmoke() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = 9;

  useFrame((state) => {
    if (!mesh.current) return;
    const strength = Math.min(boatState.speed / MAX_VISUAL_SPEED, 1);
    mesh.current.visible = strength > 0.08;
    const t = state.clock.elapsedTime;
    for (let index = 0; index < count; index++) {
      const life = (t * (0.34 + strength * 0.18) + index / count) % 1;
      dummy.position.set(
        -2.25 - life * (0.7 + strength * 1.3),
        2.75 + life * 3.1,
        Math.sin(index * 4.7 + t) * life * 0.45,
      );
      const scale = (0.12 + life * 0.62) * (0.5 + strength * 0.7);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <dodecahedronGeometry args={[0.65, 0]} />
      <meshBasicMaterial color="#8c9799" transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
  );
}

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
  const boatLight = useRef<PointLight>(null);
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

    const { timeOfDay } = useWorld.getState();
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(angle);
    const dayNight = 1 - smoothstep(-0.2, 0.15, sunElevation);
    if (boatLight.current) boatLight.current.intensity = damp(boatLight.current.intensity, dayNight * 18, 2, dt);

    if (group.current) {
      const y = waveHeight(position.x, position.z, t);
      const drift = Math.sin(t * 0.74) * 0.16 + Math.sin(t * 1.3 + 1.1) * 0.07 + Math.sin(t * 2.1 + 2.5) * 0.03;
      const heave = y + drift + Math.sin(t * 1.35) * Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.055;
      group.current.position.x = position.x;
      group.current.position.y = damp(group.current.position.y, heave, 8, dt);
      group.current.position.z = position.z;
      group.current.rotation.y = -heading;
    }

    if (rocker.current) {
      const sampleDistance = 2.45;
      const ahead = waveHeight(
        position.x + Math.cos(heading) * sampleDistance,
        position.z + Math.sin(heading) * sampleDistance,
        t,
      );
      const behind = waveHeight(
        position.x - Math.cos(heading) * sampleDistance,
        position.z - Math.sin(heading) * sampleDistance,
        t,
      );
      const port = waveHeight(
        position.x - Math.sin(heading) * 1.05,
        position.z + Math.cos(heading) * 1.05,
        t,
      );
      const starboard = waveHeight(
        position.x + Math.sin(heading) * 1.05,
        position.z - Math.cos(heading) * 1.05,
        t,
      );
      const damping = 1 - Math.min(speed / 14, 0.5);
      rocker.current.rotation.z = damp(
        rocker.current.rotation.z,
        (ahead - behind) * 0.34 * damping,
        4,
        dt,
      );
      rocker.current.rotation.x = damp(
        rocker.current.rotation.x,
        (port - starboard) * 0.52 * damping + boatState.collision * 0.08,
        3,
        dt,
      );
    }

    if (sail.current) {
      const fill = 1 + Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.25;
      sail.current.scale.z = damp(sail.current.scale.z, fill, 3, dt);
      sail.current.rotation.y = Math.sin(t * 2.1) * 0.09 + Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.08;
      sail.current.rotation.z = Math.sin(t * 3.4) * 0.025;
    }
  });

  return (
    <>
    <group ref={group}>
      <group ref={rocker}>
        <pointLight
          ref={boatLight}
          position={[0, 2.2, 0]}
          color="#fff4e6"
          intensity={0}
          distance={22}
          decay={1.8}
        />
        <BoatModel />
        <group visible={false}>
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
          <planeGeometry args={[1.3, 0.7, 5, 2]} />
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
        <ExhaustSmoke />
      </group>
    </group>
    <Wake />
    </>
  );
}
