'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Fog, Group, Vector3 } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

const NIGHT = new Color('#0a1422');
const DAWN_LOW = new Color('#b55a3f');
const DAWN_HIGH = new Color('#143c5e');
const SKY_LOW = new Color('#70bad4');
const SKY_HIGH = new Color('#2b6a8f');
const SUN_RISE = new Color('#ffb57a');
const SUN_DAY = new Color('#fff4e0');

const NIGHT_SKY_LOW = new Color('#0f2433');
const NIGHT_SKY_HIGH = new Color('#0a1422');
const NIGHT_HORIZON = new Color('#1e2f3d');
const NIGHT_SUN_COLOR = new Color('#c8dce8');
const NIGHT_SUN_SIZE = 0.04;
const NIGHT_SUN_GLOW = 0.5;
const DAY_SUN_POS = new Vector3(60, 70, 40);
const NIGHT_SUN_POS = new Vector3(-55, 60, -35);

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

varying vec3 vWorld;
varying float vHeight;

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
  sky = mix(sky, uSunColor, sun + glow);

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
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, index) => {
      const cloud = clouds[index];
      const span = 360;
      const travel = ((t * cloud.speed * cloud.direction + cloud.x + span * 2) % span) - span * 0.5;
      child.position.x = travel;
      child.position.y = cloud.y + Math.sin(t * 0.025 + cloud.seed) * 2.2;
      child.position.z = cloud.z + Math.sin(t * 0.017 + cloud.seed * 0.7) * 9;
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
 * Ciel + brouillard. C'est ce couple qui porte toute la révélation du monde :
 * au départ le brouillard est à quelques mètres, à la fin il touche l'horizon.
 */
export function Atmosphere() {
  const fogRef = useRef<Fog>(null);
  const backgroundRef = useRef<Color>(null);
  const dayNightRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { reveal, timeOfDay } = useWorld.getState();

    // Transition douce entre le jour et la nuit selon le cycle.
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(angle);
    const targetDayNight = 1 - smoothstep(-0.2, 0.15, sunElevation);
    const dayNight = damp(dayNightRef.current, targetDayNight, 2.0, dt);
    dayNightRef.current = dayNight;

    // Deux temps : la brume se lève d'abord, la lumière du jour arrive ensuite.
    const lift = smoothstep(0.0, 0.55, reveal);
    const dayLight = smoothstep(0.25, 1.0, reveal);

    const low = uniforms.uLow.value.copy(NIGHT).lerp(DAWN_LOW, lift).lerp(SKY_LOW, dayLight);
    low.lerp(NIGHT_SKY_LOW, dayNight);
    const high = uniforms.uHigh.value.copy(NIGHT).lerp(DAWN_HIGH, lift).lerp(SKY_HIGH, dayLight);
    high.lerp(NIGHT_SKY_HIGH, dayNight);
    const horizon = uniforms.uHorizon.value
      .copy(NIGHT)
      .lerp(SUN_RISE, lift)
      .lerp(new Color('#a7d2e6'), dayLight);
    horizon.lerp(NIGHT_HORIZON, dayNight);

    fogColor.copy(low).lerp(high, 0.35);
    backgroundRef.current?.copy(fogColor);

    const currentFog = fogRef.current;
    if (currentFog) {
      currentFog.color.copy(fogColor);
      currentFog.near = damp(currentFog.near, 6 + lift * 44, 2.2, dt);
      currentFog.far = damp(currentFog.far, 42 + dayLight * 340, 1.6, dt);
    }

    uniforms.uReveal.value = reveal * (1 - dayNight * 0.4);
    uniforms.uSunColor.value.copy(SUN_RISE).lerp(SUN_DAY, dayLight).lerp(NIGHT_SUN_COLOR, dayNight);
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
      <fog ref={fogRef} attach="fog" args={[NIGHT.getHex(), 6, 42]} />
      <color ref={backgroundRef} attach="background" args={[NIGHT.getHex()]} />
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
    </>
  );
}
