import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { hash, lerp } from '@/lib/utils/math';
import { bevelBox, Pieces, pose, type Vec3 } from '../../docks/parts';
import { addDeck, addLanternPost, addPile, BEAM, IRON, ROPE, THICK } from '../../docks/planks';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import type { TerrainFeatures } from '../types';
import { BELL, COTTAGE, DOCK_DIR, DOCK_SIDE, DOCK_STAIRS, hillStairs, MAILBOX, onDockAxis, PIER, polar, SUNSET_DIR } from './layout';

/**
 * Géométrie statique de l'île Contact, peinte par sommet et fusionnée : phare, maison du
 * gardien, escaliers, sentier, rochers de granit rose, canot, casiers, hortensias…
 * (un draw call), et la longue jetée (un second, dans son propre repère).
 */

const WHITE = '#f4efe6';
const RED = '#cf4636';
const DARK = '#353a43';
const GRANITE = '#c9bcae';
const GRANITE_PINK = '#d3a99b';
const BLUE = '#3b78ad';
const WOOD_DARK = '#5d3c28';
const TREAD = '#c08752';

/* ------------------------------------------------------------------- phare */

export const TOWER = { plinth: 0.5, height: 6.0, bottom: 1.0, top: 0.72 };

/** Repères verticaux du phare (posé au sommet aplani de la butte, voir config). */
export function lighthouseFrame(features: TerrainFeatures) {
  const base = features.summit + 0.36;
  const towerBase = base + TOWER.plinth;
  const towerTop = towerBase + TOWER.height;
  const galleryTop = towerTop + 0.16;
  const glassBottom = galleryTop + 0.3;
  const roofBase = glassBottom + 1.0;
  return {
    x: features.hillX,
    z: features.hillZ,
    base,
    towerBase,
    towerTop,
    galleryTop,
    glassBottom,
    glassCenter: glassBottom + 0.5,
    roofBase,
    spike: roofBase + 0.85 + 0.62,
  };
}
export type LighthouseFrame = ReturnType<typeof lighthouseFrame>;

function towerRadius(frame: LighthouseFrame, y: number) {
  return lerp(TOWER.bottom, TOWER.top, (y - frame.towerBase) / TOWER.height);
}

/** Fenêtres de l'escalier en colimaçon, en spirale autour de la tour. */
export function towerWindows(frame: LighthouseFrame, doorAngle: number) {
  return [
    { height: 1.9, turn: 0.75 },
    { height: 3.35, turn: 2.6 },
    { height: 4.8, turn: -1.1 },
  ].map(({ height, turn }, index) => {
    const y = frame.towerBase + height;
    const angle = doorAngle + turn;
    const radius = towerRadius(frame, y) + 0.015;
    return {
      seed: 31 + index * 7,
      position: [frame.x + Math.cos(angle) * radius, y, frame.z + Math.sin(angle) * radius] as Vec3,
      rotation: [0, Math.atan2(Math.cos(angle), Math.sin(angle)), 0] as Vec3,
      angle,
    };
  });
}

function addLighthouse(wood: Pieces, frame: LighthouseFrame, doorAngle: number) {
  const { x, z, base, towerBase, towerTop, galleryTop, glassBottom, roofBase } = frame;
  // Socle octogonal en granit.
  wood.add(new CylinderGeometry(1.36, 1.5, TOWER.plinth + 0.4, 8), GRANITE, pose([x, base + (TOWER.plinth - 0.4) / 2, z], [0, 0.2, 0]), 0.16);
  wood.add(new CylinderGeometry(1.4, 1.4, 0.08, 8), '#b3a698', pose([x, towerBase - 0.02, z], [0, 0.2, 0]), 0.1);
  // Fût à bandes rouges et blanches.
  const bands: [number, string][] = [[1.35, WHITE], [1.05, RED], [1.1, WHITE], [1.05, RED], [1.45, WHITE]];
  let y = towerBase;
  for (const [height, color] of bands) {
    wood.add(new CylinderGeometry(towerRadius(frame, y + height), towerRadius(frame, y), height, 16), color, pose([x, y + height / 2, z]), 0.06);
    y += height;
  }
  // Porte bleue dans son encadrement de granit, face à l'escalier.
  const dir = { x: Math.cos(doorAngle), z: Math.sin(doorAngle) };
  const yaw = Math.atan2(dir.x, dir.z);
  const doorR = towerRadius(frame, towerBase + 0.6);
  wood.add(bevelBox(0.84, 1.4, 0.2, 0.04), '#ddd3c6', pose([x + dir.x * doorR, towerBase + 0.66, z + dir.z * doorR], [0, yaw, 0]), 0.1);
  wood.add(new BoxGeometry(0.6, 1.18, 0.08), BLUE, pose([x + dir.x * (doorR + 0.09), towerBase + 0.6, z + dir.z * (doorR + 0.09)], [0, yaw, 0]));
  wood.add(new SphereGeometry(0.035, 6, 4), '#d9b25a', pose([x + dir.x * (doorR + 0.15) + dir.z * 0.18, towerBase + 0.62, z + dir.z * (doorR + 0.15) - dir.x * 0.18]));
  // Appuis sombres sous les fenêtres.
  for (const window of towerWindows(frame, doorAngle)) {
    const [wx, wy, wz] = window.position;
    wood.add(new BoxGeometry(0.34, 0.05, 0.1), DARK, pose([wx + Math.cos(window.angle) * 0.03, wy - 0.22, wz + Math.sin(window.angle) * 0.03], window.rotation));
  }
  // Galerie sur consoles, garde-corps.
  wood.add(new CylinderGeometry(1.22, 1.08, 0.16, 18), DARK, pose([x, towerTop + 0.08, z]), 0.15);
  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2;
    const reach = TOWER.top + 0.1;
    wood.add(new BoxGeometry(0.22, 0.26, 0.1), DARK, pose([x + Math.cos(angle) * reach, towerTop - 0.12, z + Math.sin(angle) * reach], [0, -angle, 0]));
  }
  for (let index = 0; index < 20; index++) {
    const angle = (index / 20) * Math.PI * 2;
    wood.add(new BoxGeometry(0.035, 0.44, 0.035), DARK, pose([x + Math.cos(angle) * 1.16, galleryTop + 0.22, z + Math.sin(angle) * 1.16]));
  }
  for (const ring of [0.24, 0.44]) {
    wood.add(new TorusGeometry(1.16, 0.024, 4, 40), DARK, pose([x, galleryTop + ring, z], [Math.PI / 2, 0, 0]));
  }
  // Lanterne : socle, montants (la vitre est un maillage à part), toit rouge, boule et paratonnerre.
  wood.add(new CylinderGeometry(0.72, 0.78, 0.3, 12), DARK, pose([x, galleryTop + 0.15, z]), 0.12);
  for (let index = 0; index < 10; index++) {
    const angle = (index / 10) * Math.PI * 2 + 0.31;
    wood.add(new BoxGeometry(0.045, 1.0, 0.045), DARK, pose([x + Math.cos(angle) * 0.645, glassBottom + 0.5, z + Math.sin(angle) * 0.645]));
  }
  wood.add(new TorusGeometry(0.66, 0.035, 4, 24), DARK, pose([x, glassBottom + 0.98, z], [Math.PI / 2, 0, 0]));
  wood.add(new ConeGeometry(0.9, 0.85, 12), RED, pose([x, roofBase + 0.425, z]), 0.1);
  wood.add(new TorusGeometry(0.8, 0.045, 4, 24), DARK, pose([x, roofBase + 0.03, z], [Math.PI / 2, 0, 0]));
  wood.add(new SphereGeometry(0.14, 8, 6), DARK, pose([x, roofBase + 0.92, z]));
  wood.add(new CylinderGeometry(0.018, 0.03, 0.62, 5), DARK, pose([x, roofBase + 1.25, z]));
}

