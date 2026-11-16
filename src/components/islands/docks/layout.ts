/**
 * Cotes du bout des pontons, partagées par le ponton (géométrie), l'amarrage du bateau
 * (boat/mooring.ts) et la corde d'amarre : ce que le patron vise en lançant son amarre doit
 * être exactement là où le ponton pose ses bittes. Aucun import three.js ici.
 *
 * Repère d'un ponton : +X le long du ponton vers le large, Z en travers (le groupe du ponton
 * est tourné de −angle : son +Z local est (−sin a, cos a) dans le monde).
 */

/** Dessus du plancher au-dessus de l'eau. */
export const DOCK_DECK = 0.78;
/** Demi-largeur du plancher. */
export const DOCK_HALF = 1.0;
/** Bout d'un ponton d'île, par défaut : rayon de l'île + 0,9 m (le bateau mouille à rayon + 4,5 m). */
export const DOCK_END_OFFSET = 0.9;
/** Bout du ponton du port de départ, où le bateau est amarré de flanc (rayon + 5,8 m). */
export const HOME_DOCK_END = 4.35;
export const HOME_BERTH = 5.8;

/** Bittes d'amarrage aux deux coins du bout : recul depuis le bout, écart à l'axe. */
export const BOLLARD_INSET = 0.3;
export const BOLLARD_SPREAD = 0.62;
/** Hauteur du collet de la bitte (la boucle de l'amarre s'y capelle). */
export const BOLLARD_NECK = DOCK_DECK + 0.2;

/**
 * Passavant (planche de coupée) : charnière au bout du plancher, rangé à plat sur le
 * ponton, il bascule par-dessus la charnière et se pose sur le plat-bord du bateau.
 */
export const GANGWAY_LENGTH = 2.85;
export const GANGWAY_WIDTH = 0.56;
export const GANGWAY_THICK = 0.06;
/**
 * Charnière : au bout du plancher, une demi-épaisseur au-dessus (la planche, centrée sur son
 * axe, repose sur le plancher une fois rangée, retournée).
 */
export const GANGWAY_HINGE_X = 0.02;
export const GANGWAY_HINGE_Y = DOCK_DECK + 0.045;
