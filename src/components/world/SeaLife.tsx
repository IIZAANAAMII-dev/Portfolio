'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { DolphinPod } from './fauna/Dolphins';
import { FishJumps } from './fauna/FishJumps';
import { MeshBuilder, tone } from './fauna/geometry';
import { crossed, faunaClock } from './fauna/shared';
import { splash, Splashes } from './fauna/Splashes';
import { Whale } from './fauna/Whale';

/**
 * Vie de surface, toujours montée avec la scène complète : les éclaboussures partagées, des
 * exocets qui planent devant l'étrave quand le bateau file, de petits sauts au-dessus des
 * bancs, le pod de dauphins qui vient jouer avec le bateau, et, de loin en loin, la baleine.
 * Tout est procédural (aucun modèle à charger) et ne dessine rien entre deux rencontres.
 */

/* ----------------------------------------------------------------------- exocets */

function flyingFishGeometry() {
  const builder = new MeshBuilder();
  const back = tone('#3d6f9e');
  const belly = tone('#e8f1f4');
  const fin = tone('#9cc7e6');
  // Corps fuselé (avant = +X), dos bleu, ventre argenté ; faces orientées vers l'extérieur.
  const nose: [number, number, number] = [0.38, 0, 0];
  const tail: [number, number, number] = [-0.34, 0.01, 0];
  const top: [number, number, number] = [0.02, 0.07, 0];
  const bottom: [number, number, number] = [0.02, -0.06, 0];
  const left: [number, number, number] = [0.02, 0, 0.06];
  const right: [number, number, number] = [0.02, 0, -0.06];
  builder.tri(nose, top, left, back).tri(nose, right, top, back);
  builder.tri(nose, left, bottom, belly).tri(nose, bottom, right, belly);
  builder.tri(tail, left, top, back).tri(tail, top, right, back);
  builder.tri(tail, bottom, left, belly).tri(tail, right, bottom, belly);
  // Grandes pectorales en ailes (deux faces), queue fourchue.
  for (const side of [1, -1]) {
    builder.sheet([0.12, 0.02, 0.05 * side], [-0.12, 0.02, 0.42 * side], [-0.02, 0.02, 0.05 * side], fin);
  }
  builder.sheet([-0.3, 0.01, 0], [-0.5, 0.1, 0], [-0.46, -0.08, 0], fin);
  return builder.build();
}

const FLYERS = 6;
const FLYING_FISH_GEOMETRY = flyingFishGeometry();

interface Glide {
  start: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  length: number;
  height: number;
  duration: number;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');
const position = new Vector3();
const scale = new Vector3();
const hidden = new Matrix4().makeScale(0, 0, 0);

function FlyingFish() {
  const mesh = useRef<InstancedMesh>(null);
  const glides = useRef<Glide[]>(Array.from({ length: FLYERS }, () => ({
    start: -100, x: 0, z: 0, dirX: 1, dirZ: 0, length: 6, height: 1.4, duration: 1,
  })));
  const memo = useRef({ next: 0, counter: 0, prev: -1e9 });

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = faunaClock(state.clock.elapsedTime);
    const waveTime = state.clock.elapsedTime;
    const m = memo.current;
    const prev = m.prev;
    m.prev = time;
    const { phase } = useWorld.getState();
    const fast = phase === 'playing' && boatState.speed > MAX_SPEED * 0.55 && ecologyState.dayFish > 0.3;

    // Nouveau vol, devant le bateau et un peu sur le côté.
    if (fast && time > m.next) {
      m.counter += 1;
      const seed = m.counter * 7.13;
      m.next = time + 0.45 + hash(seed) * 1.1;
      const glide = glides.current.find((entry) => time - entry.start > entry.duration + 0.2);
      if (glide) {
        const fx = Math.cos(boatState.heading);
        const fz = Math.sin(boatState.heading);
        const side = (hash(seed + 1.1) > 0.5 ? 1 : -1) * (3 + hash(seed + 2.3) * 4);
        const ahead = 4 + hash(seed + 3.7) * 9;
        const turn = (hash(seed + 4.9) - 0.5) * 0.8;
        glide.start = time;
        glide.x = boatState.position.x + fx * ahead - fz * side;
        glide.z = boatState.position.z + fz * ahead + fx * side;
        glide.dirX = Math.cos(boatState.heading + turn);
        glide.dirZ = Math.sin(boatState.heading + turn);
        glide.length = 5 + hash(seed + 5.3) * 5;
        glide.height = 1 + hash(seed + 6.1) * 0.9;
        glide.duration = 0.8 + hash(seed + 7.7) * 0.45;
      }
    }

    let any = false;
    glides.current.forEach((glide, index) => {
      const k = (time - glide.start) / glide.duration;
      const prevK = (prev - glide.start) / glide.duration;
      if (crossed(prevK, k, 0.04)) splash(glide.x, glide.z, glide.start + 0.04 * glide.duration, 0.22, glide.dirX, glide.dirZ);
      if (crossed(prevK, k, 0.97)) {
        splash(
          glide.x + glide.dirX * glide.length * 0.97, glide.z + glide.dirZ * glide.length * 0.97,
          glide.start + 0.97 * glide.duration, 0.3, glide.dirX, glide.dirZ,
        );
      }
      if (k < 0 || k > 1) {
        target.setMatrixAt(index, hidden);
        return;
      }
      any = true;
      const x = glide.x + glide.dirX * glide.length * k;
      const z = glide.z + glide.dirZ * glide.length * k;
      position.set(x, waveHeight(x, z, waveTime) + Math.sin(k * Math.PI) * glide.height, z);
      // Cap le long du vol, nez qui monte puis plonge, ailes qui frémissent.
      euler.set(Math.sin(time * 24 + index) * 0.15, -Math.atan2(glide.dirZ, glide.dirX), Math.cos(k * Math.PI) * 0.55, 'YXZ');
      quaternion.setFromEuler(euler);
      scale.setScalar(1.6);
      matrix.compose(position, quaternion, scale);
      target.setMatrixAt(index, matrix);
    });
    target.visible = any;
    if (any) target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[FLYING_FISH_GEOMETRY, undefined, FLYERS]}
      frustumCulled={false}
      raycast={() => null}
      visible={false}
    >
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.2} flatShading />
    </instancedMesh>
  );
}

export function SeaLife() {
  return (
    <group>
      <Splashes />
      <FlyingFish />
      <FishJumps />
      <DolphinPod />
      <Whale />
    </group>
  );
}
