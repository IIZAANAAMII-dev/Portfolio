'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../terrain-shape';
import { scatterSpots, type ScatterZone } from './scatter';
import { MeshBuilder, type Vec3 } from './shapes';
import { inClearing, useClearingLayout } from './useClearingLayout';
import { tickWind, WIND_GLSL, windUniforms } from './wind';

/**
 * Touffes de fleurs stylisées : un bouquet de feuilles, des tiges souples et des corolles
 * à pétales francs, aux couleurs de l'archipel. Toutes les touffes d'une île tiennent en
 * UN draw call : la couleur des pétales est propre à chaque exemplaire et le vent (rafales
 * qui traversent l'île, hochement de chaque tête) est calculé sur le GPU.
 *
 * Attributs de la géométrie : `aTint` (1 = pétale, teinté par l'exemplaire), `aSway`
 * (souplesse : 0 au pied, 1 en haut des tiges), `aHead` (phase propre à chaque tête).
 */

/** Couleurs de pétales de l'archipel (corail, crème, pollen, pervenche, blanc, orange, rose, bleuet). */
export const PETALS = ['#ec8f86', '#f4ead2', '#f4c24f', '#9f8fe4', '#f8f3ea', '#f08b4b', '#ea6f93', '#86bbe8'];

const LEAF_DARK = '#3d6a2c';
const LEAF_LIGHT = '#86b24c';
const STEM = '#5b8a37';
const HEART = '#eda83a';

function rotateY([x, y, z]: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, y, -x * s + z * c];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Feuille effilée en trois étages, couchée vers l'extérieur (`angle` : direction au sol). */
function leaf(builder: MeshBuilder, base: Vec3, angle: number, length: number, width: number, lean: number, phase: number, sway = 0.45) {
  const levels = [0, 0.45, 0.8, 1];
  const widths = [width * 0.55, width, width * 0.7, 0];
  const points = levels.map((t) => {
    // Courbe : la feuille monte puis retombe un peu.
    const out = Math.sin(lean) * length * t + t * t * length * 0.18;
    const upward = Math.cos(lean) * length * t - t * t * length * 0.22;
    return rotateY([out, upward, 0], angle);
  });
  const side = rotateY([0, 0, 1], angle);
  const ring = points.map((p, index) => {
    const w = widths[index] / 2;
    return [add(add(base, p), [side[0] * w, 0, side[2] * w]), add(add(base, p), [-side[0] * w, 0, -side[2] * w])] as [Vec3, Vec3];
  });
  // Dégradé du pied (sombre) vers la pointe (claire), selon la distance au pied.
  const dark = new Color(LEAF_DARK);
  const light = new Color(LEAF_LIGHT);
  const paint = (x: number, y: number, z: number, ny: number, out: Color) => {
    const t = Math.min(1, Math.hypot(x - base[0], y - base[1], z - base[2]) / length);
    out.copy(dark).lerp(light, t);
  };
  const extra = { aSway: (x: number, y: number) => Math.min(1, y / 0.55) * sway, aHead: phase, aTint: 0 };
  for (let index = 0; index < 3; index++) {
    const [a0, b0] = ring[index];
    const [a1, b1] = ring[index + 1];
    builder.triangle(a0, b0, a1, paint, extra);
    if (index < 2) builder.triangle(b0, b1, a1, paint, extra);
  }
}

/** Tige à deux segments (prisme à trois pans), légèrement arquée. */
function stem(builder: MeshBuilder, from: Vec3, to: Vec3, radius: number, phase: number, height: number) {
  const mid: Vec3 = [(from[0] + to[0]) / 2 + (to[0] - from[0]) * 0.18, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2 + (to[2] - from[2]) * 0.18];
  const segments: [Vec3, Vec3][] = [[from, mid], [mid, to]];
  segments.forEach(([a, b], index) => {
    const r0 = radius * (index === 0 ? 1 : 0.8);
    const r1 = radius * (index === 0 ? 0.8 : 0.65);
    for (let side = 0; side < 3; side++) {
      const a0 = (side / 3) * Math.PI * 2;
      const a1 = ((side + 1) / 3) * Math.PI * 2;
      const p0: Vec3 = [a[0] + Math.cos(a0) * r0, a[1], a[2] + Math.sin(a0) * r0];
      const p1: Vec3 = [a[0] + Math.cos(a1) * r0, a[1], a[2] + Math.sin(a1) * r0];
      const q0: Vec3 = [b[0] + Math.cos(a0) * r1, b[1], b[2] + Math.sin(a0) * r1];
      const q1: Vec3 = [b[0] + Math.cos(a1) * r1, b[1], b[2] + Math.sin(a1) * r1];
      builder.quad(p0, q0, q1, p1, STEM, { aSway: (x: number, y: number) => Math.min(1, y / height), aHead: phase, aTint: 0 });
    }
  });
}

