'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useGameplay } from '@/components/gameplay/store';
import { STAMPS, useLogbook, type StampId } from '@/lib/logbook';
import { sheetState } from '@/lib/sheet';
import { useWorld } from '@/lib/store';
import type { WorldPhase } from '@/types';
import { CONTACT_EMAIL, FIRST_NAME, TOUR_LENGTH, TOUR_STOPS } from './tour-script';
import {
  bindTourToWorld,
  completeDwell,
  DWELL_MS,
  dwellClock,
  gameplayActivity,
  READING_HOLD_MS,
  useTour,
  type TourStage,
  type TourStatus,
} from './tour-store';
import styles from './GuidedTour.module.css';

/**
 * Visite guidée (DOM) : pour le visiteur — ou le recruteur — qui veut simplement regarder.
 * Un bouton « Visite guidée » au-dessus de la boussole (proposé aussi juste après le
 * dévoilement), puis un sous-titre de cinéma pendant que le bateau fait escale île par île,
 * et une carte de fin qui invite à explorer et à écrire. Tout le pilotage est dans
 * tour-store.ts ; ici, l'affichage, le chrono des escales, le clavier et l'invitation.
 */

const INVITE_KEY = 'kyliann-tour-invite';
/** L'invitation arrive juste après le dévoilement, puis s'efface d'elle-même. */
const INVITE_DELAY = 900;
const INVITE_MS = 14000;
const AUTOSTART_DELAY = 1200;
/** Au-delà de cette part d'écran, la feuille (téléphone) recouvre la place du sous-titre. */
const SHEET_COVERS = 0.62;
/** Espace sur l'un de ces éléments : c'est leur geste, pas une pause de la visite. */
const INTERACTIVE =
  'button, a[href], input, textarea, select, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="slider"], [role="tab"]';
const ISLET_STAMPS: StampId[] = ['islet:breizh', 'islet:tech', 'islet:design'];

/** `?tour` (ou `?tour=3`) : la visite démarre d'elle-même dès que le monde est prêt (lien à partager). */
const autostart = { from: readAutostart() };

function readAutostart(): number | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('tour');
  if (value === null) return null;
  const stop = Number.parseInt(value, 10);
  return Number.isFinite(stop) && stop > 0 ? Math.min(stop, TOUR_LENGTH) - 1 : 0;
}

function readFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Sans stockage, l'invitation reviendra à la prochaine visite : sans gravité.
  }
}

/* ------------------------------------------------------------------ ICÔNES */

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.6 2.7v10.6L13.2 8z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.7" y="2.8" width="3" height="10.4" rx="0.9" fill="currentColor" />
      <rect x="9.3" y="2.8" width="3" height="10.4" rx="0.9" fill="currentColor" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.8 2.9v10.2L10 8z" fill="currentColor" />
      <rect x="10.9" y="2.9" width="2.3" height="10.2" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.3 8.4a4.8 4.8 0 1 0 1.5-4" />
      <path d="M3.4 2.3v2.8h2.8" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3.6" width="12" height="8.8" rx="1.6" />
      <path d="M2.7 4.5 8 8.6l5.3-4.1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ MOTEUR */

/**
 * Observation du monde, chrono des escales (boucle d'affichage, sans rendu React), attente
 * quand le visiteur lit, raccourcis clavier (Espace : pause, Échap : quitter).
 */
