/**
 * ÎLE EXPÉRIENCES — plan de La Ciotat (repère local de l'île : x vers l'est, z vers le sud,
 * le ponton part au nord-nord-est, angle -1,27).
 *
 * Tout ce qui fixe le relief vit ici, sans dépendance : `sculpt` (config.ts) creuse le port,
 * aplanit le chantier naval et les terre-pleins, taille les escaliers et dresse le Bec de
 * l'Aigle ; le décor (Scene.tsx) relit les mêmes repères pour s'y poser exactement.
 *
 *   nord (ponton)  : le petit port aux pointus, au pied du Bec de l'Aigle
 *   nord-ouest     : le Bec de l'Aigle, falaise de poudingue au bec crochu
 *   ouest          : le chantier naval, son portique géant et un yacht en carénage
 *   sommet         : l'atelier Feeder SAS – EIZO France (poste actuel)
 *   est            : le chemin des années : GRETA puis RG Design
 */

/** Repère tourné : u vers le large (angle donné), v dans le sens des angles croissants. */
export interface Frame {
  ax: number;
  az: number;
  tx: number;
  tz: number;
}

export function frame(angle: number): Frame {
  return { ax: Math.cos(angle), az: Math.sin(angle), tx: -Math.sin(angle), tz: Math.cos(angle) };
}

export function toWorld(f: Frame, u: number, v: number): [number, number] {
  return [u * f.ax + v * f.tx, u * f.az + v * f.tz];
}

function toLocal(f: Frame, x: number, z: number): [number, number] {
  return [x * f.ax + z * f.az, x * f.tx + z * f.tz];
}

export function polar(angle: number, radius: number): [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Poids d'un intervalle aux bords adoucis (1 dedans, 0 au-delà de `blend`). */
function band(x: number, from: number, to: number, blendIn: number, blendOut = blendIn) {
  return smooth(from - blendIn, from, x) * (1 - smooth(to, to + blendOut, x));
}

/* ------------------------------------------------------------------ repères */

/** Le port : quai au pied de la falaise, bassin creusé entre le Bec et le ponton. */
export const HARBOR = {
  frame: frame(-1.72),
  quay: { from: 11.9, to: 13.1, left: -3.4, right: 4.6, y: 0.95 },
  basin: { from: 13.3, left: -9.5, right: 3.4, y: -1.15 },
  /** Bateaux amarrés perpendiculairement au quai (abscisse v), poupe au quai. */
  moorings: [-1.9, 0.35, 2.5],
};

/** Escalier taillé dans la falaise : du quai au plateau (repère du port). */
export const HARBOR_STAIRS = { from: [12.45, 1.3] as const, to: [10.25, 5.15] as const, halfWidth: 0.62 };

/** Chantier naval : terre-plein bétonné, cale de halage, rails du portique. */
export const YARD = {
  frame: frame(-3.0),
  apron: { from: 10.4, to: 17.4, half: 4.6, y: 1.0 },
  slip: { from: 16.8, to: 21, half: 1.6, y0: 1.0, y1: -1.5 },
  /** Jambes du portique de part et d'autre du yacht (v), et leur course (u). */
  legs: 3.75,
  span: [10.9, 17.0] as const,
};

/** Bec de l'Aigle : dos qui monte depuis le plateau, tête en falaise, bec vers le port. */
export const BEC = {
  back: [-6.6, -6.4] as const,
  head: [-7.8, -11.46] as const,
  backY: 5.4,
  headY: 12.6,
  headRadius: 2.9,
  /** Direction du bec (angle) : vers le nord, au-dessus du port. */
  beak: -1.5,
};

/** Terre-pleins des bâtiments. */
export const OFFICE = { x: -1.3, z: -0.1, radius: 3.9, y: 7.72, front: -0.75 };
export const GRETA = { at: [3.8, -7.4] as const, radius: 2.6, y: 4.22, front: -0.15 };
export const RG = { at: [7.3, 3.26] as const, radius: 2.3, y: 4.24, front: -0.75 };

/** Chemin des années : du haut de l'escalier du port à GRETA, au pied du sommet, puis à RG Design. */
export const PATH: readonly (readonly [number, number])[] = [
  [3.9, -10.5],
  [5.0, -9.4],
  [6.3, -7.5],
  [6.6, -5.2],
  [5.85, -3.55],
  [7.0, -1.3],
  [7.95, 0.75],
  [8.5, 2.1],
];

/** Escalier du sommet : du chemin (plateau) au parvis de l'atelier. */
export const SUMMIT_STAIRS = { from: [5.6, -3.4] as const, to: [2.4, -1.6] as const, halfWidth: 0.7, y0: 4.22 };

/* ------------------------------------------------------------------- relief */

function pad(height: number, x: number, z: number, cx: number, cz: number, radius: number, blend: number, y: number) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > radius + blend) return height;
  return height + (y - height) * (1 - smooth(radius, radius + blend, d));
}

