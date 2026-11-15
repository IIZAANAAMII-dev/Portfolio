import { BufferAttribute, BufferGeometry, Color, type ColorRepresentation } from 'three';
import { quad, seeded, smooth, type PaintShop, type Vec3 } from './build';

/**
 * Coque du bateau, lissée (« loftée ») à partir de sections transversales.
 *
 * Repère de navigation : +X vers la proue, +Y vers le haut, Y = 0 à la flottaison,
 * +Z à tribord. Mêmes encombrements que l'ancien modèle : 6,6 m hors tout, ~2 m de large.
 *
 * Chaque station u (0 = tableau arrière, 1 = étrave) est décrite par quelques lois :
 * livet (sheer), quille, demi-largeur au bouchain, évasement, rondeur des fonds. L'étrave
 * s'élance vers l'avant en montant, le tableau se couche vers l'arrière et se bombe.
 */
export const STERN_X = -3.05;
export const BOW_X = 2.8;
export const STATIONS = 56;
const GIRTH = 22;
/** Hauteur du bouchain : sous lui, les fonds arrondis ; au-dessus, la muraille. */
const BILGE_TOP = 0.06;
/** Épaisseur du pavois. */
export const WALL = 0.07;

export const stationX = (u: number) => STERN_X + u * (BOW_X - STERN_X);
export const stationU = (x: number) => (x - STERN_X) / (BOW_X - STERN_X);

/** Livet (dessus du pavois) : creux vers l'arrière du milieu, l'avant se relève franchement. */
export function sheer(u: number) {
  if (u < 0.38) {
    const s = (0.38 - u) / 0.38;
    return 0.88 + 0.1 * s * s;
  }
  return 0.88 + 0.72 * Math.pow((u - 0.38) / 0.62, 2.3);
}

/** Ligne de quille : la voûte arrière remonte vers le tableau, le pied d'étrave s'arrondit. */
export function keel(u: number) {
  if (u < 0.3) return -0.58 + 0.5 * Math.pow((0.3 - u) / 0.3, 1.6);
  if (u > 0.8) return -0.58 + 0.58 * Math.pow((u - 0.8) / 0.2, 1.6);
  return -0.58;
}

/** Demi-largeur au bouchain : pleine au milieu, arrière large, avant fin mais joufflu. */
export function beam(u: number) {
  if (u > 0.42) return Math.pow(Math.max(0, 1 - Math.pow((u - 0.42) / 0.58, 2.1)), 0.62);
  return 1 - 0.24 * Math.pow((0.42 - u) / 0.42, 1.8);
}

const flare = (u: number) => 0.03 + 0.16 * smooth(0.5, 1, u);
export const sheerBeam = (u: number) => beam(u) * (1 + flare(u));

/** Exposant de super-ellipse des fonds : en V à l'avant, ronds et pleins au milieu. */
function fullness(u: number) {
  return u < 0.45 ? 2.4 + 0.6 * smooth(0, 0.45, u) : 3 - 1.6 * smooth(0.45, 1, u);
}

/** Hauteur du pavois au-dessus du pont : plus haut à l'avant (protection des embruns). */
export const bulwarkHeight = (u: number) => 0.58 + 0.22 * smooth(0.55, 1, u);
export const deckHeight = (u: number) => sheer(u) - bulwarkHeight(u);

/** Abscisse d'un point de la station u : élan d'étrave, quête du tableau, tableau bombé. */
export function rakeX(u: number, y: number, z: number) {
  const b = Math.max(beam(u), 0.001);
  const bow = smooth(0.6, 1, u) * 0.3 * Math.max(y, 0);
  const stern = -0.22 * Math.max(y - keel(u), 0) * (1 - smooth(0, 0.14, u));
  const round = (1 - smooth(0, 0.1, u)) * 0.12 * Math.min((z / b) ** 2, 1.3);
  return stationX(u) + bow + stern + round;
}

