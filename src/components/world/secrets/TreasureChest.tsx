'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  RepeatWrapping,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  SpriteMaterial,
  SRGBColorSpace,
  type Points,
  type Sprite,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Hotspot } from '@/components/islands/kit';
import { experiments } from '@/data/projects';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { damp, hash } from '@/lib/utils/math';
import { CHEST_SPOT } from './layout';
import {
  at,
  cardStyles,
  createFoamMaterial,
  FoamCollar,
  foamRingGeometry,
  inSight,
  merge,
  paintMaterial,
  piece,
  sandbankGeometry,
  SecretCard,
  shoreNoise,
  type SandbankShape,
} from './shared';

/**
 * Le coffre au trésor : à moitié enfoui sur un minuscule banc de sable au large, à l'est.
 * Un éclat doré clignote de loin, le couvercle se soulève parfois tout seul (une lueur
 * s'échappe). Au clic : le couvercle s'ouvre en rebondissant, une colonne de lumière dorée
 * et des paillettes jaillissent, des pièces tintent, et une fiche en papier présente
 * l'expérience cachée dans le coffre (données : `experiments`).
 */

const SHAPE: SandbankShape = { rx: 5.4, rz: 4.1, top: 0.46, depth: 1.15, seed: 3, shelf: -0.5, shelfReach: 1.55 };
const W = 1.5;
const H = 0.78;
const D = 0.95;
/** Position du coffre sur le banc (repère du banc) et son assise. */
const CHEST_LOCAL: [number, number, number] = [0.35, 0, -0.35];
const CHEST_ROTATION: [number, number, number] = [-0.06, 0.55, 0.09];
const LID_OPEN = -1.95;

/** Hauteur du sable du banc en (x, z) local. */
function surface(x: number, z: number) {
  const angle = Math.atan2(z / SHAPE.rz, x / SHAPE.rx);
  const t = Math.hypot(x / SHAPE.rx, z / SHAPE.rz) / shoreNoise(angle, SHAPE.seed);
  return SHAPE.top - (SHAPE.top + SHAPE.depth) * Math.pow(Math.min(t, 1.2), 2.4);
}

/* ---------------------------------------------------------------- textures */

let woodSide: CanvasTexture | null = null;
let woodLid: CanvasTexture | null = null;

