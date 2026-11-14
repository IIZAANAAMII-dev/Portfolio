'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../terrain-shape';
import { clusterSpots, type ScatterZone, type Spot } from './scatter';
import { inClearing, useClearingLayout } from './useClearingLayout';

/**
 * Rochers taillés à facettes, entièrement procéduraux.
 *
 * Une seule géométrie (une icosphère) pour TOUS les rochers d'une île : chaque exemplaire
 * est sculpté sur le GPU à partir de sa graine — bosses douces, puis de grands plans de
 * coupe (la pierre reste convexe, ses faces sont franches comme taillées au couteau).
 * Galets de plage arrondis, blocs anguleux au pied des falaises, pierres moussues du
 * plateau : un seul draw call (plus son ombre). Le shader peint aussi ce que la pierre
 * raconte : mousse sur le dessus, taches de lichen, ligne d'eau mouillée et balanes.
 */

export type RockKind = 'pebble' | 'boulder' | 'stone';

export interface RockGroup {
  kind: RockKind;
  zone: ScatterZone;
  /** Nombre de groupes (un gros rocher et ses satellites). */
  groups: number;
  seed: number;
  /** Diamètre du rocher principal (mètres). */
  size: [number, number];
  /** Satellites par groupe. */
  satellites?: [number, number];
  /** Mousse (0 → 1) et lichen (0 → 1). */
  moss?: number;
  lichen?: number;
  /** Teintes de la pierre (sinon la palette du type). */
  palette?: string[];
}

/** Pierres chaudes et grises, accordées au sable et aux strates des falaises. */
const PALETTES: Record<RockKind, string[]> = {
  pebble: ['#b9ab98', '#a79a8d', '#c7b59a', '#9d948f', '#b49d86'],
  boulder: ['#a39486', '#958a8f', '#b08b72', '#8f8478', '#a99a8a'],
  stone: ['#a8a195', '#9b958d', '#b3a48f'],
};

const ROCK_PARS = /* glsl */ `
attribute vec4 aRock;
varying vec3 vRockLocal;
varying vec3 vRockWorld;
varying vec4 vRockData;

float rockHash( float n ) {
  return fract( sin( n ) * 43758.5453123 );
}

vec3 rockAxis( float n ) {
  float u = rockHash( n ) * 2.0 - 1.0;
  float a = rockHash( n + 0.618 ) * 6.2831853;
  float s = sqrt( max( 0.0, 1.0 - u * u ) );
  return vec3( s * cos( a ), u, s * sin( a ) );
}

// La pierre : une sphère bosselée, recoupée par des plans (reste convexe, faces franches).
vec3 rockShape( vec3 p, vec4 data ) {
  vec3 dir = normalize( p );
  float seed = data.x;
  float r = 1.0
    + 0.13 * sin( dot( dir, rockAxis( seed + 1.1 ) ) * 3.0 + seed * 2.7 )
    + 0.07 * sin( dot( dir, rockAxis( seed + 2.3 ) ) * 5.0 + seed * 1.3 );
  float depth = mix( 0.95, 0.64, data.z );
  for ( int k = 0; k < 7; k ++ ) {
    float fk = float( k );
    vec3 n = rockAxis( seed * 1.37 + fk * 3.17 );
    float c = dot( dir, n );
    if ( c > 0.08 ) r = min( r, ( depth + rockHash( seed + fk * 7.7 ) * 0.22 ) / c );
  }
  vec3 q = dir * r;
  q.y = max( q.y, - 0.5 );
  return q;
}
`;

const ROCK_VERTEX = /* glsl */ `
#include <begin_vertex>
transformed = rockShape( transformed, aRock );
`;

const ROCK_VARYINGS = /* glsl */ `
#include <project_vertex>
vRockLocal = transformed;
vRockData = aRock;
vRockWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
`;

const ROCK_FRAGMENT_PARS = /* glsl */ `
varying vec3 vRockLocal;
varying vec3 vRockWorld;
varying vec4 vRockData;

float rockHashF( float n ) {
  return fract( sin( n ) * 43758.5453123 );
}

float rockNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float n = dot( i, vec3( 1.0, 57.0, 113.0 ) );
  return mix(
    mix( mix( rockHashF( n ), rockHashF( n + 1.0 ), f.x ), mix( rockHashF( n + 57.0 ), rockHashF( n + 58.0 ), f.x ), f.y ),
    mix( mix( rockHashF( n + 113.0 ), rockHashF( n + 114.0 ), f.x ), mix( rockHashF( n + 170.0 ), rockHashF( n + 171.0 ), f.x ), f.y ),
    f.z );
}
`;

