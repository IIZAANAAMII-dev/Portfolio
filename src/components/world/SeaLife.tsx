'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Object3D,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { triggerSplash } from '@/components/boat/Splash';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { SOLIDS } from '@/lib/navigation';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ripple } from './Flotsam';

/**
 * Vie de surface : des exocets qui jaillissent devant l'étrave quand le bateau file, et,
 * de loin en loin, une baleine qui saute au large et retombe dans une gerbe immense.
 * Tout est léger : six poissons instanciés, une seule baleine, aucun modèle à charger.
 */

/* ----------------------------------------------------------------------- exocets */

function flyingFishGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const back = new Color('#3d6f9e');
  const belly = new Color('#e8f1f4');
  const fin = new Color('#9cc7e6');
  const tri = (a: number[], b: number[], c: number[], color: Color) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  };
  // Corps fuselé (avant = +X), dos bleu, ventre argenté.
  const nose = [0.38, 0, 0];
  const tail = [-0.34, 0.01, 0];
  const top = [0.02, 0.07, 0];
  const bottom = [0.02, -0.06, 0];
  const left = [0.02, 0, 0.06];
  const right = [0.02, 0, -0.06];
  for (const end of [nose, tail]) {
    tri(end, top, left, back);
    tri(end, right, top, back);
    tri(end, left, bottom, belly);
    tri(end, bottom, right, belly);
  }
  // Grandes nageoires pectorales en ailes, et queue fourchue.
  for (const side of [1, -1]) {
    tri([0.12, 0.02, 0.05 * side], [-0.12, 0.02, 0.42 * side], [-0.02, 0.02, 0.05 * side], fin);
  }
  tri([-0.3, 0.01, 0], [-0.5, 0.1, 0], [-0.46, -0.08, 0], fin);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

const FISH = 6;

interface Leap {
  start: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  length: number;
  height: number;
  duration: number;
  splashed: boolean;
}

function FlyingFish() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => flyingFishGeometry(), []);
  const leaps = useRef<Leap[]>(Array.from({ length: FISH }, () => ({
    start: -100, x: 0, z: 0, dirX: 1, dirZ: 0, length: 6, height: 1.4, duration: 1, splashed: true,
  })));
  const next = useRef(0);
  const counter = useRef(0);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    const fast = phase === 'playing' && boatState.speed > MAX_SPEED * 0.55;

    // Nouveau saut, devant le bateau et un peu sur le côté.
    if (fast && time > next.current) {
      counter.current += 1;
      const seed = counter.current * 7.13;
      next.current = time + 0.45 + hash(seed) * 1.1;
      const leap = leaps.current.find((entry) => time - entry.start > entry.duration + 0.2);
      if (leap) {
        const fx = Math.cos(boatState.heading);
        const fz = Math.sin(boatState.heading);
        const side = (hash(seed + 1.1) > 0.5 ? 1 : -1) * (3 + hash(seed + 2.3) * 4);
        const ahead = 4 + hash(seed + 3.7) * 9;
        const turn = (hash(seed + 4.9) - 0.5) * 0.8;
        leap.start = time;
        leap.x = boatState.position.x + fx * ahead - fz * side;
        leap.z = boatState.position.z + fz * ahead + fx * side;
        leap.dirX = Math.cos(boatState.heading + turn);
        leap.dirZ = Math.sin(boatState.heading + turn);
        leap.length = 5 + hash(seed + 5.3) * 5;
        leap.height = 1 + hash(seed + 6.1) * 0.9;
        leap.duration = 0.8 + hash(seed + 7.7) * 0.45;
        leap.splashed = false;
        ripple(leap.x, leap.z, time, 0.5);
      }
    }

    leaps.current.forEach((leap, index) => {
      const k = (time - leap.start) / leap.duration;
      if (k < 0 || k > 1) {
        dummy.scale.setScalar(0);
        if (k > 1 && !leap.splashed) {
          leap.splashed = true;
          ripple(leap.x + leap.dirX * leap.length, leap.z + leap.dirZ * leap.length, time, 0.55);
          ambience.bump('soft', 0.18);
        }
      } else {
        dummy.position.set(
          leap.x + leap.dirX * leap.length * k,
          Math.sin(k * Math.PI) * leap.height,
          leap.z + leap.dirZ * leap.length * k,
        );
        // Cap le long du saut, nez qui monte puis plonge, léger roulis.
        dummy.rotation.set(Math.sin(time * 24 + index) * 0.15, -Math.atan2(leap.dirZ, leap.dirX), Math.cos(k * Math.PI) * 0.55, 'YXZ');
        dummy.scale.setScalar(1.6);
      }
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, FISH]} frustumCulled={false} raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.2} flatShading />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------------ baleine */

