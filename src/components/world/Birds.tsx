'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Vector2,
} from 'three';
import { homeIsland, islands } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';

/**
 * Mouettes en vol : elles tournent au-dessus des îles et quelques-unes suivent le bateau.
 * Tout le vol est calculé sur le GPU (orbite, altitude qui ondule, battements d'ailes qui
 * alternent avec des planés, inclinaison dans le virage) : aucune matrice réécrite par
 * image, un seul draw call. Elles rentrent la nuit et n'apparaissent qu'après l'intro.
 */

/** Mouette basse définition : corps en losange, queue, deux ailes coudées. Avant = +X. */
function gullGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const white = [0.96, 0.96, 0.94];
  const grey = [0.7, 0.74, 0.8];
  const tip = [0.14, 0.15, 0.18];
  const beak = [0.98, 0.76, 0.3];
  const triangle = (a: number[], b: number[], c: number[], color: number[], colorC = color) => {
    positions.push(...a, ...b, ...c);
    colors.push(...color, ...color, ...colorC);
  };
  const nose = [0.55, 0.03, 0];
  const tail = [-0.46, 0.05, 0];
  const top = [0.02, 0.13, 0];
  const bottom = [0.02, -0.08, 0];
  const left = [0.02, 0.02, 0.11];
  const right = [0.02, 0.02, -0.11];
  for (const end of [nose, tail]) {
    triangle(end, top, left, white);
    triangle(end, right, top, white);
    triangle(end, left, bottom, white);
    triangle(end, bottom, right, white);
  }
  // Bec.
  triangle([0.68, 0.02, 0], [0.54, 0.05, 0.03], [0.54, 0.05, -0.03], beak);
  // Queue en éventail.
  triangle([-0.4, 0.05, 0], [-0.7, 0.06, 0.15], [-0.7, 0.06, -0.15], white);
  for (const side of [1, -1]) {
    const rootFront = [0.14, 0.05, 0.07 * side];
    const rootBack = [-0.16, 0.05, 0.07 * side];
    const elbowFront = [0.06, 0.05, 0.52 * side];
    const elbowBack = [-0.2, 0.05, 0.5 * side];
    const wingTip = [-0.34, 0.05, 0.98 * side];
    triangle(rootFront, elbowFront, rootBack, grey);
    triangle(rootBack, elbowFront, elbowBack, grey);
    triangle(elbowFront, wingTip, elbowBack, grey, tip);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

const FLIGHT_PARS = /* glsl */ `
attribute vec4 aPath;
attribute vec4 aMotion;
attribute float aFollow;
uniform float uTime;
uniform vec2 uBoat;
uniform float uPresence;

vec3 birdRotate(vec3 p, float bank, float yaw) {
  float cb = cos(bank);
  float sb = sin(bank);
  p = vec3(p.x, p.y * cb - p.z * sb, p.y * sb + p.z * cb);
  float cy = cos(yaw);
  float sy = sin(yaw);
  return vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
}
`;

const FLIGHT_NORMAL = /* glsl */ `
float birdAngle = uTime * aMotion.x + aMotion.y;
float birdDir = sign(aMotion.x);
vec2 birdCenter = aPath.xy + uBoat * aFollow;
float birdWobble = sin(birdAngle * 2.3 + aMotion.y) * 0.16;
vec2 birdGround = birdCenter + vec2(cos(birdAngle), sin(birdAngle)) * aPath.z * (1.0 + birdWobble);
float birdAltitude = aPath.w + sin(birdAngle * 1.7 + aMotion.y * 2.0) * 1.3;
vec2 birdTangent = vec2(-sin(birdAngle), cos(birdAngle)) * birdDir;
float birdYaw = atan(birdTangent.y, birdTangent.x);
// Vol battu, puis plané (ailes presque fixes, légèrement relevées).
float birdGlide = smoothstep(0.15, 0.6, sin(uTime * 0.37 + aMotion.y * 3.0));
float birdFlap = sin(uTime * aMotion.z + aMotion.y * 5.0) * mix(0.8, 0.06, birdGlide) + birdGlide * 0.14;
// Le corps s'incline vers l'intérieur du virage.
float birdBank = -0.38 * birdDir;
vec3 objectNormal = birdRotate(vec3(normal), birdBank, birdYaw);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

const FLIGHT_POSITION = /* glsl */ `
vec3 birdLocal = position;
float birdSpan = abs(birdLocal.z);
if (birdSpan > 0.075) {
  // Aile : rotation autour de l'axe du corps, plus ample au bout (coude souple).
  float reach = birdSpan - 0.07;
  birdLocal.y += sin(birdFlap) * reach * (1.0 + max(birdSpan - 0.5, 0.0) * 0.9);
  birdLocal.z = sign(birdLocal.z) * (0.07 + reach * cos(birdFlap));
}
birdLocal *= aMotion.w * uPresence;
vec3 transformed = birdRotate(birdLocal, birdBank, birdYaw) + vec3(birdGround.x, birdAltitude, birdGround.y);
`;

function createGullMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
  material.name = 'gull-flight';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, flight);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLIGHT_PARS}`)
      .replace('#include <beginnormal_vertex>', FLIGHT_NORMAL)
      .replace('#include <begin_vertex>', FLIGHT_POSITION);
  };
  material.customProgramCacheKey = () => 'gull-flight-v1';
  return material;
}

