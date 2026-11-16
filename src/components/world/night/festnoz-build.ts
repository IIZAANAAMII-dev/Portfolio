import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundAt, type HeightSampler } from '@/components/islands/terrain-shape';
import { hash } from '@/lib/utils/math';

/**
 * Le fest-noz de l'îlot breton : plan (dans le repère de l'îlot) et géométries procédurales.
 *  - une ronde d'an-dro autour d'un petit feu (tantad), sur le replat à l'est du phare ;
 *  - une estrade de planches où jouent les sonneurs (bombarde et biniou) ;
 *  - des guirlandes de lampions tendues de la galerie du phare à trois mâts.
 * Les danseurs sont une seule géométrie (instanciée) dont chaque sommet porte sa « pièce »
 * (corps, bras, jambes : animées sur le GPU), sa variante (coiffe et jupe pour les danseuses,
 * chapeau rond et marinière pour les danseurs) et ses zones de teinture (couleurs propres à
 * chaque danseur).
 */

export type V3 = [number, number, number];

const euler = new Euler();
const quaternion = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const tint = new Color();

export function place(at: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: number | V3 = 1) {
  euler.set(rotation[0], rotation[1], rotation[2]);
  quaternion.setFromEuler(euler);
  offset.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') stretch.setScalar(scale);
  else stretch.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(offset, quaternion, stretch);
}

type Paint = string | ((x: number, y: number, z: number) => string);

/**
 * Atelier de pièces peintes, fusionnées en un maillage. Chaque pièce reçoit une couleur de
 * sommet et, au besoin, son attribut d'animation `aPiece` : pièce, variante, teinture du haut
 * et du bas (le blanc pur y est remplacé par les couleurs du danseur).
 */
class Kit {
  private parts: BufferGeometry[] = [];
  constructor(private readonly animated = false) {}

  add(source: BufferGeometry, matrix: Matrix4, paint: Paint, part = 0, variant = 0, dye: [number, number] = [0, 0]) {
    const piece = source.index ? source.toNonIndexed() : source.clone();
    source.dispose();
    piece.applyMatrix4(matrix);
    if (piece.attributes.uv) piece.deleteAttribute('uv');
    piece.computeVertexNormals();
    const positions = piece.attributes.position;
    const count = positions.count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 3) {
      // Peinture évaluée au centre du triangle : bandes nettes (marinière, planches).
      const first = index;
      const cx = (positions.getX(first) + positions.getX(first + 1) + positions.getX(first + 2)) / 3;
      const cy = (positions.getY(first) + positions.getY(first + 1) + positions.getY(first + 2)) / 3;
      const cz = (positions.getZ(first) + positions.getZ(first + 1) + positions.getZ(first + 2)) / 3;
      tint.set(typeof paint === 'function' ? paint(cx, cy, cz) : paint);
      for (let corner = 0; corner < 3; corner++) tint.toArray(colors, (first + corner) * 3);
    }
    piece.setAttribute('color', new BufferAttribute(colors, 3));
    if (this.animated) {
      // Un seul attribut (pièce, variante, teinture haut, teinture bas) : les attributs de
      // sommet sont comptés (16 au plus, dont 4 pour la matrice d'instance).
      const piecePacked = new Float32Array(count * 4);
      for (let index = 0; index < count; index++) piecePacked.set([part, variant, dye[0], dye[1]], index * 4);
      piece.setAttribute('aPiece', new BufferAttribute(piecePacked, 4));
    }
    this.parts.push(piece);
    return this;
  }

  build() {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    merged?.computeBoundingSphere();
    return merged!;
  }
}

/* ------------------------------------------------------------------ plan */

export interface FestLayout {
  /** Centre de la ronde (au sol) et rayon du cercle des danseurs. */
  center: V3;
  radius: number;
  /** Estrade : centre au sol, dessus, demi-dimensions (x, z). */
  stage: { x: number; z: number; ground: number; top: number; halfX: number; halfZ: number };
  /** Sonneurs : position (dessus de l'estrade) et orientation. */
  players: { at: V3; yaw: number; kind: 'bombarde' | 'biniou' }[];
  /** Pieds et sommets des mâts. */
  poles: { foot: V3; top: V3 }[];
  /** Point d'attache des guirlandes à la galerie du phare. */
  anchor: V3;
  /** Guirlandes : couples de points (ordre d'allumage : du phare vers le large). */
  garlands: [V3, V3][];
  /** Lampions : position, couleur, seuil d'allumage (facteur nuit). */
  lampions: { at: V3; color: string; on: number }[];
  /** Points de chaque guirlande (fil), pour le décor. */
  strings: V3[][];
}