/** Point de la demi-section tribord, t de 0 (quille) à 1 (livet). */
export function sectionPoint(u: number, t: number): Vec3 {
  const k = keel(u);
  const s = sheer(u);
  const b = beam(u);
  const bs = sheerBeam(u);
  const split = 0.56;
  let y: number;
  let z: number;
  if (t <= split) {
    const phi = (t / split) * (Math.PI / 2);
    const e = 2 / fullness(u);
    z = b * Math.pow(Math.sin(phi), e);
    y = BILGE_TOP - (BILGE_TOP - k) * Math.pow(Math.cos(phi), e);
  } else {
    const w = (t - split) / (1 - split);
    z = b + (bs - b) * Math.pow(w, 1.4);
    y = BILGE_TOP + (s - BILGE_TOP) * w;
  }
  return [rakeX(u, y, z), y, z];
}

/** Demi-largeur extérieure de la muraille à la hauteur y. */
export function sideAt(u: number, y: number) {
  const s = sheer(u);
  const b = beam(u);
  const w = Math.min(Math.max((y - BILGE_TOP) / (s - BILGE_TOP), 0), 1);
  return b + (sheerBeam(u) - b) * Math.pow(w, 1.4);
}

/** Demi-largeur intérieure (face interne du pavois). */
export const innerAt = (u: number, y: number) => Math.max(sideAt(u, y) - WALL, 0);

/**
 * Coordonnées dans la texture de peinture de la coque : u suit la hauteur (carène, liseré de
 * flottaison), v la profondeur sous le livet (préceinte blanche, coutures de bordé).
 */
export const PAINT_MAP = { yMin: -1, yRange: 3, depthRange: 1.4 };
function paintUv(u: number, y: number): [number, number] {
  return [
    (y - PAINT_MAP.yMin) / PAINT_MAP.yRange,
    Math.min(Math.max((sheer(u) - y) / PAINT_MAP.depthRange, 0), 0.999),
  ];
}

