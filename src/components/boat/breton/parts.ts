import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { PaintShop, quad, seeded, type Paint, type Vec3 } from './build';
import {
  addBulwarks,
  addDeck,
  addKeel,
  addRubbingStrake,
  deckHeight,
  hullShell,
  rakeX,
  sheer,
  sideAt,
  stationU,
  waterMask,
} from './hull';

/** Palette du bateau : coque rouge, timonerie blanche, bois blond, touches bleu marine. */
export const BOAT_COLORS = {
  hull: '#c33e2c',
  hullSeam: '#ad3324',
  antifouling: '#23384c',
  bootTop: '#f3ead6',
  pinstripe: '#1f3348',
  strake: '#f5efe2',
  inside: '#ece5d6',
  rail: '#9a5b33',
  wood: ['#c99659', '#c18c51', '#d1a066', '#bd8a52', '#cb9a62'],
  caulk: '#4a3121',
  white: '#f6f1e6',
  roof: '#e9e2d3',
  navy: '#2c4862',
  navyDark: '#1d2f42',
  black: '#25272b',
  steel: '#8e9aa1',
  rope: '#d6b97c',
  tire: '#33363c',
  orange: '#ee7a2c',
  crate: '#2f73b5',
  crateLight: '#3c86c9',
  net: '#3d6d58',
  netDark: '#2f4d47',
  potWood: '#9c6b3e',
  bronze: '#c99a4a',
  red: '#d4473a',
  fish: '#a9bccb',
} as const;

const C = BOAT_COLORS;
const deg = Math.PI / 180;

/** Hauteur du pont (dessus des planches) à l'abscisse x, à la distance z de l'axe. */
export const deckAt = (x: number, z = 0) => deckHeight(stationU(x)) + 0.025 * (1 - Math.min(z * z, 1));

/* ------------------------------------------------------------------ Timonerie */

/** Polygones au sol et au plafond : avant à pans coupés et vitres « renversées », flancs rentrants. */
const HOUSE_BASE = 0.22;
const HOUSE_TOP = 2.08;
export const ROOF_TOP = 2.17;
const SILL = 1.36;
const HEAD = 1.86;
const HOUSE_FOOT: [number, number][] = [
  [0, -0.68], [0, 0.68], [1.32, 0.68], [1.62, 0.38], [1.62, -0.38], [1.32, -0.68],
];
const HOUSE_HEAD: [number, number][] = [
  [0.02, -0.64], [0.02, 0.64], [1.44, 0.64], [1.72, 0.36], [1.72, -0.36], [1.44, -0.64],
];
/** Faces : 0 arrière, 1 tribord, 2 pan avant tribord, 3 avant, 4 pan avant bâbord, 5 bâbord. */
const FACE_LENGTH = [1.36, 1.32, 0.42, 0.76, 0.42, 1.32];

/** Points d'ancrage exportés (repère de navigation : +X proue, Y = 0 flottaison, +Z tribord). */
export const ANCHORS = {
  /** Sortie de la cheminée (fumée). */
  stackTip: [0.24, 3.0, -0.46] as Vec3,
  /** Tête de mât : le Gwenn-ha-Du y est frappé. */
  masthead: [1.12, 3.56, 0] as Vec3,
  /** Projecteur de pont (lumière ponctuelle de nuit). */
  workLight: [-0.08, 2.02, 0] as Vec3,
  /** Pieds du patron, au poste de barre arrière. */
  captain: [-0.66, deckAt(-0.66, 0.3), 0.3] as Vec3,
  /** Moyeu de la barre à roue, relatif aux pieds du patron. */
  wheel: [0.49, 0.73, 0] as Vec3,
  radar: [0.55, 2.36, 0] as Vec3,
  propeller: [-2.8, -0.38, 0] as Vec3,
  rudder: [-2.98, -0.1, 0] as Vec3,
  /** Taquet avant tribord (amarre lancée au ponton). */
  bowCleat: [2.3, deckAt(2.3) + 0.5, 0.5] as Vec3,
};

/** Point d'une face de la timonerie : s le long de la face, y la hauteur, `out` vers l'extérieur. */
function houseFace(index: number) {
  const next = (index + 1) % HOUSE_FOOT.length;
  const [bx0, bz0] = HOUSE_FOOT[index];
  const [bx1, bz1] = HOUSE_FOOT[next];
  const [tx0, tz0] = HOUSE_HEAD[index];
  const [tx1, tz1] = HOUSE_HEAD[next];
  // Le polygone tourne dans le sens qui met la normale (arête × verticale) à l'extérieur.
  const ex = bx1 - bx0;
  const ez = bz1 - bz0;
  const length = Math.hypot(ex, ez) || 1;
  const nx = -ez / length;
  const nz = ex / length;
  return (s: number, y: number, out = 0): Vec3 => {
    const t = (y - HOUSE_BASE) / (HOUSE_TOP - HOUSE_BASE);
    const x = (bx0 + ex * s) * (1 - t) + (tx0 + (tx1 - tx0) * s) * t;
    const z = (bz0 + ez * s) * (1 - t) + (tz0 + (tz1 - tz0) * s) * t;
    return [x + nx * out, y, z + nz * out];
  };
}

