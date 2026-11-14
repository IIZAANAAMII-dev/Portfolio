import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash } from '@/lib/utils/math';

/**
 * Atelier de géométrie de l'île Expériences : des primitives placées et teintes une à une,
 * fusionnées en UN maillage à couleurs de sommets (un seul appel de dessin pour tout un
 * bâtiment, une grue ou un quai). Les coques (yacht, pointus) sont des lofts de sections.
 */

export type V3 = readonly [number, number, number];

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scaling = new Vector3();
const up = new Vector3(0, 1, 0);
const direction = new Vector3();
const tint = new Color();

export class Builder {
  private parts: BufferGeometry[] = [];

  /** Ajoute une géométrie (consommée), placée puis teinte d'une couleur unie. */
  add(geometry: BufferGeometry, color: string, at: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 | number = 1, jitter = 0) {
    euler.set(rotation[0], rotation[1], rotation[2]);
    quaternion.setFromEuler(euler);
    if (typeof scale === 'number') scaling.setScalar(scale);
    else scaling.set(scale[0], scale[1], scale[2]);
    matrix.compose(position.set(at[0], at[1], at[2]), quaternion, scaling);
    return this.paint(geometry, color, matrix, jitter);
  }

  /** Géométrie transformée par une matrice, une couleur par face (léger écart si `jitter`). */
  paint(geometry: BufferGeometry, color: string, transform?: Matrix4, jitter = 0) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    if (transform) part.applyMatrix4(transform);
    for (const name of ['uv', 'uv1', 'color']) if (part.getAttribute(name)) part.deleteAttribute(name);
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    const count = part.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    const base = new Color(color);
    for (let vertex = 0; vertex < count; vertex += 3) {
      const k = jitter > 0 ? 1 + (hash(this.parts.length * 7.31 + vertex * 0.731) - 0.5) * 2 * jitter : 1;
      tint.copy(base).multiplyScalar(k);
      for (let corner = 0; corner < 3; corner++) tint.toArray(colors, (vertex + corner) * 3);
    }
    part.setAttribute('color', new BufferAttribute(colors, 3));
    this.parts.push(part);
    return this;
  }

  box(size: V3, color: string, at: V3, rotation: V3 = [0, 0, 0], jitter = 0) {
    return this.add(new BoxGeometry(size[0], size[1], size[2]), color, at, rotation, 1, jitter);
  }

  /** Pavé orienté par un lacet (Y) puis un tangage (X) dans son propre repère (murets en pente). */
  slab(size: V3, color: string, at: V3, yaw: number, pitch: number, jitter = 0) {
    euler.set(pitch, yaw, 0, 'YXZ');
    quaternion.setFromEuler(euler);
    euler.order = 'XYZ';
    matrix.compose(position.set(at[0], at[1], at[2]), quaternion, scaling.set(1, 1, 1));
    return this.paint(new BoxGeometry(size[0], size[1], size[2]), color, matrix, jitter);
  }

  cylinder(radiusTop: number, radiusBottom: number, height: number, segments: number, color: string, at: V3, rotation: V3 = [0, 0, 0]) {
    return this.add(new CylinderGeometry(radiusTop, radiusBottom, height, segments), color, at, rotation);
  }

  cone(radius: number, height: number, segments: number, color: string, at: V3, rotation: V3 = [0, 0, 0]) {
    return this.add(new ConeGeometry(radius, height, segments), color, at, rotation);
  }

  sphere(radius: number, color: string, at: V3, scale: V3 | number = 1, detail: [number, number] = [8, 6]) {
    return this.add(new SphereGeometry(radius, detail[0], detail[1]), color, at, [0, 0, 0], scale);
  }

  /** Poutre de section rectangulaire tendue entre deux points. */
  beam(from: V3, to: V3, width: number, color: string, depth = width) {
    direction.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = direction.length();
    quaternion.setFromUnitVectors(up, direction.normalize());
    matrix.compose(
      position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2),
      quaternion,
      scaling.set(1, 1, 1),
    );
    return this.paint(new BoxGeometry(width, length, depth), color, matrix);
  }

  /** Tige cylindrique tendue entre deux points (câbles, mâts, rambardes). */
  rod(from: V3, to: V3, radius: number, color: string, segments = 5) {
    direction.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = direction.length();
    quaternion.setFromUnitVectors(up, direction.normalize());
    matrix.compose(
      position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2),
      quaternion,
      scaling.set(1, 1, 1),
    );
    return this.paint(new CylinderGeometry(radius, radius, length, segments), color, matrix);
  }

  /** Géométrie déjà colorée (attribut `color`), dans le repère final. */
  raw(geometry: BufferGeometry) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const name of ['uv', 'uv1']) if (part.getAttribute(name)) part.deleteAttribute(name);
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    this.parts.push(part);
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  build() {
    const merged = mergeGeometries(this.parts, false) ?? new BufferGeometry();
    for (const part of this.parts) part.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

/* ------------------------------------------------------------------ matériaux */

let paint: MeshStandardMaterial | null = null;
let paintFlat: MeshStandardMaterial | null = null;
let paintDouble: MeshStandardMaterial | null = null;

/** Peinture mate à couleurs de sommets (bâtiments, grue, quais). */
export function paintMaterial() {
  paint ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  return paint;
}

/** Variante à facettes (rochers, bois brut, coques). */
export function flatMaterial() {
  paintFlat ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true });
  return paintFlat;
}

