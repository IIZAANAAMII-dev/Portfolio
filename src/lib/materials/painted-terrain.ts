import { Color, MeshStandardMaterial } from 'three';
import { BEACH_HEIGHT, WATERLINE_HEIGHT } from '@/components/islands/terrain-shape';
import { CLOUD_SHADOW_GLSL, cloudClock } from './cloud-shadow';
import type { SubstanceId } from './substances';

/**
 * Relief « peint à la main », sans aucune texture.
 *
 * La couleur vient de la forme : sable sous la ligne de plage (sec et clair en haut, mouillé
 * et plus sombre au bord de l'eau, rides douces), falaise en strates horizontales de tons
 * chauds aux facettes nettes (normales de face), herbe en grandes taches de verts et lisière
 * claire au bord des plateaux. Les couleurs sont choisies une fois pour toutes : propre et
 * lisible comme un décor de jouet, et rien à télécharger.
 */

type Palette = [string, string, string, string];

/** Strates de roche selon le type de falaise. */
const ROCK: Record<string, Palette> = {
  island_cliff: ['#b4633f', '#cb8753', '#9a4d38', '#d8a46d'],
  blocky_stone_cliff: ['#8b8aa3', '#a6a4b8', '#72728c', '#bdb8c6'],
  mossy_island_cliff: ['#80694c', '#97815b', '#6a6c45', '#a8926a'],
};

/** Verts du plateau selon le couvert. */
const GRASS: Record<string, [string, string, string]> = {
  wild_grass: ['#6fa544', '#8dbd4f', '#4f8a3c'],
  earth_and_grass: ['#7c9b47', '#9aae56', '#68803f'],
};

const SAND = { dry: '#f0cf98', light: '#f8e3b6', wet: '#c49767' };

const VERTEX_PARS = /* glsl */ `
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
varying vec2 vTerrainWorld;
`;

