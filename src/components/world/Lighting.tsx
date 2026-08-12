'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, PointLight, Vector3 } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

const DAY_SUN_COLOR = new Color('#fff0d8');
const NIGHT_SUN_COLOR = new Color('#a8c8dd');
const DAY_SKY_COLOR = new Color('#e1f2ff');
const NIGHT_SKY_COLOR = new Color('#1f2f3d');
const DAY_GROUND_COLOR = new Color('#3a4a52');
const NIGHT_GROUND_COLOR = new Color('#1a2a32');
const DAY_AMBIENT = new Color('#a0c4d4');
const NIGHT_AMBIENT = new Color('#2a3a4a');
const DAY_SUN_POS = new Vector3(60, 70, 40);
const NIGHT_SUN_POS = new Vector3(-55, 60, -35);

/**
 * Une seule lumière projette des ombres. Le reste est de l'éclairage d'ambiance :
 * c'est le meilleur rapport qualité / coût pour un rendu low-poly.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const pool = useRef<PointLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const dayNightRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { reveal, timeOfDay, setTimeOfDay } = useWorld.getState();
    const dayLight = smoothstep(0.15, 1, reveal);
    const stillIntro = 1 - smoothstep(0, 0.35, reveal);

    // Cycle naturel : un tour complet = 5 minutes.
    const next = (timeOfDay + dt / 300) % 1;
    setTimeOfDay(next);

    // Hauteur du soleil : 0.25 = lever, 0.5 = midi, 0.75 = coucher.
    const angle = (next - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(angle);
    const targetDayNight = 1 - smoothstep(-0.2, 0.15, sunElevation);
    const dayNight = damp(dayNightRef.current, targetDayNight, 2.0, dt);
    dayNightRef.current = dayNight;

    if (sun.current) {
      sun.current.color.copy(DAY_SUN_COLOR).lerp(NIGHT_SUN_COLOR, dayNight);
      sun.current.intensity = damp(
        sun.current.intensity,
        (0.45 + dayLight * 2.2) * (1 - dayNight * 0.75),
        1.6,
        dt,
      );
      const x = Math.cos(angle) * 80;
      const y = Math.max(sunElevation * 70, 10);
      const z = 40;
      sun.current.position.set(x, y, z);
      sun.current.target.position.set(0, 0, 0);
      sun.current.target.updateMatrixWorld();
    }
    if (sky.current) {
      sky.current.color.copy(DAY_SKY_COLOR).lerp(NIGHT_SKY_COLOR, dayNight);
      sky.current.groundColor.copy(DAY_GROUND_COLOR).lerp(NIGHT_GROUND_COLOR, dayNight);
      sky.current.intensity = damp(
        sky.current.intensity,
        (0.35 + dayLight * 0.8) * (1 - dayNight * 0.5),
        1.6,
        dt,
      );
    }
    if (ambient.current) {
      ambient.current.color.copy(DAY_AMBIENT).lerp(NIGHT_AMBIENT, dayNight);
    }
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
      <ambientLight ref={ambient} intensity={0.28} color="#a0c4d4" />
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
