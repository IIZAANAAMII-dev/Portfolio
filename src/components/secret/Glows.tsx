'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial } from 'three';
import { skyState } from '@/lib/sky';

/**
 * Halos des petites lumières de l'île (diodes REC, caméras, antenne, néons…) : des
 * billboards additifs, tous dans une seule InstancedMesh. Chaque décor écrit son emplacement
 * (repère du site) et sa couleur dans `glow` pendant son useFrame ; ce composant les affiche.
 * Discrets le jour, ils portent la nuit : on lit l'île de loin à ses points rouges et jaunes.
 */

export const GLOW = {
  rec: 0,
  scanner: 1,
  camera: 2,
  antenna: 5,
  generator: 6,
  lamp: 7,
  stand: 8,
  window: 10,
  screens: 11,
  flashlight: 12,
  console: 13,
  sensor: 14,
} as const;

const CAPACITY = 16;

interface Slot {
  x: number;
  y: number;
  z: number;
  size: number;
  color: Color;
  /** Intensité (0 → éteint). */
  power: number;
  /** Part qui reste visible en plein jour (0 → seulement la nuit). */
  day: number;
}

export const glow: Slot[] = Array.from({ length: CAPACITY }, () => ({
  x: 0,
  y: 0,
  z: 0,
  size: 0,
  color: new Color(),
  power: 0,
  day: 0.35,
}));

export function setGlow(index: number, x: number, y: number, z: number, size: number, hex: Color, power: number, day = 0.35) {
  const slot = glow[index];
  slot.x = x;
  slot.y = y;
  slot.z = z;
  slot.size = size;
  slot.color.copy(hex);
  slot.power = power;
  slot.day = day;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = instanceColor;
  vec4 center = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = length(instanceMatrix[0].xyz) * length(modelMatrix[0].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = center.xyz + (right * position.x + up * position.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = pow(max(0.0, 1.0 - d), 2.4);
  float spark = pow(max(0.0, 1.0 - d * 3.2), 2.0) * 1.6;
  gl_FragColor = vec4(vColor * (core + spark), 1.0);
}
`;

let material: ShaderMaterial | null = null;

function glowMaterial() {
  material ??= new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return material;
}

const matrix = new Matrix4();
const tint = new Color();

export function Glows() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const shader = useMemo(() => glowMaterial(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    target.instanceColor = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
    target.frustumCulled = false;
  }, []);

  useFrame(() => {
    const target = mesh.current;
    if (!target?.instanceColor) return;
    const night = skyState.dayNight;
    for (let index = 0; index < CAPACITY; index++) {
      const slot = glow[index];
      const strength = slot.power * (slot.day + (1 - slot.day) * night);
      const size = strength > 0.003 ? slot.size : 0;
      matrix.makeScale(size, size, size).setPosition(slot.x, slot.y, slot.z);
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, tint.copy(slot.color).multiplyScalar(strength));
    }
    target.instanceMatrix.needsUpdate = true;
    target.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, shader, CAPACITY]} renderOrder={9} raycast={() => null} />;
}
