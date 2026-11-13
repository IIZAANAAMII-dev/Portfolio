import type { terrainFeatures } from '../terrain-shape';

export type TerrainFeatures = ReturnType<typeof terrainFeatures>;

/**
 * Réglages d'une île, lus AVANT le chargement de son décor (relief, végétation
 * automatique). Chaque île a son propre fichier `config.ts` : on peut le modifier sans
 * toucher aux autres îles.
 */
export interface IslandSceneConfig {
  /** Flamboyants posés automatiquement sur le plateau (0 : aucun). */
  trees: number;
  /** Quantité d'herbe automatique (0 : aucune, 1 : normale). */
  grass: number;
  /** Quatre couleurs de touffes d'herbe (de la plus courante à la plus rare). */
  grassPalette?: string[];
  /** Rochers, fleurs et étoiles de mer automatiques au bord de l'eau. */
  dressing: boolean;
  /** Teinte multipliée sur la roche des falaises. */
  cliffTint?: string;
  /**
   * Retouche du relief. Reçoit la hauteur d'origine en (x, z) (repère local de l'île),
   * renvoie la hauteur voulue. Sert à aplanir une place, creuser un port, séparer deux
   * moitiés… Le maillage, l'herbe, les arbres et `on()` suivent automatiquement.
   */
  sculpt?: (x: number, z: number, height: number, features: TerrainFeatures) => number;
}