function drawWood() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const planks = 4;
  const plank = 256 / planks;
  for (let index = 0; index < planks; index++) {
    const tint = 0.9 + hash(index * 3.7) * 0.2;
    ctx.fillStyle = `rgb(${Math.round(150 * tint)}, ${Math.round(94 * tint)}, ${Math.round(52 * tint)})`;
    ctx.fillRect(0, index * plank, 256, plank);
    // Veinage ondulé.
    for (let line = 0; line < 7; line++) {
      ctx.strokeStyle = `rgba(70, 38, 18, ${0.12 + hash(index * 9.1 + line) * 0.12})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const y = index * plank + 6 + hash(index * 5.3 + line * 1.9) * (plank - 12);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 4 - hash(line) * 8, 170, y - 5 + hash(line + 2) * 9, 256, y + 2);
      ctx.stroke();
    }
    // Nœud du bois.
    ctx.fillStyle = 'rgba(70, 38, 18, 0.35)';
    ctx.beginPath();
    ctx.ellipse(40 + hash(index * 2.2) * 170, index * plank + plank / 2, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Joint sombre entre deux planches, et clous.
    ctx.fillStyle = '#3d2412';
    ctx.fillRect(0, index * plank, 256, 3);
    ctx.fillStyle = '#2a1a0e';
    for (const x of [14, 242]) {
      ctx.beginPath();
      ctx.arc(x, index * plank + plank / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function woodTextures() {
  if (!woodSide || !woodLid) {
    woodSide = drawWood();
    woodLid = woodSide.clone();
    woodLid.wrapS = RepeatWrapping;
    woodLid.wrapT = RepeatWrapping;
    woodLid.center.set(0.5, 0.5);
    woodLid.rotation = Math.PI / 2;
    woodLid.needsUpdate = true;
  }
  return { side: woodSide, lid: woodLid };
}

let glintTexture: CanvasTexture | null = null;

/** Éclat en étoile à quatre branches (reflet d'or vu de loin). */
function glint() {
  if (glintTexture) return glintTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 40);
  glow.addColorStop(0, 'rgba(255, 250, 225, 1)');
  glow.addColorStop(0.25, 'rgba(255, 214, 120, 0.7)');
  glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255, 246, 214, 0.95)';
  for (const [w, h] of [[5, 62], [62, 5]]) {
    ctx.beginPath();
    ctx.moveTo(64, 64 - h);
    ctx.lineTo(64 + w, 64);
    ctx.lineTo(64, 64 + h);
    ctx.lineTo(64 - w, 64);
    ctx.closePath();
    ctx.fill();
  }
  glintTexture = new CanvasTexture(canvas);
  glintTexture.colorSpace = SRGBColorSpace;
  return glintTexture;
}

/* --------------------------------------------------------------- géométries */

/** Caisse ouverte (fond + quatre parois) : on voit l'intérieur quand le couvercle bascule. */
function chestBody() {
  const t = 0.07;
  const walls = [
    new BoxGeometry(W, t, D).translate(0, t / 2, 0),
    new BoxGeometry(W, H, t).translate(0, H / 2, D / 2 - t / 2),
    new BoxGeometry(W, H, t).translate(0, H / 2, -D / 2 + t / 2),
    new BoxGeometry(t, H, D - 2 * t).translate(W / 2 - t / 2, H / 2, 0),
    new BoxGeometry(t, H, D - 2 * t).translate(-W / 2 + t / 2, H / 2, 0),
  ];
  const merged = mergeGeometries(walls, false)!;
  walls.forEach((wall) => wall.dispose());
  return merged;
}

/** Couvercle bombé (demi-cylindre) articulé sur l'arête arrière : pivot à l'origine. */
function chestLid() {
  const shell = new CylinderGeometry(D / 2, D / 2, W, 16, 1, false, 0, Math.PI);
  shell.rotateZ(Math.PI / 2);
  shell.translate(0, 0, D / 2);
  const under = new BoxGeometry(W, 0.04, D).translate(0, 0.02, D / 2);
  const merged = mergeGeometries([shell.toNonIndexed(), under.toNonIndexed()], false)!;
  shell.dispose();
  under.dispose();
  return merged;
}

/** Ferrures en laiton de la caisse : deux cerclages, cornières, serrure. */
function bodyBrass() {
  const parts: BufferGeometry[] = [];
  const brass = '#e0aa3e';
  for (const x of [-0.46, 0.46]) {
    parts.push(piece(new BoxGeometry(0.11, H + 0.02, 0.03), brass, at([x, H / 2, D / 2 + 0.012])));
    parts.push(piece(new BoxGeometry(0.11, H + 0.02, 0.03), brass, at([x, H / 2, -D / 2 - 0.012])));
    parts.push(piece(new BoxGeometry(0.11, 0.03, D + 0.05), brass, at([x, 0.012, 0])));
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      parts.push(piece(new BoxGeometry(0.07, H + 0.02, 0.07), '#c48f2e', at([x * (W / 2 - 0.02), H / 2, z * (D / 2 - 0.02)])));
    }
  }
  parts.push(piece(new BoxGeometry(W + 0.04, 0.05, 0.035), brass, at([0, H - 0.02, D / 2 + 0.012])));
  parts.push(piece(new BoxGeometry(0.26, 0.28, 0.05), '#f0bd4c', at([0, H - 0.17, D / 2 + 0.03])));
  parts.push(piece(new BoxGeometry(0.05, 0.1, 0.02), '#2a1d12', at([0, H - 0.19, D / 2 + 0.06])));
  return merge(parts);
}

/** Cerclages du couvercle et moraillon (repère du pivot). */
function lidBrass() {
  const parts: BufferGeometry[] = [];
  for (const x of [-0.46, 0.46]) {
    const band = new CylinderGeometry(D / 2 + 0.018, D / 2 + 0.018, 0.11, 16, 1, true, 0, Math.PI);
    band.rotateZ(Math.PI / 2);
    band.translate(x, 0, D / 2);
    parts.push(piece(band, '#e0aa3e'));
  }
  parts.push(piece(new BoxGeometry(W + 0.04, 0.05, 0.035), '#e0aa3e', at([0, 0.02, D + 0.012])));
  parts.push(piece(new BoxGeometry(0.15, 0.2, 0.035), '#f0bd4c', at([0, -0.05, D + 0.03])));
  return merge(parts);
}

/** Étoile de mer : étoile à cinq branches extrudée, bombée. */
function starfish() {
  const shape = new Shape();
  for (let index = 0; index <= 10; index++) {
    const angle = (index / 10) * Math.PI * 2;
    const radius = index % 2 === 0 ? 1 : 0.42;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Tout le petit décor du banc, fusionné : coquillages, galets, oyats, bois flotté, pelle, X, traces de pas. */
function sandDecor() {
  const parts: BufferGeometry[] = [];
  const on = (x: number, z: number, lift = 0) => surface(x, z) + lift;
  // Coquilles Saint-Jacques (cônes aplatis côtelés) et bulots.
  const shells: [number, number, number, string][] = [
    [-1.6, 0.9, 0.4, '#f3c6b8'], [2.2, 1.4, 1.9, '#fbe9d6'], [-0.6, 1.9, 2.6, '#f0b49e'],
    [1.5, -1.9, 0.8, '#fde3c8'], [-2.6, -0.8, 1.2, '#f6cdb6'], [3.1, -0.4, 2.2, '#f3c6b8'],
  ];
  shells.forEach(([x, z, turn, color], index) => {
    parts.push(piece(new ConeGeometry(0.17, 0.08, 9), color, at([x, on(x, z, 0.03), z], [0.15, turn, 0.1], [1, 1, 0.82]), 0.08, index));
  });
  for (const [x, z, turn] of [[0.9, 1.5, 0.6], [-2.1, 0.2, 2.4]] as const) {
    parts.push(piece(new ConeGeometry(0.08, 0.26, 6), '#f2d3a8', at([x, on(x, z, 0.06), z], [Math.PI / 2, turn, 0]), 0.1, x));
  }
  // Étoiles de mer.
  parts.push(piece(starfish(), '#f0784a', at([-1.25, on(-1.25, -1.35, 0.02), -1.35], [0, 0.7, 0], [0.24, 0.24, 0.24]), 0.06, 4));
  parts.push(piece(starfish(), '#f5a142', at([2.7, on(2.7, 0.9, 0.02), 0.9], [0, 2.1, 0], [0.18, 0.18, 0.18]), 0.06, 5));
  // Galets.
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.39 + 0.4;
    const radius = 1.4 + hash(index * 4.1) * 2.2;
    const x = Math.cos(angle) * radius * 1.1;
    const z = Math.sin(angle) * radius * 0.8;
    const size = 0.08 + hash(index * 2.7) * 0.1;
    parts.push(piece(new IcosahedronGeometry(1, 0), index % 3 === 0 ? '#9d93a8' : '#b9aea2', at([x, on(x, z, size * 0.3), z], [index, index * 2, 0], [size * 1.3, size * 0.7, size]), 0.1, index));
  }
  // Touffes d'oyats (herbe des dunes), sans palmier.
  for (const [cx, cz, seed] of [[-2.3, 0.95, 1], [-1.8, 1.5, 2], [2.6, -1.3, 3]] as const) {
    for (let blade = 0; blade < 9; blade++) {
      const angle = blade * 2.4 + seed;
      const lean = 0.25 + hash(blade * 3.3 + seed) * 0.35;
      const height = 0.45 + hash(blade * 1.7 + seed * 5) * 0.45;
      const x = cx + Math.cos(angle) * 0.12;
      const z = cz + Math.sin(angle) * 0.12;
      const color = ['#a9b25a', '#c4c06a', '#8ca04e', '#d6c27c'][blade % 4];
      const cone = new ConeGeometry(0.035, height, 4).translate(0, height / 2, 0);
      parts.push(piece(cone, color, at([x, on(x, z, -0.04), z], [Math.sin(angle) * lean, 0, -Math.cos(angle) * lean]), 0.08, blade + seed));
    }
  }
  // Bois flotté.
  parts.push(piece(new CylinderGeometry(0.07, 0.1, 1.7, 6), '#9b8f82', at([1.9, on(1.9, 0.5, 0.05), 0.5], [0.05, 0.3, Math.PI / 2 + 0.08]), 0.12, 7));
  parts.push(piece(new CylinderGeometry(0.04, 0.05, 0.6, 5), '#8d8276', at([2.2, on(2.2, 0.75, 0.08), 0.75], [0.6, 0.9, Math.PI / 2]), 0.12, 8));
  // Pelle plantée dans le sable (manche, poignée, lame).
  const shovel = new Group();
  shovel.position.set(-1.05, on(-1.05, 0.55), 0.55);
  shovel.rotation.set(0.25, 0.4, -0.32);
  shovel.updateMatrixWorld();
  const shovelMatrix = (local: Matrix4) => shovel.matrixWorld.clone().multiply(local);
  parts.push(piece(new CylinderGeometry(0.028, 0.03, 1.15, 6), '#a0703f', shovelMatrix(at([0, 0.55, 0])), 0.05, 9));
  parts.push(piece(new BoxGeometry(0.24, 0.05, 0.05), '#a0703f', shovelMatrix(at([0, 1.13, 0]))));
  parts.push(piece(new BoxGeometry(0.26, 0.3, 0.025), '#8a96a0', shovelMatrix(at([0, -0.05, 0]))));
  // Le X qui marque l'emplacement, creusé dans le sable devant le coffre.
  const xMark = (angle: number) => piece(new BoxGeometry(1.25, 0.03, 0.11), '#b5703f', at([0.55, on(0.55, 0.85, 0.01), 0.85], [0, angle, 0]), 0.05, angle);
  parts.push(xMark(0.78), xMark(-0.78));
  // Traces de pas qui viennent du rivage.
  for (let step = 0; step < 9; step++) {
    const k = step / 8;
    const side = step % 2 === 0 ? 1 : -1;
    const x = -3.9 + k * 3.3 + side * 0.12;
    const z = 2.6 - k * 2.1 + side * 0.1;
    parts.push(piece(new CylinderGeometry(0.075, 0.075, 0.02, 8), '#c99d63', at([x, on(x, z, 0.005), z], [0, -0.6, 0], [1, 1, 1.7])));
  }
  return merge(parts);
}

/* ---------------------------------------------------------------- shaders */

const shaftVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const shaftFragment = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  // Colonne dorée : s'efface vers le ciel, rayons qui tournent lentement.
  float fade = pow(1.0 - vUv.y, 1.5) * smoothstep(0.0, 0.06, vUv.y);
  float rays = 0.55 + 0.45 * sin(vUv.x * 43.98 + uTime * 1.3) * sin(vUv.x * 18.85 - uTime * 0.7);
  float alpha = fade * (0.45 + rays * 0.55) * uIntensity * 0.75;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.42) * alpha, alpha);
}
`;

const sparkleVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uIntensity;
uniform float uBurst;
uniform float uScale;
varying float vAlpha;
void main() {
  vec3 p;
  float alpha;
  float size;
  if (aSeed.w < 0.5) {
    // Fontaine continue : les paillettes montent en spirale au-dessus du trésor.
    float t = fract(uTime * 0.38 + aSeed.z);
    float angle = aSeed.x + t * 2.4;
    float radius = aSeed.y * (0.2 + t * 0.85);
    p = vec3(cos(angle) * radius, 0.1 + t * 2.9, sin(angle) * radius);
    alpha = sin(t * 3.14159) * uIntensity;
    size = 0.15 + aSeed.z * 0.08;
  } else {
    // Gerbe de l'ouverture : éclat radial qui retombe.
    float t = uBurst;
    vec3 velocity = vec3(cos(aSeed.x) * aSeed.y * 1.6, 2.6 + aSeed.z * 2.2, sin(aSeed.x) * aSeed.y * 1.6);
    p = velocity * t + vec3(0.0, -3.6 * t * t, 0.0);
    alpha = step(0.0, t) * (1.0 - smoothstep(0.7, 1.7, t));
    size = 0.2 + aSeed.z * 0.1;
  }
  float twinkle = 0.5 + 0.5 * sin(uTime * 14.0 + aSeed.z * 40.0);
  vAlpha = alpha * (0.45 + twinkle * 0.55);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = size * uScale / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}
`;

const sparkleFragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float cross = max(0.0, 1.0 - abs(c.x) * 10.0) * max(0.0, 1.0 - abs(c.y) * 2.1)
              + max(0.0, 1.0 - abs(c.y) * 10.0) * max(0.0, 1.0 - abs(c.x) * 2.1);
  float core = smoothstep(0.24, 0.0, d);
  float alpha = clamp(cross + core, 0.0, 1.0) * vAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.5) * (0.75 + core * 0.5) * alpha, alpha);
}
`;

const SPARKLES = 72;

function sparkleGeometry() {
  const seeds = new Float32Array(SPARKLES * 4);
  for (let index = 0; index < SPARKLES; index++) {
    seeds.set([
      hash(index * 1.91) * Math.PI * 2,
      0.25 + hash(index * 3.17) * 0.55,
      hash(index * 5.03),
      index < SPARKLES * 0.55 ? 0 : 1,
    ], index * 4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(SPARKLES * 3), 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  return geometry;
}

/* ---------------------------------------------------------------- matériaux */

const brassMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.42,
  metalness: 0.2,
  emissive: '#6b4310',
  emissiveIntensity: 0.35,
  flatShading: true,
});
const goldMaterial = new MeshStandardMaterial({
  color: '#ffcc4d',
  roughness: 0.35,
  metalness: 0.2,
  emissive: '#ff9d1f',
  emissiveIntensity: 0.25,
  flatShading: true,
});
const coinMaterial = new MeshStandardMaterial({
  color: '#ffd35a',
  roughness: 0.3,
  metalness: 0.25,
  emissive: '#b8740f',
  emissiveIntensity: 0.4,
});
const gemMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.1, flatShading: true, emissive: '#331a33', emissiveIntensity: 0.4 });