/* ----------------------------------------------------------- maison du gardien */

export const HOUSE = { wall: 1.9, roof: 1.25 };

export function cottageMatrix(sampler: HeightSampler) {
  return pose([COTTAGE.x, groundAt(sampler, COTTAGE.x, COTTAGE.z, 1.1) - 0.04, COTTAGE.z], [0, COTTAGE.yaw, 0]);
}

/** Passe un point du repère de la maison au repère de l'île. */
export function fromCottage(matrix: Matrix4, local: Vec3): Vec3 {
  const e = matrix.elements;
  const [x, y, z] = local;
  return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
}

/** Vitres de la maison (repère de la maison) : façade et pignons. */
export const COTTAGE_WINDOWS: { seed: number; position: Vec3; rotation: Vec3; width: number; height: number }[] = [
  { seed: 3, position: [-0.92, 1.18, COTTAGE.depth / 2 + 0.012], rotation: [0, 0, 0], width: 0.5, height: 0.62 },
  { seed: 9, position: [0.92, 1.18, COTTAGE.depth / 2 + 0.012], rotation: [0, 0, 0], width: 0.5, height: 0.62 },
  { seed: 14, position: [-COTTAGE.width / 2 - 0.012, 1.18, 0], rotation: [0, -Math.PI / 2, 0], width: 0.44, height: 0.56 },
  { seed: 21, position: [COTTAGE.width / 2 + 0.012, 1.18, 0], rotation: [0, Math.PI / 2, 0], width: 0.44, height: 0.56 },
];

/** Cheminées (repère de la maison) : la fumée sort de la première. */
export const CHIMNEYS: Vec3[] = [
  [-COTTAGE.width / 2 + 0.24, HOUSE.wall + HOUSE.roof + 0.68, 0],
  [COTTAGE.width / 2 - 0.24, HOUSE.wall + HOUSE.roof + 0.68, 0],
];

/** Lampe au-dessus de la porte (repère de la maison). */
export const DOOR_LAMP: Vec3 = [0.55, 1.62, COTTAGE.depth / 2 + 0.17];

