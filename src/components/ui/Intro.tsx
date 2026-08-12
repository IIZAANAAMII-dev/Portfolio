'use client';

import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';

export function Intro() {
  const phase = useWorld((s) => s.phase);
  const start = useWorld((s) => s.start);
  const visible = phase === 'intro';

  const onStart = () => {
    void ambience.setEnabled(true);
    start();
  };

  return (
    <div
      className="intro-vignette fixed inset-0 z-30 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
      onClick={visible ? onStart : undefined}
    >
      <div className="intro-compass" aria-hidden="true">
        <span>N</span><i /><span>S</span><b>✦</b>
      </div>

      <div className="absolute inset-x-0 top-[8vh] flex justify-center px-5 text-center md:top-[9vh]">
        <div className="intro-title animate-rise">
          <span className="intro-eyebrow">Carnet de navigation · Méditerranée</span>
          <h1>Kyliann</h1>
          <p>Un portfolio à parcourir au fil de l’eau.</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[7vh] flex justify-center px-5 md:bottom-[9vh]">
        <button
          type="button"
          onClick={onStart}
          className="intro-chart-button group"
          aria-label="Commencer l’expérience"
        >
          <span className="intro-chart-button__icon" aria-hidden="true">⚓</span>
          <span>
            <small>Prendre la barre</small>
            <strong>Explorer l’archipel</strong>
          </span>
          <span className="intro-chart-button__arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <span className="intro-coordinate intro-coordinate--left">43°18′ N</span>
      <span className="intro-coordinate intro-coordinate--right">05°22′ E</span>
    </div>
  );
}
