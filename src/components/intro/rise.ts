import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { yellowStaticIsland } from '@/data/yellow-static';
import { frontSeconds } from '@/lib/cinematic';

/**
 * Ordre et rythme du surgissement des îles pendant la cinématique d'ouverture.
 *
 * Les îles ne montent pas toutes ensemble au passage de l'onde (elles sont presque à la même
 * distance du bateau) : un balayage tourne autour du bateau, de l'arrière gauche à l'arrière
 * droit, en même temps que la caméra panote de gauche à droite. Chaque île surgit quand le
 * balayage la touche, jamais avant que l'onde de lumière n'ait atteint son rivage. Les îles
 * visibles à l'écran se lèvent donc l'une après l'autre, dans le sens du regard.
 */
export interface RiseSlot {
  id: string;
  x: number;
  z: number;
  radius: number;
  /** Rayon d'emprise pour le « pop » des objets (voir pop.ts). */
  footprint: number;
  /** Instant (s depuis le clic) où l'île commence à monter. */
  start: number;
  /** Vrai si l'île monte d'elle-même (îles et îlots) ; faux pour celles qui gardent leur révélation. */
  rises: boolean;
}

/** Début et durée du balayage (s depuis le clic) : un tour complet autour du bateau. */
export const SWEEP_FROM = 1.6;
export const SWEEP_SPAN = 3.0;

/** Relèvement (rad, monde) du faisceau de balayage `seconds` après le clic. */
export function sweepBearing(seconds: number, heading: number) {
  return heading - Math.PI + ((seconds - SWEEP_FROM) / SWEEP_SPAN) * Math.PI * 2;
}

interface Schedule {
  key: string;
  slots: RiseSlot[];
  byId: Map<string, RiseSlot>;
}

let cache: Schedule | null = null;
const cachedFor = { x: Number.NaN, z: Number.NaN, heading: Number.NaN };

/** Programme du surgissement, pour un bateau en (cx, cz) et un cap donnés (mis en cache). */
export function riseSchedule(cx: number, cz: number, heading: number): Schedule {
  if (cache && cachedFor.x === cx && cachedFor.z === cz && cachedFor.heading === heading) return cache;
  cachedFor.x = cx;
  cachedFor.z = cz;
  cachedFor.heading = heading;
  const key = `${cx.toFixed(2)}|${cz.toFixed(2)}|${heading.toFixed(3)}`;
  if (cache && cache.key === key) return cache;
  const slots: RiseSlot[] = [];
  const swept = (x: number, z: number, radius: number) => {
    const distance = Math.hypot(x - cx, z - cz);
    let relative = Math.atan2(z - cz, x - cx) - heading;
    relative = Math.atan2(Math.sin(relative), Math.cos(relative));
    const sweep = SWEEP_FROM + ((relative + Math.PI) / (Math.PI * 2)) * SWEEP_SPAN;
    return Math.max(sweep, frontSeconds(distance - radius * 0.45) + 0.05);
  };

  // L'îlot de départ garde sa révélation (au passage de l'onde, juste après l'éclaboussure).
  const [hx, hz] = homeIsland.position;
  slots.push({
    id: 'home',
    x: hx,
    z: hz,
    radius: homeIsland.radius,
    // Emprise serrée : le bateau, amarré au bout du ponton, ne doit pas « popper » avec l'îlot.
    footprint: homeIsland.radius * 1.5,
    start: frontSeconds(Math.hypot(hx - cx, hz - cz) - 4.5),
    rises: false,
  });
  for (const island of islands) {
    const [x, z] = island.position;
    slots.push({ id: island.id, x, z, radius: island.radius, footprint: island.radius * 1.45, start: swept(x, z, island.radius), rises: true });
  }
  for (const islet of islets) {
    const [x, z] = islet.position;
    slots.push({ id: `islet:${islet.id}`, x, z, radius: islet.radius, footprint: islet.radius * 1.5, start: swept(x, z, islet.radius), rises: true });
  }
  const [sx, sz] = yellowStaticIsland.position;
  slots.push({
    id: 'static',
    x: sx,
    z: sz,
    radius: yellowStaticIsland.radius,
    footprint: yellowStaticIsland.radius * 1.5,
    start: frontSeconds(Math.hypot(sx - cx, sz - cz) - 4.5),
    rises: false,
  });

  cache = { key, slots, byId: new Map(slots.map((slot) => [slot.id, slot])) };
  return cache;
}

/** Pose d'une île qui surgit, `tau` secondes après le début de sa montée. */
export interface RisePose {
  visible: boolean;
  y: number;
  /** Étirement vertical (squash & stretch) et compensation horizontale (volume conservé). */
  sy: number;
  sxz: number;
  tiltX: number;
  tiltZ: number;
}

/** Durée après laquelle l'île est exactement au repos. */
export const RISE_SETTLE = 1.7;

// Ressort amorti : ω = 6,4 rad/s, ζ = 0,56 (dépassement ≈ 12 %, un seul rebond lisible).
const OMEGA = 6.4;
const DECAY = 0.56 * OMEGA;
const DAMPED = OMEGA * Math.sqrt(1 - 0.56 * 0.56);
const RATIO = DECAY / DAMPED;

export function risePose(tau: number, depth: number, seed: number, out: RisePose): RisePose {
  if (tau < 0) {
    out.visible = false;
    out.y = -depth;
    out.sy = 1;
    out.sxz = 1;
    out.tiltX = 0;
    out.tiltZ = 0;
    return out;
  }
  out.visible = true;
  if (tau >= RISE_SETTLE) {
    out.y = 0;
    out.sy = 1;
    out.sxz = 1;
    out.tiltX = 0;
    out.tiltZ = 0;
    return out;
  }
  const envelope = Math.exp(-DECAY * tau);
  const cosine = Math.cos(DAMPED * tau);
  const sine = Math.sin(DAMPED * tau);
  // Réponse indicielle : 0 → 1 avec un dépassement, puis le repos.
  const response = 1 - envelope * (cosine + RATIO * sine);
  // Vitesse normalisée (÷ ω) : elle étire l'île pendant la poussée, l'écrase à la retombée.
  const velocity = (envelope * (OMEGA / DAMPED) * sine);
  // Fondu final : aucune discontinuité au passage au repos.
  const settle = 1 - Math.min(1, Math.max(0, (tau - (RISE_SETTLE - 0.35)) / 0.35));
  out.y = -depth * (1 - response) * settle;
  const stretch = 1 + 0.3 * velocity * settle;
  out.sy = stretch;
  out.sxz = 1 / Math.sqrt(stretch);
  // Un peu de roulis, comme un bouchon qui remonte : il s'éteint en trois oscillations.
  const wobble = Math.exp(-3.1 * tau) * settle;
  out.tiltX = 0.045 * wobble * Math.sin(8.4 * tau + seed);
  out.tiltZ = 0.04 * wobble * Math.sin(7.1 * tau + seed * 1.7);
  return out;
}
