import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Atelier de géométrie du laboratoire : des pièces simples peintes par sommet, fusionnées
 * en un seul maillage par zone (un draw call pour tout le statique d'une zone).
 */

export type Vec3 = [number, number, number];

/** Peinture calculée par sommet (position posée, normale posée). */
export type Painter = (position: Vector3, normal: Vector3, out: Color) => void;
export type Paint = string | Painter;

const euler = new Euler();
const quaternion = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const point = new Vector3();
const facing = new Vector3();
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

/** Peinture à deux tons : dessus clair, flancs plus sombres. */
export function topAndSides(top: string, sides: string): Painter {
  const a = new Color(top);
  const b = new Color(sides);
  return (_, normal, out) => {
    out.copy(normal.y > 0.5 ? a : b);
  };
}

export class Merger {
  private parts: BufferGeometry[] = [];
  private frame = new Matrix4();

  /** Pose toutes les pièces ajoutées pendant `draw` dans le repère `matrix` (imbricable). */
  group(matrix: Matrix4, draw: () => void) {
    const previous = this.frame.clone();
    this.frame.multiply(matrix);
    draw();
    this.frame.copy(previous);
    return this;
  }

  /**
   * Ajoute une pièce. `shade` éclaircit un peu le dessus et assombrit les flancs : les
   * arêtes ressortent comme sur un jouet peint.
   */
  add(geometry: BufferGeometry, paint: Paint, matrix?: Matrix4, shade = 0.1) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(piece.attributes)) {
      if (name !== 'position' && name !== 'normal') piece.deleteAttribute(name);
    }
    if (!piece.attributes.normal) piece.computeVertexNormals();
    piece.applyMatrix4(matrix ? this.frame.clone().multiply(matrix) : this.frame);
    const positions = piece.attributes.position;
    const normals = piece.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const flat = typeof paint === 'string' ? new Color(paint) : null;
    for (let index = 0; index < positions.count; index++) {
      facing.fromBufferAttribute(normals, index);
      if (flat) tint.copy(flat);
      else (paint as Painter)(point.fromBufferAttribute(positions, index), facing, tint);
      if (shade) {
        const ny = facing.y;
        tint.multiplyScalar(ny > 0.55 ? 1 + shade * 0.3 : ny < -0.55 ? 1 - shade * 1.2 : 1 - shade * 0.45);
      }
      tint.toArray(colors, index * 3);
    }
    piece.setAttribute('color', new BufferAttribute(colors, 3));
    this.parts.push(piece);
    return this;
  }

  /** Ajoute une pièce déjà peinte (attribut `color` fourni par l'appelant). */
  addPainted(geometry: BufferGeometry, matrix?: Matrix4) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(piece.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') piece.deleteAttribute(name);
    }
    if (!piece.attributes.normal) piece.computeVertexNormals();
    piece.applyMatrix4(matrix ? this.frame.clone().multiply(matrix) : this.frame);
    this.parts.push(piece);
    return this;
  }

  box(size: Vec3, paint: Paint, at?: Vec3, rotation?: Vec3, shade?: number) {
    return this.add(new BoxGeometry(size[0], size[1], size[2]), paint, pose(at, rotation), shade);
  }

  cylinder(top: number, bottom: number, height: number, segments: number, paint: Paint, at?: Vec3, rotation?: Vec3, shade?: number) {
    return this.add(new CylinderGeometry(top, bottom, height, segments), paint, pose(at, rotation), shade);
  }

  /** Prisme octogonal, une face plate tournée vers +Z. */
  octagon(top: number, bottom: number, height: number, paint: Paint, at?: Vec3, shade?: number) {
    return this.add(new CylinderGeometry(top, bottom, height, 8, 1, false, Math.PI / 8), paint, pose(at), shade);
  }

  sphere(radius: number, paint: Paint, at?: Vec3, scale: number | Vec3 = 1, detail: [number, number] = [10, 8], shade?: number) {
    return this.add(new SphereGeometry(radius, detail[0], detail[1]), paint, pose(at, [0, 0, 0], scale), shade);
  }

  torus(radius: number, tube: number, paint: Paint, at?: Vec3, rotation?: Vec3, arc = Math.PI * 2, segments: [number, number] = [6, 24]) {
    return this.add(new TorusGeometry(radius, tube, segments[0], segments[1], arc), paint, pose(at, rotation), 0);
  }

  /** Tige cylindrique entre deux points (câble rigide, montant, entretoise). */
  rod(from: Vec3, to: Vec3, radius: number, paint: Paint, segments = 5) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const length = Math.hypot(dx, dy, dz);
    const geometry = new CylinderGeometry(radius, radius, length, segments);
    const direction = new Vector3(dx, dy, dz).normalize();
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction);
    const matrix = new Matrix4().compose(
      new Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2),
      rotation,
      new Vector3(1, 1, 1),
    );
    return this.add(geometry, paint, matrix, 0);
  }

  get size() {
    return this.parts.length;
  }

  build() {
    const merged = this.parts.length ? mergeGeometries(this.parts, false) : new BufferGeometry();
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

/**
 * Anneau plat (face vers le ciel) dans la convention des cylindres de three.js
 * (x = r·sin θ, z = r·cos θ) : `segments` = 8 et `start` = π/8 suivent un octogone.
 */
export function flatRing(inner: number, outer: number, segments: number, start = 0) {
  const positions: number[] = [];
  const corner = (radius: number, angle: number) => [radius * Math.sin(angle), 0, radius * Math.cos(angle)];
  for (let index = 0; index < segments; index++) {
    const a0 = start + (index / segments) * Math.PI * 2;
    const a1 = start + ((index + 1) / segments) * Math.PI * 2;
    const i0 = corner(inner, a0);
    const o0 = corner(outer, a0);
    const i1 = corner(inner, a1);
    const o1 = corner(outer, a1);
    positions.push(...i0, ...o0, ...o1, ...i0, ...o1, ...i1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const normals = new Float32Array(positions.length);
  for (let index = 1; index < normals.length; index += 3) normals[index] = 1;
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  return geometry;
}

/** Retourne les faces (paroi vue de l'intérieur : bassin, cuve). */
export function flipFaces(geometry: BufferGeometry) {
  const flipped = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geometry.dispose();
  const positions = flipped.attributes.position;
  const normals = flipped.attributes.normal;
  for (let index = 0; index < positions.count; index += 3) {
    for (const attribute of [positions, normals]) {
      if (!attribute) continue;
      const x = attribute.getX(index + 1);
      const y = attribute.getY(index + 1);
      const z = attribute.getZ(index + 1);
      attribute.setXYZ(index + 1, attribute.getX(index + 2), attribute.getY(index + 2), attribute.getZ(index + 2));
      attribute.setXYZ(index + 2, x, y, z);
    }
  }
  if (normals) for (let index = 0; index < normals.count; index++) normals.setXYZ(index, -normals.getX(index), -normals.getY(index), -normals.getZ(index));
  return flipped;
}

/** Ruban plat (face vers le ciel) le long d'une polyligne horizontale. */
export function flatStrip(points: [number, number][], width: number, y = 0) {
  const positions: number[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / length) * (width / 2);
    const nz = ((bx - ax) / length) * (width / 2);
    const a1 = [ax + nx, y, az + nz];
    const a2 = [ax - nx, y, az - nz];
    const b1 = [bx + nx, y, bz + nz];
    const b2 = [bx - nx, y, bz - nz];
    positions.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Fiole d'Erlenmeyer (verre), posée sur y = 0. */
export function erlenmeyerGeometry(scale = 1) {
  const profile = [
    [0.0, 0.0], [0.085, 0.0], [0.09, 0.015], [0.06, 0.11], [0.029, 0.16], [0.029, 0.23], [0.035, 0.24],
  ].map(([r, y]) => new Vector2(r * scale, y * scale));
  return new LatheGeometry(profile, 12);
}

/** Liquide au fond d'une fiole d'Erlenmeyer. */
export function liquidGeometry(scale = 1) {
  const profile = [[0.0, 0.006], [0.08, 0.006], [0.084, 0.016], [0.066, 0.09], [0.0, 0.09]].map(
    ([r, y]) => new Vector2(r * scale, y * scale),
  );
  return new LatheGeometry(profile, 12);
}