function addCottage(wood: Pieces, matrix: Matrix4) {
  const W = COTTAGE.width;
  const D = COTTAGE.depth;
  const { wall, roof } = HOUSE;
  const put = (geometry: Parameters<Pieces['add']>[0], color: Parameters<Pieces['add']>[1], at: Vec3, rotation: Vec3 = [0, 0, 0], shade = 0, scale: number | Vec3 = 1) =>
    wood.add(geometry, color, matrix.clone().multiply(pose(at, rotation, scale)), shade);

  // Murs et pignons blanchis à la chaux : un profil de maison extrudé.
  const profile = new Shape();
  profile.moveTo(-D / 2, 0);
  profile.lineTo(D / 2, 0);
  profile.lineTo(D / 2, wall);
  profile.lineTo(0, wall + roof);
  profile.lineTo(-D / 2, wall);
  profile.closePath();
  const body = new ExtrudeGeometry(profile, { depth: W, bevelEnabled: false });
  body.translate(0, 0, -W / 2);
  body.rotateY(Math.PI / 2);
  put(body, '#f3ede2', [0, 0, 0], [0, 0, 0], 0.05);
  // Soubassement et pierres d'angle en granit.
  put(new BoxGeometry(W + 0.14, 0.34, D + 0.14), '#b8ab9e', [0, 0.1, 0], [0, 0, 0], 0.15);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      for (let course = 0; course < 5; course++) {
        const long = course % 2 === 0;
        put(new BoxGeometry(long ? 0.3 : 0.18, 0.3, long ? 0.18 : 0.3), GRANITE, [cx * (W / 2 - (long ? 0.13 : 0.07)), 0.42 + course * 0.31, cz * (D / 2 - (long ? 0.07 : 0.13))], [0, 0, 0], 0.08, [1.08, 1, 1.08]);
      }
    }
  }
  // Toit d'ardoise à deux pans, faîtage.
  const slope = Math.atan2(roof, D / 2);
  const eave = 0.3;
  const run = D / 2 + eave;
  const length = run / Math.cos(slope) + 0.06;
  for (const side of [-1, 1]) {
    // Chaque pan part du faîtage et déborde des murs ; posé sur le plan du toit.
    const cy = wall + roof - Math.tan(slope) * (run / 2) + Math.cos(slope) * 0.065;
    const cz = side * (run / 2 + Math.sin(slope) * 0.065);
    put(new BoxGeometry(W + 0.42, 0.13, length), '#5d6c86', [0, cy, cz], [side * slope, 0, 0], 0.14);
  }
  put(new BoxGeometry(W + 0.46, 0.12, 0.22), '#4a5770', [0, wall + roof + 0.1, 0], [0, 0, 0], 0.1);
  // Cheminées de granit aux deux pignons, avec leurs pots en terre cuite.
  for (const [cx] of CHIMNEYS) {
    put(new BoxGeometry(0.46, 1.15, 0.56), GRANITE, [cx, wall + roof + 0.05, 0], [0, 0, 0], 0.12);
    put(new BoxGeometry(0.56, 0.08, 0.66), '#a99c8f', [cx, wall + roof + 0.66, 0], [0, 0, 0], 0.1);
    put(new CylinderGeometry(0.075, 0.085, 0.2, 6), '#c4643f', [cx, wall + roof + 0.78, 0.1]);
  }
  // Porte bleue, encadrement, seuil, poignée ; petite lampe en applique.
  put(bevelBox(0.86, 1.36, 0.08, 0.03), GRANITE, [0, 0.68, D / 2 + 0.01], [0, 0, 0], 0.1);
  put(new BoxGeometry(0.64, 1.18, 0.08), BLUE, [0, 0.64, D / 2 + 0.04]);
  put(new BoxGeometry(0.5, 0.05, 0.03), '#2f6290', [0, 0.92, D / 2 + 0.085]);
  put(new SphereGeometry(0.035, 6, 4), '#d9b25a', [0.22, 0.62, D / 2 + 0.1]);
  put(new BoxGeometry(0.96, 0.14, 0.4), '#b8ab9e', [0, 0.07, D / 2 + 0.2], [0, 0, 0], 0.15);
  put(new BoxGeometry(0.04, 0.04, 0.2), IRON, [DOOR_LAMP[0], DOOR_LAMP[1] + 0.14, D / 2 + 0.08]);
  put(new BoxGeometry(0.2, 0.03, 0.2), IRON, [DOOR_LAMP[0], DOOR_LAMP[1] - 0.12, DOOR_LAMP[2]]);
  put(new ConeGeometry(0.16, 0.12, 4), IRON, [DOOR_LAMP[0], DOOR_LAMP[1] + 0.17, DOOR_LAMP[2]], [0, Math.PI / 4, 0]);
  // Volets bleus entrouverts, appuis de granit, jardinières de géraniums.
  for (const window of COTTAGE_WINDOWS) {
    const [wx, wy, wz] = window.position;
    const facingX = Math.abs(window.rotation[1]) > 0.1;
    const outward = facingX ? Math.sign(wx) : 1;
    for (const side of [-1, 1]) {
      const offset = window.width / 2 + 0.14;
      const at: Vec3 = facingX
        ? [wx + outward * 0.05, wy, wz + side * offset]
        : [wx + side * offset, wy, wz + 0.05];
      put(new BoxGeometry(facingX ? 0.04 : 0.27, window.height + 0.04, facingX ? 0.27 : 0.04), BLUE, at, [0, side * outward * (facingX ? -0.32 : 0.32), 0], 0.08);
    }
    const sill: Vec3 = facingX ? [wx + outward * 0.06, wy - window.height / 2 - 0.04, wz] : [wx, wy - window.height / 2 - 0.04, wz + 0.06];
    put(new BoxGeometry(facingX ? 0.12 : window.width + 0.1, 0.05, facingX ? window.width + 0.1 : 0.12), '#ddd3c6', sill);
    if (!facingX) {
      put(new BoxGeometry(window.width + 0.06, 0.15, 0.17), '#8a5a3c', [wx, sill[1] - 0.1, wz + 0.13], [0, 0, 0], 0.12);
      for (let bloom = 0; bloom < 6; bloom++) {
        const k = hash(wx * 7 + bloom * 3.1);
        put(new IcosahedronGeometry(0.07 + k * 0.025, 0), bloom % 3 === 0 ? '#4f8a3c' : bloom % 2 === 0 ? '#e0413b' : '#ef6f8c', [wx - 0.22 + bloom * 0.09, sill[1] - 0.0 + k * 0.05, wz + 0.13 + (k - 0.5) * 0.06]);
      }
    }
  }
  // Hortensias aux coins de la façade : bleu d'un côté, rose de l'autre.
  addHydrangea(put, [-W / 2 - 0.42, 0, D / 2 + 0.32], ['#7d97e8', '#97acf2', '#b4a3ee'], 1);
  addHydrangea(put, [W / 2 + 0.42, 0, D / 2 + 0.3], ['#ea8fbd', '#f4aecd', '#d97aae'], 2);
  addHydrangea(put, [W / 2 + 0.5, 0, -D / 2 + 0.1], ['#7d97e8', '#a68ce6', '#97acf2'], 3);
}

type Put = (geometry: Parameters<Pieces['add']>[0], color: Parameters<Pieces['add']>[1], at: Vec3, rotation?: Vec3, shade?: number, scale?: number | Vec3) => void;

function addHydrangea(put: Put, at: Vec3, palette: string[], seed: number) {
  const [x, y, z] = at;
  put(new DodecahedronGeometry(0.4, 0), '#4f8a45', [x, y + 0.22, z], [0, seed, 0], 0.1, [1, 0.62, 1]);
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.4 + seed;
    const reach = index === 0 ? 0 : 0.2 + hash(seed * 9 + index) * 0.1;
    put(
      new IcosahedronGeometry(0.15 + hash(seed * 5 + index) * 0.05, 1),
      palette[index % palette.length],
      [x + Math.cos(angle) * reach, y + 0.4 + (index === 0 ? 0.12 : hash(seed + index) * 0.1), z + Math.sin(angle) * reach],
      [0, 0, 0],
      0.06,
    );
  }
}

