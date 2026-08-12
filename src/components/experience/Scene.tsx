'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { damp } from '@/lib/utils/math';
import { Boat } from '@/components/boat/Boat';
import { CameraRig } from '@/components/camera/CameraRig';
import { Archipelago } from '@/components/world/Archipelago';
import { Atmosphere } from '@/components/world/Atmosphere';
import { Lighting } from '@/components/world/Lighting';
import { Ocean } from '@/components/world/Ocean';
import { Birds } from '@/components/world/Birds';
import { MarineLife } from '@/components/world/MarineLife';
import { useWorldReveal } from '@/hooks/useWorldReveal';
import { MODEL, preloadModels } from '@/lib/models';
import { useWorld } from '@/lib/store';

// Les modèles visibles dès l'intro sont demandés en priorité ; le reste de l'archipel
// se charge pendant que le visiteur regarde la première île.
preloadModels([
  MODEL.palm,
  MODEL.dock,
  MODEL.dockSmall,
  MODEL.grass,
  MODEL.rockA,
  MODEL.shoreRockA,
  MODEL.shoreRockB,
  MODEL.rowBoat,
  MODEL.paddle,
]);

export function Scene({ mobile }: { mobile: boolean }) {
  const gl = useThree((state) => state.gl);
  const ready = useWorld((s) => s.ready);
  useWorldReveal();

  const dayNightRef = useRef(0);
  const clearColor = useRef(new Color('#08121c'));

  // La première frame rendue est le vrai signal de « prêt ».
  useEffect(() => {
    const id = requestAnimationFrame(() => ready());
    return () => cancelAnimationFrame(id);
  }, [ready]);

  useFrame((_, dt) => {
    const delta = Math.min(dt, 1 / 20);
    const { isNight } = useWorld.getState();
    const dayNight = damp(dayNightRef.current, isNight ? 1 : 0, 2.0, delta);
    dayNightRef.current = dayNight;
    clearColor.current.set('#6b9fbf').lerp(new Color('#08121c'), dayNight);
    gl.setClearColor(clearColor.current);
  });

  return (
    <>
      <CameraRig mobile={mobile} />
      <Atmosphere />
      <Lighting shadows={!mobile} />
      <Ocean />
      <Archipelago />
      <Boat />
      <MarineLife mobile={mobile} />
      {!mobile && <Birds />}
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.7}
          luminanceSmoothing={0.6}
          intensity={0.55}
        />
      </EffectComposer>
    </>
  );
}