/** Bordé extérieur et tableau arrière : un seul maillage, normales lissées. */
export function hullShell() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = GIRTH + 1;
  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= STATIONS; i++) {
      const u = i / STATIONS;
      for (let j = 0; j <= GIRTH; j++) {
        const [x, y, z] = sectionPoint(u, j / GIRTH);
        positions.push(x, y, z * side);
        uvs.push(...paintUv(u, y));
      }
    }
    for (let i = 0; i < STATIONS; i++) {
      for (let j = 0; j < GIRTH; j++) {
        const a = base + i * rows + j;
        const b = a + rows;
        if (side > 0) indices.push(a, b, b + 1, a, b + 1, a + 1);
        else indices.push(a, b + 1, b, a, a + 1, b + 1);
      }
    }
  }

  // Tableau arrière : une grille bombée entre les deux bords de la station 0.
  const across = 12;
  const base = positions.length / 3;
  for (let j = 0; j <= GIRTH; j++) {
    const [, y, edge] = sectionPoint(0, j / GIRTH);
    for (let c = 0; c <= across; c++) {
      const z = edge * ((c / across) * 2 - 1);
      positions.push(rakeX(0, y, z), y, z);
      uvs.push(...paintUv(0, y));
    }
  }
  for (let j = 0; j < GIRTH; j++) {
    for (let c = 0; c < across; c++) {
      const a = base + j * (across + 1) + c;
      const b = a + across + 1;
      indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Texture de peinture de la coque (512 × 256), lue par hauteur et par profondeur sous le
 * livet : carène bleu nuit, liseré crème de flottaison souligné d'un filet, coque rouge,
 * coutures de bordé discrètes, préceinte blanche sous le plat-bord.
 */
export function hullPaintCanvas(colors: {
  hull: string;
  seam: string;
  antifouling: string;
  bootTop: string;
  pinstripe: string;
  strake: string;
}) {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const px = (y: number) => ((y - PAINT_MAP.yMin) / PAINT_MAP.yRange) * width;
  const py = (depth: number) => (depth / PAINT_MAP.depthRange) * height;
  ctx.fillStyle = colors.hull;
  ctx.fillRect(0, 0, width, height);
  const topsides = px(0.14);
  // Coutures du bordé : elles suivent le livet, comme les virures d'un vrai bateau.
  ctx.fillStyle = colors.seam;
  for (const depth of [0.34, 0.5, 0.66, 0.82]) ctx.fillRect(topsides, py(depth), width - topsides, 2);
  // Préceinte blanche et son filet.
  ctx.fillStyle = colors.strake;
  ctx.fillRect(topsides, py(0.085), width - topsides, py(0.19) - py(0.085));
  ctx.fillStyle = colors.pinstripe;
  ctx.fillRect(topsides, py(0.19), width - topsides, Math.max(2, py(0.205) - py(0.19)));
  // Carène, liseré de flottaison et filet.
  ctx.fillStyle = colors.antifouling;
  ctx.fillRect(0, 0, px(-0.02), height);
  ctx.fillStyle = colors.bootTop;
  ctx.fillRect(px(-0.02), 0, px(0.12) - px(-0.02), height);
  ctx.fillStyle = colors.pinstripe;
  ctx.fillRect(px(0.12), 0, Math.max(2, px(0.138) - px(0.12)), height);
  return canvas;
}

const shade = new Color();
function tone(color: ColorRepresentation, amount: number) {
  shade.set(color);
  return shade.offsetHSL(0, 0, amount).getHex();
}

/** Point du pont : planches droites, légère tonture transversale (bouge). */
function deckPoint(u: number, z: number, lift = 0): Vec3 {
  const y = deckHeight(u);
  const half = Math.max(innerAt(u, y), 0.001) + 0.03;
  const clamped = Math.max(-half, Math.min(half, z));
  const camber = 0.025 * (1 - Math.min(clamped ** 2, 1));
  const x = rakeX(u, y, clamped) + (u === 0 ? WALL : 0);
  return [x, y + camber + lift, clamped];
}

/**
 * Pont en planches : chaque virure est une bande indépendante, rognée par la muraille
 * (comme un pont « à l'anglaise » dont les planches meurent sur le pavois), posée sur un
 * fond sombre qui dessine les joints de calfatage. Teintes variées par planche et par about.
 */
export function addDeck(shop: PaintShop, wood: string[], caulk: string) {
  const plank = 0.155;
  const gap = 0.014;
  const count = 14;
  const start = -(count * plank) / 2;
  const planks: number[] = [];
  const colorAt: number[] = [];
  for (let k = 0; k < count; k++) {
    const z0 = start + k * plank + gap / 2;
    const z1 = start + (k + 1) * plank - gap / 2;
    // Abouts décalés d'une virure à l'autre.
    const butt = Math.floor(seeded(k * 3.1) * 9) + 5;
    for (let i = 0; i < STATIONS; i++) {
      const segment = Math.floor((i + butt) / 13);
      const base = wood[Math.floor(seeded(k * 7.7 + segment * 3.3) * wood.length)];
      const color = tone(base, (seeded(k * 1.9 + segment * 5.1) - 0.5) * 0.05);
      const quadAt = (u: number): [Vec3, Vec3] => {
        const half = innerAt(u, deckHeight(u)) + 0.03;
        const a = Math.max(z0, -half);
        const b = Math.min(z1, half);
        const lo = a < b ? a : Math.max(-half, Math.min(half, (z0 + z1) / 2));
        const hi = a < b ? b : lo;
        return [deckPoint(u, lo), deckPoint(u, hi)];
      };
      const [a0, b0] = quadAt(i / STATIONS);
      const [a1, b1] = quadAt((i + 1) / STATIONS);
      if (Math.abs(b0[2] - a0[2]) < 1e-4 && Math.abs(b1[2] - a1[2]) < 1e-4) continue;
      quad(planks, a0, a1, b1, b0);
      colorAt.push(color, color);
    }
  }
  shop.raw(planks, (_x, _y, _z, face) => colorAt[face] ?? caulk);

  // Fond de joints, un peu sous les planches.
  const under: number[] = [];
  for (let i = 0; i < STATIONS; i++) {
    const u0 = i / STATIONS;
    const u1 = (i + 1) / STATIONS;
    const h0 = innerAt(u0, deckHeight(u0)) + 0.03;
    const h1 = innerAt(u1, deckHeight(u1)) + 0.03;
    quad(under, deckPoint(u0, -h0, -0.012), deckPoint(u1, -h1, -0.012), deckPoint(u1, h1, -0.012), deckPoint(u0, h0, -0.012));
  }
  shop.raw(under, caulk);
}

/**
 * Pavois (face intérieure), plat-bord en bois verni et sa lisse arrière. La face extérieure
 * est le bordé lui-même ; l'épaisseur du pavois se lit sur le plat-bord.
 */
export function addBulwarks(shop: PaintShop, inside: string, rail: string) {
  const walls: number[] = [];
  const top: number[] = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < STATIONS; i++) {
      const u0 = i / STATIONS;
      const u1 = (i + 1) / STATIONS;
      const inner = (u: number, y: number): Vec3 => {
        const z = innerAt(u, y) * side;
        return [rakeX(u, y, z), y, z];
      };
      const d0 = deckHeight(u0) - 0.05;
      const d1 = deckHeight(u1) - 0.05;
      const s0 = sheer(u0);
      const s1 = sheer(u1);
      // Face intérieure, tournée vers l'axe du bateau.
      if (side > 0) quad(walls, inner(u0, d0), inner(u0, s0), inner(u1, s1), inner(u1, d1));
      else quad(walls, inner(u0, d0), inner(u1, d1), inner(u1, s1), inner(u0, s0));

      // Plat-bord : profil en U renversé (face externe, dessus, face interne).
      const profile = (u: number): Vec3[] => {
        const s = sheer(u);
        const outer = sheerBeam(u) + 0.03;
        const innerZ = Math.max(innerAt(u, s) - 0.025, 0);
        const point = (z: number, y: number): Vec3 => [rakeX(u, y, Math.min(z, sheerBeam(u))), y, z * side];
        return [point(outer, s - 0.035), point(outer, s + 0.045), point(innerZ, s + 0.045), point(innerZ, s - 0.035)];
      };
      const p0 = profile(u0);
      const p1 = profile(u1);
      for (let f = 0; f < 3; f++) {
        if (side > 0) quad(top, p0[f], p1[f], p1[f + 1], p0[f + 1]);
        else quad(top, p0[f], p0[f + 1], p1[f + 1], p1[f]);
      }
    }
  }

  // Tableau, côté intérieur, et lisse arrière bombée qui suit le tableau.
  const across = 12;
  const deck0 = deckHeight(0) - 0.05;
  const sheer0 = sheer(0);
  const half0 = innerAt(0, sheer0);
  const outer0 = sheerBeam(0) + 0.03;
  for (let c = 0; c < across; c++) {
    const z0 = half0 * ((c / across) * 2 - 1);
    const z1 = half0 * (((c + 1) / across) * 2 - 1);
    const at = (z: number, y: number, inset: number): Vec3 => [rakeX(0, y, z) + inset, y, z];
    quad(walls, at(z0, deck0, WALL), at(z1, deck0, WALL), at(z1, sheer0, WALL), at(z0, sheer0, WALL));

    const r0 = outer0 * ((c / across) * 2 - 1);
    const r1 = outer0 * (((c + 1) / across) * 2 - 1);
    const lip = (z: number, y: number, inset: number): Vec3 => [rakeX(0, y, Math.min(Math.abs(z), half0) * Math.sign(z)) + inset, y, z];
    const back = [lip(r0, sheer0 - 0.035, -0.03), lip(r0, sheer0 + 0.045, -0.03), lip(r0, sheer0 + 0.045, WALL + 0.025), lip(r0, sheer0 - 0.035, WALL + 0.025)];
    const next = [lip(r1, sheer0 - 0.035, -0.03), lip(r1, sheer0 + 0.045, -0.03), lip(r1, sheer0 + 0.045, WALL + 0.025), lip(r1, sheer0 - 0.035, WALL + 0.025)];
    for (let f = 0; f < 3; f++) quad(top, back[f], back[f + 1], next[f + 1], next[f]);
  }
  shop.raw(walls, inside);
  shop.raw(top, rail);
}

