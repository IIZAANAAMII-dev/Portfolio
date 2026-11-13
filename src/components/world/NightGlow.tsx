'use client';

import { useFrame } from '@react-three/fiber';
import { skyState } from '@/lib/sky';
import { nightGlow } from '@/lib/substance-models';

/**
 * Allume les vitres, lampes et écrans des modèles à mesure que la nuit tombe.
 * Une seule boucle pour tout le monde : les matériaux sont partagés entre modèles.
 */
export function NightGlow() {
  useFrame(() => {
    const t = skyState.dayNight;
    nightGlow.forEach(({ day, night }, material) => {
      material.emissiveIntensity = day + (night - day) * t;
    });
  });
  return null;
}
