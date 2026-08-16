import type { Vec2 } from '@/types';

/**
 * Zones écologiques de l'archipel.
 *
 * La faune n'est PAS répartie au hasard : chaque zone a un caractère et des espèces
 * probables, déterministes d'un chargement à l'autre (les seeds sont fixes).
 *
 *  - beach  : eau peu profonde près des plages → bancs de petits poissons vifs ;
 *  - rocks  : abords rocheux → poissons moyens, plus de diversité ;
 *  - deep   : pleine eau entre les îles → gros solitaires, raies, tortues ;
 *  - special: poches particulières → méduses, gros banc.
 *
 * Les positions sont choisies à la main autour des îles (About [-56,-30],
 * Skills [52,-46], Projects [70,26], Experience [-22,66], Journey [-72,30],
 * Contact [16,-82], Home [0,0]) pour rester hors des routes d'accostage.
 */

export type FishSpecies = 'reef' | 'blue' | 'clown' | 'shark' | 'glow';
export type SpeciesActivity = 'day' | 'night' | 'twilight' | 'predator' | 'always';

export interface SchoolSpawn {
  species: FishSpecies;
  center: Vec2;
  /** Boucle migratoire en coordonnées monde. Le banc ralentit naturellement à chaque relais. */
  route?: Vec2[];
  /** Vitesse du leader en unités monde par seconde. */
  travelSpeed?: number;
  count: number;
  radius: number;
  depth: number;
  seed: number;
  scale?: number;
  activity?: SpeciesActivity;
}

export const FISH_SCHOOLS: SchoolSpawn[] = [
  // Les routes ne traversent pas toutes le centre au même instant : leurs seeds,
  // vitesses et relais différents répartissent les rencontres dans tout l'archipel.
  {
    species: 'reef', center: [-38, -20], count: 17, radius: 14, depth: -0.9, seed: 12,
    travelSpeed: 0.44,
    route: [[-38, -20], [-24, -9], [-5, -12], [16, -22], [34, -31], [15, -42], [-8, -34]],
  }, // About -> îlot -> Skills
  {
    species: 'clown', center: [-54, 15], count: 13, radius: 12, depth: -0.8, seed: 57, scale: 0.31,
    travelSpeed: 0.34,
    route: [[-54, 15], [-47, 36], [-30, 49], [-9, 46], [-17, 27], [-36, 18]],
  }, // Journey -> Experience
  {
    species: 'reef', center: [11, -15], count: 15, radius: 13, depth: -0.88, seed: 44, scale: 0.38,
    travelSpeed: 0.39,
    route: [[11, -15], [26, -30], [34, -51], [23, -69], [1, -56], [-10, -35]],
  }, // îlot -> Skills -> Contact

  // — Poissons moyens : longues migrations entre récifs et eaux ouvertes —
  {
    species: 'blue', center: [37, -29], count: 14, radius: 15, depth: -1.18, seed: 31, scale: 0.36,
    travelSpeed: 0.31,
    route: [[37, -29], [51, -15], [59, 4], [49, 29], [29, 22], [19, 2]],
  }, // Skills -> Projects
  {
    species: 'blue', center: [48, 31], count: 12, radius: 16, depth: -1.28, seed: 73, scale: 0.4,
    travelSpeed: 0.28,
    route: [[48, 31], [28, 45], [4, 55], [-20, 51], [-43, 42], [-23, 29], [10, 27]],
  }, // Projects -> Experience -> Journey
  {
    species: 'reef', center: [-31, -48], count: 10, radius: 13, depth: -1.05, seed: 101, scale: 0.34,
    travelSpeed: 0.47,
    route: [[-31, -48], [-47, -35], [-37, -14], [-15, -21], [2, -42], [-6, -63]],
  }, // passage sud-ouest, petit banc rapide
  {
    species: 'clown', center: [37, 12], count: 9, radius: 11, depth: -0.92, seed: 119, scale: 0.29,
    travelSpeed: 0.42,
    route: [[37, 12], [20, 24], [2, 17], [-2, -3], [20, -5]],
  }, // traverse discrète entre l'îlot et Projects

  // — Couronne centrale : petits bancs espacés qui tournent autour de l'îlot —
  {
    species: 'reef', center: [-14, -4], count: 9, radius: 7, depth: -0.82, seed: 181, scale: 0.31,
    travelSpeed: 0.32,
    route: [[-14, -4], [-9, 11], [5, 14], [15, 7], [13, -7], [3, -15], [-10, -13]],
  },
  {
    species: 'clown', center: [6, 16], count: 7, radius: 7, depth: -0.74, seed: 193, scale: 0.27,
    travelSpeed: 0.38,
    route: [[6, 16], [-8, 14], [-16, 5], [-14, -9], [-2, -16], [13, -11], [17, 3]],
  },
  {
    species: 'blue', center: [19, 9], count: 8, radius: 8, depth: -1.08, seed: 207, scale: 0.32,
    travelSpeed: 0.29,
    route: [[19, 9], [9, 20], [-7, 21], [-20, 10], [-20, -7], [-8, -21], [10, -19], [21, -6]],
  },

  // — Eau profonde (rare et impressionnant) —
  { species: 'shark', center: [-82, 72], count: 1, radius: 25, depth: -1.5, seed: 83, scale: 0.42 }, // grand large nord-ouest
  {
    species: 'glow', center: [34, -66], count: 11, radius: 13, depth: -1.32, seed: 143,
    scale: 0.24, activity: 'night', travelSpeed: 0.25,
    route: [[34, -66], [18, -51], [4, -31], [18, -12], [40, -25], [46, -48]],
  },
  {
    species: 'glow', center: [-52, 54], count: 9, radius: 12, depth: -1.38, seed: 157,
    scale: 0.22, activity: 'night', travelSpeed: 0.23,
    route: [[-52, 54], [-31, 48], [-10, 36], [-17, 17], [-39, 25], [-62, 37]],
  },
];

export interface DeepZone {
  center: Vec2;
  radius: number;
  seed: number;
}

/** Couloirs profonds où circulent les raies (près du fond, loin des côtes). */
export const RAY_ZONES: DeepZone[] = [
  { center: [-8, 44], radius: 22, seed: 5 },
  { center: [44, -8], radius: 20, seed: 17 },
  { center: [17, 16], radius: 18, seed: 29 },
];

/** Errance des tortues : de larges boucles entre les îles, en solitaire. */
export const TURTLE_ZONES: DeepZone[] = [
  { center: [-30, 8], radius: 30, seed: 9 },
];

/** Poches à méduses : deux criques seulement, jamais tout l'océan. */
export const JELLYFISH_ZONES: DeepZone[] = [
  { center: [34, -66], radius: 9, seed: 21 }, // fosse au sud, près de Contact
  { center: [-52, 54], radius: 8, seed: 33 }, // crique entre Journey et Experience
];