function useTourEngine(root: RefObject<HTMLDivElement | null>, status: TourStatus, stage: TourStage, visible: boolean) {
  useEffect(() => (status === 'running' ? bindTourToWorld() : undefined), [status]);

  // Carte de fin : si le visiteur met le cap de lui-même, elle se range.
  useEffect(() => {
    if (status !== 'ended') return;
    return useWorld.subscribe((world, previous) => {
      const sailing =
        (world.destination !== null && world.destination !== previous.destination) ||
        (world.freeTarget !== null && world.freeTarget !== previous.freeTarget);
      if (sailing) useTour.getState().dismissEnd();
    });
  }, [status]);

  useEffect(() => {
    const element = root.current;
    if (status === 'idle' || !visible || !element) return;
    let frame = 0;
    let last = performance.now();
    let covered = false;
    let held = false;
    let shown = -1;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(Math.max(now - last, 0), 100);
      last = now;
      // Téléphone : feuille tirée vers le haut, le sous-titre n'a plus sa place.
      const nextCovered = sheetState.cover > SHEET_COVERS;
      if (nextCovered !== covered) {
        covered = nextCovered;
        element.toggleAttribute('data-covered', covered);
      }
      const tour = useTour.getState();
      const dwelling = tour.status === 'running' && tour.stage === 'dwell';
      // Le chrono attend : pause, lecture (geste récent, feuille dépliée), carnet ou bourriche ouverts.
      const nextHeld =
        dwelling &&
        (tour.paused ||
          covered ||
          useLogbook.getState().open ||
          gameplayActivity().open ||
          now < dwellClock.holdUntil);
      if (nextHeld !== held) {
        held = nextHeld;
        element.toggleAttribute('data-held', held);
      }
      if (dwelling && !held) dwellClock.elapsed += dt;
      const progress = dwelling ? Math.min(dwellClock.elapsed / DWELL_MS, 1) : 0;
      const step = Math.round(progress * 500);
      if (step !== shown) {
        shown = step;
        element.style.setProperty('--p', (step / 500).toFixed(3));
      }
      if (dwelling && progress >= 1) completeDwell();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.removeAttribute('data-covered');
      element.removeAttribute('data-held');
    };
  }, [root, status, visible]);

  // À quai, un geste du visiteur (défiler la page, toucher, cliquer un objet) = il lit : on l'attend.
  useEffect(() => {
    if (status !== 'running' || stage !== 'dwell') return;
    const engage = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && root.current?.contains(target)) return;
      dwellClock.holdUntil = performance.now() + READING_HOLD_MS;
    };
    const options = { capture: true, passive: true } as const;
    const kinds = ['wheel', 'pointerdown', 'touchmove', 'keydown'];
    kinds.forEach((kind) => window.addEventListener(kind, engage, options));
    return () => kinds.forEach((kind) => window.removeEventListener(kind, engage, options));
  }, [root, status, stage]);

  useEffect(() => {
    if (status === 'idle') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      // Carnet, pêche, appareil photo ou bourriche ouverts : Échap et Espace sont à eux.
      const game = gameplayActivity();
      if (useLogbook.getState().open || game.playing || game.open) return;
      const tour = useTour.getState();
      if (event.key === 'Escape') {
        // La visite consomme Échap : la page ouverte ne se ferme pas en même temps.
        event.preventDefault();
        tour.passFocus('launcher');
        if (tour.status === 'running') tour.quit();
        else tour.dismissEnd();
        return;
      }
      if (event.key !== ' ' || tour.status !== 'running') return;
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) return;
      event.preventDefault();
      tour.togglePause();
    };
    // Phase de capture : la visite reçoit la touche avant les autres écouteurs (panneau).
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [status]);
}

