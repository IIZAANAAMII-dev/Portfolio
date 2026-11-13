import type { SubstanceId } from '@/lib/materials/substances';
import type { IslandId, Vec2 } from '@/types';

/**
 * Îlots de personnalité : autour de l'île « À propos », chaque îlot porte une facette de
 * Kyliann (racines bretonnes, passion du code, œil du designer). Ils se réveillent quand le
 * bateau passe à proximité. Positions choisies hors des routes entre les îles.
 */
export type IsletKind = 'breizh' | 'tech' | 'design';

export interface IsletConfig {
  id: IsletKind;
  label: string;
  tagline: string;
  /** Île à laquelle l'îlot se rattache (son panneau en parle). */
  parent: IslandId;
  position: Vec2;
  radius: number;
  elevation: number;
  seed: number;
  accent: string;
  terrain: { cliff: SubstanceId; top: SubstanceId; cliffTint?: string };
  /** Couleurs des touffes d'herbe (bruyère en Bretagne…). */
  grass: string[];
}

export const islets: IsletConfig[] = [
  {
    id: 'breizh',
    label: 'Breizh',
    tagline: 'mes racines bretonnes',
    parent: 'about',
    position: [-51.9, 3.8],
    radius: 7.5,
    elevation: 3.4,
    seed: 71,
    accent: '#f4efe6',
    // Granit rose de la côte bretonne.
    terrain: { cliff: 'blocky_stone_cliff', top: 'wild_grass', cliffTint: '#f0b3a6' },
    grass: ['#8b5aa8', '#a679c2', '#6f9a3c', '#c290d8'],
  },
  {
    id: 'tech',
    label: 'High-tech',
    tagline: 'le code, ma passion',
    parent: 'about',
    position: [-27, -47.8],
    radius: 6.5,
    elevation: 2.8,
    seed: 83,
    accent: '#5ef2ff',
    terrain: { cliff: 'blocky_stone_cliff', top: 'earth_and_grass', cliffTint: '#b9c3d6' },
    grass: ['#4f7f33', '#3f6b4e', '#6f9a3c', '#5aa58f'],
  },
  {
    id: 'design',
    label: 'Design',
    tagline: 'l’œil du détail',
    parent: 'about',
    position: [-58.7, -63.9],
    radius: 6.5,
    elevation: 2.6,
    seed: 97,
    accent: '#f2c14e',
    terrain: { cliff: 'island_cliff', top: 'wild_grass' },
    grass: ['#6f9a3c', '#93a646', '#e58f88', '#f2c14e'],
  },
];
