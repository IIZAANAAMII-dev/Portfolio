'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useWorld } from '@/lib/store';
import { Constellations } from './Constellations';
import { DawnMist } from './DawnMist';
import { Rainbow } from './Rainbow';
import { ShootingStars } from './ShootingStars';
import { Squall } from './Squall';
import { skyLayerUniforms } from './sky-layer';
import { spawnRainbow, spawnSquall, updateWeather } from './weather';

type SkyWindow = { __sky?: { squall: () => void; rainbow: () => void } };

/**
 * Les moments du ciel, montés par l'atmosphère : constellations et étoiles filantes la
 * nuit, grain puis arc-en-ciel de temps en temps le jour, brume à l'aube. Ce composant
 * avance l'horloge commune et la météo une fois par image.
 */
export function SkyMoments() {
  const getState = useThree((state) => state.get);

  // Développement : `window.__sky.squall()` / `.rainbow()` (captures, réglages).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as SkyWindow;
    target.__sky = {
      squall: () => spawnSquall(getState().camera, true),
      rainbow: () => spawnRainbow(getState().camera, true),
    };
    return () => {
      delete target.__sky;
    };
  }, [getState]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const u = skyLayerUniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uViewport.value.set(Math.max(state.size.width, 1), Math.max(state.size.height, 1));
    u.uMotion.value = useWorld.getState().reducedMotion ? 0 : 1;
    u.uWish.value = Math.max(0, u.uWish.value - dt / 2.6);
    updateWeather(state.camera, dt);
  });

  return (
    <>
      <Constellations />
      <ShootingStars />
      <Squall />
      <Rainbow />
      <DawnMist />
    </>
  );
}