const _dummy = new Object3D();
const _chestMatrix = new Matrix4();
const COIN_HEAP = 16;
const COIN_SPILL = 7;
const GEM_COLORS = ['#e8364f', '#2f8fe8', '#3fcf7a', '#b05ce8'];

/* ---------------------------------------------------------------- composant */

export function TreasureChest() {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const shaft = useRef<ShaderMaterial>(null);
  const sparkles = useRef<Points>(null);
  const glintSprite = useRef<Sprite>(null);
  const coins = useRef<InstancedMesh>(null);
  const gems = useRef<InstancedMesh>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const anim = useRef({ angle: 0, velocity: 0, glow: 0, burstAt: -100, pendingBurst: false });

  const body = useMemo(() => chestBody(), []);
  const lidShell = useMemo(() => chestLid(), []);
  const bodyBands = useMemo(() => bodyBrass(), []);
  const lidBands = useMemo(() => lidBrass(), []);
  const bank = useMemo(() => sandbankGeometry(SHAPE), []);
  const decor = useMemo(() => sandDecor(), []);
  const foam = useMemo(() => foamRingGeometry(SHAPE.rx, SHAPE.rz, SHAPE.seed, 1.2), []);
  const foamMaterial = useMemo(() => createFoamMaterial(), []);
  const heap = useMemo(() => new SphereGeometry(0.5, 14, 8).scale(1.32, 0.42, 0.82), []);
  const coin = useMemo(() => new CylinderGeometry(0.075, 0.075, 0.02, 10), []);
  const gem = useMemo(() => new OctahedronGeometry(0.085, 0), []);
  const shaftGeometry = useMemo(() => new CylinderGeometry(0.78, 0.42, 3.4, 18, 1, true).translate(0, 1.7, 0), []);
  const sparkleGeo = useMemo(() => sparkleGeometry(), []);
  const wood = useMemo(() => woodTextures(), []);
  const glintMaterial = useMemo(
    () => new SpriteMaterial({ map: glint(), transparent: true, depthWrite: false, blending: AdditiveBlending, color: '#ffe3a0' }),
    [],
  );

  const chestY = surface(CHEST_LOCAL[0], CHEST_LOCAL[2]) - 0.3;

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Pièces sur le trésor (repère du coffre) et pièces renversées dans le sable ; gemmes.
  useEffect(() => {
    const coinMesh = coins.current;
    const gemMesh = gems.current;
    if (!coinMesh || !gemMesh) return;
    _dummy.position.set(CHEST_LOCAL[0], chestY, CHEST_LOCAL[2]);
    _dummy.rotation.set(CHEST_ROTATION[0], CHEST_ROTATION[1], CHEST_ROTATION[2]);
    _dummy.scale.setScalar(1);
    _dummy.updateMatrix();
    _chestMatrix.copy(_dummy.matrix);
    for (let index = 0; index < COIN_HEAP; index++) {
      const angle = index * 2.4;
      const radius = Math.sqrt(hash(index * 3.3)) * 0.55;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.6;
      _dummy.position.set(x, H - 0.2 + (1 - radius / 0.6) * 0.16, z);
      _dummy.rotation.set((hash(index) - 0.5) * 0.9, angle, (hash(index * 1.7) - 0.5) * 0.9);
      _dummy.updateMatrix();
      _dummy.matrix.premultiply(_chestMatrix);
      coinMesh.setMatrixAt(index, _dummy.matrix);
    }
    for (let index = 0; index < COIN_SPILL; index++) {
      const x = CHEST_LOCAL[0] + 0.2 + index * 0.21 + hash(index * 4.4) * 0.15;
      const z = CHEST_LOCAL[2] + 0.75 + hash(index * 6.1) * 0.55;
      _dummy.position.set(x, surface(x, z) + 0.015, z);
      _dummy.rotation.set((hash(index * 2.9) - 0.5) * 0.4, index, (hash(index * 7.7) - 0.5) * 0.4);
      _dummy.updateMatrix();
      coinMesh.setMatrixAt(COIN_HEAP + index, _dummy.matrix);
    }
    coinMesh.instanceMatrix.needsUpdate = true;
    const color = new Color();
    GEM_COLORS.forEach((hex, index) => {
      _dummy.position.set(-0.45 + index * 0.3, H - 0.1 + hash(index * 2.1) * 0.04, (hash(index * 5.5) - 0.5) * 0.3);
      _dummy.rotation.set(hash(index) * 2, index, hash(index * 3.1));
      _dummy.updateMatrix();
      _dummy.matrix.premultiply(_chestMatrix);
      gemMesh.setMatrixAt(index, _dummy.matrix);
      gemMesh.setColorAt(index, color.set(hex));
    });
    gemMesh.instanceMatrix.needsUpdate = true;
    if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
  }, [chestY]);

  useEffect(
    () => () => {
      foamMaterial.dispose();
      glintMaterial.dispose();
    },
    [foamMaterial, glintMaterial],
  );

  const toggle = () => {
    // Groupe masqué (hors de vue) : les maillages restent touchables par le rayon, on ignore.
    if (!root.current?.visible) return;
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    if (next) {
      anim.current.pendingBurst = true;
      ambience.bump('wood', 0.7);
      ambience.chime([1319, 1760, 2093, 2637, 2093, 3136], 0.055);
      logbook.stamp('chest');
    } else {
      ambience.bump('wood', 0.45);
    }
  };

  const close = () => {
    openRef.current = false;
    setOpen(false);
  };

  useFrame((state, delta) => {
    const group = root.current;
    if (!group) return;
    const visible = inSight(state.camera, CHEST_SPOT.x, CHEST_SPOT.z);
    group.visible = visible;
    if (!visible) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const a = anim.current;
    const isOpen = openRef.current;
    const reduced = useWorld.getState().reducedMotion;
    if (a.pendingBurst) {
      a.pendingBurst = false;
      a.burstAt = time;
    }

    // Couvercle : ressort amorti (petit rebond à l'ouverture). Fermé, il se soulève parfois
    // tout seul, et une lueur s'échappe : le trésor appelle.
    const cycle = (time % 7.5) / 7.5;
    const peek = !isOpen && !reduced ? Math.pow(Math.max(0, Math.sin(cycle * Math.PI * 2 - 0.4)), 14) : 0;
    const target = isOpen ? LID_OPEN : -0.16 * peek;
    if (reduced) {
      a.angle = damp(a.angle, target, 8, dt);
      a.velocity = 0;
    } else {
      a.velocity += (target - a.angle) * 70 * dt;
      a.velocity *= Math.exp(-7.5 * dt);
      a.angle += a.velocity * dt;
    }
    if (lid.current) lid.current.rotation.x = a.angle;

    a.glow = damp(a.glow, isOpen ? 1 : peek * 0.5, isOpen ? 3 : 6, dt);
    goldMaterial.emissiveIntensity = 0.25 + a.glow * 1.5;
    coinMaterial.emissiveIntensity = 0.4 + a.glow * 0.5;
    const burst = time - a.burstAt;
    if (shaft.current) {
      shaft.current.uniforms.uTime.value = time;
      shaft.current.uniforms.uIntensity.value = a.glow * (1 + Math.max(0, 1 - burst / 1.2) * 0.8);
    }
    const sparkleMesh = sparkles.current;
    if (sparkleMesh) {
      const uniforms = (sparkleMesh.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = time;
      uniforms.uIntensity.value = a.glow;
      uniforms.uBurst.value = burst;
      uniforms.uScale.value = state.size.height * state.viewport.dpr * state.camera.projectionMatrix.elements[5] * 0.5;
      sparkleMesh.visible = a.glow > 0.01 || burst < 2;
    }

    // Éclat doré visible de loin, tant que le coffre est fermé.
    const sprite = glintSprite.current;
    if (sprite) {
      const flash = isOpen ? 0 : Math.pow(Math.max(0, Math.sin(time * 1.9)), 24) + peek * 0.6;
      sprite.scale.setScalar(0.25 + flash * 1.5);
      sprite.material.rotation = time * 0.6;
      sprite.material.opacity = Math.min(1, flash * 1.4);
      sprite.visible = flash > 0.02;
    }

    // Le bateau s'éloigne : on referme la fiche (une seule fois).
    if (isOpen && Math.hypot(boatState.position.x - CHEST_SPOT.x, boatState.position.z - CHEST_SPOT.z) > 75) close();
  });

  return (
    <group ref={root} position={[CHEST_SPOT.x, 0, CHEST_SPOT.z]} visible={false}>
      <mesh geometry={bank} material={paintMaterial()} receiveShadow raycast={() => null} />
      <mesh geometry={decor} material={paintMaterial()} castShadow={false} raycast={() => null} />
      <FoamCollar shape={SHAPE} world={[CHEST_SPOT.x, CHEST_SPOT.z]} geometry={foam} material={foamMaterial} />
      <instancedMesh ref={coins} args={[coin, coinMaterial, COIN_HEAP + COIN_SPILL]} raycast={() => null} />
      <instancedMesh ref={gems} args={[gem, gemMaterial, GEM_COLORS.length]} raycast={() => null} />

      <Hotspot onActivate={toggle} hoverScale={1.05} position={[CHEST_LOCAL[0], chestY, CHEST_LOCAL[2]]} rotation={CHEST_ROTATION}>
        <mesh geometry={body} castShadow>
          <meshStandardMaterial map={wood.side} roughness={0.9} color="#ffffff" />
        </mesh>
        <mesh geometry={bodyBands} material={brassMaterial} castShadow={false} />
        <mesh geometry={heap} material={goldMaterial} position={[0, H - 0.22, 0]} />
        <group ref={lid} position={[0, H, -D / 2]}>
          <mesh geometry={lidShell} castShadow>
            <meshStandardMaterial map={wood.lid} roughness={0.9} side={DoubleSide} />
          </mesh>
          <mesh geometry={lidBands} material={brassMaterial} />
        </group>
        {/* Zone de clic généreuse : le coffre est petit vu de la caméra de jeu. */}
        <mesh visible={false} position={[0, 0.7, 0.1]}>
          <boxGeometry args={[2.6, 2, 2.2]} />
        </mesh>
        <mesh geometry={shaftGeometry} position={[0, H - 0.1, 0]} renderOrder={6} raycast={() => null}>
          <shaderMaterial
            ref={shaft}
            uniforms={{ uTime: { value: 0 }, uIntensity: { value: 0 } }}
            vertexShader={shaftVertex}
            fragmentShader={shaftFragment}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
        <points ref={sparkles} geometry={sparkleGeo} position={[0, H - 0.05, 0]} frustumCulled={false} renderOrder={7} raycast={() => null}>
          <shaderMaterial
            uniforms={{ uTime: { value: 0 }, uIntensity: { value: 0 }, uBurst: { value: 10 }, uScale: { value: 800 } }}
            vertexShader={sparkleVertex}
            fragmentShader={sparkleFragment}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
        <sprite ref={glintSprite} material={glintMaterial} position={[0.22, H + 0.08, D / 2 + 0.08]} renderOrder={8} raycast={() => null} />
      </Hotspot>

      {open && (
        <SecretCard
          position={[CHEST_LOCAL[0], 3.3, CHEST_LOCAL[2]]}
          eyebrow="Expérience perso · trouvée dans le coffre"
          glyph="◈"
          ink="#c9901c"
          tone="gold"
          label="Trésor du coffre"
          onClose={close}
        >
          {experiments.map((experiment) => (
            <div key={experiment.id}>
              <h3 className={cardStyles.title}>{experiment.title}</h3>
              <p className={cardStyles.kind}>{experiment.kind}</p>
              <p className={cardStyles.text}>{experiment.summary}</p>
              <ul className={cardStyles.chips} aria-label="Technologies">
                {experiment.stack.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
            </div>
          ))}
        </SecretCard>
      )}
    </group>
  );
}
