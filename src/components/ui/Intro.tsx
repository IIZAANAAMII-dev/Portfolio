'use client';

import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';

export function Intro() {
  const phase = useWorld((state) => state.phase);
  const start = useWorld((state) => state.start);
  const interactive = phase === 'intro';
  const mounted = phase === 'intro' || phase === 'transitioning';

  const onStart = () => {
    if (!interactive) return;
    void ambience.setEnabled(true);
    start();
  };

  if (!mounted) return null;

  return (
    <div
      className={`intro-vignette fixed inset-0 z-30 ${phase === 'transitioning' ? 'is-leaving' : ''}`}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onClick={onStart}
      role="button"
      aria-label="Commencer l’expérience"
    >
      <div className="intro-copy">
        <span className="intro-eyebrow">Carnet de navigation · Méditerranée</span>
        <h1>Kyliann</h1>
        <p>Un portfolio à parcourir au fil de l’eau.</p>
      </div>

      <div className="click-to-start" aria-hidden="true">
        <span>Cliquez</span>
        <span>pour commencer</span>
        <svg viewBox="0 0 120 60" className="click-to-start__arrow" aria-hidden="true">
          <path
            d="M15,12 Q45,45 90,38"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <polygon points="90,38 82,24 98,24" fill="white" />
        </svg>
      </div>
    </div>
  );
}
