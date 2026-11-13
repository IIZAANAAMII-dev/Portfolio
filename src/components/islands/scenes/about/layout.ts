import { islandById } from '@/data/islands';

/**
 * Plan du village breton de l'île À propos, en mètres, dans le repère local de l'île.
 * Partagé par le relief (config.ts, lu avant le décor) et par le décor lui-même : aucun
 * import three.js ici, ce module reste léger.
 *
 * Deux repères :
 *  - polaire (angle, rayon) autour du centre de l'île, pour le village et le phare ;
 *  - « ponton » (s, t) : s le long de l'axe du ponton (vers le large), t sur le côté
 *    (t > 0 vers la gauche quand on regarde le large). Le port y est dessiné.
 */

export const ABOUT = islandById.about;
export const DOCK_ANGLE = ABOUT.dockAngle;

const DX = Math.cos(DOCK_ANGLE);
const DZ = Math.sin(DOCK_ANGLE);

/** (s, t) du repère du ponton → (x, z) de l'île. */
export function fromDock(s: number, t: number): [number, number] {
  return [s * DX - t * DZ, s * DZ + t * DX];
}

/** (x, z) de l'île → (s, t) du repère du ponton. */
export function toDock(x: number, z: number): [number, number] {
  return [x * DX + z * DZ, -x * DZ + z * DX];
}

/** Point polaire → (x, z). */
export function polar(angle: number, radius: number): [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** Orientation (rotation.y) d'un objet dont la façade (+Z local) regarde vers l'angle donné. */
export function facing(angle: number) {
  return Math.atan2(Math.cos(angle), Math.sin(angle));
}

/** Rotation.y qui aligne le +X local sur l'axe du ponton (+Z local vers t < 0). */
export const DOCK_YAW = -DOCK_ANGLE;

/* ------------------------------------------------------------------ niveaux */

/** Terrasse du village, aplanie sur le plateau. */
export const VILLAGE_Y = 3.45;
/** Dessus des quais de granit. */
export const QUAY_Y = 1.05;
/** Fond du bassin du port (sous l'eau). */
export const BASIN_FLOOR = -0.95;

/* ---------------------------------------------------------------------- port */

export const HARBOR = {
  /** Haut de la falaise reculée derrière le quai (s). */
  cliffTop: 10.9,
  /** Pied de cette falaise : début de l'esplanade du quai (s). */
  quayBack: 11.7,
  /** Mur de quai, bord du bassin (s). */
  quayFront: 13.5,
  /** Demi-largeur de l'esplanade (|t|). */
  quayHalf: 5.6,
  /** Demi-largeur du bassin (|t|). */
  basinHalf: 3.7,
  /** Bout du bassin, au large (s). */
  basinEnd: 18,
  /** Jetée de gauche (t > 0) : axe et demi-épaisseur, extrémité au large. */
  jettyT: 4.55,
  jettyHalf: 0.75,
  jettyEnd: 17.4,
  /** Cale de mise à l'eau, côté droit du bassin. */
  slipT: -2.75,
};

/* ------------------------------------------------------------------- village */

export type HouseKind = 'longere' | 'capitaine' | 'penty' | 'atelier' | 'gardien';

export interface HousePlan {
  id: string;
  kind: HouseKind;
  /** Position polaire du centre au sol. */
  angle: number;
  radius: number;
  /** Écart de l'orientation par rapport à « face au large » (radians). */
  turn: number;
  /** Façade (le long des murs gouttereaux) et profondeur (pignons). */
  width: number;
  depth: number;
  /** Hauteur des murs (égout du toit). */
  wall: number;
  /** Murs chaulés (blancs) plutôt qu'en granit apparent. */
  white?: boolean;
  /** Couleur des volets et de la porte. */
  paint: string;
  /** Cheminées : sur le pignon gauche, droit, ou les deux (vue de face). */
  chimneys: ('left' | 'right')[];
  /** Cheminées qui fument. */
  smoke?: ('left' | 'right')[];
}

export const HOUSES: HousePlan[] = [
  {
    id: 'longere',
    kind: 'longere',
    angle: -0.42,
    radius: 9.1,
    turn: 0.12,
    width: 6.4,
    depth: 3.3,
    wall: 2.3,
    paint: '#3f6fb0',
    chimneys: ['left', 'right'],
    smoke: ['right'],
  },
  {
    id: 'capitaine',
    kind: 'capitaine',
    angle: 0.24,
    radius: 8.4,
    turn: 0.1,
    width: 4.5,
    depth: 3.5,
    wall: 3.9,
    paint: '#3c8a6e',
    chimneys: ['left', 'right'],
    smoke: ['left'],
  },
  {
    id: 'penty',
    kind: 'penty',
    angle: 1.66,
    radius: 8.6,
    turn: -0.1,
    width: 4.2,
    depth: 3.1,
    wall: 2.15,
    white: true,
    paint: '#2f6fa8',
    chimneys: ['right'],
    smoke: ['right'],
  },
];

/** L'atelier de Kyliann : une maison de granit qui s'ouvre au clic (toit et façade). */
export const WORKSHOP: HousePlan = {
  id: 'atelier',
  kind: 'atelier',
  angle: 0.98,
  radius: 8.9,
  turn: 0.02,
  width: 5.2,
  depth: 3.8,
  wall: 2.55,
  paint: '#c8463a',
  chimneys: ['left'],
  smoke: ['left'],
};

/* --------------------------------------------------------------------- phare */

export const LIGHTHOUSE = {
  angle: -1.12,
  /** Le phare, sur son rocher de granit au bout de la pointe. */
  radius: 16.1,
  /** Pointe rocheuse qui y mène depuis le plateau. */
  spurFrom: 11.2,
  spurTo: 15.3,
  spurY: 2.45,
  spurHalf: 1.7,
};
