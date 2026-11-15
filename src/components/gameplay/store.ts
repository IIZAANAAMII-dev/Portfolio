'use client';

import { create } from 'zustand';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import {
  BITE_MAX,
  BITE_MIN,
  CAST_MAX,
  CAST_MIN,
  CAST_SECONDS,
  JOKES,
  REEL_SECONDS,
  REFILL_SECONDS,
  SPOTS,
  STOCK,
  STRIKE_WINDOW,
  STRIKE_WINDOW_TOUCH,
  ZONE_IDS,
  clockNow,
  pickCatch,
  type Basket,
  type Catch,
  type MissKind,
} from './fishing-data';

/**
 * État du gameplay : la partie de pêche (machine à états horodatée, lue à la fois par la
 * scène et par le DOM), la bourriche (gardée dans le navigateur, facultatif) et le mode
 * carte postale. Les instants viennent de `clockNow()` : la 3D anime le bouchon d'après
 * les mêmes horodatages que l'interface, quel que soit le nombre d'images par seconde.
 */

export type FishingPhase = 'idle' | 'cast' | 'wait' | 'bite' | 'reel' | 'caught' | 'missed';
export type PhotoPhase = 'off' | 'aim' | 'shoot' | 'develop' | 'preview';

export interface Postcard {
  url: string;
  blob: Blob;
  name: string;
}

interface GameplayState {
  /** La scène 3D du gameplay est montée (coins de pêche visibles, capture possible). */
  ready3D: boolean;
  hydrated: boolean;
  /** Coin de pêche à portée du bateau arrêté, -1 sinon (mis à jour par la boucle de la scène). */
  near: number;
  /** Coin de pêche en vue (le bateau passe à proximité), -1 sinon : l'interface invite à s'arrêter. */
  approach: number;

  phase: FishingPhase;
  spot: number;
  /** Point où le bouchon touche l'eau (monde). */
  targetX: number;
  targetZ: number;
  /** Position du bateau au lancer : s'il s'en éloigne, la ligne est relevée. */
  originX: number;
  originZ: number;
  /** Début de la phase courante. */
  phaseAt: number;
  landAt: number;
  biteAt: number;
  /** Fausses touches (le bouchon frétille) : ferrer à ce moment-là, c'est trop tôt. */
  nibbles: number[];
  strikeWindow: number;
  result: Catch | null;
  /** La prise est nouvelle dans la bourriche (sinon : « déjà pêché »). */
  fresh: boolean;
  miss: MissKind | null;
  joke: string;
  /** Nombre de lancers (varie les blagues, relance les animations). */
  casts: number;

  basket: Basket;
  stock: number[];
  refillAt: number[];

  photo: PhotoPhase;
  postcard: Postcard | null;
  /** Cadrage choisi dans le viseur (0 trois-quarts, 1 ras de l'eau, 2 vue de la mouette). */
  framing: number;
  /** Bourriche dépliée (liste des prises). */
  basketOpen: boolean;

  hydrate: () => void;
  set3D: (ready: boolean) => void;
  setNear: (index: number) => void;
  setApproach: (index: number) => void;
  setFraming: (index: number) => void;
  setBasketOpen: (open: boolean) => void;
  cast: () => void;
  strike: () => void;
  tick: (now: number) => void;
  /** Range la canne (bouton, ou le bateau repart). */
  stop: () => void;

  aim: () => void;
  shoot: () => void;
  captured: () => void;
  developed: (postcard: Postcard) => void;
  retake: () => void;
  closePhoto: () => void;
}

const STORAGE_KEY = 'kyliann-bourriche-v1';
/** Nombre de cadrages proposés par le viseur. */
export const FRAMINGS = 3;

function loadBasket(): Basket {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { basket?: Basket };
    const basket: Basket = {};
    for (const id of ZONE_IDS) {
      const list = parsed.basket?.[id];
      if (Array.isArray(list)) basket[id] = list.filter((name): name is string => typeof name === 'string');
    }
    return basket;
  } catch {
    return {};
  }
}

function saveBasket(basket: Basket) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ basket }));
  } catch {
    // Navigation privée : la bourriche vit le temps de la visite.
  }
}

