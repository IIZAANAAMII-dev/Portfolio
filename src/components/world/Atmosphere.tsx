'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Fog, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { damp, hash, smoothstep } from '@/lib/utils/math';

const NIGHT = new Color('#04070a');
const INTRO_FOG = new Color('#020408');
const DAWN_LOW = new Color('#b55a3f');
const DAWN_HIGH = new Color('#143c5e');
const SKY_LOW = new Color('#70bad4');
const SKY_HIGH = new Color('#2b6a8f');
const SUN_RISE = new Color('#ffb57a');
const SUN_DAY = new Color('#fff4e0');

const DAY_HORIZON = new Color('#a7d2e6');
const GOLDEN_LOW = new Color('#e8834f');
const GOLDEN_HIGH = new Color('#3d4d74');
const GOLDEN_HORIZON = new Color('#ffab5e');

const NIGHT_SKY_LOW = new Color('#0f2433');
const NIGHT_SKY_HIGH = new Color('#0a1422');
const NIGHT_HORIZON = new Color('#1e2f3d');
const NIGHT_SUN_COLOR = new Color('#c8dce8');
const NIGHT_SUN_SIZE = 0.04;
const NIGHT_SUN_GLOW = 0.5;
const DAY_SUN_POS = new Vector3(60, 70, 40);
const STORM_LOW = new Color('#43545e');
const STORM_HIGH = new Color('#172530');
const STORM_HORIZON = new Color('#5c6c72');
const STORM_FOG = new Color('#273940');

const vertexShader = /* glsl */ `
uniform vec3 uSun;
varying vec3 vWorld;
varying float vHeight;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vHeight = normalize(world.xyz).y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uSunGlow;
uniform float uReveal;
uniform float uTime;
uniform float uStorm;

varying vec3 vWorld;
varying float vHeight;

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
  // Ciel : une bande lumineuse à l'horizon entre deux tons plus profonds.
  float h = smoothstep(-0.2, 0.55, vHeight);
  vec3 sky = mix(uHorizon, uLow, h);
  sky = mix(sky, uHigh, smoothstep(0.35, 0.9, vHeight));

  // Disque solaire stylisé avec halo diffus.
  vec3 view = normalize(vWorld);
  float cosAngle = dot(view, normalize(uSun));
  float sun = smoothstep(0.995 - uSunSize * 0.4, 0.998, cosAngle);
  float glow = pow(max(cosAngle, 0.0), 32.0 / uSunGlow) * 0.35;
  sky = mix(sky, uSunColor, (sun + glow) * (1.0 - uStorm * 0.92));

  // Deux nappes procédurales très hautes. Elles appartiennent au dôme du ciel :
  // aucun volume sombre ne peut donc traverser ou masquer brutalement la caméra.
  vec2 cloudUv = view.xz / max(0.18, view.y + 0.42);
  float highLayer = valueNoise(cloudUv * 1.15 + vec2(uTime * 0.010, -uTime * 0.004));
  highLayer = highLayer * 0.68
    + valueNoise(cloudUv * 2.35 + vec2(-uTime * 0.007, uTime * 0.009) + 8.7) * 0.32;
  float midLayer = valueNoise(cloudUv * 0.72 + vec2(-uTime * 0.016, uTime * 0.006) - 4.2);
  midLayer = midLayer * 0.58
    + valueNoise(cloudUv * 1.8 + vec2(uTime * 0.012, uTime * 0.005) + 13.1) * 0.42;
  float coverEdge = mix(0.78, 0.43, uStorm);
  float highClouds = smoothstep(coverEdge, 0.9, highLayer) * uStorm;
  float midClouds = smoothstep(coverEdge - 0.06, 0.86, midLayer) * uStorm;
  float altitudeMask = smoothstep(-0.06, 0.26, vHeight);
  vec3 cloudHigh = mix(vec3(0.47, 0.55, 0.59), vec3(0.25, 0.32, 0.37), uStorm);
  vec3 cloudMid = mix(vec3(0.38, 0.46, 0.50), vec3(0.12, 0.19, 0.24), uStorm);
  sky = mix(sky, cloudHigh, highClouds * altitudeMask * 0.6);
  sky = mix(sky, cloudMid, midClouds * altitudeMask * 0.72);

  // Ton légèrement plus lumineux après la révélation.
  sky *= 0.9 + 0.2 * uReveal;

  gl_FragColor = vec4(sky, 1.0);
  #include <colorspace_fragment>
}
`;

