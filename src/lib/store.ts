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
  /** Progression 0 -> 1 de la révélation du monde, lue dans useFrame. */
  reveal: number;
  soundOn: boolean;
  quickView: boolean;
  reducedMotion: boolean;
  webglFailed: boolean;

  ready: () => void;
  start: () => void;
  setReveal: (value: number) => void;
  revealComplete: () => void;
  sailTo: (id: IslandId) => void;
  sailToPoint: (point: Vec2) => void;
  arrive: () => void;
  close: () => void;
  hover: (id: IslandId | null) => void;
  toggleSound: () => void;
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
  reveal: 0,
  soundOn: false,
  quickView: false,
  reducedMotion: false,
  webglFailed: false,

  ready: () =>
    set((s) => (s.phase === 'loading' ? { phase: 'intro', sceneReady: true } : { sceneReady: true })),
  start: () => set((s) => (s.phase === 'intro' ? { phase: 'reveal' } : {})),
  setReveal: (value) => set({ reveal: value }),
  revealComplete: () => set({ phase: 'sailing', reveal: 1 }),

  sailTo: (id) => {
    if (get().phase === 'intro' || get().phase === 'loading') return;
    set({ phase: 'sailing', destination: id, freeTarget: null, activeIsland: null });
  },
  sailToPoint: (point) => {
    const { phase } = get();
    if (phase === 'loading' || phase === 'intro') return;
    // Pendant la révélation le bateau avance déjà : on lui donne un cap sans
    // interrompre la phase cinématique.
    if (phase === 'reveal') return set({ destination: null, freeTarget: point });
    set({ phase: 'sailing', destination: null, freeTarget: point, activeIsland: null });
  },
  arrive: () => {
    const { destination } = get();
    if (!destination) return set({ freeTarget: null });
    set({ phase: 'docked', activeIsland: destination, destination: null });
  },
  close: () => set({ phase: 'sailing', activeIsland: null }),

  hover: (id) => set({ hovered: id }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setQuickView: (value) => set({ quickView: value }),
  setReducedMotion: (value) => set({ reducedMotion: value }),
  failWebgl: () => set({ webglFailed: true, quickView: true }),

  jumpTo: (id) =>
    set({
      phase: 'docked',
      reveal: 1,
      activeIsland: id,
      destination: null,
      freeTarget: null,
    }),
}));
