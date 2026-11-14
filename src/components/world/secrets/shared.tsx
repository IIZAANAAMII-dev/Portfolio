'use client';

import { useRef, type ReactNode, type SyntheticEvent } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Camera,
  type ColorRepresentation,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import styles from './card.module.css';

/**
 * Briques communes des secrets : visibilité (cercle d'intro + distance caméra), matériaux
 * partagés, petits outils de géométrie fusionnée à couleurs de sommets, banc de sable,
 * collier d'écume et fiche en papier.
 */

/* ------------------------------------------------------------------ visibilité */

/**
 * Le secret est-il à montrer ? Pas avant que le cercle d'intro l'ait atteint, et seulement
 * quand la caméra est assez proche pour le voir (sinon : ni dessin, ni animation).
 */
export function inSight(camera: Camera, x: number, z: number, range = 150) {
  const { introCenter, introRadius } = useWorld.getState();
  if (Math.hypot(x - introCenter[0], z - introCenter[1]) > introRadius - 2) return false;
  return Math.hypot(camera.position.x - x, camera.position.z - z) < range;
}

/* ------------------------------------------------------------------ matériaux */

let paint: MeshStandardMaterial | null = null;
let paintDouble: MeshStandardMaterial | null = null;

/** Matériau unique des pièces fusionnées : couleurs de sommets, facettes, mat. */
export function paintMaterial() {
  paint ??= new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  return paint;
}

/** Variante double face (voiles, filets, nageoires fines). */
export function paintDoubleMaterial() {
  paintDouble ??= new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
    metalness: 0,
    side: DoubleSide,
  });
  return paintDouble;
}

/* ------------------------------------------------------------------ géométrie */

const tmpMatrix = new Matrix4();
const tmpQuaternion = new Quaternion();
const tmpEuler = new Euler();
const tmpPosition = new Vector3();
const tmpScale = new Vector3();

/** Matrice de placement (position, rotation XYZ, échelle). */
export function at(
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: number | [number, number, number] = 1,
) {
  tmpEuler.set(rotation[0], rotation[1], rotation[2]);
  tmpQuaternion.setFromEuler(tmpEuler);
  tmpPosition.set(position[0], position[1], position[2]);
  if (typeof scale === 'number') tmpScale.setScalar(scale);
  else tmpScale.set(scale[0], scale[1], scale[2]);
  return tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale).clone();
}

/**
 * Pièce prête à fusionner : non indexée, placée, une couleur par sommet. `jitter` fait
 * varier la teinte face par face (peinture écaillée, bois inégal).
 */
