import { homeIsland } from '@/data/islands';

/**
 * Place de l'atelier sur l'îlot de départ (repère de l'îlot = repère du monde, l'îlot est à
 * l'origine) : sur le replat sud du plateau, entre le dôme du sommet et la falaise, à côté du
 * haut de l'escalier du ponton. Sa façade regarde le large (et la caméra de jeu, au
 * sud-ouest) ; le bateau, amarré au bout du ponton, est sur sa gauche, en contrebas.
 * Aucun import three.js ici : la caméra lit ces cotes.
 */
const DOCK_X = Math.cos(homeIsland.dockAngle);
const DOCK_Z = Math.sin(homeIsland.dockAngle);
/** (le long du ponton, en travers) → îlot. */
const along = 3.25;
const across = -1.95;

export const ATELIER = {
  // +Z du ponton dans le monde : (−sin a, cos a).
  x: homeIsland.position[0] + DOCK_X * along - DOCK_Z * across,
  z: homeIsland.position[1] + DOCK_Z * along + DOCK_X * across,
  /** Direction (angle, même convention que dockAngle) vers laquelle regarde la façade. */
  facing: -1.35,
  /** Hauteur approximative du replat (le décor se cale exactement sur le relief). */
  ground: 1.9,
};

/** Rotation Y qui tourne le +Z local de l'atelier vers sa façade. */
export const ATELIER_YAW = Math.atan2(Math.cos(ATELIER.facing), Math.sin(ATELIER.facing));
