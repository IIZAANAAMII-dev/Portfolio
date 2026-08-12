'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Fog } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

const NIGHT = new Color('#05080f');
const DAWN_LOW = new Color('#1b3a52');
const DAWN_HIGH = new Color('#0d1c2e');
const SKY_LOW = new Color('#f4c9a0');
const SKY_HIGH = new Color('#2f6d92');

const vertexShader = /* glsl */ `
varying float vHeight;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vHeight = normalize(world.xyz).y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uLow;
uniform vec3 uHigh;
varying float vHeight;
void main() {
  gl_FragColor = vec4(mix(uLow, uHigh, smoothstep(-0.05, 0.6, vHeight)), 1.0);
  #include <colorspace_fragment>
}
`;

// État visuel de l'atmosphère : un seul exemplaire dans la scène, muté à chaque frame.
const uniforms = { uLow: { value: NIGHT.clone() }, uHigh: { value: NIGHT.clone() } };
const fogColor = new Color(NIGHT);

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
    const dayLight = smoothstep(0.3, 1.0, reveal);

    const low = uniforms.uLow.value.copy(NIGHT).lerp(DAWN_LOW, lift).lerp(SKY_LOW, dayLight);
    const high = uniforms.uHigh.value.copy(NIGHT).lerp(DAWN_HIGH, lift).lerp(SKY_HIGH, dayLight);

    fogColor.copy(low).lerp(high, 0.35);
    backgroundRef.current?.copy(fogColor);

    const currentFog = fogRef.current;
    if (currentFog) {
      currentFog.color.copy(fogColor);
      currentFog.near = damp(currentFog.near, 6 + lift * 44, 2.2, dt);
      currentFog.far = damp(currentFog.far, 42 + dayLight * 320, 1.6, dt);
    }
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[NIGHT.getHex(), 6, 42]} />
      <color ref={backgroundRef} attach="background" args={[NIGHT.getHex()]} />
      <mesh scale={400}>
        <sphereGeometry args={[1, 24, 16]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </>
  );
}