const flight = {
  uTime: { value: 0 },
  uBoat: { value: new Vector2() },
  uPresence: { value: 0 },
};

const GULL_GEOMETRY = gullGeometry();
const GULL_MATERIAL = createGullMaterial();

interface Flyer {
  center: [number, number];
  radius: number;
  altitude: number;
  speed: number;
  follow: number;
}

/** Deux ou trois mouettes par île, trois qui escortent le bateau. */
function flyers(): Flyer[] {
  const list: Flyer[] = [];
  const spots = [{ position: homeIsland.position, radius: homeIsland.radius }, ...islands];
  spots.forEach((spot, index) => {
    const count = 2 + (hash(index * 7.1) > 0.5 ? 1 : 0);
    for (let bird = 0; bird < count; bird++) {
      const key = index * 13.3 + bird * 3.7;
      list.push({
        center: [spot.position[0], spot.position[1]],
        radius: spot.radius * (0.9 + hash(key) * 0.8),
        altitude: 13 + hash(key + 1.1) * 10,
        speed: (0.16 + hash(key + 2.3) * 0.16) * (hash(key + 3.9) > 0.5 ? 1 : -1),
        follow: 0,
      });
    }
  });
  for (let bird = 0; bird < 3; bird++) {
    list.push({
      center: [0, 0],
      radius: 9 + bird * 2.6,
      altitude: 16 + bird * 2.2,
      speed: (0.3 - bird * 0.04) * (bird === 1 ? -1 : 1),
      follow: 1,
    });
  }
  return list;
}

export function Birds() {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const all = useMemo(() => flyers(), []);
  const birds = quality === 'low' ? all.filter((_, index) => index % 2 === 0) : all;

  const geometry = useMemo(() => {
    const result = GULL_GEOMETRY.clone();
    const path = new Float32Array(birds.length * 4);
    const motion = new Float32Array(birds.length * 4);
    const follow = new Float32Array(birds.length);
    birds.forEach((bird, index) => {
      path.set([bird.center[0], bird.center[1], bird.radius, bird.altitude], index * 4);
      motion.set([bird.speed, hash(index * 5.7) * Math.PI * 2, 6.5 + hash(index * 8.3) * 2.5, 0.95 + hash(index * 2.9) * 0.35], index * 4);
      follow[index] = bird.follow;
    });
    result.setAttribute('aPath', new InstancedBufferAttribute(path, 4));
    result.setAttribute('aMotion', new InstancedBufferAttribute(motion, 4));
    result.setAttribute('aFollow', new InstancedBufferAttribute(follow, 1));
    return result;
  }, [birds]);

  useFrame((state) => {
    const { reveal } = useWorld.getState();
    flight.uTime.value = state.clock.elapsedTime;
    flight.uBoat.value.set(boatState.position.x, boatState.position.z);
    flight.uPresence.value = ecologyState.birds * smoothstep(0.35, 0.95, reveal);
    if (mesh.current) mesh.current.visible = flight.uPresence.value > 0.01;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, GULL_MATERIAL, birds.length]}
      frustumCulled={false}
      castShadow={false}
      raycast={() => null}
    />
  );
}
