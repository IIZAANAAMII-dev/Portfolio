// Généré par scripts/assets/build-textures.mjs — ne pas modifier à la main.
// Liste les matériaux Substance dont les cartes ont été exportées et compressées dans
// public/textures/substance/<id>/. Un matériau absent est rendu par son repli procédural.
import type { SubstanceId } from './substances';

export interface SubstanceTextureSet {
  /** Côté des textures, en pixels. */
  size: number;
  basecolor: boolean;
  normal: boolean;
  /** Occlusion (R), rugosité (G), métal (B) — convention glTF. */
  orm: boolean;
  /** L'alpha de basecolor porte l'opacité du .sbsar. */
  alpha: boolean;
  /** Empreinte du contenu, pour invalider le cache navigateur. */
  version: string;
}

export const SUBSTANCE_TEXTURES: Partial<Record<SubstanceId, SubstanceTextureSet>> = {};
