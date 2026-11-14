'use client';

import { create } from 'zustand';
import { logbook } from '@/lib/logbook';

/**
 * Pont minuscule entre l'île (3D) et le dossier (DOM) : les deux racines sont chargées à
 * part, elles se parlent par ce store.
 */
export type RevealSource = 'camera' | 'approach' | 'debug';

interface DossierState {
  open: boolean;
  /** Dernière source d'ouverture (la caméra cliquée, l'approche du bateau…). */
  source: RevealSource | null;
  /** Incrémenté à chaque ouverture : relance l'animation d'insertion de la cassette. */
  session: number;
  reveal: (source: RevealSource) => void;
  close: () => void;
}

export const useStaticDossier = create<DossierState>((set, get) => ({
  open: false,
  source: null,
  session: 0,
  reveal: (source) => {
    if (get().open) return;
    set((state) => ({ open: true, source, session: state.session + 1 }));
    logbook.stamp('static');
  },
  close: () => set({ open: false }),
}));
