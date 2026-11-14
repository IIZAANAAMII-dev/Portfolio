'use client';

import { useFrame } from '@react-three/fiber';
import { skyState } from '@/lib/sky';
import { cloudClock } from '@/lib/materials/cloud-shadow';
import { clothClock, nightGlow } from '@/lib/substance-models';
import { updateWindows } from '@/lib/windows';

/**
 * Allume les vitres, lampes et écrans des modèles à mesure que la nuit tombe.
 * Une seule boucle pour tout le monde : les matériaux sont partagés entre modèles.
 * Les vitres des décors (`<WindowPane>`) s'allument chacune à leur heure (lib/windows.ts).
 */
export function NightGlow() {
  useFrame((state) => {
    clothClock.value = state.clock.elapsedTime;
    cloudClock.value = state.clock.elapsedTime;
    const t = skyState.dayNight;
    nightGlow.forEach(({ day, night }, material) => {
      material.emissiveIntensity = day + (night - day) * t;
    });
    updateWindows(t);
  });
  return null;
}
