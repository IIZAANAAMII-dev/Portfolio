'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DirectionalLight, HemisphereLight, PointLight } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/**
 * Une seule lumière projette des ombres. Le reste est de l'éclairage d'ambiance :
 * c'est le meilleur rapport qualité / coût pour un rendu low-poly.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const pool = useRef<PointLight>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const reveal = useWorld.getState().reveal;
    const dayLight = smoothstep(0.15, 1, reveal);
    const stillIntro = 1 - smoothstep(0, 0.35, reveal);

    if (sun.current) sun.current.intensity = damp(sun.current.intensity, 0.45 + dayLight * 2.2, 1.6, dt);
    if (sky.current) sky.current.intensity = damp(sky.current.intensity, 0.35 + dayLight * 0.8, 1.6, dt);
    if (pool.current) {
      // Lumière chaude du diorama intro qui baigne l'îlot et l'eau proche.
      pool.current.intensity = damp(pool.current.intensity, 60 * stillIntro, 2.5, dt);
      pool.current.distance = 90;
    }
  });

  return (
    <group>
      <hemisphereLight ref={sky} color="#e1f2ff" groundColor="#3a4a52" intensity={0.35} />
      <directionalLight
        ref={sun}
        position={[60, 70, 40]}
        color="#fff0d8"
        intensity={0.45}
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
      <ambientLight intensity={0.28} color="#a0c4d4" />
      {/* Spot chaud d'ambiance pour l'intro : donne l'impression d'un décor éclairé. */}
      <pointLight
        ref={pool}
        position={[14, 22, -18]}
        color="#ff9c5a"
        intensity={60}
        distance={90}
        decay={1.8}
      />
    </group>
  );
}
