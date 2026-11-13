import catalogue from './substances.json';

/**
 * Catalogue des matériaux Substance 3D de la collection Bell Island (Adobe, licence
 * Substance 3D Assets — voir docs/ASSETS.md). Les données vivent dans substances.json,
 * partagé avec le générateur de textures (scripts/assets/bake-textures.mjs).
 *
 * Les .sbsar ne s'évaluent pas dans le navigateur. Leurs cartes viennent soit d'un export
 * Substance Sampler / Designer, soit du générateur procédural du projet, qui reproduit le
 * style de chaque matériau à partir de sa palette. Tant qu'aucune carte n'existe, le
 * shader rend un repli procédural : la scène reste cohérente à toutes les étapes.
 *
 * - `tile`  : taille physique d'une répétition du motif, en mètres (physicalSize du .sbsar)
 * - `kind`  : famille, qui règle le bruit du repli procédural
 * - couleurs en sRGB
 */
export type SubstanceKind = 'wood' | 'rock' | 'ground' | 'wall' | 'metal' | 'organic' | 'water' | 'fx';

export interface SubstanceDefinition {
  label: string;
  tile: number;
  kind: SubstanceKind;
  shade: string;
  base: string;
  light: string;
  roughness: number;
  metalness?: number;
  /** Le .sbsar exporte une carte d'opacité (planches ajourées, algues, fumée, eau). */
  opacity?: boolean;
}

export type SubstanceId = keyof typeof catalogue;

export const SUBSTANCES = catalogue as Record<SubstanceId, SubstanceDefinition>;

export function substance(id: SubstanceId): SubstanceDefinition {
  return SUBSTANCES[id];
}