/* ------------------------------------------------------------- escaliers, sentier */

/** Escalier droit : marches en bois (ou en pierre), limons, main courante de corde. */
function addStairs(
  wood: Pieces,
  { from, to, yFrom, yTo, steps, width, stone }: { from: { x: number; z: number }; to: { x: number; z: number }; yFrom: number; yTo: number; steps: number; width: number; stone?: boolean },
) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const sideX = dz / length;
  const sideZ = -dx / length;
  const run = length / steps;
  const rise = (yTo - yFrom) / steps;
  for (let step = 0; step < steps; step++) {
    const t = (step + 0.5) / steps;
    const top = yFrom + (step + 1) * rise;
    const cx = from.x + dx * t;
    const cz = from.z + dz * t;
    const tone = 0.92 + hash(step * 3.7 + from.x) * 0.14;
    const tread = new Color(stone ? '#cfc5b8' : TREAD).multiplyScalar(tone);
    wood.add(bevelBox(width + (stone ? (hash(step) - 0.5) * 0.2 : 0), 0.12, run + 0.08, 0.025), tread, pose([cx, top - 0.06, cz], [0, yaw + (hash(step * 1.3) - 0.5) * 0.05, 0]), 0.2);
    wood.add(new BoxGeometry(width - 0.1, 0.55, run * 0.9), stone ? '#a99d91' : '#6f4a32', pose([cx, top - 0.12 - 0.275, cz], [0, yaw, 0]), 0.1);
  }
  if (stone) return;
  // Limons et main courante (poteaux, corde) : on oriente d'abord (lacet) puis on incline.
  const slope = Math.atan2(yTo - yFrom, length);
  const span = Math.hypot(length, yTo - yFrom);
  const along = (at: Vec3, pitch: number) => pose(at, [0, yaw, 0]).multiply(pose([0, 0, 0], [pitch, 0, 0]));
  for (const side of [-1, 1]) {
    const ox = sideX * side * (width / 2 + 0.05);
    const oz = sideZ * side * (width / 2 + 0.05);
    wood.add(new BoxGeometry(0.08, 0.2, span + 0.2), WOOD_DARK, along([from.x + dx / 2 + ox, (yFrom + yTo) / 2 - 0.1, from.z + dz / 2 + oz], -slope), 0.15);
  }
  for (let post = 0; post < 3; post++) {
    const t = post / 2;
    const px = from.x + dx * t + sideX * (width / 2 + 0.1);
    const pz = from.z + dz * t + sideZ * (width / 2 + 0.1);
    const py = yFrom + (yTo - yFrom) * t;
    wood.add(new CylinderGeometry(0.05, 0.06, 0.95, 6), WOOD_DARK, pose([px, py + 0.38, pz]));
    wood.add(new SphereGeometry(0.06, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#8a5d3b', pose([px, py + 0.86, pz]));
  }
  wood.add(
    new CylinderGeometry(0.025, 0.025, span, 5),
    ROPE,
    along([from.x + dx / 2 + sideX * (width / 2 + 0.1), (yFrom + yTo) / 2 + 0.78, from.z + dz / 2 + sideZ * (width / 2 + 0.1)], Math.PI / 2 - slope),
  );
}

function addPathStones(wood: Pieces, sampler: HeightSampler, points: { x: number; z: number }[], spacing: number, seed: number) {
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[segment];
    const b = points[segment + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const count = Math.max(1, Math.round(length / spacing));
    for (let index = 0; index < count; index++) {
      const t = (index + 0.5) / count;
      const k = seed + segment * 17 + index * 3.3;
      const x = lerp(a.x, b.x, t) + (hash(k) - 0.5) * 0.3;
      const z = lerp(a.z, b.z, t) + (hash(k + 1) - 0.5) * 0.3;
      const size = 0.26 + hash(k + 2) * 0.12;
      wood.add(new CylinderGeometry(1, 1.12, 1, 7), new Color('#d8cfc1').multiplyScalar(0.9 + hash(k + 3) * 0.14), pose([x, groundAt(sampler, x, z, 0.3) + 0.02, z], [0, hash(k + 4) * 3, 0], [size, 0.1, size * (0.78 + hash(k + 5) * 0.3)]), 0.15);
    }
  }
}

/* ---------------------------------------------------------------------- rivage */

/** Rayon où le relief passe sous `level` dans la direction `angle`. */
function shoreRadius(sampler: HeightSampler, angle: number, level: number) {
  for (let radius = 6; radius < 18; radius += 0.1) {
    if (sampler(Math.cos(angle) * radius, Math.sin(angle) * radius) < level) return radius;
  }
  return 12;
}

function angleGap(a: number, b: number) {
  return Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

const ROCK = new DodecahedronGeometry(1, 0);

/** Rochers de granit rose au bord de l'eau, en grappes, hors des passages. */
function addShoreRocks(wood: Pieces, sampler: HeightSampler) {
  const keepClear = [PIER.angle, 1.22, 1.97];
  for (let index = 0; index < 22; index++) {
    const angle = (index / 22) * Math.PI * 2 + (hash(index * 4.1) - 0.5) * 0.2;
    if (angleGap(angle, Math.atan2(DOCK_DIR.z, DOCK_DIR.x)) < 0.32) continue;
    if (keepClear.some((clear) => angleGap(angle, clear) < 0.17)) continue;
    const reach = shoreRadius(sampler, angle, 0.22) + (hash(index * 2.3) - 0.35) * 1.2;
    const cluster = 1 + Math.floor(hash(index * 7.7) * 3);
    for (let stone = 0; stone < cluster; stone++) {
      const a = angle + (hash(index * 3 + stone) - 0.5) * 0.12;
      const r = reach + (hash(index * 5 + stone) - 0.5) * 0.9;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const size = (stone === 0 ? 0.55 : 0.32) + hash(index * 9 + stone) * 0.42;
      const color = new Color(hash(index + stone * 0.5) > 0.45 ? GRANITE_PINK : '#b9aca3').multiplyScalar(0.9 + hash(index * 11 + stone) * 0.16);
      wood.add(ROCK, color, pose([x, sampler(x, z) - size * 0.3, z], [hash(index + stone) * 3, hash(index * 2 + stone) * 3, 0], [size * 1.25, size * 0.8, size]), 0.18);
    }
  }
}

/** Gros blocs autour du sommet de la butte (le phare est posé sur un rocher). */
function addSummitRocks(wood: Pieces, sampler: HeightSampler, frame: LighthouseFrame, doorAngle: number) {
  for (let index = 0; index < 9; index++) {
    const angle = doorAngle + 0.7 + (index / 9) * (Math.PI * 2 - 1.4) + (hash(index * 1.9) - 0.5) * 0.2;
    const reach = 2.25 + hash(index * 4.3) * 0.5;
    const x = frame.x + Math.cos(angle) * reach;
    const z = frame.z + Math.sin(angle) * reach;
    const size = 0.35 + hash(index * 6.1) * 0.35;
    wood.add(ROCK, new Color(GRANITE_PINK).multiplyScalar(0.88 + hash(index * 3.9) * 0.18), pose([x, sampler(x, z) - size * 0.2, z], [hash(index) * 3, hash(index * 2) * 3, 0], [size * 1.3, size * 0.85, size]), 0.18);
  }
}

/**
 * Armérie maritime (« œillets de mer », les pompons roses des falaises bretonnes) au bord
 * du plateau, et quelques touffes d'ajoncs dorés et de pâquerettes sur l'herbe.
 */
function addFlowers(wood: Pieces, sampler: HeightSampler, frame: LighthouseFrame) {
  const dockAngle = Math.atan2(DOCK_DIR.z, DOCK_DIR.x);
  for (let index = 0; index < 40; index++) {
    const angle = (index / 40) * Math.PI * 2 + (hash(index * 2.7) - 0.5) * 0.12;
    if (angleGap(angle, dockAngle) < 0.2 || angleGap(angle, PIER.angle) < 0.1) continue;
    const reach = shoreRadius(sampler, angle, 1.95) - 0.3 - hash(index * 5.1) * 0.7;
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 2.3) continue;
    const y = groundAt(sampler, x, z, 0.15);
    wood.add(new DodecahedronGeometry(0.13, 0), '#4f8a45', pose([x, y + 0.03, z], [0, index, 0], [1, 0.45, 1]));
    const blooms = 2 + Math.floor(hash(index * 3.3) * 3);
    for (let bloom = 0; bloom < blooms; bloom++) {
      const a = bloom * 2.3 + index;
      const r = 0.06 + hash(index + bloom) * 0.08;
      const color = bloom % 3 === 2 ? '#fbe3ee' : bloom % 2 === 0 ? '#f08fb5' : '#e46e9c';
      wood.add(new IcosahedronGeometry(0.055 + hash(index * 7 + bloom) * 0.03, 0), color, pose([x + Math.cos(a) * r, y + 0.1 + hash(bloom + index) * 0.07, z + Math.sin(a) * r]));
    }
  }
  // Ajoncs et pâquerettes sur le plateau, hors des chemins et des bâtiments.
  for (let index = 0; index < 26; index++) {
    const angle = hash(index * 9.13) * Math.PI * 2;
    const reach = 4.6 + hash(index * 4.7) * 3.6;
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 2.7) continue;
    if (Math.hypot(x - frame.x, z - frame.z) < 4.4) continue;
    if (angleGap(angle, dockAngle) < 0.35) continue;
    const y = groundAt(sampler, x, z, 0.2);
    if (y < 1.9) continue;
    const gorse = index % 3 === 0;
    for (let bloom = 0; bloom < (gorse ? 5 : 4); bloom++) {
      const a = bloom * 2.1 + index;
      const r = bloom === 0 ? 0 : 0.09 + hash(index * 2 + bloom) * 0.08;
      wood.add(
        new IcosahedronGeometry(gorse ? 0.085 : 0.05, 0),
        gorse ? (bloom % 2 ? '#f2c14e' : '#e8a93a') : bloom % 2 ? '#fbf6ea' : '#f6e7a3',
        pose([x + Math.cos(a) * r, y + (gorse ? 0.14 : 0.07), z + Math.sin(a) * r]),
      );
    }
  }
}