/**
 * Corolle : `petals` pétales en losange arrondi, un peu creusée en coupe, cœur en dôme.
 * `tilt` incline la fleur vers l'extérieur (direction `facing`).
 */
function corolla(
  builder: MeshBuilder,
  center: Vec3,
  { petals, length, width, cup, facing, tilt, phase, height, heart = HEART }: {
    petals: number; length: number; width: number; cup: number; facing: number; tilt: number; phase: number; height: number; heart?: string;
  },
) {
  // Repère incliné de la fleur.
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const local = ([x, y, z]: Vec3): Vec3 => {
    // Inclinaison autour de l'axe perpendiculaire à `facing`.
    const r = rotateY([x, y, z], -facing);
    const tilted: Vec3 = [r[0] * ct + r[1] * st, -r[0] * st + r[1] * ct, r[2]];
    return add(center, rotateY(tilted, facing));
  };
  const sway = { aSway: (x: number, y: number) => Math.min(1, y / height), aHead: phase };
  for (let index = 0; index < petals; index++) {
    const angle = (index / petals) * Math.PI * 2 + phase * 2;
    const dir: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
    const side: Vec3 = [-Math.sin(angle), 0, Math.cos(angle)];
    const root = local([dir[0] * 0.012, 0.004, dir[2] * 0.012]);
    const mid = (k: number) => local([dir[0] * length * 0.55 + side[0] * width * k, cup * 0.45, dir[2] * length * 0.55 + side[2] * width * k]);
    const tip = local([dir[0] * length, cup, dir[2] * length]);
    // Dégradé : pied du pétale plus soutenu, pointe claire.
    const shade = (x: number, y: number, z: number, ny: number, out: Color) => {
      const d = Math.hypot(x - center[0], z - center[2]) / length;
      out.setScalar(0.74 + Math.min(1, d) * 0.3);
    };
    builder.triangle(root, mid(-0.5), tip, shade, { ...sway, aTint: 1 });
    builder.triangle(root, tip, mid(0.5), shade, { ...sway, aTint: 1 });
  }
  // Cœur : petit dôme à cinq pans.
  const top = local([0, 0.03, 0]);
  for (let index = 0; index < 5; index++) {
    const a0 = (index / 5) * Math.PI * 2;
    const a1 = ((index + 1) / 5) * Math.PI * 2;
    const p0 = local([Math.cos(a0) * 0.026, 0.008, Math.sin(a0) * 0.026]);
    const p1 = local([Math.cos(a1) * 0.026, 0.008, Math.sin(a1) * 0.026]);
    builder.triangle(p0, top, p1, heart, { ...sway, aTint: 0 }, 0.25);
  }
}

/** Bouton fermé : une goutte à quatre pans, teintée comme les pétales. */
function bud(builder: MeshBuilder, center: Vec3, size: number, phase: number, height: number) {
  const top = add(center, [0, size * 1.6, 0]);
  const bottom = add(center, [0, -size * 0.3, 0]);
  const sway = { aSway: (x: number, y: number) => Math.min(1, y / height), aHead: phase };
  for (let index = 0; index < 4; index++) {
    const a0 = (index / 4) * Math.PI * 2 + phase;
    const a1 = ((index + 1) / 4) * Math.PI * 2 + phase;
    const p0 = add(center, [Math.cos(a0) * size, size * 0.4, Math.sin(a0) * size]);
    const p1 = add(center, [Math.cos(a1) * size, size * 0.4, Math.sin(a1) * size]);
    builder.triangle(p0, top, p1, '#e6e0d4', { ...sway, aTint: 1 });
    builder.triangle(p1, bottom, p0, STEM, { ...sway, aTint: 0 });
  }
}