/** Rectangle posé sur une face de la timonerie, décollé de `lift` (vitre, cadre, porte). */
function onFace(out: number[], index: number, s0: number, s1: number, y0: number, y1: number, lift: number) {
  const at = houseFace(index);
  quad(out, at(s0, y0, lift), at(s1, y0, lift), at(s1, y1, lift), at(s0, y1, lift));
}

/* ------------------------------------------------------------------ Outils */

/** Prisme à facettes entre deux polygones convexes (même nombre de sommets). */
function prism(foot: [number, number][], head: [number, number][], y0: number, y1: number, capTop = true) {
  const positions: number[] = [];
  const centre = new Vector3();
  foot.forEach(([x, z]) => centre.add(new Vector3(x, (y0 + y1) / 2, z)));
  centre.divideScalar(foot.length);
  const ab = new Vector3();
  const ac = new Vector3();
  const mid = new Vector3();
  const face = (a: Vec3, b: Vec3, c: Vec3) => {
    ab.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    ac.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    mid.set((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3).sub(centre);
    if (ab.cross(ac).dot(mid) >= 0) positions.push(...a, ...b, ...c);
    else positions.push(...a, ...c, ...b);
  };
  for (let index = 0; index < foot.length; index++) {
    const next = (index + 1) % foot.length;
    const a: Vec3 = [foot[index][0], y0, foot[index][1]];
    const b: Vec3 = [foot[next][0], y0, foot[next][1]];
    const c: Vec3 = [head[next][0], y1, head[next][1]];
    const d: Vec3 = [head[index][0], y1, head[index][1]];
    face(a, b, c);
    face(a, c, d);
  }
  if (capTop) {
    for (let index = 1; index < head.length - 1; index++) {
      face([head[0][0], y1, head[0][1]], [head[index][0], y1, head[index][1]], [head[index + 1][0], y1, head[index + 1][1]]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

const UP = new Vector3(0, 1, 0);

/** Cylindre tendu entre deux points (haubans, étai, hampe). */
function rod(shop: PaintShop, from: Vector3, to: Vector3, radius: number, paint: Paint, sides = 4) {
  const direction = to.clone().sub(from);
  const geometry = new CylinderGeometry(radius, radius, direction.length(), sides);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(UP, direction.normalize()));
  const mid = from.clone().add(to).multiplyScalar(0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  shop.add(geometry, paint);
}

/* ------------------------------------------------------------------ Assemblage */

export type BoatGeometries = ReturnType<typeof buildBoatGeometries>;

/**
 * Tout le bateau en quelques maillages : coque (texture de peinture), « peinture » (le reste
 * du statique, couleurs par sommet), vitres (s'allument la nuit), feux de navigation, plus
 * les pièces animées (radar, hélice, safran) et le masque d'eau.
 */
export function buildBoatGeometries() {
  const shop = new PaintShop();

  /* --- Coque : pavois, plat-bord, liston, pont, quille. */
  addBulwarks(shop, C.inside, C.rail);
  addRubbingStrake(shop, C.pinstripe);
  addDeck(shop, [...C.wood], C.caulk);
  addKeel(shop, C.antifouling);

  // Sabords de décharge : trois fentes sombres au ras du pont, de chaque bord.
  const scuppers: number[] = [];
  for (const x of [-2.55, -1.75, -0.95]) {
    const u = stationU(x);
    const y0 = deckHeight(u) + 0.03;
    const y1 = y0 + 0.07;
    for (const side of [1, -1]) {
      const z0 = (sideAt(u, y0) + 0.006) * side;
      const z1 = (sideAt(u, y1) + 0.006) * side;
      const xa = rakeX(u, y0, z0) - 0.09;
      const xb = rakeX(u, y0, z0) + 0.09;
      if (side > 0) quad(scuppers, [xa, y0, z0], [xb, y0, z0], [xb, y1, z1], [xa, y1, z1]);
      else quad(scuppers, [xa, y0, z0], [xa, y1, z1], [xb, y1, z1], [xb, y0, z0]);
    }
  }
  shop.raw(scuppers, C.navyDark);

  /* --- Timonerie : murs blancs, toit débordant (dessus clair, chant marine), visière. */
  shop.add(prism(HOUSE_FOOT, HOUSE_HEAD, HOUSE_BASE, HOUSE_TOP, false), C.white, { flat: true });
  const roofFoot: [number, number][] = [
    [-0.1, -0.74], [-0.1, 0.74], [1.5, 0.74], [1.83, 0.42], [1.83, -0.42], [1.5, -0.74],
  ];
  shop.add(prism(roofFoot, roofFoot, HOUSE_TOP, ROOF_TOP), (_x, y) => (y > ROOF_TOP - 0.01 ? C.roof : C.navy), { flat: true });
  shop.add(new BoxGeometry(0.22, 0.03, 0.86), C.navy, { at: [1.9, HOUSE_TOP + 0.03, 0], rot: [0, 0, -14 * deg], flat: true });
  const band: number[] = [];
  for (let face = 0; face < HOUSE_FOOT.length; face++) onFace(band, face, 0, 1, 1.25, 1.31, 0.006);
  shop.raw(band, C.navy);

  // Cadres de fenêtres (les vitres sont un maillage à part, émissif la nuit).
  const frames: number[] = [];
  const panes: number[] = [];
  const windows: [number, number, number][] = [
    [3, 0.1, 0.9], [2, 0.14, 0.86], [4, 0.14, 0.86],
    [1, 0.1, 0.42], [1, 0.52, 0.86], [5, 0.14, 0.48], [5, 0.58, 0.9],
    [0, 0.6, 0.9],
  ];
  for (const [face, s0, s1] of windows) {
    const margin = 0.04 / FACE_LENGTH[face];
    onFace(frames, face, s0 - margin, s1 + margin, SILL - 0.04, HEAD + 0.04, 0.008);
    onFace(panes, face, s0, s1, SILL, HEAD, 0.014);
  }
  shop.raw(frames, C.navy);

  // Porte arrière (bâbord), son hublot et sa poignée.
  const door: number[] = [];
  onFace(door, 0, 0.1, 0.4, deckAt(0, -0.4) - 0.01, 1.84, 0.01);
  shop.raw(door, C.navy);
  const backAt = houseFace(0);
  const porthole = backAt(0.25, 1.5, 0.02);
  shop.add(new TorusGeometry(0.1, 0.022, 6, 16), C.steel, { at: porthole, rot: [0, Math.PI / 2, 0] });
  const handle = backAt(0.36, 1.05, 0.03);
  shop.add(new CylinderGeometry(0.018, 0.018, 0.08, 6), C.steel, { at: handle, rot: [Math.PI / 2, 0, 0] });
  const roundPane = backAt(0.25, 1.5, 0.024);

  /* --- Poste de barre arrière : console contre la cloison (la roue est portée par le patron). */
  const [cx, cy, cz] = ANCHORS.captain;
  const hubX = cx + ANCHORS.wheel[0];
  shop.add(new BoxGeometry(0.17, 0.66, 0.26), C.rail, { at: [-0.085, cy + 0.33, cz], flat: true });
  shop.add(new BoxGeometry(0.2, 0.05, 0.3), C.navy, { at: [-0.095, cy + 0.67, cz], flat: true });
  shop.add(new CylinderGeometry(0.03, 0.03, Math.abs(hubX), 8), C.steel, { at: [hubX / 2, cy + ANCHORS.wheel[1], cz], rot: [0, 0, Math.PI / 2] });
  // Seau galvanisé aux pieds du patron.
  const bucketY = deckAt(-1.02, 0.72);
  shop.add(new CylinderGeometry(0.11, 0.085, 0.2, 10), (_x, y) => (y > 0.099 ? '#4e5d66' : C.steel), { at: [-1.02, bucketY + 0.1, 0.72] });
  shop.add(new TorusGeometry(0.1, 0.008, 4, 12, Math.PI), C.steel, { at: [-1.02, bucketY + 0.2, 0.72] });

  /* --- Bouée couronne rouge et blanche sur le flanc tribord de la timonerie. */
  const ringAt = houseFace(1)(0.2, 0.98, 0.07);
  shop.add(new TorusGeometry(0.2, 0.055, 8, 24), (x, y) => {
    const angle = Math.atan2(y, x) + Math.PI;
    return Math.floor(angle / (Math.PI / 4)) % 2 === 0 ? C.red : C.white;
  }, { at: ringAt, rot: [0, 0, 22.5 * deg] });
  shop.add(new BoxGeometry(0.03, 0.08, 0.03), C.navy, { at: [ringAt[0], ringAt[1] + 0.24, ringAt[2] - 0.03], flat: true });

  /* --- Toit : mât et gréement, radar, cheminée, radeau de survie, antennes, projecteurs. */
  const [mx, my] = ANCHORS.masthead;
  const mastHeight = my - ROOF_TOP;
  shop.add(new CylinderGeometry(0.03, 0.045, mastHeight, 10), C.white, { at: [mx, ROOF_TOP + mastHeight / 2, 0] });
  shop.add(new SphereGeometry(0.05, 10, 8), C.navy, { at: [mx, my + 0.02, 0] });
  shop.add(new BoxGeometry(0.05, 0.04, 0.7), C.white, { at: [mx, 3.04, 0], flat: true });
  shop.add(new BoxGeometry(0.05, 0.05, 0.05), C.black, { at: [mx - 0.035, 3.28, 0], flat: true });
  for (const side of [1, -1]) {
    rod(shop, new Vector3(mx, 3.04, 0.34 * side), new Vector3(0.25, ROOF_TOP, 0.7 * side), 0.008, C.black);
  }
  const stayFrom = new Vector3(mx, my - 0.02, 0);
  const stayTo = new Vector3(rakeX(1, sheer(1), 0) - 0.04, sheer(1) + 0.04, 0);
  rod(shop, stayFrom, stayTo, 0.008, C.black);
  {
    // Pavois de fête le long de l'étai : fanions triangulaires aux couleurs des pavillons de l'archipel.
    const bunting: number[] = [];
    const colors: string[] = [];
    const palette = ['#c9553f', '#e0a93f', '#3f8f8a', '#efe2c4'];
    const count = 9;
    for (let index = 0; index < count; index++) {
      const t0 = 0.1 + (index / count) * 0.84;
      const t1 = t0 + 0.06;
      const a = stayFrom.clone().lerp(stayTo, t0);
      const b = stayFrom.clone().lerp(stayTo, t1);
      const tip = a.clone().lerp(b, 0.5).add(new Vector3(-0.02, -0.17, 0));
      const sway = (seeded(index * 1.7) - 0.5) * 0.06;
      bunting.push(a.x, a.y, a.z, b.x, b.y, b.z, tip.x, tip.y, tip.z + sway);
      bunting.push(a.x, a.y, a.z, tip.x, tip.y, tip.z + sway, b.x, b.y, b.z);
      colors.push(palette[index % palette.length], palette[index % palette.length]);
    }
    shop.raw(bunting, (_x, _y, _z, face) => colors[face]);
  }
  const [rx, ry] = ANCHORS.radar;
  shop.add(new BoxGeometry(0.16, ry - ROOF_TOP - 0.04, 0.16), C.navy, { at: [rx, (ry + ROOF_TOP) / 2 - 0.02, 0], flat: true });
  // Cheminée : fût rouge, bague blanche, manchon noir évasé.
  const [sx, sy, sz] = ANCHORS.stackTip;
  shop.add(new CylinderGeometry(0.105, 0.115, 0.6, 12), C.hull, { at: [sx, ROOF_TOP + 0.3, sz] });
  shop.add(new CylinderGeometry(0.11, 0.108, 0.08, 12), C.white, { at: [sx, ROOF_TOP + 0.64, sz] });
  shop.add(new CylinderGeometry(0.125, 0.11, sy - ROOF_TOP - 0.68, 12, 1, true), C.black, { at: [sx, (sy + ROOF_TOP + 0.68) / 2, sz] });
  shop.add(new TorusGeometry(0.118, 0.016, 5, 14), C.black, { at: [sx, sy, sz], rot: [Math.PI / 2, 0, 0] });
  shop.add(new CylinderGeometry(0.1, 0.1, 0.01, 10), '#121314', { at: [sx, sy - 0.04, sz] });
  // Radeau de survie dans son berceau.
  shop.add(new CapsuleGeometry(0.12, 0.3, 4, 10), C.white, { at: [0.3, ROOF_TOP + 0.15, 0.4], rot: [0, 0, Math.PI / 2] });
  for (const x of [0.18, 0.42]) {
    shop.add(new TorusGeometry(0.125, 0.012, 4, 14), C.orange, { at: [x, ROOF_TOP + 0.15, 0.4], rot: [0, Math.PI / 2, 0] });
    shop.add(new BoxGeometry(0.04, 0.05, 0.26), C.navy, { at: [x, ROOF_TOP + 0.025, 0.4], flat: true });
  }
  // Antennes VHF.
  shop.add(new CylinderGeometry(0.008, 0.014, 1.05, 4), C.white, { at: [0.02, ROOF_TOP + 0.5, 0.64], rot: [6 * deg, 0, 4 * deg] });
  shop.add(new CylinderGeometry(0.008, 0.014, 0.8, 4), C.white, { at: [1.42, ROOF_TOP + 0.4, -0.6], rot: [-5 * deg, 0, 3 * deg] });
  // Projecteur orientable (son verre est parmi les feux).
  shop.add(new CylinderGeometry(0.075, 0.065, 0.14, 10), C.navy, { at: [1.6, ROOF_TOP + 0.11, 0.3], rot: [0, 0, -Math.PI / 2] });
  shop.add(new BoxGeometry(0.04, 0.06, 0.04), C.navy, { at: [1.6, ROOF_TOP + 0.03, 0.3], flat: true });
  // Projecteur de pont, sous le débord arrière du toit.
  const [wx, wy] = ANCHORS.workLight;
  shop.add(new BoxGeometry(0.08, 0.08, 0.16), C.navy, { at: [wx + 0.03, wy + 0.02, 0], flat: true });
  // Feux de côté sur les pans avant : leurs écrans noirs côté intérieur.
  const lampAt = (face: number) => houseFace(face)(0.5, 1.98, 0.05);
  for (const face of [2, 4]) {
    const at = lampAt(face);
    shop.add(new BoxGeometry(0.02, 0.13, 0.16), C.black, { at: [at[0] - 0.02, at[1], at[2] - Math.sign(at[2]) * 0.07], rot: [0, (face === 2 ? 45 : -45) * deg, 0], flat: true });
  }

  /* --- Plage avant : guindeau, bittes, glène, ancre saisie sur le pont, davier. */
  const winchX = 2.02;
  const winchY = deckAt(winchX);
  shop.add(new BoxGeometry(0.26, 0.12, 0.3), C.navy, { at: [winchX, winchY + 0.06, 0], flat: true });
  shop.add(new CylinderGeometry(0.09, 0.09, 0.34, 12), C.hull, { at: [winchX, winchY + 0.2, 0], rot: [Math.PI / 2, 0, 0] });
  for (const side of [1, -1]) {
    shop.add(new CylinderGeometry(0.12, 0.12, 0.03, 12), C.navy, { at: [winchX, winchY + 0.2, side * 0.19], rot: [Math.PI / 2, 0, 0] });
  }
  for (const [bx, bz] of [[2.42, 0.32], [2.42, -0.32], [-2.9, 0.55], [-2.9, -0.55]] as const) {
    for (const offset of [-0.07, 0.07]) {
      shop.add(new CylinderGeometry(0.035, 0.04, 0.16, 8), C.navyDark, { at: [bx + offset, deckAt(bx + offset, bz) + 0.08, bz] });
    }
  }
  const stemX = rakeX(1, sheer(1), 0);
  const stemY = sheer(1);
  // Davier : semelle, deux joues et un rouleau d'acier, posés sur la tête d'étrave.
  shop.add(new BoxGeometry(0.24, 0.03, 0.13), C.navyDark, { at: [stemX - 0.01, stemY + 0.05, 0], flat: true });
  for (const side of [1, -1]) {
    shop.add(new BoxGeometry(0.24, 0.09, 0.02), C.navyDark, { at: [stemX, stemY + 0.1, side * 0.055], flat: true });
  }
  shop.add(new CylinderGeometry(0.03, 0.03, 0.09, 10), C.steel, { at: [stemX + 0.07, stemY + 0.1, 0], rot: [Math.PI / 2, 0, 0] });
  // Jonc d'étrave marine, de la flottaison au davier : il dessine le fil de la proue.
  rod(shop, new Vector3(rakeX(1, -0.04, 0) + 0.012, -0.04, 0), new Vector3(stemX + 0.012, stemY + 0.035, 0), 0.026, C.pinstripe);
  {
    // Ancre pendue à la joue bâbord sous son écubier (côté large, face à la caméra à quai) :
    // la proue a un « visage », lisible de loin comme de près.
    const anchor = new PaintShop()
      .add(new CylinderGeometry(0.024, 0.02, 0.5, 6), C.black, { at: [0, 0.25, 0] })
      .add(new TorusGeometry(0.15, 0.024, 5, 12, Math.PI), C.black, { at: [0, 0.14, 0], rot: [0, 0, Math.PI] })
      .add(new ConeGeometry(0.05, 0.13, 4), C.black, { at: [0.15, 0.17, 0], rot: [0, 0, 20 * deg], scale: [1, 1, 0.45], flat: true })
      .add(new ConeGeometry(0.05, 0.13, 4), C.black, { at: [-0.15, 0.17, 0], rot: [0, 0, -20 * deg], scale: [1, 1, 0.45], flat: true })
      .add(new TorusGeometry(0.035, 0.01, 4, 8), C.steel, { at: [0, 0.52, 0] })
      .build();
    const u = 0.83;
    const surface = (station: number, y: number) => {
      const z = -sideAt(station, y);
      return new Vector3(rakeX(station, y, z), y, z);
    };
    const ringY = sheer(u) - 0.36;
    const crownY = ringY - 0.52;
    const midY = (ringY + crownY) / 2;
    // Repère de la joue : « haut » le long du bordé évasé, « long » vers l'arrière, normale dehors.
    const up = surface(u, ringY).sub(surface(u, crownY)).normalize();
    const along = surface(u - 0.02, midY).sub(surface(u + 0.02, midY));
    along.addScaledVector(up, -along.dot(up)).normalize();
    const out = new Vector3().crossVectors(along, up);
    const turn = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(along, up, out));
    const rot: Vec3 = [turn.x, turn.y, turn.z];
    const crown = surface(u, crownY).addScaledVector(out, 0.04);
    shop.add(anchor, null, { at: [crown.x, crown.y, crown.z], rot });
    const hawse = surface(u, ringY + 0.06).addScaledVector(out, 0.012);
    shop.add(new TorusGeometry(0.045, 0.016, 5, 14), C.steel, { at: [hawse.x, hawse.y, hawse.z], rot });
    const hole = hawse.clone().addScaledVector(out, -0.004);
    shop.add(new CircleGeometry(0.032, 10), '#141619', { at: [hole.x, hole.y, hole.z], rot });
  }

  /* --- Glènes de cordage. */
  const coil = (x: number, z: number, scale = 1) => {
    const y = deckAt(x, z);
    [0.17, 0.13, 0.09].forEach((radius, index) => {
      shop.add(new TorusGeometry(radius * scale, 0.026 * scale, 5, 18), C.rope, {
        at: [x, y + 0.03 * scale + index * 0.032 * scale, z],
        rot: [Math.PI / 2, 0, index * 0.7],
      });
    });
  };
  coil(2.18, 0.38, 0.8);
  coil(-2.72, 0.4);
  coil(-0.98, -0.12, 0.75);

  /* --- Enrouleur de filet sur la plage arrière : bâti, joues rouges à bord roulé, filet
     enroulé en spires (renflé au milieu, ralingues orange), nappe qui retombe en tas sur le pont. */
  const drumX = -2.3;
  const drumY = deckAt(drumX) + 0.56;
  for (const side of [1, -1]) {
    shop.add(new BoxGeometry(0.46, 0.08, 0.06), C.navy, { at: [drumX, drumY - 0.52, side * 0.62], flat: true });
    shop.add(new BoxGeometry(0.08, 0.6, 0.05), C.navy, { at: [drumX - 0.14, drumY - 0.24, side * 0.62], rot: [0, 0, -12 * deg], flat: true });
    shop.add(new BoxGeometry(0.08, 0.6, 0.05), C.navy, { at: [drumX + 0.14, drumY - 0.24, side * 0.62], rot: [0, 0, 12 * deg], flat: true });
    shop.add(new CylinderGeometry(0.4, 0.4, 0.035, 26), C.hull, { at: [drumX, drumY, side * 0.53], rot: [Math.PI / 2, 0, 0] });
    shop.add(new TorusGeometry(0.4, 0.022, 5, 26), C.hullSeam, { at: [drumX, drumY, side * 0.53] });
    shop.add(new CylinderGeometry(0.07, 0.07, 0.08, 10), C.navyDark, { at: [drumX, drumY, side * 0.6], rot: [Math.PI / 2, 0, 0] });
  }
  {
    const rings = 14;
    const profile: Vector2[] = [];
    for (let index = 0; index <= rings; index++) {
      const t = index / rings;
      profile.push(new Vector2(0.255 + 0.07 * Math.pow(Math.sin(t * Math.PI), 0.7), (t - 0.5) * 1.02));
    }
    shop.add(new LatheGeometry(profile, 24), (_x, y) => {
      const ring = Math.floor((y / 1.02 + 0.5) * rings);
      if (ring === 3 || ring === 10) return C.orange;
      return ring % 2 === 0 ? C.net : C.netDark;
    }, { at: [drumX, drumY, 0], rot: [Math.PI / 2, 0, 0] });
  }
  {
    // Nappe : elle quitte l'enrouleur à l'arrière, tombe presque à pic puis se couche sur le pont.
    const columns = 7;
    const rows = 8;
    const x0 = drumX - 0.3;
    const y0 = drumY - 0.02;
    const x1 = -2.8;
    const y1 = deckAt(x1) + 0.06;
    const point = (t: number, s: number): Vec3 => {
      const fall = Math.sin(t * Math.PI * 0.5);
      const width = 0.25 - t * 0.04;
      const z = -0.025 + s * width + Math.sin(t * 7 + s * 2) * 0.012;
      const x = x0 + (x1 - x0) * (1 - Math.cos(t * Math.PI * 0.5));
      const y = y0 + (y1 - y0) * fall + Math.cos(s * Math.PI * 2.5 + t * 3) * 0.022 * t;
      return [x, y, z];
    };
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= columns; j++) positions.push(...point(i / rows, (j / columns) * 2 - 1));
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const a = i * (columns + 1) + j;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const drape = new BufferGeometry();
    drape.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    drape.setIndex(indices);
    drape.computeVertexNormals();
    shop.add(drape, (x, y, z) => {
      if (z > 0.17) return C.orange;
      if (z < -0.22) return C.netDark;
      return (Math.floor(z * 16) + Math.floor((x + y) * 9)) % 2 === 0 ? C.net : C.netDark;
    });
    // Le tas de filet au pied de la nappe et quelques flotteurs de liège sur la ralingue.
    for (const [hx, hz, sx, sy, sz, color] of [
      [-2.86, -0.02, 0.2, 0.085, 0.24, C.net],
      [-2.97, -0.14, 0.12, 0.07, 0.12, C.netDark],
      [-2.78, 0.1, 0.13, 0.075, 0.11, C.netDark],
    ] as const) {
      shop.add(new SphereGeometry(1, 12, 7), color, { at: [hx, deckAt(hx, hz) + sy * 0.55, hz], scale: [sx, sy, sz] });
    }
    for (const t of [0.3, 0.62, 0.9]) {
      const [fx, fy, fz] = point(t, 1);
      shop.add(new SphereGeometry(0.032, 8, 6), C.orange, { at: [fx - 0.01, fy + 0.02, fz + 0.01], scale: [1.3, 0.8, 1] });
    }
    shop.add(new SphereGeometry(0.034, 8, 6), C.orange, { at: [-2.9, deckAt(-2.9, 0.12) + 0.1, 0.12], scale: [1.3, 0.8, 1] });
  }

  /* --- Casiers à homards (bâbord) : semelle en bois, voûte de filet, arceaux, goulotte. */
  const pot = (x: number, y: number, z: number, yaw: number) => {
    shop.add(new BoxGeometry(0.5, 0.05, 0.4), C.potWood, { at: [x, y + 0.025, z], rot: [0, yaw, 0], flat: true });
    shop.add(new CylinderGeometry(0.19, 0.19, 0.48, 9, 1, false, 0, Math.PI), C.netDark, { at: [x, y + 0.05, z], rot: [0, yaw, Math.PI / 2], flat: true });
    for (const along of [-0.17, 0, 0.17]) {
      shop.add(new TorusGeometry(0.195, 0.014, 4, 10, Math.PI), C.potWood, {
        at: [x + along * Math.cos(yaw), y + 0.05, z - along * Math.sin(yaw)],
        rot: [0, yaw + Math.PI / 2, 0],
      });
    }
    shop.add(new TorusGeometry(0.06, 0.016, 4, 10), C.black, { at: [x, y + 0.245, z], rot: [Math.PI / 2, 0, 0] });
  };
  pot(-1.7, deckAt(-1.7, -0.55), -0.55, 0.04);
  pot(-1.16, deckAt(-1.16, -0.55), -0.55, -0.03);
  pot(-1.44, deckAt(-1.44, -0.55) + 0.25, -0.53, 0.08);

  /* --- Caisses de criée (tribord) et un peu de pêche dans celle du dessus. */
  const crate = (x: number, y: number, z: number, color: string, yaw: number) => {
    const height = 0.17;
    shop.add(new BoxGeometry(0.5, height, 0.36), (_x, py) => (py > height / 2 - 0.001 ? C.navyDark : color), { at: [x, y + height / 2, z], rot: [0, yaw, 0], flat: true });
  };
  crate(-1.68, deckAt(-1.68, 0.52), 0.52, C.crate, 0.03);
  crate(-1.14, deckAt(-1.14, 0.52), 0.52, C.crateLight, -0.04);
  const topCrateY = deckAt(-1.4, 0.5) + 0.17;
  crate(-1.4, topCrateY, 0.5, C.orange, 0.1);
  for (let index = 0; index < 4; index++) {
    const fx = -1.52 + index * 0.08;
    const fz = 0.44 + seeded(index * 4.1) * 0.12;
    const yaw = seeded(index * 2.3) * Math.PI;
    shop.add(new SphereGeometry(1, 8, 5), C.fish, { at: [fx, topCrateY + 0.18, fz], rot: [0, yaw, 0], scale: [0.11, 0.025, 0.04] });
    shop.add(new ConeGeometry(0.035, 0.06, 4), C.fish, { at: [fx - Math.cos(yaw) * 0.13, topCrateY + 0.18, fz + Math.sin(yaw) * 0.13], rot: [0, yaw, Math.PI / 2], flat: true });
  }

  /* --- Panneau de cale. */
  shop.add(new BoxGeometry(0.48, 0.1, 0.44), C.rail, { at: [-1.42, deckAt(-1.42) + 0.04, 0], flat: true });
  shop.add(new BoxGeometry(0.42, 0.02, 0.38), C.wood[2], { at: [-1.42, deckAt(-1.42) + 0.1, 0], flat: true });

  /* --- Bouées et bouée-pavillon (« bouée de casier ») dans l'angle arrière bâbord. */
  for (const [bx, bz, radius] of [[-2.86, -0.5, 0.13], [-2.66, -0.62, 0.11]] as const) {
    shop.add(new SphereGeometry(radius, 10, 8), C.orange, { at: [bx, deckAt(bx, bz) + radius, bz] });
    shop.add(new TorusGeometry(radius * 0.4, 0.012, 4, 10), C.black, { at: [bx, deckAt(bx, bz) + radius * 2, bz], rot: [Math.PI / 2, 0, 0] });
  }
  {
    const base = new Vector3(-3.0, deckAt(-3.0, -0.38), -0.38);
    const up = new Vector3(0, 1, 0).applyEuler(new Euler(12 * deg, 0, 10 * deg));
    const at = (t: number) => base.clone().addScaledVector(up, t);
    rod(shop, at(0), at(1.45), 0.015, C.black, 5);
    const float = at(0.35);
    shop.add(new CylinderGeometry(0.08, 0.08, 0.2, 10), C.orange, { at: [float.x, float.y, float.z], rot: [12 * deg, 0, 10 * deg] });
    const flag = at(1.33);
    shop.add(new BoxGeometry(0.01, 0.16, 0.2), (_x, y) => (y > 0 ? C.black : C.orange), { at: [flag.x, flag.y, flag.z + 0.1], rot: [12 * deg, 0, 10 * deg], flat: true });
  }

  /* --- Pneus de défense le long des bords, chacun au bout de son bout. */
  for (const x of [-1.95, -0.5, 0.86]) {
    for (const side of [1, -1]) {
      const u = stationU(x);
      const y = 0.42;
      const z = (sideAt(u, y) + 0.06) * side;
      const tx = rakeX(u, y, z);
      shop.add(new TorusGeometry(0.16, 0.06, 6, 14), C.tire, { at: [tx, y, z], rot: [side * -8 * deg, 0, 0], flat: true });
      const railZ = (sideAt(u, sheer(u)) + 0.02) * side;
      rod(shop, new Vector3(tx, y + 0.2, z), new Vector3(tx, sheer(u) + 0.04, railZ), 0.012, C.rope);
    }
  }

  /* --- Feux (verres colorés : maillage non éclairé, intensifié la nuit) et leurs halos. */
  const lamps = new PaintShop();
  const halos: { at: Vec3; color: string; size: number }[] = [];
  for (const face of [2, 4]) {
    const at = lampAt(face);
    const color = face === 2 ? '#3fd07a' : '#ff4a3d';
    lamps.add(new BoxGeometry(0.1, 0.12, 0.08), color, { at, rot: [0, (face === 2 ? -45 : 45) * deg, 0], flat: true });
    halos.push({ at, color, size: 1.55 });
  }
  const mastLight: Vec3 = [mx + 0.01, 3.28, 0];
  lamps.add(new CylinderGeometry(0.04, 0.04, 0.07, 8), '#fff6dc', { at: mastLight });
  halos.push({ at: mastLight, color: '#fff2cf', size: 1.35 });
  const sternLight: Vec3 = [rakeX(0, sheer(0), 0) + 0.02, sheer(0) + 0.12, 0];
  lamps.add(new CylinderGeometry(0.035, 0.035, 0.07, 8), '#fff6dc', { at: sternLight });
  shop.add(new BoxGeometry(0.06, 0.07, 0.06), C.navyDark, { at: [sternLight[0] + 0.03, sternLight[1] - 0.07, 0], flat: true });
  halos.push({ at: sternLight, color: '#fff2cf', size: 1.0 });
  const workLens: Vec3 = [wx - 0.02, wy, 0];
  lamps.add(new BoxGeometry(0.02, 0.06, 0.12), '#ffe7b0', { at: workLens, flat: true });
  halos.push({ at: workLens, color: '#ffd9a0', size: 1.3 });
  lamps.add(new CylinderGeometry(0.062, 0.062, 0.01, 10), '#fff3d8', { at: [1.675, ROOF_TOP + 0.11, 0.3], rot: [0, 0, -Math.PI / 2] });

  /* --- Pièces animées. */
  const radar = new PaintShop()
    .add(new BoxGeometry(0.74, 0.06, 0.09), (x) => (Math.abs(x) > 0.33 ? C.navy : C.white), { flat: true })
    .add(new BoxGeometry(0.06, 0.06, 0.06), C.navy, { at: [0, -0.04, 0], flat: true })
    .build();
  const propeller = new PaintShop();
  propeller.add(new CylinderGeometry(0.045, 0.035, 0.13, 8), C.bronze, { rot: [0, 0, Math.PI / 2] });
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI * 2;
    propeller.add(new SphereGeometry(1, 8, 6), C.bronze, {
      at: [0, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1],
      rot: [angle, 0.55, 0],
      scale: [0.025, 0.1, 0.06],
    });
  }
  const rudder = new PaintShop()
    .add(new BoxGeometry(0.3, 0.46, 0.04), C.antifouling, { at: [-0.15, -0.25, 0], flat: true })
    .add(new CylinderGeometry(0.025, 0.025, 0.56, 6), C.navyDark, { at: [0, -0.22, 0] })
    .build();

  return {
    hull: hullShell(),
    paint: shop.build(),
    glass: glassGeometry(panes, roundPane),
    lamps: lamps.build(),
    halos,
    mask: waterMask(),
    radar,
    propeller: propeller.build(),
    rudder,
  };
}

/** Vitres (quads, uv 0→1 chacune) et hublot rond, réunis en un maillage. */
function glassGeometry(panes: number[], roundAt: Vec3) {
  const position: number[] = [...panes];
  const uv: number[] = [];
  for (let index = 0; index < panes.length / 18; index++) uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  // Hublot : un disque face à l'arrière.
  const segments = 14;
  for (let index = 0; index < segments; index++) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;
    // Ordre a0 → a1 : normale vers l'arrière (-X).
    position.push(
      roundAt[0], roundAt[1], roundAt[2],
      roundAt[0], roundAt[1] + Math.sin(a0) * 0.085, roundAt[2] + Math.cos(a0) * 0.085,
      roundAt[0], roundAt[1] + Math.sin(a1) * 0.085, roundAt[2] + Math.cos(a1) * 0.085,
    );
    uv.push(0.5, 0.5, 0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5, 0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