function coarsePointer() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function pickJoke(kind: MissKind, casts: number) {
  const list = JOKES[kind];
  return list[casts % list.length];
}

/** Phases où la ligne est à l'eau (le bateau doit rester sur place). */
export function lineInWater(phase: FishingPhase) {
  return phase === 'cast' || phase === 'wait' || phase === 'bite';
}

/** Phases où la partie de pêche occupe le bateau (caméra rapprochée, canne sortie). */
export function fishingActive(phase: FishingPhase) {
  return phase !== 'idle';
}

export const useGameplay = create<GameplayState>((set, get) => ({
  ready3D: false,
  hydrated: false,
  near: -1,
  approach: -1,

  phase: 'idle',
  spot: -1,
  targetX: 0,
  targetZ: 0,
  originX: 0,
  originZ: 0,
  phaseAt: 0,
  landAt: 0,
  biteAt: 0,
  nibbles: [],
  strikeWindow: STRIKE_WINDOW,
  result: null,
  fresh: false,
  miss: null,
  joke: '',
  casts: 0,

  basket: {},
  stock: SPOTS.map(() => STOCK),
  refillAt: SPOTS.map(() => 0),

  photo: 'off',
  postcard: null,
  framing: 0,
  basketOpen: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ basket: loadBasket(), hydrated: true });
  },
  set3D: (ready) => set({ ready3D: ready }),
  setNear: (index) => {
    if (get().near !== index) set({ near: index });
  },
  setApproach: (index) => {
    if (get().approach !== index) set({ approach: index });
  },
  setFraming: (index) => set({ framing: ((index % FRAMINGS) + FRAMINGS) % FRAMINGS }),
  setBasketOpen: (open) => {
    if (get().basketOpen !== open) set({ basketOpen: open });
  },

  cast: () => {
    const state = get();
    const index = state.phase === 'caught' || state.phase === 'missed' ? (state.near >= 0 ? state.near : state.spot) : state.near;
    if (index < 0 || state.stock[index] <= 0) return;
    if (state.phase !== 'idle' && state.phase !== 'caught' && state.phase !== 'missed') return;
    const spot = SPOTS[index];
    const bx = boatState.position.x;
    const bz = boatState.position.z;
    let dx = spot.x - bx;
    let dz = spot.z - bz;
    let distance = Math.hypot(dx, dz);
    if (distance < CAST_MIN) {
      // Le bateau est sur les bouillons : on lance par le travers (côté droit du bateau).
      dx = -Math.sin(boatState.heading);
      dz = Math.cos(boatState.heading);
      distance = CAST_MIN + 0.8;
    } else {
      dx /= distance;
      dz /= distance;
      distance = Math.min(distance, CAST_MAX);
    }
    const jitter = (Math.random() - 0.5) * 1.1;
    const now = clockNow();
    const landAt = now + CAST_SECONDS;
    const biteAt = landAt + BITE_MIN + Math.random() * (BITE_MAX - BITE_MIN);
    // Une ou deux fausses touches, assez loin de la vraie pour rester lisibles.
    const nibbles: number[] = [];
    const room = biteAt - landAt - 1.6;
    if (room > 0.6) {
      nibbles.push(landAt + 0.8 + Math.random() * room * 0.5);
      if (room > 2.2 && Math.random() < 0.6) nibbles.push(landAt + 0.8 + room * (0.6 + Math.random() * 0.4));
    }
    set({
      phase: 'cast',
      spot: index,
      targetX: bx + dx * distance - dz * jitter,
      targetZ: bz + dz * distance + dx * jitter,
      originX: bx,
      originZ: bz,
      phaseAt: now,
      landAt,
      biteAt,
      nibbles,
      strikeWindow: coarsePointer() ? STRIKE_WINDOW_TOUCH : STRIKE_WINDOW,
      result: null,
      miss: null,
      joke: '',
      casts: state.casts + 1,
    });
    ambience.cue(660, 0.12);
  },

  strike: () => {
    const state = get();
    const now = clockNow();
    if (state.phase === 'cast' || state.phase === 'wait') {
      set({ phase: 'missed', phaseAt: now, miss: 'early', joke: pickJoke('early', state.casts) });
      ambience.cue(196, 0.32);
      return;
    }
    if (state.phase !== 'bite') return;
    set({ phase: 'reel', phaseAt: now, result: pickCatch(state.basket) });
    ambience.splash(0.55);
  },

  tick: (now) => {
    const state = get();
    // Les coins vidés se repeuplent.
    if (state.stock.some((count, index) => count <= 0 && now >= state.refillAt[index])) {
      set({ stock: state.stock.map((count, index) => (count <= 0 && now >= state.refillAt[index] ? STOCK : count)) });
    }
    const { phase } = state;
    if (phase === 'idle') return;

    // Le bateau repart : on relève la ligne (la navigation n'est jamais bloquée).
    const drift = Math.hypot(boatState.position.x - state.originX, boatState.position.z - state.originZ);
    if (lineInWater(phase) && (boatState.speed > 1.6 || drift > 6)) {
      set({ phase: 'idle', spot: -1 });
      return;
    }
    if ((phase === 'caught' || phase === 'missed') && (boatState.speed > 1.6 || drift > 9)) {
      set({ phase: 'idle', spot: -1 });
      return;
    }

    if (phase === 'cast' && now >= state.landAt) {
      set({ phase: 'wait', phaseAt: state.landAt });
      ambience.splash(0.16);
    } else if (phase === 'wait' && now >= state.biteAt) {
      // La fenêtre pour ferrer part de l'image où la touche est montrée : une image lente
      // (téléphone chargé, onglet qui revient) ne la mange pas.
      set({ phase: 'bite', phaseAt: now });
      ambience.splash(0.42);
      ambience.cue(988, 0.14);
    } else if (phase === 'bite' && now >= state.phaseAt + state.strikeWindow) {
      set({ phase: 'missed', phaseAt: now, miss: 'late', joke: pickJoke('late', state.casts) });
      ambience.cue(196, 0.32);
    } else if (phase === 'reel' && now >= state.phaseAt + REEL_SECONDS && state.result) {
      const { zone, name } = state.result;
      const list = state.basket[zone] ?? [];
      const fresh = !list.includes(name);
      const basket: Basket = fresh ? { ...state.basket, [zone]: [...list, name] } : state.basket;
      const stock = state.stock.slice();
      const refillAt = state.refillAt.slice();
      stock[state.spot] = Math.max(0, stock[state.spot] - 1);
      if (stock[state.spot] === 0) refillAt[state.spot] = now + REFILL_SECONDS;
      set({ phase: 'caught', phaseAt: now, basket, stock, refillAt, fresh });
      saveBasket(basket);
      ambience.bump('wood', 0.5);
      ambience.chime([784, 988, 1175, 1568], 0.08);
      if (ZONE_IDS.every((id) => (basket[id]?.length ?? 0) > 0)) logbook.stamp('fishing');
    }
  },

  stop: () => {
    if (get().phase !== 'idle') set({ phase: 'idle', spot: -1 });
  },

  aim: () => {
    if (!get().ready3D) return;
    // À quai, la page du carnet se referme : le viseur prend tout l'écran.
    const world = useWorld.getState();
    if (world.phase === 'docked') world.close();
    // La canne est rangée : la caméra ne peut pas suivre deux sujets à la fois.
    set({ photo: 'aim', phase: 'idle', spot: -1, basketOpen: false });
  },
  shoot: () => {
    if (get().photo === 'aim') set({ photo: 'shoot' });
  },
  captured: () => {
    if (get().photo === 'shoot') set({ photo: 'develop' });
  },
  developed: (postcard) => {
    const previous = get().postcard;
    if (previous) URL.revokeObjectURL(previous.url);
    set({ photo: 'preview', postcard });
    logbook.stamp('postcard');
  },
  retake: () => {
    const previous = get().postcard;
    if (previous) URL.revokeObjectURL(previous.url);
    set({ photo: 'aim', postcard: null });
  },
  closePhoto: () => {
    const previous = get().postcard;
    if (previous) URL.revokeObjectURL(previous.url);
    set({ photo: 'off', postcard: null });
  },
}));

/** Instant de la touche en cours (pour la 3D) : fausse touche la plus proche, ou -1. */
export function nibbleAt(nibbles: number[], now: number) {
  for (const at of nibbles) if (now >= at && now < at + 0.32) return at;
  return -1;
}
