'use client';

import { useProgress } from '@react-three/drei';
import { useWorld } from '@/lib/store';

/** The voyage is optional: content and sound remain independent of WebGL loading. */
export function Intro() {
  const phase = useWorld((state) => state.phase);
  const soundOn = useWorld((state) => state.soundOn);
  const progress = useProgress((state) => state.progress);
  const interactive = phase === 'intro';
  if (phase !== 'loading' && phase !== 'intro' && phase !== 'transitioning') return null;

  return (
    <section className="intro-screen atlas-intro" data-phase={phase} aria-label="Bienvenue dans l’archipel de Kyliann">
      <header className="atlas-masthead">
        <span className="atlas-monogram" aria-hidden="true">KLG<span>✦</span></span>
        <span>Développement · Design · Exploration</span>
        <button type="button" className="atlas-text-button" onClick={() => useWorld.getState().setQuickView(true)}>Version recruteur ↗</button>
      </header>
      <div className="atlas-title">
        <p className="atlas-kicker">Un portfolio à explorer · 2026</p>
        <h1>Kyliann<br /><span>Le Garrec.</span></h1>
        <p className="atlas-intro-copy">Les pieds sur terre.<br /><em>Les idées au large.</em></p>
      </div>
      <div id="intro-anchor" className="intro-anchor" aria-live="polite">
        {phase === 'loading' ? (
          <div className="intro-loading"><span>Préparation du voyage</span><b>{Math.min(99, Math.round(progress))}%</b></div>
        ) : <div className="atlas-ring-label" aria-hidden="true">L’archipel<br />vous attend</div>}
      </div>
      <div className="atlas-departure">
        <p><span>01 / ATLANTIQUE</span><i aria-hidden="true" /><span>02 / MÉDITERRANÉE</span></p>
        <div className="atlas-departure-actions">
          <button type="button" className="atlas-start" disabled={!interactive} onClick={() => useWorld.getState().start()}>
            {interactive ? 'Prendre le large' : 'L’archipel se prépare'}<span aria-hidden="true">↗</span>
          </button>
          <button type="button" className="atlas-text-button" aria-pressed={soundOn} onClick={() => useWorld.getState().toggleSound()}>
            {soundOn ? 'Son activé' : 'Activer le son'}
          </button>
        </div>
        <p className="atlas-caption">Six escales. Un parcours. Quelques secrets.</p>
      </div>
      <div className="atlas-location"><span>BRETAGNE → MARSEILLE</span><span>Développeur full stack</span></div>
      {phase === 'transitioning' && <button type="button" className="atlas-skip" onClick={() => useWorld.getState().revealComplete()}>Passer l’introduction ↗</button>}
    </section>
  );
}
