'use client';

import { useEffect, useState } from 'react';
import { useTour } from '@/components/tour/tour-store';
import { STAMPS, STAR_COUNT, useLogbook, type StampId, type StampInfo } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { fr, NNBSP, plural } from './typography';
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

function BookIcon() {
  return (
    <svg className="hud-btn__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 5.2C8.3 3.9 5.9 3.5 3.2 3.8v11.6c2.7-.3 5.1.1 6.8 1.4 1.7-1.3 4.1-1.7 6.8-1.4V3.8c-2.7-.3-5.1.1-6.8 1.4z" fill="currentColor" fillOpacity="0.14" />
      <path d="M10 5.2v11.6" />
    </svg>
  );
}

/**
 * Bouton du HUD : un carnet et sa pastille d'encre (nombre de tampons). Même gabarit que
 * les autres réglages (icône seule de 44 px sur téléphone) ; la pastille rejoue son coup
 * de tampon à chaque nouvelle entrée.
 */
export function LogbookButton() {
  const stamps = useLogbook((state) => state.stamps);
  const latest = useLogbook((state) => state.latest);
  const setOpen = useLogbook((state) => state.setOpen);
  const hydrate = useLogbook((state) => state.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return (
    <button
      type="button"
      className="hud-btn"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={`Carnet de bord : ${stamps.length} ${plural(stamps.length, 'tampon')} sur ${STAMPS.length}`}
      title="Carnet de bord"
    >
      <BookIcon />
      <span className="hud-btn__label">Carnet</span>
      <span key={latest?.at ?? 0} className="hud-badge" data-fresh={latest ? 'true' : undefined} aria-hidden="true">
        {stamps.length}
      </span>
    </button>
  );
}

/** Pages du carnet : les îles, les îlots, puis les trouvailles et exploits du voyage. */
const STAMP_GROUPS: { title: string; match: (id: StampId) => boolean }[] = [
  { title: 'Îles', match: (id) => id.startsWith('island:') },
  { title: 'Îlots', match: (id) => id.startsWith('islet:') },
  { title: 'Trouvailles', match: (id) => !id.startsWith('island:') && !id.startsWith('islet:') },
];

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
  const progress = STAMPS.length ? stamps.length / STAMPS.length : 0;
  return (
    <div className="logbook-backdrop" onClick={() => setOpen(false)}>
      <section
        className="logbook"
        role="dialog"
        aria-modal="true"
        aria-label="Carnet de bord"
        onClick={(event) => event.stopPropagation()}
      >
        {/* La page de papier (marge rouge, lignes, ombre intérieure) défile seule ; la
            croix reste en place au-dessus d'elle. */}
        <div className="logbook__sheet">
          <header className="logbook__header">
            <span className="intro-eyebrow">Carnet de bord</span>
            <h2>Tampons de voyage</h2>
            <p>{fr(`${stamps.length}/${STAMPS.length} tampons · ${stars.length}/${STAR_COUNT} étoiles d’or`)}</p>
            <div className="logbook__progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
            </div>
          </header>
          <div className="logbook__tabs" role="tablist" aria-label="Pages du carnet">
            <button type="button" role="tab" id="logbook-tab-map" aria-selected={tab === 'map'} aria-controls="logbook-page" onClick={() => setTab('map')}>
              Carte de voyage
            </button>
            <button type="button" role="tab" id="logbook-tab-stamps" aria-selected={tab === 'stamps'} aria-controls="logbook-page" onClick={() => setTab('stamps')}>
              Tampons
            </button>
          </div>
          <div id="logbook-page" role="tabpanel" aria-labelledby={tab === 'map' ? 'logbook-tab-map' : 'logbook-tab-stamps'}>
          {tab === 'map' ? (
            <VoyageMap />
          ) : (
            STAMP_GROUPS.map((group) => {
              const entries = STAMPS.filter((stamp) => group.match(stamp.id));
              const earnedCount = entries.filter((stamp) => stamps.includes(stamp.id)).length;
              return (
                <section key={group.title} className="logbook__group" aria-label={group.title}>
                  <h3>
                    {group.title}
                    <b>
                      {earnedCount}/{entries.length}
                    </b>
                  </h3>
                  <div className="logbook__grid">
                    {entries.map((stamp) => {
                      const earned = stamps.includes(stamp.id);
                      return (
                        <div key={stamp.id} className="logbook__cell" data-earned={earned || undefined}>
                          <Stamp stamp={stamp} earned={earned} />
                          <span className="logbook__hint">{earned ? 'obtenu' : fr(stamp.hint)}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
          </div>
        </div>
        <button type="button" className="logbook__close" onClick={() => setOpen(false)} aria-label="Fermer le carnet">
          ×
        </button>
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
          <span className="intro-eyebrow">{complete ? fr('Carnet complet !') : 'Nouveau tampon'}</span>
          <strong>{complete ? 'Merci d’avoir navigué jusqu’ici' : stamp.title}</strong>
          {complete && (
            <button type="button" className="stamp-toast__cta" onClick={() => sailTo('contact')}>
              {fr('On se parle ?')}
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
          <strong>{`${latestStar.count}${NNBSP}/${NNBSP}${STAR_COUNT}`}</strong>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Mot d'accueil : quelques secondes après le dévoilement, une seule fois par visite et
 * seulement pour un carnet presque vide, il présente le jeu du carnet de bord. Un message à
 * la fois : il attend que l'invitation à la visite guidée soit partie, et se tait pendant la
 * visite.
 */
export function WelcomeHint() {
  const phase = useWorld((state) => state.phase);
  const stamps = useLogbook((state) => state.stamps);
  const setOpen = useLogbook((state) => state.setOpen);
  const tourBusy = useTour((state) => state.invite || state.status !== 'idle');
  const touring = useTour((state) => state.status === 'running');
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (phase !== 'playing' || shown || tourBusy) return;
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
  }, [phase, shown, tourBusy]);

  useEffect(() => {
    if (!shown) return;
    const hide = window.setTimeout(() => setGone(true), 9000);
    return () => window.clearTimeout(hide);
  }, [shown]);

  if (!shown || gone || stamps.length > 3 || touring) return null;
  return (
    <div className="stamp-toast is-welcome" role="status">
      <span className="stamp-toast__star" aria-hidden="true">✦</span>
      <div className="stamp-toast__text">
        <span className="intro-eyebrow">Ton carnet de bord t’attend</span>
        <strong>{fr(`${STAMPS.length} tampons, ${STAR_COUNT} étoiles d’or et la carte de ton voyage`)}</strong>
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
