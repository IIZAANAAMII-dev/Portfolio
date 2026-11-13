import type { SubstanceId } from '@/lib/materials/substances';
import type { Vec2 } from '@/types';

/**
 * YELLOW STATIC — l'île secrète.
 *
 * Elle n'apparaît dans aucun menu : on la trouve en naviguant au large, dans la brume,
 * en suivant les traces jaunes. Le dossier présente le jeu tel qu'il est : en développement.
 * Aucune mécanique n'est inventée ici : seulement ce que Kyliann a décrit.
 */
export const yellowStaticIsland = {
  position: [86, 82] as Vec2,
  radius: 9,
  elevation: 3.2,
  /** Le ponton regarde le centre de l'archipel (d'où arrive le visiteur). */
  dockAngle: Math.atan2(-82, -86),
  terrain: { cliff: 'mossy_island_cliff' as SubstanceId, top: 'earth_and_grass' as SubstanceId },
  /** Rayon où la brume, le son et la lumière commencent à changer. */
  influence: 46,
};

export const yellowStatic = {
  title: 'YELLOW STATIC',
  status: 'En développement',
  pitch: 'Un jeu d’horreur psychologique en coopération, inspiré des Backrooms.',
  engine: 's&box · Source 2',
  facts: [
    { label: 'Équipe', value: '4 scientifiques' },
    { label: 'QG', value: 'une maison' },
    { label: 'Moteur', value: 's&box · Source 2' },
    { label: 'Statut', value: 'en développement' },
  ],
  roles: ['Caméraman', 'Opérateur', 'Scientifiques de terrain'],
  pillars: [
    { title: 'La faille', text: 'Une faille mystérieuse s’ouvre dans la maison.' },
    { title: 'Niveaux procéduraux', text: 'Des niveaux générés, jamais tout à fait les mêmes.' },
    { title: 'Filmer les anomalies', text: 'Des anomalies à trouver… et à filmer.' },
    { title: 'Ambiance VHS', text: 'Une atmosphère liminale, grain de cassette et néons.' },
    { title: 'Créatures', text: 'Des créatures, dont le Listener.' },
    { title: 'Progression', text: 'Une progression, et l’ambition d’un vrai jeu multijoueur.' },
  ],
  /** Mention honnête affichée en bas du dossier. */
  disclaimer: 'Projet personnel en cours de développement : rien n’est définitif.',
};