export function piece(
  geometry: BufferGeometry,
  color: ColorRepresentation,
  matrix?: Matrix4,
  jitter = 0,
  seed = 1,
) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geometry.dispose();
  if (matrix) g.applyMatrix4(matrix);
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
  if (g.getAttribute('color')) g.deleteAttribute('color');
  const base = new Color(color);
  const shade = new Color();
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let vertex = 0; vertex < count; vertex += 3) {
    const k = jitter > 0 ? 1 + (hash(seed * 13.7 + vertex * 0.731) - 0.5) * 2 * jitter : 1;
    shade.copy(base).multiplyScalar(k);
    for (let corner = 0; corner < 3 && vertex + corner < count; corner++) shade.toArray(colors, (vertex + corner) * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

/** Fusionne des pièces (toutes issues de `piece`) en une seule géométrie : un seul dessin. */
export function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error('secrets: fusion impossible');
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** Rocher facetté (icosaèdre bosselé), base aplatie. */
export function rockGeometry(seed: number, detail = 1) {
  const rock = new IcosahedronGeometry(1, detail);
  const position = rock.getAttribute('position');
  const v = new Vector3();
  for (let index = 0; index < position.count; index++) {
    v.fromBufferAttribute(position, index);
    const n = 1
      + Math.sin(v.x * 3.1 + seed) * 0.12
      + Math.sin(v.y * 4.3 - seed * 1.7) * 0.1
      + Math.sin(v.z * 5.2 + seed * 0.6) * 0.08;
    v.multiplyScalar(n);
    if (v.y < -0.35) v.y = -0.35 - (v.y + 0.35) * 0.25;
    position.setXYZ(index, v.x, v.y, v.z);
  }
  rock.computeVertexNormals();
  return rock;
}

/* ------------------------------------------------------------------ banc de sable */

export interface SandbankShape {
  rx: number;
  rz: number;
  /** Hauteur du sommet au-dessus du niveau moyen de l'eau. */
  top: number;
  /** Profondeur du bord, sous l'eau. */
  depth: number;
  seed: number;
  /**
   * Haut-fond : sous cette hauteur la pente s'arrête en un plateau horizontal, qui s'étend
   * plus loin (`shelfReach` × rayon). Vu à travers l'eau, il dessine un lagon clair.
   */
  shelf?: number;
  shelfReach?: number;
}

/** Facteur de rayon irrégulier du rivage (partagé par le sable et le collier d'écume). */
export function shoreNoise(angle: number, seed: number) {
  return 1 + Math.sin(angle * 3 + seed * 1.3) * 0.11 + Math.sin(angle * 7 - seed * 0.7) * 0.06 + Math.sin(angle * 13 + seed) * 0.025;
}

/** Profil du banc : dôme très aplati qui plonge sous l'eau vers le bord (t = 0 centre, 1 bord). */
function bankHeight(shape: SandbankShape, t: number) {
  return shape.top - (shape.top + shape.depth) * Math.pow(t, 2.4);
}

/** Rayon relatif (0 → 1) où l'eau, à la hauteur `water`, rencontre le sable. */
export function waterline(shape: SandbankShape, water: number) {
  const k = (shape.top - water) / (shape.top + shape.depth);
  return Math.pow(Math.min(Math.max(k, 0.0001), 1), 1 / 2.4);
}

const DRY_SAND = new Color('#f0d7a2');
const WET_SAND = new Color('#cfa96e');
const SHELF_SAND = new Color('#e6d9ae');

/**
 * Banc de sable : disque facetté, sable sec au sommet, mouillé au bord ; sous l'eau, un
 * plateau clair (haut-fond) qui fait un lagon turquoise autour du banc.
 */
export function sandbankGeometry(shape: SandbankShape) {
  const rings = 7;
  const segments = 30;
  const shelf = shape.shelf ?? -Infinity;
  const reach = shape.shelfReach ?? 1;
  const positions: number[] = [0, shape.top, 0];
  for (let ring = 1; ring <= rings + (reach > 1 ? 1 : 0); ring++) {
    const outer = ring > rings;
    const t = outer ? reach : ring / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2 + (ring % 2) * (Math.PI / segments);
      const n = shoreNoise(angle, shape.seed) * (1 + (hash(ring * 7.1 + segment * 3.3 + shape.seed) - 0.5) * 0.06);
      const slope = bankHeight(shape, Math.min(t, 1)) + (hash(segment * 1.9 + ring * 5.3 + shape.seed) - 0.5) * 0.06 * (1 - t);
      const y = Math.max(slope, shelf);
      positions.push(Math.cos(angle) * shape.rx * t * n, y, Math.sin(angle) * shape.rz * t * n);
    }
  }
  const totalRings = rings + (reach > 1 ? 1 : 0);
  const index: number[] = [];
  for (let segment = 0; segment < segments; segment++) index.push(0, 1 + ((segment + 1) % segments), 1 + segment);
  for (let ring = 1; ring < totalRings; ring++) {
    const inner = 1 + (ring - 1) * segments;
    const outer = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment++) {
      const a = inner + segment;
      const b = inner + ((segment + 1) % segments);
      const c = outer + segment;
      const d = outer + ((segment + 1) % segments);
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  const position = flat.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const y = (position.getY(vertex) + position.getY(vertex + 1) + position.getY(vertex + 2)) / 3;
    if (y > 0.16) color.copy(DRY_SAND);
    else if (y > -0.25) color.copy(WET_SAND).lerp(DRY_SAND, (y + 0.25) / 0.41 * 0.6);
    else color.copy(WET_SAND).lerp(SHELF_SAND, Math.min(1, (-0.25 - y) / 0.2));
    color.multiplyScalar(1 + (hash(vertex * 0.37 + shape.seed) - 0.5) * 0.07);
    for (let corner = 0; corner < 3; corner++) color.toArray(colors, (vertex + corner) * 3);
  }
  flat.setAttribute('color', new BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  return flat;
}

/* ------------------------------------------------------------------ collier d'écume */

const foamVertex = /* glsl */ `
attribute float aRing;
attribute float aAngle;
varying float vRing;
varying float vAngle;
void main() {
  vRing = aRing;
  vAngle = aAngle;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const foamFragment = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uOpacity;
varying float vRing;
varying float vAngle;
void main() {
  // Bande d'écume franche au ras du sable, cassée par deux ondulations, et une vaguelette
  // qui part vers le large.
  float n = 0.5 + 0.5 * sin(vAngle * 9.0 + uTime * 0.6);
  float m = 0.5 + 0.5 * sin(vAngle * 23.0 - uTime * 1.1 + 1.7);
  float band = smoothstep(0.0, 0.1, vRing) * (1.0 - smoothstep(0.3 + n * 0.12, 0.42 + m * 0.12, vRing));
  // Vaguelette qui s'éloigne du rivage : même phase tout autour (pas de rayons), cassée en tirets.
  float travel = fract(uTime * 0.32);
  float wavelet = smoothstep(0.07, 0.0, abs(vRing - (0.4 + travel * 0.6))) * (1.0 - travel);
  float broken = smoothstep(0.35, 0.6, 0.5 + 0.5 * sin(vAngle * 17.0 + uTime * 0.4) * cos(vAngle * 5.0 - 1.3));
  float alpha = max(band * 0.92, wavelet * broken * 0.6) * uOpacity;
  vec3 color = mix(vec3(0.97, 0.99, 0.96), vec3(0.62, 0.78, 0.9), uNight * 0.6);
  gl_FragColor = vec4(color, alpha);
}
`;

/** Anneau elliptique autour d'un rivage irrégulier (rayons de base rx, rz, largeur `width`). */
export function foamRingGeometry(rx: number, rz: number, seed: number, width = 1.1) {
  const segments = 64;
  const positions: number[] = [];
  const ring: number[] = [];
  const angles: number[] = [];
  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * Math.PI * 2;
    const n = shoreNoise(angle, seed);
    const cx = Math.cos(angle) * n;
    const cz = Math.sin(angle) * n;
    positions.push(cx * (rx - width * 0.25), 0, cz * (rz - width * 0.25));
    positions.push(cx * (rx + width), 0, cz * (rz + width));
    ring.push(0, 1);
    angles.push(angle, angle);
  }
  const index: number[] = [];
  for (let segment = 0; segment < segments; segment++) {
    const a = segment * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aRing', new BufferAttribute(new Float32Array(ring), 1));
  geometry.setAttribute('aAngle', new BufferAttribute(new Float32Array(angles), 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createFoamMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: foamVertex,
    fragmentShader: foamFragment,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Collier d'écume d'un banc de sable : il suit la houle et se resserre quand l'eau monte
 * (la ligne d'eau remonte la pente du sable). `world` sert à lire la houle ; `local` place
 * l'anneau dans le repère parent (dont l'origine est au niveau moyen de la mer).
 */
export function FoamCollar({
  shape,
  world,
  local = [0, 0],
  rotation = 0,
  geometry,
  material,
}: {
  shape: SandbankShape;
  world: [number, number];
  local?: [number, number];
  rotation?: number;
  geometry: BufferGeometry;
  material: ShaderMaterial;
}) {
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    const target = mesh.current;
    if (!target || !target.parent?.visible) return;
    const time = state.clock.elapsedTime;
    const water = waveHeight(world[0], world[1], time);
    const k = waterline(shape, water);
    target.position.set(local[0], water + 0.03, local[1]);
    target.scale.set(k, 1, k);
    const uniforms = (target.material as ShaderMaterial).uniforms;
    uniforms.uTime.value = time;
    uniforms.uNight.value = skyState.dayNight;
  });
  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      rotation-y={rotation}
      renderOrder={3}
      raycast={() => null}
    />
  );
}

/* ------------------------------------------------------------------ fiche papier */

/**
 * Le clic sur la fiche ne doit pas traverser jusqu'à l'océan (le bateau partirait) :
 * la fiche vit dans sa propre racine React, on arrête l'événement à sa sortie.
 */
function stop(event: SyntheticEvent) {
  event.stopPropagation();
}

export function SecretCard({
  position,
  eyebrow,
  glyph,
  ink = '#2f7a5a',
  tone,
  label,
  onClose,
  children,
}: {
  position: [number, number, number];
  eyebrow: string;
  glyph: string;
  ink?: string;
  tone?: 'gold';
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Html position={position} zIndexRange={[19, 10]}>
      <div className={styles.anchor}>
        <article
          className={styles.card}
          data-tone={tone}
          aria-label={label}
          onPointerDown={stop}
          onPointerUp={stop}
          onClick={stop}
          onDoubleClick={stop}
          onWheel={stop}
        >
          <span className={styles.eyebrow} style={{ ['--ink-color' as string]: ink }}>
            <span className={styles.glyph} aria-hidden="true">{glyph}</span>
            {eyebrow}
          </span>
          {children}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer la fiche">
            ×
          </button>
        </article>
      </div>
    </Html>
  );
}

export const cardStyles = styles;