/** Touffe : 8 feuilles, 6 fleurs à hauteurs variées, 2 boutons. Environ 0,7 m de large. */
function clumpGeometry() {
  const builder = new MeshBuilder(['aTint', 'aSway', 'aHead']);
  const height = 0.5;
  for (let index = 0; index < 9; index++) {
    const angle = (index / 9) * Math.PI * 2 + hash(index * 3.1) * 0.5;
    const base: Vec3 = [Math.cos(angle) * 0.04, 0, Math.sin(angle) * 0.04];
    leaf(builder, base, -angle, 0.2 + hash(index * 5.7) * 0.13, 0.085 + hash(index * 2.3) * 0.03, 0.55 + hash(index * 7.1) * 0.45, hash(index * 9.9));
  }
  const heads = 6;
  for (let index = 0; index < heads; index++) {
    const angle = (index / heads) * Math.PI * 2 + hash(index * 4.3) * 0.7;
    const spread = 0.05 + hash(index * 6.1) * 0.15;
    const h = 0.26 + hash(index * 8.7) * 0.22;
    const top: Vec3 = [Math.cos(angle) * spread, h, Math.sin(angle) * spread];
    const phase = hash(index * 1.7 + 0.3);
    stem(builder, [Math.cos(angle) * 0.02, 0, Math.sin(angle) * 0.02], top, 0.011, phase, height);
    corolla(builder, top, {
      petals: index % 3 === 2 ? 5 : 7,
      length: 0.075 + hash(index * 3.9) * 0.03,
      width: 0.05,
      cup: 0.022,
      facing: -angle,
      tilt: 0.25 + spread * 1.6,
      phase,
      height,
    });
  }
  for (let index = 0; index < 2; index++) {
    const angle = index * 2.7 + 1.1;
    const h = 0.2 + index * 0.06;
    const top: Vec3 = [Math.cos(angle) * 0.1, h, Math.sin(angle) * 0.1];
    const phase = hash(index * 5.3 + 7.1);
    stem(builder, [0, 0, 0], top, 0.009, phase, height);
    bud(builder, top, 0.022, phase, height);
  }
  return builder.build()!;
}

/** Fleur sauvage isolée (dans l'herbe) : une tige, une corolle, deux feuilles. ~0,3 m. */
export function wildflowerGeometry() {
  const builder = new MeshBuilder(['aTint', 'aSway', 'aHead']);
  const height = 0.32;
  leaf(builder, [0.01, 0, 0], 0.4, 0.13, 0.05, 0.9, 0.2, 0.3);
  leaf(builder, [-0.01, 0, 0], 3.4, 0.11, 0.05, 1.0, 0.6, 0.3);
  const top: Vec3 = [0.03, height, 0.01];
  stem(builder, [0, 0, 0], top, 0.008, 0.5, height);
  corolla(builder, top, { petals: 6, length: 0.07, width: 0.045, cup: 0.018, facing: 0.3, tilt: 0.3, phase: 0.5, height });
  return builder.build()!;
}

export const FLOWER_PARS = /* glsl */ `
attribute float aTint;
attribute float aSway;
attribute float aHead;
attribute vec4 aFlower;
${WIND_GLSL}
`;

/** Vent sur une fleur instanciée : rafale à la racine, hochement propre à chaque tête. */
export const FLOWER_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  vec3 flowerRoot = instanceMatrix[ 3 ].xyz;
  vec2 flowerWorld = ( modelMatrix * vec4( flowerRoot, 1.0 ) ).xz;
  float gust = windGust( flowerWorld );
  float bend = aSway * aSway;
  float nod = uWindTime * ( 1.5 + aHead * 0.9 ) + aHead * 6.2831 + aFlower.w * 6.2831;
  vec3 push = uWindDir * ( 0.03 + gust * 0.14 + windFlutter( flowerWorld + aHead * 3.1, 3.4 ) * 0.012 ) * bend;
  push += vec3( sin( nod ), 0.0, cos( nod * 0.83 ) ) * ( 0.01 + gust * 0.012 ) * bend;
  vec3 axisX = instanceMatrix[ 0 ].xyz;
  vec3 axisY = instanceMatrix[ 1 ].xyz;
  vec3 axisZ = instanceMatrix[ 2 ].xyz;
  transformed += vec3(
    dot( axisX, push ) / dot( axisX, axisX ),
    dot( axisY, push ) / dot( axisY, axisY ),
    dot( axisZ, push ) / dot( axisZ, axisZ )
  );
  transformed.y -= bend * gust * 0.03 / length( axisY );
}
`;

/** Les pétales prennent la couleur de l'exemplaire. */
export const FLOWER_COLOR = /* glsl */ `
#include <color_vertex>
vColor.rgb = mix( vColor.rgb, vColor.rgb * aFlower.rgb, aTint );
`;

/** Normales tournées vers le ciel : feuilles et pétales minces éclairés pareil des deux côtés. */
export const FLOWER_NORMAL = /* glsl */ `
vec3 objectNormal = normalize( mix( vec3( normal ), vec3( 0.0, 1.0, 0.0 ), 0.65 ) );
`;

const FLAT_FACES = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

export function createFlowerMaterial(name: string) {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0, side: DoubleSide, vertexColors: true });
  material.name = name;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLOWER_PARS}`)
      .replace('#include <beginnormal_vertex>', FLOWER_NORMAL)
      .replace('#include <begin_vertex>', FLOWER_VERTEX)
      .replace('#include <color_vertex>', FLOWER_COLOR);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', FLAT_FACES);
  };
  material.customProgramCacheKey = () => `${name}-v1`;
  return material;
}

