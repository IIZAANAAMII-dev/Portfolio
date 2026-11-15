'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, MathUtils, PerspectiveCamera, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { yellowStaticIsland } from '@/data/yellow-static';
import { BOAT_FRAME } from '@/components/boat/BoatModel';
import { boatState } from '@/lib/boat-state';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { QUALITY_LEVELS } from '@/lib/quality';
import { damp } from '@/lib/utils/math';
import { WAVE_GLSL } from '@/lib/waves';
import {
  bakeCoastMap,
  CREST_STROKES_GLSL,
  emptyCoastMap,
  SHORE_FOAM_GLSL,
  SUN_GLITTER_GLSL,
  wakeTraceGlsl,
  type CoastMap,
} from './ocean-strokes';

const OCEAN_SIZE = 1200;
const SHOAL_COUNT = 11;
/** Trace récente de la poupe : 6 points espacés de 2,4 m, la longueur du sillage dessiné (Wake.tsx). */
const TRAIL_POINTS = 6;
const TRAIL_SPACING = 2.4;

/** Pleine mer partout, en attendant la carte du rivage (cuite après le montage). */
const NO_COAST = emptyCoastMap();

const DAY_DEEP = new Color('#07547a');
const NIGHT_DEEP = new Color('#01060c');
const DAY_SHALLOW = new Color('#20b8c4');
const NIGHT_SHALLOW = new Color('#041822');
const DAY_LAGOON = new Color('#72e1d0');
const NIGHT_LAGOON = new Color('#072830');
const DAY_FOAM = new Color('#edf6ec');
const NIGHT_FOAM = new Color('#a9d8d5');
const DAY_SKY_TOP = new Color('#4a8ab0');
const NIGHT_SKY_TOP = new Color('#1f3a4c');
const DAY_SKY_HORIZON = new Color('#b3d8df');
const NIGHT_SKY_HORIZON = new Color('#4a6170');
const GOLDEN_SKY_TOP = new Color('#7a6a8f');
const GOLDEN_SKY_HORIZON = new Color('#f5a35e');

const seabedVertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const seabedFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uNight;
varying vec3 vWorld;
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}
float smoothGrain(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}
void main() {
  float grain = smoothGrain(vWorld.xz * 0.42);
  float dunes = 0.5 + 0.5 * sin(vWorld.x * 0.075 + sin(vWorld.z * 0.055) * 2.2);
  float causticA = sin(vWorld.x * 0.72 + uTime * 0.28) * sin(vWorld.z * 0.64 - uTime * 0.22);
  float causticB = sin((vWorld.x + vWorld.z) * 0.43 - uTime * 0.18);
  float caustics = smoothstep(0.58, 0.94, causticA * 0.5 + causticB * 0.25 + 0.5);
  vec3 sand = mix(vec3(0.16, 0.58, 0.62), vec3(0.34, 0.76, 0.70), dunes * 0.58 + grain * 0.08);
  sand += vec3(0.16, 0.20, 0.12) * caustics * 0.16;
  sand = mix(vec3(0.018, 0.075, 0.082), sand, smoothstep(0.12, 0.72, uReveal));
  // La nuit, le fond s'éteint comme les pentes immergées des îles : pas d'anneau sombre
  // autour des lagons, là où le relief laisse place au fond marin.
  sand *= mix(1.0, 0.24, uNight);
  gl_FragColor = vec4(sand, 1.0);
  #include <colorspace_fragment>
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
${WAVE_GLSL}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += waveHeight(world.xz, uTime);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** Fonctions communes (bruit doux, ombres de nuages, remous, distances). */
const SHARED_GLSL = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

${CLOUD_SHADOW_GLSL}

// Remous dessinés (esprit dessin animé) : dans une grille de cellules, une virgule
// d'écume naît, s'enroule en spirale puis s'efface ; seules certaines cellules en ont.
float swirlFoam(vec2 p, float t) {
  vec2 cell = vec2(12.0);
  vec2 id = floor(p / cell);
  float alive = step(0.5, hash21(id + 7.31));
  vec2 centre = (id + vec2(0.28, 0.28) + vec2(hash21(id), hash21(id + 1.7)) * 0.44) * cell;
  float period = 5.5 + hash21(id + 3.3) * 3.0;
  float phase = fract(t / period + hash21(id + 5.1));
  float life = smoothstep(0.0, 0.22, phase) * (1.0 - smoothstep(0.55, 0.82, phase));
  float a = hash21(id + 9.7) * 6.28318;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * (p - centre);
  float sweep = (atan(q.y, q.x) + 3.14159) / 6.28318;
  float radius = 0.9 + sweep * 1.25 + phase * 0.7;
  float arc = smoothstep(0.0, 0.07, sweep) * (1.0 - smoothstep(0.5 + phase * 0.25, 0.68 + phase * 0.25, sweep));
  float width = 0.17 * (1.0 - sweep * 0.65);
  float band = 1.0 - smoothstep(width * 0.55, width, abs(length(q) - radius));
  return band * arc * life * alive;
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
  return length(p - (a + ab * t));
}
`;

/** Bord des îles (cercles des hauts-fonds) : eaux peu profondes et lagon, couleurs d'origine. */
const SHORE_GLSL = /* glsl */ `
  float edge = 1e4;
  for (int i = 0; i < ${SHOAL_COUNT}; i++) {
    vec2 delta = vWorld.xz - uShoals[i].xy;
    float reach = length(delta);
    // La côte ondule d'au plus 8 % : une île trop loin pour compter (au-delà des 22 m du
    // dégradé, ou derrière une plus proche) n'a pas besoin de son angle.
    if (reach - uShoals[i].z * 1.08 > min(edge, 23.0)) continue;
    float angle = atan(delta.y, delta.x);
    float brokenCoast = sin(angle * 5.0 + float(i) * 1.7) * 0.055
                      + sin(angle * 9.0 - float(i) * 0.9) * 0.025;
    float radius = uShoals[i].z * (1.0 + brokenCoast);
    edge = min(edge, reach - radius);
  }

  float shallow = 1.0 - smoothstep(0.0, 22.0, max(edge, 0.0));
  float depthTexture = valueNoise(vWorld.xz * 0.045) * 0.12;
  float lagoon = smoothstep(0.28, 0.94, shallow) * smoothstep(0.18, 0.72, depthTexture + 0.28);
  vec3 water = mix(uDeep, uShallow, clamp(shallow * 0.94 + depthTexture * shallow, 0.0, 1.0));
  water = mix(water, uLagoon, lagoon * 0.72);
`;

/**
 * Eau dessinée : la houle est lisse (hauteur et pente analytiques au pixel, plus de facettes
 * du maillage ni de micro-bruit), et l'écriture de la mer se limite à des traits de crête
 * nets, des remous, de rares éclats de soleil et l'écume du rivage, posée sur la vraie
 * ligne d'eau des îles. La nuit, la lune trace son chemin de paillettes et le plancton
 * s'allume au bord des plages. Couleurs, lagons, nuit et tempête restent ceux d'origine.
 */
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLagoon;
uniform vec3 uFoam;
uniform vec3 uSun;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uCameraPos;
uniform float uSparkle;
uniform float uDayNight;
uniform float uQuality;
uniform float uReveal;
uniform float uStormColor;
uniform float uMonsterWake;
uniform vec2 uMonsterFrom;
uniform vec2 uMonsterTo;
uniform vec2 uIntroCenter;
uniform float uIntroRadius;
uniform float uIntroFeather;
uniform float uIntroGlow;
uniform vec4 uShoals[${SHOAL_COUNT}];
uniform float uStrokes;
uniform float uCloudTime;
uniform float uPixelAngle;
// Bateau : position (xy) et cap (zw = avant) ; force du sillage (vitesse) ; plancton (nuit).
uniform vec4 uBoat;
uniform float uWake;
uniform float uBio;
// Carte du rivage : distance signée à la ligne d'eau (m) ; rect = origine, côté, présence.
uniform sampler2D uCoast;
uniform vec4 uCoastRect;
varying vec3 vWorld;
${WAVE_GLSL}
${SHARED_GLSL}
${CREST_STROKES_GLSL}
${SUN_GLITTER_GLSL}
${SHORE_FOAM_GLSL}
${wakeTraceGlsl(TRAIL_POINTS)}

// Sens de propagation de la houle principale (voir lib/waves.ts : sin(k·x + ωt) avance
// vers -d), et une seconde famille de traits à peine plus oblique : tout s'écoule dans le
// même sens, la mer reste calme et lisible.
const vec2 SWELL_A = vec2(-0.9839, -0.1789);
const vec2 SWELL_B = vec2(-0.8453, -0.5344);

void main() {
  vec2 p = vWorld.xz;
  // Tailles d'un pixel (m), mesurées hors de tout branchement.
  float pxA = max(fwidth(dot(p, SWELL_A)), 1e-4);
  float pxB = max(fwidth(dot(p, SWELL_B)), 1e-4);
  float px = max(length(fwidth(p)) * 0.6, 1e-4);

  float height = waveHeight(p, uTime);
  vec2 slope = waveSlope(p, uTime);
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  float cameraDistance = length(uCameraPos.xz - p);

${SHORE_GLSL}

  // Vraie ligne d'eau : distance au rivage, qui respire avec la houle (la mer monte et
  // descend sur le sable). Le sable affleure en clair juste devant la plage.
  float coastD = 40.0;
  if (uCoastRect.w > 0.001) coastD = texture2D(uCoast, (p - uCoastRect.xy) / uCoastRect.z).r;
  float coastDyn = coastD + height * 1.3;
  float coastPx = max(fwidth(coastDyn), 1e-4);
  vec2 shore = shoreFoam(coastDyn, p, uTime, coastPx) * uCoastRect.w;
  float shelf = (1.0 - smoothstep(0.3, 3.6, coastD)) * uCoastRect.w;
  water = mix(water, uLagoon, shelf * 0.22);

  vec3 viewDir = normalize(uCameraPos - vWorld);
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  fresnel = 0.035 + 0.965 * pow(fresnel, 3.2);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.8, normal.y));
  water = mix(water, sky, fresnel * 0.58);

  // Reflets de masses nuageuses très diffus : jamais de formes blanches nettes ou
  // de textures qui glissent sur la surface comme un autocollant.
  float cloudReflection = 0.0;
  if (uQuality > 0.75) {
    vec2 cloudUv = p * 0.012 + vec2(uTime * 0.006, -uTime * 0.002);
    float cloudField = valueNoise(cloudUv) * 0.65 + valueNoise(cloudUv * 2.1 + 7.3) * 0.35;
    cloudReflection = smoothstep(0.62, 0.82, cloudField) * fresnel * 0.075;
  }
  water = mix(water, vec3(0.72, 0.82, 0.84), cloudReflection);

  vec3 sunDir = normalize(uSun);
  // Le modelé lit une houle un peu accentuée : de grandes ondulations de lumière, douces.
  vec3 shadeNormal = normalize(vec3(-slope.x * 2.6, 1.0, -slope.y * 2.6));
  float lambert = max(dot(shadeNormal, sunDir), 0.0);
  // Les mêmes paliers « toon » qu'avant, aux marches adoucies : sur une houle lisse, une
  // marche franche dessinerait de longues lignes droites parasites.
  float steps = lambert * 5.0;
  float lit = mix(lambert, (floor(steps) + smoothstep(0.7, 1.0, fract(steps))) / 5.0, 0.38);
  vec3 halfDir = normalize(sunDir + viewDir);
  float specBase = max(dot(normal, halfDir), 0.0);
  // Reflet du soleil large et calme (l'ancienne rugosité moyenne, sans son bruit).
  float spec = pow(specBase, 36.7) * (1.0 - uStormColor * 0.78);
  water += vec3(1.0, 0.95, 0.84) * spec * 0.71;
  water *= 0.78 + lit * 0.52;
  // Modelé de la houle : crêtes un peu plus claires, creux un peu plus denses.
  water *= 1.0 + clamp(height * 2.2, -1.0, 1.0) * 0.06 * (1.0 - uStormColor);

  // Traînée du soleil (ou de la lune), découpée en plaques par la houle (accentuée). Vue
  // rasante : des tirets nets s'y couchent ; vue plongeante : seulement quelques étoiles.
  // Rien hors de la traînée, rien de granuleux.
  float glitterMask = smoothstep(0.3, 0.75, pow(max(dot(shadeNormal, halfDir), 0.0), 24.0))
    * step(0.25, uQuality) * (1.0 - uStormColor);
  float dayGlitter = glitterMask * uSparkle * 2.5 * (1.0 - uDayNight);
  float nightGlitter = glitterMask * uDayNight;
  float grazing = smoothstep(0.62, 0.86, 1.0 - viewDir.y);
  float glitter = 0.0;
  float moonGlitter = 0.0;
  if (dayGlitter + nightGlitter > 0.003) {
    vec2 sunH = normalize(uSun.xz + vec2(1e-4, 0.0));
    if (grazing > 0.001) {
      glitter = sunGlitter(p, sunH, cameraDistance, uCameraPos.y, uPixelAngle, uTime) * grazing;
    }
    // Sous la lune, les étoiles d'éclat restent discrètes : ce sont les tirets qui brillent.
    float glints = sunGlints(p, uTime, px) * (1.0 - grazing * 0.6);
    moonGlitter = max(glitter, glints * 0.3);
    glitter = max(glitter, glints);
  }
  vec3 glitterColor = mix(vec3(1.0, 0.97, 0.88), uSkyHorizon * 1.25, 0.25);
  water = mix(water, glitterColor, clamp(glitter * dayGlitter, 0.0, 1.0));

  float crestNoise = valueNoise(p * 0.5 - vec2(uTime * 0.12, 0.0));
  float crestHeight = height + crestNoise * 0.055;
  float crest = smoothstep(0.48, 0.61, crestHeight)
    * (1.0 - smoothstep(0.72, 0.91, crestHeight)) * 0.028;
  // Près du rivage, la mer est écrite par l'écume du bord : ni trait ni remous.
  float shoreBand = 1.0 - smoothstep(0.35, 3.2, max(edge, 0.0));
  float nearShore = mix(shoreBand, 1.0 - smoothstep(1.2, 5.8, coastD), uCoastRect.w);

  // Sillage net : autour de la coque et derrière la poupe, ni trait ni remous ne viennent
  // brouiller le sillage dessiné (Wake.tsx) ; la nuit, le plancton s'y allume doucement.
  float wakeLane = 0.0;
  float wakeGlow = 0.0;
  vec2 fromBoat = p - uBoat.xy;
  if (dot(fromBoat, fromBoat) < 576.0) {
    vec2 trace = wakeTrace(p);
    float wakeHalf = 1.0 + trace.y * 3.2;
    float lane = (1.0 - smoothstep(wakeHalf, wakeHalf + 1.8, trace.x)) * uWake;
    // Coque : ellipse dans le repère du bateau (x vers l'avant).
    vec2 hull = vec2(dot(fromBoat, uBoat.zw), dot(fromBoat, vec2(-uBoat.w, uBoat.z)));
    float hullDistance = length(hull / vec2(4.2, 1.9));
    wakeLane = max(lane, 1.0 - smoothstep(0.75, 1.25, hullDistance));
    wakeGlow = max(
      exp(-trace.x * trace.x / (wakeHalf * wakeHalf)) * (1.0 - trace.y) * uWake,
      (1.0 - smoothstep(0.55, 1.35, hullDistance)) * (0.3 + 0.7 * uWake)
    );
  }

  // Traits de crête dessinés : ils naissent sur le dos de la houle, avancent avec elle et
  // s'effacent au loin (où ils deviendraient plus fins qu'un pixel) et dans les lagons.
  float strokeFade = (1.0 - smoothstep(45.0, 135.0, cameraDistance)) * uStrokes * (1.0 - wakeLane);
  float crestMask = smoothstep(-0.1, 0.2, height);
  // Un trait vu par le bout se raccourcit et ne montre plus que son ondulation (un
  // « ver ») : les traits alignés avec le regard s'effacent, les traits de travers restent.
  vec2 lookH = normalize(p - uCameraPos.xz + vec2(1e-3, 0.0));
  float sideOnA = 1.0 - smoothstep(0.72, 0.95, abs(dot(lookH, vec2(-SWELL_A.y, SWELL_A.x))));
  float sideOnB = 1.0 - smoothstep(0.72, 0.95, abs(dot(lookH, vec2(-SWELL_B.y, SWELL_B.x))));
  float lines = 0.0;
  if (strokeFade * crestMask > 0.002) {
    if (sideOnA > 0.001) {
      lines = crestStroke(p, SWELL_A, vec2(9.0, 6.0), 0.45, uTime, 3.1, 0.5, 0.16, pxA) * sideOnA;
    }
    if (uQuality > 0.25 && sideOnB > 0.001) {
      lines = max(lines, crestStroke(p, SWELL_B, vec2(12.0, 7.5), 0.3, uTime, 17.3, 0.3, 0.12, pxB) * 0.8 * sideOnB);
    }
  }
  lines *= strokeFade * crestMask * (1.0 - lagoon * 0.5) * (1.0 - nearShore);
  vec3 lineColor = mix(uFoam, uSkyHorizon * 1.12, 0.2) * mix(1.0, 0.92, uDayNight);
  water = mix(water, lineColor, lines * 0.72);

  // Remous au large, plus visibles près de la caméra, absents des lagons.
  float swirl = 0.0;
  if (uQuality > 0.25 && cameraDistance < 115.0 && shallow < 0.999) {
    swirl = swirlFoam(p + vec2(uTime * 0.25, uTime * 0.1), uTime)
      * (1.0 - shallow) * (1.0 - smoothstep(60.0, 115.0, cameraDistance))
      * (1.0 - wakeLane) * (1.0 - nearShore);
  }
  water = mix(water, uFoam, swirl * 0.8);
  float extraAlpha = lines * 0.18;

  // Nuit : plancton bioluminescent réveillé par la coque, le sillage et le ressac (liseré,
  // anneaux et un halo doux le long des plages) ; les traits de crête et les remous en
  // gardent un liseré turquoise. La lune pose sa traînée argentée : un reflet large et
  // des paillettes, au-dessus de l'eau assombrie.
  float shoreHalo = exp(-max(coastDyn, 0.0) * 0.75) * uCoastRect.w;
  vec3 bioLight = (vec3(0.03, 0.46, 0.42) * wakeGlow * 0.75
    + vec3(0.1, 0.56, 0.5) * max(lines, swirl * 0.7) * 0.24
    + vec3(0.05, 0.55, 0.5) * (shore.x * 0.42 + shore.y * 0.32 + shoreHalo * 0.1)) * uBio * (1.0 - uStormColor);
  bioLight += vec3(0.6, 0.72, 0.9) * (pow(specBase, 70.0) * 0.3 + moonGlitter * nightGlitter * 0.85)
    * uDayNight * (1.0 - uStormColor);

  // Ombres de nuages qui glissent sur la mer (de jour).
  if (uDayNight < 0.995) water *= 1.0 - cloudShadow(vWorld.xz, uCloudTime) * 0.2 * (1.0 - uDayNight);
  // Assombrissement nocturne : l'eau devient très sombre, l'écume reste claire.
  water *= mix(vec3(1.0), vec3(0.18, 0.24, 0.32), uDayNight);
  water += bioLight;
  // La couleur appréciée de l'océan reste intacte partout ailleurs. Dans le
  // large interdit, la tempête absorbe presque entièrement la couleur et la transparence.
  float forbidden = smoothstep(0.10, 0.92, uStormColor);
  water = mix(water, vec3(0.0015, 0.005, 0.008), forbidden * 0.96);

  // Une légère absorption vers le grand fond renforce la sensation de volume sans réfraction coûteuse.
  water *= mix(0.92, 1.03, shallow);

  // Tempête : une bande fine sur les crêtes, pas de grandes nappes turquoise pleines.
  float stormFoam = 0.0;
  if (uStorm > 0.001) {
    float stormHeight = smoothstep(0.16, 0.72, height);
    float stormRidge = 0.5 + 0.5 * sin(
      vWorld.x * 0.42 + vWorld.z * 0.19 - uTime * 1.35
      + valueNoise(vWorld.xz * 0.11) * 4.2
    );
    float stormCrest = smoothstep(0.88, 0.965, stormRidge) * stormHeight;
    float stormBreakup = smoothstep(0.36, 0.68,
      valueNoise(vWorld.xz * 0.34 + vec2(uTime * 0.09, -uTime * 0.04)));
    stormFoam = stormCrest * stormBreakup * uStorm * 0.042;
  }
  float monsterFoam = 0.0;
  if (uMonsterWake > 0.001) {
    float monsterDistance = segmentDistance(vWorld.xz, uMonsterFrom, uMonsterTo);
    float monsterBreakup = valueNoise(vWorld.xz * 0.42 + vec2(uTime * 0.18, -uTime * 0.11));
    monsterFoam = (1.0 - smoothstep(1.4, 5.8 + monsterBreakup * 2.4, monsterDistance))
      * uMonsterWake * smoothstep(0.18, 0.78, monsterBreakup + 0.2);
  }
  // Écume du rivage : liseré presque blanc, anneaux un peu plus légers ; la nuit, sur l'eau
  // noire, les anneaux se font plus discrets (une lueur, pas des courbes de niveau).
  float shoreAmt = max(shore.x * mix(0.94, 0.72, uDayNight), shore.y * mix(0.8, 0.4, uDayNight)) * (1.0 - forbidden);
  float foamAmt = clamp(crest * 1.6 + stormFoam + monsterFoam * 0.48 + shoreAmt, 0.0, 0.94);
  // Écume plus lumineuse la nuit, phosphorescente au bord des îles.
  vec3 foamColor = uFoam * mix(1.0, 1.16, uDayNight);
  foamColor = mix(foamColor, vec3(0.28, 0.82, 0.76), monsterFoam * uDayNight * 0.72);
  foamColor = mix(foamColor, vec3(0.42, 0.95, 0.88), shoreAmt * uBio * 0.6);

  // La profondeur est simulée dans la couleur pour éviter les artefacts de tri d'un
  // immense plan transparent. Les poissons sont composés au-dessus avec une teinte eau.
  // (Avant l'écume : le fond teinte l'eau du lagon, jamais le trait d'écume.)
  vec3 seabedTint = mix(vec3(0.08, 0.48, 0.55), vec3(0.36, 0.78, 0.68), depthTexture);
  water = mix(
    water,
    seabedTint,
    lagoon * 0.34 * (1.0 - fresnel) * (1.0 - uDayNight) * (1.0 - forbidden)
  );
  water = mix(water, foamColor, foamAmt);
  // Masque circulaire world-space de la révélation d'introduction.
  float dIntro = length(vWorld.xz - uIntroCenter);
  float introEdge = smoothstep(uIntroRadius - uIntroFeather, uIntroRadius, dIntro);
  // L'intro reste presque noir à l'extérieur, lumineux au centre.
  float localReveal = max(uReveal, 1.0 - introEdge);
  water = mix(vec3(0.0), water, 0.02 + 0.98 * localReveal);

  // Bord lumineux très visible autour du cercle de révélation.
  float glow = exp(-pow((dIntro - uIntroRadius) / (uIntroFeather * 0.42), 2.0)) * uIntroGlow;
  vec3 outWater = vec3(0.0, 0.001, 0.003);
  float introMix = (1.0 - introEdge) + uReveal * introEdge;
  water = mix(outWater, water, introMix);
  water += vec3(1.0, 0.72, 0.34) * glow * 2.6;
  water += vec3(0.4, 0.78, 1.0) * glow * 0.85;

  // Le lagon laisse franchement voir le fond, tandis que le large conserve sa masse.
  // Aux angles rasants le Fresnel rend naturellement la surface plus réfléchissante.
  float baseAlpha = mix(0.74, 0.46, shallow);
  baseAlpha = mix(baseAlpha, 0.94, fresnel);
  // L'écume du rivage est un trait opaque : elle ne se dilue pas dans l'eau claire du lagon.
  baseAlpha += foamAmt * 0.16 + shoreAmt * 0.32 + uDayNight * 0.18 + extraAlpha - shelf * 0.08 * (1.0 - uDayNight);
  // La nuit, le lagon n'a plus rien à montrer : il garde la masse du large au lieu de
  // laisser voir les pentes sombres des îles (plus d'anneau noir autour des côtes).
  baseAlpha = mix(baseAlpha, max(baseAlpha, 0.9), uDayNight);
  // Aucun fond marin ne transparaît dans la zone interdite : la surface devient
  // une masse d'eau noire et opaque, progressivement avec la couverture nuageuse.
  baseAlpha = mix(baseAlpha, 1.0, forbidden);
  baseAlpha *= mix(0.98, 1.0, introMix);
  gl_FragColor = vec4(water, clamp(baseAlpha, 0.55, 1.0));
  #include <colorspace_fragment>
}
`;

export function Ocean() {
  const material = useRef<ShaderMaterial>(null);
  const seabedMaterial = useRef<ShaderMaterial>(null);
  const coast = useRef<CoastMap | null>(null);
  const sailToPoint = useWorld((s) => s.sailToPoint);
  const quality = useWorld((state) => state.quality);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCloudTime: cloudClock,
      uDeep: { value: new Color('#07547a') },
      uShallow: { value: new Color('#20b8c4') },
      uLagoon: { value: new Color('#72e1d0') },
      uFoam: { value: new Color('#edf6ec') },
      uSun: { value: new Vector3(60, 70, 40).normalize() },
      uSkyTop: { value: new Color('#4a8ab0') },
      uSkyHorizon: { value: new Color('#b3d8df') },
      uCameraPos: { value: new Vector3() },
      uSparkle: { value: 0.4 },
      uDayNight: { value: 0 },
      uQuality: { value: 1 },
      uReveal: { value: 0 },
      uStorm: { value: 0 },
      uStormColor: { value: 0 },
      uMonsterWake: { value: 0 },
      uMonsterFrom: { value: new Vector2() },
      uMonsterTo: { value: new Vector2() },
      uIntroCenter: { value: new Vector2() },
      uIntroRadius: { value: 22 },
      uIntroFeather: { value: 6.5 },
      uIntroGlow: { value: 1.2 },
      uStrokes: { value: 1 },
      uPixelAngle: { value: 0.001 },
      uBoat: { value: new Vector4(0, 0, 1, 0) },
      uTrail: { value: Array.from({ length: TRAIL_POINTS }, () => new Vector2(1e4, 1e4)) },
      uWake: { value: 0 },
      uBio: { value: 0 },
      uCoast: { value: NO_COAST },
      uCoastRect: { value: new Vector4(0, 0, 1, 0) },
      uShoals: {
        value: [
          new Vector4(homeIsland.position[0], homeIsland.position[1], homeIsland.radius, 0),
          ...islands.map((island) => new Vector4(island.position[0], island.position[1], island.radius, 0)),
          ...islets.map((islet) => new Vector4(islet.position[0], islet.position[1], islet.radius, 0)),
          new Vector4(yellowStaticIsland.position[0], yellowStaticIsland.position[1], yellowStaticIsland.radius, 0),
        ],
      },
    }),
    [],
  );
  const seabedUniforms = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 }, uNight: { value: 0 } }), []);

  // Carte du rivage : cuite par tranches pendant les temps morts, puis l'écume apparaît.
  useEffect(() => {
    const cancel = bakeCoastMap((map) => {
      coast.current = map;
    });
    return () => {
      cancel();
      coast.current?.texture.dispose();
      coast.current = null;
    };
  }, []);

  useFrame((state, dt) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value += Math.min(dt, 1 / 20);
    material.current.uniforms.uCameraPos.value.copy(state.camera.position);
    const camera = state.camera as PerspectiveCamera;
    if (camera.isPerspectiveCamera) {
      material.current.uniforms.uPixelAngle.value =
        MathUtils.degToRad(camera.fov) / Math.max(state.gl.domElement.height, 1);
    }
    const reveal = useWorld.getState().reveal;
    // Facteurs jour/nuit et heure dorée partagés (une seule vérité : lib/sky.ts).
    const { dayNight, golden, sunAngle: angle, sunElevation } = skyState;
    if (seabedMaterial.current) {
      seabedMaterial.current.uniforms.uTime.value += Math.min(dt, 1 / 20);
      seabedMaterial.current.uniforms.uReveal.value = reveal;
      seabedMaterial.current.uniforms.uNight.value = dayNight;
    }

    const u = material.current.uniforms;
    const map = coast.current;
    if (map && u.uCoast.value !== map.texture) {
      u.uCoast.value = map.texture;
      u.uCoastRect.value.set(map.rect[0], map.rect[1], map.rect[2], 0);
    }
    // Fondu d'apparition en temps réel (borné) : quelques secondes, même sur un appareil lent.
    if (map) u.uCoastRect.value.w = damp(u.uCoastRect.value.w, 1, 1.6, Math.min(dt, 0.2));
    u.uDeep.value.copy(DAY_DEEP).lerp(NIGHT_DEEP, dayNight);
    u.uShallow.value.copy(DAY_SHALLOW).lerp(NIGHT_SHALLOW, dayNight);
    u.uLagoon.value.copy(DAY_LAGOON).lerp(NIGHT_LAGOON, dayNight);
    u.uFoam.value.copy(DAY_FOAM).lerp(NIGHT_FOAM, dayNight);
    // L'eau reflète l'embrasement du ciel au lever / coucher.
    u.uSkyTop.value.copy(DAY_SKY_TOP).lerp(GOLDEN_SKY_TOP, golden * 0.5).lerp(NIGHT_SKY_TOP, dayNight);
    u.uSkyHorizon.value
      .copy(DAY_SKY_HORIZON)
      .lerp(GOLDEN_SKY_HORIZON, golden * 0.75)
      .lerp(NIGHT_SKY_HORIZON, dayNight);
    const sunX = Math.cos(angle) * 80;
    const sunY = Math.max(sunElevation * 70, 10);
    u.uSun.value.set(sunX, sunY, 40).normalize();
    u.uSparkle.value = 0.4 * (1 - dayNight) + 0.15 * dayNight;
    u.uDayNight.value = dayNight;
    u.uQuality.value = reveal < 0.22 ? 0 : quality === 'high' ? 1 : quality === 'medium' ? 0.5 : 0;
    u.uReveal.value = reveal;
    const { introCenter, introRadius, introGlow } = useWorld.getState();
    u.uIntroCenter.value.set(introCenter[0], introCenter[1]);
    u.uIntroRadius.value = introRadius;
    u.uIntroGlow.value = introGlow;
    u.uStrokes.value = (1 - ecologyState.stormCover * 0.7) * (reveal > 0.2 ? 1 : 0.35);
    u.uStorm.value = ecologyState.stormWaves;
    u.uStormColor.value = ecologyState.stormCover;
    u.uMonsterWake.value = ecologyState.monsterWake;
    u.uMonsterFrom.value.set(ecologyState.monsterFromX, ecologyState.monsterFromZ);
    u.uMonsterTo.value.set(ecologyState.monsterToX, ecologyState.monsterToZ);

    // Sillage : même force (vitesse) que le sillage dessiné, et trace de la poupe.
    const { position, heading, speed } = boatState;
    const forwardX = Math.cos(heading);
    const forwardZ = Math.sin(heading);
    u.uBoat.value.set(position.x, position.z, forwardX, forwardZ);
    u.uWake.value = damp(
      u.uWake.value,
      Math.min(Math.max((Math.abs(speed) - 0.35) / 7.15, 0), 1) * (1 - ecologyState.leviathanAttack),
      4,
      Math.min(dt, 1 / 30),
    );
    u.uBio.value = ecologyState.plankton;
    const trail = u.uTrail.value as Vector2[];
    const sternX = position.x - forwardX * BOAT_FRAME.stern * 0.92;
    const sternZ = position.z - forwardZ * BOAT_FRAME.stern * 0.92;
    const step = Math.hypot(sternX - trail[1].x, sternZ - trail[1].y);
    if (step > TRAIL_SPACING * 3) {
      // Premier passage ou bateau replacé (accostage direct) : trace repliée sur la poupe.
      for (const point of trail) point.set(sternX, sternZ);
    } else if (step >= TRAIL_SPACING) {
      for (let index = TRAIL_POINTS - 1; index > 0; index--) trail[index].copy(trail[index - 1]);
    }
    trail[0].set(sternX, sternZ);
  });

  const onOceanClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    sailToPoint([event.point.x, event.point.z]);
  };

  return (
    <group>
      {/* Fond marin visible à travers les lagons translucides. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-2.25}>
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 1, 1]} />
        <shaderMaterial
          ref={seabedMaterial}
          uniforms={seabedUniforms}
          vertexShader={seabedVertexShader}
          fragmentShader={seabedFragmentShader}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} onClick={onOceanClick} receiveShadow={false} renderOrder={2}>
        <planeGeometry args={[
          OCEAN_SIZE,
          OCEAN_SIZE,
          QUALITY_LEVELS[quality].oceanSegments,
          QUALITY_LEVELS[quality].oceanSegments,
        ]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
