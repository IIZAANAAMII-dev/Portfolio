'use client';

import { useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { skyState } from '@/lib/sky';

/**
 * Vrai dès que la nuit tombe (et jusqu'à ce que le jour soit revenu) : les décors nocturnes
 * ne sont montés qu'alors et ne coûtent rien de jour. Hystérésis : on au-dessus de `on`, off
 * sous `off` (facteur nuit amorti de lib/sky.ts). Un seul rendu React par bascule.
 */
export function useNightGate(on = 0.08, off = 0.03) {
  const [night, setNight] = useState(() => skyState.dayNight > on);
  useFrame(() => {
    const value = skyState.dayNight;
    if (!night && value > on) setNight(true);
    else if (night && value < off) setNight(false);
  });
  return night;
}

/**
 * Ne monte ses enfants qu'à la nuit tombante : un composant chargé à part (`dynamic`) n'est
 * alors même pas téléchargé de jour.
 */
export function NightOnly({ children }: { children: ReactNode }) {
  return useNightGate() ? children : null;
}
