'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ClearingContext, MAX_CLEARINGS } from './clearings';
import type { HeightSampler } from './terrain-shape';

/**
 * Herbe en lames : des touffes de lames épaisses et effilées, couchées par le vent, qui
 * donnent aux plateaux leur matière de « jouet peint ». Une seule InstancedMesh par île
 * (un draw call), sans ombre portée ; le vent et les clairières sont calculés sur le GPU.
 */

/** Une lame : 5 sommets sur deux étages, pointe effilée. */
function bladeGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.33, 0.46, 0, 0.33, 0.46, 0, 0, 1, 0]), 3),
  );
  // Normales vers le ciel : la lame prend la lumière du sol, sans facettes sombres.
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  // Dégradé de la lame : pied sombre et froid (occlusion), pointe claire et chaude.
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Float32Array([
      0.4, 0.47, 0.5, 0.4, 0.47, 0.5,
      0.82, 0.86, 0.8, 0.82, 0.86, 0.8,
      1.25, 1.18, 0.86,
    ]), 3),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  return geometry;
}

const BLADE = bladeGeometry();

/** Palette des touffes : herbe fraîche, herbe grasse, herbe brûlée par le soleil. */
const TUFTS = [new Color('#6f9a3c'), new Color('#4f7f33'), new Color('#93a646'), new Color('#c3a94e')];

const shared = {
  uTime: { value: 0 },
  uWind: { value: new Vector3(0.84, 0, 0.54) },
};

const VERTEX_PARS = /* glsl */ `
varying vec2 vGrassWorld;
uniform float uTime;
uniform vec3 uWind;
uniform vec3 uClearings[ ${MAX_CLEARINGS} ];
uniform int uClearingCount;
`;

const VERTEX_MAIN = /* glsl */ `
#include <begin_vertex>
{
  vec3 grassRoot = vec3( instanceMatrix[ 3 ][ 0 ], instanceMatrix[ 3 ][ 1 ], instanceMatrix[ 3 ][ 2 ] );
  // Clairières : pas d'herbe sous les bâtiments, lisière progressive.
  float grassKeep = 1.0;
  for ( int i = 0; i < ${MAX_CLEARINGS}; i ++ ) {
    if ( i >= uClearingCount ) break;
    vec3 clearing = uClearings[ i ];
    grassKeep *= smoothstep( clearing.z * 0.8, clearing.z, distance( grassRoot.xz, clearing.xy ) );
  }
  transformed *= grassKeep;
  vGrassWorld = (modelMatrix * vec4(grassRoot, 1.0)).xz;

  // Vent : la pointe se couche, le pied reste ancré. Les rafales traversent l'île.
  float grassBend = position.y * position.y;
  float gust = sin( uTime * 1.25 - dot( grassRoot.xz, uWind.xz ) * 0.42 ) * 0.5 + 0.5;
  float flutter = sin( uTime * 4.3 + grassRoot.x * 2.3 + grassRoot.z * 1.7 );
  vec3 push = uWind * ( 0.08 + gust * 0.3 + flutter * 0.04 );
  // Poussée exprimée dans le repère de la lame (inverse de la matrice d'instance).
  vec3 axisX = instanceMatrix[ 0 ].xyz;
  vec3 axisY = instanceMatrix[ 1 ].xyz;
  vec3 axisZ = instanceMatrix[ 2 ].xyz;
  vec3 localPush = vec3(
    dot( axisX, push ) / dot( axisX, axisX ),
    dot( axisY, push ) / dot( axisY, axisY ),
    dot( axisZ, push ) / dot( axisZ, axisZ )
  );
  transformed += localPush * grassBend * grassKeep;
  transformed.y -= grassBend * gust * 0.12 * grassKeep;
}
`;

/** Normale non retournée sur la face arrière : les deux faces d'une lame sont éclairées pareil. */
const NORMAL_BEGIN = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createGrassMaterial() {
  const clearings = Array.from({ length: MAX_CLEARINGS }, () => new Vector3(0, 0, 0));
  const uniforms = {
    uClearings: { value: clearings },
    uClearingCount: { value: 0 },
  };
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    vertexColors: true,
  });
  material.name = 'grass-blades';
  material.userData.grass = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', VERTEX_MAIN);
    shader.uniforms.uCloudTime = cloudClock;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGrassWorld;\nuniform float uCloudTime;\n${CLOUD_SHADOW_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - cloudShadow(vGrassWorld, uCloudTime) * 0.2;')
      .replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'grass-blades-v2';
  return material;
}

type GrassUniforms = ReturnType<typeof grassUniformsOf>;
function grassUniformsOf(material: MeshStandardMaterial) {
  return material.userData.grass as { uClearings: { value: Vector3[] }; uClearingCount: { value: number } };
}

interface Blade {
  x: number;
  y: number;
  z: number;
  rotation: number;
  lean: number;
  width: number;
  height: number;
  color: Color;
}

