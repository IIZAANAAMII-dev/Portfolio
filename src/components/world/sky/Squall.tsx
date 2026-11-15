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
 * Le grain : une tour de cumulus sombre à base plate (bouffées low-poly, cel-shading du
 * monde), un rideau de pluie poussé par le vent qui sort de sous le nuage, un voile gris
 * qui le dessine de loin, des ronds dans l'eau et l'ombre du nuage sur la mer.
 * Cinq appels de dessin au plus, seulement pendant son passage ; ni gouttes ni ronds en
 * qualité basse ou en mouvements réduits (le voile reste).
 */
const PUFFS: [number, number, number, number][] = [
  // Rangée de base, large et plate.
  [-6.4, 1.3, 0.4, 2.7], [-3.4, 1.5, -1.2, 3.1], [-0.2, 1.6, 0.9, 3.3], [3.0, 1.5, -0.7, 3.1], [6.0, 1.2, 0.6, 2.6],
  [-2.0, 1.4, 3.0, 2.6], [2.2, 1.4, -3.2, 2.5], [-4.6, 1.2, -2.6, 2.2], [4.4, 1.2, 2.8, 2.3],
  // Étages : la tour du cumulonimbus.
  [-2.6, 3.9, 0.2, 3.0], [1.0, 4.4, -0.4, 3.4], [4.0, 3.6, 0.5, 2.5],
  [-0.8, 6.6, 0.3, 2.8], [2.0, 6.2, -0.2, 2.4],
  [0.4, 8.6, 0.1, 2.1],
];
const CLOUD_BASE = new Color('#3d4660');
const CLOUD_TOP = new Color('#aab2c6');

