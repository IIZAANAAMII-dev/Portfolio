import { skillZones } from '@/data/skills';
import type { IslandId, SkillLevel, SkillZoneId } from '@/types';

/**
 * « La pêche aux compétences » : données et réglages, sans React ni three.js.
 *
 * Six coins de pêche, un près de chaque île, choisis loin des cercles de collision, des
 * pontons, des étoiles d'or, des bouées et des secrets (coordonnées monde x, z). Chaque
 * poisson pêché est une technologie du labo (src/data/skills.ts) : une prise de chacune
 * des six zones vaut le tampon « Pêche miraculeuse ».
 */

export interface FishingSpot {
  x: number;
  z: number;
  /** Île voisine (pour situer le coin dans les textes). */
  island: IslandId;
}

export const SPOTS: FishingSpot[] = [
  { x: -70, z: -6, island: 'about' },
  { x: 24, z: -47, island: 'skills' },
  { x: 64, z: -5, island: 'projects' },
  { x: 2, z: 51, island: 'experience' },
  { x: -44, z: 43, island: 'journey' },
  { x: -6, z: -70, island: 'contact' },
];

/** Rayon du cercle de bouillons (m). */
export const SPOT_RADIUS = 3.2;
/** Distance bateau ↔ centre du coin sous laquelle on peut pêcher (m). */
export const FISHING_RANGE = 10.5;
/** En deçà, le coin est « en vue » : l'interface invite à s'y arrêter (m). */
export const APPROACH_RANGE = 30;
/** Vitesse sous laquelle le bateau est considéré « presque arrêté » (m/s). */
export const STOP_SPEED = 0.9;
/** Poissons par coin avant qu'il ne se repose. */
export const STOCK = 3;
/** Temps de repos d'un coin vidé (s). */
export const REFILL_SECONDS = 75;

/** Durées du mini-jeu (s). */
export const CAST_SECONDS = 0.95;
export const BITE_MIN = 2.4;
export const BITE_MAX = 6.4;
/** Fenêtre pour ferrer après la touche : plus large au doigt (latence, précision). */
export const STRIKE_WINDOW = 1.15;
export const STRIKE_WINDOW_TOUCH = 1.45;
export const REEL_SECONDS = 1.45;

/** Le bouchon s'éloigne du bord : entre ces deux distances du centre du bateau (m). */
export const CAST_MIN = 4.2;
export const CAST_MAX = 7.5;

export type MissKind = 'early' | 'late';

/** Le ton du site : un peu d'humour, sans se moquer du visiteur. */
export const JOKES: Record<MissKind, string[]> = {
  early: [
    'Trop tôt\u202f! Il lisait encore la documentation.',
    'Ferré dans le vide… même les mouettes rigolent.',
    'Trop pressé\u00a0: il a vu l’hameçon arriver de loin.',
  ],
  late: [
    'Trop tard\u202f! Il est reparti avec l’appât.',
    'Il a filé plus vite qu’un hotfix du vendredi soir.',
    'Envolé\u202f! Il a dû partir en pause café.',
  ],
};

export interface Catch {
  zone: SkillZoneId;
  name: string;
  level: SkillLevel;
}

export type Basket = Partial<Record<SkillZoneId, string[]>>;

export const ZONE_IDS = skillZones.map((zone) => zone.id);

/** Zones déjà représentées dans la bourriche. */
export function zonesCaught(basket: Basket) {
  return ZONE_IDS.filter((id) => (basket[id]?.length ?? 0) > 0);
}

/**
 * Tire une prise : les zones absentes de la bourriche sortent quatre fois plus souvent
 * (la collection avance sans frustration), et dans une zone on préfère une technologie
 * pas encore pêchée.
 */
export function pickCatch(basket: Basket, random: () => number = Math.random): Catch {
  const weights = skillZones.map((zone) => ((basket[zone.id]?.length ?? 0) > 0 ? 1 : 4));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  let zoneIndex = 0;
  for (; zoneIndex < weights.length - 1; zoneIndex++) {
    roll -= weights[zoneIndex];
    if (roll < 0) break;
  }
  const zone = skillZones[zoneIndex];
  const known = basket[zone.id] ?? [];
  const fresh = zone.items.filter((item) => !known.includes(item.name));
  const pool = fresh.length > 0 ? fresh : zone.items;
  const item = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { zone: zone.id, name: item.name, level: item.level };
}

export function levelLabel(level: SkillLevel) {
  return level === 'pro' ? 'Utilisé dans mon travail' : 'En exploration';
}

/** Coin de pêche le plus proche du point (index, distance). */
export function nearestSpot(x: number, z: number) {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < SPOTS.length; index++) {
    const distance = Math.hypot(SPOTS[index].x - x, SPOTS[index].z - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return { index: best, distance: bestDistance };
}

/** Horloge commune du DOM et de la 3D (secondes) : les deux lisent les mêmes instants. */
export function clockNow() {
  return performance.now() / 1000;
}
