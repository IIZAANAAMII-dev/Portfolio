import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Géométries et matériaux partagés du gameplay (créés une fois, au chargement du module) :
 * poisson low-poly à ventre crème, mouette aux ailes battues sur le GPU, bouchon rouge et
 * blanc, canne à pêche, anneaux d'écume. Tout est en couleurs de sommets : un draw call
 * par famille d'objets, teintes par instance (`instanceColor`).
 */

type Vec = [number, number, number];

interface Builder {
  positions: number[];
  colors: number[];
  extra: number[];
}

function builder(): Builder {
  return { positions: [], colors: [], extra: [] };
}

function triangle(target: Builder, a: Vec, b: Vec, c: Vec, color: Vec, extras: Vec = [0, 0, 0]) {
  target.positions.push(...a, ...b, ...c);
  target.colors.push(...color, ...color, ...color);
  target.extra.push(...extras);
}

function finish(target: Builder, extraName?: string) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(target.positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(target.colors), 3));
  if (extraName) geometry.setAttribute(extraName, new BufferAttribute(new Float32Array(target.extra), 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Poisson : losange allongé, queue en V et nageoire dorsale. Avant = +X, ~1,1 m. */
function fishGeometry() {
  const fish = builder();
  const nose: Vec = [0.52, 0.0, 0];
  const tail: Vec = [-0.36, 0.01, 0];
  const top: Vec = [0.04, 0.18, 0];
  const bottom: Vec = [0.06, -0.16, 0];
  const left: Vec = [0.06, 0.0, 0.11];
  const right: Vec = [0.06, 0.0, -0.11];
  const body: Vec = [1, 1, 1];
  const fin: Vec = [0.78, 0.78, 0.8];
  // aBelly : 1 sur le sommet du ventre (dégradé crème sur les faces basses).
  for (const end of [nose, tail]) {
    triangle(fish, end, top, left, body);
    triangle(fish, end, right, top, body);
    triangle(fish, end, left, bottom, body, [0, 0, 1]);
    triangle(fish, end, bottom, right, body, [0, 1, 0]);
  }
  // Queue en V et nageoire dorsale (faces simples, matériau double face).
  triangle(fish, [-0.3, 0.01, 0], [-0.64, 0.21, 0], [-0.52, 0.01, 0], fin);
  triangle(fish, [-0.3, 0.01, 0], [-0.52, 0.01, 0], [-0.64, -0.19, 0], fin);
  triangle(fish, [0.14, 0.16, 0], [-0.16, 0.14, 0], [-0.05, 0.31, 0], fin);
  // Œil : deux petits triangles sombres de chaque côté.
  for (const side of [1, -1]) {
    const z = 0.075 * side;
    triangle(fish, [0.36, 0.05, z], [0.3, 0.09, z * 0.9], [0.3, 0.01, z * 0.9], [0.08, 0.09, 0.12]);
  }
  return finish(fish, 'aBelly');
}

/** Mouette : corps en losange, bec, queue, deux ailes coudées. Avant = +X. */
function gullGeometry() {
  const gull = builder();
  const white: Vec = [0.97, 0.97, 0.95];
  const grey: Vec = [0.72, 0.76, 0.82];
  const tip: Vec = [0.15, 0.16, 0.19];
  const beak: Vec = [0.98, 0.74, 0.28];
  const nose: Vec = [0.52, 0.03, 0];
  const tail: Vec = [-0.44, 0.05, 0];
  const top: Vec = [0.02, 0.13, 0];
  const bottom: Vec = [0.02, -0.08, 0];
  const left: Vec = [0.02, 0.02, 0.1];
  const right: Vec = [0.02, 0.02, -0.1];
  for (const end of [nose, tail]) {
    triangle(gull, end, top, left, white);
    triangle(gull, end, right, top, white);
    triangle(gull, end, left, bottom, white);
    triangle(gull, end, bottom, right, white);
  }
  triangle(gull, [0.66, 0.02, 0], [0.5, 0.05, 0.03], [0.5, 0.05, -0.03], beak);
  triangle(gull, [-0.38, 0.05, 0], [-0.68, 0.06, 0.14], [-0.68, 0.06, -0.14], white);
  for (const side of [1, -1]) {
    const rootFront: Vec = [0.14, 0.05, 0.07 * side];
    const rootBack: Vec = [-0.16, 0.05, 0.07 * side];
    const elbowFront: Vec = [0.06, 0.05, 0.5 * side];
    const elbowBack: Vec = [-0.2, 0.05, 0.48 * side];
    const wingTip: Vec = [-0.36, 0.05, 0.96 * side];
    triangle(gull, rootFront, elbowFront, rootBack, grey);
    triangle(gull, rootBack, elbowFront, elbowBack, grey);
    triangle(gull, elbowFront, wingTip, elbowBack, tip);
  }
  return finish(gull);
}

function paint(geometry: BufferGeometry, pick: (x: number, y: number, z: number) => Vec) {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    const color = pick(position.getX(index), position.getY(index), position.getZ(index));
    colors.set(color, index * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/** Bouchon : demi-sphère rouge sur demi-sphère blanche, antenne jaune. Origine = ligne d'eau. */
function floatGeometry() {
  const ball = new SphereGeometry(0.3, 10, 8);
  paint(ball, (_x, y) => (y > 0.03 ? [0.86, 0.17, 0.13] : [0.97, 0.95, 0.9]));
  const stick = new CylinderGeometry(0.03, 0.035, 0.42, 5, 1);
  stick.translate(0, 0.46, 0);
  paint(stick, (_x, y) => (y > 0.58 ? [1, 0.82, 0.18] : [0.86, 0.17, 0.13]));
  const merged = mergeGeometries([ball.toNonIndexed(), stick.toNonIndexed()]);
  ball.dispose();
  stick.dispose();
  return merged ?? new SphereGeometry(0.3, 8, 6);
}

export const ROD_LENGTH = 3.3;

/** Canne : manche de liège, moulinet, scion effilé. Couchée le long de +X, talon à l'origine. */
function rodGeometry() {
  const blank = new CylinderGeometry(0.022, 0.06, ROD_LENGTH, 6, 1);
  blank.rotateZ(-Math.PI / 2);
  blank.translate(ROD_LENGTH / 2, 0, 0);
  paint(blank, (x) => (x > ROD_LENGTH - 0.25 ? [0.95, 0.85, 0.25] : [0.33, 0.2, 0.13]));
  const grip = new CylinderGeometry(0.078, 0.07, 0.62, 6, 1);
  grip.rotateZ(-Math.PI / 2);
  grip.translate(0.3, 0, 0);
  paint(grip, () => [0.78, 0.6, 0.4]);
  const reel = new CylinderGeometry(0.1, 0.1, 0.09, 8, 1);
  reel.translate(0.66, -0.12, 0);
  paint(reel, () => [0.62, 0.66, 0.72]);
  const parts = [blank, grip, reel].map((part) => part.toNonIndexed());
  const merged = mergeGeometries(parts);
  blank.dispose();
  grip.dispose();
  reel.dispose();
  return merged ?? blank;
}

/** Marque de régate : cylindre orange gonflé, bande blanche, chapeau, mât et fanion jaune. */
function markGeometry() {
  const orange: Vec = [1, 0.45, 0.13];
  const body = new CylinderGeometry(0.46, 0.55, 1.6, 10, 1);
  body.translate(0, 0.5, 0);
  paint(body, () => orange);
  const band = new CylinderGeometry(0.5, 0.52, 0.26, 10, 1, true);
  band.translate(0, 0.86, 0);
  paint(band, () => [0.98, 0.96, 0.9]);
  const cap = new ConeGeometry(0.46, 0.4, 10, 1);
  cap.translate(0, 1.5, 0);
  paint(cap, () => orange);
  const pole = new CylinderGeometry(0.035, 0.035, 1.3, 5, 1);
  pole.translate(0, 2.2, 0);
  paint(pole, () => [0.22, 0.2, 0.24]);
  const flag = builder();
  triangle(flag, [0.03, 2.82, 0], [0.03, 2.38, 0], [0.7, 2.6, 0], [1, 0.84, 0.2]);
  const pennant = finish(flag);
  // Mêmes attributs partout pour la fusion (le fanion, fait main, n'a pas d'UV).
  const parts = [body, band, cap, pole].map((part) => {
    const flat = part.toNonIndexed();
    flat.deleteAttribute('uv');
    return flat;
  });
  const merged = mergeGeometries([...parts, pennant]);
  for (const part of [body, band, cap, pole, ...parts, pennant]) part.dispose();
  return merged ?? new CylinderGeometry(0.5, 0.5, 1.6, 8);
}

/** Disque d'eau claire : centre blanc, bord noir (en addition, le noir est transparent). */
function glowGeometry() {
  const disc = new CircleGeometry(1, 28);
  disc.rotateX(-Math.PI / 2);
  paint(disc, (x, _y, z) => {
    const r = Math.min(1, Math.hypot(x, z));
    const v = (1 - r) * (1 - r);
    return [v, v, v];
  });
  return disc;
}

function ringGeometry() {
  const ring = new RingGeometry(0.84, 1, 40, 1);
  ring.rotateX(-Math.PI / 2);
  return ring;
}

/** Ventre crème mêlé après la teinte d'instance (sinon le ventre prendrait la couleur). */
function createFishMaterial() {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0,
    flatShading: true,
    side: DoubleSide,
  });
  material.name = 'gameplay-fish';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBelly;')
      .replace(
        '#include <color_vertex>',
        '#include <color_vertex>\nvColor.xyz = mix(vColor.xyz, vec3(0.97, 0.94, 0.86), aBelly);',
      );
  };
  material.customProgramCacheKey = () => 'gameplay-fish-v1';
  return material;
}

/**
 * Battement d'ailes sur le GPU : `aWing.x` = angle de l'aile, `aWing.y` = ailes repliées
 * (piqué). Une valeur par instance, réécrite par la scène (six mouettes, rien de plus).
 */
function createGullMaterial() {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
    side: DoubleSide,
  });
  material.name = 'gameplay-gull';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWing;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
