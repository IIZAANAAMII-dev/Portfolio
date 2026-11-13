'use client';

import { create } from 'zustand';
import { useWorld } from '@/lib/store';
import type { IslandId } from '@/types';

/**
 * Focus d'un élément précis d'une île (un projet, une zone du labo, une étape…).
 *
 * Les décors 3D appellent `focusItem('projects', 'feeder')` au clic : si le bateau n'est
 * pas déjà à quai sur cette île, il y navigue ; le panneau s'ouvre ensuite directement
 * sur l'élément demandé (déplié, mis en valeur, défilé jusqu'à lui).
 */
interface FocusState {
  island: IslandId | null;
  item: string | null;
  /** Horodatage : relancer le même focus rejoue la mise en valeur. */
  at: number;
  set: (island: IslandId | null, item: string | null) => void;
}

export const useFocus = create<FocusState>((set) => ({
  island: null,
  item: null,
  at: 0,
  set: (island, item) => set({ island, item, at: Date.now() }),
}));

export function focusItem(island: IslandId, item: string | null) {
  useFocus.getState().set(island, item);
  const world = useWorld.getState();
  if (world.activeIsland === island) return;
  world.sailTo(island);
}

/** Élément ciblé pour une île donnée (null si le focus concerne une autre île). */
export function useFocusedItem(island: IslandId) {
  return useFocus((state) => (state.island === island ? state.item : null));
}