/** Juste après le dévoilement (une fois par visite) : une invitation douce, ancrée au bouton. */
function useInviteAfterReveal() {
  useEffect(() => {
    let showTimer = 0;
    let hideTimer = 0;
    const unsubscribe = useWorld.subscribe((world, previous) => {
      const revealed =
        world.phase !== previous.phase &&
        world.phase === 'playing' &&
        (previous.phase === 'transitioning' || previous.phase === 'intro');
      if (revealed) {
        if (readFlag(INVITE_KEY) || autostart.from !== null) return;
        window.clearTimeout(showTimer);
        showTimer = window.setTimeout(() => {
          const now = useWorld.getState();
          if (useTour.getState().status !== 'idle' || now.phase !== 'playing' || now.destination || now.freeTarget) return;
          writeFlag(INVITE_KEY);
          useTour.getState().setInvite(true);
          hideTimer = window.setTimeout(() => useTour.getState().setInvite(false), INVITE_MS);
        }, INVITE_DELAY);
        return;
      }
      // Le visiteur met le cap de lui-même : l'invitation s'efface.
      const tour = useTour.getState();
      const sailing =
        (world.destination !== null && world.destination !== previous.destination) ||
        (world.freeTarget !== null && world.freeTarget !== previous.freeTarget);
      if (tour.invite && sailing) tour.setInvite(false);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);
}

/** `?tour` dans l'adresse : départ automatique dès que le monde est là (puis le paramètre s'efface). */
function useAutostart() {
  useEffect(() => {
    if (autostart.from === null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('tour')) {
      url.searchParams.delete('tour');
      window.history.replaceState(null, '', url);
    }
    let timer = 0;
    const attempt = (phase: WorldPhase) => {
      if (timer || (phase !== 'playing' && phase !== 'docked')) return;
      timer = window.setTimeout(() => {
        const from = autostart.from;
        autostart.from = null;
        if (from !== null) useTour.getState().start(from);
      }, AUTOSTART_DELAY);
    };
    attempt(useWorld.getState().phase);
    const unsubscribe = useWorld.subscribe((world) => attempt(world.phase));
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
}

/* ---------------------------------------------------------------- LANCEUR */

function Invite({ onStart }: { onStart: () => void }) {
  const setInvite = useTour((state) => state.setInvite);
  return (
    <aside className={styles.invite} role="status" aria-label="Suggestion : visite guidée">
      <p className={styles.inviteEyebrow}>Envie de te laisser porter&#8239;?</p>
      <p className={styles.inviteText}>
        Je te fais visiter l’archipel en pilote automatique&#160;: {TOUR_LENGTH} escales, environ deux minutes.
      </p>
      <div className={styles.inviteActions}>
        <button type="button" className={styles.cta} onClick={onStart}>
          <PlayIcon />
          Lancer la visite
        </button>
        <button type="button" className={styles.textButton} onClick={() => setInvite(false)}>
          Plus tard
        </button>
      </div>
    </aside>
  );
}

function Launcher() {
  const resumeAt = useTour((state) => state.resumeAt);
  const invite = useTour((state) => state.invite);
  const start = useTour((state) => state.start);
  const passFocus = useTour((state) => state.passFocus);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (useTour.getState().claimFocus('launcher')) button.current?.focus({ preventScroll: true });
  }, []);

  const resuming = resumeAt > 0;
  const launch = (from: number) => {
    passFocus('deck');
    start(from);
  };

  return (
    <div className={styles.launch}>
      {invite && <Invite onStart={() => launch(0)} />}
      <div className={styles.launchRow}>
        <button
          ref={button}
          type="button"
          className={styles.launcher}
          data-invite={invite}
          onClick={() => launch(resumeAt)}
          title={
            resuming
              ? `Reprendre la visite guidée à l’escale ${resumeAt + 1}`
              : 'Visite guidée de l’archipel, en pilote automatique'
          }
        >
          <span className={styles.launcherIcon} aria-hidden="true">
            <PlayIcon />
          </span>
          {resuming ? (
            <span>
              <span className={styles.longLabel}>Reprendre la visite</span>
              <span className={styles.shortLabel}>Reprendre</span>
            </span>
          ) : (
            <span>Visite guidée</span>
          )}
          <span className={styles.launcherMeta}>
            {resuming ? `${resumeAt + 1}/${TOUR_LENGTH}` : `${TOUR_LENGTH} escales`}
          </span>
        </button>
        {resuming && (
          <button
            type="button"
            className={styles.restart}
            onClick={() => launch(0)}
            aria-label="Recommencer la visite depuis le début"
            title="Recommencer la visite"
          >
            <RestartIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------- SOUS-TITRE ET COMMANDES */

function Deck() {
  const index = useTour((state) => state.index);
  const stage = useTour((state) => state.stage);
  const paused = useTour((state) => state.paused);
  const togglePause = useTour((state) => state.togglePause);
  const skip = useTour((state) => state.skip);
  const quit = useTour((state) => state.quit);
  const goTo = useTour((state) => state.goTo);
  const passFocus = useTour((state) => state.passFocus);
  const pauseButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (useTour.getState().claimFocus('deck')) pauseButton.current?.focus({ preventScroll: true });
  }, []);

  const stop = TOUR_STOPS[index];
  const docked = stage === 'dwell';
  const last = index === TOUR_LENGTH - 1;
  const step = `${index + 1} / ${TOUR_LENGTH}`;
  const announcement = paused
    ? 'Visite en pause.'
    : docked
      ? `Escale ${index + 1} sur ${TOUR_LENGTH} : ${stop.label}. ${stop.hook}`
      : `Cap sur l’escale ${index + 1} sur ${TOUR_LENGTH} : ${stop.label}.`;

  return (
    <section
      className={styles.deck}
      data-stage={stage}
      aria-label="Visite guidée"
      style={{ ['--accent' as string]: stop.accent }}
    >
      {/* Rejoué à chaque départ et à chaque accostage (clé). */}
      <div key={`${stop.id}:${stage}`} className={styles.caption} aria-hidden="true">
        <p className={styles.kicker}>
          {paused && <span className={styles.pausedTag}>En pause</span>}
          <span>{docked ? `Escale ${step}` : `Cap sur l’escale ${step}`}</span>
          {docked && <span className={styles.kickerTagline}>{stop.tagline}</span>}
        </p>
        <p className={styles.title}>{stop.label}</p>
        <span className={styles.rule} />
        <p className={styles.hook}>{docked ? stop.hook : stop.tagline}</p>
      </div>

      <div className={styles.controls}>
        <ol className={styles.dots} aria-label="Escales de la visite">
          {TOUR_STOPS.map((entry, position) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.dotButton}
                onClick={() => goTo(position)}
                aria-label={`Escale ${position + 1} : ${entry.label}`}
                aria-current={position === index ? 'step' : undefined}
                title={entry.label}
              >
                <span
                  className={styles.dot}
                  data-state={position < index ? 'done' : position === index ? 'current' : 'next'}
                  style={{ ['--dot' as string]: entry.accent }}
                />
              </button>
            </li>
          ))}
        </ol>
        <span className={styles.divider} aria-hidden="true" />
        <button
          ref={pauseButton}
          type="button"
          className={styles.btn}
          data-on={paused}
          onClick={togglePause}
          title={paused ? 'Reprendre la visite (Espace)' : 'Mettre la visite en pause (Espace)'}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          <span className={styles.label}>{paused ? 'Reprendre' : 'Pause'}</span>
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            if (last) passFocus('end');
            skip();
          }}
          title={last ? 'Terminer la visite' : 'Passer à l’escale suivante'}
        >
          <SkipIcon />
          <span className={styles.label}>{last ? 'Terminer' : 'Passer'}</span>
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            passFocus('launcher');
            quit();
          }}
          title="Quitter la visite (Échap)"
        >
          <CloseIcon />
          <span className={styles.label}>Quitter</span>
        </button>
      </div>
      <p className={styles.keys} aria-hidden="true">
        Espace · pause — Échap · quitter
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------ CARTE DE FIN */

/** Ce qu'il reste à trouver, d'après le carnet réel du visiteur. */
function leadsFor(stamps: StampId[]) {
  const leads: string[] = [];
  if (ISLET_STAMPS.some((id) => !stamps.includes(id))) leads.push('des îlots à réveiller');
  if (!stamps.includes('stars')) leads.push('des étoiles d’or à repêcher');
  const secrets = STAMPS.some(
    (stamp) =>
      !stamp.id.startsWith('island:') &&
      !stamp.id.startsWith('islet:') &&
      stamp.id !== 'stars' &&
      !stamps.includes(stamp.id),
  );
  if (secrets) leads.push('quelques secrets à dénicher');
  if (leads.length < 2) return leads[0] ?? '';
  return `${leads.slice(0, -1).join(', ')} et ${leads[leads.length - 1]}`;
}

function EndCard() {
  const stamps = useLogbook((state) => state.stamps);
  const setLogbookOpen = useLogbook((state) => state.setOpen);
  const dismissEnd = useTour((state) => state.dismissEnd);
  const passFocus = useTour((state) => state.passFocus);
  const close = useWorld((state) => state.close);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (useTour.getState().claimFocus('end')) primary.current?.focus({ preventScroll: true });
  }, []);

  const total = STAMPS.length;
  const owned = STAMPS.filter((stamp) => stamps.includes(stamp.id)).length;
  const missing = total - owned;
  const complete = missing <= 0;
  const leads = leadsFor(stamps);

  return (
    <section className={styles.end} aria-labelledby="tour-end-title">
      <p className={styles.endEyebrow}>Fin de la visite · {TOUR_LENGTH} escales</p>
      <h2 id="tour-end-title" className={styles.endTitle}>
        {complete ? 'Le carnet est complet !' : 'Le carnet n’est pas complet…'}
      </h2>
      <p className={styles.endText}>
        {complete
          ? 'Tu as tout trouvé : merci d’avoir navigué jusqu’ici.'
          : `Il te reste ${missing} tampon${missing > 1 ? 's' : ''}${leads ? ` : ${leads}` : ' à gagner'}. Prends la barre !`}
      </p>
      <div className={styles.meter}>
        <span className={styles.meterTrack} aria-hidden="true">
          <span className={styles.meterFill} style={{ ['--fill' as string]: (owned / total).toFixed(3) }} />
        </span>
        <span className={styles.meterLabel}>
          Carnet · {owned}/{total}
        </span>
      </div>
      <div className={styles.endActions}>
        <a ref={primary} className={styles.cta} href={`mailto:${CONTACT_EMAIL}`}>
          <MailIcon />
          Écrire à {FIRST_NAME}
        </a>
        <button
          type="button"
          className={styles.ghostCta}
          onClick={() => {
            passFocus('launcher');
            dismissEnd();
            close();
          }}
        >
          Prendre la barre
        </button>
      </div>
      <p className={styles.endFoot}>
        <span>{CONTACT_EMAIL}</span>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            dismissEnd();
            setLogbookOpen(true);
          }}
        >
          Ouvrir le carnet
        </button>
      </p>
      <button
        type="button"
        className={styles.endClose}
        onClick={() => {
          passFocus('launcher');
          dismissEnd();
        }}
        aria-label="Fermer la carte de fin de visite"
      >
        <CloseIcon />
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ RACINE */

