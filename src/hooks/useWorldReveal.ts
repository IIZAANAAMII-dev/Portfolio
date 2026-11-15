'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { useWorld } from '@/lib/store';
import { INTRO_DURATION, worldRevealProgress } from '@/lib/cinematic';

/**
 * La révélation du monde. Une seule valeur (`gameTransition`, 0 -> 1) pilote le brouillard,
 * la lumière, la caméra, la carte et le surgissement des îles ; tout reste donc synchronisé
 * et le rythme se règle à un seul endroit (lib/cinematic.ts).
 *
 * Mouvement réduit : le monde est posé d'un coup (la carte s'efface en fondu, IntroStage).
 * Passer l'ouverture (clic, Échap) appelle `revealComplete` : la minuterie s'arrête net et ne
 * réécrit plus rien derrière.
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
      onUpdate: () => {
        if (useWorld.getState().phase !== 'transitioning') return;
        setCinematicProgress(progress.value, worldRevealProgress(progress.value));
      },
      onComplete: () => {
        if (useWorld.getState().phase === 'transitioning') revealComplete();
      },
    });

    return () => {
      tween.kill();
    };
  }, [phase]);
}
