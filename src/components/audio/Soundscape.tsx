'use client';

import { useEffect } from 'react';
import { useWorld } from '@/lib/store';

/**
 * Paysage sonore vivant de l'archipel (voir lib/audio/soundscape) : ambiances d'îles qui
 * se croisent avec la distance du bateau, vent du large, nuit, sons du carnet de bord.
 *
 * Ne coûte rien tant que le son est coupé : le moteur n'est téléchargé (morceau séparé)
 * et démarré qu'à la première activation, et tout est défait dès que le son est coupé.
 */
export default function Soundscape() {
  const soundOn = useWorld((state) => state.soundOn);

  useEffect(() => {
    if (!soundOn) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    import('@/lib/audio/soundscape')
      .then(({ startSoundscape }) => {
        if (!cancelled) stop = startSoundscape();
      })
      .catch((error: unknown) => console.warn('Soundscape unavailable:', error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [soundOn]);

  return null;
}