/**
 * Liston : baguette demi-ronde rapportée sur le bordé, sous la préceinte blanche, de la
 * poupe à l'étrave (où les deux bords se rejoignent). Elle accroche la lumière sur le dessus
 * et dessine un trait d'ombre net dessous : la coque gagne un relief que la peinture seule
 * n'a pas. Le filet peint de la texture passe dessous.
 */
export function addRubbingStrake(shop: PaintShop, color: string) {
  const faces: number[] = [];
  const depth = 0.2;
  const half = 0.026;
  const out = 0.032;
  for (const side of [1, -1]) {
    const profile = (u: number): Vec3[] => {
      const centre = sheer(u) - depth;
      const at = (y: number, lift: number): Vec3 => {
        const z = (sideAt(u, y) + lift) * side;
        return [rakeX(u, y, z), y, z];
      };
      return [at(centre + half + 0.014, 0), at(centre + half, out * 0.8), at(centre - half, out), at(centre - half - 0.016, 0)];
    };
    for (let i = 0; i < STATIONS; i++) {
      const p0 = profile(i / STATIONS);
      const p1 = profile((i + 1) / STATIONS);
      // Le profil descend le long du bordé : faces tournées vers l'extérieur.
      for (let f = 0; f < 3; f++) {
        if (side > 0) quad(faces, p0[f], p0[f + 1], p1[f + 1], p1[f]);
        else quad(faces, p0[f], p1[f], p1[f + 1], p0[f + 1]);
      }
    }
    // Bout coupé net contre le tableau (face vers l'arrière).
    const end = profile(0);
    if (side > 0) quad(faces, end[0], end[3], end[2], end[1]);
    else quad(faces, end[0], end[1], end[2], end[3]);
  }
  shop.raw(faces, color);
}

