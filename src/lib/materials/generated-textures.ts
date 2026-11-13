// Généré par scripts/assets/bake-textures.mjs — ne pas modifier à la main.
// Liste les matériaux Substance dont les cartes existent dans public/textures/substance/<id>/.
// Un matériau absent est rendu par son repli procédural (voir substance-material.ts).
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

export const SUBSTANCE_TEXTURES: Partial<Record<SubstanceId, SubstanceTextureSet>> = {
  "barnacle_covered_rock": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "137f1faa"
  },
  "blocky_stone_cliff": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "9a4c6cb0"
  },
  "coast_cliff_rock_overgrown": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "a64ede43"
  },
  "driftwood": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "8bebdc56"
  },
  "earth_and_grass": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "3a947dbc"
  },
  "fine_sand_beach": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "c5377292"
  },
  "iron_steam_pipe": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "b57a0686"
  },
  "island_cliff": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "32893e0c"
  },
  "mossy_brick_wall": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "9f590df5"
  },
  "mossy_island_cliff": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "110be788"
  },
  "ocean_spray_swept_wood": {
    "size": 1024,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "1c3ec753"
  },
  "ocean_spray_swept_wood_planks": {
    "size": 1024,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "73b6068b"
  },
  "wild_grass": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "b46b570b"
  },
  "wood_barrier": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "060a6db2"
  },
  "wood_beam": {
    "size": 512,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "4edc3e71"
  },
  "wood_flooring": {
    "size": 1024,
    "basecolor": true,
    "normal": true,
    "orm": true,
    "alpha": false,
    "version": "4d2a632f"
  }
};
