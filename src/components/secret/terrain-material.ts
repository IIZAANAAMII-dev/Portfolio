import { Color, MeshStandardMaterial, Vector2 } from 'three';
import { BEACH_HEIGHT, WATERLINE_HEIGHT } from '@/components/islands/terrain-shape';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { RIFT, siteToIsland } from './layout';

/**
 * Relief de YELLOW STATIC : la même peinture « jouet » que les autres îles (strates de
 * falaise, taches d'herbe, plage mouillée), mais lavée de sa couleur. Herbe jaune-vert
 * maladive, roche grise, sable cendré, mousse sombre au bord des falaises, et un sentier
 * de terre battue piétiné entre la plage et la faille.
 */

const PALETTE = {
  sandDry: '#bdb9a3',
  sandLight: '#cfcdb9',
  sandWet: '#6d6c5d',
  grassA: '#a2a35e',
  grassB: '#b7b26e',
  grassC: '#858c52',
  rockA: '#7c7e78',
  rockB: '#90908a',
  rockC: '#696d66',
  rockD: '#a3a196',
  moss: '#5d6741',
  dirt: '#8d7f5f',
};

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
uniform vec3 uMoss;
uniform vec3 uDirt;
uniform vec2 uPathA;
uniform vec2 uPathB;

float ysHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float ysNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ysHash(i), ysHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(ysHash(i + vec3(0.0, 1.0, 0.0)), ysHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(ysHash(i + vec3(0.0, 0.0, 1.0)), ysHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(ysHash(i + vec3(0.0, 1.0, 1.0)), ysHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float ysFbm(vec3 p) {
  return ysNoise(p) * 0.62 + ysNoise(p * 2.07 + 3.1) * 0.26 + ysNoise(p * 4.3 + 7.7) * 0.12;
}

float ysSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec3 tN = normalize(vTerrainNormal);
vec3 tP = vTerrainPos;
float tLarge = ysFbm(tP * 0.17);
float tSmall = ysNoise(tP * 1.6);

// Sable cendré, mouillé et sombre au bord de l'eau.
float tWet = 1.0 - smoothstep(${WATERLINE_HEIGHT.toFixed(2)} - 0.1, ${WATERLINE_HEIGHT.toFixed(2)} + 0.55, tP.y + (tSmall - 0.5) * 0.14);
vec3 tSand = mix(uSandDry, uSandLight, smoothstep(0.38, 0.72, tLarge));
tSand = mix(tSand, uSandWet, tWet * 0.9);
tSand *= 1.0 - step(0.968, ysHash(floor(tP * 8.0))) * 0.12;

// Falaise : strates grises, arêtes supérieures éclaircies.
float tLayer = tP.y * 1.1 + tLarge * 0.85 + sin(atan(tP.z, tP.x) * 3.0 + tLarge * 2.0) * 0.14;
float tBand = fract(tLayer);
float tIndex = mod(floor(tLayer), 4.0);
vec3 tRock = tIndex < 0.5 ? uRockA : tIndex < 1.5 ? uRockB : tIndex < 2.5 ? uRockC : uRockD;
tRock *= 0.9 + smoothstep(0.0, 0.14, tBand) * 0.1 + (tSmall - 0.5) * 0.08;
tRock = mix(tRock, tRock * 1.18 + vec3(0.02), smoothstep(0.32, 0.7, tN.y) * 0.5);
// Coulures de mousse sombre sous le rebord du plateau.
float tDrip = smoothstep(0.55, 0.8, ysNoise(vec3(tP.x * 2.2, tP.y * 0.4, tP.z * 2.2)));
tRock = mix(tRock, uMoss, tDrip * smoothstep(1.2, 2.0, tP.y) * 0.55);

// Herbe maladive : trois verts jaunis, taches sèches.
vec3 tGrass = mix(uGrassA, uGrassB, smoothstep(0.32, 0.7, tLarge));
tGrass = mix(tGrass, uGrassC, smoothstep(0.6, 0.8, ysFbm(tP * 0.42 + 7.0)) * 0.65);
tGrass = mix(tGrass, uDirt * 1.08, smoothstep(0.66, 0.8, ysFbm(tP * 0.9 + 3.0)) * 0.4);

// Sentier piétiné de la plage à la faille, et terre battue devant la façade.
float tPath = ysSegment(tP.xz, uPathA, uPathB);
float tWorn = 1.0 - smoothstep(0.55, 1.15, tPath + (tSmall - 0.5) * 0.5);
tWorn = max(tWorn, (1.0 - smoothstep(1.4, 2.6, length(tP.xz - uPathB) + (tLarge - 0.5) * 1.2)) * 0.85);
tGrass = mix(tGrass, uDirt * (0.85 + tSmall * 0.25), tWorn);

float tGrassMask = smoothstep(0.7, 0.8, tN.y + (tSmall - 0.5) * 0.1)
  * smoothstep(${BEACH_HEIGHT.toFixed(2)} + 0.12, ${BEACH_HEIGHT.toFixed(2)} + 0.42, tP.y);
float tSandMask = 1.0 - smoothstep(${BEACH_HEIGHT.toFixed(2)} - 0.12, ${BEACH_HEIGHT.toFixed(2)} + 0.2, tP.y + (tLarge - 0.5) * 0.3);
vec3 tColor = mix(tRock, tGrass, tGrassMask);
tColor = mix(tColor, tSand, tSandMask);
// Lisière : mousse sombre qui déborde au-dessus de la falaise.
float tLip = tGrassMask * (1.0 - smoothstep(0.8, 0.9, tN.y)) * (1.0 - tSandMask);
tColor = mix(tColor, uMoss, tLip * 0.5);
diffuseColor.rgb *= tColor * (1.0 - cloudShadow(vTerrainWorld, uCloudTime) * 0.2);
float tCliff = (1.0 - tGrassMask) * (1.0 - tSandMask);
`;

const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
vec3 tFacet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
normal = normalize(mix(normal, tFacet, tCliff * 0.8));
`;

let material: MeshStandardMaterial | null = null;

export function staticTerrainMaterial() {
  if (material) return material;
  const [pathAX, pathAZ] = siteToIsland(0, 8.2);
  const [pathBX, pathBZ] = siteToIsland(RIFT.x, RIFT.z + 1.4);
  const uniforms = {
    uSandDry: { value: new Color(PALETTE.sandDry) },
    uSandLight: { value: new Color(PALETTE.sandLight) },
    uSandWet: { value: new Color(PALETTE.sandWet) },
    uGrassA: { value: new Color(PALETTE.grassA) },
    uGrassB: { value: new Color(PALETTE.grassB) },
    uGrassC: { value: new Color(PALETTE.grassC) },
    uRockA: { value: new Color(PALETTE.rockA) },
    uRockB: { value: new Color(PALETTE.rockB) },
    uRockC: { value: new Color(PALETTE.rockC) },
    uRockD: { value: new Color(PALETTE.rockD) },
    uMoss: { value: new Color(PALETTE.moss) },
    uDirt: { value: new Color(PALETTE.dirt) },
    uPathA: { value: new Vector2(pathAX, pathAZ) },
    uPathB: { value: new Vector2(pathBX, pathBZ) },
    uCloudTime: cloudClock,
  };
  const created = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.97, metalness: 0 });
  created.name = 'yellow-static-terrain';
  created.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <worldpos_vertex>', VERTEX_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', FRAGMENT_COLOR)
      .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL);
  };
  created.customProgramCacheKey = () => 'yellow-static-terrain-v1';
  material = created;
  return created;
}

/** Touffes d'herbe : jaune-vert pâle, herbe grasse terne, paille, herbe morte. */
export const GRASS_PALETTE = ['#a3a55c', '#8c9550', '#c2b974', '#a8946a'];
