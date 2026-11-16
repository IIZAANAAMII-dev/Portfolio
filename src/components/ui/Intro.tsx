'use client';

import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { handedOffClass, IntroTitle } from '@/components/intro/IntroTitle';
import { site } from '@/data/site';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { isCoarsePointer } from '@/lib/utils/device';
import { fr } from './typography';

/** Le nom sur deux lignes, comme peint sur une coque : prénom, puis nom de famille. */
const [FIRST_NAME, ...FAMILY] = site.name.split(' ');
const FAMILY_NAME = FAMILY.join(' ');

/**
 * Relevé de la route, en coin de carte : d'où il vient, où il a jeté l'ancre.
 * Minutes notées avec l'apostrophe droite : DM Mono n'a pas de prime (′).
 */
const ROUTE = [
  { place: site.origin.split(',')[0], position: "47°39'N  2°45'O" },
  { place: site.location, position: "43°17'N  5°22'E" },
];

/** Lettres du cadran, placées autour de l'anneau (CSS, d'après --ring-rx / --ring-ry). */
const CARDINALS = ['n', 'e', 's', 'o'] as const;

/**
 * Le seuil, côté DOM : un cartouche de carte marine (nom, métier, route), et au centre de
 * l'anneau de lanterne (positionné par IntroStage), la progression puis l'invitation.
 * Tout l'écran est cliquable : un clic n'importe où largue les amarres. L'invitation est
 * aussi un vrai bouton (Tab puis Entrée), et Entrée ou Espace suffisent depuis le clavier.
 * La version rapide reste accessible pendant le chargement : un visiteur pressé n'attend pas.
 */
export function Intro() {
  return (
    <>
      <Threshold />
      {/* Pendant l'ouverture, le nom s'envole vers le HUD ; un clic passe à la fin. */}
      <IntroTitle />
    </>
  );
}

function Threshold() {
  const phase = useWorld((state) => state.phase);
  const start = useWorld((state) => state.start);
  const reducedMotion = useWorld((state) => state.reducedMotion);
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
      {/* Cadre gradué de carte marine. */}
      <div className="intro-frame" aria-hidden="true" />

      <header className="intro-brand">
        <p className="intro-kicker">Carnet de navigation</p>
        <p className={phase === 'transitioning' && !reducedMotion ? `intro-title ${handedOffClass}` : 'intro-title'}>
          <span className="intro-title__line">
            <span>{FIRST_NAME}</span>
          </span>{' '}
          <span className="intro-title__line">
            <span>{FAMILY_NAME}</span>
          </span>
        </p>
        <p className="intro-role">{site.role}</p>
        <div className="intro-route">
          {/* « du Morbihan » : le département prend l'article (à revoir si l'origine change). */}
          <p className="sr-only">
            Du {ROUTE[0].place} à {ROUTE[1].place}
          </p>
          {ROUTE.map((leg) => (
            <p key={leg.place} className="intro-route__leg" aria-hidden="true">
              <b>{leg.place}</b>
              <span>{leg.position}</span>
            </p>
          ))}
        </div>
      </header>

      <div id="intro-anchor" className="intro-anchor">
        {CARDINALS.map((direction) => (
          <span key={direction} className="intro-cardinal" data-dir={direction} aria-hidden="true">
            {direction.toUpperCase()}
          </span>
        ))}
        {phase === 'loading' ? (
          <div
            className="intro-loading"
            role="progressbar"
            aria-label="Chargement de l’archipel"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span className="intro-loading__label" aria-hidden="true">
              Relevé de la carte
            </span>
            <b className="intro-loading__value" aria-hidden="true">
              {String(percent).padStart(2, '0')}
              <small>%</small>
            </b>
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
            <span className="intro-cta__kicker">{touch ? 'Touche pour' : 'Clique pour'}</span>{' '}
            <span className="intro-cta__label">larguer les amarres</span>
          </button>
        )}
      </div>

      {/* Annonce unique pour les lecteurs d'écran quand le monde est prêt. */}
      <p className="sr-only" role="status">
        {interactive ? 'L’archipel est prêt.' : ''}
      </p>

      <footer className="intro-foot">
        <p className="intro-hint">
          <span>
            <svg className="intro-hint__icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="4.2" />
              <path d="M8 1.2v3M8 11.8v3M1.2 8h3M11.8 8h3" />
            </svg>
            {touch ? 'Touche la mer pour naviguer' : 'Clique sur la mer pour naviguer'}
          </span>
          <span>
            <svg className="intro-hint__icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
              <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" />
            </svg>
            Le son démarre avec le voyage
          </span>
        </p>
        {phase !== 'transitioning' && (
          <button
            type="button"
            className="intro-quick"
            onClick={(event) => {
              // Ne pas larguer les amarres : le recruteur pressé va droit au contenu.
              event.stopPropagation();
              useWorld.getState().setQuickView(true);
            }}
          >
            <em>{fr('Pressé ?')}</em>
            <span>{fr('Version rapide · 2 min')}</span>
          </button>
        )}
      </footer>
    </div>
  );
}
