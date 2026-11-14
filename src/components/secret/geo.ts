import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Petit atelier de géométrie : des primitives colorées (couleur par sommet) posées puis
 * fusionnées en un seul maillage. Un personnage, un trépied ou toute une façade ne coûtent
 * ainsi qu'un draw call, avec un matériau partagé.
 */

const color = new Color();
const matrix = new Matrix4();
const rotation = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const size = new Vector3();

export interface Place {
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
}

/** Donne une couleur unie (sRGB → linéaire) à tous les sommets, et ne garde que position/normale/uv. */
export function tint(geometry: BufferGeometry, hex: string, shade = 1) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  if (source !== geometry) geometry.dispose();
  for (const name of Object.keys(source.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') source.deleteAttribute(name);
  }
  if (!source.attributes.uv) {
    source.setAttribute('uv', new BufferAttribute(new Float32Array(source.attributes.position.count * 2), 2));
  }
  if (!source.attributes.normal) source.computeVertexNormals();
  color.set(hex).multiplyScalar(shade);
  const count = source.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) color.toArray(colors, index * 3);
  source.setAttribute('color', new BufferAttribute(colors, 3));
  return source;
}

/** Pose une géométrie (rotation XYZ, échelle, position) puis la colore. */
export function part(geometry: BufferGeometry, hex: string, place: Place = {}, shade = 1) {
  const { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = place;
  euler.set(rot[0], rot[1], rot[2], 'XYZ');
  rotation.setFromEuler(euler);
  position.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') size.setScalar(scale);
  else size.set(scale[0], scale[1], scale[2]);
  matrix.compose(position, rotation, size);
  geometry.applyMatrix4(matrix);
  return tint(geometry, hex, shade);
}

/** Fusionne des pièces déjà colorées (et libère les pièces). */
export function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts, false);
  parts.forEach((piece) => piece.dispose());
  if (!merged) throw new Error('fusion de géométries impossible');
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** Applique une transformation à une géométrie déjà colorée (copie). */
export function placed(geometry: BufferGeometry, place: Place) {
  const { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = place;
  euler.set(rot[0], rot[1], rot[2], 'XYZ');
  rotation.setFromEuler(euler);
  position.set(at[0], at[1], at[2]);
  if (typeof scale === 'number') size.setScalar(scale);
  else size.set(scale[0], scale[1], scale[2]);
  matrix.compose(position, rotation, size);
  return geometry.clone().applyMatrix4(matrix);
}

/**
 * Quadrilatère (deux triangles) avec uv en mètres : sert aux murs, pignons, toit.
 * Les quatre coins sont donnés dans l'ordre (bas-gauche, bas-droite, haut-droite, haut-gauche)
 * vus de face ; `uv` donne leurs coordonnées de texture.
 */
export function quad(
  corners: [number, number, number][],
  uv: [number, number][],
  shades: number[] = [1, 1, 1, 1],
) {
  const [a, b, c, d] = corners;
  const positions = new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]);
  const uvs = new Float32Array([...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]]);
  const order = [0, 1, 2, 0, 2, 3];
  const colors = new Float32Array(18);
  order.forEach((corner, index) => colors.set([shades[corner], shades[corner], shades[corner]], index * 3));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
