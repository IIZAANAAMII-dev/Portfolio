'use client';

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, DoubleSide, ShaderMaterial, Vector3, Vector4 } from 'three';
import { homeIsland, islands } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { WAVE_GLSL } from '@/lib/waves';

const OCEAN_SIZE = 1200;
const SHOAL_COUNT = 7;

const DAY_DEEP = new Color('#07547a');
const NIGHT_DEEP = new Color('#01060c');
const DAY_SHALLOW = new Color('#20b8c4');
const NIGHT_SHALLOW = new Color('#041822');
const DAY_LAGOON = new Color('#72e1d0');
const NIGHT_LAGOON = new Color('#072830');
const DAY_FOAM = new Color('#edf6ec');
const NIGHT_FOAM = new Color('#00f5d4');
const DAY_SKY_TOP = new Color('#4a8ab0');
const NIGHT_SKY_TOP = new Color('#1f3a4c');
const DAY_SKY_HORIZON = new Color('#b3d8df');
const NIGHT_SKY_HORIZON = new Color('#4a6170');
const DAY_SUN = new Vector3(60, 70, 40).normalize();
const NIGHT_SUN = new Vector3(-55, 60, -35).normalize();

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
uniform vec4 uShoals[${SHOAL_COUNT}];
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

void main() {
  vec2 microUv = vWorld.xz * 0.34;
  float microA = valueNoise(microUv + vec2(uTime * 0.07, -uTime * 0.05));
  float microB = valueNoise(microUv * 1.83 + vec2(-uTime * 0.11, uTime * 0.08));
  vec2 microSlope = vec2(dFdx(microA + microB), dFdy(microA + microB)) * 0.12;
  vec3 normal = normalize(vec3(-vSlope.x - microSlope.x, 1.0, -vSlope.y - microSlope.y));

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
  vec2 cloudUv = vWorld.xz * 0.012 + vec2(uTime * 0.006, -uTime * 0.002);
  float cloudField = valueNoise(cloudUv) * 0.65 + valueNoise(cloudUv * 2.1 + 7.3) * 0.35;
  float cloudReflection = smoothstep(0.62, 0.82, cloudField) * fresnel * 0.075;
  water = mix(water, vec3(0.72, 0.82, 0.84), cloudReflection);

  float lambert = max(dot(normal, normalize(uSun)), 0.0);
  float lit = mix(lambert, floor(lambert * 5.0) / 5.0, 0.38);
  vec3 halfDir = normalize(normalize(uSun) + viewDir);
  float roughness = mix(0.34, 0.62, microA);
  float spec = pow(max(dot(normal, halfDir), 0.0), mix(54.0, 18.0, roughness));
  water += vec3(1.0, 0.95, 0.84) * spec * mix(0.95, 0.45, roughness);
  water *= 0.78 + lit * 0.52;

  float sparkleMask = hash21(floor(vWorld.xz * 2.8) + floor(uTime * 2.0));
  float sparkle = smoothstep(0.78, 0.98, spec) * smoothstep(0.91, 1.0, sparkleMask) * uSparkle;
  water = mix(water, vec3(1.0, 0.98, 0.88), sparkle * 0.8);

  float crestNoise = valueNoise(vWorld.xz * 0.5 - vec2(uTime * 0.12, 0.0));
  float crest = smoothstep(0.48, 0.61, vHeight + crestNoise * 0.055) * 0.075;
  float shoreBand = 1.0 - smoothstep(0.35, 2.6, max(edge, 0.0));
  float shorePulse = smoothstep(0.42, 0.68,
    0.5 + 0.5 * sin(edge * 1.65 - uTime * 1.55 + valueNoise(vWorld.xz * 0.22) * 4.0));
  float foamBreakup = smoothstep(0.30, 0.72, valueNoise(vWorld.xz * 0.62 + uTime * 0.025));
  // Assombrissement nocturne : l'eau devient très sombre, l'écume reste claire.
  water *= mix(vec3(1.0), vec3(0.18, 0.24, 0.32), uDayNight);

  // Une légère absorption vers le grand fond renforce la sensation de volume sans réfraction coûteuse.
  water *= mix(0.92, 1.03, shallow);

  float foamAmt = clamp(crest * 1.6 + shoreBand * shorePulse * mix(0.35, 0.95, foamBreakup), 0.0, 0.85);
  // Écume plus lumineuse la nuit, presque phosphorescente au bord des îles.
  vec3 foamColor = uFoam * (1.0 + uDayNight * 1.6);
  water = mix(water, foamColor, foamAmt);

  // La profondeur est simulée dans la couleur pour éviter les artefacts de tri d'un
  // immense plan transparent. Les poissons sont composés au-dessus avec une teinte eau.
  vec3 seabedTint = mix(vec3(0.08, 0.48, 0.55), vec3(0.36, 0.78, 0.68), depthTexture);
  water = mix(water, seabedTint, lagoon * 0.34 * (1.0 - fresnel) * (1.0 - uDayNight));
  // Le lagon laisse franchement voir le fond, tandis que le large conserve sa masse.
  // Aux angles rasants le Fresnel rend naturellement la surface plus réfléchissante.
  float baseAlpha = mix(0.74, 0.46, shallow);
  baseAlpha = mix(baseAlpha, 0.94, fresnel);
  baseAlpha += foamAmt * 0.16 + uDayNight * 0.18;
  gl_FragColor = vec4(water, clamp(baseAlpha, 0.44, 0.98));
  #include <colorspace_fragment>
}
`;

export function Ocean() {
  const material = useRef<ShaderMaterial>(null);
  const seabedMaterial = useRef<ShaderMaterial>(null);
  const dayNightRef = useRef(0);
  const sailToPoint = useWorld((s) => s.sailToPoint);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
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
      uShoals: {
        value: [
          new Vector4(homeIsland.position[0], homeIsland.position[1], homeIsland.radius, 0),
          ...islands.map((island) => new Vector4(island.position[0], island.position[1], island.radius, 0)),
        ],
      },
    }),
    [],
  );

  useFrame((state, dt) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value += Math.min(dt, 1 / 20);
    material.current.uniforms.uCameraPos.value.copy(state.camera.position);
    if (seabedMaterial.current) seabedMaterial.current.uniforms.uTime.value += Math.min(dt, 1 / 20);

    const delta = Math.min(dt, 1 / 20);
    const { timeOfDay } = useWorld.getState();
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(angle);
    const target = 1 - smoothstep(-0.2, 0.15, sunElevation);
    const dayNight = damp(dayNightRef.current, target, 2.0, delta);
    dayNightRef.current = dayNight;

    const u = material.current.uniforms;
    u.uDeep.value.copy(DAY_DEEP).lerp(NIGHT_DEEP, dayNight);
    u.uShallow.value.copy(DAY_SHALLOW).lerp(NIGHT_SHALLOW, dayNight);
    u.uLagoon.value.copy(DAY_LAGOON).lerp(NIGHT_LAGOON, dayNight);
    u.uFoam.value.copy(DAY_FOAM).lerp(NIGHT_FOAM, dayNight);
    u.uSkyTop.value.copy(DAY_SKY_TOP).lerp(NIGHT_SKY_TOP, dayNight);
    u.uSkyHorizon.value.copy(DAY_SKY_HORIZON).lerp(NIGHT_SKY_HORIZON, dayNight);
    const sunX = Math.cos(angle) * 80;
    const sunY = Math.max(sunElevation * 70, 10);
    u.uSun.value.set(sunX, sunY, 40).normalize();
    u.uSparkle.value = 0.4 * (1 - dayNight) + 0.15 * dayNight;
    u.uDayNight.value = dayNight;
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
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={seabedVertexShader}
          fragmentShader={seabedFragmentShader}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} onClick={onOceanClick} receiveShadow={false} renderOrder={2}>
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 192, 192]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={DoubleSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
