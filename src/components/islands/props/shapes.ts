import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';

/**
 * Atelier de géométrie des accessoires procéduraux : des pièces simples (boîtes, cylindres,
 * triangles faits main) peintes par sommet puis réunies en UN maillage non indexé. Un décor
 * statique entier (kiosque, casiers, hortensias…) ne coûte qu'un draw call ; les facettes
 * restent nettes (normales de face) pour le cel-shading.
 */

export type Vec3 = [number, number, number];

/** Peinture calculée par sommet : position après pose et hauteur de la normale. */
export type Painter = (x: number, y: number, z: number, ny: number, out: Color) => void;

/** Attribut supplémentaire : valeur constante pour toute la pièce, ou calculée par sommet. */
export type Extra = number | ((x: number, y: number, z: number) => number);

const facePainters = new WeakSet<Painter>();

/**
 * Peinture par FACE (évaluée au centre du triangle) : lames, tuiles, pierres, rayures
 * restent nettes au lieu de se fondre d'un sommet à l'autre.
 */
export function perFace(painter: Painter): Painter {
  facePainters.add(painter);
  return painter;
}

const euler = new Euler();
const quaternion = new Quaternion();
const offset = new Vector3();
const stretch = new Vector3();
const tint = new Color();
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const ab = new Vector3();
const ac = new Vector3();

/** Matrice de pose : position, rotation (XYZ) et échelle. */
export function pose(at: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: number | Vec3 = 1) {
  euler.set(rotation[0], rotation[1], rotation[2]);
  quaternion.setFromEuler(euler);
  offset.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') stretch.setScalar(scale);
  else stretch.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(offset, quaternion, stretch);
}

export class MeshBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private extras = new Map<string, number[]>();

  /** `extras` : noms des attributs flottants supplémentaires (une composante chacun). */
  constructor(private extraNames: string[] = []) {
    extraNames.forEach((name) => this.extras.set(name, []));
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  private pushExtras(x: number, y: number, z: number, extra?: Record<string, Extra>) {
    this.extras.forEach((list, name) => {
      const value = extra?.[name];
      list.push(value === undefined ? 0 : typeof value === 'number' ? value : value(x, y, z));
    });
  }

  /**
   * Triangle peint (sens antihoraire vu de l'extérieur). `shade` éclaircit les faces
   * tournées vers le ciel et assombrit les flancs, comme sur un jouet peint.
   */
  triangle(p: Vec3, q: Vec3, r: Vec3, color: ColorRepresentation | Painter, extra?: Record<string, Extra>, shade = 0) {
    a.set(p[0], p[1], p[2]);
    b.set(q[0], q[1], q[2]);
    c.set(r[0], r[1], r[2]);
    const ny = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize().y;
    const lighten = shade ? (ny > 0.55 ? 1 + shade * 0.35 : ny < -0.55 ? 1 - shade * 1.3 : 1 - shade * 0.5) : 1;
    // Peinture par face : une seule couleur, évaluée au centre du triangle.
    const face = typeof color === 'function' && facePainters.has(color);
    if (face) {
      (color as Painter)((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, ny, tint);
      tint.multiplyScalar(lighten);
    } else if (typeof color !== 'function') {
      tint.set(color).multiplyScalar(lighten);
    }
    for (const v of [a, b, c]) {
      if (typeof color === 'function' && !face) {
        color(v.x, v.y, v.z, ny, tint);
        tint.multiplyScalar(lighten);
      }
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(tint.r, tint.g, tint.b);
      this.pushExtras(v.x, v.y, v.z, extra);
    }
    return this;
  }

  /** Triangle d'une surface tournée vers le ciel : le sens est corrigé si besoin. */
  triangleUp(p: Vec3, q: Vec3, r: Vec3, color: ColorRepresentation | Painter, extra?: Record<string, Extra>, shade = 0) {
    a.set(p[0], p[1], p[2]);
    b.set(q[0], q[1], q[2]);
    c.set(r[0], r[1], r[2]);
    const ny = ab.subVectors(b, a).cross(ac.subVectors(c, a)).y;
    return ny >= 0 ? this.triangle(p, q, r, color, extra, shade) : this.triangle(p, r, q, color, extra, shade);
  }

  /** Quadrilatère p → q → r → s (deux triangles). */
  quad(p: Vec3, q: Vec3, r: Vec3, s: Vec3, color: ColorRepresentation | Painter, extra?: Record<string, Extra>, shade = 0) {
    this.triangle(p, q, r, color, extra, shade);
    this.triangle(p, r, s, color, extra, shade);
    return this;
  }

  /** Ajoute une géométrie three.js posée par `matrix`, peinte d'une couleur ou d'un peintre. */
  add(
    geometry: BufferGeometry,
    color: ColorRepresentation | Painter,
    matrix?: Matrix4,
    shade = 0,
    extra?: Record<string, Extra>,
  ) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry;
    const source = piece.getAttribute('position');
    // Une matrice miroir retourne les faces : on rétablit le sens.
    const mirrored = matrix !== undefined && matrix.determinant() < 0;
    for (let index = 0; index + 2 < source.count; index += 3) {
      const corners: Vec3[] = [];
      for (let k = 0; k < 3; k++) {
        a.fromBufferAttribute(source, index + k);
        if (matrix) a.applyMatrix4(matrix);
        corners.push([a.x, a.y, a.z]);
      }
      if (mirrored) this.triangle(corners[0], corners[2], corners[1], color, extra, shade);
      else this.triangle(corners[0], corners[1], corners[2], color, extra, shade);
    }
    return this;
  }

  /** Géométrie finale, non indexée (normales de face) ; null si vide. */
  build() {
    if (this.positions.length === 0) return null;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    this.extras.forEach((list, name) => geometry.setAttribute(name, new BufferAttribute(new Float32Array(list), 1)));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Boîte aux arêtes supérieures chanfreinées : le dessus attrape la lumière autrement que
 * les flancs, la pièce a l'air taillée à la main.
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
  return box;
}

/** Mélange de deux couleurs hexadécimales (utile pour les dégradés de peinture). */
export function mix(from: ColorRepresentation, to: ColorRepresentation, t: number) {
  return new Color(from).lerp(new Color(to), t);
}
