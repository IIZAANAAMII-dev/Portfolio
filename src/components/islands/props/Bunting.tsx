'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { skyState } from '@/lib/sky';
import { clothClock } from '@/lib/substance-models';
import { hash } from '@/lib/utils/math';
import { MeshBuilder, type Vec3 } from './shapes';
import { tickWind, WIND_GLSL, windUniforms } from './wind';

/**
 * Guirlande de fanions : une corde qui fait le ventre entre deux points d'attache, et des
 * fanions triangulaires qui claquent au vent. Les fanions ondulent comme les autres tissus
 * du monde (même vague, même horloge que `clothClock`) et se soulèvent au passage des
 * rafales. Deux draw calls : la corde, et tous les fanions (instanciés) ; en option, des
 * ampoules de guinguette entre les fanions, qui s'allument au crépuscule (un de plus).
 */

/** Couleurs des fanions : rouge, ocre, sarcelle, crème (les tissus du monde) et bleu breton. */
export const BUNTING_COLORS = ['#c9553f', '#e0a93f', '#3f8f8a', '#efe2c4', '#3b6ea8'];

/** Fanion : triangle pointe en bas, subdivisé pour plier (haut sur la corde, en y = 0). */
function pennantGeometry(width = 0.26, length = 0.34) {
  const positions: number[] = [];
  const rows = 4;
  // Rangées de la corde (y = 0) jusqu'à la pointe (y = -length).
  const rowPoints = (row: number) => {
    const t = row / rows;
    const half = (width / 2) * (1 - t);
    const count = rows - row + 1;
    return Array.from({ length: count }, (_, index): Vec3 => [count === 1 ? 0 : -half + (index / (count - 1)) * half * 2, -t * length, 0]);
  };
  for (let row = 0; row < rows; row++) {
    const top = rowPoints(row);
    const bottom = rowPoints(row + 1);
    for (let index = 0; index < bottom.length; index++) {
      positions.push(...top[index], ...bottom[index], ...top[index + 1]);
      if (index + 1 < bottom.length) positions.push(...top[index + 1], ...bottom[index], ...bottom[index + 1]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

const PENNANT_LENGTH = 0.34;
const PENNANT = pennantGeometry(0.26, PENNANT_LENGTH);

const PENNANT_PARS = /* glsl */ `
attribute vec2 aPennant;
uniform float uClothTime;
${WIND_GLSL}
`;

/**
 * Vague de tissu en espace monde (comme les drapeaux des modèles) : le fanion plie depuis
 * la corde, sa pointe bat et se soulève sous le vent.
 */
const PENNANT_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  float free = clamp( - position.y / ${PENNANT_LENGTH.toFixed(3)}, 0.0, 1.0 );
  vec4 pennantWorld = modelMatrix * instanceMatrix * vec4( position, 1.0 );
  float gust = windGust( pennantWorld.xz );
  float phase = dot( pennantWorld.xz, vec2( 0.84, 0.54 ) ) * 2.6 - uClothTime * 5.2 + aPennant.y * 6.2831;
  float wave = sin( phase ) * 0.7 + sin( phase * 1.9 + position.x * 9.0 ) * 0.3;
  // Le vent pousse le fanion le long de sa normale, du côté sous le vent, plus fort en rafale.
  float downwind = dot( normalize( mat3( modelMatrix ) * instanceMatrix[ 2 ].xyz ), uWindDir );
  transformed.z += free * ( wave * ( 0.035 + gust * 0.05 ) + ( 0.05 + gust * 0.13 ) * aPennant.x * downwind );
  transformed.y += free * free * gust * 0.05;
}
`;

const NORMAL_BEGIN = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createPennantMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0, side: DoubleSide });
  material.name = 'bunting-pennants';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PENNANT_PARS}`)
      .replace('#include <begin_vertex>', PENNANT_VERTEX);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'bunting-pennants-v1';
  return material;
}

const PENNANT_MATERIAL = createPennantMaterial();
const ROPE_MATERIAL = new MeshStandardMaterial({ color: '#d9bd86', roughness: 1, metalness: 0, vertexColors: true });
/** Ampoules : verre laiteux le jour, braise dorée la nuit (partagé par toutes les guirlandes). */
const BULB = new IcosahedronGeometry(0.045, 1).translate(0, -0.06, 0);
const BULB_MATERIAL = new MeshStandardMaterial({ color: '#fff3d2', emissive: '#ffb65a', emissiveIntensity: 0.1, roughness: 0.35, metalness: 0 });
BULB_MATERIAL.name = 'bunting-bulbs';

/** Point de la corde (parabole) entre `from` et `to`, creusée de `sag` au milieu. */
function ropeAt(from: Vec3, to: Vec3, sag: number, t: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t),
    from[2] + (to[2] - from[2]) * t,
  ];
}

const up = new Vector3(0, 1, 0);
const along = new Vector3();
const facing = new Vector3();
const quaternion = new Quaternion();
const basis = new Matrix4();
const scale = new Vector3();
const where = new Vector3();