const LAMPION_COLORS = ['#e8463c', '#f6c445', '#f28c38', '#f5efe2', '#5aa6dd', '#ef7aa1'];

/** Point d'une guirlande tendue de `a` à `b`, avec sa flèche (m). */
function sag(a: V3, b: V3, t: number, depth: number): V3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - depth * 4 * t * (1 - t),
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Plan de la fête dans le repère de l'îlot. `tower` : pied du phare (dessus du sol) ; la
 * galerie est 5,26 m plus haut. La ronde occupe le replat le plus plat du plateau, à l'est
 * de la butte (cherché une fois pour toutes sur le relief de l'îlot breton).
 */
export function festLayout(sampler: HeightSampler, tower: V3, quality: 'low' | 'medium' | 'high'): FestLayout {
  const cx = 4.0;
  const cz = 1.35;
  const ground = groundAt(sampler, cx, cz, 1.2);
  const center: V3 = [cx, ground, cz];
  const radius = 1.3;

  const stageX = 4.0;
  const stageZ = -1.0;
  const stageGround = groundAt(sampler, stageX, stageZ, 0.8);
  const stage = { x: stageX, z: stageZ, ground: stageGround, top: stageGround + 0.24, halfX: 0.85, halfZ: 0.5 };
  // Les sonneurs regardent la ronde (vers +Z).
  const players: FestLayout['players'] = [
    { at: [stageX - 0.36, stage.top, stageZ + 0.05], yaw: 0.18, kind: 'bombarde' },
    { at: [stageX + 0.36, stage.top, stageZ + 0.02], yaw: -0.14, kind: 'biniou' },
  ];

  const poleSpots: [number, number][] = [[4.6, 3.05], [5.55, 0.85], [4.95, -0.4]];
  const poles = poleSpots.map(([x, z]) => {
    const foot = groundAt(sampler, x, z, 0.3) - 0.05;
    return { foot: [x, foot, z] as V3, top: [x, foot + 2.35, z] as V3 };
  });

  // Attache sur la galerie, du côté de la ronde.
  const dx = cx - tower[0];
  const dz = cz - tower[2];
  const length = Math.hypot(dx, dz) || 1;
  const anchor: V3 = [tower[0] + (dx / length) * 1.0, tower[1] + 5.3, tower[2] + (dz / length) * 1.0];

  const garlands: [V3, V3][] = [
    [anchor, poles[0].top],
    [anchor, poles[1].top],
    [anchor, poles[2].top],
    [poles[0].top, poles[1].top],
    [poles[1].top, poles[2].top],
  ];
  const strings: V3[][] = [];
  const lampions: FestLayout['lampions'] = [];
  const perMeter = quality === 'low' ? 1.25 : 1.7;
  let order = 0;
  const total = garlands.reduce((sum, [a, b]) => sum + Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * perMeter)), 0);
  garlands.forEach(([a, b], garland) => {
    const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const depth = 0.18 + span * 0.045;
    const line: V3[] = [];
    for (let step = 0; step <= 14; step++) line.push(sag(a, b, step / 14, depth));
    strings.push(line);
    const count = Math.max(3, Math.round(span * perMeter));
    for (let index = 0; index < count; index++) {
      const point = sag(a, b, (index + 0.5) / count, depth);
      point[1] -= 0.13;
      lampions.push({
        at: point,
        color: LAMPION_COLORS[(index + garland * 2) % LAMPION_COLORS.length],
        // Ils s'allument un à un, guirlande après guirlande, du phare vers les mâts.
        on: 0.1 + (order / Math.max(1, total - 1)) * 0.32,
      });
      order += 1;
    }
  });

  return { center, radius, stage, players, poles, anchor, garlands, lampions, strings };
}

