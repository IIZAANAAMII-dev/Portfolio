import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bevelBox, Pieces, pose } from '@/components/islands/docks/parts';
import { hash } from '@/lib/utils/math';

/**
 * Atelier de peinture du port de départ : un appentis de planches bleu-gris sur son
 * plancher, toit de tuiles, établi où s'alignent les pots de peinture (une livrée chacun),
 * râtelier à pavillons, échelle, seau, éclaboussures. Tout le statique en UN maillage
 * (peint par sommet) ; pots, pavillons, cadenas et étiquettes sont à part (animés).
 *
 * Repère de l'atelier : +X vers la droite de la façade, +Z vers l'avant (le large), Y = sol.
 */

export const PLATFORM_TOP = 0.14;
export const BENCH_TOP = 0.58;
/** Pots sur l'établi : abscisses (un par livrée), profondeur, rayon et hauteur. */
export const POT_Z = 0.62;
export const POT_RADIUS = 0.13;
export const POT_HEIGHT = 0.26;
export function potX(index: number, count: number) {
  return -0.86 + (index / Math.max(count - 1, 1)) * 1.72;
}
/** Râtelier : hampes plantées dans une traverse, pavillons au bout. */
export const RACK_Z = 0.42;
export const POLE_HEIGHT = 1.2;
export const FLAG_W = 0.36;
export const FLAG_H = 0.24;
export function poleX(index: number) {
  return 1.42 + index * 0.4;
}

const BOARDS = ['#6f97b5', '#6990af', '#78a0bc', '#6489a8'];
const TRIM = '#efe9dc';
const ROOF = ['#c45b40', '#b55139', '#cc6447'];
const WOOD = ['#c98d55', '#b97a48', '#d49f66', '#bf8450'];
const DARK_WOOD = '#7a4e33';

