/**
 * Passerelle entre la scène 3D et l'interface DOM du gameplay, hors React : la scène y
 * écrit à chaque image la position à l'écran du bateau et du bouchon (pixels CSS), le
 * DOM la lit dans sa propre boucle pour placer ses bulles sans rendu React par image.
 */
export interface ScreenPoint {
  x: number;
  y: number;
  /** Devant la caméra et dans le cadre. */
  visible: boolean;
}

export const probe = {
  boat: { x: 0, y: 0, visible: false } as ScreenPoint,
  float: { x: 0, y: 0, visible: false } as ScreenPoint,
};

/** Instantané du canvas WebGL, déposé par la scène juste après un rendu (mode carte postale). */
export const darkroom: { snapshot: HTMLCanvasElement | null } = { snapshot: null };