// État visuel de l'atmosphère : un seul exemplaire dans la scène, muté à chaque frame.
const uniforms = {
  uLow: { value: NIGHT.clone() },
  uHigh: { value: NIGHT.clone() },
  uHorizon: { value: NIGHT.clone() },
  uSun: { value: DAY_SUN_POS.clone() },
  uSunColor: { value: new Color(SUN_RISE) },
  uSunSize: { value: 0.02 },
  uSunGlow: { value: 0.5 },
  uReveal: { value: 0.0 },
  uTime: { value: 0.0 },
  uStorm: { value: 0.0 },
};
const fogColor = new Color(NIGHT);

/** Quelques nuages stylisés, éloignés, qui dérivent lentement. */
function Clouds() {
  const group = useRef<Group>(null);
  const clouds = useMemo(
    () =>
      [
        { x: -125, z: -105, y: 82, speed: 0.42, direction: 1, scale: 1.15, seed: 3 },
        { x: 45, z: -155, y: 96, speed: 0.27, direction: 1, scale: 1.45, seed: 11 },
        { x: 138, z: -52, y: 72, speed: 0.34, direction: -1, scale: 0.82, seed: 19 },
        { x: -72, z: 128, y: 108, speed: 0.19, direction: 1, scale: 1.25, seed: 29 },
        { x: 105, z: 142, y: 88, speed: 0.23, direction: -1, scale: 0.7, seed: 41 },
      ],
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    const reveal = useWorld.getState().reveal;
    group.current.visible = reveal > 0.22;
    if (!group.current.visible) return;
    const t = state.clock.elapsedTime;
    const storm = ecologyState.stormCover;
    const wind = 1 + ecologyState.stormWind * 4.5;
    group.current.children.forEach((child, index) => {
      const cloud = clouds[index];
      const span = 360;
      const travel = ((t * cloud.speed * wind * cloud.direction + cloud.x + span * 2) % span) - span * 0.5;
      child.position.x = travel;
      child.position.y = cloud.y + Math.sin(t * 0.025 + cloud.seed) * 2.2;
      child.position.z = cloud.z + Math.sin(t * 0.017 + cloud.seed * 0.7) * 9;
    });
    group.current.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return;
      const material = object.material;
      const base = typeof material.userData.calmOpacity === 'number'
        ? material.userData.calmOpacity
        : material.opacity;
      material.userData.calmOpacity = base;
      material.opacity = base * (1 - storm * 0.94);
    });
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.scale} rotation-y={(c.seed % 7) * 0.18}>
          {Array.from({ length: 5 + (c.seed % 4) }, (_, puff) => {
            const angle = puff * 1.83 + c.seed;
            const spread = 5 + puff * 3.2;
            const size = 7 + ((c.seed * (puff + 3)) % 9);
            return (
              <mesh
                key={puff}
                position={[
                  Math.cos(angle) * spread,
                  Math.sin(angle * 1.7) * 3 + (puff % 3) * 1.5,
                  Math.sin(angle) * spread * 0.42,
                ]}
                scale={[size * 1.45, size * 0.42, size]}
              >
                <dodecahedronGeometry args={[1, 0]} />
                <meshBasicMaterial
                  color={puff % 3 === 0 ? '#dce9e9' : '#edf4f1'}
                  transparent
                  opacity={0.16 + (puff % 4) * 0.025}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/**
 * Étoile filante : un trait lumineux qui traverse le ciel nocturne toutes les
 * une à deux minutes. Un seul mesh, réutilisé — le reste du temps il est invisible.
 */
function ShootingStar() {
  const mesh = useRef<Mesh>(null);
  const state = useRef({ waiting: 24 + hash(91.7) * 60, progress: -1, x0: 0, z0: 0, angle: 0 });

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const dt = Math.min(delta, 1 / 20);
    const star = state.current;

    if (star.progress < 0) {
      mesh.current.visible = false;
      // Uniquement la nuit : le compteur ne descend pas en journée.
      if (skyState.dayNight > 0.72 && ecologyState.stormCover < 0.2) star.waiting -= dt;
      if (star.waiting <= 0) {
        star.progress = 0;
        star.x0 = -140 + Math.random() * 280;
        star.z0 = -160 + Math.random() * 120;
        star.angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.35;
      }
      return;
    }

    star.progress += dt / 1.35;
    if (star.progress >= 1 || skyState.dayNight < 0.6) {
      star.progress = -1;
      star.waiting = 45 + Math.random() * 75;
      mesh.current.visible = false;
      return;
    }

    const t = star.progress;
    mesh.current.visible = true;
    mesh.current.position.set(
      star.x0 + Math.cos(star.angle) * t * 190,
      165 - t * 60,
      star.z0 + Math.sin(star.angle) * t * 60,
    );
    mesh.current.rotation.z = -star.angle * 0.4;
    // Fondu d'entrée et de sortie pour éviter toute apparition sèche.
    const fade = Math.min(t / 0.15, 1) * Math.min((1 - t) / 0.3, 1);
    mesh.current.scale.set(6 + t * 6, 0.16, 0.16);
    const material = mesh.current.material as { opacity?: number };
    if (material) material.opacity = fade * 0.9;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#eaf6ff" transparent opacity={0} depthWrite={false} fog={false} />
    </mesh>
  );
}

/**
 * Ciel + brouillard. C'est ce couple qui porte toute la révélation du monde :
 * au départ le brouillard est à quelques mètres, à la fin il touche l'horizon.
 */
export function Atmosphere() {
  const fogRef = useRef<Fog>(null);
  const backgroundRef = useRef<Color>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { reveal } = useWorld.getState();

    // Facteurs jour/nuit et heure dorée : lus depuis la source unique (lib/sky.ts).
    const { dayNight, golden, sunAngle: angle, sunElevation } = skyState;
    const storm = ecologyState.stormCover;

    // Deux temps : la brume se lève d'abord, la lumière du jour arrive ensuite.
    const lift = smoothstep(0.0, 0.55, reveal);
    const dayLight = smoothstep(0.25, 1.0, reveal);

    const low = uniforms.uLow.value.copy(NIGHT).lerp(DAWN_LOW, lift).lerp(SKY_LOW, dayLight);
    low.lerp(GOLDEN_LOW, golden * 0.55);
    low.lerp(NIGHT_SKY_LOW, dayNight);
    low.lerp(STORM_LOW, storm * 0.78);
    const high = uniforms.uHigh.value.copy(NIGHT).lerp(DAWN_HIGH, lift).lerp(SKY_HIGH, dayLight);
    high.lerp(GOLDEN_HIGH, golden * 0.3);
    high.lerp(NIGHT_SKY_HIGH, dayNight);
    high.lerp(STORM_HIGH, storm * 0.88);
    const horizon = uniforms.uHorizon.value
      .copy(NIGHT)
      .lerp(SUN_RISE, lift)
      .lerp(DAY_HORIZON, dayLight);
    // Le coucher / lever embrase l'horizon, progressivement, jamais brutalement.
    horizon.lerp(GOLDEN_HORIZON, golden * 0.85);
    horizon.lerp(NIGHT_HORIZON, dayNight);
    horizon.lerp(STORM_HORIZON, storm * 0.7);

    fogColor.copy(INTRO_FOG).lerp(low, smoothstep(0, 0.35, reveal)).lerp(high, dayLight * 0.35);
    fogColor.lerp(STORM_FOG, storm * 0.78);
    backgroundRef.current?.copy(fogColor);

    const currentFog = fogRef.current;
    if (currentFog) {
      currentFog.color.copy(fogColor);
      currentFog.near = 11 + lift * 39 - storm * 18;
      currentFog.far = 24
        + smoothstep(0.04, 0.96, reveal) * 358
        + (1 - smoothstep(0.0, 0.25, reveal)) * 60
        - storm * 168;
    }

    uniforms.uReveal.value = reveal * (1 - dayNight * 0.4);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uStorm.value = storm;
    uniforms.uSunColor.value
      .copy(SUN_RISE)
      .lerp(SUN_DAY, dayLight)
      .lerp(GOLDEN_HORIZON, golden * 0.7)
      .lerp(NIGHT_SUN_COLOR, dayNight);
    const sunX = Math.cos(angle) * 80;
    const sunY = Math.max(sunElevation * 70, 10);
    uniforms.uSun.value.set(sunX, sunY, 40).normalize();
    uniforms.uSunSize.value = damp(
      uniforms.uSunSize.value,
      (0.06 + dayLight * 0.04) * (1 - dayNight) + NIGHT_SUN_SIZE * dayNight,
      1,
      dt,
    );
    uniforms.uSunGlow.value = damp(
      uniforms.uSunGlow.value,
      (0.5 + dayLight * 0.5) * (1 - dayNight) + NIGHT_SUN_GLOW * dayNight,
      1,
      dt,
    );
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[INTRO_FOG.getHex(), 11, 24]} />
      <color ref={backgroundRef} attach="background" args={[INTRO_FOG.getHex()]} />
      <mesh scale={420}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <Clouds />
      <ShootingStar />
    </>
  );
}
