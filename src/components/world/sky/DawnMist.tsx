'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type Mesh,
} from 'three';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';
import { cameraFocus, seeded } from './sky-layer';

/**
 * Bancs de brume du petit matin : de longues nappes peintes, posées au ras de l'eau, qui
 * dérivent avec la brise et se dissipent quand le soleil monte (lever ≈ 0,25 → disparues
 * vers 0,33). Elles s'écartent de l'île de l'escale et du bateau : jamais rien de voilé
 * de ce que l'on regarde. Un seul appel de dessin, seulement à l'aube.
 *
 * Les bancs sont fixes dans le monde mais répartis en tuile autour du point visé : en
 * naviguant, on les traverse, et ceux qui sortent du cadre reviennent de l'autre côté.
 */
const SPAN = 220;
const MIST_LIT = new Color('#ffe3d4');
const MIST_SHADE = new Color('#c9c4e6');

const vertexShader = /* glsl */ `
uniform vec3 uFocus;
uniform float uTime;
uniform vec2 uDrift;
uniform float uMist;
attribute vec4 aBank;
attribute vec3 aShape;
varying vec2 vUv;
varying vec3 vWorld;
varying float vEdge;
varying float vSeed;

void main() {
  float span = ${SPAN.toFixed(1)};
  vec2 base = aBank.xy + uDrift * uTime;
  vec2 rel = mod(base - uFocus.xz + span * 0.5, span) - span * 0.5;
  vEdge = 1.0 - smoothstep(span * 0.34, span * 0.5, max(abs(rel.x), abs(rel.y)));
  vec2 local = position.xy * 2.0 * aShape.xy;
  float c = cos(aShape.z);
  float s = sin(aShape.z);
  vec2 turned = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  // En se dissipant, la nappe s'élève un peu.
  vec3 world = vec3(uFocus.x + rel.x + turned.x, aBank.w + (1.0 - uMist) * 1.4, uFocus.z + rel.y + turned.y);
  vUv = position.xy * 2.0;
  vWorld = world;
  vSeed = aBank.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uMist;
uniform float uTime;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec4 uAvoid;
uniform vec3 uBoat;
varying vec2 vUv;
varying vec3 vWorld;
varying float vEdge;
varying float vSeed;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

void main() {
  vec2 flow = vec2(uTime * 0.025, 0.0);
  float n = valueNoise(vUv * vec2(2.4, 1.6) + vSeed * 13.0 + flow) * 0.62
    + valueNoise(vUv * vec2(5.5, 3.5) + vSeed * 7.0 - flow * 1.6) * 0.38;
  float body = 1.0 - smoothstep(0.38, 1.0, length(vUv) + (n - 0.5) * 0.6);
  // Deux tons peints : un cœur plus dense et plus clair, une frange lavande.
  float core = smoothstep(0.5, 0.72, body);
  vec3 color = mix(uShade, uLit, 0.35 + core * 0.65);
  float avoid = smoothstep(uAvoid.z, uAvoid.z + uAvoid.w, distance(vWorld.xz, uAvoid.xy));
  float boat = smoothstep(4.0, 12.0, distance(vWorld.xz, uBoat.xz));
  float alpha = body * (0.36 + core * 0.2) * uMist * vEdge * avoid * boat;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const uniforms = {
  uFocus: { value: new Vector3() },
  uTime: { value: 0 },
  uDrift: { value: new Vector2(0.55, 0.18) },
  uMist: { value: 0 },
  uLit: { value: MIST_LIT },
  uShade: { value: MIST_SHADE },
  uAvoid: { value: new Vector4(0, 0, -100, 1) },
  uBoat: { value: new Vector3() },
};

function buildBanks(count: number) {
  const geometry = new InstancedBufferGeometry();
  const plane = new PlaneGeometry(1, 1);
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  const banks = new Float32Array(count * 4);
  const shapes = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Deux étages : nappes basses étendues, voiles plus hauts et plus petits.
    const high = i % 3 === 2;
    banks.set([
      (seeded(i * 2.31 + 0.4) - 0.5) * SPAN,
      (seeded(i * 3.77 + 1.9) - 0.5) * SPAN,
      seeded(i * 5.13 + 2.6),
      high ? 2.6 + seeded(i * 1.3) * 0.8 : 0.9 + seeded(i * 1.9) * 0.5,
    ], i * 4);
    shapes.set([
      (high ? 14 : 22) + seeded(i * 7.7) * 16,
      (high ? 5 : 8) + seeded(i * 8.3) * 5,
      0.25 + (seeded(i * 9.1) - 0.5) * 0.7,
    ], i * 3);
  }
  geometry.setAttribute('aBank', new InstancedBufferAttribute(banks, 4));
  geometry.setAttribute('aShape', new InstancedBufferAttribute(shapes, 3));
  geometry.instanceCount = count;
  return geometry;
}

/** Présence de la brume : à l'aube seulement, dissipée quand le soleil monte. */
function dawnMist() {
  const elevation = skyState.sunElevation;
  const morning = smoothstep(0.0, 0.3, Math.cos(skyState.sunAngle));
  return smoothstep(-0.22, -0.02, elevation) * (1 - smoothstep(0.2, 0.5, elevation)) * morning;
}

export function DawnMist() {
  const quality = useWorld((state) => state.quality);
  const mesh = useRef<Mesh>(null);
  const count = quality === 'high' ? 34 : quality === 'medium' ? 24 : 14;
  const geometry = useMemo(() => buildBanks(count), [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const { reveal, phase, activeIsland, reducedMotion } = useWorld.getState();
    const mist = dawnMist() * smoothstep(0.85, 1, reveal) * (1 - ecologyState.stormCover);
    uniforms.uMist.value = mist;
    if (mesh.current) mesh.current.visible = mist > 0.004;
    if (mist <= 0.004) return;
    if (!reducedMotion) uniforms.uTime.value = state.clock.elapsedTime;
    cameraFocus(state.camera, uniforms.uFocus.value);
    uniforms.uBoat.value.copy(boatState.position);
    const island = phase === 'docked' && activeIsland ? islandById[activeIsland] : null;
    if (island) uniforms.uAvoid.value.set(island.position[0], island.position[1], island.radius * 1.05, 14);
    else uniforms.uAvoid.value.set(0, 0, -100, 1);
  });

  return (
    <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} raycast={() => null} />
  );
}
