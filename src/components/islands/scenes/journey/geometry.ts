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
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash } from '@/lib/utils/math';

/**
 * Outils de construction de l'île Parcours : des pièces simples (boîtes, cylindres,
 * cônes…) colorées sommet par sommet puis fusionnées en UNE géométrie. Une maison, un
 * pont ou un fort entier ne coûtent ainsi qu'un seul draw call, avec un matériau partagé.
 */

export type V3 = [number, number, number];

export interface Place {
  position?: V3;
  rotation?: V3;
  scale?: V3 | number;
}

/* ------------------------------------------------------- formes de base */

export const BOX = new BoxGeometry(1, 1, 1);
export const CYL5 = new CylinderGeometry(1, 1, 1, 5);
export const CYL6 = new CylinderGeometry(1, 1, 1, 6);
export const CYL8 = new CylinderGeometry(1, 1, 1, 8);
export const CYL12 = new CylinderGeometry(1, 1, 1, 12);
export const CONE4 = new ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
export const CONE6 = new ConeGeometry(1, 1, 6, 1);
export const CONE8 = new ConeGeometry(1, 1, 8, 1);
export const CONE12 = new ConeGeometry(1, 1, 12, 1);
export const ICO0 = new IcosahedronGeometry(1, 0);
export const ICO1 = new IcosahedronGeometry(1, 1);
export const OCTA = new OctahedronGeometry(1, 0);
export const SPHERE = new SphereGeometry(1, 10, 7);
export const DOME = new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
export const RING = new TorusGeometry(1, 0.12, 5, 16);

/** Toit à deux pans (prisme triangulaire) : faîtage le long de x, base de 1 × 1, hauteur 1. */
export const GABLE = (() => {
  const geometry = new BufferGeometry();
  const p = [
    [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 1, 0], [0.5, 1, 0],
  ];
  const faces = [
    [0, 4, 1], [1, 4, 5], // pan arrière
    [3, 2, 4], [2, 5, 4], // pan avant
    [0, 3, 4], [1, 5, 2], // pignons
    [0, 1, 2], [0, 2, 3], // dessous
  ];
  const positions: number[] = [];
  for (const face of faces) for (const index of face) positions.push(...p[index]);
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
})();

/* ------------------------------------------------------------- assemblage */

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scaling = new Vector3();
const tint = new Color();

export function placeMatrix(place: Place, target = new Matrix4()) {
  const [px, py, pz] = place.position ?? [0, 0, 0];
  const [rx, ry, rz] = place.rotation ?? [0, 0, 0];
  const s = place.scale ?? 1;
  const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
  return target.compose(position.set(px, py, pz), quaternion.setFromEuler(euler.set(rx, ry, rz)), scaling.set(sx, sy, sz));
}

export interface PaintOptions {
  /** Variation de clarté par facette (0 : aucune). */
  jitter?: number;
  /** Graine de la variation. */
  seed?: number;
  /** Couleur du sommet selon sa position et sa normale (après placement) : remplace `color`. */
  paint?: (x: number, y: number, z: number, out: Color, ny: number) => void;
}

/** Assemble des pièces colorées en une seule géométrie (couleurs par sommet). */
export class Kit {
  private parts: BufferGeometry[] = [];

  add(source: BufferGeometry, color: string | Color, place: Place = {}, options: PaintOptions = {}) {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    geometry.applyMatrix4(placeMatrix(place, matrix));
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const base = new Color(color);
    const { jitter = 0, seed = 0, paint } = options;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      if (paint) paint(positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex), tint, normals.getY(vertex));
      else tint.copy(base);
      if (jitter > 0) tint.multiplyScalar(1 + (hash(seed * 13.7 + Math.floor(vertex / 3) * 1.91) - 0.5) * jitter);
      colors[vertex * 3] = tint.r;
      colors[vertex * 3 + 1] = tint.g;
      colors[vertex * 3 + 2] = tint.b;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    this.parts.push(geometry);
    return this;
  }

  /** Ajoute toutes les pièces d'un autre assemblage, placé. */
  merge(other: Kit, place: Place = {}) {
    placeMatrix(place, matrix);
    for (const part of other.parts) this.parts.push(part.clone().applyMatrix4(matrix));
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    const merged = mergeGeometries(this.parts, false) ?? new BufferGeometry();
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

/** Déformation « taillée à la main » d'une forme : chaque sommet bouge un peu (déterministe). */
export function roughen(source: BufferGeometry, amount: number, seed: number, squash: V3 = [1, 1, 1]) {
  const geometry = source.clone();
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    // Même bruit pour des sommets confondus : la forme reste fermée.
    const key = Math.round(x * 97) * 0.731 + Math.round(y * 89) * 1.37 + Math.round(z * 83) * 2.11 + seed;
    const k = 1 + (hash(key) - 0.5) * amount;
    positions.setXYZ(index, x * k * squash[0], y * k * squash[1], z * k * squash[2]);
  }
  geometry.computeVertexNormals();
  return geometry;
}
