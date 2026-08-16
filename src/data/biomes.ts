import type { Vec2 } from '@/types';

export type ReefBiome = {
  center: Vec2;
  radius: number;
  seed: number;
  coral: number;
  grass: number;
};

/** Zones composees a la main : aucune decoration n'est jetee partout au hasard. */
export const REEF_BIOMES: ReefBiome[] = [
  { center: [-36, -20], radius: 16, seed: 12, coral: 10, grass: 34 },
  { center: [36, -30], radius: 18, seed: 31, coral: 12, grass: 30 },
  { center: [48, 30], radius: 17, seed: 73, coral: 11, grass: 26 },
  { center: [-52, 16], radius: 15, seed: 57, coral: 9, grass: 32 },
];

export const SEAGRASS_BIOMES = [
  { center: [-12, -22] as Vec2, radius: 12, seed: 101, count: 72 },
  { center: [26, -52] as Vec2, radius: 10, seed: 113, count: 58 },
  { center: [-38, 50] as Vec2, radius: 11, seed: 127, count: 64 },
];

export const WRECK_SITES = [
  { center: [31, -65] as Vec2, rotation: 0.62, scale: 1.15, seed: 211, kind: 'ship' as const },
  { center: [-48, 47] as Vec2, rotation: -1.1, scale: 0.82, seed: 223, kind: 'boat' as const },
];

/** Points de repos littoraux : pontons, plages et rochers, jamais le grand large. */
export const GULL_ROOSTS: [number, number, number][] = [
  [-7, 1.5, 3.5], [7.4, 1.3, -1.5],
  [-43, 1.5, -22], [-67, 2.3, -34],
  [42, 1.2, -39], [61, 2.1, -50],
  [54, 1.7, 24], [84, 3.2, 31],
  [-29, 2.2, 54], [-13, 2.8, 76],
  [-59, 1.4, 19], [-83, 2.6, 35],
  [12, 1.1, -70], [21, 1.6, -92],
];