/** Petit canot à rames tiré sur le sable : coque orange, liseré blanc, bancs, avirons. */
function addRowboat(wood: Pieces, sampler: HeightSampler) {
  const angle = 1.22;
  const at = polar(angle, 10.85);
  const hull = new BoxGeometry(1.0, 0.42, 2.3, 2, 3, 8);
  const positions = hull.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    const z = positions.getZ(index) / 1.15;
    // Pointe à l'avant (+Z), tableau arrière plus large, quille plus étroite.
    const taper = z > 0 ? 1 - z * z * 0.92 : 1 - z * z * 0.35;
    const keel = y < 0 ? 0.62 : 1;
    positions.setX(index, positions.getX(index) * Math.max(0.04, taper) * keel);
    positions.setY(index, y + (Math.abs(z) ** 2) * 0.12);
  }
  hull.computeVertexNormals();
  const yaw = Math.atan2(Math.cos(angle), Math.sin(angle));
  const ground = groundAt(sampler, at.x, at.z, 0.9);
  const matrix = pose([at.x, ground + 0.12, at.z], [0.06, yaw, 0.16]);
  wood.addLocal(hull, (_x, y, z, ny, out) => {
    // Coque orange, liseré blanc au plat-bord, intérieur en bois.
    if (ny > 0.6) out.set('#8a5a3c');
    else if (y > 0.08 + (z / 1.15) ** 2 * 0.12) out.set('#f5efe3');
    else out.set('#e8743b');
  }, matrix, 0.1);
  for (const seat of [-0.35, 0.4]) {
    wood.add(new BoxGeometry(0.84, 0.05, 0.2), '#c08752', matrix.clone().multiply(pose([0, 0.2, seat])), 0.15);
  }
  wood.add(new BoxGeometry(0.06, 0.04, 2.2), '#d9b27a', matrix.clone().multiply(pose([0.18, 0.27, 0.05], [0, 0.08, 0])));
  wood.add(new BoxGeometry(0.16, 0.02, 0.42), '#d9b27a', matrix.clone().multiply(pose([0.22, 0.27, 1.05], [0, 0.08, 0])));
}