function slope(sampler: HeightSampler, x: number, z: number) {
  const dx = sampler(x + 0.5, z) - sampler(x - 0.5, z);
  const dz = sampler(x, z + 0.5) - sampler(x, z - 0.5);
  const gradient = Math.hypot(dx, dz);
  return gradient / Math.sqrt(1 + gradient * gradient);
}

function angleGap(a: number, b: number) {
  return Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

/** Touffes posées sur le plateau : hors plage, hors pente forte, hors secteur du ponton. */
function plant(
  sampler: HeightSampler,
  {
    radius,
    minHeight,
    avoidAngle,
    tufts,
    seed,
    palette,
  }: { radius: number; minHeight: number; avoidAngle?: number; tufts: number; seed: number; palette: Color[] },
) {
  const blades: Blade[] = [];
  let planted = 0;
  for (let attempt = 1; planted < tufts && attempt < tufts * 14; attempt++) {
    const angle = hash(seed + attempt * 1.37) * Math.PI * 2;
    if (avoidAngle !== undefined && angleGap(angle, avoidAngle) < 0.42) continue;
    const spread = radius * 0.86 * Math.sqrt(hash(seed + attempt * 3.71));
    const cx = Math.cos(angle) * spread;
    const cz = Math.sin(angle) * spread;
    if (sampler(cx, cz) < minHeight || slope(sampler, cx, cz) > 0.34) continue;
    planted += 1;

    const tone = hash(seed + attempt * 8.17);
    const base = palette[tone < 0.4 ? 0 : tone < 0.72 ? 1 : tone < 0.92 ? 2 : 3] ?? palette[0];
    const count = 7 + Math.floor(hash(seed + attempt * 4.91) * 9);
    const tuftRadius = 0.28 + hash(seed + attempt * 6.29) * 0.4;
    const tuftHeight = 0.55 + hash(seed + attempt * 7.43) * 0.5;
    for (let index = 0; index < count; index++) {
      const key = seed + attempt * 13.7 + index * 2.39;
      const a = hash(key) * Math.PI * 2;
      const d = tuftRadius * Math.sqrt(hash(key + 0.71));
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const centre = 1 - (d / tuftRadius) * 0.45;
      blades.push({
        x,
        y: sampler(x, z) - 0.04,
        z,
        // La lame se penche vers l'extérieur de la touffe (l'axe +Z local, après rotation,
        // pointe à l'opposé du centre) : les touffes s'ouvrent en éventail.
        rotation: Math.PI / 2 - a + (hash(key + 1.13) - 0.5) * 0.7,
        lean: (d / tuftRadius) * 0.34 + (hash(key + 2.21) - 0.5) * 0.16,
        width: 0.2 + hash(key + 3.37) * 0.13,
        height: tuftHeight * centre * (0.75 + hash(key + 4.19) * 0.4),
        color: base.clone().multiplyScalar(0.84 + hash(key + 5.53) * 0.3),
      });
    }
  }
  return blades;
}

export function Grass({
  sampler,
  radius,
  plateau,
  avoidAngle,
  seed,
  palette,
}: {
  sampler: HeightSampler;
  radius: number;
  /** Altitude du premier plateau : sous elle, c'est la plage ou la falaise. */
  plateau: number;
  /** Direction du ponton : l'herbe laisse le passage libre (absent : aucun secteur réservé). */
  avoidAngle?: number;
  seed: number;
  /** Quatre couleurs de touffes (de la plus courante à la plus rare). */
  palette?: string[];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const clearings = useContext(ClearingContext);
  const seenVersion = useRef(-1);
  const quality = useWorld((state) => state.quality);
  const density = QUALITY_LEVELS[quality].vegetationDensity;
  const material = useMemo(() => createGrassMaterial(), []);
  const paletteKey = palette?.join('|') ?? '';
  const blades = useMemo(
    () => plant(sampler, {
      radius,
      minHeight: plateau - 0.35,
      avoidAngle,
      tufts: Math.round(radius * radius * 1.9 * density),
      seed,
      palette: paletteKey ? paletteKey.split('|').map((color) => new Color(color)) : TUFTS,
    }),
    [avoidAngle, density, paletteKey, plateau, radius, sampler, seed],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    blades.forEach((blade, index) => {
      dummy.position.set(blade.x, blade.y, blade.z);
      dummy.rotation.set(blade.lean, blade.rotation, 0, 'YXZ');
      dummy.scale.set(blade.width, blade.height, 1);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, blade.color);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [blades]);

  useFrame((state) => {
    shared.uTime.value = state.clock.elapsedTime;
    const target = mesh.current;
    if (!target || !clearings || clearings.version === seenVersion.current) return;
    seenVersion.current = clearings.version;
    const uniforms: GrassUniforms = grassUniformsOf(target.material as MeshStandardMaterial);
    const list = clearings.list();
    list.forEach((clearing, index) => uniforms.uClearings.value[index].set(clearing.x, clearing.z, clearing.radius));
    uniforms.uClearingCount.value = list.length;
  });

  if (blades.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[BLADE, material, blades.length]}
      receiveShadow
      castShadow={false}
      // Des milliers de lames : jamais testées par le pointeur (le clic vise l'île).
      raycast={() => null}
    />
  );
}
