'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, PointLight } from 'three';
import { skyState, updateSky } from '@/lib/sky';
import { ecologyState, updateEcology } from '@/lib/ecology';
import { boatState } from '@/lib/boat-state';
import { introLightStrength } from '@/lib/cinematic';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { preview } from '@/lib/preview';
import { damp, smoothstep } from '@/lib/utils/math';
import { atmosphere } from './render/sky-palette';
import { fitSunShadow, sunDirection } from './render/shadow-fit';

/*
 * Étalonnage « jouet peint » : lumière directe chaude, lumière du ciel lavande (les ombres
 * virent au violet au lieu de griser), rebond turquoise de la mer sous les objets.
 *
 * Quatre moments : le jour (inchangé), l'heure dorée (soleil or-orangé, ciel mauve : ombres
 * longues et violettes), l'heure bleue (le soleil vient de se coucher : plus de lumière
 * directe, un grand ciel pervenche qui baigne tout, les fenêtres s'allument) et la nuit
 * (clair de lune froid et lisible).
 */
const DAY_SUN_COLOR = new Color('#ffe8c6');
const GOLDEN_SUN_COLOR = new Color('#ff9f5a');
const NIGHT_SUN_COLOR = new Color('#a3c2e4');
const DAY_SKY_COLOR = new Color('#c9cfff');
const GOLDEN_SKY_COLOR = new Color('#d3b1ec');
const TWILIGHT_SKY_COLOR = new Color('#6e76c4');
const NIGHT_SKY_COLOR = new Color('#2b3258');
const DAY_GROUND_COLOR = new Color('#3f7276');
const TWILIGHT_GROUND_COLOR = new Color('#2c3a5c');
const NIGHT_GROUND_COLOR = new Color('#1a2a3a');
const DAY_AMBIENT = new Color('#a3a6e4');
const GOLDEN_AMBIENT = new Color('#b59ad8');
const TWILIGHT_AMBIENT = new Color('#4d4f90');
const NIGHT_AMBIENT = new Color('#2c3155');

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
  // Ombres nettes en haute qualité ; la carte est recréée quand la qualité change.
  const shadowSize = quality === 'high' ? 2048 : 1024;
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [shadowSize]);

  // Captures (développement) : l'heure figée `?time=` reste réglable depuis la page.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as Record<string, unknown>).__preview = preview;
  }, []);

  // Priorité -10 : ce callback avance l'horloge du monde et met à jour skyState
  // AVANT tous les autres systèmes de la frame (océan, atmosphère, bateau…).
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    // Heure figée (aperçus, captures) : les lumières rejoignent leur cible sans délai.
    const lightDt = preview.time === null ? dt : 10;
    const { phase, reveal, gameTransition, timeOfDay, setTimeOfDay } = useWorld.getState();
    const dayLight = smoothstep(0.08, 0.9, reveal);
    const stillIntro = phase === 'loading' || phase === 'intro'
      ? 1
      : phase === 'transitioning'
        ? introLightStrength(gameTransition)
        : 0;

    // Cycle naturel : un tour complet = 5 minutes. `?time=` le fige (aperçus, captures).
    if (Math.abs(timeOfDay - cycleTime.current) > 0.02) cycleTime.current = timeOfDay;
    const next = preview.time ?? (cycleTime.current + dt / 300) % 1;
    cycleTime.current = next;
    storeAccumulator.current += dt;
    if (storeAccumulator.current >= 0.25) {
      setTimeOfDay(next);
      storeAccumulator.current = 0;
    }
    updateSky(next, preview.time === null ? dt : 10);
    updateEcology(dt);
    const { dayNight, golden } = skyState;
    const storm = ecologyState.stormCover;
    // Heure bleue : calculée par la palette du ciel (image précédente, variation lente).
    const dusk = atmosphere.twilight * dayNight;

    if (sun.current) {
      sun.current.color
        .copy(DAY_SUN_COLOR)
        .lerp(GOLDEN_SUN_COLOR, golden * 0.9)
        .lerp(NIGHT_SUN_COLOR, dayNight);
      sun.current.intensity = damp(
        sun.current.intensity,
        (0.2 + dayLight * 2.3 + stillIntro * 0.45 + golden * 0.15)
          * (1 - dayNight * 0.75)
          * (1 - dusk * 0.55)
          * (1 - storm * 0.78),
        1.6,
        lightDt,
      );
    }
    if (sky.current) {
      sky.current.color
        .copy(DAY_SKY_COLOR)
        .lerp(GOLDEN_SKY_COLOR, golden * 0.7)
        .lerp(NIGHT_SKY_COLOR, dayNight)
        .lerp(TWILIGHT_SKY_COLOR, dusk);
      sky.current.groundColor.copy(DAY_GROUND_COLOR).lerp(NIGHT_GROUND_COLOR, dayNight).lerp(TWILIGHT_GROUND_COLOR, dusk);
      sky.current.intensity = damp(
        sky.current.intensity,
        (0.18 + dayLight * 1.22 + stillIntro * 1.05)
          * (1 - dayNight * 0.5)
          * (1 - golden * 0.1)
          * (1 + dusk * 0.55)
          * (1 - storm * 0.58),
        1.6,
        lightDt,
      );
    }
    if (ambient.current) {
      ambient.current.color
        .copy(DAY_AMBIENT)
        .lerp(GOLDEN_AMBIENT, golden * 0.6)
        .lerp(NIGHT_AMBIENT, dayNight)
        .lerp(TWILIGHT_AMBIENT, dusk);
      ambient.current.intensity = damp(
        ambient.current.intensity,
        (0.22 + dayLight * 0.3 + stillIntro * 1.15) * (1 - storm * 0.44),
        1.6,
        lightDt,
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
      pool.current.intensity = damp(pool.current.intensity, 58 * stillIntro, 3, dt);
      pool.current.distance = 42;
    }
  }, -10);

  // Après la caméra (priorité 0, montée avant) : la boîte d'ombre épouse ce que la caméra
  // voit réellement, alignée sur les texels (pas de scintillement quand on navigue).
  useFrame((state) => {
    if (!sun.current) return;
    sunDirection(skyState.sunAngle, skyState.sunElevation);
    fitSunShadow(sun.current, state.camera, shadowSize);
  });

  return (
    <group>
      <hemisphereLight ref={sky} color="#e1f2ff" groundColor="#3a4a52" intensity={0.35} />
      <directionalLight
        ref={sun}
        position={[60, 70, 40]}
        color="#fff0d8"
        intensity={0.2}
        castShadow={shadows && QUALITY_LEVELS[quality].shadows}
        shadow-mapSize={[shadowSize, shadowSize]}
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
