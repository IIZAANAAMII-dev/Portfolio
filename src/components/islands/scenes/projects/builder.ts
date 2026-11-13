import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Atelier de maquettiste : des pièces simples (blocs, cylindres, toits, sphères…) peintes
 * par sommet puis fusionnées en UN seul maillage. Un bâtiment entier ne coûte qu'un draw
 * call par matériau, quel que soit son nombre de pièces.
 *
 * Les dessus sont légèrement éclaircis et les dessous assombris (`shade`) : les arêtes
 * ressortent comme sur un jouet peint, même à l'ombre.
 */

export type V3 = [number, number, number];

const euler = new Euler();
const quaternion = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const tint = new Color();

export function pose(at: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: number | V3 = 1) {
  euler.set(rotation[0], rotation[1], rotation[2]);
  quaternion.setFromEuler(euler);
  offset.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') stretch.setScalar(scale);
  else stretch.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(offset, quaternion, stretch);
}

export class Maquette {
  private parts: BufferGeometry[] = [];

  /** Ajoute une géométrie quelconque, posée par `matrix`, peinte d'une couleur. */
  add(geometry: BufferGeometry, color: string, matrix?: Matrix4, shade = 0.1) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    if (matrix) piece.applyMatrix4(matrix);
    for (const name of Object.keys(piece.attributes)) {
      if (name !== 'position' && name !== 'normal') piece.deleteAttribute(name);
    }
    if (!piece.attributes.normal) piece.computeVertexNormals();
    const positions = piece.attributes.position;
    const normals = piece.attributes.normal;
    const colors = new Float32Array(positions.count * 3);
    const base = new Color(color);
    for (let index = 0; index < positions.count; index++) {
      const ny = normals.getY(index);
      tint.copy(base);
      if (shade) tint.multiplyScalar(1 + (ny > 0.5 ? shade * ny : ny < -0.5 ? shade * 1.6 * ny : 0));
      colors[index * 3] = tint.r;
      colors[index * 3 + 1] = tint.g;
      colors[index * 3 + 2] = tint.b;
    }
    piece.setAttribute('color', new BufferAttribute(colors, 3));
    this.parts.push(piece);
    return this;
  }

  /** Bloc centré en `at`. */
  box(size: V3, at: V3, color: string, rotation: V3 = [0, 0, 0], shade?: number) {
    return this.add(new BoxGeometry(size[0], size[1], size[2]), color, pose(at, rotation), shade);
  }

  /** Bloc aligné sur les axes, donné par ses deux coins opposés. */
  block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, shade?: number) {
    return this.box(
      [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)],
      [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      color,
      [0, 0, 0],
      shade,
    );
  }

  /** Cylindre (ou tronc de cône) vertical centré en `at`. */
  cylinder(radiusTop: number, radiusBottom: number, height: number, at: V3, color: string, segments = 10, rotation: V3 = [0, 0, 0], shade?: number) {
    return this.add(new CylinderGeometry(radiusTop, radiusBottom, height, segments), color, pose(at, rotation), shade);
  }

  /** Poteau, câble ou tube entre deux points. */
  rod(from: V3, to: V3, radius: number, color: string, segments = 6, shade?: number) {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const length = a.distanceTo(b);
    const geometry = new CylinderGeometry(radius, radius, length, segments);
    const direction = b.clone().sub(a).normalize();
    const matrix = new Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction),
      new Vector3(1, 1, 1),
    );
    return this.add(geometry, color, matrix, shade);
  }

  /** Poutre carrée entre deux points (échafaudages, rails, treillis). */
  beam(from: V3, to: V3, width: number, color: string, shade?: number) {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const length = a.distanceTo(b);
    const direction = b.clone().sub(a).normalize();
    const matrix = new Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction),
      new Vector3(1, 1, 1),
    );
    return this.add(new BoxGeometry(width, length, width), color, matrix, shade);
  }

  cone(radius: number, height: number, at: V3, color: string, segments = 8, rotation: V3 = [0, 0, 0], shade?: number) {
    return this.add(new ConeGeometry(radius, height, segments), color, pose(at, rotation), shade);
  }

  sphere(radius: number, at: V3, color: string, detail = 1, scale: V3 = [1, 1, 1], shade?: number) {
    return this.add(new IcosahedronGeometry(radius, detail), color, pose(at, [0, 0, 0], scale), shade);
  }

  /** Demi-sphère (dôme) posée sur le plan y = at[1]. */
  dome(radius: number, at: V3, color: string, segments = 16, scale: V3 = [1, 1, 1], shade?: number) {
    return this.add(new SphereGeometry(radius, segments, Math.max(4, segments / 2), 0, Math.PI * 2, 0, Math.PI / 2), color, pose(at, [0, 0, 0], scale), shade);
  }

  torus(radius: number, tube: number, at: V3, color: string, rotation: V3 = [Math.PI / 2, 0, 0], segments = 24, arc = Math.PI * 2, shade?: number) {
    return this.add(new TorusGeometry(radius, tube, 6, segments, arc), color, pose(at, rotation), shade);
  }

  /** Toit à deux pans : prisme triangulaire le long de X, faîtage à `at[1] + height`. */
  gable(width: number, depth: number, height: number, at: V3, color: string, rotation: V3 = [0, 0, 0], shade?: number) {
    const shape = new Shape();
    shape.moveTo(-depth / 2, 0);
    shape.lineTo(depth / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geometry.translate(0, 0, -width / 2);
    geometry.rotateY(Math.PI / 2);
    return this.add(geometry, color, pose(at, rotation), shade);
  }

  /** Profil 2D (x, y) extrudé sur `depth` le long de Z, centré. */
  extrude(points: [number, number][], depth: number, at: V3, color: string, rotation: V3 = [0, 0, 0], shade?: number) {
    const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)));
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    return this.add(geometry, color, pose(at, rotation), shade);
  }

  /** Volume de révolution (profil (rayon, hauteur)). */
  lathe(profile: [number, number][], at: V3, color: string, segments = 16, scale: V3 = [1, 1, 1], shade?: number) {
    const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments);
    return this.add(geometry, color, pose(at, [0, 0, 0], scale), shade);
  }

  /** Plaque mince verticale (face +Z), pour les liserés et panneaux plats. */
  panel(width: number, height: number, at: V3, color: string, rotation: V3 = [0, 0, 0]) {
    return this.add(new PlaneGeometry(width, height), color, pose(at, rotation), 0);
  }

  get empty() {
    return this.parts.length === 0;
  }

  /** Fusionne toutes les pièces (et les libère). */
  build() {
    if (!this.parts.length) return new BufferGeometry();
    const merged = mergeGeometries(this.parts, false) ?? new BufferGeometry();
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}