const ROCK_FRAGMENT = /* glsl */ `
#include <color_fragment>
{
  vec3 rockN = normalize( cross( dFdx( vRockWorld ), dFdy( vRockWorld ) ) );
  // Chaque facette a son ton : la pierre se lit taillée même dans l'ombre.
  float facet = rockHashF( dot( floor( rockN * 3.0 + 0.5 ), vec3( 1.0, 7.0, 49.0 ) ) + vRockData.x * 3.7 );
  diffuseColor.rgb *= 0.88 + facet * 0.2;
  // Pied plus sombre : la pierre est posée, pas collée.
  diffuseColor.rgb *= mix( 0.74, 1.0, smoothstep( - 0.5, 0.25, vRockLocal.y ) );
  // Mousse sur les faces tournées vers le ciel, en plaques irrégulières.
  float mossNoise = rockNoise( vRockLocal * 2.6 + vRockData.x );
  float moss = smoothstep( 0.42, 0.72, rockN.y + ( mossNoise - 0.5 ) * 0.7 ) * vRockData.y;
  vec3 mossColor = mix( vec3( 0.27, 0.42, 0.17 ), vec3( 0.47, 0.6, 0.24 ), mossNoise );
  diffuseColor.rgb = mix( diffuseColor.rgb, mossColor, moss );
  // Lichen : petites taches claires, jaunes ou cendrées.
  float lichenNoise = rockNoise( vRockLocal * 6.5 + vRockData.x * 1.9 + 3.1 );
  float lichen = smoothstep( 0.7, 0.76, lichenNoise ) * vRockData.w * ( 1.0 - moss );
  vec3 lichenColor = mix( vec3( 0.86, 0.78, 0.42 ), vec3( 0.84, 0.85, 0.74 ), step( 0.5, rockHashF( vRockData.x * 5.1 ) ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, lichenColor, lichen * 0.9 );
  // Ligne d'eau : pierre mouillée, sombre et bleutée ; balanes blanches juste au-dessus.
  float wetEdge = vRockWorld.y + ( mossNoise - 0.5 ) * 0.16;
  float wet = 1.0 - smoothstep( 0.12, 0.5, wetEdge );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.52, 0.58, 0.6 ), wet * 0.85 );
  float barnacle = step( 0.88, rockHashF( dot( floor( vRockLocal * 9.0 ), vec3( 1.0, 57.0, 113.0 ) ) + vRockData.x ) )
    * smoothstep( - 0.05, 0.15, wetEdge ) * ( 1.0 - smoothstep( 0.32, 0.55, wetEdge ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93, 0.9, 0.83 ), barnacle * 0.85 );
}
`;

function createRockMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.93, metalness: 0, flatShading: true });
  material.name = 'procedural-rocks';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ROCK_PARS}`)
      .replace('#include <begin_vertex>', ROCK_VERTEX)
      .replace('#include <project_vertex>', ROCK_VARYINGS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROCK_FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', ROCK_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'procedural-rocks-v1';
  return material;
}

/** Ombre portée de la forme sculptée (sinon l'ombre serait celle de l'icosphère). */
function createRockDepthMaterial() {
  const material = new MeshDepthMaterial();
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ROCK_PARS}`)
      .replace('#include <begin_vertex>', ROCK_VERTEX);
  };
  material.customProgramCacheKey = () => 'procedural-rocks-depth-v1';
  return material;
}

/** Icosphère de rayon 1 : le shader la sculpte, chaque exemplaire différemment. */
const ROCK_GEOMETRY = new IcosahedronGeometry(1, 1);
const ROCK_MATERIAL = createRockMaterial();
const ROCK_DEPTH = createRockDepthMaterial();

interface RockInstance {
  matrix: Matrix4;
  color: Color;
  data: [number, number, number, number];
  x: number;
  z: number;
  radius: number;
}

const up = new Vector3(0, 1, 0);
const tilt = new Quaternion();
const spin = new Quaternion();
const normal = new Vector3();
const scale = new Vector3();
const where = new Vector3();

