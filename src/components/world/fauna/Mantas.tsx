'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RAY_ZONES, type DeepZone } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, shortestAngle, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { MeshBuilder, tone, type Vec3 } from './geometry';
import { creatureMaterial, crossed, demoHas, faunaClock, revealScaleAt, steerAwayFromIslands } from './shared';
import { splash } from './Splashes';

/**
 * RAIES MANTA — elles planent à mi-eau dans les couloirs profonds : de lents battements
 * d'ailes (une onde qui court de l'épaule à la pointe), un virage incliné de temps en temps,
 * parfois une remontée où les pointes des ailes fendent la surface. Très rarement, l'une
 * d'elles saute hors de l'eau, fait un salto et retombe à plat dans une grande gerbe.
 * Modèle procédural (dessus bleu nuit à chevrons blancs, ventre blanc), un seul draw call.
 */

const HALF_SPAN = 1.8;

function mantaGeometry() {
  const builder = new MeshBuilder(['aSpan']);
  const spans = [0, 0.16, 0.36, 0.56, 0.76, 0.9, 1];
  const chords = [0, 0.3, 0.62, 1];
  const lead = (s: number) => 0.58 - 0.82 * s ** 1.25;
  const trail = (s: number) => -0.62 + 0.4 * s ** 1.6;
  const thick = (s: number, c: number) => 0.17 * (1 - s * s) * Math.sin(Math.PI * c) ** 0.7 + 0.008;
  const point = (s: number, c: number, side: number, top: boolean): Vec3 => {
    const x = lead(s) + (trail(s) - lead(s)) * c;
    const t = thick(s, c);
    return [x, top ? t : -t * 0.55, s * HALF_SPAN * side];
  };
  for (const side of [1, -1]) {
    for (let i = 0; i < spans.length - 1; i++) {
      for (let j = 0; j < chords.length - 1; j++) {
        const s0 = spans[i];
        const s1 = spans[i + 1];
        const c0 = chords[j];
        const c1 = chords[j + 1];
        // Dessus : bleu nuit, chevrons blancs sur les épaules, bord d'attaque un peu plus clair.
        let top = tone(j === 1 ? '#2b3854' : '#243049');
        if ((i === 1 || i === 2) && j === 0) top = tone('#d3dbe2');
        if (i === 3 && j === 0) top = tone('#8c99ad');
        // Dessous : blanc, liseré sombre au bord de fuite des ailes.
        const bottom = tone(j === 2 && i >= 3 ? '#4d5a72' : '#e9eef0');
        const corners = (topSide: boolean) => [
          point(s0, c0, side, topSide), point(s1, c0, side, topSide),
          point(s1, c1, side, topSide), point(s0, c1, side, topSide),
        ] as const;
        const [a, b, c, d] = corners(true);
        builder.facing(a, b, c, top, 0, 1, 0).facing(a, c, d, top, 0, 1, 0);
        const [e, f, g, h] = corners(false);
        builder.facing(e, f, g, bottom, 0, -1, 0).facing(e, g, h, bottom, 0, -1, 0);
      }
    }
    // Nageoires céphaliques : les deux « cornes » enroulées à l'avant.
    builder.sheet([0.56, 0.03, 0.17 * side], [0.5, 0.0, 0.31 * side], [0.82, -0.07, 0.25 * side], tone('#1e2840'));
  }
  // Queue en fouet.
  builder.sheet([-0.58, 0.03, 0.04], [-0.58, 0.03, -0.04], [-1.95, 0.0, 0], tone('#1e2840'));
  const geometry = builder.build();
  // Envergure relative de chaque sommet (0 au corps, 1 à la pointe) : pilote l'onde des ailes.
  const positions = geometry.getAttribute('position');
  const span = geometry.getAttribute('aSpan');
  for (let index = 0; index < positions.count; index++) {
    span.setX(index, Math.min(1, Math.abs(positions.getZ(index)) / HALF_SPAN));
  }
  return geometry;
}

const RAYS_MAX = 6;
const flapData = new Float32Array(RAYS_MAX * 4);

