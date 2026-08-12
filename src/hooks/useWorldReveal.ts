'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { useWorld } from '@/lib/store';

const TRANSITION_DURATION = 0.85;

/**
 * La révélation du monde. Une seule valeur (`reveal`, 0 -> 1) pilote le brouillard,
 * la lumière, la caméra et l'apparition des îles ; tout reste donc synchronisé et il n'y
 * a qu'un seul endroit à régler pour changer le rythme de la scène.
 */
export function useWorldReveal() {
  const phase = useWorld((s) => s.phase);

  useEffect(() => {
    if (phase !== 'transitioning') return;
    const { setGameTransition, revealComplete, reducedMotion } = useWorld.getState();

    if (reducedMotion) {
      setGameTransition(1);
      revealComplete();
      return;
    }

    const progress = { value: 0 };
    const tween = gsap.to(progress, {
      value: 1,
      duration: TRANSITION_DURATION,
      ease: 'power3.inOut',
      onUpdate: () => setGameTransition(progress.value),
      onComplete: revealComplete,
    });

    return () => {
      tween.kill();
    };
  }, [phase]);
}
