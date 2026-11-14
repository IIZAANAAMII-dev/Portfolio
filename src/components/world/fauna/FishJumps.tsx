'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { MeshBuilder, tone } from './geometry';
import { crossed, faunaClock, faunaDemo, schoolMarkers, type SchoolMarker } from './shared';
import { splash } from './Splashes';

/**
 * Petits sauts de poissons : de temps en temps, au-dessus d'un banc, un poisson argenté
 * jaillit et retombe (gerbe minuscule + rond dans l'eau). Le banc lui-même nage sous la
 * surface : ces éclats sont ce qui le trahit de loin. Un draw call, rien entre deux sauts.
 */

function jumperGeometry() {
  const builder = new MeshBuilder();
  const back = tone('#5f86a3');
  const flank = tone('#d9e6ea');
  const fin = tone('#8fb2c6');
  const nose: [number, number, number] = [0.2, 0, 0];
  const tail: [number, number, number] = [-0.15, 0.005, 0];
  const top: [number, number, number] = [0.02, 0.06, 0];
  const bottom: [number, number, number] = [0.02, -0.05, 0];
  const left: [number, number, number] = [0.02, 0, 0.035];
  const right: [number, number, number] = [0.02, 0, -0.035];
  for (const end of [nose, tail]) {
    const forward = end === nose;
    builder.tri(end, forward ? top : left, forward ? left : top, back);
    builder.tri(end, forward ? right : top, forward ? top : right, back);
    builder.tri(end, forward ? left : bottom, forward ? bottom : left, flank);
    builder.tri(end, forward ? bottom : right, forward ? right : bottom, flank);
  }
  builder.sheet([-0.13, 0.005, 0], [-0.26, 0.07, 0], [-0.25, -0.06, 0], fin);
  return builder.build();
}

const JUMPERS = 8;
const JUMPER_GEOMETRY = jumperGeometry();

interface Jump {
  start: number;
  duration: number;
  height: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  speed: number;
  size: number;
}

const jumps: Jump[] = Array.from({ length: JUMPERS }, () => ({
  start: -1e5, duration: 0.6, height: 0.7, x: 0, z: 0, dirX: 1, dirZ: 0, speed: 2, size: 1,
}));

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler(0, 0, 0, 'YZX');
const position = new Vector3();
const scale = new Vector3();
const hidden = new Matrix4().makeScale(0, 0, 0);
const picks: SchoolMarker[] = [];

export function FishJumps() {
  const mesh = useRef<InstancedMesh>(null);
  const memo = useRef({ next: 2, counter: 0, prev: -1e9, cursor: 0 });

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = faunaClock(state.clock.elapsedTime);
    const waveTime = state.clock.elapsedTime;
    const m = memo.current;
    const prev = m.prev;
    m.prev = time;
    const world = useWorld.getState();
    const awake = (world.phase === 'playing' || world.phase === 'docked') && world.reveal > 0.8;
    const demo = faunaDemo.kind === 'jumps';

    if (awake && time >= m.next) {
      // Un banc proche du bateau (donc du cadre), choisi au hasard parmi les vivants.
      picks.length = 0;
      for (const marker of schoolMarkers) {
        const gap = Math.hypot(marker.x - boatState.position.x, marker.z - boatState.position.z);
        if (marker.presence > 0.3 && gap < 48) picks.push(marker);
      }
      const life = ecologyState.dayFish * 0.85 + ecologyState.nocturnalFish * 0.3;
      m.counter += 1;
      const r = (offset: number) => hash(m.counter * 7.31 + offset);
      if ((picks.length || demo) && life > 0.08) {
        const marker = picks.length ? picks[Math.floor(r(1) * picks.length)] : null;
        const angle = r(2) * Math.PI * 2;
        const spread = (marker?.radius ?? 6) * 0.7 * Math.sqrt(r(3));
        const baseX = marker ? marker.x : boatState.position.x + Math.cos(boatState.heading) * 9;
        const baseZ = marker ? marker.z : boatState.position.z + Math.sin(boatState.heading) * 9;
        // Parfois deux ou trois poissons d'un coup : un petit affolement à la surface.
        const burst = r(4) > 0.72 ? 2 + Math.floor(r(5) * 2) : 1;
        for (let index = 0; index < burst; index++) {
          const jump = jumps[m.cursor];
          m.cursor = (m.cursor + 1) % JUMPERS;
          const heading = r(6 + index) * Math.PI * 2;
          jump.start = time + index * (0.12 + r(9 + index) * 0.2);
          jump.duration = 0.45 + r(12 + index) * 0.3;
          jump.height = 0.45 + r(15 + index) * 0.6;
          jump.x = baseX + Math.cos(angle) * spread + Math.cos(heading) * index * 0.7;
          jump.z = baseZ + Math.sin(angle) * spread + Math.sin(heading) * index * 0.7;
          jump.dirX = Math.cos(heading);
          jump.dirZ = Math.sin(heading);
          jump.speed = 1.6 + r(18 + index) * 1.6;
          jump.size = 0.85 + r(21 + index) * 0.5;
        }
      }
      const pace = demo ? 0.5 : 0.9 + r(30) * 1.8;
      m.next = time + pace / Math.max(life, 0.25);
    }

    let any = false;
    jumps.forEach((jump, index) => {
      const u = time - jump.start;
      const k = u / jump.duration;
      if (k < 0 || k > 1) {
        target.setMatrixAt(index, hidden);
        return;
      }
      any = true;
      const x = jump.x + jump.dirX * jump.speed * u;
      const z = jump.z + jump.dirZ * jump.speed * u;
      const surface = waveHeight(x, z, waveTime);
      const y = surface - 0.12 + Math.sin(Math.PI * k) * (jump.height + 0.12);
      position.set(x, y, z);
      // Nez qui monte puis plonge, petite vrille pour les plus vifs.
      euler.set(Math.sin(time * 18 + index) * 0.25, -Math.atan2(jump.dirZ, jump.dirX), Math.cos(Math.PI * k) * 0.9, 'YZX');
      quaternion.setFromEuler(euler);
      scale.setScalar(jump.size);
      matrix.compose(position, quaternion, scale);
      target.setMatrixAt(index, matrix);
      const prevK = (prev - jump.start) / jump.duration;
      if (crossed(prevK, k, 0.08)) splash(jump.x, jump.z, jump.start + 0.08 * jump.duration, 0.18, jump.dirX, jump.dirZ);
      if (crossed(prevK, k, 0.92)) {
        const endX = jump.x + jump.dirX * jump.speed * jump.duration * 0.92;
        const endZ = jump.z + jump.dirZ * jump.speed * jump.duration * 0.92;
        splash(endX, endZ, jump.start + 0.92 * jump.duration, 0.24, jump.dirX, jump.dirZ);
      }
    });
    target.visible = any;
    if (any) target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[JUMPER_GEOMETRY, undefined, JUMPERS]}
      frustumCulled={false}
      castShadow={false}
      raycast={() => null}
      visible={false}
    >
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.15} flatShading />
    </instancedMesh>
  );
}