/* --------------------------------------------------------------- danseurs */

const SKIN = '#f1c6a0';
const DARK = '#2b2731';
const SHOE = '#1b181d';
const WHITE = '#ffffff';
const LACE = '#f6f2ea';
const HAT = '#1d1c22';
const HAIR = '#5b3a29';

/**
 * Rayures de marinière : bandes blanc pur (teintes à la couleur du danseur par le shader)
 * et bandes écrues (laissées telles quelles).
 */
function stripes(y: number) {
  return Math.floor(y / 0.034) % 2 === 0 ? WHITE : LACE;
}

/** Pièces du danseur (repère : pieds en y = 0, il regarde +Z, +X est sa gauche). */
export const DANCER = {
  shoulderX: 0.15,
  shoulderY: 0.62,
  hipX: 0.07,
  hipY: 0.36,
};

/**
 * Géométrie d'un danseur, toutes variantes comprises (variante 1 : danseuse, 2 : danseur ;
 * le shader écrase celle qui ne sert pas). Pièces : 0 corps, 1 bras gauche, 2 bras droit,
 * 3 jambe gauche, 4 jambe droite.
 */
export function dancerGeometry() {
  const kit = new Kit(true);
  // Jambes et sabots/chaussures (communs).
  for (const [side, part] of [[1, 3], [-1, 4]] as const) {
    kit.add(new CylinderGeometry(0.043, 0.038, 0.33, 6), place([side * DANCER.hipX, 0.2, 0]), DARK, part);
    kit.add(new BoxGeometry(0.075, 0.05, 0.13), place([side * DANCER.hipX, 0.028, 0.025]), SHOE, part);
  }
  // Tête, cheveux, yeux (communs).
  kit.add(new SphereGeometry(0.105, 10, 8), place([0, 0.8, 0]), SKIN);
  kit.add(new SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), place([0, 0.815, -0.012], [-0.35, 0, 0]), HAIR);
  for (const side of [-1, 1]) kit.add(new SphereGeometry(0.014, 5, 4), place([side * 0.036, 0.81, 0.097]), '#2a221d');

  // Danseuse : corsage sombre, col blanc, jupe et tablier teints, coiffe de dentelle.
  kit.add(new CylinderGeometry(0.105, 0.12, 0.2, 9), place([0, 0.6, 0]), DARK, 0, 1);
  kit.add(new TorusGeometry(0.1, 0.022, 5, 12), place([0, 0.69, 0], [Math.PI / 2, 0, 0]), LACE, 0, 1);
  kit.add(new CylinderGeometry(0.11, 0.23, 0.34, 11), place([0, 0.37, 0]), WHITE, 0, 1, [0, 1]);
  kit.add(new BoxGeometry(0.17, 0.27, 0.025), place([0, 0.4, 0.17], [-0.2, 0, 0]), WHITE, 0, 1, [1, 0]);
  kit.add(new SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), place([0, 0.835, -0.01], [-0.25, 0, 0], [1, 0.95, 1.06]), LACE, 0, 1);
  kit.add(new BoxGeometry(0.07, 0.11, 0.09), place([0, 0.95, -0.03], [-0.2, 0, 0]), LACE, 0, 1);
  for (const side of [-1, 1]) {
    kit.add(new BoxGeometry(0.1, 0.075, 0.012), place([side * 0.085, 0.86, -0.1], [0.3, side * 0.5, side * 0.35]), LACE, 0, 1);
  }

  // Danseur : marinière (rayures teintes), gilet sans manches, chapeau rond à rubans.
  kit.add(new CylinderGeometry(0.118, 0.122, 0.32, 10, 9), place([0, 0.52, 0]), (_x, y) => stripes(y), 0, 2, [1, 0]);
  kit.add(new TorusGeometry(0.1, 0.02, 5, 12), place([0, 0.685, 0], [Math.PI / 2, 0, 0]), LACE, 0, 2);
  kit.add(new CylinderGeometry(0.17, 0.17, 0.018, 14), place([0, 0.885, 0]), HAT, 0, 2);
  kit.add(new CylinderGeometry(0.094, 0.104, 0.075, 12), place([0, 0.93, 0]), HAT, 0, 2);
  kit.add(new CylinderGeometry(0.106, 0.106, 0.022, 12), place([0, 0.905, 0]), WHITE, 0, 2, [1, 0]);
  for (const side of [-1, 1]) {
    kit.add(new BoxGeometry(0.03, 0.16, 0.008), place([side * 0.03, 0.83, -0.16], [0.25, 0, side * 0.12]), HAT, 0, 2);
  }

  // Bras (communs) : manche, poignet, main. Pendants au repos ; le shader les lève.
  for (const [side, part] of [[1, 1], [-1, 2]] as const) {
    const x = side * DANCER.shoulderX;
    kit.add(new CylinderGeometry(0.036, 0.032, 0.27, 6), place([x, DANCER.shoulderY - 0.135, 0]), (_x, y) => stripes(y + 0.017), part, 2, [1, 0]);
    kit.add(new CylinderGeometry(0.036, 0.032, 0.27, 6), place([x, DANCER.shoulderY - 0.135, 0]), DARK, part, 1);
    kit.add(new SphereGeometry(0.038, 7, 5), place([x, DANCER.shoulderY - 0.29, 0]), SKIN, part);
  }
  return kit.build();
}

