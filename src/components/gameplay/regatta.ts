'use client';

import { create } from 'zustand';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import type { Vec2 } from '@/types';
import { useGameplay } from './store';

/**
 * « La régate des bouées » : six marques orange autour du port d'attache, en eau libre (loin
 * des îles, des étoiles d'or et des coins de pêche). Le chrono part au passage de la marque
 * de départ, on enroule les cinq autres dans l'ordre, l'arrivée se juge au départ. Le record
 * reste dans le navigateur (facultatif, comme le carnet).
 */

export const MARKS: Vec2[] = [
  [18, 10],
  [34, 32],
  [10, 36],
  [-20, 22],
  [-20, -2],
  [0, -22],
];
/** Ordre de passage : départ, cinq marques, arrivée sur la marque de départ. */
export const COURSE = [0, 1, 2, 3, 4, 5, 0];
/** Rayon de validation d'une marque (m) : généreux, la navigation se fait au clic. */
export const GATE_RADIUS = 7.5;
/** Distance sous laquelle la marque de départ propose la régate (m). */
export const START_RANGE = 15;

const STORAGE_KEY = 'kyliann-regate-v1';
/** Le résultat reste affiché ce temps-là (s), puis la mer redevient libre. */
const FINISH_LINGER = 14;
/** Au-delà, la régate est abandonnée d'elle-même (s). */
const MAX_RACE = 240;

export type RacePhase = 'off' | 'armed' | 'racing' | 'finished';

interface RegattaState {
  phase: RacePhase;
  /** Rang dans COURSE de la prochaine marque à passer. */
  leg: number;
  startAt: number;
  finishAt: number;
  time: number;
  best: number | null;
  /** Le dernier temps bat le record. */
  record: boolean;
  /** Bateau près de la marque de départ, régate au repos. */
  nearStart: boolean;
  hydrated: boolean;
  hydrate: () => void;
  start: () => void;
  abort: () => void;
  setNearStart: (near: boolean) => void;
  tick: (now: number) => void;
}

function loadBest() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number((JSON.parse(raw) as { best?: unknown }).best);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveBest(best: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ best }));
  } catch {
    // Navigation privée : le record vit le temps de la visite.
  }
}

/** « 0:31,4 » */
export function raceClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1).replace('.', ',')}`;
}

export const useRegatta = create<RegattaState>((set, get) => ({
  phase: 'off',
  leg: 0,
  startAt: 0,
  finishAt: 0,
  time: 0,
  best: null,
  record: false,
  nearStart: false,
  hydrated: false,

  hydrate: () => {
    if (!get().hydrated) set({ best: loadBest(), hydrated: true });
  },
  start: () => {
    // La canne est rangée, le viseur aussi : un seul jeu à la fois.
    const game = useGameplay.getState();
    game.stop();
    if (game.photo !== 'off') game.closePhoto();
    game.setBasketOpen(false);
    set({ phase: 'armed', leg: 0, startAt: 0, finishAt: 0, time: 0, record: false });
    ambience.cue(784, 0.14);
  },
  abort: () => {
    if (get().phase !== 'off') set({ phase: 'off', leg: 0 });
  },
  setNearStart: (near) => {
    if (get().nearStart !== near) set({ nearStart: near });
  },
  tick: (now) => {
    const state = get();
    if (state.phase === 'off') return;
    if (state.phase === 'finished') {
      if (now > state.finishAt + FINISH_LINGER) set({ phase: 'off', leg: 0 });
      return;
    }
    if (state.phase === 'racing' && now - state.startAt > MAX_RACE) {
      set({ phase: 'off', leg: 0 });
      return;
    }
    const [x, z] = MARKS[COURSE[state.leg]];
    if (Math.hypot(boatState.position.x - x, boatState.position.z - z) > GATE_RADIUS) return;
    if (state.phase === 'armed') {
      set({ phase: 'racing', leg: 1, startAt: now });
      ambience.chime([660, 880], 0.08);
      return;
    }
    const leg = state.leg + 1;
    if (leg < COURSE.length) {
      set({ leg });
      ambience.chime([880, 1175], 0.07);
      return;
    }
    const time = now - state.startAt;
    const record = state.best === null || time < state.best;
    if (record) saveBest(time);
    set({ phase: 'finished', finishAt: now, time, record, best: record ? time : state.best });
    ambience.chime([784, 988, 1175, 1568, 1976], 0.07);
  },
}));