function buildCloud() {
  const parts = PUFFS.map(([x, y, z, r]) => {
    const puff = new IcosahedronGeometry(r, 1);
    puff.scale(1, 0.78, 1);
    puff.translate(x, y, z);
    return puff;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  // Base plate (le dessous des cumulus de dessin animé), sombre en bas, plus clair au sommet.
  const position = merged.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = Math.max(position.getY(i), 0);
    position.setY(i, y);
    color.copy(CLOUD_BASE).lerp(CLOUD_TOP, smoothstep(0.3, 9, y));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  merged.setAttribute('color', new BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

const squallUniforms = {
  uCenter: { value: new Vector3() },
  /** Centre de l'averse sur la mer (au pied du rideau penché). */
  uFoot: { value: new Vector2() },
  uSlant: { value: new Vector2() },
  uTime: { value: 0 },
  uRain: { value: 0 },
  uMirror: { value: SEA_MIRROR },
};
const shadowUniforms = {
  uShadow: { value: new Vector3() },
  uMirror: squallUniforms.uMirror,
};

const rainVertex = /* glsl */ `
uniform vec3 uCenter;
uniform vec2 uSlant;
uniform float uTime;
uniform float uRain;
uniform float uMirror;
attribute vec4 aDrop;
varying float vAlong;
varying float vAlpha;

void main() {
  float height = uCenter.y - uMirror;
  float fall = mod(uTime * aDrop.w + aDrop.z * height * 7.0, height);
  vec3 slant = vec3(uSlant.x, 0.0, uSlant.y);
  vec3 head = vec3(uCenter.x + aDrop.x, uCenter.y - fall, uCenter.z + aDrop.y) + slant * fall;
  vec3 axis = normalize(vec3(0.0, -1.0, 0.0) + slant);
  vec3 side = normalize(cross(axis, normalize(cameraPosition - head)));
  vec3 world = head - axis * position.y * 2.3 + side * position.x * 0.1;
  vAlong = position.y;
  vAlpha = step(fract(aDrop.z * 13.7), uRain) * smoothstep(0.0, 1.6, fall) * (1.0 - smoothstep(height - 0.35, height, fall));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const rainFragment = /* glsl */ `
varying float vAlong;
varying float vAlpha;

void main() {
  float alpha = vAlpha * (1.0 - vAlong) * 0.52;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(0.86, 0.91, 0.97, alpha);
  #include <colorspace_fragment>
}
`;

const shaftVertex = /* glsl */ `
uniform vec3 uCenter;
uniform vec2 uSlant;
uniform float uMirror;
varying vec2 vUv;

void main() {
  float fall = uCenter.y - uMirror;
  vec3 top = uCenter;
  vec3 bottom = vec3(uCenter.x + uSlant.x * fall, uMirror, uCenter.z + uSlant.y * fall);
  vec3 axis = normalize(bottom - top);
  vec3 side = normalize(cross(axis, normalize(cameraPosition - mix(top, bottom, 0.5))));
  float t = position.y;
  vec3 world = mix(top, bottom, t) + side * position.x * ${(SQUALL_RADIUS * 2).toFixed(1)} * mix(0.85, 1.15, t);
  vUv = vec2(position.x, t);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const shaftFragment = /* glsl */ `
uniform float uRain;
uniform float uTime;
varying vec2 vUv;

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
  // Voile de pluie : bords doux, stries verticales qui descendent.
  float sides = 1.0 - smoothstep(0.16, 0.5, abs(vUv.x));
  float streaks = 0.5 + 0.5 * valueNoise(vec2(vUv.x * 24.0, vUv.y * 2.5 - uTime * 3.2));
  float alpha = sides * streaks * smoothstep(0.02, 0.22, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y)) * 0.3 * uRain;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(0.64, 0.7, 0.79, alpha);
  #include <colorspace_fragment>
}
`;

const rippleVertex = /* glsl */ `
uniform vec2 uFoot;
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
  float radius = sqrt(hash(id * 2.11 + aRipple.x * 47.0)) * ${(SQUALL_RADIUS * 1.15).toFixed(2)};
  vec2 center = uFoot + vec2(cos(angle), sin(angle)) * radius;
  vec3 world = vec3(center.x + position.x * 1.6, uMirror - 0.02, center.y + position.y * 1.6);
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
  float alpha = (ring * (1.0 - vPhase) * 0.55 + splash * 0.5) * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(0.9, 0.95, 0.99, alpha);
  #include <colorspace_fragment>
}
`;

const shadowVertex = /* glsl */ `
uniform vec3 uShadow;
uniform float uMirror;
varying vec2 vUv;

void main() {
  vUv = position.xy * 2.0;
  vec3 world = vec3(uShadow.x + position.x * 30.0, uMirror - 0.04, uShadow.y + position.y * 24.0);
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

/** Quad de base (y de 0 à 1 si `fromTop`), instancié `count` fois avec l'attribut `name`. */
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
  const drops = quality === 'high' ? 340 : 210;
  const ripples = quality === 'high' ? 72 : 44;
  const group = useRef<Group>(null);
  const rain = useRef<Mesh>(null);
  const rings = useRef<Mesh>(null);
  const veil = useRef<Mesh>(null);
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
    const shaftPlane = new PlaneGeometry(1, 1);
    shaftPlane.translate(0, 0.5, 0);
    return {
      rain: new ShaderMaterial({ ...base, uniforms: squallUniforms, vertexShader: rainVertex, fragmentShader: rainFragment }),
      ripple: new ShaderMaterial({ ...base, uniforms: squallUniforms, vertexShader: rippleVertex, fragmentShader: rippleFragment }),
      shaft: new ShaderMaterial({ ...base, uniforms: squallUniforms, vertexShader: shaftVertex, fragmentShader: shaftFragment }),
      shadow: new ShaderMaterial({ ...base, uniforms: shadowUniforms, vertexShader: shadowVertex, fragmentShader: shadowFragment }),
      plane: new PlaneGeometry(1, 1),
      shaftPlane,
    };
  }, []);
  useEffect(() => () => rainGeometry.dispose(), [rainGeometry]);
  useEffect(() => () => rippleGeometry.dispose(), [rippleGeometry]);
  useEffect(() => () => {
    cloud.geometry.dispose();
    cloud.material.dispose();
    materials.rain.dispose();
    materials.ripple.dispose();
    materials.shaft.dispose();
    materials.shadow.dispose();
    materials.plane.dispose();
    materials.shaftPlane.dispose();
  }, [cloud, materials]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const on = squall.active && squall.presence > 0.01;
    const raining = on && squall.rain > 0.01;
    if (group.current) group.current.visible = on;
    if (shade.current) shade.current.visible = on;
    if (veil.current) veil.current.visible = raining;
    if (rain.current) rain.current.visible = raining && particles;
    if (rings.current) rings.current.visible = raining && particles;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const u = squallUniforms;
    u.uCenter.value.set(squall.x, SQUALL_BASE + 0.4, squall.z);
    u.uSlant.value.set(squall.sx, squall.sz);
    u.uFoot.value.set(squall.x + squall.sx * SQUALL_BASE, squall.z + squall.sz * SQUALL_BASE);
    u.uTime.value = reducedMotion ? 0 : t;
    u.uRain.value = squall.rain;

    // Le nuage se forme et se dissipe en gonflant ses bouffées ; il roule doucement sur lui-même.
    const g = group.current;
    if (g) {
      const grow = 0.3 + 0.7 * squall.presence;
      g.position.set(squall.x, SQUALL_BASE + Math.sin(t * 0.21) * 0.35 + (1 - squall.presence) * 2, squall.z);
      g.scale.set(grow, grow * (0.85 + 0.15 * squall.presence), grow);
      if (!reducedMotion) g.rotation.y += dt * 0.012;
    }

    // Ombre portée sur la mer, à l'opposé du soleil (même direction que la lumière du monde).
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
      <mesh ref={veil} geometry={materials.shaftPlane} material={materials.shaft} frustumCulled={false} renderOrder={5} raycast={() => null} />
      <mesh ref={rain} geometry={rainGeometry} material={materials.rain} frustumCulled={false} renderOrder={5} raycast={() => null} />
    </>
  );
}