export function shedGeometry(low: boolean) {
  const wood = new Pieces();
  const tint = new Color();
  // Plancher sur pilotis courts.
  for (let index = 0; index < 9; index++) {
    const x = -1.45 + index * 0.3 + 0.15;
    tint.set(WOOD[index % WOOD.length]).multiplyScalar(0.95 + hash(index * 3.1) * 0.1);
    wood.add(bevelBox(0.28, 0.08, 2.05, 0.015), tint.clone(), pose([x, PLATFORM_TOP - 0.04, 0.05]), 0.2);
  }
  for (const [x, z] of [[-1.38, -0.88], [1.18, -0.88], [-1.38, 0.98], [1.18, 0.98]]) {
    wood.add(new BoxGeometry(0.1, 0.42, 0.1), DARK_WOOD, pose([x, -0.12, z]), 0.15);
  }
  // Mur du fond : planches verticales bleu-gris, couvre-joints.
  for (let index = 0; index < 12; index++) {
    const x = -1.2 + index * 0.2;
    const height = 1.92 + hash(index * 1.7) * 0.06;
    wood.add(new BoxGeometry(0.19, height, 0.05), BOARDS[index % BOARDS.length], pose([x, PLATFORM_TOP + height / 2, -0.8], [0, 0, (hash(index * 2.3) - 0.5) * 0.015]), 0.1);
  }
  wood.add(new BoxGeometry(2.4, 0.07, 0.07), TRIM, pose([-0.1, PLATFORM_TOP + 0.95, -0.76]), 0.1);
  // Mur de gauche, sous la pente du toit.
  for (let index = 0; index < 6; index++) {
    const z = -0.7 + index * 0.2;
    const height = 1.9 - (z + 0.8) * 0.22;
    wood.add(new BoxGeometry(0.05, height, 0.19), BOARDS[(index + 1) % BOARDS.length], pose([-1.27, PLATFORM_TOP + height / 2, z]), 0.1);
  }
  // Poteaux blancs et sablière avant.
  for (const [x, z, height] of [[-1.27, -0.8, 2.0], [1.06, -0.8, 2.0], [-1.27, 0.55, 1.68], [1.06, 0.55, 1.68]]) {
    wood.add(new BoxGeometry(0.09, height, 0.09), TRIM, pose([x, PLATFORM_TOP + height / 2, z]), 0.12);
  }
  wood.add(new BoxGeometry(2.45, 0.09, 0.1), TRIM, pose([-0.1, PLATFORM_TOP + 1.66, 0.55]), 0.12);
  // Toit de tuiles : rangées qui se chevauchent, en pente vers l'avant.
  const slope = Math.atan2(0.42, 1.75);
  for (let row = 0; row < 6; row++) {
    const z = -0.92 + row * 0.3;
    const y = PLATFORM_TOP + 2.08 - (z + 0.92) * Math.tan(slope);
    wood.add(new BoxGeometry(2.7, 0.05, 0.34), ROOF[row % ROOF.length], pose([-0.1, y, z], [slope, 0, 0]), 0.18);
  }
  wood.add(new BoxGeometry(2.74, 0.08, 0.08), '#8e3b2a', pose([-0.1, PLATFORM_TOP + 2.12, -0.95]), 0.15);
  // Étagère du fond : quelques pots entamés, un bocal de pinceaux, un chiffon.
  wood.add(new BoxGeometry(1.9, 0.05, 0.28), WOOD[2], pose([-0.15, PLATFORM_TOP + 1.25, -0.64]), 0.15);
  const shelfColors = ['#d4473a', '#2f73b5', '#f2c230', '#3f8f8a', '#f3ead6'];
  for (let index = 0; index < 5; index++) {
    const x = -0.95 + index * 0.33 + hash(index * 5.1) * 0.08;
    const height = 0.14 + hash(index * 2.7) * 0.06;
    wood.add(new CylinderGeometry(0.075, 0.075, height, 10), '#aab3ba', pose([x, PLATFORM_TOP + 1.28 + height / 2, -0.64]));
    wood.add(new CylinderGeometry(0.077, 0.077, 0.03, 10), shelfColors[index], pose([x, PLATFORM_TOP + 1.28 + height, -0.64]));
  }
  // Établi sur tréteaux.
  wood.add(bevelBox(2.15, 0.06, 0.42, 0.012), WOOD[0], pose([0, BENCH_TOP - 0.03, POT_Z]), 0.2);
  for (const x of [-0.9, 0.9]) {
    for (const side of [-1, 1]) {
      wood.add(new BoxGeometry(0.05, 0.56, 0.05), DARK_WOOD, pose([x, PLATFORM_TOP + 0.21, POT_Z + side * 0.12], [side * 0.22, 0, 0]), 0.12);
    }
    wood.add(new BoxGeometry(0.05, 0.05, 0.3), DARK_WOOD, pose([x, PLATFORM_TOP + 0.28, POT_Z]), 0.12);
  }
  // Éclaboussures de peinture sur le plancher et l'établi (couleurs des livrées).
  const splats: [number, number, string][] = [[-0.6, 0.95, '#c33e2c'], [0.35, 0.9, '#21518f'], [0.75, 0.18, '#e8b53a'], [-0.95, 0.25, '#2b8a78']];
  splats.forEach(([x, z, color], index) => {
    wood.add(new CylinderGeometry(0.09 + hash(index) * 0.05, 0.09, 0.006, 9), color, pose([x, PLATFORM_TOP + 0.003, z], [0, hash(index * 3.3) * 3, 0], [1.3, 1, 0.8]));
  });
  if (!low) {
    // Échelle appuyée contre le flanc droit, seau et rouleau.
    for (const side of [-1, 1]) {
      wood.add(new BoxGeometry(0.045, 1.95, 0.045), WOOD[3], pose([1.2, PLATFORM_TOP + 0.95, -0.45 + side * 0.17], [0, 0, 0.16]), 0.12);
    }
    for (let rung = 0; rung < 6; rung++) {
      wood.add(new BoxGeometry(0.035, 0.035, 0.34), WOOD[1], pose([1.12 - rung * 0.045, PLATFORM_TOP + 0.25 + rung * 0.29, -0.45]), 0.1);
    }
    wood.add(new CylinderGeometry(0.13, 0.1, 0.24, 12), '#8e9aa1', pose([-0.95, PLATFORM_TOP + 0.12, 0.92]));
    wood.add(new TorusGeometry(0.12, 0.008, 4, 12, Math.PI), '#8e9aa1', pose([-0.95, PLATFORM_TOP + 0.24, 0.92]));
    wood.add(new CylinderGeometry(0.11, 0.11, 0.012, 12), '#21518f', pose([-0.95, PLATFORM_TOP + 0.235, 0.92]));
    wood.add(new CylinderGeometry(0.05, 0.05, 0.22, 10), '#f3ead6', pose([0.55, BENCH_TOP + 0.05, POT_Z + 0.12], [0, 0, Math.PI / 2]));
    wood.add(new CylinderGeometry(0.012, 0.012, 0.3, 5), DARK_WOOD, pose([0.75, BENCH_TOP + 0.05, POT_Z + 0.12], [0, 0, Math.PI / 2]));
  }
  // Râtelier à pavillons : deux pieds, une traverse percée.
  for (const x of [1.25, 2.75]) {
    wood.add(new BoxGeometry(0.08, 0.62, 0.08), DARK_WOOD, pose([x, 0.18, RACK_Z]), 0.15);
  }
  wood.add(bevelBox(1.62, 0.09, 0.16, 0.015), WOOD[1], pose([2.0, 0.5, RACK_Z]), 0.2);
  wood.add(bevelBox(1.62, 0.06, 0.12, 0.012), WOOD[2], pose([2.0, 0.1, RACK_Z]), 0.2);
  for (let index = 0; index < 4; index++) {
    const x = poleX(index);
    wood.add(new CylinderGeometry(0.02, 0.024, POLE_HEIGHT, 6), TRIM, pose([x, 0.1 + POLE_HEIGHT / 2, RACK_Z]));
    wood.add(new SphereGeometry(0.035, 8, 6), '#d9b45a', pose([x, 0.1 + POLE_HEIGHT + 0.02, RACK_Z]));
  }
  return wood.build()!;
}