function rayGeometry() {
  const geometry = mantaGeometry();
  geometry.setAttribute('aFlap', new InstancedBufferAttribute(flapData, 4).setUsage(DynamicDrawUsage));
  return geometry;
}

const MANTA_GEOMETRY = rayGeometry();
const MANTA_MATERIAL = creatureMaterial(
  'fauna-manta-v1',
  {},
  `attribute float aSpan;
attribute vec4 aFlap;`,
  `vec3 transformed = vec3(position);
// Onde d'aile : elle part de l'épaule et court jusqu'à la pointe, qui s'enroule un peu.
float mantaWave = sin(aFlap.x - aSpan * 1.5);
transformed.y += mantaWave * aFlap.y * 0.62 * pow(aSpan, 1.45);
transformed.x += cos(aFlap.x - aSpan * 1.5) * aFlap.y * 0.12 * aSpan;
// La queue ondule doucement.
float mantaTail = smoothstep(-0.6, -1.95, position.x);
transformed.z += sin(aFlap.x * 0.5 + position.x * 2.0) * mantaTail * 0.16;`,
  { roughness: 0.75 },
);

interface Ray {
  zone: DeepZone;
  x: number;
  z: number;
  heading: number;
  bank: number;
  seed: number;
  phase: number;
  y: number;
  pitch: number;
  roll: number;
  leapStart: number;
  leapFlip: boolean;
  nextLeap: number;
}

const LEAP = 1.5;
const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler(0, 0, 0, 'YZX');
const position = new Vector3();
const scale = new Vector3();
const hidden = new Matrix4().makeScale(0, 0, 0);

