'use client';

import { useEffect, useState } from 'react';
import { STAMPS, STAR_COUNT, useLogbook, type StampId, type StampInfo } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { VoyageMap } from './VoyageMap';

/**
 * Carnet de bord : un passeport de marin. Chaque tampon s'imprime à l'encre (rouge pour
 * les îles, bleue pour les îlots, or pour les étoiles, verte pour les exploits) avec un
 * angle un peu de travers, comme un vrai coup de tampon.
 */

function inkOf(id: StampId) {
  if (id.startsWith('island:')) return '#c8553d';
  if (id.startsWith('islet:')) return '#3f5fb5';
  if (id === 'stars') return '#c9901c';
  return '#2f7a5a';
}

export function Stamp({ stamp, earned, size = 'normal' }: { stamp: StampInfo; earned: boolean; size?: 'normal' | 'large' }) {
  const tilt = (hash(stamp.id.length * 7.3 + stamp.title.length * 1.9) - 0.5) * 22;
  return (
    <div
      className={`logbook-stamp ${earned ? 'is-earned' : ''} ${size === 'large' ? 'is-large' : ''}`}
      style={{ ['--ink' as string]: inkOf(stamp.id), ['--tilt' as string]: `${tilt}deg` }}
    >
      <span className="logbook-stamp__glyph" aria-hidden="true">{earned ? stamp.glyph : '?'}</span>
      <span className="logbook-stamp__title">{stamp.title}</span>
    </div>
  );
}

/** Bouton du HUD : « Carnet 5/16 ». */
export function LogbookButton() {
  const stamps = useLogbook((state) => state.stamps);
  const setOpen = useLogbook((state) => state.setOpen);
  const hydrate = useLogbook((state) => state.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return (
    <button type="button" className="ghost-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      Carnet {stamps.length}/{STAMPS.length}
    </button>
  );
}

export function LogbookPanel() {
  const open = useLogbook((state) => state.open);
  const stamps = useLogbook((state) => state.stamps);
  const stars = useLogbook((state) => state.stars);
  const setOpen = useLogbook((state) => state.setOpen);
  const [tab, setTab] = useState<'map' | 'stamps'>('map');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="logbook-backdrop" onClick={() => setOpen(false)}>
      <section
        className="logbook"
        role="dialog"
        aria-modal="true"
        aria-label="Carnet de bord"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="logbook__header">
          <span className="intro-eyebrow">Carnet de bord</span>
          <h2>Tampons de voyage</h2>
          <p>
            {stamps.length} / {STAMPS.length} tampons · étoiles d’or {stars.length} / {STAR_COUNT}
          </p>
          <button type="button" className="logbook__close" onClick={() => setOpen(false)} aria-label="Fermer le carnet">
            ×
          </button>
        </header>
        <div className="logbook__tabs" role="tablist" aria-label="Pages du carnet">
          <button type="button" role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>
            Carte de voyage
          </button>
          <button type="button" role="tab" aria-selected={tab === 'stamps'} onClick={() => setTab('stamps')}>
            Tampons
          </button>
        </div>
        {tab === 'map' ? (
          <VoyageMap />
        ) : (
          <div className="logbook__grid">
            {STAMPS.map((stamp) => {
              const earned = stamps.includes(stamp.id);
              return (
                <div key={stamp.id} className="logbook__cell">
                  <Stamp stamp={stamp} earned={earned} />
                  <span className="logbook__hint">{earned ? 'obtenu' : stamp.hint}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** Notification : un tampon s'écrase sur l'écran, ou une étoile d'or s'ajoute au compteur. */
export function StampToast() {
  const latest = useLogbook((state) => state.latest);
  const latestStar = useLogbook((state) => state.latestStar);
  const stamps = useLogbook((state) => state.stamps);
  const sailTo = useWorld((state) => state.sailTo);
  const [now, setNow] = useState(0);

  // Horloge locale : la notification disparaît d'elle-même après quelques secondes.
  useEffect(() => {
    if (!latest && !latestStar) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [latest, latestStar]);

  const complete = stamps.length >= STAMPS.length;
  const stampFresh = latest && now - latest.at < (complete ? 9000 : 4200);
  const starFresh = latestStar && now - latestStar.at < 3200 && (!latest || latestStar.at > latest.at);

  if (stampFresh && latest) {
    const stamp = STAMPS.find((entry) => entry.id === latest.id);
    if (!stamp) return null;
    return (
      <div className="stamp-toast" key={latest.at} role="status">
        <Stamp stamp={stamp} earned size="large" />
        <div className="stamp-toast__text">
          <span className="intro-eyebrow">{complete ? 'Carnet complet !' : 'Nouveau tampon'}</span>
          <strong>{complete ? 'Merci d’avoir navigué jusqu’ici' : stamp.title}</strong>
          {complete && (
            <button type="button" className="stamp-toast__cta" onClick={() => sailTo('contact')}>
              On se parle ?
            </button>
          )}
        </div>
      </div>
    );
  }
  if (starFresh && latestStar) {
    return (
      <div className="stamp-toast is-star" key={latestStar.at} role="status">
        <span className="stamp-toast__star" aria-hidden="true">✦</span>
        <div className="stamp-toast__text">
          <span className="intro-eyebrow">Étoile d’or</span>
          <strong>{latestStar.count} / {STAR_COUNT}</strong>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Mot d'accueil : quelques secondes après le dévoilement, une seule fois par visite et
 * seulement pour un carnet presque vide, il présente le jeu du carnet de bord.
 */
export function WelcomeHint() {
  const phase = useWorld((state) => state.phase);
  const stamps = useLogbook((state) => state.stamps);
  const setOpen = useLogbook((state) => state.setOpen);
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (phase !== 'playing' || shown) return;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem('kyliann-welcome') === '1';
    } catch {
      seen = false;
    }
    if (seen || useLogbook.getState().stamps.length > 2) return;
    const show = window.setTimeout(() => {
      setShown(true);
      try {
        window.sessionStorage.setItem('kyliann-welcome', '1');
      } catch {
        // Sans stockage, le mot reviendra à la prochaine visite : sans gravité.
      }
    }, 2600);
    return () => window.clearTimeout(show);
  }, [phase, shown]);

  useEffect(() => {
    if (!shown) return;
    const hide = window.setTimeout(() => setGone(true), 9000);
    return () => window.clearTimeout(hide);
  }, [shown]);

  if (!shown || gone || stamps.length > 3) return null;
  return (
    <div className="stamp-toast is-welcome" role="status">
      <span className="stamp-toast__star" aria-hidden="true">✦</span>
      <div className="stamp-toast__text">
        <span className="intro-eyebrow">Ton carnet de bord t’attend</span>
        <strong>{STAMPS.length} tampons, {STAR_COUNT} étoiles d’or et la carte de ton voyage</strong>
        <button
          type="button"
          className="stamp-toast__cta"
          onClick={() => {
            setGone(true);
            setOpen(true);
          }}
        >
          Ouvrir le carnet
        </button>
      </div>
    </div>
  );
}