export function Bunting({
  from,
  to,
  sag = 0.4,
  spacing = 0.42,
  colors = BUNTING_COLORS,
  seed = 1,
  bulbs = false,
}: {
  /** Points d'attache, dans le repère du parent. */
  from: Vec3;
  to: Vec3;
  /** Creux de la corde au milieu (mètres). */
  sag?: number;
  /** Écart entre deux fanions (mètres). */
  spacing?: number;
  colors?: string[];
  seed?: number;
  /** Ampoules de guinguette entre les fanions (allumées du crépuscule à l'aube). */
  bulbs?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const bulbMesh = useRef<InstancedMesh>(null);
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  const span = Math.hypot(tx - fx, ty - fy, tz - fz);
  const count = Math.max(2, Math.floor(span / spacing));

  const rope = useMemo(() => {
    const builder = new MeshBuilder();
    const segments = 14;
    const start: Vec3 = [fx, fy, fz];
    const end: Vec3 = [tx, ty, tz];
    for (let index = 0; index < segments; index++) {
      const a = new Vector3(...ropeAt(start, end, sag, index / segments));
      const b = new Vector3(...ropeAt(start, end, sag, (index + 1) / segments));
      const length = a.distanceTo(b);
      const segment = new CylinderGeometry(0.018, 0.018, length * 1.02, 5, 1);
      quaternion.setFromUnitVectors(up, along.subVectors(b, a).normalize());
      basis.compose(where.addVectors(a, b).multiplyScalar(0.5), quaternion, scale.set(1, 1, 1));
      builder.add(segment, '#d9bd86', basis);
    }
    return builder.build()!;
  }, [fx, fy, fz, sag, tx, ty, tz]);

  const geometry = useMemo(() => {
    const result = PENNANT.clone();
    const data = new Float32Array(count * 2);
    for (let index = 0; index < count; index++) data.set([0.6 + hash(seed + index * 3.1) * 0.4, hash(seed + index * 7.9)], index * 2);
    result.setAttribute('aPennant', new InstancedBufferAttribute(data, 2));
    return result;
  }, [count, seed]);

  useLayoutEffect(() => () => {
    rope.dispose();
    geometry.dispose();
  }, [geometry, rope]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const start: Vec3 = [fx, fy, fz];
    const end: Vec3 = [tx, ty, tz];
    const tint = new Color();
    const matrix = new Matrix4();
    // Repère du fanion : x le long de la corde, y vertical, z = normale (sous le vent).
    along.set(tx - fx, 0, tz - fz).normalize();
    facing.crossVectors(along, up).normalize();
    basis.makeBasis(along, up, facing);
    quaternion.setFromRotationMatrix(basis);
    for (let index = 0; index < count; index++) {
      const t = (index + 0.5) / count;
      where.set(...ropeAt(start, end, sag, t));
      matrix.compose(where, quaternion, scale.set(1, 0.9 + hash(seed + index * 5.3) * 0.2, 1));
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, tint.set(colors[index % colors.length]));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
    if (target.boundingSphere) target.boundingSphere.radius += 0.5;
    // Une ampoule entre deux fanions, accrochée sous la corde.
    const lights = bulbMesh.current;
    if (!lights) return;
    for (let index = 1; index < count; index++) {
      where.set(...ropeAt(start, end, sag, index / count));
      matrix.makeTranslation(where.x, where.y, where.z);
      lights.setMatrixAt(index - 1, matrix);
      lights.setColorAt(index - 1, tint.set(index % 3 === 0 ? '#ffd9b8' : index % 3 === 1 ? '#fff1c9' : '#ffe6a6'));
    }
    lights.instanceMatrix.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
    lights.computeBoundingSphere();
  }, [bulbs, colors, count, fx, fy, fz, sag, seed, tx, ty, tz]);

  useFrame((state) => {
    tickWind(state.clock.elapsedTime);
    if (!bulbs) return;
    // Les ampoules s'allument avec le soir ; un léger frémissement de filament.
    const dusk = Math.min(1, Math.max(0, (skyState.dayNight - 0.22) / 0.45));
    const flicker = 0.95 + Math.sin(state.clock.elapsedTime * 7.3) * 0.03 + Math.sin(state.clock.elapsedTime * 2.1) * 0.02;
    BULB_MATERIAL.emissiveIntensity = (0.08 + skyState.golden * 0.35 + dusk * 2.4) * flicker;
  });

  return (
    <group>
      <mesh geometry={rope} material={ROPE_MATERIAL} castShadow={false} raycast={() => null} />
      <instancedMesh key={count} ref={mesh} args={[geometry, PENNANT_MATERIAL, count]} castShadow receiveShadow={false} raycast={() => null} />
      {bulbs && count > 1 && (
        <instancedMesh key={`bulbs-${count}`} ref={bulbMesh} args={[BULB, BULB_MATERIAL, count - 1]} castShadow={false} receiveShadow={false} raycast={() => null} />
      )}
    </group>
  );
}
