'use client';

import { useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ClearingContext, type Clearing } from '../clearings';

/**
 * Les clairières d'une île (emprises des bâtiments) arrivent au fil du montage des décors.
 * Ce hook rappelle `layout(liste)` à chaque changement — jamais à chaque image — pour que
 * les accessoires semés s'effacent sous les planchers. Sans contexte, un seul appel.
 */
export function useClearingLayout(layout: (clearings: Clearing[]) => void, deps: unknown) {
  const clearings = useContext(ClearingContext);
  const seen = useRef<{ version: number; deps: unknown }>({ version: -1, deps: null });
  useFrame(() => {
    const version = clearings?.version ?? 0;
    if (version === seen.current.version && deps === seen.current.deps) return;
    seen.current = { version, deps };
    layout(clearings?.list() ?? []);
  });
}

/** Vrai si le point est dans une clairière (avec une marge, en mètres). */
export function inClearing(clearings: Clearing[], x: number, z: number, margin = 0) {
  return clearings.some((clearing) => Math.hypot(x - clearing.x, z - clearing.z) < clearing.radius + margin);
}
