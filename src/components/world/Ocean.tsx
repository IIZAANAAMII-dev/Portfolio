'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { QUALITY_LEVELS } from '@/lib/quality';
import { WAVE_GLSL } from '@/lib/waves';
import { loadSubstanceMap } from '@/lib/materials/substance-material';

const OCEAN_SIZE = 1200;
const SHOAL_COUNT = 10;

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
varying vec3 vWorld;
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}
void main() {
  float grain = hash21(floor(vWorld.xz * 0.42));
  float dunes = 0.5 + 0.5 * sin(vWorld.x * 0.075 + sin(vWorld.z * 0.055) * 2.2);
  float causticA = sin(vWorld.x * 0.72 + uTime * 0.28) * sin(vWorld.z * 0.64 - uTime * 0.22);
  float causticB = sin((vWorld.x + vWorld.z) * 0.43 - uTime * 0.18);
  float caustics = smoothstep(0.58, 0.94, causticA * 0.5 + causticB * 0.25 + 0.5);
  vec3 sand = mix(vec3(0.16, 0.58, 0.62), vec3(0.34, 0.76, 0.70), dunes * 0.58 + grain * 0.08);
  sand += vec3(0.16, 0.20, 0.12) * caustics * 0.16;
  sand = mix(vec3(0.018, 0.075, 0.082), sand, smoothstep(0.12, 0.72, uReveal));
  gl_FragColor = vec4(sand, 1.0);
  #include <colorspace_fragment>
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vHeight;
varying vec2 vSlope;
${WAVE_GLSL}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float h = waveHeight(world.xz, uTime);
  world.y += h;
  vWorld = world.xyz;
  vHeight = h;
  vSlope = waveSlope(world.xz, uTime);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

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
uniform float uStorm;
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
#ifdef OCEAN_TEX
  // « Stylized Ocean Water » (Substance 3D Assets) : normales des vaguelettes et, dans le
  // canal G (rugosité), le masque des traits d'écume peints.
  uniform sampler2D uWaveNormal;
  uniform sampler2D uWaveOrm;
#endif
varying vec3 vWorld;
varying float vHeight;
varying vec2 vSlope;

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

void main() {
  vec2 microUv = vWorld.xz * 0.34;
  float microA = valueNoise(microUv + vec2(uTime * 0.07, -uTime * 0.05));
  float microB = uQuality > 0.25
    ? valueNoise(microUv * 1.83 + vec2(-uTime * 0.11, uTime * 0.08))
    : 0.5;
  vec2 microSlope = vec2(dFdx(microA + microB), dFdy(microA + microB)) * 0.12;
  vec3 normal = normalize(vec3(-vSlope.x - microSlope.x, 1.0, -vSlope.y - microSlope.y));

  // Traits de vagues peints : deux couches qui défilent en sens croisés. Les traits sont
  // couchés le long des crêtes de la houle principale (axe z) et s'effacent au loin, où la
  // répétition du motif deviendrait visible.
  float cameraDistance = length(uCameraPos.xz - vWorld.xz);
  float strokeFade = (1.0 - smoothstep(38.0, 120.0, cameraDistance)) * uStrokes;
  vec2 strokeUvA = vWorld.zx / 7.5 + vec2(uTime * 0.011, uTime * 0.004);
  vec2 rotated = mat2(0.906, -0.423, 0.423, 0.906) * vWorld.zx;
  vec2 strokeUvB = rotated / 11.0 + vec2(-uTime * 0.007, uTime * 0.005);
  float strokes = 0.0;
  #ifdef OCEAN_TEX
    float strokeA = texture2D(uWaveOrm, strokeUvA).g;
    float strokeB = texture2D(uWaveOrm, strokeUvB).g;
    strokes = max(smoothstep(0.46, 0.56, strokeA), smoothstep(0.5, 0.6, strokeB) * 0.75);
    vec3 waveA = texture2D(uWaveNormal, strokeUvA).xyz * 2.0 - 1.0;
    vec3 waveB = texture2D(uWaveNormal, strokeUvB).xyz * 2.0 - 1.0;
    // Repère tangent : u suit z, v suit x (voir strokeUvA).
    normal = normalize(normal + (vec3(waveA.y, 0.0, waveA.x) + vec3(waveB.y, 0.0, waveB.x) * 0.7) * 0.32 * strokeFade);
  #else
    float streakA = valueNoise(vec2(strokeUvA.x * 2.2, strokeUvA.y * 9.0));
    float streakB = valueNoise(vec2(strokeUvB.x * 2.0, strokeUvB.y * 8.0) + 17.0);
    strokes = max(smoothstep(0.76, 0.8, streakA), smoothstep(0.78, 0.82, streakB) * 0.7);
  #endif
  // Plus denses sur les crêtes, presque absents dans les creux.
  strokes *= smoothstep(-0.25, 0.25, vHeight + (microA - 0.5) * 0.3) * strokeFade;

  float edge = 1e4;
  for (int i = 0; i < ${SHOAL_COUNT}; i++) {
    vec2 delta = vWorld.xz - uShoals[i].xy;
    float angle = atan(delta.y, delta.x);
    float brokenCoast = sin(angle * 5.0 + float(i) * 1.7) * 0.055
                      + sin(angle * 9.0 - float(i) * 0.9) * 0.025;
    float radius = uShoals[i].z * (1.0 + brokenCoast);
    edge = min(edge, length(delta) - radius);
  }

  float shallow = 1.0 - smoothstep(0.0, 22.0, max(edge, 0.0));
  float depthTexture = valueNoise(vWorld.xz * 0.045) * 0.12;
  float lagoon = smoothstep(0.28, 0.94, shallow) * smoothstep(0.18, 0.72, depthTexture + 0.28);
  vec3 water = mix(uDeep, uShallow, clamp(shallow * 0.94 + depthTexture * shallow, 0.0, 1.0));
  water = mix(water, uLagoon, lagoon * 0.72);

  vec3 viewDir = normalize(uCameraPos - vWorld);
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  fresnel = 0.035 + 0.965 * pow(fresnel, 3.2);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.8, normal.y));
  water = mix(water, sky, fresnel * 0.58);

  // Reflets de masses nuageuses très diffus : jamais de formes blanches nettes ou
  // de textures qui glissent sur la surface comme un autocollant.
  float cloudReflection = 0.0;
  if (uQuality > 0.75) {
    vec2 cloudUv = vWorld.xz * 0.012 + vec2(uTime * 0.006, -uTime * 0.002);
    float cloudField = valueNoise(cloudUv) * 0.65 + valueNoise(cloudUv * 2.1 + 7.3) * 0.35;
    cloudReflection = smoothstep(0.62, 0.82, cloudField) * fresnel * 0.075;
  }
  water = mix(water, vec3(0.72, 0.82, 0.84), cloudReflection);

  float lambert = max(dot(normal, normalize(uSun)), 0.0);
  float lit = mix(lambert, floor(lambert * 5.0) / 5.0, 0.38);
  vec3 halfDir = normalize(normalize(uSun) + viewDir);
  float roughness = mix(0.34, 0.62, microA);
  float spec = pow(max(dot(normal, halfDir), 0.0), mix(54.0, 18.0, roughness));
  spec *= 1.0 - uStormColor * 0.78;
  water += vec3(1.0, 0.95, 0.84) * spec * mix(0.95, 0.45, roughness);
  water *= 0.78 + lit * 0.52;

  float sparkleMask = hash21(floor(vWorld.xz * 2.8) + floor(uTime * 2.0));
  float sparkle = smoothstep(0.78, 0.98, spec) * smoothstep(0.91, 1.0, sparkleMask)
    * uSparkle * step(0.25, uQuality);
  water = mix(water, vec3(1.0, 0.98, 0.88), sparkle * 0.8);

  float crestNoise = valueNoise(vWorld.xz * 0.5 - vec2(uTime * 0.12, 0.0));
  float crestHeight = vHeight + crestNoise * 0.055;
  float crest = smoothstep(0.48, 0.61, crestHeight)
    * (1.0 - smoothstep(0.72, 0.91, crestHeight)) * 0.028;
  float shoreBand = 1.0 - smoothstep(0.35, 3.2, max(edge, 0.0));
  // Anneaux d'écume nets qui partent de la plage (bords francs, pas de dégradé mou).
  float shorePulse = smoothstep(0.6, 0.66,
    0.5 + 0.5 * sin(edge * 1.65 - uTime * 1.55 + valueNoise(vWorld.xz * 0.22) * 4.0));
  float foamBreakup = uQuality > 0.25
    ? smoothstep(0.30, 0.72, valueNoise(vWorld.xz * 0.62 + uTime * 0.025))
    : 0.62;
  water = mix(water, uFoam * mix(1.0, 0.92, uDayNight), strokes * 0.62);
  // Remous au large, plus visibles près de la caméra, absents des lagons.
  float swirl = swirlFoam(vWorld.xz + vec2(uTime * 0.25, uTime * 0.1), uTime)
    * (1.0 - shallow) * (1.0 - smoothstep(60.0, 115.0, cameraDistance)) * step(0.25, uQuality);
  water = mix(water, uFoam, swirl * 0.8);
  // Ombres de nuages qui glissent sur la mer (de jour).
  water *= 1.0 - cloudShadow(vWorld.xz, uCloudTime) * 0.2 * (1.0 - uDayNight);
  // Assombrissement nocturne : l'eau devient très sombre, l'écume reste claire.
  water *= mix(vec3(1.0), vec3(0.18, 0.24, 0.32), uDayNight);
  // La couleur appréciée de l'océan reste intacte partout ailleurs. Dans le
  // large interdit, la tempête absorbe presque entièrement la couleur et la transparence.
  float forbidden = smoothstep(0.10, 0.92, uStormColor);
  water = mix(water, vec3(0.0015, 0.005, 0.008), forbidden * 0.96);

  // Une légère absorption vers le grand fond renforce la sensation de volume sans réfraction coûteuse.
  water *= mix(0.92, 1.03, shallow);

  // Une bande fine sur les crêtes, pas de grandes nappes turquoise pleines.
  float stormHeight = smoothstep(0.16, 0.72, vHeight);
  float stormRidge = 0.5 + 0.5 * sin(
    vWorld.x * 0.42 + vWorld.z * 0.19 - uTime * 1.35
    + valueNoise(vWorld.xz * 0.11) * 4.2
  );
  float stormCrest = smoothstep(0.88, 0.965, stormRidge) * stormHeight;
  float stormBreakup = smoothstep(0.36, 0.68,
    valueNoise(vWorld.xz * 0.34 + vec2(uTime * 0.09, -uTime * 0.04)));
  float stormFoam = stormCrest * stormBreakup * uStorm * 0.042;
  float monsterDistance = segmentDistance(vWorld.xz, uMonsterFrom, uMonsterTo);
  float monsterBreakup = valueNoise(vWorld.xz * 0.42 + vec2(uTime * 0.18, -uTime * 0.11));
  float monsterFoam = (1.0 - smoothstep(1.4, 5.8 + monsterBreakup * 2.4, monsterDistance))
    * uMonsterWake * smoothstep(0.18, 0.78, monsterBreakup + 0.2);
  float foamAmt = clamp(crest * 1.6 + stormFoam + monsterFoam * 0.48
    + shoreBand * shorePulse * mix(0.35, 0.95, foamBreakup), 0.0, 0.88);
  // Écume plus lumineuse la nuit, presque phosphorescente au bord des îles.
  vec3 foamColor = uFoam * mix(1.0, 1.16, uDayNight);
  foamColor = mix(foamColor, vec3(0.28, 0.82, 0.76), monsterFoam * uDayNight * 0.72);
  water = mix(water, foamColor, foamAmt);

  // La profondeur est simulée dans la couleur pour éviter les artefacts de tri d'un
  // immense plan transparent. Les poissons sont composés au-dessus avec une teinte eau.
  vec3 seabedTint = mix(vec3(0.08, 0.48, 0.55), vec3(0.36, 0.78, 0.68), depthTexture);
  water = mix(
    water,
    seabedTint,
    lagoon * 0.34 * (1.0 - fresnel) * (1.0 - uDayNight) * (1.0 - forbidden)
  );
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
  baseAlpha += foamAmt * 0.16 + uDayNight * 0.18;
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
      uWaveNormal: { value: null },
      uWaveOrm: { value: null },
      uShoals: {
        value: [
          new Vector4(homeIsland.position[0], homeIsland.position[1], homeIsland.radius, 0),
          ...islands.map((island) => new Vector4(island.position[0], island.position[1], island.radius, 0)),
          ...islets.map((islet) => new Vector4(islet.position[0], islet.position[1], islet.radius, 0)),
        ],
      },
    }),
    [],
  );

  // Cartes Substance de l'eau : le shader passe du motif procédural aux traits peints dès
  // qu'elles sont chargées (jeu Adobe si présent, sinon rien : le procédural reste).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSubstanceMap('ocean_water', 'normal'), loadSubstanceMap('ocean_water', 'orm')]).then(
      ([normal, orm]) => {
        const target = material.current;
        if (cancelled || !target || !normal || !orm) return;
        target.uniforms.uWaveNormal.value = normal;
        target.uniforms.uWaveOrm.value = orm;
        target.defines = { ...target.defines, OCEAN_TEX: '' };
        target.needsUpdate = true;
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame((state, dt) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value += Math.min(dt, 1 / 20);
    material.current.uniforms.uCameraPos.value.copy(state.camera.position);
    const reveal = useWorld.getState().reveal;
    if (seabedMaterial.current) {
      seabedMaterial.current.uniforms.uTime.value += Math.min(dt, 1 / 20);
      seabedMaterial.current.uniforms.uReveal.value = reveal;
    }

    // Facteurs jour/nuit et heure dorée partagés (une seule vérité : lib/sky.ts).
    const { dayNight, golden, sunAngle: angle, sunElevation } = skyState;

    const u = material.current.uniforms;
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
          uniforms={{ uTime: { value: 0 }, uReveal: { value: 0 } }}
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
