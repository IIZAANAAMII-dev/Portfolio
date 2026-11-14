import { ExtrudeGeometry, IcosahedronGeometry, Matrix4, Shape, type ColorRepresentation } from 'three';
import { hash } from '@/lib/utils/math';
import type { HousePlan } from './layout';
import { Mesher, pose, type Vec3 } from './mesher';

/**
 * Maisons de granit bretonnes, construites pièce par pièce dans le repère de la maison :
 * origine au sol au centre de l'emprise, façade (mur gouttereau avec la porte) vers +Z.
 *
 * Murs épais en moellons (ou chaulés), pierres d'angle claires, pignons couronnés de
 * granit, toit d'ardoise à 45° et faîtage de terre cuite, cheminées blanchies à la chaux
 * sur les pignons, fenêtres à petits carreaux encadrées de granit, volets peints,
 * jardinières fleuries et hortensias au pied de la porte.
 */

export const WALL = 0.32;
const PLINTH = 0.8;
const ROOF_THICKNESS = 0.2;
const EAVE = 0.28;

export const GRANITE_LIGHT = '#dcd5c7';
const GRANITE_MID = '#cfc7b8';
const WHITEWASH = '#f3efe6';
const FRAME = '#f6f3ec';
const TERRACOTTA = '#b8654a';
const WOOD = '#8a5d3b';
const LEAVES = '#4f7f3a';
const HYDRANGEAS = ['#7b95de', '#a58ad6', '#e59bbd', '#8fb0ea'];
const GERANIUMS = ['#d8433b', '#e8678f', '#f4f0f0', '#e2553f'];

export interface GlassSpec {
  matrix: Matrix4;
  width: number;
  height: number;
  seed: number;
}

/** Ce que construit une maison : un atelier de pièces par matériau. */
export interface HouseParts {
  /** Murs de granit apparent (texturés, UV en mètres). */
  walls: Mesher;
  /** Toit d'ardoise (texturé). */
  roof: Mesher;
  /** Tout le reste, peint par sommet (pierres d'angle, volets, chaux, fleurs…). */
  details: Mesher;
  glass: GlassSpec[];
}

export type HouseSection = 'body' | 'front' | 'roof';

export interface HouseInfo {
  /** Hauteur du faîtage (repère de la maison). */
  ridge: number;
  /** Sommets des cheminées (repère de la maison), pour la fumée. */
  chimneys: { side: 'left' | 'right'; top: Vec3 }[];
  /** Perchoirs possibles pour les goélands : bouts de faîtage. */
  perches: Vec3[];
}

const blob = new IcosahedronGeometry(1, 1);
const bud = new IcosahedronGeometry(1, 0);

