import { create } from 'zustand';

/**
 * Feuille de contenu sur téléphone (page de l'île à quai, qui monte du bas de l'écran).
 * Écrite par le panneau (DOM), lue par la caméra : l'île reste cadrée au-dessus de la feuille.
 */
export const sheetState = {
  /** Part de la hauteur d'écran couverte par la feuille (0 : fermée ou mise en page bureau). */
  cover: 0,
};

/** Hauteur de la feuille repliée, en part d'écran — même valeur que `--sheet-peek` (globals.css). */
export const SHEET_PEEK = 0.5;

/** Feuille dépliée sur tout l'écran : le monde, invisible derrière, peut cesser de se dessiner. */
export const useSheetCover = create<{ full: boolean }>(() => ({ full: false }));

export function setSheetCover(cover: number) {
  sheetState.cover = cover;
  const full = cover > 0.95;
  if (useSheetCover.getState().full !== full) useSheetCover.setState({ full });
}
