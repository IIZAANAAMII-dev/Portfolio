'use client';

import { create } from 'zustand';
import { islands } from '@/data/islands';
import type { IslandId } from '@/types';

/**
 * Carnet de bord : les tampons gagnés en naviguant (îles visitées, îlots réveillés,
 * étoiles d'or repêchées, petits exploits cachés). Gardé dans le navigateur du visiteur
 * (localStorage, facultatif) : rien n'est envoyé nulle part.
 */

export type StampId =
  | `island:${IslandId}`
  | 'islet:breizh'
  | 'islet:tech'
  | 'islet:design'
  | 'stars'
  | 'duck'
  | 'bumper'
  | 'night'
  | 'edge'
  | 'lighthouse'
  | 'bottle'
  | 'bell'
  | 'whale'
  | 'workshop'
  | 'static'
  | 'chest'
  | 'wreck'
  | 'submarine'
  | 'mechafish'
  | 'serpent'
  | 'cat'
  | 'radio'
  | 'buoy';

export interface StampInfo {
  id: StampId;
  title: string;
  hint: string;
  /** Petit symbole imprimé au centre du tampon. */
  glyph: string;
}

export const STAR_COUNT = 7;

export const STAMPS: StampInfo[] = [
  ...islands.map((island) => ({
    id: `island:${island.id}` as StampId,
    title: island.label,
    hint: `Accoster à l’île ${island.label}`,
    glyph: '⚓',
  })),
  { id: 'islet:breizh', title: 'Breizh', hint: 'Réveiller l’îlot breton', glyph: '⛯' },
  { id: 'islet:tech', title: 'High-tech', hint: 'Réveiller l’îlot high-tech', glyph: '⌘' },
  { id: 'islet:design', title: 'Design', hint: 'Réveiller l’îlot du design', glyph: '✎' },
  { id: 'stars', title: 'Étoiles d’or', hint: `Repêcher les ${STAR_COUNT} étoiles d’or`, glyph: '✦' },
  { id: 'duck', title: 'Coin-coin !', hint: 'Bousculer le canard géant', glyph: '◉' },
  { id: 'bumper', title: 'Auto-tamponneuse', hint: 'Bousculer 6 objets flottants', glyph: '❂' },
  { id: 'night', title: 'Navigateur de nuit', hint: 'Naviguer sous les étoiles', glyph: '☾' },
  { id: 'edge', title: 'Hic sunt dracones', hint: 'Approcher de la mer interdite', glyph: '☠' },
  { id: 'lighthouse', title: 'Gardien du phare', hint: 'Cliquer sur le phare breton', glyph: '✺' },
  { id: 'bottle', title: 'Bouteille à la mer', hint: 'Écrire à Kyliann depuis l’île Contact', glyph: '✉' },
  { id: 'bell', title: 'Sonneur de cloche', hint: 'Faire sonner la cloche de l’île Contact', glyph: '♫' },
  { id: 'whale', title: 'Baleine en vue !', hint: 'Voir une baleine sauter au large', glyph: '≈' },
  { id: 'workshop', title: 'L’atelier', hint: 'Entrer dans l’atelier de la maison bretonne', glyph: '⌂' },
  { id: 'cat', title: 'Le chat du port', hint: 'Caresser le chat sur un ponton', glyph: '♡' },
  { id: 'buoy', title: 'Bouée bavarde', hint: 'Écouter le conseil d’une bouée', glyph: '⊙' },
  { id: 'radio', title: 'Radio de bord', hint: 'Changer de station sur la radio marine', glyph: '♪' },
  { id: 'chest', title: 'Trésor !', hint: 'Ouvrir le coffre au trésor', glyph: '◈' },
  { id: 'wreck', title: 'Vieux chalutier', hint: 'Trouver le bateau de pêche échoué', glyph: '⚑' },
  { id: 'submarine', title: 'Périscope', hint: 'Repérer le mini sous-marin', glyph: '◎' },
  { id: 'mechafish', title: 'Poisson à remontoir', hint: 'Attraper le poisson mécanique', glyph: '⚙' },
  { id: 'serpent', title: 'Serpent de mer', hint: 'Apercevoir le serpent au bout du monde', glyph: '∿' },
  { id: 'static', title: 'Signal jaune', hint: 'Trouver ce qui grésille dans la brume', glyph: '▦' },
];

const STORAGE_KEY = 'kyliann-logbook-v1';

interface Saved {
  stamps: StampId[];
  stars: number[];
}

function load(): Saved {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stamps: [], stars: [] };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return { stamps: parsed.stamps ?? [], stars: parsed.stars ?? [] };
  } catch {
    return { stamps: [], stars: [] };
  }
}

function save(state: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Navigation privée ou stockage bloqué : le carnet vit le temps de la visite.
  }
}

interface LogbookState {
  hydrated: boolean;
  stamps: StampId[];
  stars: number[];
  bumps: number;
  open: boolean;
  /** Dernier tampon gagné (pour la notification), avec un compteur pour la relancer. */
  latest: { id: StampId; at: number } | null;
  /** Dernière étoile repêchée (notification « 3/7 »). */
  latestStar: { count: number; at: number } | null;
  hydrate: () => void;
  stamp: (id: StampId) => void;
  collectStar: (index: number) => void;
  setOpen: (open: boolean) => void;
  reset: () => void;
}

export const useLogbook = create<LogbookState>((set, get) => ({
  hydrated: false,
  stamps: [],
  stars: [],
  bumps: 0,
  open: false,
  latest: null,
  latestStar: null,
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...load(), hydrated: true });
  },
  stamp: (id) => {
    const { stamps, stars } = get();
    if (stamps.includes(id)) return;
    const next = [...stamps, id];
    set({ stamps: next, latest: { id, at: Date.now() } });
    save({ stamps: next, stars });
  },
  collectStar: (index) => {
    const { stars, stamps } = get();
    if (stars.includes(index)) return;
    const next = [...stars, index];
    set({ stars: next, latestStar: { count: next.length, at: Date.now() } });
    save({ stamps, stars: next });
    if (next.length >= STAR_COUNT) get().stamp('stars');
  },
  setOpen: (open) => set({ open }),
  reset: () => {
    set({ stamps: [], stars: [], bumps: 0, latest: null, latestStar: null });
    save({ stamps: [], stars: [] });
  },
}));

/** Raccourcis appelés depuis la scène (hors React). */
export const logbook = {
  stamp: (id: StampId) => useLogbook.getState().stamp(id),
  has: (id: StampId) => useLogbook.getState().stamps.includes(id),
  bump: (kind: string) => {
    const state = useLogbook.getState();
    if (kind === 'duck') state.stamp('duck');
    const bumps = state.bumps + 1;
    useLogbook.setState({ bumps });
    if (bumps >= 6) state.stamp('bumper');
  },
  complete: () => {
    const { stamps } = useLogbook.getState();
    return STAMPS.every((stamp) => stamps.includes(stamp.id));
  },
};