export function MantaRays({ mobile }: { mobile: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const zones = useMemo(() => (mobile ? RAY_ZONES.slice(0, 1) : RAY_ZONES), [mobile]);
  const initial = useMemo(() => {
    const list: Ray[] = [];
    zones.forEach((zone) => {
      for (let index = 0; index < (zone.count ?? 1) && list.length < RAYS_MAX; index++) {
        const seed = zone.seed + index * 13.7;
        const angle = hash(seed) * Math.PI * 2;
        list.push({
          zone,
          x: zone.center[0] + Math.cos(angle) * zone.radius * 0.4,
          z: zone.center[1] + Math.sin(angle) * zone.radius * 0.4,
          heading: angle + Math.PI / 2,
          bank: 0,
          seed,
          phase: hash(seed * 3.1) * Math.PI * 2,
          y: -1.2,
          pitch: 0,
          roll: 0,
          leapStart: -100,
          leapFlip: false,
          nextLeap: 40 + hash(seed * 5.3) * 60,
        });
      }
    });
    return list;
  }, [zones]);
  const rays = useRef<Ray[]>([]);
  const memo = useRef({ prev: -1e9 });

  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    if (rays.current.length !== initial.length || rays.current[0]?.zone !== initial[0]?.zone) {
      rays.current = initial.map((ray) => ({ ...ray }));
    }
    const dt = Math.min(delta, 1 / 30);
    const time = faunaClock(state.clock.elapsedTime);
    const waveTime = state.clock.elapsedTime;
    const prev = memo.current.prev;
    memo.current.prev = time;
    const world = useWorld.getState();
    const reach = world.quality === 'high' ? 95 : world.quality === 'medium' ? 75 : 55;
    const demo = demoHas('rays');
    const presence = ecologyState.worldLife * (0.25 + ecologyState.dayLarge * 0.75);
    target.visible = presence > 0.05 && world.reveal > 0.5;
    if (!target.visible) return;

    rays.current.forEach((ray, index) => {
      const camGap = Math.hypot(state.camera.position.x - ray.x, state.camera.position.z - ray.z);
      const reveal = revealScaleAt(ray.x, ray.z, hash(ray.seed) * 2.4);
      if (reveal < 0.01 || camGap > reach) {
        target.setMatrixAt(index, hidden);
        return;
      }
      const { zone } = ray;
      // Errance lente : cap sinusoïdal, rappel vers la zone, évitement des côtes.
      const homeX = zone.center[0] - ray.x;
      const homeZ = zone.center[1] - ray.z;
      const home = Math.hypot(homeX, homeZ);
      let desired = ray.heading + Math.sin(time * 0.11 + ray.seed) * 0.5;
      if (home > zone.radius * 0.7) {
        desired += shortestAngle(desired, Math.atan2(homeZ, homeX)) * clamp((home - zone.radius * 0.7) / 8, 0, 1);
      }
      desired += steerAwayFromIslands(ray.x, ray.z, desired, 10) * 1.5;
      const turn = clamp(shortestAngle(ray.heading, desired), -0.42 * dt, 0.42 * dt);
      const u = time - ray.leapStart;
      const leaping = u >= 0 && u < LEAP;
      if (!leaping) ray.heading += turn;
      const speed = leaping ? 3.2 : 1.45;
      ray.x += Math.cos(ray.heading) * speed * dt;
      ray.z += Math.sin(ray.heading) * speed * dt;
      // Battement lent (≈ 3 s), plus vif en l'air.
      ray.phase += dt * (leaping ? 7.5 : 2.1);
      ray.bank = damp(ray.bank, -turn / Math.max(dt, 1e-4) * 0.9, 1.5, dt);

      const surface = waveHeight(ray.x, ray.z, waveTime);
      // Parfois elle remonte planer juste sous la surface : les pointes fendent l'eau.
      const glide = smoothstep(0.7, 0.95, Math.sin(time * 0.045 + ray.seed * 2.1));
      let y = surface - 1.25 + Math.sin(time * 0.13 + ray.seed) * 0.22 + glide * 0.82;
      let pitch = Math.sin(time * 0.13 + ray.seed + 0.6) * 0.06;
      let roll = clamp(ray.bank, -0.45, 0.45);

      // Saut rare (de jour, près du bateau) : salto avant une fois sur deux, retombée à plat.
      const boatGap = Math.hypot(boatState.position.x - ray.x, boatState.position.z - ray.z);
      if (!leaping && time > ray.nextLeap && (demo || (boatGap < 48 && ecologyState.dayLarge > 0.5))) {
        ray.leapStart = time;
        ray.leapFlip = hash(ray.seed + time * 0.37) > 0.5;
        ray.nextLeap = time + (demo ? 5 : 70 + hash(ray.seed * 7.7 + time) * 70);
      }
      if (leaping) {
        const k = u / LEAP;
        y = surface - 1.0 + 3.0 * 4 * k * (1 - k);
        pitch = Math.atan2(3.0 * (4 - 8 * k) / LEAP, 3.2) * 0.8;
        if (ray.leapFlip) pitch += Math.PI * 2 * smoothstep(0.22, 0.78, k);
        roll *= 0.3;
        const exit = 0.097;
        const entry = 0.903;
        const prevK = (prev - ray.leapStart) / LEAP;
        if (crossed(prevK, k, exit)) splash(ray.x, ray.z, ray.leapStart + exit * LEAP, 0.75);
        if (crossed(prevK, k, entry)) splash(ray.x, ray.z, ray.leapStart + entry * LEAP, 1.5);
      }
      ray.y = y;
      ray.pitch = leaping ? pitch : damp(ray.pitch, pitch, 3, dt);
      ray.roll = damp(ray.roll, roll, 3, dt);

      position.set(ray.x, ray.y, ray.z);
      euler.set(ray.roll, -ray.heading, ray.pitch, 'YZX');
      quaternion.setFromEuler(euler);
      scale.setScalar(reveal * (1 + hash(ray.seed * 9.1) * 0.2));
      matrix.compose(position, quaternion, scale);
      target.setMatrixAt(index, matrix);
      flapData[index * 4] = ray.phase;
      flapData[index * 4 + 1] = leaping ? 1.25 : 0.85 + glide * 0.2;
    });
    target.count = rays.current.length;
    target.instanceMatrix.needsUpdate = true;
    MANTA_GEOMETRY.getAttribute('aFlap').needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[MANTA_GEOMETRY, MANTA_MATERIAL, RAYS_MAX]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  );
}
