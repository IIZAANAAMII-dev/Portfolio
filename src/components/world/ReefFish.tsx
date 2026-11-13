'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  Vector2,
} from 'three';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';

/**
 * Poissons de récif : des bancs colorés qui tournent dans les lagons autour de chaque île,
 * visibles à travers l'eau claire. Tout le mouvement est calculé sur le GPU (orbite du
 * banc, ondulation de la queue, fuite devant le bateau) : un seul draw call pour près de
 * deux cents poissons, aucune donnée réécrite par image.
 */

const PALETTE = ['#ffd23f', '#ff8a3d', '#3fa7ff', '#ff6f9c', '#3fe0c5', '#b38cff'];

/** Petit poisson : corps en losange, queue en V, ventre plus clair. Avant = +X. */
function fishGeometry() {
  const positions: number[] = [];
  const shades: number[] = [];
  const tri = (a: number[], b: number[], c: number[], shade: number[]) => {
    positions.push(...a, ...b, ...c);
    shades.push(...shade);
  };
  const nose = [0.3, 0, 0];
  const tail = [-0.22, 0, 0];
  const top = [0.02, 0.12, 0];
  const bottom = [0.02, -0.09, 0];
  const left = [0.02, 0, 0.06];
  const right = [0.02, 0, -0.06];
  for (const end of [nose, tail]) {
    tri(end, top, left, [1, 1, 1]);
    tri(end, right, top, [1, 1, 1]);
    tri(end, left, bottom, [1.25, 1.25, 1.25]);
    tri(end, bottom, right, [1.25, 1.25, 1.25]);
  }
  tri([-0.2, 0, 0], [-0.42, 0.13, 0], [-0.42, -0.13, 0], [0.8, 0.8, 0.8]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  // Teinte par sommet (multipliée par la couleur du banc) : ventre clair, queue sombre.
  const shade = new Float32Array(positions.length);
  for (let index = 0; index < positions.length / 3; index++) {
    const s = shades[Math.floor(index / 3) * 3];
    shade.set([s, s, s], index * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(shade, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const SWIM_PARS = /* glsl */ `
attribute vec4 aOrbit;
attribute vec4 aMotion;
uniform float uTime;
uniform vec2 uBoat;
uniform float uPresence;
vec3 fishTurn(vec3 p, float yaw) {
  float c = cos(yaw);
  float s = sin(yaw);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}
`;

const SWIM_NORMAL = /* glsl */ `
float fishAngle = uTime * aMotion.x + aMotion.y;
float fishDir = sign(aMotion.x);
vec2 fishCenter = aOrbit.xy;
float fishRadius = aOrbit.z + sin(uTime * 0.6 + aMotion.y * 3.0) * 0.9;
vec2 fishPos = fishCenter + vec2(cos(fishAngle), sin(fishAngle)) * fishRadius;
vec2 fishTangent = vec2(-sin(fishAngle), cos(fishAngle)) * fishDir;
// Fuite : à l'approche du bateau, le poisson s'écarte et file.
vec2 fishAway = fishPos - uBoat;
float fishGap = length(fishAway);
float fishFear = 1.0 - smoothstep(4.0, 10.0, fishGap);
fishPos += normalize(fishAway + 1e-4) * fishFear * 4.5;
fishTangent = normalize(mix(fishTangent, normalize(fishAway + 1e-4), fishFear * 0.7));
float fishYaw = atan(fishTangent.y, fishTangent.x);
vec3 objectNormal = fishTurn(vec3(normal), fishYaw);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

const SWIM_POSITION = /* glsl */ `
vec3 fishLocal = position;
// Ondulation : la queue (x < 0) bat de plus en plus fort vers l'arrière, plus vite en fuite.
float fishWiggle = sin(uTime * aMotion.z * (1.0 + fishFear * 1.5) + aMotion.y * 7.0) * 0.55;
fishLocal.z += fishWiggle * max(-fishLocal.x, 0.0) * 0.9;
fishLocal *= aMotion.w * uPresence;
vec3 transformed = fishTurn(fishLocal, fishYaw) + vec3(fishPos.x, aOrbit.w + sin(uTime * 1.3 + aMotion.y) * 0.08, fishPos.y);
`;

function createFishMaterial(uniforms: Record<string, { value: unknown }>) {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1, flatShading: true });
  material.name = 'reef-fish';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWIM_PARS}`)
      .replace('#include <beginnormal_vertex>', SWIM_NORMAL)
      .replace('#include <begin_vertex>', SWIM_POSITION);
  };
  material.customProgramCacheKey = () => 'reef-fish-v1';
  return material;
}

const fishUniforms = {
  uTime: { value: 0 },
  uBoat: { value: new Vector2() },
  uPresence: { value: 0 },
};
const FISH_MATERIAL = createFishMaterial(fishUniforms);
const FISH_GEOMETRY = fishGeometry();

/** Deux bancs par île (îlots compris), dans l'anneau du lagon. */
function schools() {
  const spots = [
    { x: homeIsland.position[0], z: homeIsland.position[1], r: homeIsland.radius },
    ...islands.map((island) => ({ x: island.position[0], z: island.position[1], r: island.radius })),
    ...islets.map((islet) => ({ x: islet.position[0], z: islet.position[1], r: islet.radius })),
  ];
  const fish: { orbit: number[]; motion: number[]; color: Color }[] = [];
  spots.forEach((spot, island) => {
    for (let school = 0; school < 2; school++) {
      const key = island * 11.3 + school * 5.7;
      const radius = spot.r + 4.5 + hash(key) * 5;
      const speed = (0.1 + hash(key + 1.1) * 0.08) * (school === 0 ? 1 : -1) * (10 / radius);
      const start = hash(key + 2.2) * Math.PI * 2;
      const color = new Color(PALETTE[Math.floor(hash(key + 3.3) * PALETTE.length)]);
      const count = 9 + Math.floor(hash(key + 4.4) * 6);
      for (let index = 0; index < count; index++) {
        const k = key + index * 1.618;
        fish.push({
          orbit: [spot.x, spot.z, radius + (hash(k) - 0.5) * 2.4, -0.28 - hash(k + 0.7) * 0.35],
          motion: [speed, start + index * 0.09 + hash(k + 1.3) * 0.12, 9 + hash(k + 2.1) * 5, 1.5 + hash(k + 3.9) * 0.6],
          color: color.clone().offsetHSL((hash(k + 4.3) - 0.5) * 0.04, 0, (hash(k + 5.1) - 0.5) * 0.12),
        });
      }
    }
  });
  return fish;
}

export function ReefFish() {
  const fish = useMemo(() => schools(), []);
  const geometry = useMemo(() => {
    const result = FISH_GEOMETRY.clone();
    const orbit = new Float32Array(fish.length * 4);
    const motion = new Float32Array(fish.length * 4);
    fish.forEach((entry, index) => {
      orbit.set(entry.orbit, index * 4);
      motion.set(entry.motion, index * 4);
    });
    result.setAttribute('aOrbit', new InstancedBufferAttribute(orbit, 4));
    result.setAttribute('aMotion', new InstancedBufferAttribute(motion, 4));
    return result;
  }, [fish]);

  useFrame((state) => {
    const { reveal } = useWorld.getState();
    fishUniforms.uTime.value = state.clock.elapsedTime;
    fishUniforms.uBoat.value.set(boatState.position.x, boatState.position.z);
    fishUniforms.uPresence.value = smoothstep(0.45, 1, reveal);
  });

  return (
    <instancedMesh
      args={[geometry, FISH_MATERIAL, fish.length]}
      frustumCulled={false}
      raycast={() => null}
      ref={(mesh) => {
        if (!mesh) return;
        fish.forEach((entry, index) => mesh.setColorAt(index, entry.color));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }}
    />
  );
}
