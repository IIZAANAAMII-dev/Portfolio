'use client';

import { useProgress } from '@react-three/drei';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';

/**
 * Le seuil, côté DOM : presque rien. Le nom en haut à gauche, et au centre de l'anneau de
 * lanterne (positionné par IntroStage), la progression puis l'invitation à cliquer.
 * Tout l'écran est cliquable : un clic n'importe où largue les amarres.
 */
export function Intro() {
  const phase = useWorld((state) => state.phase);
  const start = useWorld((state) => state.start);
  const progress = useProgress((state) => state.progress);
  const interactive = phase === 'intro';

  if (phase !== 'loading' && phase !== 'intro' && phase !== 'transitioning') return null;

  const onStart = () => {
    if (!interactive) return;
    void ambience.setEnabled(true);
    start();
  };

  return (
    <div
      className="intro-screen"
      data-phase={phase}
      onClick={onStart}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onStart();
      }}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-disabled={!interactive}
      aria-label="Cliquer pour dévoiler le monde"
    >
      <header className="intro-brand">
        <span className="intro-eyebrow">Carnet de navigation</span>
        <strong>Kyliann</strong>
      </header>

      <div id="intro-anchor" className="intro-anchor" aria-live="polite">
        {phase === 'loading' ? (
          <div className="intro-loading">
            <span>Chargement de l’archipel</span>
            <b>{Math.min(99, Math.round(progress))}%</b>
          </div>
        ) : (
          <div className="intro-cta">
            <span>Cliquez</span>
            <span>pour dévoiler le monde</span>
          </div>
        )}
      </div>

      <p className="intro-hint">Naviguez au clic sur la mer · le son démarre avec le voyage</p>
    </div>
  );
}
