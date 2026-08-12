'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Boat } from '@/components/boat/Boat';
import { CameraRig } from '@/components/camera/CameraRig';
import { Archipelago } from '@/components/world/Archipelago';
import { Atmosphere } from '@/components/world/Atmosphere';
import { Lighting } from '@/components/world/Lighting';
import { Ocean } from '@/components/world/Ocean';
import { Birds } from '@/components/world/Birds';
import { useWorldReveal } from '@/hooks/useWorldReveal';
import { useWorld } from '@/lib/store';

export function Scene({ mobile }: { mobile: boolean }) {
  const gl = useThree((state) => state.gl);
  const ready = useWorld((s) => s.ready);
  useWorldReveal();

  // La première frame rendue est le vrai signal de « prêt » : plus honnête qu'un
  // compteur de chargement, et cela évite un écran de chargement qui traîne.
  useEffect(() => {
    const id = requestAnimationFrame(() => ready());
    return () => cancelAnimationFrame(id);
  }, [ready]);

  useEffect(() => {
    gl.setClearColor('#05080f');
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
    </>
  );
}
