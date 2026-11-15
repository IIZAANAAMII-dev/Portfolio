'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';
import { SEA_MIRROR, seeded } from './sky-layer';
import { SQUALL_BASE, SQUALL_RADIUS, squall } from './weather';

/**
 * Le grain : un cumulus sombre à base plate (bouffées low-poly, cel-shading du monde), un
 * rideau de pluie qui tombe en biais sous lui, des ronds dans l'eau et son ombre sur la mer.
 * Quatre appels de dessin au plus, seulement pendant son passage ; pas de pluie ni de ronds
 * en qualité basse ou en mouvements réduits.
 */
const PUFFS: [number, number, number, number][] = [
  [-7.2, 1.6, 0.6, 3.6], [-3.6, 2.2, -1.4, 4.4], [0.4, 2.0, 0.9, 4.8], [4.4, 1.9, -0.8, 4.2], [7.6, 1.5, 0.7, 3.4],
  [-4.2, 5.0, 0.4, 3.8], [0.8, 6.0, -0.5, 4.6], [4.8, 4.8, 0.8, 3.4],
  [-1.0, 8.6, 0.2, 3.4], [2.8, 7.8, 0.9, 2.8],
  [-1.8, 2.4, 3.8, 3.6], [2.2, 2.4, -4.0, 3.4],
];
const CLOUD_BASE = new Color('#4f5976');
const CLOUD_TOP = new Color('#d3d8e6');

