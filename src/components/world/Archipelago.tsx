'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointLight } from 'three';
import { Island } from '@/components/islands/Island';
import { homeIsland, islands } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { HomeIsland } from './HomeIsland';

type NightLight = { position: [number, number, number]; distance: number; intensity: number; color: string };

function useNightLights() {
  return useMemo<NightLight[]>(() => {
    const list: NightLight[] = [];
    islands.forEach((island) => {
      const [x, z] = island.position;
      const y = island.elevation;
      list.push({
        position: [x, y + 8, z],
        distance: island.radius * 3.4,
        intensity: 13,
        color: '#fff4e6',
      });
      list.push({
        position: [x + island.radius * 0.55, y + 4.5, z + island.radius * 0.35],
        distance: island.radius * 2.4,
        intensity: 7.5,
        color: '#ffe8cc',
      });
      list.push({
        position: [x - island.radius * 0.5, y + 4.5, z - island.radius * 0.4],
        distance: island.radius * 2.4,
        intensity: 7.5,
        color: '#ffe8cc',
      });
    });
    list.push({
      position: [homeIsland.position[0], 13, homeIsland.position[1]],
      distance: 150,
      intensity: 18,
      color: '#fff4e6',
    });
    return list;
  }, []);
}

function NightLights() {
  const refs = useRef<PointLight[]>([]);
  const dayNightRef = useRef(0);
  const lights = useNightLights();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { timeOfDay } = useWorld.getState();
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunElevation = Math.sin(angle);
    const target = 1 - smoothstep(-0.2, 0.15, sunElevation);
    const dayNight = damp(dayNightRef.current, target, 2.0, dt);
    dayNightRef.current = dayNight;

    refs.current.forEach((light, i) => {
      if (!light) return;
      const { intensity } = lights[i];
      light.intensity = damp(light.intensity, intensity * dayNight, 2.5, dt);
    });
  });

  return (
    <>
      {lights.map((light, i) => (
        <pointLight
          key={i}
          ref={(el) => { if (el) refs.current[i] = el; }}
          position={light.position}
          color={light.color}
          intensity={0}
          distance={light.distance}
          decay={1.8}
        />
      ))}
    </>
  );
}

export function Archipelago() {
  return (
    <group>
      <HomeIsland />
      <NightLights />
      {islands.map((island, index) => (
        <Island key={island.id} island={island} index={index} />
      ))}
    </group>
  );
}
