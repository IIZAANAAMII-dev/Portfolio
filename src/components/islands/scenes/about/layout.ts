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
  cliffTop: 10.4,
  /** Pied de cette falaise : début de l'esplanade du quai (s). */
  quayBack: 11.2,
  /** Mur de quai, bord du bassin (s). */
  quayFront: 12.9,
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

export type HouseKind = 'longere' | 'capitaine' | 'penty' | 'atelier' | 'chapelle';

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
    radius: 8.0,
    turn: 0.1,
    width: 4.5,
    depth: 3.4,
    wall: 3.7,
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

/* -------------------------------------------------------------- chemins */

/** Rampe taillée dans le relief (escalier, chemin creux) : de `from` (bas) à `to` (haut). */
export interface Ramp {
  from: [number, number];
  to: [number, number];
  bottom: number;
  top: number;
  half: number;
  steps: number;
  /** Portion du trajet où l'on monte (le reste est à plat) : [début, fin] en fraction. */
  climb: [number, number];
}

/** L'escalier du port : du pied de la jetée jusqu'à la porte de l'atelier, en écharpe dans la falaise. */
export const HARBOR_STAIR: Ramp = {
  from: fromDock(11.75, HARBOR.jettyT),
  to: [4.15, 10.85],
  bottom: QUAY_Y + 0.12,
  top: VILLAGE_Y,
  half: 0.62,
  steps: 13,
  climb: [0, 1],
};

/** Le chemin creux qui monte du village à la lande et à la chapelle. */
export const HILL_PATH: Ramp = {
  from: [6.05, 4.3],
  to: [0.45, 4.75],
  bottom: VILLAGE_Y,
  top: 6.2,
  half: 0.58,
  steps: 11,
  climb: [0.2, 0.8],
};

/** Hauteur d'une rampe à la fraction `u` de son trajet. */
export function rampHeight(path: Ramp, u: number) {
  const [start, end] = path.climb;
  const t = Math.min(1, Math.max(0, (u - start) / (end - start)));
  return path.bottom + (path.top - path.bottom) * t;
}

/* ------------------------------------------------------------- la lande */

/** Chapelle de granit au sommet de la butte, clocher-mur et sa cloche. */
export const CHAPEL: HousePlan = {
  id: 'chapelle',
  kind: 'chapelle',
  angle: 0,
  radius: 0,
  turn: 0,
  width: 4.4,
  depth: 2.9,
  wall: 2.1,
  paint: '#3c5a7a',
  chimneys: [],
};
export const CHAPEL_AT: [number, number] = [-0.45, -2.3];
/** La façade (long côté) de la chapelle regarde le village et la caméra. */
export const CHAPEL_FACING = 1.05;

/** Murets de pierre sèche qui découpent la butte en petits champs. */
export const FIELD_WALLS: [number, number][][] = [
  [[-4.1, 4.95], [-2.4, 3.55], [-0.95, 2.35], [0.55, 1.05], [2.2, -0.45], [3.75, -2.0]],
  [[-0.95, 2.35], [-2.1, 0.35], [-3.1, -1.25], [-3.95, -2.4]],
];

/** Prairie des moutons (devant), pré de foin (derrière à gauche). */
export const PASTURE = { center: [1.3, 3.1] as [number, number], radius: 1.7 };
export const HAYFIELD = { center: [-3.05, 1.25] as [number, number], radius: 1.75 };

/** Corde à linge, tendue sur le plateau entre la longère et la pointe du phare. */
export const LAUNDRY = { angle: -0.97, from: 8.35, to: 10.2 };

/** Le pêcheur qui ravaude ses filets sur le quai (repère du port : s, t). */
export const FISHERMAN: [number, number] = [12.05, 1.75];
