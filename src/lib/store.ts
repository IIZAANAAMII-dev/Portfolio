'use client';

import { create } from 'zustand';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { INTRO_RADIUS_START, introGlowFromGameTransition, introRadiusFromGameTransition } from '@/lib/cinematic';
import { isNightTime } from '@/lib/sky';
import type { IslandId, Vec2, WorldPhase } from '@/types';
import type { QualityLevel } from '@/lib/quality';

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
  /** Centre (xz) du cercle de révélation intro. */
  introCenter: Vec2;
  /** Rayon world-space du cercle révélateur. */
  introRadius: number;
  /** Intensité du halo lumineux au bord du cercle. */
  introGlow: number;
  soundOn: boolean;
  quickView: boolean;
  reducedMotion: boolean;
  webglFailed: boolean;
  /**
   * Heure du cycle : 0 = minuit, 0.25 = lever, 0.5 = midi, 0.75 = coucher.
   * SOURCE UNIQUE DE VÉRITÉ du jour/nuit — tout en dérive (voir lib/sky.ts).
   */
  timeOfDay: number;
  /** Niveau graphique interne, piloté automatiquement par la moyenne des FPS. */
  quality: QualityLevel;

  ready: () => void;
  start: () => void;
  setReveal: (value: number) => void;
  setGameTransition: (value: number) => void;
  setCinematicProgress: (gameTransition: number, reveal: number) => void;
  setTimeOfDay: (value: number) => void;
  setQuality: (quality: QualityLevel) => void;
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
  reveal: 0,
  gameTransition: 0,
  introCenter: [boatState.position.x, boatState.position.z] as Vec2,
  introRadius: INTRO_RADIUS_START,
  introGlow: 0.9,
  soundOn: false,
  quickView: false,
  reducedMotion: false,
  webglFailed: false,
  timeOfDay: 0.45,
  quality: 'high',

  ready: () =>
    set((s) => (s.phase === 'loading' ? { phase: 'intro', sceneReady: true } : { sceneReady: true })),
  start: () => set((s) => (s.phase === 'intro' ? { phase: 'transitioning', gameTransition: 0, soundOn: true } : {})),
  setReveal: (value) => set({ reveal: value }),
  setGameTransition: (value) => set({ gameTransition: value }),
  setCinematicProgress: (gameTransition, reveal) => set({
    gameTransition,
    reveal,
    introRadius: introRadiusFromGameTransition(gameTransition),
    introGlow: introGlowFromGameTransition(gameTransition),
  }),
  setTimeOfDay: (value) => set({ timeOfDay: value - Math.floor(value) }),
  setQuality: (quality) => set((state) => (state.quality === quality ? state : { quality })),
  revealComplete: () => set({
    phase: 'playing',
    reveal: 1,
    gameTransition: 1,
    introRadius: 240,
    introGlow: 0,
  }),

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
  // Le bouton lit l'état RÉEL du cycle : si le monde est en nuit (même parce que le
  // cycle automatique y est arrivé tout seul), un clic ramène au matin, et inversement.
  toggleDayNight: () => set((s) => ({ timeOfDay: isNightTime(s.timeOfDay) ? 0.32 : 0.82 })),

  jumpTo: (id) =>
    set({
      phase: 'docked',
      reveal: 1,
      activeIsland: id,
      destination: null,
      freeTarget: null,
    }),
}));