function rockInstance(spot: Spot, group: RockGroup, sampler: HeightSampler): RockInstance {
  const key = spot.key;
  const palette = group.palette ?? PALETTES[group.kind];
  const color = new Color(palette[Math.floor(hash(key * 31.7) * palette.length) % palette.length]).multiplyScalar(0.92 + hash(key * 17.3) * 0.14);
  const radius = spot.size / 2;
  // Proportions : galets aplatis, blocs trapus, pierres du plateau à demi enterrées.
  const flat = group.kind === 'pebble' ? 0.42 + hash(key * 5.3) * 0.22 : group.kind === 'boulder' ? 0.68 + hash(key * 5.3) * 0.3 : 0.5 + hash(key * 5.3) * 0.25;
  const stretch = 0.78 + hash(key * 7.1) * 0.3;
  scale.set(radius, radius * flat, radius * stretch);
  // Le rocher épouse un peu la pente.
  const step = 0.4;
  normal.set(
    sampler(spot.x - step, spot.z) - sampler(spot.x + step, spot.z),
    2 * step,
    sampler(spot.x, spot.z - step) - sampler(spot.x, spot.z + step),
  ).normalize();
  normal.lerp(up, 0.55).normalize();
  tilt.setFromUnitVectors(up, normal);
  spin.setFromAxisAngle(up, spot.yaw);
  tilt.multiply(spin);
  const sink = group.kind === 'stone' ? 0.45 : group.kind === 'pebble' ? 0.32 : 0.3;
  where.set(spot.x, spot.y - radius * flat * sink, spot.z);
  const cut = group.kind === 'pebble' ? 0.2 + hash(key * 3.9) * 0.25 : 0.65 + hash(key * 3.9) * 0.35;
  const moss = group.moss ?? (group.kind === 'pebble' ? 0 : 0.5);
  const lichen = group.lichen ?? (group.kind === 'pebble' ? 0.25 : 0.6);
  return {
    matrix: new Matrix4().compose(where, tilt, scale),
    color,
    data: [1 + hash(key * 11.3) * 60, moss * (0.55 + hash(key * 13.7) * 0.45), cut, lichen * hash(key * 19.1)],
    x: spot.x,
    z: spot.z,
    radius,
  };
}

const hidden = new Matrix4().makeScale(0, 0, 0);

/** Tous les rochers d'une île, en un seul draw call. */
export function RockScatter({ sampler, groups, shadows = true }: { sampler: HeightSampler; groups: RockGroup[]; shadows?: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const lean = quality === 'low';
  const groupsKey = JSON.stringify(groups);
  const rocks = useMemo(() => {
    const list: RockInstance[] = [];
    (JSON.parse(groupsKey) as RockGroup[]).forEach((group) => {
      // En basse qualité, moins de satellites : les gros rochers suffisent à la silhouette.
      const satellites: [number, number] = group.satellites ?? (group.kind === 'pebble' ? [1, 3] : [1, 2]);
      const spots = clusterSpots(sampler, group.zone, lean ? Math.ceil(group.groups * 0.7) : group.groups, group.seed, {
        size: group.size,
        bias: 1.4,
        satellites: lean ? [0, Math.max(0, satellites[1] - 1)] : satellites,
        satelliteScale: group.kind === 'pebble' ? [0.35, 0.7] : [0.3, 0.55],
      });
      spots.forEach((spot) => list.push(rockInstance(spot, group, sampler)));
    });
    return list;
  }, [groupsKey, lean, sampler]);

  const geometry = useMemo(() => {
    const result = ROCK_GEOMETRY.clone();
    const data = new Float32Array(Math.max(1, rocks.length) * 4);
    rocks.forEach((rock, index) => data.set(rock.data, index * 4));
    result.setAttribute('aRock', new InstancedBufferAttribute(data, 4));
    return result;
  }, [rocks]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    rocks.forEach((rock, index) => target.setColorAt(index, rock.color));
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [rocks]);

  useClearingLayout((clearings) => {
    const target = mesh.current;
    if (!target) return;
    rocks.forEach((rock, index) => {
      target.setMatrixAt(index, inClearing(clearings, rock.x, rock.z, rock.radius * 0.5) ? hidden : rock.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, rocks);

  if (rocks.length === 0) return null;
  return (
    <instancedMesh
      key={rocks.length}
      ref={mesh}
      args={[geometry, ROCK_MATERIAL, rocks.length]}
      customDepthMaterial={ROCK_DEPTH}
      castShadow={shadows && !lean}
      receiveShadow
      raycast={() => null}
    />
  );
}
