'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
} from 'three';
import { skyState } from '@/lib/sky';
import { windowMaterial } from '@/lib/windows';
import type { V3 } from './build';
import { provenceFlagTexture } from './textures';

/**
 * Pièces React communes de l'île Expériences : maillage fusionné, fenêtres instanciées
 * (allumage progressif au crépuscule), lanternes, drapeau au vent, rebond de retour au clic.
 */

/** Un maillage fusionné (statique) : géométrie libérée au démontage. */
export function Merged({
  geometry,
  material,
  shadows = true,
  receive = true,
  ...props
}: {
  geometry: BufferGeometry;
  material: Material;
  shadows?: boolean;
  receive?: boolean;
  position?: V3;
  rotation?: V3;
}) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={shadows}
      receiveShadow={receive}
      position={props.position as [number, number, number] | undefined}
      rotation={props.rotation as [number, number, number] | undefined}
      raycast={() => null}
    />
  );
}

/* ------------------------------------------------------------------ fenêtres */

export interface WindowSpec {
  seed: number;
  at: V3;
  /** Rotation Y de la vitre (0 : face à +z). */
  turn?: number;
  /** Basculement X (vitres de toit, écrans inclinés). */
  tilt?: number;
  width: number;
  height: number;
}

const PANE = new PlaneGeometry(1, 1);
const paneEuler = new Euler();
const paneQuaternion = new Quaternion();
const panePosition = new Vector3();
const paneScale = new Vector3();

function WindowGroup({ material, matrices }: { material: MeshStandardMaterial; matrices: Matrix4[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    matrices.forEach((m, index) => target.setMatrixAt(index, m));
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={mesh} args={[PANE, material, matrices.length]} raycast={() => null} />;
}

/**
 * Fenêtres d'un bâtiment : chaque vitre garde sa propre heure d'allumage (comme
 * `<WindowPane>`), mais celles qui partagent un matériau sont dessinées ensemble.
 */
export function Windows({ specs, lit = '#ffc46b', glass = '#36506b', intensity }: { specs: WindowSpec[]; lit?: string; glass?: string; intensity?: number }) {
  const groups = useMemo(() => {
    const byMaterial = new Map<MeshStandardMaterial, Matrix4[]>();
    for (const spec of specs) {
      const material = windowMaterial(spec.seed, lit, glass, intensity);
      paneEuler.set(spec.tilt ?? 0, spec.turn ?? 0, 0, 'YXZ');
      paneQuaternion.setFromEuler(paneEuler);
      const m = new Matrix4().compose(
        panePosition.set(spec.at[0], spec.at[1], spec.at[2]),
        paneQuaternion,
        paneScale.set(spec.width, spec.height, 1),
      );
      const list = byMaterial.get(material) ?? [];
      list.push(m);
      byMaterial.set(material, list);
    }
    return [...byMaterial.entries()];
  }, [glass, intensity, lit, specs]);
  return (
    <>
      {groups.map(([material, matrices]) => (
        <WindowGroup key={material.uuid} material={material} matrices={matrices} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ lanternes */

/**
 * Globes de lanterne (réverbères du port, du chemin) : une seule InstancedMesh, éteinte
 * le jour, chaude et un peu vacillante la nuit.
 */
export function Lanterns({ points, radius = 0.17, color = '#ffd28a' }: { points: V3[]; radius?: number; color?: string }) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const m = new Matrix4();
    points.forEach((point, index) => target.setMatrixAt(index, m.makeTranslation(point[0], point[1], point[2])));
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [points]);
  useFrame((state) => {
    if (!material.current) return;
    const night = skyState.dayNight;
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 9.1) * 0.04 + Math.sin(state.clock.elapsedTime * 13.7) * 0.03;
    material.current.emissiveIntensity = (0.15 + night * 2.6) * flicker;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, points.length]} raycast={() => null}>
      <icosahedronGeometry args={[radius, 1]} />
      <meshStandardMaterial ref={material} color="#fff1d0" emissive={color} emissiveIntensity={0.15} roughness={0.3} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ drapeau */

const FLAG_WIDTH = 1.35;
const FLAG_HEIGHT = 0.9;
const flagClock = { value: 0 };

function flagMaterial() {
  const material = new MeshStandardMaterial({ map: provenceFlagTexture(), side: DoubleSide, roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = flagClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // Le drapeau ondule depuis la hampe (x = 0), libre au bout.
        float flagFree = clamp(position.x / ${FLAG_WIDTH.toFixed(2)}, 0.0, 1.0);
        float flagWave = sin(position.x * 4.6 - uTime * 5.2) * 0.11 + sin(position.x * 8.3 - uTime * 7.9 + position.y * 2.6) * 0.035;
        transformed.z += flagWave * flagFree;
        transformed.y -= flagFree * flagFree * 0.07;`,
      );
  };
  material.customProgramCacheKey = () => 'provence-flag-v1';
  return material;
}

/** Mât et drapeau « Sang et Or » de Provence, au vent. */
export function ProvenceFlag({ position, rotation = 0, height = 2.6 }: { position: V3; rotation?: number; height?: number }) {
  const material = useMemo(() => flagMaterial(), []);
  const cloth = useMemo(() => new PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, 14, 5).translate(FLAG_WIDTH / 2, 0, 0), []);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
    cloth.dispose();
  }, [cloth, material]);
  useFrame((state) => {
    flagClock.value = state.clock.elapsedTime;
  });
  return (
    <group position={position as [number, number, number]} rotation-y={rotation}>
      <mesh castShadow position-y={height / 2} raycast={() => null}>
        <cylinderGeometry args={[0.035, 0.05, height, 6]} />
        <meshStandardMaterial color="#ece6da" roughness={0.6} />
      </mesh>
      <mesh position-y={height + 0.04} raycast={() => null}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh geometry={cloth} material={material} castShadow position={[0.04, height - FLAG_HEIGHT / 2 - 0.05, 0]} raycast={() => null} />
    </group>
  );
}

/* ------------------------------------------------------------------ rebond */

/**
 * Retour visuel d'un clic : le bâtiment s'écrase puis s'étire en oscillation amortie
 * (comme un jouet qu'on tapote). `kick()` relance l'animation ; à poser autour du décor.
 */
export function usePulse(strength = 0.08) {
  const group = useRef<Group>(null);
  const start = useRef(-100);
  const clock = useRef(0);
  useFrame((state) => {
    clock.current = state.clock.elapsedTime;
    const target = group.current;
    if (!target) return;
    const since = state.clock.elapsedTime - start.current;
    if (since > 1.6) {
      if (target.scale.y !== 1) target.scale.set(1, 1, 1);
      return;
    }
    const wobble = Math.sin(since * 16) * Math.exp(-since * 4.2) * strength;
    target.scale.set(1 - wobble * 0.5, 1 + wobble, 1 - wobble * 0.5);
  });
  const kick = () => {
    start.current = clock.current;
  };
  return [group, kick] as const;
}
