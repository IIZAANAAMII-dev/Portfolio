'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Fog, Group, Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';
import { CaptureRig } from './render/CaptureRig';
import { SkyMoments } from './sky/SkyMoments';

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
uniform float uNight;

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

  // Voie lactée : une bande très douce qui barre la voûte, veinée de poussière sombre.
  float nightSky = uNight * (1.0 - uStorm);
  // (Elle passe par l'Ancre, comme les vraies constellations bordent la voie lactée.)
  vec3 bandAxis = normalize(vec3(0.62, -0.62, 0.48));
  float band = exp(-pow(dot(view, bandAxis) / 0.19, 2.0));
  if (nightSky > 0.001) {
    float dust = valueNoise(vec2(dot(view, vec3(0.8, 0.1, 0.5)), view.y) * 9.0);
    float rift = smoothstep(0.55, 0.8, valueNoise(view.xz * 14.0 + 3.0));
    float milky = band * (0.55 + 0.45 * dust) * (1.0 - 0.35 * rift);
    sky += vec3(0.13, 0.14, 0.26) * milky * 0.3 * nightSky * smoothstep(0.02, 0.3, vHeight);
  }

  // Étoiles : un point rond par cellule de la voûte, qui scintille (plus serrées dans la
  // voie lactée) ; la nuit et pendant l'intro (ciel noir au-dessus de la carte marine).
  vec3 starCell = floor(view * 230.0);
  float starSeed = fract(sin(dot(starCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float starDot = 1.0 - smoothstep(0.08, 0.32, length(fract(view * 230.0) - 0.5));
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + starSeed * 3.0) + starSeed * 40.0);
  float stars = step(0.9955 - band * 0.0035, starSeed) * starDot * twinkle * smoothstep(0.02, 0.22, vHeight);
  sky += vec3(0.88, 0.93, 1.0) * stars * nightSky;

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
  uNight: { value: 1.0 },
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
 * Ciel + brouillard. C'est ce couple qui porte toute la révélation du monde :
 * au départ le brouillard est à quelques mètres, à la fin il touche l'horizon.
 * Les moments du ciel (constellations, étoiles filantes, grain, arc-en-ciel, brume de
 * l'aube) vivent dans sky/ et sont montés ici.
 */
export function Atmosphere() {
  const fogRef = useRef<Fog>(null);
  const backgroundRef = useRef<Color>(null);
  // Matériau construit ici (et non via la prop `uniforms`) : R3F recopie chaque uniforme
  // dans un nouvel objet, les valeurs numériques (temps, nuit, orage) resteraient figées.
  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => skyMaterial.dispose(), [skyMaterial]);

  useFrame((state) => {
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

    // Le dôme garde la luminosité (uReveal = 0) et le soleil (taille 0,02, halo 0,5) que l'on
    // a toujours vus : ces valeurs étaient de fait figées par la recopie des uniformes.
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uStorm.value = storm;
    // Étoiles : à la nuit tombée (pas en plein coucher), et dans le noir de l'intro.
    uniforms.uNight.value = Math.max(smoothstep(0.45, 0.95, dayNight), 1 - smoothstep(0, 0.35, reveal));
    uniforms.uSunColor.value
      .copy(SUN_RISE)
      .lerp(SUN_DAY, dayLight)
      .lerp(GOLDEN_HORIZON, golden * 0.7)
      .lerp(NIGHT_SUN_COLOR, dayNight);
    const sunX = Math.cos(angle) * 80;
    const sunY = Math.max(sunElevation * 70, 10);
    uniforms.uSun.value.set(sunX, sunY, 40).normalize();
  });

  return (
    <>
      {process.env.NODE_ENV !== 'production' && <CaptureRig />}
      <fog ref={fogRef} attach="fog" args={[INTRO_FOG.getHex(), 11, 24]} />
      <color ref={backgroundRef} attach="background" args={[INTRO_FOG.getHex()]} />
      <mesh scale={420} material={skyMaterial} raycast={() => null}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <Clouds />
      <SkyMoments />
    </>
  );
}
