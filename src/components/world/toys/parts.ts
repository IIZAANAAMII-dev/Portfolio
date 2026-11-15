import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Petit établi de modélisation des jouets flottants : des pièces simples (boîtes, cylindres,
 * tores…) peintes par sommet ou par triangle, puis fusionnées en UNE géométrie par jouet.
 * Chaque sorte d'objet ne coûte ainsi qu'un draw call, quel que soit son nombre (instances).
 */

/** Peinture évaluée en un point (sommet, ou centre d'un triangle). */
export type Painter = (x: number, y: number, z: number, out: Color) => void;
export type V3 = [number, number, number];

interface PaintOptions {
  /** Éclaircit les dessus et assombrit les flancs : arêtes lisibles, effet « jouet peint ». */
  shade?: number;
  /** Normales recalculées par triangle : bois taillé, facettes franches. */
  flat?: boolean;
  /** Peinture évaluée au centre de chaque triangle : bandes et quartiers aux bords nets. */
  faces?: boolean;
  /** Peinture évaluée dans le repère propre de la pièce (avant la pose). */
  local?: boolean;
}

const euler = new Euler();
const rotation = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const direction = new Vector3();
const tint = new Color();
const UP = new Vector3(0, 1, 0);

/** Matrice de pose : position, rotation (ordre XYZ) et échelle. */
export function pose(at: V3 = [0, 0, 0], turn: V3 = [0, 0, 0], scale: number | V3 = 1) {
  euler.set(turn[0], turn[1], turn[2]);
  rotation.setFromEuler(euler);
  offset.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') stretch.setScalar(scale);
  else stretch.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(offset, rotation, stretch);
}

/** Pose d'un cylindre unitaire (hauteur 1, axe Y) tendu entre deux points : cordages, mâts. */
export function span(a: V3, b: V3, thickness: number) {
  direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = direction.length() || 1;
  rotation.setFromUnitVectors(UP, direction.divideScalar(length));
  offset.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  stretch.set(thickness, length, thickness);
  return new Matrix4().compose(offset, rotation, stretch);
}

export class Parts {
  private list: BufferGeometry[] = [];

  add(geometry: BufferGeometry, color: string | Painter, matrix?: Matrix4, options: PaintOptions = {}) {
    const { shade = 0.1, flat = false, faces = false, local = false } = options;
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(piece.attributes)) {
      if (name !== 'position' && name !== 'normal') piece.deleteAttribute(name);
    }
    const source = local ? piece.attributes.position.clone() : null;
    if (matrix) piece.applyMatrix4(matrix);
    if (flat || !piece.attributes.normal) piece.computeVertexNormals();
    const positions = piece.attributes.position;
    const read = source ?? positions;
    const normals = piece.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const painter = typeof color === 'function' ? color : null;
    const solid = painter ? null : new Color(color as string);
    for (let index = 0; index < positions.count; index++) {
      if (solid) tint.copy(solid);
      else if (faces) {
        const first = index - (index % 3);
        const x = (read.getX(first) + read.getX(first + 1) + read.getX(first + 2)) / 3;
        const y = (read.getY(first) + read.getY(first + 1) + read.getY(first + 2)) / 3;
        const z = (read.getZ(first) + read.getZ(first + 1) + read.getZ(first + 2)) / 3;
        painter!(x, y, z, tint);
      } else painter!(read.getX(index), read.getY(index), read.getZ(index), tint);
      if (shade) {
        const ny = normals.getY(index);
        tint.multiplyScalar(ny > 0.55 ? 1 + shade * 0.4 : ny < -0.55 ? 1 - shade * 1.2 : 1 - shade * 0.4);
      }
      tint.toArray(colors, index * 3);
    }
    piece.setAttribute('color', new BufferAttribute(colors, 3));
    this.list.push(piece);
    return this;
  }

  /** Fusionne toutes les pièces en une géométrie (non indexée, couleurs par sommet). */
  build() {
    const merged = mergeGeometries(this.list, false);
    for (const piece of this.list) piece.dispose();
    this.list = [];
    if (!merged) throw new Error('toys : fusion des pièces impossible');
    merged.computeBoundingSphere();
    return merged;
  }
}
