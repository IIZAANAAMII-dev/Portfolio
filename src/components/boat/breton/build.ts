import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Atelier de peinture du bateau : chaque pièce (primitive three.js ou géométrie maison) est
 * posée, peinte par sommet puis fusionnée avec les autres. Tout ce qui ne bouge pas partage
 * ainsi UN matériau et UN appel de dessin, quelle que soit la quantité de détails.
 */
export type Vec3 = [number, number, number];

export type Placement = {
  at?: Vec3;
  rot?: Vec3;
  scale?: number | Vec3;
  /** Facettes franches (bois, caisses) plutôt que normales lissées. */
  flat?: boolean;
};

/** Couleur unie, ou fonction du centre de chaque face (repère local de la pièce) et de son rang. */
export type Paint = ColorRepresentation | ((x: number, y: number, z: number, face: number) => ColorRepresentation);

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const offset = new Vector3();
const size = new Vector3();
const swatch = new Color();

function paintFaces(geometry: BufferGeometry, paint: Paint) {
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  if (typeof paint !== 'function') swatch.set(paint);
  for (let vertex = 0; vertex < positions.count; vertex += 3) {
    if (typeof paint === 'function') {
      const x = (positions.getX(vertex) + positions.getX(vertex + 1) + positions.getX(vertex + 2)) / 3;
      const y = (positions.getY(vertex) + positions.getY(vertex + 1) + positions.getY(vertex + 2)) / 3;
      const z = (positions.getZ(vertex) + positions.getZ(vertex + 1) + positions.getZ(vertex + 2)) / 3;
      swatch.set(paint(x, y, z, vertex / 3));
    }
    for (let corner = 0; corner < 3; corner++) {
      colors[(vertex + corner) * 3] = swatch.r;
      colors[(vertex + corner) * 3 + 1] = swatch.g;
      colors[(vertex + corner) * 3 + 2] = swatch.b;
    }
  }
  return colors;
}

export class PaintShop {
  private parts: BufferGeometry[] = [];

  /**
   * Ajoute une pièce. `bone` (facultatif) rattache la pièce à un os : la géométrie fusionnée
   * reçoit alors skinIndex / skinWeight (personnage articulé en un seul maillage).
   */
  add(source: BufferGeometry, paint: Paint | null, placement: Placement = {}, bone?: number) {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    source.dispose();
    // `null` : sous-ensemble déjà peint (fusion d'un autre atelier), on garde ses couleurs.
    const kept = geometry.getAttribute('color');
    const colors = paint === null && kept ? new Float32Array(kept.array as Float32Array) : paintFaces(geometry, paint ?? '#ffffff');

    const { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, flat = false } = placement;
    euler.set(rot[0], rot[1], rot[2]);
    quaternion.setFromEuler(euler);
    offset.set(at[0], at[1], at[2]);
    if (typeof scale === 'number') size.setScalar(scale);
    else size.set(scale[0], scale[1], scale[2]);
    matrix.compose(offset, quaternion, size);
    geometry.applyMatrix4(matrix);

    // Une échelle négative retourne les faces : on rétablit l'ordre des sommets.
    if (matrix.determinant() < 0) {
      const positions = geometry.getAttribute('position') as BufferAttribute;
      const normals = geometry.getAttribute('normal') as BufferAttribute | undefined;
      for (let vertex = 0; vertex < positions.count; vertex += 3) {
        for (const attribute of normals ? [positions, normals] : [positions]) {
          const x = attribute.getX(vertex + 1);
          const y = attribute.getY(vertex + 1);
          const z = attribute.getZ(vertex + 1);
          attribute.setXYZ(vertex + 1, attribute.getX(vertex + 2), attribute.getY(vertex + 2), attribute.getZ(vertex + 2));
          attribute.setXYZ(vertex + 2, x, y, z);
        }
        const r = colors[(vertex + 1) * 3];
        const g = colors[(vertex + 1) * 3 + 1];
        const b = colors[(vertex + 1) * 3 + 2];
        colors.copyWithin((vertex + 1) * 3, (vertex + 2) * 3, (vertex + 3) * 3);
        colors[(vertex + 2) * 3] = r;
        colors[(vertex + 2) * 3 + 1] = g;
        colors[(vertex + 2) * 3 + 2] = b;
      }
    }
    if (flat || !geometry.getAttribute('normal')) geometry.computeVertexNormals();

    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    if (bone !== undefined) {
      const count = geometry.getAttribute('position').count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let vertex = 0; vertex < count; vertex++) {
        indices[vertex * 4] = bone;
        weights[vertex * 4] = 1;
      }
      geometry.setAttribute('skinIndex', new BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
    }
    this.parts.push(geometry);
    return this;
  }

  /** Ajoute une géométrie déjà en place (positions monde du bateau), sans transformation. */
  raw(positions: number[], paint: Paint, flat = true) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return this.add(geometry, paint, { flat });
  }

  build() {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((part) => part.dispose());
    this.parts = [];
    if (!merged) throw new Error('[boat] fusion des géométries impossible');
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Petit hasard déterministe (mêmes planches, mêmes teintes à chaque chargement). */
export function seeded(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Quad (deux triangles) a → b → c → d, dans le sens donné. */
export function quad(out: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}
