import { Vector3 } from 'three';

/**
 * Mouvement du bateau, mesuré une fois par image par Boat (hors React) et lu par le modèle,
 * le patron, la fumée et les embruns : tous réagissent au même gaz, au même coup de barre.
 */
export const boatMotion = {
  /** Vitesse normalisée 0 → 1. */
  throttle: 0,
  /** Accélération lissée (m/s²) : positive quand le moteur pousse, négative au freinage. */
  accel: 0,
  /** Vitesse de lacet lissée (rad/s), positive en venant sur tribord. */
  turn: 0,
  /** Angle de barre lissé (rad), positif = barre à tribord. */
  steer: 0,
  /** Gîte appliquée (rad) : le patron la compense pour rester d'aplomb. */
  roll: 0,
  /** Instants (horloge three) des derniers événements ; -1 = jamais. */
  splashAt: -1,
  dockedAt: -1,
  bumpAt: -1,
  /** Fourneau de la pipe du patron (monde), tenu à jour par le modèle ; `pipeAt` = dernière mise à jour. */
  pipe: new Vector3(),
  pipeAt: -1,
};