/** Casiers, caisses et flotteurs au pied de l'escalier du ponton. */
function addHarborClutter(wood: Pieces, sampler: HeightSampler) {
  const crate = onDockAxis(10.25, -1.75);
  const ground = groundAt(sampler, crate.x, crate.z, 0.5);
  const yaw = Math.atan2(DOCK_DIR.x, DOCK_DIR.z);
  wood.add(bevelBox(0.62, 0.5, 0.62, 0.03), '#b98a57', pose([crate.x, ground + 0.22, crate.z], [0, yaw + 0.3, 0]), 0.22);
  wood.add(bevelBox(0.5, 0.42, 0.5, 0.03), '#a8784a', pose([crate.x + 0.08, ground + 0.66, crate.z + 0.05], [0, yaw + 0.9, 0]), 0.22);
  // Casier à homards : arceaux de filet sur un fond de bois.
  const pot = onDockAxis(10.65, -2.6);
  const potGround = groundAt(sampler, pot.x, pot.z, 0.5);
  const potMatrix = pose([pot.x, potGround + 0.02, pot.z], [0, yaw - 0.5, 0]);
  wood.add(new BoxGeometry(0.75, 0.06, 0.5), '#8a5d3b', potMatrix.clone().multiply(pose([0, 0.03, 0])), 0.15);
  for (const hoop of [-0.3, 0, 0.3]) {
    wood.add(new TorusGeometry(0.25, 0.022, 4, 10, Math.PI), '#6b8a6a', potMatrix.clone().multiply(pose([hoop, 0.05, 0], [0, Math.PI / 2, 0])));
  }
  wood.add(new CylinderGeometry(0.25, 0.25, 0.62, 10, 1, true, 0, Math.PI), '#7f9b7c', potMatrix.clone().multiply(pose([0, 0.05, 0], [0, 0, Math.PI / 2])), 0.05);
  // Flotteurs de pêche empilés (orange et blanc).
  for (let index = 0; index < 4; index++) {
    const spot = onDockAxis(10.0 + (index % 2) * 0.32, -2.55 + Math.floor(index / 2) * 0.34);
    const g = groundAt(sampler, spot.x, spot.z, 0.2);
    wood.add(new SphereGeometry(0.16, 8, 6), index % 2 === 0 ? '#ef7a3a' : '#f5efe3', pose([spot.x, g + 0.13, spot.z]), 0.1);
  }
  // Rouleau de cordage sur le sable.
  const coil = onDockAxis(10.3, 1.45);
  const coilGround = groundAt(sampler, coil.x, coil.z, 0.3);
  wood.add(new TorusGeometry(0.24, 0.06, 5, 14), ROPE, pose([coil.x, coilGround + 0.06, coil.z], [Math.PI / 2, 0, 0]));
  wood.add(new TorusGeometry(0.14, 0.06, 5, 12), ROPE, pose([coil.x, coilGround + 0.15, coil.z], [Math.PI / 2, 0, 0]));
}

/* ------------------------------------------------------------- bouteilles (plage) */

export function bottleProfile() {
  const points = [
    [0.0, 0.0], [0.26, 0.0], [0.3, 0.06], [0.31, 0.62], [0.27, 0.78], [0.14, 0.9],
    [0.1, 0.98], [0.1, 1.16], [0.12, 1.2], [0.12, 1.24], [0.0, 1.24],
  ];
  return new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), 14);
}

/** Bouteilles échouées sur la plage : verre (maillage transparent) + parchemins et bouchons. */
export function beachBottles(sampler: HeightSampler) {
  const spots = [
    { at: onDockAxis(10.1, 1.75), yaw: 0.6, lie: true, glass: '#7ec9ad' },
    { at: onDockAxis(10.45, 2.45), yaw: 2.3, lie: true, glass: '#d9a25a' },
    { at: onDockAxis(9.95, 2.95), yaw: -0.4, lie: false, glass: '#86b9dc' },
  ];
  return spots.map(({ at, yaw, lie, glass }) => {
    const ground = groundAt(sampler, at.x, at.z, 0.25);
    const scale = 0.62;
    // Couchée : le goulot vers la mer ; debout : plantée de travers dans le sable.
    const matrix = lie
      ? pose([at.x, ground + 0.12, at.z], [Math.PI / 2 - 0.12, yaw, 0.05], scale)
      : pose([at.x, ground - 0.18, at.z], [0.32, yaw, 0.22], scale);
    return { matrix, glass };
  });
}

function addBottleInsides(wood: Pieces, bottles: ReturnType<typeof beachBottles>) {
  for (const { matrix } of bottles) {
    wood.add(new CylinderGeometry(0.13, 0.13, 0.55, 8), '#f3e6c4', matrix.clone().multiply(pose([0, 0.42, 0])));
    wood.add(new CylinderGeometry(0.11, 0.095, 0.16, 8), '#a57a4c', matrix.clone().multiply(pose([0, 1.3, 0])));
  }
}

/* --------------------------------------------------------- cloche et boîte aux lettres */

/** Poteau de la cloche : point d'accroche (pivot) de la cloche, repère de l'île. */
export function bellPivot(sampler: HeightSampler): Vec3 {
  const ground = groundAt(sampler, BELL.x, BELL.z, 0.3);
  return [BELL.x + DOCK_SIDE.x * 0.6, ground + 2.12, BELL.z + DOCK_SIDE.z * 0.6];
}