export default function GuidedTour() {
  const phase = useWorld((state) => state.phase);
  const panelOpen = useWorld((state) => state.activeIsland !== null);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const status = useTour((state) => state.status);
  const stage = useTour((state) => state.stage);
  // Carte de prise, bourriche ou appareil photo à l'écran : la visite leur laisse la place.
  const busy = useGameplay(
    (state) => state.photo !== 'off' || state.basketOpen || state.phase === 'caught' || state.phase === 'missed',
  );
  const root = useRef<HTMLDivElement>(null);
  const visible = phase === 'playing' || phase === 'docked';

  useTourEngine(root, status, stage, visible);
  useInviteAfterReveal();
  useAutostart();

  // Démontée (version rapide…) : la visite s'arrête net, sans toucher au monde.
  useEffect(() => () => useTour.getState().reset(), []);

  // Développement : accès à la visite pour les tests automatisés (comme __world).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as Record<string, unknown>).__tour = useTour;
  }, []);

  if (!visible) return null;

  return (
    <>
      <div className={styles.veil} data-on={status === 'running'} aria-hidden="true" />
      <div
        ref={root}
        className={styles.anchor}
        data-tour-root=""
        data-panel={panelOpen ? 'open' : 'closed'}
        data-mode={status}
        data-busy={busy ? '' : undefined}
        data-reduced={reducedMotion ? '' : undefined}
      >
        {status === 'idle' && <Launcher />}
        {status === 'running' && <Deck />}
        {status === 'ended' && <EndCard />}
      </div>
    </>
  );
}