/** Variante double face (voiles, auvents, toiles). */
export function doubleMaterial() {
  paintDouble ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide, flatShading: true });
  return paintDouble;
}

/* ------------------------------------------------------------------ coques */

export interface HullDesign {
  length: number;
  beam: number;
  /** Hauteur du livet (bord) au-dessus de la quille, au milieu. */
  depth: number;
  /** Relevé du livet aux extrémités (tonture). */
  sheer: number;
  /** Largeur relative du tableau arrière (0 : pointu des deux bouts). */
  transom: number;
  /** Bandes de couleur, du bas vers le haut : [hauteur relative de fin, couleur]. */
  bands: [number, string][];
  /** Couleur du pont / de l'intérieur. */
  deck: string;
  /** Hauteur relative du pont sous le livet (0 : pont affleurant). */
  deckDrop: number;
  /** Bateau ouvert : le bordé intérieur (au-dessus du fond) prend la couleur du pont. */
  open?: boolean;
}

/**
 * Coque par sections : x de l'arrière (-L/2) vers l'étrave (+L/2), y vers le haut (quille
 * à 0), z en travers. Chaque face prend la couleur de la bande où tombe son centre : les
 * liserés restent nets, sans texture.
 */
export function hullGeometry(design: HullDesign) {
  const { length, beam, depth, sheer, transom, bands, deck, deckDrop, open = false } = design;
  const stations = 12;
  const ring = [0, 0.38, 0.72, 1];
  const rows: Vector3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const x = -length / 2 + t * length;
    // Largeur : pleine au milieu, pincée vers l'étrave (et vers l'arrière si pointu).
    const bow = Math.max(0, (t - 0.45) / 0.55);
    const stern = Math.max(0, (0.4 - t) / 0.4);
    const width = (beam / 2) * Math.sqrt(Math.max(0, 1 - bow ** 2)) * (1 - stern * stern * (1 - transom));
    const top = depth + sheer * (bow ** 2 + stern ** 2 * 0.7);
    // Le pied d'étrave remonte : la quille se relève vers les deux bouts.
    const keel = depth * 0.12 * bow ** 1.5 * 3 + depth * 0.25 * stern ** 2 * (transom > 0 ? 1.4 : 1);
    const row: Vector3[] = [];
    for (const k of ring) {
      const angle = k * (Math.PI / 2);
      row.push(new Vector3(x, top - (top - keel) * Math.sin(angle) ** 1.25, width * Math.cos(angle) ** 0.75));
    }
    rows.push(row);
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const shade = new Color();
  const bandColor = (y: number) => {
    const relative = y / (depth + sheer * 0.4);
    for (const [end, color] of bands) if (relative <= end) return color;
    return bands[bands.length - 1][1];
  };
  const triangle = (a: Vector3, b: Vector3, c: Vector3, color?: string) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    shade.set(color ?? bandColor((a.y + b.y + c.y) / 3));
    for (let k = 0; k < 3; k++) colors.push(shade.r, shade.g, shade.b);
  };
  const mirror = (v: Vector3) => new Vector3(v.x, v.y, -v.z);
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < ring.length - 1; j++) {
      const a = rows[i][j];
      const b = rows[i + 1][j];
      const c = rows[i + 1][j + 1];
      const d = rows[i][j + 1];
      // Tribord (+z) puis bâbord (-z), enroulements opposés.
      triangle(a, d, b);
      triangle(b, d, c);
      triangle(mirror(a), mirror(b), mirror(d));
      triangle(mirror(b), mirror(c), mirror(d));
      if (open && j === 0) {
        // Bordé vu de l'intérieur : mêmes sommets, enroulement inversé.
        triangle(a, b, d, deck);
        triangle(b, c, d, deck);
        triangle(mirror(a), mirror(d), mirror(b), deck);
        triangle(mirror(b), mirror(d), mirror(c), deck);
      }
    }
  }
  // Tableau arrière (s'il existe).
  const last = rows[0];
  if (transom > 0) {
    for (let j = 0; j < ring.length - 1; j++) {
      triangle(last[j], mirror(last[j]), last[j + 1]);
      triangle(mirror(last[j]), mirror(last[j + 1]), last[j + 1]);
    }
  }
  // Pont (ou fond intérieur) légèrement sous le livet.
  for (let i = 0; i < stations; i++) {
    const a = rows[i][0].clone();
    const b = rows[i + 1][0].clone();
    a.y -= deckDrop * depth;
    b.y -= deckDrop * depth;
    triangle(a, b, mirror(b), deck);
    triangle(a, mirror(b), mirror(a), deck);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Ajoute une coque à un Builder en conservant ses couleurs de bandes. */
export function addHull(builder: Builder, design: HullDesign, at: V3, rotation: V3 = [0, 0, 0]) {
  const geometry = hullGeometry(design);
  euler.set(rotation[0], rotation[1], rotation[2]);
  quaternion.setFromEuler(euler);
  matrix.compose(position.set(at[0], at[1], at[2]), quaternion, scaling.set(1, 1, 1));
  geometry.applyMatrix4(matrix);
  builder.raw(geometry);
}