/** Couleurs des danseurs : haut (tablier, rayures, ruban) et bas (jupe, ruban du chapeau). */
export const DANCER_TOPS = ['#2f5fa8', '#c8382f', '#2f5fa8', '#e9b949', '#3f8f6a', '#c8382f', '#7a4aa0', '#2f5fa8', '#d9673a', '#3f8f6a'];
export const DANCER_BOTTOMS = ['#24222c', '#1f3657', '#5c1f2a', '#24222c', '#2b4a3a', '#1f3657', '#24222c', '#4a2a55', '#24222c', '#5c1f2a'];

/* ---------------------------------------------------------------- sonneurs */

/** Un sonneur debout (repère : pieds en y = 0, il regarde +Z) et son instrument. */
export function playerGeometry(kind: 'bombarde' | 'biniou') {
  const kit = new Kit(false);
  const vest = kind === 'bombarde' ? '#1f3657' : '#5c1f2a';
  for (const side of [-1, 1]) {
    kit.add(new CylinderGeometry(0.045, 0.04, 0.34, 6), place([side * 0.075, 0.2, 0]), DARK);
    kit.add(new BoxGeometry(0.08, 0.05, 0.14), place([side * 0.075, 0.028, 0.025]), SHOE);
  }
  kit.add(new CylinderGeometry(0.125, 0.13, 0.33, 10, 9), place([0, 0.53, 0]), (_x, y) => (Math.floor(y / 0.034) % 2 === 0 ? '#f6f2ea' : '#2f5fa8'));
  // Gilet brodé (chupenn) : deux pans et le dos.
  kit.add(new CylinderGeometry(0.135, 0.14, 0.27, 10, 1, true, Math.PI * 0.12, Math.PI * 1.76), place([0, 0.55, 0]), vest);
  kit.add(new BoxGeometry(0.012, 0.2, 0.012), place([0.05, 0.56, 0.13]), '#e2b04a');
  kit.add(new SphereGeometry(0.11, 10, 8), place([0, 0.82, 0]), SKIN);
  // Joues gonflées du souffleur.
  for (const side of [-1, 1]) kit.add(new SphereGeometry(0.04, 6, 5), place([side * 0.06, 0.795, 0.07]), '#f0a49a');
  kit.add(new CylinderGeometry(0.17, 0.17, 0.018, 14), place([0, 0.905, 0]), HAT);
  kit.add(new CylinderGeometry(0.095, 0.105, 0.075, 12), place([0, 0.95, 0]), HAT);
  kit.add(new CylinderGeometry(0.107, 0.107, 0.022, 12), place([0, 0.925, 0]), '#d9a441');

  if (kind === 'bombarde') {
    // Bombarde : hautbois conique tenu vers l'avant et le bas, pavillon évasé.
    const angle = 0.95;
    const mouth: V3 = [0, 0.79, 0.11];
    const along = (d: number): V3 => [0, mouth[1] - Math.cos(angle) * d, mouth[2] + Math.sin(angle) * d];
    // Axe du cylindre (+Y) tourné vers l'avant et le bas : le bout large est au loin.
    kit.add(new CylinderGeometry(0.026, 0.016, 0.3, 8), place(along(0.15), [Math.PI - angle, 0, 0]), '#5a3a24');
    kit.add(new ConeGeometry(0.06, 0.08, 10, 1, true), place(along(0.33), [-angle, 0, 0]), '#6b4529');
    kit.add(new CylinderGeometry(0.03, 0.03, 0.025, 8), place(along(0.28), [Math.PI - angle, 0, 0]), '#efe6d2');
    // Bras tendus vers l'instrument.
    for (const [side, d] of [[1, 0.1], [-1, 0.2]] as const) {
      const hand = along(d);
      const shoulder: V3 = [side * 0.15, 0.64, 0];
      addLimb(kit, shoulder, [hand[0] + side * 0.025, hand[1], hand[2]], 0.035, vest);
      kit.add(new SphereGeometry(0.036, 7, 5), place([hand[0] + side * 0.02, hand[1], hand[2]]), SKIN);
    }
  } else {
    // Biniou kozh : poche de velours sous le bras gauche, chalumeau vers l'avant, bourdon
    // posé sur l'épaule droite.
    kit.add(new SphereGeometry(0.1, 10, 8), place([0.13, 0.6, 0.08], [0, 0, 0.3], [1.1, 0.8, 1]), '#b8312f');
    kit.add(new CylinderGeometry(0.012, 0.012, 0.16, 6), place([0.05, 0.72, 0.1], [0.4, 0, 0.6]), '#4a3020');
    const chanterTop: V3 = [0.03, 0.6, 0.16];
    kit.add(new CylinderGeometry(0.014, 0.02, 0.2, 8), place([0.03, 0.52, 0.22], [0.6, 0, 0]), '#3e2818');
    kit.add(new CylinderGeometry(0.018, 0.018, 0.02, 8), place(chanterTop, [0.6, 0, 0]), '#efe6d2');
    kit.add(new CylinderGeometry(0.013, 0.016, 0.34, 8), place([-0.08, 0.8, -0.06], [-0.55, 0, 0.45]), '#3e2818');
    kit.add(new CylinderGeometry(0.024, 0.024, 0.03, 8), place([-0.155, 0.93, -0.15], [-0.55, 0, 0.45]), '#efe6d2');
    for (const [side, hand] of [[1, [0.06, 0.5, 0.25]], [-1, [0.01, 0.56, 0.2]]] as const) {
      addLimb(kit, [side * 0.15, 0.64, 0], hand as V3, 0.035, vest);
      kit.add(new SphereGeometry(0.036, 7, 5), place(hand as V3), SKIN);
    }
  }
  return kit.build();
}

