'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useHandFont } from '@/components/islands/kit';
import { yellowStatic } from '@/data/yellow-static';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { merge, part } from './geo';
import { TRAIL } from './layout';
import { crackle } from './static-audio';
import { flicker } from './signal';
import { labelTexture, tapeTexture } from './textures';

/**
 * Les traces : de l'étoile d'or au large de l'île PROJETS jusqu'au ponton de l'île
 * secrète, une piste d'indices jaunes flotte sur l'eau. Des bouts de ruban de chantier,
 * une cassette VHS, une bouée jaune (marque spéciale, feu jaune à éclats) et quelques
 * pixels de « static » qui grésillent au-dessus de la houle. Le bateau les bouscule ;
 * avec le son, ils crépitent quand on passe tout près.
 */

interface Floater {
  x: number;
  z: number;
  dx: number;
  dz: number;
  vx: number;
  vz: number;
  yaw: number;
  radius: number;
  cooldown: number;
}

function floater(at: [number, number], radius: number, seed: number): Floater {
  return { x: at[0], z: at[1], dx: 0, dz: 0, vx: 0, vz: 0, yaw: hash(seed) * Math.PI * 2, radius, cooldown: 0 };
}

/** État hors React (comme les objets flottants du port). */
const floaters = {
  buoy: floater(TRAIL.buoy, 0.9, 1),
  cassette: floater(TRAIL.cassette, 0.8, 2),
  tapes: TRAIL.tapes.map((at, index) => floater(at, 1.1, index + 3)),
};
const all = [floaters.buoy, floaters.cassette, ...floaters.tapes];

/** Le bateau pousse les indices, qui reviennent lentement à leur place. */
function nudge(item: Floater, dt: number, time: number, kind: number) {
  const ox = item.x + item.dx - boatState.position.x;
  const oz = item.z + item.dz - boatState.position.z;
  const distance = Math.hypot(ox, oz) || 0.001;
  const reach = 2.1 + item.radius;
  if (distance < reach) {
    const push = (reach - distance) * 6;
    item.vx += (ox / distance) * push * dt + Math.cos(boatState.heading) * boatState.speed * 0.08 * dt * 10;
    item.vz += (oz / distance) * push * dt + Math.sin(boatState.heading) * boatState.speed * 0.08 * dt * 10;
  }
  if (distance < 7 && item.cooldown <= 0 && boatState.speed > 0.5) {
    item.cooldown = 5 + hash(time + kind) * 3;
    crackle(1 - distance / 7);
  }
  item.cooldown = Math.max(0, item.cooldown - dt);
  item.vx += -item.dx * 0.6 * dt;
  item.vz += -item.dz * 0.6 * dt;
  const damping = Math.exp(-1.4 * dt);
  item.vx *= damping;
  item.vz *= damping;
  item.dx += item.vx * dt;
  item.dz += item.vz * dt;
}

const UP = new Vector3(0, 1, 0);
const tilt = new Quaternion();
const turn = new Quaternion();
const normal = new Vector3();
const dummy = new Object3D();

/** Pose sur la vague : hauteur et inclinaison de la houle au point (x, z). */
function float(target: Object3D, x: number, z: number, time: number, lift: number, yaw: number, wobble = 1) {
  const wave = waveHeight(x, z, time);
  const sx = waveHeight(x + 0.7, z, time) - waveHeight(x - 0.7, z, time);
  const sz = waveHeight(x, z + 0.7, time) - waveHeight(x, z - 0.7, time);
  tilt.setFromUnitVectors(UP, normal.set(-sx * wobble, 1, -sz * wobble).normalize());
  target.quaternion.copy(tilt).multiply(turn.setFromAxisAngle(UP, yaw));
  target.position.set(x, wave + lift, z);
}

/* ------------------------------------------------------------------ ruban */