function whaleGeometry() {
  // Corps tourné : profil (rayon selon la longueur), puis couché le long de +X.
  const profile = [
    [0, -5], [0.9, -4.7], [1.6, -3.6], [1.75, -2], [1.6, 0], [1.25, 1.8], [0.75, 3.3], [0.35, 4.3], [0.18, 4.9], [0, 5.1],
  ].map(([r, y]) => new Vector2(r, y));
  const body = new LatheGeometry(profile, 18);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 0.82, 1);
  // Nageoire caudale (deux lobes), nageoires pectorales.
  const flukeShape = new BufferGeometry();
  flukeShape.setAttribute('position', new BufferAttribute(new Float32Array([
    -4.9, 0, 0, -6.3, 0.15, 2.2, -5.6, 0, 0.2,
    -4.9, 0, 0, -5.6, 0, -0.2, -6.3, 0.15, -2.2,
  ]), 3));
  const fins = new BufferGeometry();
  fins.setAttribute('position', new BufferAttribute(new Float32Array([
    2.6, -0.6, 1.2, 1.2, -0.9, 3.4, 1.6, -0.7, 1.3,
    2.6, -0.6, -1.2, 1.6, -0.7, -1.3, 1.2, -0.9, -3.4,
  ]), 3));
  const parts = [body.toNonIndexed(), flukeShape, fins];
  for (const part of parts) {
    part.deleteAttribute('uv');
    part.deleteAttribute('normal');
  }
  const merged = mergeGeometries(parts)!;
  // Dos bleu ardoise, ventre clair (sillons de la gorge).
  const positions = merged.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const back = new Color('#2d4862');
  const belly = new Color('#d9e3e7');
  const tint = new Color();
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    tint.copy(back).lerp(belly, Math.min(1, Math.max(0, (-y - 0.15) / 0.9)));
    tint.toArray(colors, index * 3);
  }
  merged.setAttribute('color', new BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

const BREACH = 3.1;
const demoLook = new Vector3();
const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'whale';

function Whale() {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => whaleGeometry(), []);
  const event = useRef({ start: -100, x: 0, z: 0, dirX: 1, dirZ: 0, splashed: true, sang: true });
  const nextAt = useRef(-1);

  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    if (nextAt.current < 0) nextAt.current = time + (DEMO ? 8 : 45);

    // Un saut de temps en temps, au large mais dans le champ de la caméra.
    if ((phase === 'playing' || (DEMO && phase === 'docked')) && time > nextAt.current) {
      nextAt.current = time + (DEMO ? 5 : 80 + Math.random() * 70);
      if (DEMO) {
        // Démo : sur le côté du point visé par la caméra, bien dans le cadre.
        state.camera.getWorldDirection(demoLook);
        const reach = -state.camera.position.y / Math.min(demoLook.y, -0.05);
        const hitX = state.camera.position.x + demoLook.x * reach;
        const hitZ = state.camera.position.z + demoLook.z * reach;
        const flat = Math.hypot(demoLook.x, demoLook.z) || 1;
        const x = hitX - (demoLook.z / flat) * 24 - (demoLook.x / flat) * 6;
        const z = hitZ + (demoLook.x / flat) * 24 - (demoLook.z / flat) * 6;
        event.current = { start: time, x, z, dirX: demoLook.x / flat, dirZ: demoLook.z / flat, splashed: false, sang: false };
      }
      const look = boatState.heading;
      for (let attempt = 0; attempt < 12 && !DEMO; attempt++) {
        const bearing = look + (Math.random() - 0.5) * 1.4;
        const distance = 38 + Math.random() * 26;
        const x = boatState.position.x + Math.cos(bearing) * distance;
        const z = boatState.position.z + Math.sin(bearing) * distance;
        if (Math.hypot(x, z) > 112) continue;
        if (SOLIDS.some((solid) => Math.hypot(x - solid.x, z - solid.z) < solid.r + 14)) continue;
        const across = bearing + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
        event.current = { start: time, x, z, dirX: Math.cos(across), dirZ: Math.sin(across), splashed: false, sang: false };
        break;
      }
    }

    const e = event.current;
    const k = (time - e.start) / BREACH;
    target.visible = k >= 0 && k <= 1;
    if (!target.visible) return;
    if (!e.sang) {
      e.sang = true;
      ripple(e.x, e.z, time, 3);
      ambience.whale();
      logbook.stamp('whale');
    }
    // Jaillit cabrée, tourne sur le flanc au sommet, retombe en arrière.
    const height = -6 + Math.sin(Math.min(k, 1) * Math.PI) * 13;
    target.position.set(e.x + e.dirX * k * 9, height, e.z + e.dirZ * k * 9);
    target.rotation.set(k * 1.6, -Math.atan2(e.dirZ, e.dirX), 1.2 - k * 2.2, 'YXZ');
    if (!e.splashed && k > 0.86) {
      e.splashed = true;
      triggerSplash(time, target.position.x, target.position.z, 2.6);
      ambience.splash(1.6);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geometry} castShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.55} side={DoubleSide} />
      </mesh>
    </group>
  );
}

export function SeaLife() {
  return (
    <group>
      <FlyingFish />
      <Whale />
    </group>
  );
}
