'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, PointLight } from 'three';
import { skyState, updateSky } from '@/lib/sky';
import { ecologyState, updateEcology } from '@/lib/ecology';
import { boatState } from '@/lib/boat-state';
import { introLightStrength } from '@/lib/cinematic';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

const DAY_SUN_COLOR = new Color('#fff0d8');
const GOLDEN_SUN_COLOR = new Color('#ffb066');
const NIGHT_SUN_COLOR = new Color('#a8c8dd');
const DAY_SKY_COLOR = new Color('#e1f2ff');
const NIGHT_SKY_COLOR = new Color('#1f2f3d');
const DAY_GROUND_COLOR = new Color('#3a4a52');
const NIGHT_GROUND_COLOR = new Color('#1a2a32');
const DAY_AMBIENT = new Color('#a0c4d4');
const NIGHT_AMBIENT = new Color('#2a3a4a');

/**
 * Une seule lumière projette des ombres. Le reste est de l'éclairage d'ambiance :
 * c'est le meilleur rapport qualité / coût pour un rendu low-poly.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const pool = useRef<PointLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const cycleTime = useRef(useWorld.getState().timeOfDay);
  const storeAccumulator = useRef(0);
  const quality = useWorld((state) => state.quality);

  // Priorité -10 : ce callback avance l'horloge du monde et met à jour skyState
  // AVANT tous les autres systèmes de la frame (océan, atmosphère, bateau…).
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { phase, reveal, gameTransition, timeOfDay, setTimeOfDay } = useWorld.getState();
    const dayLight = smoothstep(0.08, 0.9, reveal);
    const stillIntro = phase === 'loading' || phase === 'intro'
      ? 1
      : phase === 'transitioning'
        ? introLightStrength(gameTransition)
        : 0;

    // Cycle naturel : un tour complet = 5 minutes.
    if (Math.abs(timeOfDay - cycleTime.current) > 0.02) cycleTime.current = timeOfDay;
    const next = (cycleTime.current + dt / 300) % 1;
    cycleTime.current = next;
    storeAccumulator.current += dt;
    if (storeAccumulator.current >= 0.25) {
      setTimeOfDay(next);
      storeAccumulator.current = 0;
    }
    updateSky(next, dt);
    updateEcology(dt);
    const { dayNight, golden, sunAngle: angle, sunElevation } = skyState;
    const storm = ecologyState.stormCover;

    if (sun.current) {
      sun.current.color
        .copy(DAY_SUN_COLOR)
        .lerp(GOLDEN_SUN_COLOR, golden * 0.85)
        .lerp(NIGHT_SUN_COLOR, dayNight);
      sun.current.intensity = damp(
        sun.current.intensity,
        (0.2 + dayLight * 2.45 + stillIntro * 0.45) * (1 - dayNight * 0.75) * (1 - storm * 0.78),
        1.6,
        dt,
      );
      const x = Math.cos(angle) * 80;
      const y = Math.max(sunElevation * 70, 10);
      const z = 40;
      sun.current.position.set(boatState.position.x + x, y, boatState.position.z + z);
      sun.current.target.position.set(boatState.position.x, 0, boatState.position.z);
      sun.current.target.updateMatrixWorld();
    }
    if (sky.current) {
      sky.current.color.copy(DAY_SKY_COLOR).lerp(NIGHT_SKY_COLOR, dayNight);
      sky.current.groundColor.copy(DAY_GROUND_COLOR).lerp(NIGHT_GROUND_COLOR, dayNight);
      sky.current.intensity = damp(
        sky.current.intensity,
        (0.18 + dayLight * 0.97 + stillIntro * 1.05) * (1 - dayNight * 0.5) * (1 - storm * 0.58),
        1.6,
        dt,
      );
    }
    if (ambient.current) {
      ambient.current.color.copy(DAY_AMBIENT).lerp(NIGHT_AMBIENT, dayNight);
      ambient.current.intensity = damp(
        ambient.current.intensity,
        (0.22 + dayLight * 0.22 + stillIntro * 1.15) * (1 - storm * 0.44),
        1.6,
        dt,
      );
    }
    if (pool.current) {
      // Lumière chaude devant le bateau : éclaire sa coque et les voiles.
      const forwardX = Math.cos(boatState.heading);
      const forwardZ = Math.sin(boatState.heading);
      const sideX = forwardZ;
      const sideZ = -forwardX;
      const mx = boatState.position.x + forwardX * 9 + sideX * 3;
      const mz = boatState.position.z + forwardZ * 9 + sideZ * 3;
      pool.current.position.set(mx, 7.2, mz);
      pool.current.intensity = damp(pool.current.intensity, 100 * stillIntro, 3, dt);
      pool.current.distance = 42;
    }
  }, -10);

  return (
    <group>
      <hemisphereLight ref={sky} color="#e1f2ff" groundColor="#3a4a52" intensity={0.35} />
      <directionalLight
        ref={sun}
        position={[60, 70, 40]}
        color="#fff0d8"
        intensity={0.2}
        castShadow={shadows && QUALITY_LEVELS[quality].shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
      />
      <ambientLight ref={ambient} intensity={0.16} color="#a0c4d4" />
      {/* Spot chaud d'ambiance pour l'intro : donne l'impression d'un décor éclairé. */}
      <pointLight
        ref={pool}
        position={[0, 10.5, 0]}
        color="#fff0d8"
        intensity={76}
        distance={42}
        decay={0.9}
      />
    </group>
  );
}