function addBellPost(wood: Pieces, sampler: HeightSampler) {
  const ground = groundAt(sampler, BELL.x, BELL.z, 0.3);
  const yaw = Math.atan2(DOCK_SIDE.x, DOCK_SIDE.z);
  const frame = pose([BELL.x, ground, BELL.z], [0, yaw, 0]);
  const put = (geometry: Parameters<Pieces['add']>[0], color: string, at: Vec3, rotation: Vec3 = [0, 0, 0], shade = 0.15) =>
    wood.add(geometry, color, frame.clone().multiply(pose(at, rotation)), shade);
  put(new BoxGeometry(0.44, 0.16, 0.44), GRANITE, [0, 0.04, 0]);
  put(bevelBox(0.2, 2.42, 0.2, 0.03), WOOD_DARK, [0, 1.17, 0]);
  put(new BoxGeometry(0.14, 0.14, 0.8), WOOD_DARK, [0, 2.3, 0.3]);
  put(new BoxGeometry(0.1, 0.1, 0.58), '#6a442d', [0, 2.06, 0.18], [Math.PI / 4, 0, 0]);
  put(new ConeGeometry(0.17, 0.16, 4), '#8a5d3b', [0, 2.45, 0], [0, Math.PI / 4, 0]);
  // Crochet de fer.
  put(new TorusGeometry(0.05, 0.016, 4, 8), IRON, [0, 2.18, 0.6], [0, Math.PI / 2, 0], 0);
}

/** Boîte aux lettres : repère (sol) de son poteau ; la boîte elle-même est animée. */
export function mailboxFrame(sampler: HeightSampler) {
  const ground = groundAt(sampler, MAILBOX.x, MAILBOX.z, 0.3);
  return { position: [MAILBOX.x, ground, MAILBOX.z] as Vec3, yaw: Math.atan2(DOCK_DIR.x, DOCK_DIR.z) };
}

function addMailboxPost(wood: Pieces, sampler: HeightSampler) {
  const { position, yaw } = mailboxFrame(sampler);
  const frame = pose(position, [0, yaw, 0]);
  wood.add(bevelBox(0.13, 1.12, 0.13, 0.02), '#7a5236', frame.clone().multiply(pose([0, 0.5, -0.05])), 0.15);
  wood.add(new BoxGeometry(0.12, 0.08, 0.5), '#7a5236', frame.clone().multiply(pose([0, 1.02, 0])), 0.15);
  wood.add(new BoxGeometry(0.34, 0.1, 0.34), GRANITE, frame.clone().multiply(pose([0, 0.0, -0.05])), 0.15);
}

/* ------------------------------------------------------------------- assemblage */

export function buildIsland(sampler: HeightSampler, features: TerrainFeatures) {
  const wood = new Pieces();
  const frame = lighthouseFrame(features);
  const stairs = hillStairs(features.hillX, features.hillZ);
  const doorAngle = Math.atan2(stairs.dirZ, stairs.dirX);

  addLighthouse(wood, frame, doorAngle);
  addSummitRocks(wood, sampler, frame, doorAngle);
  addCottage(wood, cottageMatrix(sampler));

  // Escalier du ponton (bois), escalier du phare (granit).
  const flat = features.plateau + 0.04;
  addStairs(wood, {
    from: onDockAxis(DOCK_STAIRS.bottom),
    to: onDockAxis(DOCK_STAIRS.top),
    yFrom: 0.78,
    yTo: flat,
    steps: 6,
    width: 1.5,
  });
  const hillFrom = { x: features.hillX + stairs.dirX * stairs.to, z: features.hillZ + stairs.dirZ * stairs.to };
  const hillTo = { x: features.hillX + stairs.dirX * (stairs.from + 0.15), z: features.hillZ + stairs.dirZ * (stairs.from + 0.15) };
  addStairs(wood, { from: hillFrom, to: hillTo, yFrom: flat, yTo: frame.base, steps: 6, width: 1.1, stone: true });

  // Sentier : du haut de l'escalier du ponton vers le phare, et vers la maison.
  const landing = onDockAxis(DOCK_STAIRS.top - 0.35);
  const cottage = cottageMatrix(sampler);
  const door = fromCottage(cottage, [0, 0, COTTAGE.depth / 2 + 0.7]);
  addPathStones(wood, sampler, [landing, hillFrom], 0.75, 3);
  addPathStones(wood, sampler, [landing, onDockAxis(7.2, -1.1), { x: lerp(landing.x, door[0], 0.6) + 0.3, z: lerp(landing.z, door[2], 0.6) - 0.6 }, { x: door[0], z: door[2] }], 0.78, 11);

  addShoreRocks(wood, sampler);
  addFlowers(wood, sampler, frame);
  addRowboat(wood, sampler);
  addHarborClutter(wood, sampler);
  addBellPost(wood, sampler);
  addMailboxPost(wood, sampler);
  const bottles = beachBottles(sampler);
  addBottleInsides(wood, bottles);

  return { geometry: wood.build()!, frame, doorAngle, bottles };
}

/* ------------------------------------------------------------- longue jetée */

/** Lanternes de la jetée, dans le repère de la jetée (x le long de la jetée). */
export function pierLanterns(): Vec3[] {
  const deck = PIER_DECK;
  return [
    [11.35, deck + 1.62, -(PIER.half + 0.03)],
    [13.35, deck + 1.62, PIER.half + 0.03],
    [15.35, deck + 1.62, -(PIER.half + 0.03)],
    [PIER.end - 0.14, deck + 1.62, PIER.headHalf + 0.03],
  ];
}

export const PIER_DECK = 0.84;

/** Banc du bout de la jetée, tourné vers le couchant (repère de la jetée). */
export function benchPose() {
  const facing = Math.atan2(SUNSET_DIR.z, SUNSET_DIR.x) - PIER.angle;
  const dirX = Math.cos(facing);
  const dirZ = Math.sin(facing);
  return { at: [PIER.end - 1.0, PIER_DECK, 0.55] as Vec3, yaw: Math.atan2(dirX, dirZ) };
}

