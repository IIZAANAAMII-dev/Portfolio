'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { isCoarsePointer } from '@/lib/utils/device';

/**
 * Le seuil, côté DOM : presque rien. Le nom en haut à gauche, et au centre de l'anneau de
 * lanterne (positionné par IntroStage), la progression puis l'invitation à cliquer.
 * Tout l'écran est cliquable : un clic n'importe où largue les amarres. L'invitation est
 * aussi un vrai bouton (Tab puis Entrée), et Entrée ou Espace suffisent depuis le clavier.
 */
export function Intro() {
  const phase = useWorld((state) => state.phase);
  const start = useWorld((state) => state.start);
  const progress = useProgress((state) => state.progress);
  // Monté côté client uniquement (ExperienceLoader) : l'appareil est connu dès le rendu.
  const [touch] = useState(isCoarsePointer);
  const interactive = phase === 'intro';

  // Clavier : Entrée ou Espace larguent les amarres, sauf sur un autre bouton du seuil.
  useEffect(() => {
    if (!interactive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select')) return;
      event.preventDefault();
      void ambience.setEnabled(true);
      useWorld.getState().start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive]);

  if (phase !== 'loading' && phase !== 'intro' && phase !== 'transitioning') return null;

  const onStart = () => {
    if (!interactive) return;
    void ambience.setEnabled(true);
    start();
  };
  const percent = Math.min(99, Math.round(progress));

  return (
    <div className="intro-screen" data-phase={phase} onClick={onStart}>
      <header className="intro-brand">
        <span className="intro-eyebrow">Carnet de navigation</span>
        <strong>Kyliann</strong>
      </header>

      <div id="intro-anchor" className="intro-anchor">
        {phase === 'loading' ? (
          <div
            className="intro-loading"
            role="progressbar"
            aria-label="Chargement de l’archipel"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span aria-hidden="true">Chargement de l’archipel</span>
            <b aria-hidden="true">{percent}%</b>
          </div>
        ) : (
          <button
            type="button"
            className="intro-cta"
            tabIndex={interactive ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              onStart();
            }}
          >
            <span>{touch ? 'Touchez' : 'Cliquez'}</span>
            <span>pour dévoiler le monde</span>
          </button>
        )}
      </div>

      {/* Annonce unique pour les lecteurs d'écran quand le monde est prêt. */}
      <p className="sr-only" role="status">
        {interactive ? 'L’archipel est prêt.' : ''}
      </p>

      <div className="intro-foot">
        {interactive && (
          <button
            type="button"
            className="intro-quick"
            onClick={(event) => {
              // Ne pas larguer les amarres : le recruteur pressé va droit au contenu.
              event.stopPropagation();
              useWorld.getState().setQuickView(true);
            }}
          >
            Pressé ? <span>Version rapide · 2 min</span>
          </button>
        )}
        <p className="intro-hint">
          {touch ? 'Touchez la mer pour naviguer' : 'Naviguez au clic sur la mer'} · le son démarre avec le voyage
        </p>
      </div>
    </div>
  );
}
