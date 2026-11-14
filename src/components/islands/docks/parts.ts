import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Euler,
  Matrix4,
  Quaternion,
  RGBAFormat,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Petit atelier de géométrie procédurale, partagé par les pontons, l'île Contact et la vie
 * du port : des pièces simples (boîtes, cylindres, tores…) peintes par sommet puis fusionnées
 * en UN seul maillage. Tout un décor statique ne coûte qu'un draw call.
 */

/** Peinture calculée par sommet (position après pose, normale verticale). */
export type Painter = (x: number, y: number, z: number, ny: number, out: Color) => void;

export type Vec3 = [number, number, number];

const euler = new Euler();
const quaternion = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const tint = new Color();

/** Matrice de pose : position, rotation (XYZ) et échelle. */
export function pose(at: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: number | Vec3 = 1) {
  euler.set(rotation[0], rotation[1], rotation[2]);
  quaternion.setFromEuler(euler);
  offset.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') stretch.setScalar(scale);
  else stretch.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(offset, quaternion, stretch);
}

export class Pieces {
  private list: BufferGeometry[] = [];

  /**
   * Ajoute une pièce. `shade` éclaircit le dessus et assombrit les flancs : les arêtes
   * ressortent comme sur un jouet peint, même dans l'ombre.
   */
  add(geometry: BufferGeometry, color: string | Color | Painter, matrix?: Matrix4, shade = 0) {
    return this.paint(geometry, color, matrix, shade, false);
  }

  /**
   * Comme `add`, mais la peinture est évaluée au centre de chaque triangle : bandes et
   * quartiers aux bords nets (bouée rouge et blanche, liseré d'une coque…).
   */
  addFaceted(geometry: BufferGeometry, painter: Painter, matrix?: Matrix4, shade = 0) {
    return this.paint(geometry, painter, matrix, shade, true, false);
  }

  /** Peinture par triangle, évaluée dans le repère propre de la pièce (avant la pose). */
  addLocal(geometry: BufferGeometry, painter: Painter, matrix?: Matrix4, shade = 0) {
    return this.paint(geometry, painter, matrix, shade, true, true);
  }

  private paint(geometry: BufferGeometry, color: string | Color | Painter, matrix: Matrix4 | undefined, shade: number, faceted: boolean, local = false) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!piece.attributes.normal) piece.computeVertexNormals();
    if (matrix && !local) piece.applyMatrix4(matrix);
    if (piece.attributes.uv) piece.deleteAttribute('uv');
    if (piece.attributes.uv1) piece.deleteAttribute('uv1');
    const positions = piece.attributes.position;
    const normals = piece.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const flat = typeof color === 'function' ? null : new Color(color);
    for (let index = 0; index < positions.count; index++) {
      const ny = normals.getY(index);
      if (flat) tint.copy(flat);
      else if (faceted) {
        const first = index - (index % 3);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let corner = first; corner < first + 3; corner++) {
          cx += positions.getX(corner) / 3;
          cy += positions.getY(corner) / 3;
          cz += positions.getZ(corner) / 3;
        }
        (color as Painter)(cx, cy, cz, ny, tint);
      } else (color as Painter)(positions.getX(index), positions.getY(index), positions.getZ(index), ny, tint);
      if (shade) tint.multiplyScalar(ny > 0.55 ? 1 + shade * 0.35 : ny < -0.55 ? 1 - shade * 1.3 : 1 - shade * 0.5);
      tint.toArray(colors, index * 3);
    }
    piece.setAttribute('color', new BufferAttribute(colors, 3));
    if (matrix && local) piece.applyMatrix4(matrix);
    this.list.push(piece);
    return this;
  }

  get size() {
    return this.list.length;
  }

  /** Fusionne tout (null si vide). */
  build() {
    if (this.list.length === 0) return null;
    const merged = mergeGeometries(this.list, false);
    this.list = [];
    if (!merged) return null;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
}

/**
 * Boîte aux arêtes supérieures chanfreinées : les flancs attrapent la lumière autrement
 * que le dessus, et la planche a l'air taillée à la main.
 */
export function bevelBox(width: number, height: number, depth: number, bevel = 0.02) {
  const box = new BoxGeometry(width, height, depth, 1, 2, 1);
  const positions = box.attributes.position;
  const halfW = width / 2;
  const halfD = depth / 2;
  for (let index = 0; index < positions.count; index++) {
    if (positions.getY(index) < height / 2 - 1e-4) continue;
    positions.setX(index, positions.getX(index) * Math.max(0.2, (halfW - bevel) / halfW));
    positions.setZ(index, positions.getZ(index) * Math.max(0.2, (halfD - bevel) / halfD));
  }
  box.computeVertexNormals();
  return box;
}

let glow: DataTexture | null = null;

/** Halo radial doux (texture calculée, sans DOM) pour les lueurs de lanternes. */
export function glowTexture() {
  if (glow) return glow;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - d);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(a * a * a * 255);
    }
  }
  glow = new DataTexture(data, size, size, RGBAFormat);
  glow.needsUpdate = true;
  return glow;
}