float gullSpan = abs(transformed.z);
if (gullSpan > 0.075) {
  float reach = gullSpan - 0.07;
  float fold = aWing.y;
  float span = reach * (1.0 - fold * 0.72);
  transformed.y += sin(aWing.x) * span * (1.0 + max(gullSpan - 0.5, 0.0) * 0.9);
  transformed.z = sign(transformed.z) * (0.07 + span * cos(aWing.x));
  transformed.x -= fold * reach * 0.55;
}`,
      );
  };
  material.customProgramCacheKey = () => 'gameplay-gull-v1';
  return material;
}

export const FISH_GEOMETRY = fishGeometry();
export const GULL_GEOMETRY = gullGeometry();
export const FLOAT_GEOMETRY = floatGeometry();
export const ROD_GEOMETRY = rodGeometry();
export const MARK_GEOMETRY = markGeometry();
export const GLOW_GEOMETRY = glowGeometry();
export const RING_GEOMETRY = ringGeometry();
export const DROP_GEOMETRY = new IcosahedronGeometry(1, 0);
export const BUBBLE_GEOMETRY = new IcosahedronGeometry(1, 1);

export const FISH_MATERIAL = createFishMaterial();
export const GULL_MATERIAL = createGullMaterial();
export const GEAR_MATERIAL = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, flatShading: true });
export const GLOW_MATERIAL = new MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.5,
  blending: AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
export const RING_MATERIAL = new MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.85,
  blending: AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
export const BUBBLE_MATERIAL = new MeshStandardMaterial({ color: '#f4fffd', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 });
export const DROP_MATERIAL = new MeshBasicMaterial({ color: '#f2fffb', transparent: true, opacity: 0.9, depthWrite: false });