function buildCloud() {
  const parts = PUFFS.map(([x, y, z, r]) => {
    const puff = new IcosahedronGeometry(r, 1);
    puff.scale(1, 0.82, 1);
    puff.translate(x, y, z);
    return puff;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  // Base plate (le dessous des cumulus de dessin animé), sombre en bas, clair au sommet.
  const position = merged.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = Math.max(position.getY(i), 0);
    position.setY(i, y);
    color.copy(CLOUD_BASE).lerp(CLOUD_TOP, smoothstep(0.2, 9.5, y));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  merged.setAttribute('color', new BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

const squallUniforms = {
  uCenter: { value: new Vector3() },
  uTime: { value: 0 },
  uRain: { value: 0 },
  uWind: { value: new Vector2() },
  uMirror: { value: SEA_MIRROR },
};
const shadowUniforms = {
  uShadow: { value: new Vector3() },
  uMirror: squallUniforms.uMirror,
};

const rainVertex = /* glsl */ `
uniform vec3 uCenter;
uniform float uTime;
uniform float uRain;
uniform vec2 uWind;
uniform float uMirror;
attribute vec4 aDrop;
varying float vAlong;
varying float vAlpha;

void main() {
  float height = uCenter.y - uMirror;
  float fall = mod(uTime * aDrop.w + aDrop.z * height * 7.0, height);
  vec3 slant = vec3(uWind.x, 0.0, uWind.y) * 0.1;
  vec3 head = vec3(uCenter.x + aDrop.x, uCenter.y - fall, uCenter.z + aDrop.y) + slant * fall;
  vec3 axis = normalize(vec3(0.0, -1.0, 0.0) + slant);
  vec3 side = normalize(cross(axis, normalize(cameraPosition - head)));
  vec3 world = head - axis * position.y * 1.7 + side * position.x * 0.08;
  vAlong = position.y;
  vAlpha = step(fract(aDrop.z * 13.7), uRain) * smoothstep(0.0, 1.6, fall) * (1.0 - smoothstep(height - 0.35, height, fall));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const rainFragment = /* glsl */ `
varying float vAlong;
varying float vAlpha;

void main() {
  float alpha = vAlpha * (1.0 - vAlong) * 0.42;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(0.82, 0.89, 0.96, alpha);
  #include <colorspace_fragment>
}
`;

const rippleVertex = /* glsl */ `
uniform vec3 uCenter;
uniform float uTime;
uniform float uRain;
uniform float uMirror;
attribute vec2 aRipple;
varying vec2 vUv;
varying float vPhase;
varying float vAlpha;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

void main() {
  float cycle = uTime * aRipple.y + aRipple.x * 13.0;
  float id = floor(cycle);
  vPhase = fract(cycle);
  float angle = hash(id * 1.37 + aRipple.x * 91.0) * 6.2832;
  float radius = sqrt(hash(id * 2.11 + aRipple.x * 47.0)) * ${SQUALL_RADIUS.toFixed(1)};
  vec2 center = uCenter.xz + vec2(cos(angle), sin(angle)) * radius;
  vec3 world = vec3(center.x + position.x * 1.5, uMirror - 0.02, center.y + position.y * 1.5);
  vUv = position.xy * 2.0;
  vAlpha = step(aRipple.x, uRain);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const rippleFragment = /* glsl */ `
varying vec2 vUv;
varying float vPhase;
varying float vAlpha;

void main() {
  float d = length(vUv);
  float ring = 1.0 - smoothstep(0.0, 0.09, abs(d - vPhase * 0.92));
  float splash = (1.0 - smoothstep(0.0, 0.16, d)) * (1.0 - smoothstep(0.0, 0.18, vPhase));
  float alpha = (ring * (1.0 - vPhase) * 0.5 + splash * 0.45) * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(0.88, 0.94, 0.98, alpha);
  #include <colorspace_fragment>
}
`;

const shadowVertex = /* glsl */ `
uniform vec3 uShadow;
uniform float uMirror;
varying vec2 vUv;

void main() {
  vUv = position.xy * 2.0;
  vec3 world = vec3(uShadow.x + position.x * 34.0, uMirror - 0.04, uShadow.y + position.y * 26.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const shadowFragment = /* glsl */ `
uniform vec3 uShadow;
varying vec2 vUv;

void main() {
  float alpha = (1.0 - smoothstep(0.3, 1.0, length(vUv))) * 0.26 * uShadow.z;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(0.11, 0.16, 0.24, alpha);
  #include <colorspace_fragment>
}
`;

function instanced(count: number, name: string, size: number, fill: (i: number) => number[]) {
  const geometry = new InstancedBufferGeometry();
  const plane = new PlaneGeometry(1, 1);
  if (name === 'aDrop') plane.translate(0, 0.5, 0);
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  const data = new Float32Array(Math.max(count, 1) * size);
  for (let i = 0; i < count; i++) data.set(fill(i), i * size);
  geometry.setAttribute(name, new InstancedBufferAttribute(data, size));
  geometry.instanceCount = count;
  return geometry;
}

const sun = new Vector3();

export function Squall() {
  const quality = useWorld((state) => state.quality);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const particles = quality !== 'low' && !reducedMotion;
  const drops = quality === 'high' ? 320 : 200;
  const ripples = quality === 'high' ? 70 : 44;
  const group = useRef<Group>(null);
  const rain = useRef<Mesh>(null);
  const rings = useRef<Mesh>(null);
  const shade = useRef<Mesh>(null);

  const cloud = useMemo(
    () => ({
      geometry: buildCloud(),
      material: new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
    }),
    [],
  );
  const rainGeometry = useMemo(
    () =>
      instanced(drops, 'aDrop', 4, (i) => {
        const angle = seeded(i * 1.7) * Math.PI * 2;
        const radius = Math.sqrt(seeded(i * 2.9 + 1.1)) * SQUALL_RADIUS;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius, seeded(i * 4.3 + 2.2), 15 + seeded(i * 5.1) * 6];
      }),
    [drops],
  );
  const rippleGeometry = useMemo(
    () => instanced(ripples, 'aRipple', 2, (i) => [seeded(i * 3.3 + 0.7), 0.7 + seeded(i * 6.1) * 0.6]),
    [ripples],
  );
  const materials = useMemo(() => {
    const base = { transparent: true, depthWrite: false, fog: false };
    return {
      rain: new ShaderMaterial({ ...base, uniforms: squallUniforms, vertexShader: rainVertex, fragmentShader: rainFragment }),
      ripple: new ShaderMaterial({ ...base, uniforms: squallUniforms, vertexShader: rippleVertex, fragmentShader: rippleFragment }),
      shadow: new ShaderMaterial({ ...base, uniforms: shadowUniforms, vertexShader: shadowVertex, fragmentShader: shadowFragment }),
      plane: new PlaneGeometry(1, 1),
    };
  }, []);
  useEffect(() => () => rainGeometry.dispose(), [rainGeometry]);
  useEffect(() => () => rippleGeometry.dispose(), [rippleGeometry]);
  useEffect(() => () => {
    cloud.geometry.dispose();
    cloud.material.dispose();
    materials.rain.dispose();
    materials.ripple.dispose();
    materials.shadow.dispose();
    materials.plane.dispose();
  }, [cloud, materials]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const on = squall.active && squall.presence > 0.01;
    if (group.current) group.current.visible = on;
    if (shade.current) shade.current.visible = on;
    if (rain.current) rain.current.visible = on && particles && squall.rain > 0.01;
    if (rings.current) rings.current.visible = on && particles && squall.rain > 0.01;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const u = squallUniforms;
    u.uCenter.value.set(squall.x, SQUALL_BASE + 0.4, squall.z);
    u.uTime.value = t;
    u.uRain.value = squall.rain;
    u.uWind.value.set(squall.vx, squall.vz);

    // Le nuage se forme et se dissipe en gonflant ses bouffées ; il roule doucement sur lui-même.
    const g = group.current;
    if (g) {
      const grow = 0.3 + 0.7 * squall.presence;
      g.position.set(squall.x, SQUALL_BASE + Math.sin(t * 0.21) * 0.35 + (1 - squall.presence) * 2, squall.z);
      g.scale.set(grow, grow * (0.85 + 0.15 * squall.presence), grow);
      if (!reducedMotion) g.rotation.y += dt * 0.012;
    }

    // Ombre portée sur la mer, décalée à l'opposé du soleil (même direction que la lumière).
    sun.set(Math.cos(skyState.sunAngle) * 80, Math.max(skyState.sunElevation * 70, 10), 40).normalize();
    const lift = (SQUALL_BASE + 3) / Math.max(sun.y, 0.2);
    shadowUniforms.uShadow.value.set(squall.x - sun.x * lift, squall.z - sun.z * lift, squall.presence);
  });

  return (
    <>
      <group ref={group}>
        <mesh geometry={cloud.geometry} material={cloud.material} castShadow raycast={() => null} />
      </group>
      <mesh ref={shade} geometry={materials.plane} material={materials.shadow} frustumCulled={false} renderOrder={3} raycast={() => null} />
      <mesh ref={rings} geometry={rippleGeometry} material={materials.ripple} frustumCulled={false} renderOrder={4} raycast={() => null} />
      <mesh ref={rain} geometry={rainGeometry} material={materials.rain} frustumCulled={false} renderOrder={5} raycast={() => null} />
    </>
  );
}
