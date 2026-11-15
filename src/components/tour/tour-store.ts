'use client';

import { create } from 'zustand';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { TOUR_LENGTH, TOUR_STOPS } from './tour-script';

/**
 * Visite guidée : le pilote automatique.
 *
 * La visite ne fait que ce qu'un visiteur ferait : elle met le cap (`sailTo`) sur l'escale
 * suivante, attend l'accostage (phase « docked » sur la bonne île), laisse la page ouverte
 * quelques secondes, puis repart. Elle observe le monde : si le visiteur reprend la barre
 * (clic sur la mer, sur une île, sur la navigation, fermeture de la page), elle s'efface
 * aussitôt et propose de reprendre plus tard là où elle s'était arrêtée.
 */

export type TourStatus = 'idle' | 'running' | 'ended';
/** En route vers l'escale, ou à quai. */
export type TourStage = 'sail' | 'dwell';
/** Élément qui doit reprendre le focus clavier quand l'interface de la visite change de forme. */
export type TourFocus = 'launcher' | 'deck' | 'end';

/** Temps passé à quai sur chaque escale (ms), hors pauses de lecture. */
export const DWELL_MS = 9000;
/** Un geste du visiteur à quai (défilement, toucher, clic dans la page) suspend le chrono un instant. */
export const READING_HOLD_MS = 3500;

interface TourState {
  status: TourStatus;
  /** Escale courante (index dans TOUR_STOPS). */
  index: number;
  stage: TourStage;
  paused: boolean;
  /** Escale où reprendre une visite interrompue (0 : depuis le début). */
  resumeAt: number;
  /** Invitation douce affichée juste après le dévoilement du monde. */
  invite: boolean;
  focus: TourFocus | null;

  start: (from?: number) => void;
  togglePause: () => void;
  skip: () => void;
  goTo: (index: number) => void;
  quit: () => void;
  dismissEnd: () => void;
  setInvite: (invite: boolean) => void;
  /** Demande le focus pour le prochain élément monté (seulement si le focus était dans la visite). */
  passFocus: (target: TourFocus) => void;
  /** L'élément `target` vient d'être monté : doit-il prendre le focus ? */
  claimFocus: (target: TourFocus) => boolean;
  reset: () => void;
}

/**
 * Chrono de l'escale, avancé par la boucle d'affichage (hors React, aucun rendu par image).
 * `holdUntil` : horodatage `performance.now()` jusqu'auquel le chrono attend le visiteur.
 */
export const dwellClock = { elapsed: 0, holdUntil: 0 };

/** Vrai pendant que la visite agit elle-même sur le monde (ses propres changements ne sont pas une reprise en main). */
let driving = false;

function drive(action: () => void) {
  driving = true;
  try {
    action();
  } finally {
    driving = false;
  }
}

function clampIndex(index: number) {
  return Math.min(Math.max(Math.round(index) || 0, 0), TOUR_LENGTH - 1);
}

function beginDwell() {
  dwellClock.elapsed = 0;
  dwellClock.holdUntil = 0;
  useTour.setState({ stage: 'dwell' });
}

/** Met le cap sur l'escale `index` (ou ouvre directement l'escale si le bateau y est déjà à quai). */
function go(index: number) {
  const target = TOUR_STOPS[index];
  useTour.setState({ index, stage: 'sail', paused: false });
  const world = useWorld.getState();
  if (world.phase === 'docked' && world.activeIsland === target.id) {
    beginDwell();
    return;
  }
  drive(() => world.sailTo(target.id));
}

/** Escale où reprendre : celle qu'on visait, ou la suivante si on avait déjà accosté. */
function resumePoint() {
  const { index, stage } = useTour.getState();
  const next = stage === 'dwell' ? index + 1 : index;
  return next >= TOUR_LENGTH ? 0 : next;
}

/** Le visiteur reprend la barre (ou quitte) : la visite s'efface, le monde reste tel quel. */
function handBack() {
  useTour.setState({ status: 'idle', paused: false, stage: 'sail', resumeAt: resumePoint() });
}

function finish() {
  useTour.setState({ status: 'ended', paused: false, resumeAt: 0 });
  ambience.chime([784, 988, 1319, 1568], 0.11);
}

export const useTour = create<TourState>((set, get) => ({
  status: 'idle',
  index: 0,
  stage: 'sail',
  paused: false,
  resumeAt: 0,
  invite: false,
  focus: null,

  start: (from = 0) => {
    const { phase } = useWorld.getState();
    if (phase !== 'playing' && phase !== 'docked') return;
    set({ status: 'running', invite: false, resumeAt: 0 });
    ambience.chime([587, 784, 1175], 0.09);
    go(clampIndex(from));
  },

  togglePause: () => {
    const { status, paused, stage, index } = get();
    if (status !== 'running') return;
    if (paused) {
      // En mer, on remet le cap ; à quai, le chrono repart simplement.
      if (stage === 'sail') go(index);
      else set({ paused: false });
      return;
    }
    set({ paused: true });
    // En mer, on coupe le moteur : sans cible, le bateau file sur son erre puis s'arrête.
    if (stage === 'sail') drive(() => useWorld.setState({ destination: null, freeTarget: null }));
  },

  skip: () => {
    const { status, index } = get();
    if (status !== 'running') return;
    if (index >= TOUR_LENGTH - 1) finish();
    else go(index + 1);
  },

  goTo: (target) => {
    const { status, index, stage } = get();
    if (status !== 'running') return;
    const next = clampIndex(target);
    if (next === index && stage === 'dwell') return;
    go(next);
  },

  quit: () => {
    if (get().status === 'running') handBack();
  },

  dismissEnd: () => {
    if (get().status === 'ended') set({ status: 'idle', resumeAt: 0 });
  },

  setInvite: (invite) => set((state) => (state.invite === invite ? state : { invite })),

  passFocus: (target) => {
    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-tour-root]')) set({ focus: target });
  },

  claimFocus: (target) => {
    if (get().focus !== target) return false;
    set({ focus: null });
    return true;
  },

  reset: () => set({ status: 'idle', paused: false, stage: 'sail', invite: false, focus: null }),
}));

/** Fin de l'escale : cap sur la suivante, ou carte de fin après la dernière. */
export function completeDwell() {
  const { status, stage, index, passFocus } = useTour.getState();
  if (status !== 'running' || stage !== 'dwell') return;
  if (index >= TOUR_LENGTH - 1) {
    passFocus('end');
    finish();
  } else {
    go(index + 1);
  }
}

type WorldSnapshot = ReturnType<typeof useWorld.getState>;

/** Le monde a changé : accostage attendu, ou reprise en main par le visiteur ? */
function evaluate(world: WorldSnapshot) {
  if (driving) return;
  const tour = useTour.getState();
  if (tour.status !== 'running') return;
  const target = TOUR_STOPS[tour.index].id;

  if (tour.stage === 'dwell') {
    if (world.phase !== 'docked' || world.activeIsland !== target) handBack();
    return;
  }
  if (world.phase === 'docked') {
    if (world.activeIsland === target) beginDwell();
    else handBack();
    return;
  }
  if (world.phase !== 'playing') {
    handBack();
    return;
  }
  // En pause en mer : le bateau doit rester sans cible.
  if (tour.paused) {
    if (world.destination !== null || world.freeTarget !== null) handBack();
    return;
  }
  if (world.destination !== target) handBack();
}

/** Branche la visite sur le monde le temps qu'elle tourne. Retourne la fonction de débranchement. */
export function bindTourToWorld() {
  evaluate(useWorld.getState());
  return useWorld.subscribe((world) => evaluate(world));
}
