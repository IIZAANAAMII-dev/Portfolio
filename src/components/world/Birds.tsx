'use client';

import { useEffect, useMemo, useRef } from 'react';
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
import { WAVE_GLSL } from '@/lib/waves';

/**
 * Mouettes : elles tournent au-dessus des îles, trois escortent le bateau et quelques-unes
 * se reposent sur l'eau. Tout le vol est calculé sur le GPU, un seul draw call : orbite à
 * vitesse variable, battements quand l'oiseau remonte et planés quand il redescend,
 * roulis tiré de la courbure réelle de la trajectoire, tangage, léger rebond du corps, aile
 * en deux segments (bras, main) qui se replie à la remontée. Celles qui flottent dansent
 * sur la houle et s'envolent quand le bateau approche. Elles rentrent la nuit et
 * n'apparaissent qu'après l'intro.
 */

type V3 = [number, number, number];

const WHITE: V3 = [0.97, 0.97, 0.95];
// Gris perle presque neutre : l'ombre teintée de violet du rendu « toon » le bleuit déjà.
const MANTLE: V3 = [0.68, 0.7, 0.72];
const UNDERWING: V3 = [0.9, 0.92, 0.94];
const TIP: V3 = [0.13, 0.14, 0.17];
const BEAK: V3 = [0.99, 0.78, 0.22];
const FEET: V3 = [0.96, 0.63, 0.52];

/** Envergure du bras : de l'épaule (z = 0,08) au poignet (z = 0,52). Lu aussi par le shader. */
const SHOULDER = 0.08;
const WRIST = 0.52;

/**
 * Mouette basse définition, avant = +X, envergure selon Z. Triangles non indexés, chacun de
 * sa couleur (zones nettes) ; les plaques fines (ailes, queue, pattes) sont émises deux
 * fois, une face par côté : dessus gris, dessous blanc, sans `DoubleSide`.
 */
function gullGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const wing: number[] = [];

  /** Triangle orienté pour que sa normale suive `outward`. */
  const tri = (a: V3, b: V3, c: V3, color: V3, outward: V3, isWing = 0) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const flip = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0;
    positions.push(...a, ...(flip ? c : b), ...(flip ? b : c));
    for (let i = 0; i < 3; i++) {
      colors.push(...color);
      wing.push(isWing);
    }
  };
  /** Plaque fine visible des deux côtés, avec une couleur par face. */
  const plate = (a: V3, b: V3, c: V3, top: V3, bottom: V3, isWing = 0) => {
    tri(a, b, c, top, [0, 1, 0], isWing);
    tri(a, b, c, bottom, [0, -1, 0], isWing);
  };

  // Corps : anneaux hexagonaux le long de l'axe, de la queue à la face (x, demi-hauteur,
  // demi-largeur, centre en y). Silhouette effilée : poitrine ronde, croupion fin.
  const stations: [number, number, number, number][] = [
    [-0.44, 0.03, 0.045, 0.06],
    [-0.27, 0.07, 0.08, 0.04],
    [-0.03, 0.1, 0.1, 0.02],
    [0.19, 0.095, 0.088, 0.035],
    [0.33, 0.068, 0.062, 0.065],
    [0.43, 0.074, 0.066, 0.09],
    [0.52, 0.045, 0.04, 0.09],
  ];
  const ring = (index: number) =>
    Array.from({ length: 6 }, (_, k): V3 => {
      const [x, ry, rz, yc] = stations[index];
      const angle = Math.PI / 2 - (k * Math.PI) / 3;
      return [x, yc + Math.sin(angle) * ry, Math.cos(angle) * rz];
    });
  for (let i = 0; i < stations.length - 1; i++) {
    const a = ring(i);
    const b = ring(i + 1);
    const axis: V3 = [(stations[i][0] + stations[i + 1][0]) / 2, (stations[i][3] + stations[i + 1][3]) / 2, 0];
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      // Manteau gris sur le dos, entre les ailes (faces du dessus, du croupion à la poitrine).
      const back = (k === 0 || k === 5) && i >= 1 && i <= 2;
      const color = back ? MANTLE : WHITE;
      const centre: V3 = [
        (a[k][0] + b[k2][0]) / 2 - axis[0],
        (a[k][1] + b[k2][1]) / 2 - axis[1],
        (a[k][2] + b[k2][2]) / 2 - axis[2],
      ];
      tri(a[k], b[k], a[k2], color, centre);
      tri(a[k2], b[k], b[k2], color, centre);
    }
  }
  // Fermetures : pointe du croupion et face (sous le bec).
  const tailRing = ring(0);
  const faceRing = ring(stations.length - 1);
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    tri(tailRing[k], tailRing[k2], [-0.47, 0.06, 0], WHITE, [-1, 0, 0]);
    tri(faceRing[k], faceRing[k2], [0.55, 0.09, 0], WHITE, [1, 0, 0]);
  }

  // Bec jaune, un peu crochu.
  const beakTip: V3 = [0.7, 0.068, 0];
  const beakBase: V3[] = [
    [0.53, 0.108, 0.022],
    [0.53, 0.108, -0.022],
    [0.53, 0.07, -0.02],
    [0.53, 0.07, 0.02],
  ];
  for (let k = 0; k < 4; k++) {
    const a = beakBase[k];
    const b = beakBase[(k + 1) % 4];
    const mid: V3 = [0, (a[1] + b[1]) / 2 - 0.089, (a[2] + b[2]) / 2];
    tri(a, b, beakTip, BEAK, mid);
  }

  // Queue blanche en éventail court, pattes roses repliées sous le ventre.
  plate([-0.4, 0.06, 0.045], [-0.4, 0.06, -0.045], [-0.6, 0.065, 0.1], WHITE, WHITE);
  plate([-0.4, 0.06, -0.045], [-0.6, 0.065, 0.1], [-0.6, 0.065, -0.1], WHITE, WHITE);
  for (const side of [1, -1]) {
    plate([-0.16, -0.06, 0.035 * side], [-0.34, -0.035, 0.05 * side], [-0.3, -0.05, 0.015 * side], FEET, FEET);
  }

  // Ailes longues et étroites, poignet avancé, pointe effilée rejetée vers l'arrière.
  for (const side of [1, -1]) {
    const y = 0.075;
    const rootFront: V3 = [0.13, y, SHOULDER * side];
    const rootBack: V3 = [-0.15, y, SHOULDER * side];
    const wristFront: V3 = [0.16, y, 0.54 * side];
    const elbowBack: V3 = [-0.2, y, 0.5 * side];
    const blackFront: V3 = [0.03, y, 0.86 * side];
    const blackBack: V3 = [-0.21, y, 0.8 * side];
    const tip: V3 = [-0.27, y, 1.14 * side];
    plate(rootFront, wristFront, rootBack, MANTLE, UNDERWING, 1);
    plate(rootBack, wristFront, elbowBack, MANTLE, UNDERWING, 1);
    plate(wristFront, blackFront, elbowBack, MANTLE, UNDERWING, 1);
    plate(elbowBack, blackFront, blackBack, MANTLE, UNDERWING, 1);
    plate(blackFront, tip, blackBack, TIP, TIP, 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('aWing', new BufferAttribute(new Float32Array(wing), 1));
  geometry.computeVertexNormals();
  return geometry;
}

const FLIGHT_PARS = /* glsl */ `
attribute vec4 aPath;
attribute vec4 aMotion;
attribute float aFollow;
attribute float aWing;
uniform float uTime;
uniform vec2 uBoat;
uniform vec2 uBoatVel;
uniform float uPresence;
${WAVE_GLSL}

// Tangage (autour de z), roulis (autour de l'axe du corps x), cap (autour de y).
vec3 gullTurn(vec3 p, float pitch, float bank, float yaw) {
  float c = cos(pitch);
  float s = sin(pitch);
  p = vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  c = cos(bank);
  s = sin(bank);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  c = cos(yaw);
  s = sin(yaw);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}

// Orbite d'un oiseau : rayon qui respire, altitude qui ondule.
vec3 gullOrbit(float a) {
  float wobble = sin(a * 2.3 + aMotion.y) * 0.16;
  vec2 ground = aPath.xy + vec2(cos(a), sin(a)) * aPath.z * (1.0 + wobble);
  return vec3(ground.x, aPath.w + sin(a * 1.7 + aMotion.y * 2.0) * 1.3, ground.y);
}
`;

const FLIGHT_NORMAL = /* glsl */ `
float gullFollow = abs(aFollow - 1.0) < 0.5 ? 1.0 : 0.0;
float gullRest = aFollow > 1.5 ? 1.0 : 0.0;
float gullDir = aMotion.x < 0.0 ? -1.0 : 1.0;
// Vitesse qui respire : l'oiseau ralentit, accélère, jamais au même rythme que son voisin.
float gullA = aMotion.x * uTime + aMotion.y + 0.33 * sin(uTime * 0.21 + aMotion.y * 4.0) * gullDir;
float gullRate = aMotion.x + 0.0693 * cos(uTime * 0.21 + aMotion.y * 4.0) * gullDir;
// Vitesse et accélération par différences finies sur la trajectoire elle-même.
vec3 gullP0 = gullOrbit(gullA - 0.03);
vec3 gullP1 = gullOrbit(gullA);
vec3 gullP2 = gullOrbit(gullA + 0.03);
vec3 gullVel = (gullP2 - gullP0) / 0.06 * gullRate;
vec3 gullAcc = (gullP2 - 2.0 * gullP1 + gullP0) / 0.0009 * gullRate * gullRate;
gullVel.xz += uBoatVel * gullFollow;
vec3 gullCentre = gullP1 + vec3(uBoat.x, 0.0, uBoat.y) * gullFollow;
float gullYaw = atan(gullVel.z, gullVel.x);
vec2 gullSide = vec2(-sin(gullYaw), cos(gullYaw));
// Roulis vers l'intérieur du virage, proportionnel à la courbure réelle.
float gullBank = clamp(dot(gullAcc.xz, gullSide) * 0.55, -0.7, 0.7);
float gullPitch = clamp(gullVel.y / max(length(gullVel.xz), 0.4), -0.6, 0.6) * 0.6;
// Battements à la remontée (et quand le bateau file), planés à la descente ; de longs
// planés reviennent de temps en temps.
float gullFlap = smoothstep(-0.2, 0.3, gullVel.y);
gullFlap = max(gullFlap, gullFollow * smoothstep(1.5, 5.0, length(uBoatVel)));
gullFlap *= 1.0 - 0.75 * smoothstep(0.25, 0.75, sin(uTime * 0.31 + aMotion.y * 3.0));
float gullFolded = 0.0;

if (gullRest > 0.5) {
  // Posée sur l'eau : elle suit la houle, pivote doucement et s'envole quand le bateau
  // s'approche, puis revient se poser.
  vec2 gullFromBoat = aPath.xy - uBoat;
  float gullStartle = 1.0 - smoothstep(7.0, 14.0, length(gullFromBoat));
  vec2 gullAway = normalize(gullFromBoat + vec2(1e-3, 0.0));
  vec2 gullGround = aPath.xy + gullAway * gullStartle * 4.0;
  vec2 gullSlope = waveSlope(gullGround, uTime);
  gullCentre = vec3(gullGround.x, waveHeight(gullGround, uTime) + 0.05 + gullStartle * 3.2, gullGround.y);
  gullYaw = mix(aMotion.y + sin(uTime * 0.11 + aMotion.y) * 0.9, atan(gullAway.y, gullAway.x), gullStartle);
  vec2 gullAhead = vec2(cos(gullYaw), sin(gullYaw));
  gullSide = vec2(-sin(gullYaw), cos(gullYaw));
  gullPitch = mix(atan(dot(gullSlope, gullAhead)) * 2.0, 0.3, gullStartle);
  gullBank = -atan(dot(gullSlope, gullSide)) * 2.0 * (1.0 - gullStartle);
  gullFlap = gullStartle;
  gullFolded = 1.0 - smoothstep(0.0, 0.25, gullStartle);
}

float gullBeat = uTime * aMotion.z + aMotion.y * 5.0;
// Épaule : légère dièdre au plané, grand battement sinon ; la main suit avec retard et
// retombe un peu au plané (silhouette en « M » de la mouette).
float gullShoulder = 0.12 + gullFlap * 0.62 * sin(gullBeat);
float gullWrist = mix(-0.2, 0.42 * sin(gullBeat - 0.9), gullFlap);
// À la remontée, la main se replie un peu.
float gullFold = gullFlap * 0.24 * max(cos(gullBeat), 0.0);
// Le corps rebondit à chaque battement.
gullCentre.y += gullFlap * 0.05 * cos(gullBeat) * (1.0 - gullFolded);

vec3 objectNormal = gullTurn(vec3(normal), gullPitch, gullBank, gullYaw);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

const FLIGHT_POSITION = /* glsl */ `
vec3 gullLocal = position;
if (aWing > 0.5) {
  float side = gullLocal.z < 0.0 ? -1.0 : 1.0;
  float reach = abs(gullLocal.z) - ${SHOULDER.toFixed(2)};
  float armLength = ${(WRIST - SHOULDER).toFixed(2)};
  // Profil de l'aile dans le plan (vers l'extérieur, vers le haut) : bras puis main.
  vec2 joint = vec2(${SHOULDER.toFixed(2)}, gullLocal.y)
    + vec2(cos(gullShoulder), sin(gullShoulder)) * min(reach, armLength);
  if (reach > armLength) {
    float hand = (reach - armLength) * (1.0 - gullFold);
    joint += vec2(cos(gullShoulder + gullWrist), sin(gullShoulder + gullWrist)) * hand;
    gullLocal.x -= gullFold * (reach - armLength) * 0.5;
  }
  // Au repos, ailes repliées le long du dos, pointes croisées sur la queue.
  joint.x = mix(joint.x, ${SHOULDER.toFixed(2)} + reach * 0.1, gullFolded);
  joint.y = mix(joint.y, gullLocal.y + 0.025 + reach * 0.02, gullFolded);
  gullLocal.x -= gullFolded * reach * 0.38;
  gullLocal.y = joint.y;
  gullLocal.z = side * joint.x;
}
gullLocal *= aMotion.w * uPresence;
vec3 transformed = gullTurn(gullLocal, gullPitch, gullBank, gullYaw) + gullCentre;
`;

const flight = {
  uTime: { value: 0 },
  uBoat: { value: new Vector2() },
  uBoatVel: { value: new Vector2() },
  uPresence: { value: 0 },
  uStorm: { value: 0 },
};

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
  material.customProgramCacheKey = () => 'gull-flight-v2';
  return material;
}

const GULL_GEOMETRY = gullGeometry();
const GULL_MATERIAL = createGullMaterial();

interface Gull {
  center: [number, number];
  radius: number;
  altitude: number;
  speed: number;
  /** 0 : tourne au-dessus d'une île ; 1 : escorte le bateau ; 2 : posée sur l'eau. */
  mode: 0 | 1 | 2;
}

/** Deux ou trois mouettes par île, trois qui escortent le bateau, quelques-unes posées. */
function gulls(): Gull[] {
  const list: Gull[] = [];
  const spots = [homeIsland, ...islands];
  spots.forEach((spot, index) => {
    const count = 2 + (hash(index * 7.1) > 0.5 ? 1 : 0);
    for (let bird = 0; bird < count; bird++) {
      const key = index * 13.3 + bird * 3.7;
      list.push({
        center: [spot.position[0], spot.position[1]],
        radius: spot.radius * (0.9 + hash(key) * 0.8),
        altitude: 13 + hash(key + 1.1) * 10,
        speed: (0.16 + hash(key + 2.3) * 0.16) * (hash(key + 3.9) > 0.5 ? 1 : -1),
        mode: 0,
      });
    }
  });
  for (let bird = 0; bird < 3; bird++) {
    list.push({
      center: [0, 0],
      radius: 9 + bird * 2.6,
      altitude: 16 + bird * 2.2,
      speed: (0.3 - bird * 0.04) * (bird === 1 ? -1 : 1),
      mode: 1,
    });
  }
  // Posées dans le lagon, du côté opposé au ponton (le bateau ne les dérange qu'en passant).
  spots.forEach((spot, index) => {
    if (index % 2 === 1) return;
    for (let bird = 0; bird < 2; bird++) {
      const angle = spot.dockAngle + Math.PI + (bird === 0 ? -0.28 : 0.22) + (hash(index * 3.3 + bird) - 0.5) * 0.2;
      const reach = spot.radius + 5.5 + hash(index * 5.9 + bird) * 2.5;
      list.push({
        center: [spot.position[0] + Math.cos(angle) * reach, spot.position[1] + Math.sin(angle) * reach],
        radius: 0,
        altitude: 0,
        speed: 0,
        mode: 2,
      });
    }
  });
  return list;
}

export function Birds() {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const birds = useMemo(() => {
    const all = gulls();
    return quality === 'low' ? all.filter((_, index) => index % 2 === 0) : all;
  }, [quality]);

  const geometry = useMemo(() => {
    const result = GULL_GEOMETRY.clone();
    const path = new Float32Array(birds.length * 4);
    const motion = new Float32Array(birds.length * 4);
    const follow = new Float32Array(birds.length);
    birds.forEach((bird, index) => {
      path.set([bird.center[0], bird.center[1], bird.radius, bird.altitude], index * 4);
      motion.set([
        bird.speed,
        hash(index * 5.7) * Math.PI * 2,
        // Battement : de 1,1 à 1,5 Hz, chaque oiseau le sien.
        7 + hash(index * 8.3) * 2.4,
        (bird.mode === 2 ? 0.85 : 0.95) + hash(index * 2.9) * 0.3,
      ], index * 4);
      follow[index] = bird.mode;
    });
    result.setAttribute('aPath', new InstancedBufferAttribute(path, 4));
    result.setAttribute('aMotion', new InstancedBufferAttribute(motion, 4));
    result.setAttribute('aFollow', new InstancedBufferAttribute(follow, 1));
    return result;
  }, [birds]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const { reveal } = useWorld.getState();
    flight.uTime.value = state.clock.elapsedTime;
    flight.uBoat.value.set(boatState.position.x, boatState.position.z);
    flight.uBoatVel.value.set(
      Math.cos(boatState.heading) * boatState.speed,
      Math.sin(boatState.heading) * boatState.speed,
    );
    flight.uStorm.value = ecologyState.stormWaves;
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