/** Quille et talon : un aileron sous la coque, devant l'hélice. */
export function addKeel(shop: PaintShop, color: string) {
  const fin: number[] = [];
  const from = 0.075;
  const to = 0.86;
  const steps = 24;
  const thickness = 0.045;
  for (let i = 0; i < steps; i++) {
    const u0 = from + ((to - from) * i) / steps;
    const u1 = from + ((to - from) * (i + 1)) / steps;
    const depth = (u: number) => 0.2 * (1 - smooth(0.55, to, u)) + 0.02;
    const pt = (u: number, y: number, z: number): Vec3 => [stationX(u), y, z];
    const k0 = keel(u0);
    const k1 = keel(u1);
    for (const side of [1, -1]) {
      const z = thickness * side;
      const a = pt(u0, k0 + 0.06, z);
      const b = pt(u0, k0 - depth(u0), z);
      const c = pt(u1, k1 - depth(u1), z);
      const d = pt(u1, k1 + 0.06, z);
      if (side > 0) quad(fin, a, b, c, d);
      else quad(fin, a, d, c, b);
    }
    quad(fin, pt(u0, k0 - depth(u0), thickness), pt(u0, k0 - depth(u0), -thickness), pt(u1, k1 - depth(u1), -thickness), pt(u1, k1 - depth(u1), thickness));
  }
  // Talon arrière (face plate devant l'hélice).
  const k = keel(from);
  const d = 0.2 + 0.02;
  quad(fin, [stationX(from), k + 0.06, thickness], [stationX(from), k - d, thickness], [stationX(from), k - d, -thickness], [stationX(from), k + 0.06, -thickness]);
  shop.raw(fin, color);
}

/**
 * Masque d'eau : surface invisible (profondeur seule) tendue juste sous le plat-bord.
 * Dessinée avant l'océan, elle empêche la houle d'apparaître à l'intérieur de la coque
 * quand le bateau tangue (le pont n'est qu'à 30 cm au-dessus de la flottaison).
 */
export function waterMask() {
  const positions: number[] = [];
  for (let i = 0; i < STATIONS; i++) {
    const u0 = i / STATIONS;
    const u1 = (i + 1) / STATIONS;
    const at = (u: number, side: number): Vec3 => {
      const y = sheer(u) - 0.07;
      const z = innerAt(u, y) * side;
      return [rakeX(u, y, z) + (u === 0 ? WALL : 0), y, z];
    };
    quad(positions, at(u0, -1), at(u1, -1), at(u1, 1), at(u0, 1));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeBoundingSphere();
  return geometry;
}
