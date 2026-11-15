'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ClearingContext, type Clearing } from './clearings';
import { tickWind, WIND_GLSL, windUniforms } from './props/wind';
import type { HeightSampler } from './terrain-shape';

/**
 * Arbres tropicaux : des flamboyants à large ombrelle (fleurs de feu dessus, feuillage vert
 * dessous) et quelques arbres verts plus ronds. Le houppier est fait de centaines de
 * petites feuilles instanciées dont la normale est celle des masses qui les portent : le
 * feuillage s'éclaire en volume tout en gardant une silhouette découpée.
 *
 * Le vent est calculé sur le GPU avec le champ partagé (`props/wind`) : les rafales
 * traversent l'île, courbent troncs, branches et houppiers d'un même mouvement (le
 * déplacement croît avec la hauteur au-dessus du pied), et font frémir et miroiter les
 * feuilles. Au crépuscule, des lucioles s'allument sous les houppiers ; de temps en temps,
 * une fleur se détache et tombe en tournoyant. Quatre draw calls par île (feuilles, bois,
 * pétales, lucioles la nuit). Les arbres évitent les clairières des bâtiments.
 */

/* ---------------------------------------------------------------- géométries */

/** Feuille arrondie : un hexagone un peu allongé, centre compris. */
function leafGeometry() {
  const positions = [0, 0, 0];
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 2;
    positions.push(Math.cos(angle) * 0.42, Math.sin(angle) * 0.5, 0);
  }
  const indices: number[] = [];
  for (let index = 1; index <= 6; index++) indices.push(0, index, (index % 6) + 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(7 * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Pétale qui tombe : un petit losange. */
function petalGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, -0.08, 0.055, 0, 0, 0, 0, 0.08, -0.055, 0, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

const LEAF = leafGeometry();
/** Pièce de bois unitaire (tronc, branche) : cône tronqué, pied en y = 0. */
const WOOD = new CylinderGeometry(0.72, 1, 1, 7, 3).translate(0, 0.5, 0);
const PETAL = petalGeometry();

/* ------------------------------------------------------------------- shaders */

/**
 * Flexion d'un arbre : tout point se déplace selon sa hauteur au-dessus du pied (`aTree.xyz`),
 * normalisée par la hauteur du houppier (`aTree.w`). Tronc, branches et feuilles partagent
 * cette fonction : l'arbre plie d'un bloc.
 */
const TREE_PARS = /* glsl */ `
attribute vec4 aTree;
${WIND_GLSL}

vec3 treeBend( vec3 p ) {
  vec2 rootWorld = ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz;
  float gust = windGust( rootWorld );
  float h = clamp( ( p.y - aTree.y ) / aTree.w, 0.0, 1.3 );
  float bend = h * h;
  float breathe = sin( uWindTime * 0.83 + aTree.x * 0.37 + aTree.z * 0.29 );
  vec3 offset = uWindDir * bend * ( 0.06 + breathe * 0.035 + gust * 0.34 );
  // Le houppier s'écrase un peu sous la rafale et oscille en travers.
  offset += vec3( - uWindDir.z, 0.0, uWindDir.x ) * bend * sin( uWindTime * 1.31 + aTree.x ) * ( 0.02 + gust * 0.05 );
  offset.y -= bend * gust * 0.06;
  return offset;
}
`;

const LEAF_PARS = /* glsl */ `
attribute vec3 aSphereNormal;
attribute float aSway;
${TREE_PARS}

float leafFlutter( vec3 leafAt ) {
  return windFlutter( leafAt.xz * 3.1 + leafAt.y * 1.7, 7.0 );
}
`;

/** Normale du houppier, inclinée par la rafale et le frémissement : la lumière ondule. */
const LEAF_NORMAL = /* glsl */ `
vec3 leafAt = instanceMatrix[ 3 ].xyz;
float leafGust = windGust( ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz );
float leafFlicker = leafFlutter( leafAt );
vec3 transformedNormal = normalMatrix * normalize( aSphereNormal + uWindDir * leafGust * 0.42 * aSway + vec3( 0.0, leafFlicker * 0.18 * aSway, 0.0 ) );
`;

const LEAF_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  vec3 at = instanceMatrix[ 3 ].xyz;
  float flutter = leafFlutter( at );
  float gust = windGust( ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz );
  vec3 flutterDir = normalize( vec3( sin( at.x * 12.9 + at.y ), 0.7, cos( at.z * 7.3 - at.y ) ) );
  mvPosition.xyz += treeBend( at ) + flutterDir * flutter * ( 0.016 + gust * 0.045 ) * aSway;
  #ifdef LEAF_SHIMMER
    // Les feuilles qui se retournent accrochent la lumière : le houppier miroite.
    vColor.rgb *= 1.0 + flutter * ( 0.04 + gust * 0.1 ) * aSway;
  #endif
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const WOOD_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  // Contreforts au pied du tronc (aFlare = 1) : cinq racines qui s'évasent.
  float rootMask = aFlare * pow( 1.0 - clamp( position.y, 0.0, 1.0 ), 4.0 );
  float around = atan( position.z, position.x );
  float roots = 0.55 + 0.45 * cos( around * 5.0 + aTree.x * 3.0 );
  transformed.xz *= 1.0 + rootMask * ( 0.6 + 1.3 * roots );
}
`;

const WOOD_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += treeBend( mvPosition.xyz );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

/** Normale non retournée sur la face arrière : les deux faces d'une feuille sont éclairées pareil. */
const NORMAL_BEGIN = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createLeafMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, side: DoubleSide });
  material.name = 'tree-leaves';
  material.defines = { LEAF_SHIMMER: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${LEAF_PARS}`)
      .replace('#include <defaultnormal_vertex>', LEAF_NORMAL)
      .replace('#include <project_vertex>', LEAF_PROJECT);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'tree-leaves-v2';
  return material;
}