const VERTEX_MAIN = /* glsl */ `
#include <worldpos_vertex>
vTerrainPos = position;
vTerrainNormal = normal;
vTerrainWorld = (modelMatrix * vec4(position, 1.0)).xz;
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
varying vec2 vTerrainWorld;
uniform float uCloudTime;
${CLOUD_SHADOW_GLSL}
uniform vec3 uSandDry;
uniform vec3 uSandLight;
uniform vec3 uSandWet;
uniform vec3 uGrassA;
uniform vec3 uGrassB;
uniform vec3 uGrassC;
uniform vec3 uRockA;
uniform vec3 uRockB;
uniform vec3 uRockC;
uniform vec3 uRockD;
uniform vec3 uRockTint;

float terrainHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float terrainNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(terrainHash(i), terrainHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(terrainHash(i + vec3(0.0, 1.0, 0.0)), terrainHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(terrainHash(i + vec3(0.0, 0.0, 1.0)), terrainHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(terrainHash(i + vec3(0.0, 1.0, 1.0)), terrainHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float terrainFbm(vec3 p) {
  return terrainNoise(p) * 0.62 + terrainNoise(p * 2.07 + 3.1) * 0.26 + terrainNoise(p * 4.3 + 7.7) * 0.12;
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec3 tN = normalize(vTerrainNormal);
vec3 tP = vTerrainPos;
float tLarge = terrainFbm(tP * 0.17);
float tSmall = terrainNoise(tP * 1.6);

// Sable : sec et clair en haut de plage, mouillé près de l'eau, rides qui suivent la pente.
float tWet = 1.0 - smoothstep(${WATERLINE_HEIGHT.toFixed(2)} - 0.1, ${WATERLINE_HEIGHT.toFixed(2)} + 0.5, tP.y + (tSmall - 0.5) * 0.14);
vec3 tSand = mix(uSandDry, uSandLight, smoothstep(0.38, 0.72, tLarge));
float tRipple = smoothstep(0.8, 1.0, sin(tP.y * 24.0 + tLarge * 10.0) * 0.5 + 0.5) * (1.0 - tWet);
tSand = mix(tSand, uSandLight * 1.05, tRipple * 0.3);
tSand = mix(tSand, uSandWet, tWet * 0.88);
tSand *= 1.0 - step(0.972, terrainHash(floor(tP * 8.0))) * 0.1;

// Falaise : strates ondulées, bord de strate net, arêtes supérieures éclaircies.
float tLayer = tP.y * 1.1 + tLarge * 0.85 + sin(atan(tP.z, tP.x) * 3.0 + tLarge * 2.0) * 0.14;
float tBand = fract(tLayer);
float tIndex = mod(floor(tLayer), 4.0);
vec3 tRock = tIndex < 0.5 ? uRockA : tIndex < 1.5 ? uRockB : tIndex < 2.5 ? uRockC : uRockD;
tRock *= 0.9 + smoothstep(0.0, 0.14, tBand) * 0.1 + (tSmall - 0.5) * 0.08;
tRock = mix(tRock, tRock * 1.22 + vec3(0.025), smoothstep(0.32, 0.7, tN.y) * 0.55);
tRock *= uRockTint;

// Herbe : grandes taches de trois verts.
vec3 tGrass = mix(uGrassA, uGrassB, smoothstep(0.32, 0.7, tLarge));
tGrass = mix(tGrass, uGrassC, smoothstep(0.6, 0.8, terrainFbm(tP * 0.42 + 7.0)) * 0.65);

float tGrassMask = smoothstep(0.7, 0.8, tN.y + (tSmall - 0.5) * 0.1)
  * smoothstep(${BEACH_HEIGHT.toFixed(2)} + 0.12, ${BEACH_HEIGHT.toFixed(2)} + 0.42, tP.y);
float tSandMask = 1.0 - smoothstep(${BEACH_HEIGHT.toFixed(2)} - 0.12, ${BEACH_HEIGHT.toFixed(2)} + 0.2, tP.y + (tLarge - 0.5) * 0.3);
vec3 tColor = mix(tRock, tGrass, tGrassMask);
tColor = mix(tColor, tSand, tSandMask);
// Lisière claire : l'herbe déborde un peu au-dessus de la falaise.
float tLip = tGrassMask * (1.0 - smoothstep(0.8, 0.9, tN.y)) * (1.0 - tSandMask);
tColor = mix(tColor, uGrassB * 1.15, tLip * 0.45);
diffuseColor.rgb *= tColor * (1.0 - cloudShadow(vTerrainWorld, uCloudTime) * 0.2);
float tCliff = (1.0 - tGrassMask) * (1.0 - tSandMask);
`;

const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
// Facettes nettes sur la roche seulement : la falaise se lit comme des blocs taillés.
vec3 tFacet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
normal = normalize(mix(normal, tFacet, tCliff * 0.8));
`;

const cache = new Map<string, MeshStandardMaterial>();

export function getPaintedTerrainMaterial(cliff: SubstanceId, top: SubstanceId, rockTint?: string) {
  const key = `${cliff}|${top}|${rockTint ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const rock = ROCK[cliff] ?? ROCK.island_cliff;
  const grass = GRASS[top] ?? GRASS.wild_grass;
  const uniforms = {
    uSandDry: { value: new Color(SAND.dry) },
    uSandLight: { value: new Color(SAND.light) },
    uSandWet: { value: new Color(SAND.wet) },
    uGrassA: { value: new Color(grass[0]) },
    uGrassB: { value: new Color(grass[1]) },
    uGrassC: { value: new Color(grass[2]) },
    uRockA: { value: new Color(rock[0]) },
    uRockB: { value: new Color(rock[1]) },
    uRockC: { value: new Color(rock[2]) },
    uRockD: { value: new Color(rock[3]) },
    uRockTint: { value: new Color(rockTint ?? '#ffffff') },
    uCloudTime: cloudClock,
  };
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0 });
  material.name = `painted-terrain:${key}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <worldpos_vertex>', VERTEX_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL);
  };
  material.customProgramCacheKey = () => 'painted-terrain-v2';
  cache.set(key, material);
  return material;
}