/** Rampe rectiligne (escalier) : hauteur interpolée entre ses deux extrémités. */
function ramp(
  height: number,
  x: number,
  z: number,
  [ax, az]: readonly [number, number],
  [bx, bz]: readonly [number, number],
  y0: number,
  y1: number,
  halfWidth: number,
) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  const along = ((x - ax) * dx + (z - az) * dz) / length;
  const across = Math.abs(((x - ax) * dz - (z - az) * dx) / length);
  const weight = band(along, 0, length, 0.25, 0.25) * (1 - smooth(halfWidth, halfWidth + 0.35, across));
  if (weight <= 0) return height;
  const t = Math.min(1, Math.max(0, along / length));
  return height + (y0 + (y1 - y0) * t - height) * weight;
}

/** Hauteur du Bec de l'Aigle seul (ou -100 hors de son emprise). */
export function becHeight(x: number, z: number) {
  const [hx, hz] = BEC.head;
  // Tête : dôme rond, bord en falaise presque verticale, contour irrégulier.
  const dx = x - hx;
  const dz = z - hz;
  const d = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const rim = BEC.headRadius * (1 + Math.sin(angle * 3 + 0.7) * 0.09 + Math.sin(angle * 5 - 1.3) * 0.05);
  const head = d < rim
    ? BEC.headY - (d / rim) ** 2 * 0.95
    : BEC.headY - 0.95 - (d - rim) * 9;
  // Dos : arête qui descend vers le plateau, plus large et plus basse vers l'arrière.
  const [bx, bz] = BEC.back;
  const ex = hx - bx;
  const ez = hz - bz;
  const length = Math.hypot(ex, ez);
  const s = ((x - bx) * ex + (z - bz) * ez) / (length * length);
  // Au-delà de la tête : plus d'arête, seulement la falaise du dôme.
  if (s > 1) return head;
  const t = Math.max(0, s);
  const across = Math.abs(((x - bx) * ez - (z - bz) * ex) / length);
  const halfWidth = 2.3 - t * 0.5;
  // En arrière du dos, l'arête continue de descendre et se fond dans le plateau.
  const crest = s >= 0
    ? BEC.backY + (BEC.headY - 0.6 - BEC.backY) * t ** 1.35
    : BEC.backY + s * length * 0.9;
  const ridge = across < halfWidth
    ? crest - (across / halfWidth) ** 2 * 0.8
    : crest - 0.8 - (across - halfWidth) * 6;
  return Math.max(head, ridge);
}

/**
 * Relief de l'île : appelé pour chaque sommet du terrain, chaque touffe d'herbe et chaque
 * `on()`. Que des opérations locales, sans allocation.
 */
export function sculptExperience(x: number, z: number, base: number) {
  let height = base;

  // Terre-pleins : parvis de l'atelier au sommet, cours de GRETA et de RG Design.
  height = pad(height, x, z, OFFICE.x, OFFICE.z, OFFICE.radius, 1.3, OFFICE.y);
  height = pad(height, x, z, GRETA.at[0], GRETA.at[1], GRETA.radius, 1.1, GRETA.y);
  height = pad(height, x, z, RG.at[0], RG.at[1], RG.radius, 1.1, RG.y);

  // Escalier du sommet, taillé dans la seconde falaise.
  height = ramp(height, x, z, SUMMIT_STAIRS.from, SUMMIT_STAIRS.to, SUMMIT_STAIRS.y0, OFFICE.y, SUMMIT_STAIRS.halfWidth);

  // Port : quai plat au pied de la falaise, bassin creusé jusqu'au large.
  {
    const [u, v] = toLocal(HARBOR.frame, x, z);
    const { quay, basin } = HARBOR;
    const quayWeight = band(u, quay.from, quay.to, 0.3, 0.12) * band(v, quay.left, quay.right, 0.5, 0.7);
    height += (quay.y - height) * quayWeight;
    const dig = smooth(basin.from - 0.18, basin.from, u) * band(v, basin.left, basin.right, 0.6, 0.6);
    if (dig > 0) height = Math.min(height, height + (basin.y - height) * dig);
  }
  {
    const [ax, az] = toWorld(HARBOR.frame, HARBOR_STAIRS.from[0], HARBOR_STAIRS.from[1]);
    const [bx, bz] = toWorld(HARBOR.frame, HARBOR_STAIRS.to[0], HARBOR_STAIRS.to[1]);
    height = ramp(height, x, z, [ax, az], [bx, bz], HARBOR.quay.y, 4.24, HARBOR_STAIRS.halfWidth);
  }

  // Chantier naval : terre-plein au ras du quai, cale de halage qui plonge dans la mer.
  {
    const [u, v] = toLocal(YARD.frame, x, z);
    const { apron, slip } = YARD;
    const apronWeight = band(u, apron.from, apron.to, 0.38, 0.3) * band(v, -apron.half, apron.half, 0.7, 0.7);
    height += (apron.y - height) * apronWeight;
    const slipWeight = band(u, slip.from, slip.to, 0.2, 0.5) * band(v, -slip.half, slip.half, 0.25, 0.25);
    if (slipWeight > 0) {
      const t = Math.min(1, Math.max(0, (u - slip.from) / (slip.to - slip.from)));
      height += (slip.y0 + (slip.y1 - slip.y0) * t - height) * slipWeight;
    }
  }

  // Bec de l'Aigle : la falaise sort de l'eau du port.
  return Math.max(height, becHeight(x, z));
}
