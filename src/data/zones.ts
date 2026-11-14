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

  // — Eau profonde (rare et impressionnant) —
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
  /** Individus dans la zone (1 par défaut). */
  count?: number;
}

/** Couloirs profonds où planent les raies manta (loin des côtes, à mi-eau). */
export const RAY_ZONES: DeepZone[] = [
  { center: [17, 16], radius: 16, seed: 29, count: 2 }, // un couple, près de l'îlot de départ
  { center: [-8, 44], radius: 20, seed: 5 },
  { center: [44, -8], radius: 18, seed: 17 },
];

/**
 * Lagons où glissent les tortues : chacune fait le tour d'une île à faible profondeur (eau
 * turquoise, fond visible), juste au-delà du haut-fond — rayon = orbite, en mètres.
 * `mobile: true` : gardée sur téléphone et en qualité basse.
 */
export interface TurtleLagoon {
  center: Vec2;
  radius: number;
  /** +1 sens trigonométrique, -1 sens horaire. */
  direction: 1 | -1;
  seed: number;
  mobile?: boolean;
}

export const TURTLE_LAGOONS: TurtleLagoon[] = [
  { center: [0, 0], radius: 12.4, direction: 1, seed: 9, mobile: true }, // îlot de départ
  { center: [0, 0], radius: 13.6, direction: -1, seed: 41 },
  { center: [-56, -30], radius: 20.6, direction: -1, seed: 63, mobile: true }, // À propos
  { center: [70, 26], radius: 26, direction: 1, seed: 77, mobile: true }, // Projets
  { center: [-22, 66], radius: 22.6, direction: -1, seed: 89 }, // Expériences
  { center: [52, -46], radius: 20.3, direction: 1, seed: 97 }, // Compétences
];

/** Poches à méduses : quelques criques seulement, jamais tout l'océan. */
export const JELLYFISH_ZONES: DeepZone[] = [
  { center: [14, 12], radius: 7, seed: 47, count: 7 }, // près de l'îlot de départ
  { center: [34, -66], radius: 9, seed: 21, count: 9 }, // fosse au sud, près de Contact
  { center: [-52, 54], radius: 8, seed: 33, count: 8 }, // crique entre Journey et Experience
];

/**
 * Requin : un aileron qui tourne autour d'une île lointaine (Contact, au sud). Le cercle est
 * décalé à l'écart de Compétences et loin du ponton ; l'ondulation (phase 0) l'écarte de
 * l'étoile d'or au nord-est.
 */
export interface SharkZone {
  center: Vec2;
  radius: number;
  /** Vitesse de croisière (m/s). */
  speed: number;
  direction: 1 | -1;
  phase: number;
  size: number;
  seed: number;
}

export const SHARK_ZONES: SharkZone[] = [
  { center: [14.5, -83.5], radius: 29.5, speed: 2.6, direction: -1, phase: 0, size: 1.15, seed: 83 },
];