/** Ombres portées qui suivent le vent (sinon l'ombre resterait immobile sous l'arbre qui ploie). */
function createDepthMaterial(pars: string, project: string, key: string, vertex?: string) {
  const material = new MeshDepthMaterial();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${pars}`)
      .replace('#include <project_vertex>', project);
    if (vertex) shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', vertex);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

function createWoodMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, flatShading: true });
  material.name = 'tree-wood';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aFlare;\n${TREE_PARS}`)
      .replace('#include <begin_vertex>', WOOD_VERTEX)
      .replace('#include <project_vertex>', WOOD_PROJECT);
  };
  material.customProgramCacheKey = () => 'tree-wood-v2';
  return material;
}

/** Pétales qui tombent : chute en tournoyant, dérive sous le vent, disparition dans l'herbe. */
const PETAL_PARS = /* glsl */ `
attribute vec4 aPetal;
attribute vec4 aSpin;
${TREE_PARS}

vec3 petalRotate( vec3 v, vec3 axis, float angle ) {
  float c = cos( angle );
  float s = sin( angle );
  return v * c + cross( axis, v ) * s + axis * dot( axis, v ) * ( 1.0 - c );
}
`;

const PETAL_PROJECT = /* glsl */ `
vec4 mvPosition;
{
  float period = 7.5 + aSpin.w * 4.0;
  float life = fract( uWindTime / period + aPetal.w );
  vec3 start = aTree.xyz + aPetal.xyz;
  float drop = max( aPetal.y, 0.5 );
  float fall = smoothstep( 0.0, 1.0, life );
  vec3 p = start;
  p.y -= drop * fall;
  // Dérive sous le vent et balancement de feuille morte.
  p.xz += uWindDir.xz * fall * ( 1.6 + windGust( ( modelMatrix * vec4( start, 1.0 ) ).xz ) * 2.2 );
  p.xz += vec2( - uWindDir.z, uWindDir.x ) * sin( life * 18.0 + aPetal.w * 6.2831 ) * 0.35 * fall;
  // Accroché au houppier au début (il plie avec l'arbre), libre ensuite.
  p += treeBend( start ) * ( 1.0 - fall );
  float size = smoothstep( 0.0, 0.06, life ) * ( 1.0 - smoothstep( 0.82, 1.0, life ) ) * length( instanceMatrix[ 0 ].xyz );
  vec3 local = petalRotate( transformed, normalize( aSpin.xyz ), uWindTime * ( 2.0 + aSpin.w * 3.0 ) + aPetal.w * 6.2831 );
  mvPosition = modelViewMatrix * vec4( p + local * size, 1.0 );
}
gl_Position = projectionMatrix * mvPosition;
`;

function createPetalMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0, side: DoubleSide });
  material.name = 'tree-petals';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PETAL_PARS}`)
      .replace('#include <project_vertex>', PETAL_PROJECT);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'tree-petals-v1';
  return material;
}

/** Lucioles : petits points chauds qui errent sous les houppiers et clignotent la nuit. */
const FIREFLY_VERTEX = /* glsl */ `
attribute vec4 aFly;
uniform float uTime;
uniform float uNight;
varying float vGlow;
void main() {
  float t = uTime * ( 0.35 + aFly.w * 0.3 ) + aFly.w * 31.0;
  vec3 p = position;
  p.x += sin( t * 1.3 ) * 0.7 + sin( t * 2.9 + 1.7 ) * 0.25;
  p.z += cos( t * 1.1 + 0.6 ) * 0.7 + sin( t * 3.3 ) * 0.2;
  p.y += sin( t * 0.9 + aFly.w * 4.0 ) * 0.45;
  // Clignotement : longues pauses, brèves lueurs.
  float blink = smoothstep( 0.55, 1.0, sin( uTime * ( 1.3 + aFly.w * 1.7 ) + aFly.w * 47.0 ) );
  vGlow = uNight * ( 0.25 + blink * 0.75 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_PointSize = clamp( ( 2.0 + blink * 2.5 ) * ( 120.0 / max( 1.0, - mv.z ) ), 1.5, 9.0 );
  gl_Position = projectionMatrix * mv;
}
`;

const FIREFLY_FRAGMENT = /* glsl */ `
varying float vGlow;
void main() {
  float d = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.0, 1.0, d ) ) * vGlow;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( vec3( 1.0, 0.88, 0.45 ) * ( 0.6 + ( 1.0 - d ) * 0.8 ), a );
}
`;

const LEAF_MATERIAL = createLeafMaterial();
const LEAF_DEPTH = createDepthMaterial(LEAF_PARS, LEAF_PROJECT.replace('#ifdef LEAF_SHIMMER', '#if 0'), 'tree-leaves-depth-v2');
const WOOD_MATERIAL = createWoodMaterial();
const WOOD_DEPTH = createDepthMaterial(`attribute float aFlare;\n${TREE_PARS}`, WOOD_PROJECT, 'tree-wood-depth-v2', WOOD_VERTEX);
const PETAL_MATERIAL = createPetalMaterial();

/* ---------------------------------------------------------------- dessin */

const FORWARD = new Vector3(0, 0, 1);
const GREEN = new Color('#5e9a44');
const GREEN_LIGHT = new Color('#9cc35a');
const UNDERLEAF = new Color('#4f8238');
const SUNLIT = new Color('#ffc36b');
const BARK = new Color('#7a5034');

interface Leaf {
  offset: Vector3;
  normal: Vector3;
  rotation: Quaternion;
  size: number;
  sway: number;
  color: Color;
}

interface WoodPiece {
  from: Vector3;
  to: Vector3;
  radius: number;
  flare: number;
  color: Color;
}

interface Mass {
  center: Vector3;
  radius: number;
  top: number;
  bottom: number;
}

interface TreeDesign {
  flame: boolean;
  /** Hauteur du sommet du houppier (normalise la flexion). */
  crownTop: number;
  leaves: Leaf[];
  wood: WoodPiece[];
  /** Points de départ des pétales (relatifs au pied). */
  petals: Vector3[];
  /** Points d'ancrage des lucioles (relatifs au pied). */
  flies: Vector3[];
  petalColor: Color;
}

/** Feuilles réparties sur l'écorce d'une masse (surtout en surface : silhouette nette). */
function cover(masses: Mass[], count: number, seed: number, crownCenter: Vector3, crownTop: number, paint: (direction: Vector3, key: number) => Color, size: number) {
  // Les feuilles du cœur du houppier, à l'ombre des autres, sont plus sombres : du volume.
  const leaves: Leaf[] = [];
  const volume = masses.reduce((sum, mass) => sum + mass.radius ** 2, 0);
  for (let index = 0; index < count; index++) {
    const key = seed * 13.1 + index * 1.618;
    let pick = hash(key) * volume;
    let mass = masses[0];
    for (const candidate of masses) {
      pick -= candidate.radius ** 2;
      if (pick <= 0) {
        mass = candidate;
        break;
      }
    }
    const u = hash(key + 0.37) * 2 - 1;
    const phi = hash(key + 0.71) * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const direction = new Vector3(ring * Math.cos(phi), u, ring * Math.sin(phi));
    const distance = mass.radius * (0.62 + 0.38 * Math.cbrt(hash(key + 1.13)));
    const offset = mass.center.clone().addScaledVector(direction, distance);
    offset.y = mass.center.y + direction.y * distance * (direction.y < 0 ? mass.bottom : mass.top);
    // Normale : celle de la masse, adoucie par celle du houppier entier (ombrelle lisse).
    const normal = direction.clone().multiplyScalar(0.62).add(offset.clone().sub(crownCenter).normalize().multiplyScalar(0.38)).normalize();
    const facing = direction.clone().add(new Vector3(hash(key + 3.1) - 0.5, hash(key + 3.7) - 0.5, hash(key + 4.3) - 0.5).multiplyScalar(0.9)).normalize();
    const rotation = new Quaternion()
      .setFromUnitVectors(FORWARD, facing)
      .multiply(new Quaternion().setFromAxisAngle(FORWARD, hash(key + 4.9) * Math.PI * 2));
    leaves.push({
      offset,
      normal,
      rotation,
      size: (0.24 + hash(key + 5.9) * 0.17) * size,
      sway: Math.min(1, Math.max(0.15, offset.y / crownTop)),
      color: paint(direction, key).multiplyScalar(0.84 + 0.22 * Math.min(1, (distance / mass.radius - 0.62) / 0.38)),
    });
  }
  return leaves;
}

function limb(wood: WoodPiece[], from: Vector3, to: Vector3, radius: number, seed: number, color: Color) {
  // Coude : la branche monte d'abord, puis s'étale (allure tortueuse des flamboyants).
  const elbow = from.clone().lerp(to, 0.5).add(new Vector3((hash(seed) - 0.5) * 0.3, 0.22 + hash(seed + 1.1) * 0.2, (hash(seed + 2.3) - 0.5) * 0.3));
  wood.push({ from: from.clone(), to: elbow, radius, flare: 0, color });
  wood.push({ from: elbow, to: to.clone(), radius: radius * 0.74, flare: 0, color });
}

/** Un arbre : flamboyant en ombrelle (parfois à deux troncs) ou arbre vert arrondi. */
function designTree(seed: number, flameHex: Color, density: number): TreeDesign {
  const flame = hash(seed * 1.9) >= 0.3;
  const girth = 0.85 + hash(seed * 8.3) * 0.35;
  const bark = BARK.clone().multiplyScalar(0.9 + hash(seed * 9.1) * 0.2);
  const limbBark = bark.clone().multiplyScalar(1.08);
  const height = flame ? 2.5 + hash(seed * 2.3) * 1.2 : 2.3 + hash(seed * 2.3) * 1.1;
  const crown = flame ? 2.0 + hash(seed * 3.1) * 0.7 : 1.55 + hash(seed * 3.1) * 0.5;
  const lean = (hash(seed * 4.7) - 0.5) * 0.24;
  const leanAngle = hash(seed * 5.3) * Math.PI * 2;
  const tilt = new Vector3(Math.cos(leanAngle) * lean, 0, Math.sin(leanAngle) * lean);
  const mid = new Vector3(tilt.x * height * 0.5 + (hash(seed * 6.7) - 0.5) * 0.18, height * 0.52, tilt.z * height * 0.5 + (hash(seed * 7.3) - 0.5) * 0.18);
  const top = new Vector3(tilt.x * height, height, tilt.z * height);
  const wood: WoodPiece[] = [
    { from: new Vector3(0, -0.15, 0), to: mid, radius: 0.24 * girth, flare: 1, color: bark },
    { from: mid, to: top, radius: 0.19 * girth, flare: 0, color: bark },
  ];
  const crownCenter = top.clone().add(new Vector3(0, crown * (flame ? 0.3 : 0.45), 0));
  const masses: Mass[] = [];
  if (flame) {
    // Ombrelle : une masse centrale et une couronne de masses aplaties, à des hauteurs variées.
    masses.push({ center: crownCenter.clone().add(new Vector3(0, crown * 0.12, 0)), radius: crown * 0.6, top: 0.62, bottom: 0.38 });
    const ring = 4 + Math.floor(hash(seed * 6.1) * 3);
    const fork = hash(seed * 11.9) > 0.6;
    for (let index = 0; index < ring; index++) {
      const angle = (index / ring) * Math.PI * 2 + hash(seed * 7.7) * 2 + (hash(seed + index * 2.9) - 0.5) * 0.5;
      const distance = crown * (0.62 + hash(seed + index * 3.3) * 0.22);
      masses.push({
        center: crownCenter.clone().add(new Vector3(Math.cos(angle) * distance, crown * (-0.04 + hash(seed + index * 5.1) * 0.18), Math.sin(angle) * distance)),
        radius: crown * (0.42 + hash(seed + index * 4.1) * 0.15),
        top: 0.6,
        bottom: 0.34,
      });
    }
    // Branches maîtresses : du haut du tronc (ou de sa fourche) vers chaque masse de la couronne.
    const forks = fork
      ? [top.clone().add(new Vector3(crown * 0.28, crown * 0.18, 0)), top.clone().add(new Vector3(-crown * 0.28, crown * 0.18, crown * 0.1))]
      : [top];
    if (fork) forks.forEach((end, index) => wood.push({ from: top.clone().multiplyScalar(0.96), to: end, radius: 0.15 * girth, flare: 0, color: index ? limbBark : bark }));
    masses.slice(1).forEach((mass, index) => {
      const base = forks.reduce((best, candidate) => (candidate.distanceTo(mass.center) < best.distanceTo(mass.center) ? candidate : best), forks[0]);
      const end = mass.center.clone().lerp(crownCenter, 0.2).setY(mass.center.y - mass.radius * 0.28);
      limb(wood, base.clone().lerp(top, 0.1), end, 0.1 * girth, seed + index * 7.1, limbBark);
    });
  } else {
    // Arbre vert : des masses rondes empilées, plus hautes que larges.
    masses.push({ center: crownCenter.clone(), radius: crown * 0.86, top: 0.86, bottom: 0.62 });
    masses.push({ center: crownCenter.clone().add(new Vector3(crown * 0.12, crown * 0.78, -crown * 0.08)), radius: crown * 0.64, top: 0.9, bottom: 0.7 });
    for (const side of [-1, 1]) {
      const angle = hash(seed * 3.9) * Math.PI * 2 + (side > 0 ? 0 : Math.PI);
      masses.push({ center: crownCenter.clone().add(new Vector3(Math.cos(angle) * crown * 0.55, crown * 0.18, Math.sin(angle) * crown * 0.55)), radius: crown * 0.52, top: 0.86, bottom: 0.6 });
    }
    masses.slice(2).forEach((mass, index) => limb(wood, top.clone().multiplyScalar(0.92), mass.center.clone().lerp(crownCenter, 0.35), 0.085 * girth, seed + index * 5.3, limbBark));
  }
  const crownTop = Math.max(...masses.map((mass) => mass.center.y + mass.radius * mass.top));
  const count = Math.round(masses.reduce((sum, mass) => sum + mass.radius ** 2, 0) * (flame ? 112 : 125) * density);
  const size = 1 / Math.sqrt(Math.max(0.35, density));
  const flameLight = flameHex.clone().lerp(SUNLIT, 0.45);
  const paint = (direction: Vector3, key: number) => {
    const tone = 0.88 + (hash(key + 2.3) - 0.5) * 0.16;
    if (!flame) return GREEN.clone().lerp(GREEN_LIGHT, Math.max(0, direction.y) * 0.6 + hash(key + 6.7) * 0.2).multiplyScalar(tone + 0.04);
    // Fleurs de feu sur le dessus, feuillage vert dessous et en mouchetures.
    const leafy = direction.y < -0.15 ? Math.min(1, (-0.15 - direction.y) * 2.4) : 0;
    if (hash(key + 8.1) < 0.12 + leafy * 0.75) return UNDERLEAF.clone().lerp(GREEN, hash(key + 9.3) * 0.6).multiplyScalar(tone);
    return flameHex.clone().lerp(flameLight, Math.max(0, direction.y) * 0.55 + hash(key + 6.7) * 0.2).multiplyScalar(tone + 0.06);
  };
  const leaves = cover(masses, count, seed, crownCenter, crownTop, paint, size);
  // Pétales : ils partent du dessous des masses de la couronne.
  const petals = flame
    ? Array.from({ length: 6 }, (_, index) => {
      const mass = masses[1 + (index % (masses.length - 1))];
      const angle = hash(seed + index * 3.7) * Math.PI * 2;
      return mass.center.clone().add(new Vector3(Math.cos(angle) * mass.radius * 0.7, -mass.radius * 0.25, Math.sin(angle) * mass.radius * 0.7));
    })
    : [];
  const flies = Array.from({ length: 6 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2 + hash(seed + index * 1.9);
    const distance = crown * (0.45 + hash(seed + index * 2.7) * 0.6);
    return new Vector3(Math.cos(angle) * distance, 0.7 + hash(seed + index * 4.4) * (height * 0.7), Math.sin(angle) * distance);
  });
  return { flame, crownTop, leaves, wood, petals, flies, petalColor: flameLight.clone() };
}

/* ------------------------------------------------------------- emplacements */

interface Spot {
  x: number;
  y: number;
  z: number;
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

/** Emplacements possibles : sur le plateau, loin du ponton et du sommet (le monument). */
function candidateSpots(sampler: HeightSampler, radius: number, plateau: number, avoidAngle: number | undefined, seed: number) {
  const spots: Spot[] = [];
  for (let attempt = 1; spots.length < 14 && attempt < 260; attempt++) {
    const angle = hash(seed + attempt * 2.17) * Math.PI * 2;
    if (avoidAngle !== undefined && angleGap(angle, avoidAngle) < 0.6) continue;
    const spread = radius * (0.34 + hash(seed + attempt * 3.43) * 0.42);
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const y = sampler(x, z);
    if (y < plateau - 0.2 || slope(sampler, x, z) > 0.3) continue;
    spots.push({ x, y: y - 0.1, z });
  }
  return spots;
}

/** Premiers emplacements hors clairières, espacés d'au moins 4,2 m. */
function chooseSpots(spots: Spot[], wanted: number, clearings: Clearing[]) {
  const chosen: Spot[] = [];
  for (const spot of spots) {
    if (chosen.length >= wanted) break;
    if (clearings.some((c) => Math.hypot(spot.x - c.x, spot.z - c.z) < c.radius + 1.4)) continue;
    if (chosen.some((other) => Math.hypot(spot.x - other.x, spot.z - other.z) < 4.2)) continue;
    chosen.push(spot);
  }
  return chosen;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const position = new Vector3();
const scale = new Vector3();
const direction = new Vector3();
const up = new Vector3(0, 1, 0);

/* ------------------------------------------------------------------ montage */

export function Trees({
  sampler,
  radius,
  plateau,
  avoidAngle,
  seed,
  flame,
  count,
}: {
  sampler: HeightSampler;
  radius: number;
  plateau: number;
  /** Direction du ponton, laissée libre (absent : aucun secteur réservé). */
  avoidAngle?: number;
  seed: number;
  /** Couleur des flamboyants de cette île. */
  flame: string;
  count: number;
}) {
  const leaves = useRef<InstancedMesh>(null);
  const woods = useRef<InstancedMesh>(null);
  const petals = useRef<InstancedMesh>(null);
  const flies = useRef<Points>(null);
  const flyMaterial = useRef<ShaderMaterial>(null);
  const clearings = useContext(ClearingContext);
  const seenVersion = useRef(-1);
  const quality = useWorld((state) => state.quality);
  const wanted = quality === 'low' ? Math.max(1, count - 1) : count;
  const density = quality === 'low' ? 0.62 : quality === 'medium' ? 0.85 : 1;
  const petalsPerTree = quality === 'high' ? 6 : quality === 'medium' ? 4 : 0;
  const fliesPerTree = quality === 'low' ? 0 : quality === 'medium' ? 4 : 6;

  const designs = useMemo(() => {
    const color = new Color(flame);
    return Array.from({ length: wanted }, (_, index) => designTree(seed * 7.3 + index * 19.1, color, density));
  }, [density, flame, seed, wanted]);
  const spots = useMemo(() => candidateSpots(sampler, radius, plateau, avoidAngle, seed), [avoidAngle, plateau, radius, sampler, seed]);
  const leafCount = designs.reduce((sum, design) => sum + design.leaves.length, 0);
  const woodCount = designs.reduce((sum, design) => sum + design.wood.length, 0);
  const petalCount = designs.reduce((sum, design) => sum + Math.min(petalsPerTree, design.petals.length), 0);
  const flyCount = designs.length * fliesPerTree;

  // Attributs fixés une fois : normales du houppier, souplesse, épaisseur des racines…
  const geometries = useMemo(() => {
    const leaf = LEAF.clone();
    const normals = new Float32Array(leafCount * 3);
    const sway = new Float32Array(leafCount);
    let cursor = 0;
    for (const design of designs) {
      for (const item of design.leaves) {
        item.normal.toArray(normals, cursor * 3);
        sway[cursor] = item.sway;
        cursor += 1;
      }
    }
    leaf.setAttribute('aSphereNormal', new InstancedBufferAttribute(normals, 3));
    leaf.setAttribute('aSway', new InstancedBufferAttribute(sway, 1));
    leaf.setAttribute('aTree', new InstancedBufferAttribute(new Float32Array(leafCount * 4), 4));
    const wood = WOOD.clone();
    const flare = new Float32Array(Math.max(1, woodCount));
    cursor = 0;
    for (const design of designs) for (const piece of design.wood) flare[cursor++] = piece.flare;
    wood.setAttribute('aFlare', new InstancedBufferAttribute(flare, 1));
    wood.setAttribute('aTree', new InstancedBufferAttribute(new Float32Array(Math.max(1, woodCount) * 4), 4));
    const petal = PETAL.clone();
    const petalData = new Float32Array(Math.max(1, petalCount) * 4);
    const spin = new Float32Array(Math.max(1, petalCount) * 4);
    cursor = 0;
    designs.forEach((design, treeIndex) => {
      design.petals.slice(0, petalsPerTree).forEach((start, index) => {
        const key = seed + treeIndex * 17.3 + index * 3.1;
        petalData.set([start.x, start.y, start.z, hash(key)], cursor * 4);
        direction.set(hash(key + 1.1) - 0.5, hash(key + 2.2) - 0.5, hash(key + 3.3) - 0.5).normalize();
        spin.set([direction.x, direction.y, direction.z, hash(key + 4.4)], cursor * 4);
        cursor += 1;
      });
    });
    petal.setAttribute('aPetal', new InstancedBufferAttribute(petalData, 4));
    petal.setAttribute('aSpin', new InstancedBufferAttribute(spin, 4));
    petal.setAttribute('aTree', new InstancedBufferAttribute(new Float32Array(Math.max(1, petalCount) * 4), 4));
    const fly = new BufferGeometry();
    fly.setAttribute('position', new BufferAttribute(new Float32Array(Math.max(1, flyCount) * 3), 3));
    const flyData = new Float32Array(Math.max(1, flyCount) * 4);
    for (let index = 0; index < flyCount; index++) flyData[index * 4 + 3] = hash(seed + index * 7.9);
    fly.setAttribute('aFly', new BufferAttribute(flyData, 4));
    return { leaf, wood, petal, fly };
  }, [designs, flyCount, leafCount, petalCount, petalsPerTree, seed, woodCount]);

  useLayoutEffect(() => () => {
    geometries.leaf.dispose();
    geometries.wood.dispose();
    geometries.petal.dispose();
    geometries.fly.dispose();
  }, [geometries]);

  const flyUniforms = useMemo(() => ({ uTime: { value: 0 }, uNight: { value: 0 } }), []);

  /** Pose (ou repli à l'échelle zéro) de chaque arbre ; rappelé quand les clairières changent. */
  const layout = (clearingList: Clearing[]) => {
    const leafMesh = leaves.current;
    const woodMesh = woods.current;
    const petalMesh = petals.current;
    const flyPoints = flies.current;
    if (!leafMesh || !woodMesh) return;
    const chosen = chooseSpots(spots, designs.length, clearingList);
    const leafTree = leafMesh.geometry.getAttribute('aTree') as InstancedBufferAttribute;
    const woodTree = woodMesh.geometry.getAttribute('aTree') as InstancedBufferAttribute;
    const petalTree = petalMesh?.geometry.getAttribute('aTree') as InstancedBufferAttribute | undefined;
    const flyPosition = flyPoints?.geometry.getAttribute('position') as BufferAttribute | undefined;
    let leafCursor = 0;
    let woodCursor = 0;
    let petalCursor = 0;
    let flyCursor = 0;
    designs.forEach((design, index) => {
      const spot = chosen[index];
      // Pas de place : l'arbre est replié à l'échelle zéro (ni rendu, ni ombre).
      const visible = spot ? 1 : 0;
      const root = spot ?? { x: 0, y: -50, z: 0 };
      const tree = [root.x, root.y, root.z, design.crownTop] as const;
      for (const piece of design.wood) {
        direction.subVectors(piece.to, piece.from);
        const length = direction.length();
        quaternion.setFromUnitVectors(up, direction.normalize());
        matrix.compose(
          position.set(root.x + piece.from.x, root.y + piece.from.y, root.z + piece.from.z),
          quaternion,
          scale.set(piece.radius * visible, length * visible, piece.radius * visible),
        );
        woodMesh.setMatrixAt(woodCursor, matrix);
        woodTree.setXYZW(woodCursor, ...tree);
        woodCursor += 1;
      }
      for (const leaf of design.leaves) {
        matrix.compose(position.set(root.x + leaf.offset.x, root.y + leaf.offset.y, root.z + leaf.offset.z), leaf.rotation, scale.setScalar(leaf.size * visible));
        leafMesh.setMatrixAt(leafCursor, matrix);
        leafTree.setXYZW(leafCursor, ...tree);
        leafCursor += 1;
      }
      for (let item = 0; item < Math.min(petalsPerTree, design.petals.length); item++) {
        if (petalMesh && petalTree) {
          matrix.makeScale(visible, visible, visible);
          petalMesh.setMatrixAt(petalCursor, matrix);
          petalTree.setXYZW(petalCursor, ...tree);
        }
        petalCursor += 1;
      }
      for (let item = 0; item < fliesPerTree; item++) {
        const anchor = design.flies[item % design.flies.length];
        flyPosition?.setXYZ(flyCursor, root.x + anchor.x, root.y + anchor.y - (visible ? 0 : 100), root.z + anchor.z);
        flyCursor += 1;
      }
    });
    woodMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    leafTree.needsUpdate = true;
    woodTree.needsUpdate = true;
    woodMesh.computeBoundingSphere();
    leafMesh.computeBoundingSphere();
    if (leafMesh.boundingSphere) leafMesh.boundingSphere.radius += 0.6;
    if (petalMesh && petalTree) {
      petalMesh.instanceMatrix.needsUpdate = true;
      petalTree.needsUpdate = true;
    }
    if (flyPosition && flyPoints) {
      flyPosition.needsUpdate = true;
      flyPoints.geometry.computeBoundingSphere();
    }
  };

  useLayoutEffect(() => {
    const leafMesh = leaves.current;
    const woodMesh = woods.current;
    if (!leafMesh || !woodMesh) return;
    let cursor = 0;
    for (const design of designs) for (const leaf of design.leaves) leafMesh.setColorAt(cursor++, leaf.color);
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    cursor = 0;
    for (const design of designs) for (const piece of design.wood) woodMesh.setColorAt(cursor++, piece.color);
    if (woodMesh.instanceColor) woodMesh.instanceColor.needsUpdate = true;
    const petalMesh = petals.current;
    if (petalMesh) {
      cursor = 0;
      for (const design of designs) {
        for (let item = 0; item < Math.min(petalsPerTree, design.petals.length); item++) {
          petalMesh.setColorAt(cursor++, design.petalColor.clone().multiplyScalar(0.92 + hash(seed + cursor * 1.7) * 0.16));
        }
      }
      if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
    }
    seenVersion.current = -1;
  }, [designs, petalsPerTree, seed]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    tickWind(time);
    const night = skyState.dayNight;
    const flyPoints = flies.current;
    if (flyPoints) flyPoints.visible = night > 0.2;
    const material = flyMaterial.current;
    if (material) {
      material.uniforms.uTime.value = time;
      material.uniforms.uNight.value = Math.min(1, (night - 0.2) * 1.6);
    }
    const version = clearings?.version ?? 0;
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    layout(clearings?.list() ?? []);
  });

  if (designs.length === 0) return null;
  return (
    <>
      {/* Pas d'ombres reçues sur les feuilles : l'auto-ombrage ferait des taches ; le volume
          vient des normales du houppier et de la rampe cel-shading. */}
      <instancedMesh
        ref={leaves}
        args={[geometries.leaf, LEAF_MATERIAL, leafCount]}
        customDepthMaterial={LEAF_DEPTH}
        castShadow
        receiveShadow={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={woods}
        args={[geometries.wood, WOOD_MATERIAL, woodCount]}
        customDepthMaterial={WOOD_DEPTH}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      {petalCount > 0 && (
        <instancedMesh
          ref={petals}
          args={[geometries.petal, PETAL_MATERIAL, petalCount]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        />
      )}
      {flyCount > 0 && (
        <points ref={flies} geometry={geometries.fly} visible={false} frustumCulled={false} renderOrder={9} raycast={() => null}>
          <shaderMaterial
            ref={flyMaterial}
            uniforms={flyUniforms}
            vertexShader={FIREFLY_VERTEX}
            fragmentShader={FIREFLY_FRAGMENT}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      )}
    </>
  );
}