/** Prisme d'un pignon : rectangle surmonté d'un triangle, dans le plan (z, y), épaisseur sur x. */
function gableGeometry(depth: number, wall: number, rise: number, thickness: number) {
  const shape = new Shape();
  shape.moveTo(-depth / 2, -PLINTH);
  shape.lineTo(depth / 2, -PLINTH);
  shape.lineTo(depth / 2, wall);
  shape.lineTo(0, wall + rise);
  shape.lineTo(-depth / 2, wall);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // Le plan du dessin (x, y) devient (z, y) ; l'épaisseur est centrée sur x = 0.
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

interface Opening {
  x: number;
  /** Bas de l'ouverture. */
  y: number;
  width: number;
  height: number;
  shutters?: boolean;
  flowers?: boolean;
}

/**
 * Une fenêtre sur la face +Z d'un mur dont la surface extérieure est en z = `face`.
 * `matrix` replace la fenêtre sur la bonne façade.
 */
function addWindow(parts: HouseParts, matrix: Matrix4, face: number, opening: Opening, paint: string, seed: number) {
  const { x, y, width, height } = opening;
  const local = parts.details.within(matrix);
  const top = y + height;
  const cy = y + height / 2;
  // Encadrement de granit : linteau, appui, jambages.
  local.box([width + 0.36, 0.22, 0.1], [x, top + 0.12, face + 0.03], [0, 0, 0], GRANITE_LIGHT);
  local.box([width + 0.26, 0.08, 0.16], [x, y - 0.05, face + 0.07], [0, 0, 0], GRANITE_LIGHT);
  for (const side of [-1, 1]) {
    local.box([0.12, height + 0.02, 0.08], [x + side * (width / 2 + 0.07), cy, face + 0.025], [0, 0, 0], GRANITE_MID);
  }
  // Dormant blanc et petits bois (trois rangs de carreaux).
  local.box([width, 0.06, 0.05], [x, top - 0.03, face + 0.03], [0, 0, 0], FRAME);
  local.box([width, 0.06, 0.05], [x, y + 0.03, face + 0.03], [0, 0, 0], FRAME);
  local.box([0.06, height, 0.05], [x - width / 2 + 0.03, cy, face + 0.03], [0, 0, 0], FRAME);
  local.box([0.06, height, 0.05], [x + width / 2 - 0.03, cy, face + 0.03], [0, 0, 0], FRAME);
  local.box([0.045, height, 0.035], [x, cy, face + 0.025], [0, 0, 0], FRAME);
  for (const row of [1 / 3, 2 / 3]) local.box([width, 0.035, 0.035], [x, y + height * row, face + 0.025], [0, 0, 0], FRAME);
  // Volets ouverts, plaqués contre le mur, avec leurs deux barres.
  if (opening.shutters !== false) {
    for (const side of [-1, 1]) {
      const cx = x + side * (width / 2 + 0.16 + width / 4);
      local.box([width / 2 + 0.02, height + 0.06, 0.05], [cx, cy, face + 0.035], [0, 0, 0], paint);
      for (const row of [0.22, 0.78]) {
        local.box([width / 2 - 0.04, 0.07, 0.03], [cx, y + height * row, face + 0.07], [0, 0, 0], '#ffffff');
      }
    }
  }
  // Jardinière de géraniums.
  if (opening.flowers) {
    local.box([width + 0.12, 0.17, 0.2], [x, y - 0.17, face + 0.16], [0, 0, 0], WOOD);
    local.add(blob, pose([x, y - 0.06, face + 0.16], [0, 0, 0], [width / 2, 0.1, 0.11]), LEAVES);
    const count = Math.max(3, Math.round(width * 6));
    for (let index = 0; index < count; index++) {
      const fx = x - width / 2 + 0.08 + (index / (count - 1)) * (width - 0.16);
      const color = GERANIUMS[Math.floor(hash(seed * 3.1 + index * 1.7) * GERANIUMS.length)];
      local.add(bud, pose([fx, y + 0.02 + hash(seed + index) * 0.05, face + 0.12 + hash(index * 2.3 + seed) * 0.08], [index, index * 2, 0], 0.065), color);
    }
  }
  local.within(null);
  parts.glass.push({
    matrix: matrix.clone().multiply(pose([x, cy, face + 0.012])),
    width: width - 0.04,
    height: height - 0.04,
    seed,
  });
}

/** Porte de bois peint dans un encadrement de granit, marche de pierre. */
function addDoor(parts: HouseParts, face: number, x: number, paint: string) {
  const { details } = parts;
  details.box([0.9, 1.82, 0.07], [x, 0.91, face + 0.02], [0, 0, 0], paint);
  // Planches : deux joints plus sombres, et une imposte vitrée.
  for (const offset of [-0.22, 0.22]) details.box([0.025, 1.5, 0.02], [x + offset, 0.8, face + 0.06], [0, 0, 0], '#2b2b33');
  details.box([0.62, 0.2, 0.02], [x, 1.62, face + 0.06], [0, 0, 0], '#36506b');
  details.add(bud, pose([x + 0.32, 0.95, face + 0.08], [0, 0, 0], 0.045), '#e8c25a');
  for (const side of [-1, 1]) details.box([0.15, 1.98, 0.1], [x + side * 0.53, 0.99, face + 0.03], [0, 0, 0], GRANITE_LIGHT);
  details.box([1.32, 0.24, 0.12], [x, 2.02, face + 0.04], [0, 0, 0], GRANITE_LIGHT);
  details.box([1.25, 0.14, 0.42], [x, 0.03, face + 0.2], [0, 0, 0], GRANITE_MID);
}

/** Hortensias : boules de fleurs bleues, mauves ou roses sur un pied de feuilles. */
export function addHydrangea(details: Mesher, position: Vec3, seed: number, size = 1) {
  const [x, y, z] = position;
  details.add(blob, pose([x, y + 0.25 * size, z], [0, seed, 0], [0.55 * size, 0.38 * size, 0.45 * size]), LEAVES);
  const color = HYDRANGEAS[Math.floor(hash(seed * 1.9) * HYDRANGEAS.length)];
  for (let index = 0; index < 4; index++) {
    const angle = index * 1.7 + seed;
    details.add(
      blob,
      pose(
        [x + Math.cos(angle) * 0.28 * size, y + (0.48 + hash(seed + index) * 0.12) * size, z + Math.sin(angle) * 0.2 * size],
        [index, seed, 0],
        (0.2 + hash(seed * 2.2 + index) * 0.06) * size,
      ),
      color,
    );
  }
}

/**
 * Cheminée de pignon : souche blanchie à la chaux, chaperon de granit, deux mitrons.
 * Renvoie le haut des mitrons (départ de la fumée).
 */
function addChimney(details: Mesher, x: number, base: number, top: number, depth = 0.86): Vec3 {
  const height = top - base;
  details.box([0.66, height, depth], [x, base + height / 2, 0], [0, 0, 0], WHITEWASH);
  details.box([0.8, 0.12, depth + 0.14], [x, top + 0.06, 0], [0, 0, 0], GRANITE_LIGHT);
  for (const offset of [-0.2, 0.2]) {
    details.box([0.2, 0.3, 0.2], [x, top + 0.27, offset], [0, 0, 0], TERRACOTTA);
  }
  return [x, top + 0.45, 0];
}

/**
 * Construit une maison. `pick` choisit l'atelier de chaque section : pour une maison
 * ordinaire tout va au même endroit ; l'atelier de Kyliann sépare façade et toit, qui
 * s'animent.
 */
export function buildHouse(plan: HousePlan, pick: (section: HouseSection) => HouseParts, options: { door?: number } = {}): HouseInfo {
  const width = plan.width;
  const depth = plan.depth;
  const wall = plan.wall;
  const rise = depth * 0.5 * (plan.kind === 'penty' ? 1.08 : 1);
  const slope = Math.atan2(rise, depth / 2);
  const front = depth / 2;
  const body = pick('body');
  const facade = pick('front');
  const roofParts = pick('roof');
  const wallColor: ColorRepresentation = WHITEWASH;
  const seed = hash(plan.angle * 13.7) * 100;

  // --- Murs (posés 0,8 m sous le sol : aucun jour sur un terrain imparfait).
  const addWall = (parts: HouseParts, size: Vec3, position: Vec3) => {
    if (plan.white) parts.details.box(size, position, [0, 0, 0], wallColor);
    else parts.walls.box(size, position);
  };
  const inner = width - WALL * 2;
  addWall(facade, [inner, wall + PLINTH, WALL], [0, (wall - PLINTH) / 2, front - WALL / 2]);
  addWall(body, [inner, wall + PLINTH, WALL], [0, (wall - PLINTH) / 2, -front + WALL / 2]);
  const gable = gableGeometry(depth, wall, rise, WALL);
  for (const side of [-1, 1]) {
    const matrix = pose([side * (width / 2 - WALL / 2), 0, 0]);
    if (plan.white) body.details.add(gable, matrix, wallColor);
    else body.walls.add(gable, matrix);
  }
  gable.dispose();

  // --- Pierres d'angle (chaînage) : blocs alternés, légèrement saillants.
  const rows = Math.ceil((wall + 0.1) / 0.3);
  for (let row = 0; row < rows; row++) {
    const y = -0.05 + row * 0.3 + 0.15;
    const long = row % 2 === 0;
    const tone = row % 3 === 1 ? GRANITE_MID : GRANITE_LIGHT;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const size: Vec3 = long ? [0.52, 0.27, 0.36] : [0.36, 0.27, 0.52];
        body.details.box(
          size,
          [sx * (width / 2 - size[0] / 2 + 0.014), y, sz * (depth / 2 - size[2] / 2 + 0.014)],
          [0, 0, 0],
          tone,
        );
      }
    }
  }

  // --- Toit : deux pans d'ardoise, faîtage de terre cuite, rampants de granit.
  const run = depth / 2 + EAVE;
  const length = run / Math.cos(slope);
  for (const side of [-1, 1]) {
    const midZ = (side * run) / 2;
    const midY = wall + rise - (run / 2) * Math.tan(slope);
    roofParts.roof.box(
      [width + 0.04, ROOF_THICKNESS, length],
      [0, midY + (Math.cos(slope) * ROOF_THICKNESS) / 2, midZ + (side * Math.sin(slope) * ROOF_THICKNESS) / 2],
      [side * slope, 0, 0],
    );
  }
  const ridge = wall + rise + ROOF_THICKNESS / Math.cos(slope);
  roofParts.details.box([width + 0.1, 0.17, 0.17], [0, ridge - 0.03, 0], [Math.PI / 4, 0, 0], TERRACOTTA);
  // Rampants : le pignon dépasse un peu du toit, coiffé de dalles de granit.
  const rake = Math.hypot(depth / 2 + 0.1, rise);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.details.box(
        [WALL + 0.08, 0.18, rake],
        [sx * (width / 2 - WALL / 2), wall + rise / 2 + 0.3, (sz * (depth / 2 + 0.1)) / 2],
        [sz * slope, 0, 0],
        GRANITE_LIGHT,
      );
    }
    // Crossette : le bloc saillant au pied de chaque rampant.
    for (const sz of [-1, 1]) {
      body.details.box([WALL + 0.12, 0.24, 0.4], [sx * (width / 2 - WALL / 2), wall + 0.05, sz * (depth / 2 - 0.05)], [0, 0, 0], GRANITE_LIGHT);
    }
  }

  // --- Cheminées sur les pignons.
  const chimneys: HouseInfo['chimneys'] = [];
  for (const side of plan.chimneys) {
    const sx = side === 'left' ? -1 : 1;
    const top = wall + rise + (plan.kind === 'capitaine' ? 0.95 : 0.8);
    chimneys.push({ side, top: addChimney(body.details, sx * (width / 2 - 0.36), wall + rise * 0.45, top) });
  }

  // --- Ouvertures de la façade.
  const doorX = options.door ?? (plan.kind === 'capitaine' ? 0 : plan.kind === 'longere' ? -0.45 : -width * 0.2);
  addDoor(facade, front, doorX, plan.paint);
  const windows: Opening[] = [];
  const low = 0.9;
  if (plan.kind === 'longere') {
    windows.push({ x: -2.25, y: low, width: 0.74, height: 0.95, flowers: true });
    windows.push({ x: 1.35, y: low, width: 0.74, height: 0.95, flowers: true });
    windows.push({ x: 2.55, y: low + 0.15, width: 0.5, height: 0.7, shutters: false });
  } else if (plan.kind === 'capitaine') {
    windows.push({ x: -1.35, y: low, width: 0.72, height: 1.0, flowers: true });
    windows.push({ x: 1.35, y: low, width: 0.72, height: 1.0, flowers: true });
    for (const x of [-1.35, 0, 1.35]) windows.push({ x, y: 2.55, width: 0.66, height: 0.88, flowers: x === 0 });
  } else if (plan.kind === 'penty') {
    windows.push({ x: 0.95, y: low, width: 0.72, height: 0.92, flowers: true });
  }
  const facadeMatrix = new Matrix4();
  windows.forEach((opening, index) => addWindow(facade, facadeMatrix, front, opening, plan.paint, seed + index * 7.1));

  // --- Arrière : deux fenêtres (ou une), sans fleurs, volets fermés d'un côté.
  const back = pose([0, 0, 0], [0, Math.PI, 0]);
  const backWindows: Opening[] = plan.kind === 'penty'
    ? [{ x: 0.4, y: low, width: 0.6, height: 0.8 }]
    : [{ x: -width * 0.22, y: low, width: 0.66, height: 0.88 }, { x: width * 0.24, y: low, width: 0.66, height: 0.88 }];
  backWindows.forEach((opening, index) => addWindow(body, back, front, opening, plan.paint, seed + 40 + index * 5.3));

  // --- Lucarne d'œil-de-bœuf dans chaque pignon (les combles éclairés la nuit).
  for (const sx of [-1, 1]) {
    if (plan.kind === 'penty' && sx < 0) continue;
    const gableMatrix = pose([0, 0, 0], [0, (sx * Math.PI) / 2, 0]);
    addWindow(body, gableMatrix, width / 2, { x: 0, y: wall + rise * 0.18, width: 0.42, height: 0.5, shutters: false }, plan.paint, seed + 90 + sx);
  }

  // --- Hortensias au pied de la façade.
  addHydrangea(body.details, [doorX + 0.95, 0, front + 0.45], seed);
  if (plan.kind !== 'penty') addHydrangea(body.details, [-width / 2 + 0.55, 0, front + 0.5], seed + 3.3, 0.85);

  return {
    ridge,
    chimneys,
    perches: [
      [-width / 2 + 0.7, ridge + 0.06, 0],
      [width / 2 - 0.9, ridge + 0.06, 0],
    ],
  };
}
