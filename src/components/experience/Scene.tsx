'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Boat } from '@/components/boat/Boat';
import { CameraRig } from '@/components/camera/CameraRig';
import { Archipelago } from '@/components/world/Archipelago';
import { Atmosphere } from '@/components/world/Atmosphere';
import { Lighting } from '@/components/world/Lighting';
import { Ocean } from '@/components/world/Ocean';
import { Birds } from '@/components/world/Birds';
import { useWorldReveal } from '@/hooks/useWorldReveal';
import { MODEL, preloadModels } from '@/lib/models';
import { useWorld } from '@/lib/store';

// Les modèles visibles dès l'intro sont demandés en priorité ; le reste de l'archipel
// se charge pendant que le visiteur regarde la première île.
preloadModels([MODEL.palm, MODEL.dock, MODEL.dockSmall, MODEL.grass, MODEL.rockA]);

export function Scene({ mobile }: { mobile: boolean }) {
  const gl = useThree((state) => state.gl);
  const ready = useWorld((s) => s.ready);
  useWorldReveal();

  // La première frame rendue est le vrai signal de « prêt ».
  useEffect(() => {
    const id = requestAnimationFrame(() => ready());
    return () => cancelAnimationFrame(id);
  }, [ready]);

  useEffect(() => {
    gl.setClearColor('#08121c');
  }, [gl]);

  return (
    <>
      <CameraRig mobile={mobile} />
      <Atmosphere />
      <Lighting shadows={!mobile} />
      <Ocean />
      <Archipelago />
      <Boat />
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
