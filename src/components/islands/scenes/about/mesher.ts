import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Petit atelier de géométrie du village : on empile des pièces (boîtes, prismes, galets),
 * chacune transformée et peinte, puis on fusionne le tout en UNE géométrie par matériau.
 * Des centaines de pierres d'angle, volets ou pots de fleurs ne coûtent qu'un draw call.
 */

export type Vec3 = [number, number, number];

const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();
const scratchScale = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Matrice de pose : position, rotation (Euler XYZ), échelle. */
export function pose(position: Vec3, rotation: Vec3 = [0, 0, 0], scale: number | Vec3 = 1) {
  scratchPosition.set(...position);
  scratchQuaternion.setFromEuler(scratchEuler.set(...rotation));
  if (typeof scale === 'number') scratchScale.setScalar(scale);
  else scratchScale.set(...scale);
  return new Matrix4().compose(scratchPosition, scratchQuaternion, scratchScale);
}

/** Boîte dont les UV sont en mètres : la texture garde la même taille sur tous les murs. */
export function meterBox(width: number, height: number, depth: number) {
  const box = new BoxGeometry(width, height, depth);
  const uv = box.attributes.uv;
  // Ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune).
  const spans = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  for (let face = 0; face < 6; face++) {
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner;
      uv.setXY(index, uv.getX(index) * spans[face][0], uv.getY(index) * spans[face][1]);
    }
  }
  return box;
}

/** Cylindre dont les UV sont en mètres (tour, musoir de jetée). */
export function meterCylinder(radiusTop: number, radiusBottom: number, height: number, segments = 16) {
  const cylinder = new CylinderGeometry(radiusTop, radiusBottom, height, segments, 1);
  const uv = cylinder.attributes.uv;
  const around = Math.PI * (radiusTop + radiusBottom);
  for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) * around, uv.getY(index) * height);
  return cylinder;
}

/** Galet / rocher arrondi à facettes : icosaèdre déformé de façon continue (sans fissure). */
export function pebble(seed: number, detail = 1, squash = 0.72) {
  const rock = new IcosahedronGeometry(1, detail);
  const positions = rock.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const bump = 1
      + Math.sin(x * 2.9 + seed * 1.7) * Math.sin(z * 2.3 - seed) * 0.13
      + Math.sin(y * 3.7 + seed * 2.3) * 0.08
      + Math.sin((x + z) * 5.1 + seed * 0.7) * 0.05;
    // Dessous aplati : le rocher repose sur le sol.
    const flatY = y < -0.35 ? -0.35 + (y + 0.35) * 0.3 : y;
    positions.setXYZ(index, x * bump, flatY * bump * squash, z * bump);
  }
  rock.computeVertexNormals();
  return rock;
}

const ATTRIBUTES = ['position', 'normal', 'uv', 'color'];

export class Mesher {
  private parts: BufferGeometry[] = [];
  private paint = new Color();
  private frame: Matrix4 | null = null;
  private combined = new Matrix4();

  /**
   * @param colors  chaque pièce reçoit une couleur de sommet (matériau `vertexColors`)
   * @param uvs     conserve les UV (matériau texturé)
   */
  constructor(private readonly colors = true, private readonly uvs = false) {}

  get empty() {
    return this.parts.length === 0;
  }

  /** Les pièces suivantes sont posées dans ce repère (null : retour au repère d'origine). */
  within(frame: Matrix4 | null) {
    this.frame = frame;
    return this;
  }

  /** Ajoute une copie de `source`, transformée par `matrix` et peinte de `color`. */
  add(source: BufferGeometry, matrix?: Matrix4, color: ColorRepresentation = '#ffffff') {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (!ATTRIBUTES.includes(name)) geometry.deleteAttribute(name);
    }
    if (matrix && this.frame) geometry.applyMatrix4(this.combined.multiplyMatrices(this.frame, matrix));
    else if (matrix ?? this.frame) geometry.applyMatrix4((matrix ?? this.frame)!);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const count = geometry.attributes.position.count;
    if (this.uvs) {
      if (!geometry.attributes.uv) geometry.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
    } else if (geometry.attributes.uv) {
      geometry.deleteAttribute('uv');
    }
    if (this.colors) {
      if (!geometry.attributes.color || color !== '#ffffff') {
        this.paint.set(color);
        const values = new Float32Array(count * 3);
        for (let index = 0; index < count; index++) this.paint.toArray(values, index * 3);
        geometry.setAttribute('color', new BufferAttribute(values, 3));
      }
    } else if (geometry.attributes.color) {
      geometry.deleteAttribute('color');
    }
    this.parts.push(geometry);
    return this;
  }

  /** Boîte posée (UV en mètres). */
  box(size: Vec3, position: Vec3, rotation: Vec3 = [0, 0, 0], color: ColorRepresentation = '#ffffff') {
    const box = meterBox(...size);
    this.add(box, pose(position, rotation), color);
    box.dispose();
    return this;
  }

  /** Cylindre (mât, espar, perche, cordage) tendu entre deux points. */
  rod(from: Vec3, to: Vec3, radius: number, color: ColorRepresentation = '#ffffff', segments = 6) {
    scratchPosition.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = scratchPosition.length();
    if (length < 1e-4) return this;
    const cylinder = new CylinderGeometry(radius, radius, length, segments, 1);
    scratchQuaternion.setFromUnitVectors(UP, scratchPosition.normalize());
    scratchPosition.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    this.add(cylinder, new Matrix4().compose(scratchPosition, scratchQuaternion, scratchScale.setScalar(1)), color);
    cylinder.dispose();
    return this;
  }

  /** Ajoute toutes les pièces d'un autre atelier, transformées. */
  merge(other: Mesher, matrix?: Matrix4) {
    for (const part of other.parts) {
      const geometry = part.clone();
      if (matrix) geometry.applyMatrix4(matrix);
      this.parts.push(geometry);
    }
    return this;
  }

  /** Géométrie fusionnée (null si rien n'a été ajouté). Les pièces sont libérées. */
  build() {
    if (this.parts.length === 0) return null;
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    merged?.computeBoundingSphere();
    return merged;
  }
}
