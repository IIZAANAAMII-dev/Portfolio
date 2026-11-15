'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { islands } from '@/data/islands';
import { skillZoneById } from '@/data/skills';
import { boatState } from '@/lib/boat-state';
import { STAR_COUNT, useLogbook, type StampId } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { probe } from './bridge';
import { SPOTS, levelLabel, nearestSpot, zonesCaught } from './fishing-data';
import { ApproachHint, Basket, CatchCard, FishingDock, FloatMarker } from './FishingUI';
import { ArrowIcon, CameraIcon, CloseIcon, CreelIcon } from './icons';
import { PostcardLayer, ShutterBar, takePhoto } from './PostcardUI';
import { useRegatta } from './regatta';
import { RegattaDock, RegattaHint } from './RegattaUI';
import { useGameplay } from './store';
import styles from './gameplay.module.css';

/**
 * Interfaces DOM du gameplay, rangées dans les zones de globals.css :
 *  - le dock (bas centre, `--zone-bottom`) : pêche, viseur, coin en vue, prochain cap ;
 *  - le rail (colonne au-dessus de la radio, `--rail-b`) : appareil photo, bourriche ;
 *  - la carte de prise au-dessus du dock, le bouchon suivi à l'écran, la chambre noire.
 * Rien ne s'affiche tant que la scène 3D du gameplay n'est pas montée.
 */

function useGameplayKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const game = useGameplay.getState();
      const onButton = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        if (game.photo !== 'off') game.closePhoto();
        else if (game.basketOpen) game.setBasketOpen(false);
        else if (game.phase !== 'idle') game.stop();
        return;
      }
      if (game.photo === 'aim') {
        if (key === 'arrowleft' || key === 'arrowright') {
          event.preventDefault();
          game.setFraming(game.framing + (key === 'arrowleft' ? -1 : 1));
        } else if ((key === ' ' || key === 'enter') && !onButton) {
          event.preventDefault();
          takePhoto();
        }
        return;
      }
      if (game.photo !== 'off') return;
      // Pendant la régate, la canne reste rangée.
      const race = useRegatta.getState().phase;
      if (race === 'armed' || race === 'racing') return;
      const lineOut = game.phase === 'cast' || game.phase === 'wait' || game.phase === 'bite';
      if (lineOut && (key === 'f' || (key === ' ' && !onButton))) {
        event.preventDefault();
        game.strike();
      } else if (key === 'f' && game.near >= 0 && (game.phase === 'idle' || game.phase === 'caught' || game.phase === 'missed')) {
        game.cast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

interface Teaser {
  id: string;
  text: string;
  action?: { label: string; run: () => void };
}

function sailToNearestSpot() {
  const { index } = nearestSpot(boatState.position.x, boatState.position.z);
  if (index < 0) return;
  const spot = SPOTS[index];
  const dx = spot.x - boatState.position.x;
  const dz = spot.z - boatState.position.z;
  const length = Math.hypot(dx, dz) || 1;
  useWorld.getState().sailToPoint([spot.x - (dx / length) * 4.6, spot.z - (dz / length) * 4.6]);
}

/** Une fois toutes les îles visitées : ce qu'il reste à découvrir (jamais de faux contenu). */
function teasers(stamps: StampId[], stars: number, raced: boolean): Teaser[] {
  const list: Teaser[] = [];
  if (!stamps.includes('fishing')) {
    list.push({
      id: 'fishing',
      text: 'Des poissons sautent au large : arrête-toi sur un bouillon et pêche une compétence.',
      action: { label: 'Y aller', run: sailToNearestSpot },
    });
  }
  if (!stamps.includes('postcard')) {
    list.push({
      id: 'postcard',
      text: 'L’appareil photo, à droite, tire une carte postale de l’archipel.',
      action: { label: 'Essayer', run: () => useGameplay.getState().aim() },
    });
  }
  if (!raced) {
    list.push({
      id: 'regatta',
      text: 'La régate des bouées : six marques autour du port d’attache, un chrono et ton record.',
      action: { label: 'Courir', run: () => useRegatta.getState().start() },
    });
  }
  if (stars < STAR_COUNT) {
    const left = STAR_COUNT - stars;
    list.push({ id: 'stars', text: `Il reste ${left} étoile${left > 1 ? 's' : ''} d’or à repêcher dans l’archipel.` });
  }
  if (!stamps.includes('night')) {
    list.push({
      id: 'night',
      text: 'À la nuit tombée, les fenêtres s’allument et l’eau se met à briller.',
      action: { label: 'Voir la nuit', run: () => useWorld.getState().toggleDayNight() },
    });
  }
  if (!stamps.includes('static')) list.push({ id: 'static', text: 'Quelque chose grésille dans la brume, loin au sud-est…' });
  return list;
}

/** « Prochain cap » : l'île pas encore visitée, puis les découvertes restantes. */
function NextCap() {
  const stamps = useLogbook((s) => s.stamps);
  const stars = useLogbook((s) => s.stars.length);
  const hydrated = useLogbook((s) => s.hydrated);
  const raced = useRegatta((s) => s.best !== null);
  const sailTo = useWorld((s) => s.sailTo);
  const [dismissed, setDismissed] = useState(-1);
  const arrow = useRef<HTMLSpanElement>(null);
  const next = islands.find((island) => !stamps.includes(`island:${island.id}`)) ?? null;
  const nextId = next?.id ?? null;

  // La flèche pointe vers l'île à l'écran (cap relatif à la caméra), quelques fois par seconde.
  useEffect(() => {
    if (!nextId) return;
    const island = islands.find((entry) => entry.id === nextId);
    if (!island) return;
    const update = () => {
      const node = arrow.current;
      if (!node) return;
      const dx = island.position[0] - boatState.position.x;
      const dz = island.position[1] - boatState.position.z;
      const across = dx * -probe.viewZ + dz * probe.viewX;
      const along = dx * probe.viewX + dz * probe.viewZ;
      node.style.transform = `rotate(${((Math.atan2(across, along) * 180) / Math.PI).toFixed(1)}deg)`;
    };
    update();
    const timer = window.setInterval(update, 180);
    return () => window.clearInterval(timer);
  }, [nextId]);

  if (!hydrated || dismissed === stamps.length) return null;
  const hide = () => setDismissed(stamps.length);

  if (next) {
    return (
      <div className={styles.cap} style={{ '--accent': next.accent } as CSSProperties} data-enter="" data-delay="">
        <button type="button" className={styles.capMain} onClick={() => sailTo(next.id)}>
          <span ref={arrow} className={styles.capArrow}>
            <ArrowIcon className={styles.icon} />
          </span>
          <span className={styles.capText}>
            <span className={styles.label}>Prochain cap</span>
            <strong className={styles.capName}>{next.label}</strong>
            <em className={styles.capTagline}>{next.tagline}</em>
          </span>
        </button>
        <button type="button" className={styles.capClose} onClick={hide} aria-label="Masquer le prochain cap">
          <CloseIcon className={styles.icon} />
        </button>
      </div>
    );
  }

  const teaser = teasers(stamps, stars, raced)[0];
  if (!teaser) return null;
  return (
    <div className={styles.cap} data-enter="" data-delay="">
      <p className={styles.capText}>
        <span className={styles.label}>Au large</span>
        <span className={styles.voice}>{teaser.text}</span>
      </p>
      {teaser.action && (
        <button type="button" className={styles.primary} onClick={teaser.action.run}>
          {teaser.action.label}
        </button>
      )}
      <button type="button" className={styles.capClose} onClick={hide} aria-label="Masquer l’indice">
        <CloseIcon className={styles.icon} />
      </button>
    </div>
  );
}

function Dock() {
  const photo = useGameplay((s) => s.photo);
  const fishing = useGameplay((s) => s.phase);
  const near = useGameplay((s) => s.near);
  const approach = useGameplay((s) => s.approach);
  const worldPhase = useWorld((s) => s.phase);
  const sailing = useWorld((s) => s.destination !== null || s.freeTarget !== null);
  const race = useRegatta((s) => s.phase);
  const nearStart = useRegatta((s) => s.nearStart);

  let content = null;
  if (photo === 'aim' || photo === 'shoot') content = <ShutterBar />;
  else if (photo !== 'off') content = null;
  else if (race !== 'off') content = <RegattaDock />;
  else if (fishing !== 'idle' || near >= 0) content = <FishingDock />;
  else if (worldPhase === 'playing' && nearStart && !sailing) content = <RegattaHint />;
  else if (worldPhase === 'playing' && approach >= 0) content = <ApproachHint index={approach} />;
  else if (worldPhase === 'playing' && !sailing) content = <NextCap />;
  return <div className={styles.dock}>{content}</div>;
}

function Rail() {
  const photo = useGameplay((s) => s.photo);
  const zones = useGameplay((s) => zonesCaught(s.basket).length);
  const basketOpen = useGameplay((s) => s.basketOpen);
  const setBasketOpen = useGameplay((s) => s.setBasketOpen);
  const aim = useGameplay((s) => s.aim);
  // Téléphone : la carte de prise occupe la largeur, le rail lui laisse la place.
  const card = useGameplay((s) => s.phase === 'caught' || s.phase === 'missed');
  return (
    <div className={styles.rail} data-hidden={photo !== 'off'} data-card={card} role="toolbar" aria-label="Appareil photo et bourriche">
      <button type="button" className={styles.railButton} onClick={aim} aria-label="Prendre une carte postale de l’archipel" data-label="Carte postale">
        <CameraIcon className={styles.railIcon} />
      </button>
      {zones > 0 && (
        <button
          type="button"
          className={styles.railButton}
          onClick={() => setBasketOpen(!basketOpen)}
          aria-expanded={basketOpen}
          aria-controls="bourriche"
          aria-label={`La bourriche : ${zones} zones sur 6`}
          data-label="La bourriche"
        >
          <CreelIcon className={styles.railIcon} />
          <span className={styles.badge}>{zones}/6</span>
        </button>
      )}
    </div>
  );
}

/** Annonces pour les lecteurs d'écran (la partie se joue aussi sans voir le bouchon). */
function Announcer() {
  const phase = useGameplay((s) => s.phase);
  const result = useGameplay((s) => s.result);
  const joke = useGameplay((s) => s.joke);
  let message = '';
  if (phase === 'wait') message = 'Ligne à l’eau. Attends la touche, puis ferre avec F ou Espace.';
  else if (phase === 'bite') message = 'Ça mord ! Ferre maintenant !';
  else if (phase === 'caught' && result) {
    message = `Prise : ${result.name}, ${skillZoneById[result.zone].label}, ${levelLabel(result.level)}.`;
  } else if (phase === 'missed') message = `Il s’est décroché. ${joke}`;
  return (
    <p className={styles.sr} role="status" aria-live={phase === 'bite' ? 'assertive' : 'polite'}>
      {message}
    </p>
  );
}

export default function GameplayUI() {
  const ready = useGameplay((s) => s.ready3D);
  const hydrate = useGameplay((s) => s.hydrate);
  const hydrateRegatta = useRegatta((s) => s.hydrate);
  const phase = useWorld((s) => s.phase);
  useEffect(() => {
    hydrate();
    hydrateRegatta();
  }, [hydrate, hydrateRegatta]);
  useGameplayKeys();

  if (!ready || (phase !== 'playing' && phase !== 'docked')) return null;
  return (
    <>
      <FloatMarker />
      <CatchCard />
      <Dock />
      <Rail />
      <Basket />
      <PostcardLayer />
      <Announcer />
    </>
  );
}