/** Pot de peinture : bidon métallique (cerclages, étiquette crème). */
export function canGeometry() {
  const can = new Pieces();
  can.add(new CylinderGeometry(POT_RADIUS, POT_RADIUS * 0.96, POT_HEIGHT, 16), (_x, y, _z, _ny, out) => {
    out.set(Math.abs(y) < 0.055 ? '#efe7d4' : '#b9c2c8');
  }, pose([0, POT_HEIGHT / 2, 0]), 0.08);
  for (const y of [0.02, POT_HEIGHT - 0.01]) {
    can.add(new TorusGeometry(POT_RADIUS + 0.003, 0.009, 4, 18), '#8e9aa1', pose([0, y, 0], [Math.PI / 2, 0, 0]));
  }
  can.add(new TorusGeometry(POT_RADIUS * 0.55, 0.008, 4, 10, Math.PI), '#8e9aa1', pose([0, POT_HEIGHT, 0], [0, 0, 0]));
  return can.build()!;
}

/**
 * Peinture d'un pot (teinte par instance) : couvercle, coulures qui débordent sur le
 * flanc, pastille sur l'étiquette. Origine sur le fond du pot.
 */
export function paintGeometry() {
  const parts: BufferGeometry[] = [];
  const lid = new CylinderGeometry(POT_RADIUS + 0.008, POT_RADIUS + 0.008, 0.035, 16).translate(0, POT_HEIGHT + 0.012, 0);
  const knob = new SphereGeometry(0.03, 8, 6).scale(1.4, 0.6, 1.4).translate(0, POT_HEIGHT + 0.035, 0);
  const swatch = new CylinderGeometry(0.05, 0.05, 0.012, 12).rotateX(Math.PI / 2).translate(0, POT_HEIGHT * 0.5, POT_RADIUS + 0.004);
  parts.push(lid, knob, swatch);
  for (let drip = 0; drip < 3; drip++) {
    const angle = 0.5 + drip * 0.9;
    const length = 0.05 + hash(drip * 4.1) * 0.06;
    const capsule = new CapsuleGeometry(0.013, length, 3, 6)
      .translate(Math.sin(angle) * (POT_RADIUS + 0.004), POT_HEIGHT - length / 2 - 0.01, Math.cos(angle) * (POT_RADIUS + 0.004));
    parts.push(capsule);
  }
  const merged = mergeGeometries(parts.map((part) => part.toNonIndexed()), false)!;
  parts.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** Cadenas : corps en laiton et anse d'acier. */
export function padlockGeometry() {
  const lock = new Pieces();
  lock.add(new BoxGeometry(0.1, 0.085, 0.04), '#d2a84e', pose([0, 0, 0]), 0.15);
  lock.add(new TorusGeometry(0.032, 0.01, 4, 10, Math.PI), '#c4ccd2', pose([0, 0.042, 0]));
  lock.add(new CylinderGeometry(0.008, 0.008, 0.02, 6), '#3a3330', pose([0, -0.005, 0.021], [Math.PI / 2, 0, 0]));
  return lock.build()!;
}

/** Pinceau planté dans le pot de la livrée en cours. */
export function dipBrushGeometry() {
  const brush = new Pieces();
  brush.add(new CylinderGeometry(0.014, 0.018, 0.42, 6), '#9a6a3e', pose([0, 0.21, 0]));
  brush.add(new BoxGeometry(0.06, 0.05, 0.025), '#b9c2c8', pose([0, 0.0, 0]), 0.1);
  return brush.build()!;
}

/** Plan d'un pavillon du râtelier, découpé en bandes (il ondule), uv dans sa case de l'atlas. */
export function rackFlagsGeometry() {
  const flags: BufferGeometry[] = [];
  for (let index = 0; index < 4; index++) {
    const plane = new PlaneGeometry(FLAG_W, FLAG_H, 6, 2).translate(FLAG_W / 2, -FLAG_H / 2, 0);
    const uv = plane.getAttribute('uv') as BufferAttribute;
    const free = new Float32Array(uv.count);
    const which = new Float32Array(uv.count);
    // Atlas 2 × 2 : case (index % 2, index ÷ 2), v vers le haut.
    const column = index % 2;
    const row = Math.floor(index / 2);
    for (let vertex = 0; vertex < uv.count; vertex++) {
      const u = uv.getX(vertex);
      const v = uv.getY(vertex);
      free[vertex] = u;
      which[vertex] = index;
      uv.setXY(vertex, (column + u) / 2, 1 - (row + 1 - v) / 2);
    }
    plane.setAttribute('aFree', new BufferAttribute(free, 1));
    plane.setAttribute('aFlag', new BufferAttribute(which, 1));
    plane.translate(poleX(index) + 0.022, 0, RACK_Z);
    flags.push(plane);
  }
  const merged = mergeGeometries(flags, false)!;
  flags.forEach((flag) => flag.dispose());
  return merged;
}

/** Enseigne de l'appentis (uv : bandeau du haut de l'atlas d'écriteaux, 512 × 96). */
export function signGeometry() {
  const plane = new PlaneGeometry(1.6, 0.3);
  const uv = plane.getAttribute('uv') as BufferAttribute;
  for (let vertex = 0; vertex < uv.count; vertex++) {
    uv.setY(vertex, 1 - 96 / 256 + uv.getY(vertex) * (96 / 256));
  }
  return plane;
}

export function tagGeometry(slot: number, x: number, y: number, z: number, yaw = 0) {
  const width = 0.42;
  const height = 0.15;
  const plane = new PlaneGeometry(width, height);
  const uv = plane.getAttribute('uv') as BufferAttribute;
  // Atlas d'écriteaux : enseigne en haut (512 × 96), puis étiquettes 256 × 80 sur deux colonnes.
  const column = slot % 2;
  const row = Math.floor(slot / 2);
  const u0 = column * 0.5;
  const v1 = 1 - (96 + row * 80) / 256;
  const v0 = v1 - 80 / 256;
  for (let vertex = 0; vertex < uv.count; vertex++) {
    uv.setXY(vertex, u0 + uv.getX(vertex) * 0.5, v0 + uv.getY(vertex) * (v1 - v0));
  }
  plane.rotateY(yaw).translate(x, y, z);
  return plane;
}
