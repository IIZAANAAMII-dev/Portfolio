'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { useWorld } from '@/lib/store';

const REVEAL_DURATION = 8.5;

/**
 * La révélation du monde. Une seule valeur (`reveal`, 0 -> 1) pilote le brouillard,
 * la lumière, la caméra et l'apparition des îles ; tout reste donc synchronisé et il n'y
 * a qu'un seul endroit à régler pour changer le rythme de la scène.
 */
export function useWorldReveal() {
  const phase = useWorld((s) => s.phase);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const { setReveal, revealComplete, sailToPoint, reducedMotion } = useWorld.getState();

    if (reducedMotion) {
      setReveal(1);
      revealComplete();
      return;
    }

    // Le bateau quitte le ponton dès la première seconde : c'est son mouvement qui
    // justifie le recul de la caméra.
    sailToPoint([46, -62]);

    const progress = { value: 0 };
    const tween = gsap.to(progress, {
      value: 1,
      duration: REVEAL_DURATION,
      ease: 'power2.inOut',
      onUpdate: () => setReveal(progress.value),
      onComplete: () => {
        // Un temps de suspension sur le plan large avant de rendre la main.
        gsap.delayedCall(1.1, revealComplete);
      },
    });

    return () => {
      tween.kill();
    };
  }, [phase]);
}
