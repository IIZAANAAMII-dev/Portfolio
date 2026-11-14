'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, ShaderMaterial, type Points } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Bulles partagées par tous les secrets (sous-marin qui plonge, poisson qui replonge,
 * serpent qui sonde, coffre qui s'ouvre…). Un seul nuage de points : le CPU n'écrit que le
 * point de départ de chaque bulle dans un anneau ; la montée en zigzag, l'éclatement à la
 * surface et le fondu sont calculés sur le GPU. Un seul dessin pour tout le monde.
 */

const COUNT = 220;
/** x, y, z de départ et instant d'émission. */
const starts = new Float32Array(COUNT * 4).fill(-1000);
/** Vitesse de montée, taille, graine. */
const params = new Float32Array(COUNT * 3);
let cursor = 0;
let dirty = false;
let clock = 0;

/**
 * Émet `count` bulles autour de (x, y, z), dans un disque de rayon `spread`.
 * Appelable depuis n'importe quel useFrame (aucune allocation).
 */
export function emitBubbles(x: number, y: number, z: number, count: number, spread = 0.6, size = 1) {
  for (let index = 0; index < count; index++) {
    const slot = cursor;
    cursor = (cursor + 1) % COUNT;
    const seed = clock * 7.31 + slot * 1.37;
    const angle = hash(seed) * Math.PI * 2;
    const radius = Math.sqrt(hash(seed + 1.7)) * spread;
    starts[slot * 4] = x + Math.cos(angle) * radius;
    starts[slot * 4 + 1] = y - hash(seed + 2.9) * 0.4;
    starts[slot * 4 + 2] = z + Math.sin(angle) * radius;
    starts[slot * 4 + 3] = clock + hash(seed + 4.1) * 0.25;
    params[slot * 3] = 0.9 + hash(seed + 5.3) * 0.9;
    params[slot * 3 + 1] = (0.13 + hash(seed + 6.7) * 0.2) * size;
    params[slot * 3 + 2] = hash(seed + 8.1) * 10;
  }
  dirty = true;
}

const vertexShader = /* glsl */ `
attribute vec4 aStart;
attribute vec3 aParams;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
varying float vPop;

void main() {
  float age = uTime - aStart.w;
  float rise = aParams.x;
  // Instant où la bulle atteint la surface, puis courte vie à plat (éclatement).
  float travel = max(0.0, (0.05 - aStart.y) / rise);
  float life = travel + 0.45;
  if (age < 0.0 || age > life) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vPop = 0.0;
    return;
  }
  vec3 p = aStart.xyz;
  p.y = min(aStart.y + rise * age + age * age * 0.25, 0.08);
  float wobble = aParams.z;
  p.x += sin(age * 7.0 + wobble) * 0.09 * (0.5 + age);
  p.z += cos(age * 6.0 + wobble * 1.3) * 0.09 * (0.5 + age);
  float surfaced = clamp((age - travel) / 0.45, 0.0, 1.0);
  vPop = surfaced;
  // Les bulles profondes sont voilées par l'eau ; à la surface elles s'élargissent et s'effacent.
  float depthFade = mix(0.28, 1.0, smoothstep(-2.4, 0.0, p.y));
  vAlpha = depthFade * (1.0 - smoothstep(0.35, 1.0, surfaced)) * smoothstep(0.0, 0.12, age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aParams.y * (1.0 + surfaced * 0.9) * uScale / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
varying float vAlpha;
varying float vPop;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // Bulle : liseré clair, cœur transparent, petit reflet ; anneau d'écume quand elle éclate.
  float rim = smoothstep(0.5, 0.43, d) * (0.3 + 0.7 * smoothstep(0.22, 0.44, d));
  float spark = smoothstep(0.13, 0.0, length(c - vec2(-0.14, -0.15)));
  float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.3, 0.42, d);
  float shape = mix(rim + spark, ring, vPop);
  vec3 color = mix(vec3(0.82, 0.96, 1.0), vec3(1.0), spark + vPop * 0.5);
  gl_FragColor = vec4(color, shape * vAlpha * 0.9);
}
`;

export function Bubbles() {
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aStart', new BufferAttribute(starts, 4));
    g.setAttribute('aParams', new BufferAttribute(params, 3));
    return g;
  }, []);

  useFrame((state) => {
    clock = state.clock.elapsedTime;
    const target = points.current;
    if (!target) return;
    const material = target.material as ShaderMaterial;
    material.uniforms.uTime.value = clock;
    // Taille en pixels : hauteur du rendu × focale (projection[5]) / 2.
    material.uniforms.uScale.value = state.size.height * state.viewport.dpr * state.camera.projectionMatrix.elements[5] * 0.5;
    if (dirty) {
      dirty = false;
      const g = target.geometry;
      g.getAttribute('aStart').needsUpdate = true;
      g.getAttribute('aParams').needsUpdate = true;
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={4} raycast={() => null}>
      <shaderMaterial
        uniforms={{ uTime: { value: 0 }, uScale: { value: 800 } }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