export function buildPier() {
  const wood = new Pieces();
  const { start, end, half, head, headHalf } = PIER;
  const deck = PIER_DECK;
  const seed = 404;
  addDeck(wood, { start, end: end - head + 0.06, half, deck, seed });
  addDeck(wood, { start: end - head, end, half: headHalf, deck: deck + 0.004, seed: seed + 9 });

  const lanterns = pierLanterns();
  const lanternAt = (x: number, z: number) => lanterns.some(([lx, , lz]) => Math.abs(lx - x) < 0.2 && Math.sign(lz) === Math.sign(z));
  const bents = [11.35, 13.35, 15.35];
  bents.forEach((x, bent) => {
    for (const side of [-1, 1]) {
      const z = side * (half + 0.03);
      if (lanternAt(x, z)) continue;
      addPile(wood, { x, z, top: deck + 0.22 + hash(bent * 2 + side) * 0.3, radius: 0.15 + hash(bent + side * 3) * 0.04, rope: (bent + side) % 2 === 0, seed: seed + bent * 5 + side });
    }
    wood.add(new BoxGeometry(0.17, 0.13, half * 2 + 0.36), BEAM, pose([x, deck - THICK - 0.2, 0]), 0.18);
    wood.add(new BoxGeometry(0.06, 0.1, Math.hypot(half * 2, 0.95)), '#6a442d', pose([x + 0.12, deck - THICK - 0.75, 0], [Math.atan2(0.95, half * 2) * (bent % 2 ? -1 : 1), 0, 0]), 0.15);
  });
  // Tête en T : quatre pieux d'angle (l'un porte une lanterne).
  for (const x of [end - head + 0.14, end - 0.14]) {
    for (const side of [-1, 1]) {
      const z = side * (headHalf + 0.03);
      if (lanternAt(x, z)) continue;
      addPile(wood, { x, z, top: deck + 0.3 + hash(x + side) * 0.22, radius: 0.17, rope: side > 0, seed: seed + x * 3 + side });
    }
    wood.add(new BoxGeometry(0.17, 0.13, headHalf * 2 + 0.36), BEAM, pose([x, deck - THICK - 0.2, 0]), 0.18);
  }
  lanterns.forEach(([x, y, z], index) => addLanternPost(wood, { x, y, z, seed: seed + index * 13 }));

  // Bouée de sauvetage sur la tête, côté large.
  const buoy: Vec3 = [end - head + 0.75, deck + 0.02, -(headHalf + 0.3)];
  wood.addLocal(new TorusGeometry(0.3, 0.085, 6, 16), (bx, by, _z, _ny, out) => {
    const turn = Math.atan2(by, bx) + Math.PI;
    out.set(Math.floor(turn / (Math.PI / 4)) % 2 === 0 ? '#e0533d' : '#f5efe3');
  }, pose(buoy, [-0.1, 0, -0.15]));
  wood.add(new BoxGeometry(0.12, 0.6, 0.08), WOOD_DARK, pose([buoy[0], deck - 0.05, -(headHalf + 0.12)]));

  // Banc face au couchant : pieds en fonte, lattes bleu océan.
  const { at, yaw } = benchPose();
  const bench = pose(at, [0, yaw, 0]);
  const put = (geometry: Parameters<Pieces['add']>[0], color: string, local: Vec3, rotation: Vec3 = [0, 0, 0], shade = 0.16) =>
    wood.add(geometry, color, bench.clone().multiply(pose(local, rotation)), shade);
  for (const side of [-0.72, 0.72]) {
    put(new BoxGeometry(0.07, 0.44, 0.07), DARK, [side, 0.22, 0.18]);
    put(new BoxGeometry(0.07, 0.9, 0.07), DARK, [side, 0.45, -0.2], [-0.12, 0, 0]);
    put(new BoxGeometry(0.07, 0.06, 0.5), DARK, [side, 0.42, 0]);
    put(new BoxGeometry(0.07, 0.05, 0.42), DARK, [side, 0.66, 0.02], [0.05, 0, 0]);
  }
  for (const slat of [-0.15, 0, 0.15]) put(new BoxGeometry(1.62, 0.05, 0.12), '#4f97b0', [0, 0.47, slat + 0.02]);
  for (const slat of [0.62, 0.8]) put(new BoxGeometry(1.62, 0.12, 0.04), '#4f97b0', [0, slat, -0.24 - (slat - 0.62) * 0.12], [-0.12, 0, 0]);
  // Une tasse oubliée sur le banc.
  put(new CylinderGeometry(0.05, 0.045, 0.1, 8), '#f5efe3', [0.48, 0.55, 0.05], [0, 0, 0], 0.05);

  return wood.build()!;
}

/** Perchoir du goéland : la tête d'un pieu d'angle de la jetée (repère de l'île). */
export function gullPerch() {
  const x = PIER.end - PIER.head + 0.14;
  const z = PIER.headHalf + 0.03;
  const top = PIER_DECK + 0.3 + hash(x + 1) * 0.22 + 0.15;
  const cos = Math.cos(PIER.angle);
  const sin = Math.sin(PIER.angle);
  return { position: [x * cos - z * sin, top, x * sin + z * cos] as Vec3, yaw: Math.atan2(SUNSET_DIR.x, SUNSET_DIR.z) };
}

/** Positions (repère de l'île) des lueurs : lanternes de la jetée, lampe de la porte. */
export function glowSpots(sampler: HeightSampler): Vec3[] {
  const cos = Math.cos(PIER.angle);
  const sin = Math.sin(PIER.angle);
  const pier = pierLanterns().map(([x, y, z]) => [x * cos - z * sin, y, x * sin + z * cos] as Vec3);
  return [...pier, fromCottage(cottageMatrix(sampler), DOOR_LAMP)];
}
