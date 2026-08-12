'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DirectionalLight, HemisphereLight } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/**
 * Une seule lumière projette des ombres. Le reste est de l'éclairage d'ambiance :
 * c'est le meilleur rapport qualité / coût pour un rendu low-poly.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const reveal = useWorld.getState().reveal;
    const dayLight = smoothstep(0.15, 1, reveal);
    if (sun.current) sun.current.intensity = damp(sun.current.intensity, 0.25 + dayLight * 2, 1.6, dt);
    if (sky.current) sky.current.intensity = damp(sky.current.intensity, 0.15 + dayLight * 0.75, 1.6, dt);
  });

  return (
    <group>
      <hemisphereLight ref={sky} color="#cfe6f2" groundColor="#20303a" intensity={0.15} />
      <directionalLight
        ref={sun}
        position={[60, 70, 40]}
        color="#ffe3c4"
        intensity={0.25}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />
      <ambientLight intensity={0.18} color="#8fb4c9" />
    </group>
  );
}
