'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Fog, Vector3 } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

const NIGHT = new Color('#0a1422');
const DAWN_LOW = new Color('#b55a3f');
const DAWN_HIGH = new Color('#143c5e');
const SKY_LOW = new Color('#70bad4');
const SKY_HIGH = new Color('#2b6a8f');
const SUN_RISE = new Color('#ffb57a');
const SUN_DAY = new Color('#fff4e0');

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

const cloudVertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;
  pos.x += mod(uTime * 0.04, 2.0) - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const cloudFragmentShader = /* glsl */ `
uniform float uReveal;
uniform vec3 uCloud;
varying vec2 vUv;

void main() {
  // Onde de brume douce, translucide.
  float a = 1.0 - abs(vUv.x - 0.5) * 2.0;
  a *= smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  a *= smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
  a = pow(a, 1.5) * 0.45;
  gl_FragColor = vec4(uCloud, a * uReveal);
  #include <colorspace_fragment>
}
`;

// État visuel de l'atmosphère : un seul exemplaire dans la scène, muté à chaque frame.
const uniforms = {
  uLow: { value: NIGHT.clone() },
  uHigh: { value: NIGHT.clone() },
  uHorizon: { value: NIGHT.clone() },
  uSun: { value: new Vector3(60, 70, 40) },
  uSunColor: { value: new Color(SUN_RISE) },
  uSunSize: { value: 0.02 },
  uSunGlow: { value: 0.5 },
  uReveal: { value: 0.0 },
};
const fogColor = new Color(NIGHT);

/** Quelques nuages stylisés, éloignés, qui dérivent lentement. */
function Clouds() {
  const clouds = useMemo(
    () =>
      [
        { x: -90, z: -120, w: 70, d: 24, speed: 1 },
        { x: 60, z: -150, w: 90, d: 28, speed: 0.8 },
        { x: 110, z: -80, w: 60, d: 20, speed: 1.1 },
        { x: -60, z: 110, w: 80, d: 26, speed: 0.9 },
      ].map((c) => ({
        ...c,
        baseX: c.x,
      })),
    [],
  );

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.baseX, 110 + i * 12, c.z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[c.w, c.d, 1, 1]} />
          <shaderMaterial
            uniforms={{
              uTime: { value: 0 },
              uReveal: uniforms.uReveal,
              uCloud: { value: new Color('#f5f3ef') },
            }}
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            transparent
            depthWrite={false}
          />
        </mesh>
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

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const reveal = useWorld.getState().reveal;

    // Deux temps : la brume se lève d'abord, la lumière du jour arrive ensuite.
    const lift = smoothstep(0.0, 0.55, reveal);
    const dayLight = smoothstep(0.25, 1.0, reveal);

    const low = uniforms.uLow.value.copy(NIGHT).lerp(DAWN_LOW, lift).lerp(SKY_LOW, dayLight);
    const high = uniforms.uHigh.value.copy(NIGHT).lerp(DAWN_HIGH, lift).lerp(SKY_HIGH, dayLight);
    uniforms.uHorizon.value
      .copy(NIGHT)
      .lerp(SUN_RISE, lift)
      .lerp(new Color('#a7d2e6'), dayLight);

    fogColor.copy(low).lerp(high, 0.35);
    backgroundRef.current?.copy(fogColor);

    const currentFog = fogRef.current;
    if (currentFog) {
      currentFog.color.copy(fogColor);
      currentFog.near = damp(currentFog.near, 6 + lift * 44, 2.2, dt);
      currentFog.far = damp(currentFog.far, 42 + dayLight * 340, 1.6, dt);
    }

    uniforms.uReveal.value = reveal;
    uniforms.uSunColor.value.copy(SUN_RISE).lerp(SUN_DAY, dayLight);
    uniforms.uSunSize.value = damp(uniforms.uSunSize.value, 0.06 + dayLight * 0.04, 1, dt);
    uniforms.uSunGlow.value = damp(uniforms.uSunGlow.value, 0.5 + dayLight * 0.5, 1, dt);
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