function ribbonGeometry() {
  const segments = 18;
  const length = 2.6;
  const width = 0.26;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const x = (t - 0.5) * length;
    const curl = Math.sin(t * Math.PI * 2.2) * 0.32;
    const y = Math.sin(t * Math.PI * 3.1) * 0.03;
    const twist = Math.sin(t * Math.PI * 1.6) * 0.5;
    positions.push(x, y + Math.sin(twist) * width * 0.5, curl + Math.cos(twist) * width * 0.5);
    positions.push(x, y - Math.sin(twist) * width * 0.5, curl - Math.cos(twist) * width * 0.5);
    uvs.push((t * length) / 0.6, 1, (t * length) / 0.6, 0);
    if (index > 0) {
      const base = index * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ----------------------------------------------------------------- bouée */

function buoyGeometry() {
  const yellow = '#f0c42a';
  return merge([
    part(new CylinderGeometry(0.42, 0.66, 1.25, 14), yellow, { at: [0, 0.35, 0] }),
    part(new CylinderGeometry(0.7, 0.7, 0.14, 14), '#d9ab1d', { at: [0, -0.22, 0] }),
    part(new CylinderGeometry(0.05, 0.05, 0.7, 6), '#5d5f60', { at: [0, 1.3, 0] }),
    // Voyant en X : la marque spéciale jaune des cartes marines.
    part(new BoxGeometry(0.62, 0.1, 0.1), yellow, { at: [0, 1.62, 0], rot: [0, 0, Math.PI / 4] }),
    part(new BoxGeometry(0.62, 0.1, 0.1), yellow, { at: [0, 1.62, 0], rot: [0, 0, -Math.PI / 4] }),
    part(new CylinderGeometry(0.43, 0.43, 0.06, 14), '#2d2f30', { at: [0, 0.02, 0] }),
  ]);
}

/* -------------------------------------------------------------- cassette */

function cassetteGeometry() {
  return merge([
    part(new BoxGeometry(1.16, 0.16, 0.66), '#1c1c1f', { at: [0, 0.08, 0] }),
    part(new BoxGeometry(0.62, 0.02, 0.2), '#3d4044', { at: [0, 0.165, -0.17] }),
    part(new CylinderGeometry(0.1, 0.1, 0.022, 12), '#cfcfc8', { at: [-0.18, 0.168, -0.17] }),
    part(new CylinderGeometry(0.1, 0.1, 0.022, 12), '#cfcfc8', { at: [0.18, 0.168, -0.17] }),
  ]);
}

/* -------------------------------------------------------------- grésillements */

const SPARK_VERTEX = /* glsl */ `
attribute vec4 aSpark;
uniform float uTime;
varying vec2 vUv;
varying float vOn;
varying vec3 vTint;
float sh(float n) { return fract(sin(n * 78.233) * 43758.5453); }
void main() {
  vUv = uv;
  float seed = aSpark.w;
  float tick = floor(uTime * (6.0 + sh(seed) * 8.0) + seed * 13.0);
  vOn = step(0.62, sh(tick + seed * 3.1));
  vTint = sh(seed * 1.7) > 0.7 ? vec3(1.0) : sh(seed * 2.3) > 0.5 ? vec3(1.0, 0.85, 0.25) : vec3(0.95, 0.9, 0.55);
  vec3 center = aSpark.xyz + vec3(0.0, sin(uTime * 0.9 + seed * 6.0) * 0.12, 0.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.14 + sh(seed * 4.9) * 0.2;
  vec3 world = center + (right * position.x * 1.6 + up * position.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const SPARK_FRAGMENT = /* glsl */ `
uniform float uNight;
varying vec2 vUv;
varying float vOn;
varying vec3 vTint;
void main() {
  if (vOn < 0.5) discard;
  vec2 q = abs(vUv - 0.5) * 2.0;
  float pixel = 1.0 - smoothstep(0.7, 1.0, max(q.x, q.y));
  gl_FragColor = vec4(vTint * pixel * (0.9 + uNight * 1.6), 1.0);
}
`;

const sparkUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };

function sparkGeometry() {
  const count = 30;
  const geometry = new PlaneGeometry(1, 1);
  const data = new Float32Array(count * 4);
  const path = TRAIL.path;
  for (let index = 0; index < count; index++) {
    const t = hash(index * 3.3) * (path.length - 1);
    const segment = Math.min(path.length - 2, Math.floor(t));
    const f = t - segment;
    const [ax, az] = path[segment];
    const [bx, bz] = path[segment + 1];
    data.set([
      ax + (bx - ax) * f + (hash(index * 5.1) - 0.5) * 3,
      0.45 + hash(index * 7.7) * 1.1,
      az + (bz - az) * f + (hash(index * 9.3) - 0.5) * 3,
      index + 0.5,
    ], index * 4);
  }
  geometry.setAttribute('aSpark', new InstancedBufferAttribute(data, 4));
  return { geometry, count };
}

/* ---------------------------------------------------------------- composant */

const BUOY_LIGHT = new Color('#ffd23a');

let kit: {
  ribbon: BufferGeometry;
  buoy: BufferGeometry;
  cassette: BufferGeometry;
  painted: MeshStandardMaterial;
  tape: MeshStandardMaterial;
  sparks: { geometry: BufferGeometry; count: number };
  sparkMaterial: ShaderMaterial;
} | null = null;

function traceKit() {
  kit ??= {
    ribbon: ribbonGeometry(),
    buoy: buoyGeometry(),
    cassette: cassetteGeometry(),
    painted: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    tape: new MeshStandardMaterial({ map: tapeTexture(), side: DoubleSide, roughness: 0.55 }),
    sparks: sparkGeometry(),
    sparkMaterial: new ShaderMaterial({
      uniforms: sparkUniforms,
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
  };
  return kit;
}

function CassetteLabel() {
  const family = useHandFont();
  const texture = useMemo(() => (family ? labelTexture(yellowStatic.title, family) : null), [family]);
  if (!texture) return null;
  return (
    <mesh position={[0.02, 0.175, 0.13]} rotation-x={-Math.PI / 2} raycast={() => null}>
      <planeGeometry args={[0.98, 0.31]} />
      <meshStandardMaterial map={texture} roughness={0.8} />
    </mesh>
  );
}

export function Traces() {
  const root = useRef<Group>(null);
  const buoy = useRef<Group>(null);
  const cassette = useRef<Group>(null);
  const tapes = useRef<InstancedMesh>(null);
  const lamp = useRef<MeshBasicMaterial>(null);
  const halo = useRef<Mesh>(null);
  const parts = useMemo(() => traceKit(), []);

  useLayoutEffect(() => {
    if (tapes.current) tapes.current.frustumCulled = false;
  }, []);

  useEffect(() => () => {
    for (const item of all) {
      item.dx = item.dz = item.vx = item.vz = 0;
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    const visible = phase === 'playing' || phase === 'docked';
    if (root.current) root.current.visible = visible;
    if (!visible) return;
    sparkUniforms.uTime.value = time * (flicker.motion ? 1 : 0.05);
    sparkUniforms.uNight.value = skyState.dayNight;

    all.forEach((item, index) => nudge(item, dt, time, index));

    const b = floaters.buoy;
    if (buoy.current) float(buoy.current, b.x + b.dx, b.z + b.dz, time, -0.28, b.yaw + Math.sin(time * 0.3) * 0.2, 1.4);
    // Feu de la marque spéciale : un éclat jaune toutes les 4 secondes.
    const flash = (time % 4) < 0.55 ? 1 : 0;
    const night = skyState.dayNight;
    if (lamp.current) lamp.current.color.copy(BUOY_LIGHT).multiplyScalar(0.35 + flash * (0.8 + night * 1.6));
    if (halo.current) halo.current.scale.setScalar(flash * (0.8 + night * 2.2) + 0.001);

    const c = floaters.cassette;
    c.yaw += dt * 0.05;
    if (cassette.current) float(cassette.current, c.x + c.dx, c.z + c.dz, time, -0.04, c.yaw, 0.8);

    const mesh = tapes.current;
    if (mesh) {
      floaters.tapes.forEach((tape, index) => {
        tape.yaw += dt * (0.03 + (index % 3) * 0.015) * (index % 2 ? 1 : -1);
        float(dummy, tape.x + tape.dx, tape.z + tape.dz, time, 0.03, tape.yaw, 0.6);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={buoy}>
        <mesh geometry={parts.buoy} material={parts.painted} castShadow raycast={() => null} />
        <mesh position={[0, 1.95, 0]} raycast={() => null}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshBasicMaterial ref={lamp} color="#ffd23a" toneMapped={false} />
        </mesh>
        <mesh ref={halo} position={[0, 1.95, 0]} raycast={() => null} renderOrder={9}>
          <sphereGeometry args={[0.5, 12, 8]} />
          <meshBasicMaterial color="#ffcf40" transparent opacity={0.22} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      <group ref={cassette}>
        <mesh geometry={parts.cassette} material={parts.painted} castShadow raycast={() => null} />
        <CassetteLabel />
      </group>
      <instancedMesh ref={tapes} args={[parts.ribbon, parts.tape, floaters.tapes.length]} castShadow raycast={() => null} />
      <instancedMesh
        args={[parts.sparks.geometry, parts.sparkMaterial, parts.sparks.count]}
        frustumCulled={false}
        renderOrder={9}
        raycast={() => null}
      />
    </group>
  );
}
