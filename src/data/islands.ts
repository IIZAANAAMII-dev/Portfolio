import type { IslandConfig, IslandId } from '@/types';

/**
 * L'archipel. Le monde reste volontairement petit : 6 îles autour d'un îlot de départ
 * situé à l'origine. Les positions sont choisies pour que tous les trajets soient
 * directs (voir docs/ARCHITECTURE.md — pathfinding simple).
 */
export const islands: IslandConfig[] = [
  {
    id: 'about',
    label: 'About',
    tagline: 'qui je suis',
    position: [-56, -30],
    radius: 15,
    elevation: 6.5,
    accent: '#f0b27a',
    ground: '#6f9c5f',
    dockAngle: 0.5,
    cameraAngle: 0.5,
    silhouette: 'nature',
  },
  {
    id: 'skills',
    label: 'Skills',
    tagline: 'mes outils',
    position: [52, -46],
    radius: 14,
    elevation: 4.5,
    accent: '#7fd7e8',
    ground: '#5f8496',
    dockAngle: 2.41,
    cameraAngle: 2.41,
    silhouette: 'grid',
  },
  {
    id: 'projects',
    label: 'Projects',
    tagline: 'ce que je construis',
    position: [70, 26],
    radius: 19,
    elevation: 7,
    accent: '#f2d98d',
    ground: '#6a8f63',
    dockAngle: -2.8,
    cameraAngle: -2.8,
    silhouette: 'monoliths',
  },
  {
    id: 'experience',
    label: 'Experience',
    tagline: 'où j’ai travaillé',
    position: [-22, 66],
    radius: 16,
    elevation: 8,
    accent: '#c9a7f0',
    ground: '#5d7f6b',
    dockAngle: -1.27,
    cameraAngle: -1.27,
    silhouette: 'towers',
  },
  {
    id: 'journey',
    label: 'Journey',
    tagline: 'le chemin parcouru',
    position: [-72, 30],
    radius: 17,
    elevation: 5,
    accent: '#a8d5a2',
    ground: '#74996a',
    dockAngle: -0.4,
    cameraAngle: -0.4,
    silhouette: 'path',
  },
  {
    id: 'contact',
    label: 'Contact',
    tagline: 'on se parle ?',
    position: [16, -82],
    radius: 12,
    elevation: 3.5,
    accent: '#ffffff',
    ground: '#7d8a92',
    dockAngle: 1.76,
    cameraAngle: 1.76,
    silhouette: 'beacon',
  },
];

export const islandById = Object.fromEntries(
  islands.map((island) => [island.id, island]),
) as Record<IslandId, IslandConfig>;

/** Îlot de départ : minuscule, au centre, sans contenu. C'est le décor de l'intro. */
export const homeIsland = {
  position: [0, 0] as [number, number],
  radius: 7,
  elevation: 2.6,
  dockAngle: -0.9,
};
