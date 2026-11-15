/**
 * Passerelle entre la scène 3D et l'interface DOM du gameplay, hors React : la scène y
 * écrit à chaque image la position à l'écran du bateau, du bouchon et du coin de pêche le
 * plus proche (pixels CSS), le DOM la lit dans sa propre boucle pour placer ses bulles sans
 * rendu React par image.
 */
export interface ScreenPoint {
  x: number;
  y: number;
  /** Devant la caméra et dans le cadre. */
  visible: boolean;
}

export const probe = {
  /** La scène 3D du gameplay écrit dans la sonde (sinon le DOM n'affiche rien d'ancré). */
  live: false,
  boat: { x: 0, y: 0, visible: false } as ScreenPoint,
  float: { x: 0, y: 0, visible: false } as ScreenPoint,
  /** Coin de pêche le plus proche du bateau (index dans SPOTS, -1 si aucun assez près). */
  spot: { x: 0, y: 0, visible: false } as ScreenPoint,
  spotIndex: -1,
  spotDistance: Number.POSITIVE_INFINITY,
  /** Direction de visée de la caméra à plat (x, z normalisés) : flèches de cap du DOM. */
  viewX: 0,
  viewZ: -1,
};

/**
 * Chambre noire de la carte postale : `capture` (fourni par la scène) rend l'image et copie le
 * canvas WebGL aussitôt, dans la même tâche — au clic, sans attendre la prochaine image,
 * même quand le rendu est très lent. `snapshot` reçoit la copie.
 */
export const darkroom: { snapshot: HTMLCanvasElement | null; capture: (() => void) | null } = {
  snapshot: null,
  capture: null,
};
