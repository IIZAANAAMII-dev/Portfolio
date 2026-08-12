'use client';

import { create } from 'zustand';
import { islandById } from '@/data/islands';
import type { IslandId, Vec2, WorldPhase } from '@/types';

/** Point d'accostage d'une île, calculé depuis son dockAngle. */
export function dockPosition(id: IslandId): Vec2 {
  const island = islandById[id];
  const [x, z] = island.position;
  const reach = island.radius + 4.5;
  return [x + Math.cos(island.dockAngle) * reach, z + Math.sin(island.dockAngle) * reach];
}

interface WorldState {
  phase: WorldPhase;
  /** Première frame WebGL rendue. Découplé de `phase` à cause du deep linking. */
  sceneReady: boolean;
  /** Île dont le panneau est ouvert. */
  activeIsland: IslandId | null;
  /** Île vers laquelle le bateau navigue. */
  destination: IslandId | null;
  /** Cible libre en pleine mer (clic sur l'océan). */
  freeTarget: Vec2 | null;
  hovered: IslandId | null;
  /** Monde entièrement visible dès l'intro ; conservé pour l'atmosphère et les îles. */
  reveal: number;
  /** Progression de l'unique transition intro → caméra de jeu. */
  gameTransition: number;
  soundOn: boolean;
  quickView: boolean;
  reducedMotion: boolean;
  webglFailed: boolean;
  isNight: boolean;
  /** Heure du cycle : 0 = minuit, 0.25 = lever, 0.5 = midi, 0.75 = coucher. */
  timeOfDay: number;

  ready: () => void;
  start: () => void;
  setReveal: (value: number) => void;
  setGameTransition: (value: number) => void;
  setTimeOfDay: (value: number) => void;
  revealComplete: () => void;
  sailTo: (id: IslandId) => void;
  sailToPoint: (point: Vec2) => void;
  arrive: () => void;
  close: () => void;
  hover: (id: IslandId | null) => void;
  toggleSound: () => void;
  toggleDayNight: () => void;
  setQuickView: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  failWebgl: () => void;
  /** Deep link : ouvre directement une île sans jouer l'intro. */
  jumpTo: (id: IslandId) => void;
}

export const useWorld = create<WorldState>((set, get) => ({
  phase: 'loading',
  sceneReady: false,
  activeIsland: null,
  destination: null,
  freeTarget: null,
  hovered: null,
  reveal: 1,
  gameTransition: 0,
  soundOn: false,
  quickView: false,
  reducedMotion: false,
  webglFailed: false,
  isNight: false,
  timeOfDay: 0.45,

  ready: () =>
    set((s) => (s.phase === 'loading' ? { phase: 'intro', sceneReady: true } : { sceneReady: true })),
  start: () => set((s) => (s.phase === 'intro' ? { phase: 'transitioning', gameTransition: 0, soundOn: true } : {})),
  setReveal: (value) => set({ reveal: value }),
  setGameTransition: (value) => set({ gameTransition: value }),
  setTimeOfDay: (value) => set({ timeOfDay: value - Math.floor(value) }),
  revealComplete: () => set({ phase: 'playing', reveal: 1, gameTransition: 1 }),

  sailTo: (id) => {
    if (get().phase !== 'playing' && get().phase !== 'docked') return;
    set({ phase: 'playing', destination: id, freeTarget: null, activeIsland: null });
  },
  sailToPoint: (point) => {
    const { phase } = get();
    if (phase !== 'playing' && phase !== 'docked') return;
    set({ phase: 'playing', destination: null, freeTarget: point, activeIsland: null });
  },
  arrive: () => {
    const { destination } = get();
    if (!destination) return set({ freeTarget: null });
    set({ phase: 'docked', activeIsland: destination, destination: null });
  },
  close: () => set({ phase: 'playing', activeIsland: null }),

  hover: (id) => set({ hovered: id }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setQuickView: (value) => set({ quickView: value }),
  setReducedMotion: (value) => set({ reducedMotion: value }),
  failWebgl: () => set({ webglFailed: true, quickView: true }),
  toggleDayNight: () => set((s) => ({ isNight: !s.isNight, timeOfDay: s.isNight ? 0.3 : 0.8 })),

  jumpTo: (id) =>
    set({
      phase: 'docked',
      reveal: 1,
      activeIsland: id,
      destination: null,
      freeTarget: null,
    }),
}));
