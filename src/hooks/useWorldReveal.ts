'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { useWorld } from '@/lib/store';
import { INTRO_DURATION, worldRevealProgress } from '@/lib/cinematic';

/**
 * La révélation du monde. Une seule valeur (`reveal`, 0 -> 1) pilote le brouillard,
 * la lumière, la caméra et l'apparition des îles ; tout reste donc synchronisé et il n'y
 * a qu'un seul endroit à régler pour changer le rythme de la scène.
 */
export function useWorldReveal() {
  const phase = useWorld((s) => s.phase);

  useEffect(() => {
    if (phase !== 'transitioning') return;
    const { setCinematicProgress, revealComplete, reducedMotion } = useWorld.getState();

    if (reducedMotion) {
      setCinematicProgress(1, 1);
      revealComplete();
      return;
    }

    const progress = { value: 0 };
    const tween = gsap.to(progress, {
      value: 1,
      duration: INTRO_DURATION,
      ease: 'none',
      onUpdate: () => setCinematicProgress(progress.value, worldRevealProgress(progress.value)),
      onComplete: revealComplete,
    });

    return () => {
      tween.kill();
    };
  }, [phase]);
}
