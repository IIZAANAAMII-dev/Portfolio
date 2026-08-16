'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from 'three';
import { REEF_BIOMES } from '@/data/biomes';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

const CHUNK_SIZE = 42;
const CHUNK_RADIUS = 5;

const vertexShader = /* glsl */ `
attribute float aPhase;
attribute float aDensity;
attribute float aQuality;
attribute float aHue;
uniform float uTime;
uniform float uNight;
uniform float uBoatWake;
uniform float uStorm;
uniform float uMonsterWake;
uniform float uQuality;
uniform vec2 uBoatPosition;
uniform vec2 uMonsterFrom;
uniform vec2 uMonsterTo;
varying float vGlow;
varying float vHue;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
  return length(p - (a + ab * t));
}

void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.38 + aPhase) * (0.1 + aDensity * 0.12);
  p.x += sin(uTime * 0.11 + aPhase * 1.7) * 0.12;
  p.z += cos(uTime * 0.09 + aPhase * 1.2) * 0.1;

  float pulse = pow(max(0.0, sin(uTime * (0.72 + aDensity * 0.55) + aPhase)), 6.0);
  float base = uNight * (0.055 + aDensity * 0.16) * (0.7 + pulse * 0.3);
  float boatDistance = length(p.xz - uBoatPosition);
  float stimulated = smoothstep(8.5, 0.0, boatDistance) * uBoatWake;
  float monsterDistance = segmentDistance(p.xz, uMonsterFrom, uMonsterTo);
  float monsterStimulated = smoothstep(11.0, 0.0, monsterDistance) * uMonsterWake;
  float stormVariation = mix(1.0, 0.68 + pulse * 0.42, uStorm);
  float qualityMask = step(aQuality, uQuality);
  vGlow = (base + stimulated * 0.82 + monsterStimulated * 1.2)
    * stormVariation * qualityMask;
  vHue = aHue;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp((1.35 + pulse * 1.5 + stimulated * 2.1 + monsterStimulated * 2.8)
    * (175.0 / max(1.0, -mv.z)), 0.8, 6.5);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
varying float vGlow;
varying float vHue;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float dotShape = smoothstep(0.5, 0.04, length(q));
  float alpha = dotShape * vGlow;
  if (alpha < 0.012) discard;
  vec3 cyan = vec3(0.13, 1.0, 0.82);
  vec3 blue = vec3(0.24, 0.62, 1.0);
  vec3 color = mix(cyan, blue, vHue) * (1.18 + vGlow * 0.82);
  gl_FragColor = vec4(color, min(alpha, 0.9));
}
`;

function reefInfluence(x: number, z: number) {
  let influence = 0;
  for (const reef of REEF_BIOMES) {
    const distance = Math.hypot(x - reef.center[0], z - reef.center[1]);
    influence = Math.max(influence, Math.max(0, 1 - distance / (reef.radius * 1.45)));
  }
  return influence;
}

/**
 * Grille mondiale déterministe. Chaque chunk possède sa seed et sa densité, puis
 * toutes les cellules sont fusionnées en un seul BufferGeometry / draw call.
 * Le bateau ne déplace jamais ce champ : il ne fait qu'en amplifier les points proches.
 */
export function Plankton() {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const phases: number[] = [];
    const densities: number[] = [];
    const qualities: number[] = [];
    const hues: number[] = [];

    for (let chunkZ = -CHUNK_RADIUS; chunkZ <= CHUNK_RADIUS; chunkZ++) {
      for (let chunkX = -CHUNK_RADIUS; chunkX <= CHUNK_RADIUS; chunkX++) {
        const chunkSeed = hash(chunkX * 127.1 + chunkZ * 311.7 + 941.3);
        const densePatch = Math.pow(hash(chunkX * 47.3 - chunkZ * 91.7 + 18.2), 3);
        const count = 8 + Math.round(chunkSeed * 6 + densePatch * 9);
        const patchX = (hash(chunkSeed * 81.2 + 4) - 0.5) * CHUNK_SIZE * 0.45;
        const patchZ = (hash(chunkSeed * 53.8 + 7) - 0.5) * CHUNK_SIZE * 0.45;

        for (let index = 0; index < count; index++) {
          const seed = chunkSeed * 1000 + index * 17.17;
          let localX = (hash(seed + 1) - 0.5) * CHUNK_SIZE;
          let localZ = (hash(seed + 2) - 0.5) * CHUNK_SIZE;
          if (densePatch > 0.28 && index % 3 !== 0) {
            localX = patchX + (hash(seed + 11) - 0.5) * CHUNK_SIZE * 0.34;
            localZ = patchZ + (hash(seed + 12) - 0.5) * CHUNK_SIZE * 0.34;
          }
          const x = chunkX * CHUNK_SIZE + localX;
          const z = chunkZ * CHUNK_SIZE + localZ;
          const reef = reefInfluence(x, z);
          positions.push(x, -0.16 - hash(seed + 3) * 1.72, z);
          phases.push(hash(seed + 4) * Math.PI * 2);
          densities.push(Math.min(1, 0.24 + chunkSeed * 0.28 + densePatch * 0.34 + reef * 0.45));
          qualities.push(hash(seed + 5));
          hues.push(hash(seed + 6) * 0.82);
        }
      }
    }

    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    result.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1));
    result.setAttribute('aDensity', new BufferAttribute(new Float32Array(densities), 1));
    result.setAttribute('aQuality', new BufferAttribute(new Float32Array(qualities), 1));
    result.setAttribute('aHue', new BufferAttribute(new Float32Array(hues), 1));
    return result;
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNight: { value: 0 },
    uBoatWake: { value: 0 },
    uStorm: { value: 0 },
    uMonsterWake: { value: 0 },
    uQuality: { value: 1 },
    uBoatPosition: { value: new Vector2() },
    uMonsterFrom: { value: new Vector2() },
    uMonsterTo: { value: new Vector2() },
  }), []);

  useFrame((state) => {
    if (!points.current || !material.current) return;
    const world = useWorld.getState();
    const u = material.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uNight.value = ecologyState.plankton * (0.62 + ecologyState.worldLife * 0.38);
    u.uBoatWake.value = ecologyState.plankton * Math.min(Math.abs(boatState.speed) / 8, 1);
    u.uStorm.value = ecologyState.stormWaves;
    u.uMonsterWake.value = ecologyState.monsterWake * Math.max(0.48, ecologyState.plankton);
    u.uQuality.value = world.quality === 'high' ? 1 : world.quality === 'medium' ? 0.66 : 0.38;
    u.uBoatPosition.value.set(boatState.position.x, boatState.position.z);
    u.uMonsterFrom.value.set(ecologyState.monsterFromX, ecologyState.monsterFromZ);
    u.uMonsterTo.value.set(ecologyState.monsterToX, ecologyState.monsterToZ);
    points.current.visible = world.reveal > 0.72 && ecologyState.plankton > 0.018;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={6}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
