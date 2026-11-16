'use client';

import { create } from 'zustand';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { INTRO_RADIUS_START, introGlowFromGameTransition, introRadiusFromGameTransition } from '@/lib/cinematic';
import { logbook } from '@/lib/logbook';
import { isNightTime } from '@/lib/sky';
import type { IslandId, Vec2, WorldPhase } from '@/types';
import {
  autoTier,
  initialGraphicsMode,
  initialTier,
  saveGraphicsMode,
  tierQuality,
  type GraphicsMode,
  type GraphicsTier,
  type QualityLevel,
} from '@/lib/quality';

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
  /**
   * Heure visée par le bouton Jour/Nuit : le cycle y file en accéléré (time-lapse de quelques
   * secondes, déroulé par Lighting), puis reprend son pas naturel. Null hors avance rapide.
   */
  timeLapseTarget: number | null;
  /**
   * Niveau de CONTENU lu par le décor ('low' | 'medium' | 'high'). Dérivé du palier : le palier
   * 'minimal' s'y lit 'low' (voir lib/quality.ts).
   */
  quality: QualityLevel;
  /** Palier graphique réel ('minimal' | 'low' | 'medium' | 'high'), piloté par le régulateur. */
  tier: GraphicsTier;
  /** Réglage « Graphismes » du joueur : 'auto' (le régulateur décide) ou un palier fixe. */
  graphicsMode: GraphicsMode;

  ready: () => void;
  start: () => void;
  setReveal: (value: number) => void;
  setGameTransition: (value: number) => void;
  setCinematicProgress: (gameTransition: number, reveal: number) => void;
  setTimeOfDay: (value: number) => void;
  setQuality: (quality: QualityLevel) => void;
  setTier: (tier: GraphicsTier) => void;
  /** Choix du joueur, enregistré (localStorage) ; 'auto' rend la main au régulateur. */
  setGraphicsMode: (mode: GraphicsMode) => void;
  revealComplete: () => void;
  sailTo: (id: IslandId) => void;
  sailToPoint: (point: Vec2) => void;
  arrive: () => void;
  close: () => void;
  /** Mettre en panne : le bateau s'arrête en pleine mer (pause de la visite guidée). */
  heaveTo: () => void;
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
  timeLapseTarget: null,
  quality: tierQuality(initialTier()),
  tier: initialTier(),
  graphicsMode: initialGraphicsMode(),

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
  setQuality: (quality) => set((state) => (state.tier === quality ? state : { tier: quality, quality })),
  setTier: (tier) => set((state) => (state.tier === tier ? state : { tier, quality: tierQuality(tier) })),
  setGraphicsMode: (mode) => {
    saveGraphicsMode(mode);
    const tier = mode === 'auto' ? autoTier() : mode;
    set((state) => (state.tier === tier ? { graphicsMode: mode } : { graphicsMode: mode, tier, quality: tierQuality(tier) }));
  },
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
    logbook.stamp(`island:${destination}`);
  },
  close: () => set({ phase: 'playing', activeIsland: null }),
  heaveTo: () => set((s) => (s.phase === 'playing' ? { destination: null, freeTarget: null } : {})),

  hover: (id) => set({ hovered: id }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setQuickView: (value) => set({ quickView: value }),
  setReducedMotion: (value) => set({ reducedMotion: value }),
  failWebgl: () => set({ webglFailed: true, quickView: true }),
  // Le bouton lit l'état RÉEL du cycle : si le monde est en nuit (même parce que le
  // cycle automatique y est arrivé tout seul), un clic ramène au matin, et inversement.
  // Le bouton lit l'état RÉEL du cycle (ou l'heure déjà visée par une avance rapide en
  // cours) : en nuit, un clic file vers le matin, et inversement. L'horloge n'est plus
  // sautée : Lighting la fait filer jusque-là en quelques secondes.
  toggleDayNight: () => set((s) => ({ timeLapseTarget: isNightTime(s.timeLapseTarget ?? s.timeOfDay) ? 0.32 : 0.82 })),

  // Le monde doit être entièrement révélé : sans cela le cercle d'intro garde les îles
  // à l'échelle zéro (elles n'apparaissent qu'à son passage).
  jumpTo: (id) => {
    // Le bateau est amarré le long du ponton, comme au port de départ.
    const [x, z] = dockPosition(id);
    boatState.position.set(x, 0, z);
    boatState.heading = islandById[id].dockAngle + Math.PI / 2;
    boatState.speed = 0;
    set({
      phase: 'docked',
      reveal: 1,
      gameTransition: 1,
      introRadius: 240,
      introGlow: 0,
      activeIsland: id,
      destination: null,
      freeTarget: null,
    });
  },
}));