/** Membre (cylindre) tendu entre deux points. */
function addLimb(kit: Kit, from: V3, to: V3, radius: number, color: string) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const middle = a.add(b).multiplyScalar(0.5);
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  kit.add(new CylinderGeometry(radius, radius * 0.9, length, 6), new Matrix4().compose(middle, turn, new Vector3(1, 1, 1)), color);
}

/* ------------------------------------------------------------ décor de fête */

const WOODS = ['#c98d55', '#b97a48', '#d49f66', '#bf8450', '#ad7145'];

/**
 * Décor de la fête, présent de jour comme de nuit (les lampions éteints attendent le soir) :
 * estrade de planches, mâts, fils des guirlandes, bûcher dans son cercle de pierres, barrique
 * de cidre. Un seul maillage.
 */
export function setupGeometry(layout: FestLayout) {
  const kit = new Kit(false);
  const { stage, center } = layout;
  // Estrade : planches, poteaux, marche.
  const planks = 5;
  for (let index = 0; index < planks; index++) {
    const x = stage.x - stage.halfX + ((index + 0.5) / planks) * stage.halfX * 2;
    kit.add(
      new BoxGeometry((stage.halfX * 2) / planks - 0.03, 0.06, stage.halfZ * 2),
      place([x, stage.top - 0.03, stage.z], [0, (hash(index * 3.1) - 0.5) * 0.02, 0]),
      WOODS[index % WOODS.length],
    );
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = stage.x + sx * (stage.halfX - 0.08);
      const pz = stage.z + sz * (stage.halfZ - 0.08);
      kit.add(new BoxGeometry(0.09, stage.top - stage.ground + 0.3, 0.09), place([px, (stage.top + stage.ground - 0.3) / 2, pz]), '#7a4e33');
    }
  }
  kit.add(new BoxGeometry(0.6, 0.06, 0.24), place([stage.x, stage.ground + 0.1, stage.z + stage.halfZ + 0.14]), '#b97a48');
  // Mâts des guirlandes, avec une petite traverse.
  for (const pole of layout.poles) {
    const height = pole.top[1] - pole.foot[1];
    kit.add(new CylinderGeometry(0.035, 0.05, height + 0.25, 6), place([pole.foot[0], pole.foot[1] + (height + 0.25) / 2 - 0.25, pole.foot[2]]), '#8a5a3a');
    kit.add(new BoxGeometry(0.34, 0.04, 0.04), place([pole.top[0], pole.top[1] + 0.02, pole.top[2]], [0, hash(pole.foot[0]) * 3, 0]), '#7a4e33');
    kit.add(new SphereGeometry(0.05, 6, 5), place([pole.top[0], pole.top[1] + 0.12, pole.top[2]]), '#e2b04a');
  }
  // Fils des guirlandes.
  for (const line of layout.strings) {
    for (let index = 0; index < line.length - 1; index++) addLimbTo(kit, line[index], line[index + 1], 0.011, '#3a2c22');
  }
  // Bûcher : cercle de pierres et bûches dressées en tipi.
  for (let index = 0; index < 9; index++) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new IcosahedronGeometry(0.075 + hash(index * 1.9) * 0.03, 0);
    kit.add(stone, place([center[0] + Math.cos(angle) * 0.4, center[1] + 0.03, center[2] + Math.sin(angle) * 0.4], [hash(index), hash(index * 2.3) * 3, 0], [1.2, 0.8, 1]), index % 2 ? '#9a938c' : '#b1a9a0');
  }
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2 + 0.3;
    const foot: V3 = [center[0] + Math.cos(angle) * 0.28, center[1], center[2] + Math.sin(angle) * 0.28];
    const top: V3 = [center[0] + Math.cos(angle) * 0.04, center[1] + 0.5, center[2] + Math.sin(angle) * 0.04];
    addLimbTo(kit, foot, top, 0.035, index % 2 ? '#6b4529' : '#7d5233');
  }
  kit.add(new CylinderGeometry(0.2, 0.22, 0.03, 10), place([center[0], center[1] + 0.01, center[2]]), '#2d2522');
  // Barrique de cidre au bord de l'estrade.
  const barrel: V3 = [stage.x + stage.halfX + 0.32, stage.ground + 0.22, stage.z + 0.1];
  kit.add(new CylinderGeometry(0.17, 0.17, 0.42, 10), place(barrel, [Math.PI / 2, 0.4, 0]), '#a8703f');
  for (const along of [-0.13, 0.13]) {
    kit.add(new TorusGeometry(0.175, 0.012, 4, 14), place([barrel[0] + Math.cos(0.4) * along, barrel[1], barrel[2] - Math.sin(0.4) * along], [0, 0.4 + Math.PI / 2, 0]), '#3b3330');
  }
  return kit.build();
}

function addLimbTo(kit: Kit, from: V3, to: V3, radius: number, color: string) {
  addLimb(kit, from, to, radius, color);
}

/** Lampion de papier : corps à teinter (blanc), cerclages sombres en haut et en bas. */
export function lampionGeometry() {
  const kit = new Kit(false);
  kit.add(new SphereGeometry(0.13, 9, 6), place([0, 0, 0], [0, 0, 0], [1, 0.82, 1]), WHITE);
  kit.add(new CylinderGeometry(0.06, 0.06, 0.03, 8), place([0, 0.11, 0]), '#3a2c22');
  kit.add(new CylinderGeometry(0.06, 0.06, 0.03, 8), place([0, -0.11, 0]), '#3a2c22');
  kit.add(new CylinderGeometry(0.004, 0.004, 0.1, 3), place([0, 0.16, 0]), '#3a2c22');
  return kit.build();
}
