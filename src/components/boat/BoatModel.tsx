'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Object3D } from 'three';
import { MODEL, useModelScene } from '@/lib/models';
import { boatState } from '@/lib/boat-state';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { useWorld } from '@/lib/store';

/** Bateau pirate Kenney — CC0. La navigation considère que l'avant est +X. */
const FORWARD_FIX = Math.PI / 2;
const SCALE = 0.76;

export function BoatModel() {
  const scene = useModelScene(MODEL.ship);
  const quality = useWorld((state) => state.quality);
  const { model, animatedParts } = useMemo(() => {
    const clone = scene.clone(true);
    const parts: Object3D[] = [];
    clone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = false;
      if (child.name.startsWith('sail-') || child.name.startsWith('flag-')) {
        child.userData.baseRotationZ = child.rotation.z;
        child.userData.baseRotationY = child.rotation.y;
        child.userData.baseScaleX = child.scale.x;
        child.userData.baseScaleZ = child.scale.z;
        parts.push(child);
      }
    });
    return { model: clone, animatedParts: parts };
  }, [scene]);

  useEffect(() => {
    model.traverse((child) => {
      child.castShadow = quality !== 'low';
    });
  }, [model, quality]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const wind = Math.min(Math.abs(boatState.speed) / MAX_SPEED, 1);
    animatedParts.forEach((part, index) => {
      const isFlag = part.name.startsWith('flag-');
      const flutter = Math.sin(time * (1.7 + wind * 4.2 + index * 0.17) + index * 1.9);
      const gust = Math.sin(time * 0.63 + index * 2.4) * 0.5 + 0.5;
      const activity = 0.12 + wind * (0.72 + gust * 0.28);
      part.rotation.z = part.userData.baseRotationZ + flutter * activity * (isFlag ? 0.13 : 0.035);
      part.rotation.y = part.userData.baseRotationY + Math.sin(time * 0.9 + index) * wind * (isFlag ? 0.08 : 0.018);
      part.scale.x = part.userData.baseScaleX * (1 + wind * (isFlag ? 0.1 : 0.055) + flutter * activity * 0.025);
      part.scale.z = part.userData.baseScaleZ * (1 + wind * (isFlag ? 0.04 : 0.085));
    });
  });

  return (
    <group rotation-y={FORWARD_FIX} scale={SCALE} position-y={-0.42}>
      <primitive object={model} />
    </group>
  );
}
