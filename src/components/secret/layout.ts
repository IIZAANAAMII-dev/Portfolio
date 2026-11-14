import { yellowStaticIsland } from '@/data/yellow-static';
import { createHeightSampler, terrainFeatures, type HeightSampler, type TerrainShape } from '@/components/islands/terrain-shape';
import { lerp, smoothstep } from '@/lib/utils/math';
import type { Vec2 } from '@/types';

/**
 * YELLOW STATIC — plan de l'île.
 *
 * Tout le décor est dessiné dans un repère « site » tourné vers le ponton : +Z regarde le
 * ponton (donc le visiteur qui arrive), +X est à droite pour qui débarque. `siteToIsland`
 * ramène un point du site dans le repère de l'île (centre de l'île, axes du monde), où vit
 * la fonction de hauteur du relief.
 */

export const ISLAND = yellowStaticIsland;
export const CENTER_X = ISLAND.position[0];
export const CENTER_Z = ISLAND.position[1];

const DOCK_X = Math.cos(ISLAND.dockAngle);
const DOCK_Z = Math.sin(ISLAND.dockAngle);
/** Rotation (autour de Y) du site : son +Z local pointe vers le ponton. */
export const FACE = Math.atan2(DOCK_X, DOCK_Z);
const COS = Math.cos(FACE);
const SIN = Math.sin(FACE);

export function siteToIsland(x: number, z: number): [number, number] {
  return [x * COS + z * SIN, -x * SIN + z * COS];
}

export function islandToSite(x: number, z: number): [number, number] {
  return [x * COS - z * SIN, x * SIN + z * COS];
}

export function siteToWorld(x: number, z: number): [number, number] {
  const [ix, iz] = siteToIsland(x, z);
  return [CENTER_X + ix, CENTER_Z + iz];
}

/** Le bateau accoste à rayon + 4,5 m, comme aux autres îles. */
export const DOCK_REACH = ISLAND.radius + 4.5;
export const DOCK_POINT: Vec2 = [CENTER_X + DOCK_X * DOCK_REACH, CENTER_Z + DOCK_Z * DOCK_REACH];

/* ------------------------------------------------------------------ le plan */

/** La maison (QG de l'équipe) : deux étages, façade vers le ponton. */
export const HOUSE = {
  x: 0,
  z: -0.9,
  width: 4.6,
  depth: 3.6,
  plinth: 0.26,
  ground: 2.5,
  upper: 2.3,
  roof: 1.75,
};
/** Façade avant (z du mur, dans le site). */
export const FACADE_Z = HOUSE.z + HOUSE.depth / 2;

/** La faille : déchirure verticale dans la façade, là où était la porte. */
export const RIFT = { x: -0.15, z: FACADE_Z + 0.035, height: 2.5 };
export const RIFT_WORLD = siteToWorld(RIFT.x, RIFT.z);

/** Ponton : de la plage vers le bateau, dans l'axe de la faille. */
export const LANDING = { x: 0, from: 8.3, to: 10.6, width: 1.5, deck: 0.86 };
/** Escalier de bois : du rebord du plateau jusqu'au ponton. */
export const STAIRS = { top: 6.85, bottom: 8.35, steps: 6, width: 1.1 };


/* ------------------------------------------------------------------ relief */

export const SHAPE: TerrainShape = { radius: ISLAND.radius, elevation: ISLAND.elevation, seed: 97 };
export const FEATURES = terrainFeatures(SHAPE);
/** Hauteur de l'esplanade (maison et cour), un rien au-dessus du plateau naturel. */
export const YARD_HEIGHT = FEATURES.plateau + 0.06;

/**
 * Retouche du relief : le sommet est rasé pour une esplanade autour de la maison (un
 * escalier de bois descend ensuite la falaise jusqu'au ponton).
 */
function sculpt(x: number, z: number, height: number) {
  const r = Math.hypot(x, z);
  const yard = smoothstep(6.1, 4.3, r);
  // L'esplanade garde à peine l'ondulation du plateau (± 5 cm) : le sommet disparaît.
  const swell = Math.max(-0.2, Math.min(0.2, height - FEATURES.plateau)) * 0.25;
  return lerp(height, YARD_HEIGHT + swell, yard);
}

const BASE = createHeightSampler(SHAPE);
export const sampler: HeightSampler = (x, z) => sculpt(x, z, BASE(x, z));

/** Hauteur du sol sous un point du site. */
export function groundSite(x: number, z: number) {
  const [ix, iz] = siteToIsland(x, z);
  return sampler(ix, iz);
}

/** Point le plus bas d'un petit voisinage (un objet posé ne flotte jamais). */
export function restSite(x: number, z: number, footprint = 0.3) {
  return Math.min(
    groundSite(x, z),
    groundSite(x + footprint, z),
    groundSite(x - footprint, z),
    groundSite(x, z + footprint),
    groundSite(x, z - footprint),
  );
}

/* ------------------------------------------------------------- l'équipement */

/** Caméras de surveillance sur poteaux (cliquables). */
export const CAMERAS = [
  { x: -3.85, z: 3.45, height: 3.0, base: 2.55, seed: 0.3 },
  { x: 3.85, z: 0.55, height: 3.3, base: -1.75, seed: 1.7 },
  { x: -2.65, z: -3.35, height: 2.8, base: -0.35, seed: 3.1 },
] as const;

/** Néons de chantier sur trépied, braqués sur la faille. */
export const STANDS = [
  { x: -1.4, z: 1.85, seed: 0.4 },
  { x: 1.12, z: 1.92, seed: 2.2 },
] as const;

/** Poste de l'opérateur : table pliante et trois écrans tournés vers lui. */
export const CONSOLE = { x: 2.35, z: 3.25 };
export const GENERATOR = { x: -3.3, z: -0.15 };
export const DEAD_TREE = { x: 3.15, z: -3.15 };
export const SENSOR = { x: 0.62, z: 1.55 };

/** Ruban de chantier : un arc de piquets autour de la faille. */
export const TAPE_STAKES: [number, number][] = Array.from({ length: 5 }, (_, index) => {
  const angle = Math.PI * (0.95 - index * 0.225);
  return [RIFT.x + Math.cos(angle) * 2.05, FACADE_Z + 0.3 + Math.sin(angle) * 2.0];
});

/* ------------------------------------------------------------ les traces */

/**
 * Indices jaunes en mer (coordonnées monde) : de l'étoile d'or au large de l'île PROJETS
 * jusqu'au ponton de l'île secrète. Tous à moins de 110 m de l'origine.
 */
export const TRAIL = {
  buoy: [95.4, 45.2] as Vec2,
  cassette: [87.4, 58.6] as Vec2,
  tapes: [
    [93.2, 49.4],
    [90.4, 53.4],
    [88.6, 55.9],
    [85.4, 61.8],
    [83.1, 65.1],
    [80.4, 68.3],
  ] as Vec2[],
  /** Ligne brisée que suivent les grésillements. */
  path: [
    [96.6, 42.6],
    [93.6, 48.6],
    [89.6, 54.6],
    [86.6, 60.2],
    [82.8, 65.6],
    [79.2, 70.2],
  ] as Vec2[],
};