const CLUMP = clumpGeometry();
const CLUMP_MATERIAL = createFlowerMaterial('flower-clumps');

interface FlowerInstance {
  matrix: Matrix4;
  x: number;
  z: number;
  radius: number;
}

const position = new Vector3();
const rotation = new Quaternion();
const scale = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const hidden = new Matrix4().makeScale(0, 0, 0);

/**
 * Palette d'une île : une couleur dominante, une seconde, un rappel. Plus harmonieux qu'un
 * semis de confettis.
 */
export function islandPetals(seed: number, palette = PETALS) {
  const first = Math.floor(hash(seed * 1.31) * palette.length);
  const second = (first + 1 + Math.floor(hash(seed * 2.17) * (palette.length - 1))) % palette.length;
  const third = (second + 1 + Math.floor(hash(seed * 3.07) * (palette.length - 2))) % palette.length;
  return [palette[first], palette[second], palette[third === first ? (third + 1) % palette.length : third]];
}

/** Touffes de fleurs d'une île (un draw call, sans ombre portée). */
export function FlowerScatter({
  sampler,
  zone,
  count,
  seed,
  scale: scaleRange = [0.8, 1.35],
  colors,
}: {
  sampler: HeightSampler;
  zone: ScatterZone;
  count: number;
  seed: number;
  scale?: [number, number];
  /** Couleurs des pétales (sinon trois couleurs tirées de la palette de l'archipel). */
  colors?: string[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const density = QUALITY_LEVELS[quality].vegetationDensity;
  const wanted = Math.max(1, Math.round(count * density));
  const zoneKey = JSON.stringify(zone);
  const colorKey = (colors ?? islandPetals(seed)).join('|');
  const [minScale, maxScale] = scaleRange;

  const flowers = useMemo(() => {
    const spots = scatterSpots(sampler, JSON.parse(zoneKey) as ScatterZone, wanted, seed, { size: [minScale, maxScale], spacing: 0.9 });
    const tints = colorKey.split('|').map((hex) => new Color(hex));
    const instances: FlowerInstance[] = [];
    const flower = new Float32Array(Math.max(1, spots.length) * 4);
    spots.forEach((spot, index) => {
      position.set(spot.x, spot.y - 0.03, spot.z);
      rotation.setFromAxisAngle(yAxis, spot.yaw);
      // Un miroir sur une touffe sur deux : la répétition ne se voit plus.
      const mirror = spot.key > 0.5 ? -1 : 1;
      scale.set(spot.size * mirror, spot.size * (0.85 + hash(spot.key * 7.7) * 0.3), spot.size);
      instances.push({ matrix: new Matrix4().compose(position, rotation, scale), x: spot.x, z: spot.z, radius: spot.size * 0.35 });
      // Dominante 55 %, seconde 30 %, rappel 15 %.
      const pick = hash(spot.key * 13.1);
      const tint = tints[pick < 0.55 ? 0 : pick < 0.85 ? 1 : 2] ?? tints[0];
      const shade = 0.92 + hash(spot.key * 3.3) * 0.16;
      flower.set([tint.r * shade, tint.g * shade, tint.b * shade, spot.key], index * 4);
    });
    return { instances, flower };
  }, [colorKey, maxScale, minScale, sampler, seed, wanted, zoneKey]);

  const geometry = useMemo(() => {
    const result = CLUMP.clone() as BufferGeometry;
    result.setAttribute('aFlower', new InstancedBufferAttribute(flowers.flower, 4));
    return result;
  }, [flowers]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useClearingLayout((clearings) => {
    const target = mesh.current;
    if (!target) return;
    flowers.instances.forEach((item, index) => {
      target.setMatrixAt(index, inClearing(clearings, item.x, item.z, item.radius) ? hidden : item.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, flowers);

  useFrame((state) => tickWind(state.clock.elapsedTime));

  if (flowers.instances.length === 0) return null;
  return (
    <instancedMesh
      key={flowers.instances.length}
      ref={mesh}
      args={[geometry, CLUMP_MATERIAL, flowers.instances.length]}
      castShadow={false}
      receiveShadow
      raycast={() => null}
    />
  );
}
