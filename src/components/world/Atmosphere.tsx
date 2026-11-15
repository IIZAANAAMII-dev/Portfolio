'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Fog, type Mesh } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { SkyClouds } from './render/SkyClouds';
import { SkyDome } from './render/SkyDome';
import { atmosphere, updateSkyPalette } from './render/sky-palette';

const INTRO_FOG = new Color('#020408');

/**
 * Étoile filante : un trait lumineux qui traverse le ciel nocturne toutes les
 * une à deux minutes. Un seul mesh, réutilisé — le reste du temps il est invisible.
 */
function ShootingStar() {
  const mesh = useRef<Mesh>(null);
  const state = useRef({ waiting: 24 + hash(91.7) * 60, progress: -1, x0: 0, z0: 0, angle: 0 });

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const dt = Math.min(delta, 1 / 20);
    const star = state.current;

    if (star.progress < 0) {
      mesh.current.visible = false;
      // Uniquement la nuit : le compteur ne descend pas en journée.
      if (skyState.dayNight > 0.72 && ecologyState.stormCover < 0.2) star.waiting -= dt;
      if (star.waiting <= 0) {
        star.progress = 0;
        star.x0 = -140 + Math.random() * 280;
        star.z0 = -160 + Math.random() * 120;
        star.angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.35;
      }
      return;
    }

    star.progress += dt / 1.35;
    if (star.progress >= 1 || skyState.dayNight < 0.6) {
      star.progress = -1;
      star.waiting = 45 + Math.random() * 75;
      mesh.current.visible = false;
      return;
    }

    const t = star.progress;
    mesh.current.visible = true;
    mesh.current.position.set(
      star.x0 + Math.cos(star.angle) * t * 190,
      165 - t * 60,
      star.z0 + Math.sin(star.angle) * t * 60,
    );
    mesh.current.rotation.z = -star.angle * 0.4;
    // Fondu d'entrée et de sortie pour éviter toute apparition sèche.
    const fade = Math.min(t / 0.15, 1) * Math.min((1 - t) / 0.3, 1);
    mesh.current.scale.set(6 + t * 6, 0.16, 0.16);
    const material = mesh.current.material as { opacity?: number };
    if (material) material.opacity = fade * 0.9;
  });

  return (
    <mesh ref={mesh} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#eaf6ff" transparent opacity={0} depthWrite={false} fog={false} />
    </mesh>
  );
}

/**
 * Ciel + brouillard. C'est ce couple qui porte toute la révélation du monde :
 * au départ le brouillard est à quelques mètres, à la fin il touche l'horizon.
 * Les couleurs du ciel (dôme, nuages, astres) et de la brume viennent d'une seule palette
 * (render/sky-palette.ts), calculée ici une fois par image.
 */
export function Atmosphere() {
  const fogRef = useRef<Fog>(null);
  const backgroundRef = useRef<Color>(null);

  useFrame((state) => {
    const { reveal } = useWorld.getState();
    updateSkyPalette(state.clock.elapsedTime, reveal);
    backgroundRef.current?.copy(atmosphere.fogColor);
    const currentFog = fogRef.current;
    if (currentFog) {
      currentFog.color.copy(atmosphere.fogColor);
      currentFog.near = atmosphere.fogNear;
      currentFog.far = atmosphere.fogFar;
    }
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[INTRO_FOG.getHex(), 11, 24]} />
      <color ref={backgroundRef} attach="background" args={[INTRO_FOG.getHex()]} />
      <SkyDome />
      <SkyClouds />
      <ShootingStar />
    </>
  );
}
