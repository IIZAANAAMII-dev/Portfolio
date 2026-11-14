'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { Hotspot } from '@/components/islands/kit';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { clothClock } from '@/lib/substance-models';
import { useWorld } from '@/lib/store';
import { clamp, hash, shortestAngle, smoothstep } from '@/lib/utils/math';
import { WRECK_SPOT } from './layout';
import { gullCries, woodCreak } from './sfx';
import {
  at,
  cardStyles,
  createFoamMaterial,
  FoamCollar,
  foamRingGeometry,
  inSight,
  merge,
  paintDoubleMaterial,
  paintMaterial,
  piece,
  rockGeometry,
  sandbankGeometry,
  SecretCard,
  shoreNoise,
  type SandbankShape,
} from './shared';

/**
 * Le vieux chalutier breton échoué : couché sur des rochers de granit rose au sud-ouest de
 * l'île Parcours, peinture écaillée, mât cassé, portique rouillé, Gwenn-ha-Du en lambeaux.
 * Deux goélands montent la garde, des crabes trottinent sur le sable. Au clic, les oiseaux
 * s'envolent en criant, font un tour et reviennent se poser ; une fiche rend hommage aux
 * pêcheurs de la famille.
 */

/** Cap de l'épave : son flanc et son pont regardent le centre de l'archipel. */
const HEADING = 2.1;
const ROLL = 0.36;
const PITCH = 0.07;
const SINK = -0.3;
const SHAPE: SandbankShape = { rx: 7.4, rz: 5.3, top: 0.32, depth: 1.25, seed: 11, shelf: -0.5, shelfReach: 1.45 };

/* ------------------------------------------------------------------- coque */

const L = 7.4;
const B = 1.32;
const DEPTH = 1.55;
const BULWARK = 0.24;
const STATIONS = 22;
const SIDE = 9;

function beamAt(t: number) {
  if (t < 0.55) return B * (0.8 + 0.2 * Math.sin((t / 0.55) * (Math.PI / 2)));
  const u = (t - 0.55) / 0.45;
  return Math.max(0.025, B * Math.pow(Math.cos(u * (Math.PI / 2)), 0.7));
}

function sheerAt(t: number) {
  return DEPTH + 0.55 * Math.pow(t, 2.2) + 0.14 * Math.pow(1 - t, 3);
}

function keelAt(t: number) {
  let y = 0;
  if (t > 0.76) y += Math.pow((t - 0.76) / 0.24, 1.7) * sheerAt(1) * 0.78;
  if (t < 0.12) y += Math.pow((0.12 - t) / 0.12, 2) * 0.32;
  return y;
}

function deckAt(t: number) {
  return sheerAt(t) - BULWARK;
}

/** Point du bordé : station t (0 arrière → 1 étrave), k de 0 (plat-bord) à SIDE (quille). */
function hullPoint(t: number, k: number, side: 1 | -1): [number, number, number] {
  const b = beamAt(t);
  const keel = keelAt(t);
  const sheer = sheerAt(t);
  const e = 0.62 + 0.32 * smoothstep(0.55, 1, t);
  const phi = (k / SIDE) * (Math.PI / 2);
  const z = b * Math.pow(Math.cos(phi), e) * side;
  const y = keel + (sheer - keel) * (1 - Math.pow(Math.sin(phi), e));
  return [-L / 2 + t * L, y, k === SIDE ? 0 : z];
}

const TEAL = new Color('#3f8696');
const RED = new Color('#a3452f');
const WHITE = new Color('#ece3cf');
const WOOD = new Color('#8b6a4a');
const ALGAE = new Color('#4f7d4c');

function hullGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new Color();
  const tri = (a: number[], b: number[], c: number[], tint: Color) => {
    positions.push(...a, ...b, ...c);
    for (let corner = 0; corner < 3; corner++) colors.push(tint.r, tint.g, tint.b);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], tint: Color) => {
    tri(a, b, c, tint);
    tri(a, c, d, tint);
  };
  const paint = (y: number, k: number, seed: number) => {
    const roll = hash(seed);
    if (k === 0) color.copy(WHITE);
    else if (y < 0.6) color.copy(roll < 0.22 ? ALGAE : RED);
    else if (y < 0.74) color.copy(WHITE);
    else color.copy(roll < 0.07 ? WOOD : TEAL);
    return color.multiplyScalar(0.88 + hash(seed * 1.31) * 0.22);
  };
  for (const side of [1, -1] as const) {
    for (let i = 0; i < STATIONS; i++) {
      const t0 = i / STATIONS;
      const t1 = (i + 1) / STATIONS;
      for (let k = 0; k < SIDE; k++) {
        const a = hullPoint(t0, k, side);
        const b = hullPoint(t0, k + 1, side);
        const c = hullPoint(t1, k + 1, side);
        const d = hullPoint(t1, k, side);
        const tint = paint((a[1] + b[1] + c[1] + d[1]) / 4, k, i * 31.7 + k * 7.3 + side * 3.1);
        if (side === 1) quad(a, b, c, d, tint);
        else quad(a, d, c, b, tint);
      }
      // Liston du plat-bord (rouge sombre) et pavois intérieur.
      const outer0 = hullPoint(t0, 0, side);
      const outer1 = hullPoint(t1, 0, side);
      const inset = 0.07 * side;
      const inner0 = [outer0[0], outer0[1], outer0[2] - inset];
      const inner1 = [outer1[0], outer1[1], outer1[2] - inset];
      const low0 = [inner0[0], deckAt(t0), inner0[2]];
      const low1 = [inner1[0], deckAt(t1), inner1[2]];
      const cap = new Color('#7a3b2b').multiplyScalar(0.9 + hash(i * 2.3 + side) * 0.2);
      const wall = new Color('#5d97a3').multiplyScalar(0.85 + hash(i * 5.1 + side) * 0.25);
      if (side === 1) {
        quad(outer0, inner0, inner1, outer1, cap);
        quad(inner0, low0, low1, inner1, wall);
      } else {
        quad(outer0, outer1, inner1, inner0, cap);
        quad(inner0, inner1, low1, low0, wall);
      }
    }
  }
  // Pont : bordages dans le sens de la longueur (cinq lattes de teintes inégales).
  const planks = 5;
  for (let i = 0; i < STATIONS; i++) {
    const t0 = i / STATIONS;
    const t1 = (i + 1) / STATIONS;
    const w0 = Math.max(0, beamAt(t0) - 0.07);
    const w1 = Math.max(0, beamAt(t1) - 0.07);
    for (let p = 0; p < planks; p++) {
      const z0a = -w0 + (2 * w0 * p) / planks;
      const z0b = -w0 + (2 * w0 * (p + 1)) / planks;
      const z1a = -w1 + (2 * w1 * p) / planks;
      const z1b = -w1 + (2 * w1 * (p + 1)) / planks;
      const x0 = -L / 2 + t0 * L;
      const x1 = -L / 2 + t1 * L;
      const tint = new Color('#9a7b58').multiplyScalar(0.82 + hash(p * 3.7 + Math.floor(i / 3) * 1.9) * 0.3);
      quad([x0, deckAt(t0), z0a], [x0, deckAt(t0), z0b], [x1, deckAt(t1), z1b], [x1, deckAt(t1), z1a], tint);
    }
  }
  // Tableau arrière : éventail fermant la section de poupe.
  const stern: number[][] = [];
  for (let k = 0; k <= SIDE; k++) stern.push(hullPoint(0, k, 1));
  for (let k = SIDE - 1; k >= 0; k--) stern.push(hullPoint(0, k, -1));
  const center = [-L / 2, (sheerAt(0) + keelAt(0)) / 2, 0];
  for (let index = 0; index < stern.length - 1; index++) {
    const tint = new Color(stern[index][1] > 0.74 ? '#3a7c8c' : '#9c4330').multiplyScalar(0.9 + hash(index * 1.7) * 0.18);
    tri(center, stern[index + 1], stern[index], tint);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------- superstructures */

const HOUSE = { x: -1.35, length: 1.7, width: 1.5, height: 1.28 };

/** Timonerie, mât cassé, portique, haubans, bouée, flotteurs : une seule géométrie. */
function deckworks() {
  const parts: BufferGeometry[] = [];
  const houseDeck = deckAt((HOUSE.x + L / 2) / L);
  const floor = houseDeck;
  // Timonerie : murs crème écaillés, toit rouge passé, fenêtres sombres (une brisée).
  parts.push(piece(new BoxGeometry(HOUSE.length, HOUSE.height, HOUSE.width), '#e6dccb', at([HOUSE.x, floor + HOUSE.height / 2, 0]), 0.1, 2));
  parts.push(piece(new BoxGeometry(HOUSE.length + 0.24, 0.1, HOUSE.width + 0.2), '#b4553e', at([HOUSE.x, floor + HOUSE.height + 0.05, 0]), 0.12, 3));
  const front = HOUSE.x + HOUSE.length / 2 + 0.006;
  const windowY = floor + HOUSE.height * 0.66;
  [-0.48, 0, 0.48].forEach((z, index) => {
    parts.push(piece(new BoxGeometry(0.02, 0.36, 0.34), index === 1 ? '#0e1317' : '#29404f', at([front, windowY, z])));
  });
  // Éclat de verre resté dans le cadre brisé.
  parts.push(piece(new ConeGeometry(0.07, 0.24, 3), '#9fc2cf', at([front + 0.01, windowY - 0.05, 0.08], [0, 0, 0.4])));
  for (const side of [1, -1]) {
    for (const x of [HOUSE.x - 0.4, HOUSE.x + 0.35]) {
      parts.push(piece(new BoxGeometry(0.4, 0.34, 0.02), '#29404f', at([x, windowY, side * (HOUSE.width / 2 + 0.006)])));
    }
  }
  parts.push(piece(new BoxGeometry(0.02, 0.95, 0.55), '#6d8794', at([HOUSE.x - HOUSE.length / 2 - 0.006, floor + 0.5, -0.25])));
  // Mât de misaine cassé net, cassure en dents de scie.
  const mastT = (1.6 + L / 2) / L;
  const mastBase = deckAt(mastT);
  parts.push(piece(new CylinderGeometry(0.075, 0.095, 2.3, 7), '#c9b8a0', at([1.6, mastBase + 1.15, 0]), 0.08, 5));
  parts.push(piece(new ConeGeometry(0.08, 0.32, 5), '#b8a283', at([1.62, mastBase + 2.42, 0.02], [0.3, 0, -0.25])));
  parts.push(piece(new ConeGeometry(0.06, 0.22, 4), '#c9b8a0', at([1.56, mastBase + 2.36, -0.03], [-0.25, 0, 0.35])));
  // Le morceau tombé, en travers du pont jusqu'au sable.
  const fallen = new CylinderGeometry(0.06, 0.075, 2.7, 7);
  parts.push(piece(fallen, '#c3b195', at([0.55, mastBase + 0.35, 1.05], [1.15, 0.35, 0.2]), 0.08, 6));
  // Bôme et vergue de chalut.
  parts.push(piece(new CylinderGeometry(0.04, 0.04, 1.8, 6), '#9d8a70', at([0.85, mastBase + 0.95, -0.25], [0, 0, Math.PI / 2 - 0.25])));
  // Haubans : un tendu vers l'étrave, un qui pend.
  const stemTop: [number, number, number] = [L / 2 - 0.05, sheerAt(1), 0];
  const mastTop: [number, number, number] = [1.6, mastBase + 2.25, 0];
  const stay = new Vector3(stemTop[0] - mastTop[0], stemTop[1] - mastTop[1], 0);
  parts.push(piece(
    new CylinderGeometry(0.012, 0.012, stay.length(), 4),
    '#3b3530',
    at([(stemTop[0] + mastTop[0]) / 2, (stemTop[1] + mastTop[1]) / 2, 0], [0, 0, Math.atan2(stay.y, stay.x) - Math.PI / 2]),
  ));
  parts.push(piece(new CylinderGeometry(0.012, 0.012, 1.9, 4), '#3b3530', at([1.45, mastBase + 1.35, -0.75], [0.35, 0, 0.12])));
  // Portique arrière rouillé.
  const sternDeck = deckAt(0.04);
  for (const z of [-0.88, 0.88]) {
    parts.push(piece(new BoxGeometry(0.1, 1.9, 0.1), '#a0583a', at([-3.25, sternDeck + 0.95, z], [0, 0, 0.08]), 0.15, z));
  }
  parts.push(piece(new BoxGeometry(0.12, 0.12, 1.9), '#8f4c33', at([-3.17, sternDeck + 1.88, 0]), 0.15, 9));
  parts.push(piece(new BoxGeometry(0.18, 0.26, 0.14), '#5c5550', at([-3.17, sternDeck + 1.66, 0.4])));
  // Treuil sur le pont.
  parts.push(piece(new CylinderGeometry(0.2, 0.2, 0.7, 10), '#7b8a8f', at([-0.2, deckAt(0.48) + 0.25, 0], [Math.PI / 2, 0, 0]), 0.1, 10));
  // Bouée couronne rouge et blanche sur la timonerie.
  const ring = new TorusGeometry(0.27, 0.07, 6, 16).toNonIndexed();
  const ringColors = new Float32Array(ring.getAttribute('position').count * 3);
  const red = new Color('#d8473a');
  const white = new Color('#f4f0e8');
  const position = ring.getAttribute('position');
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const angle = Math.atan2(position.getY(vertex), position.getX(vertex)) + Math.PI;
    const tint = Math.floor((angle / (Math.PI * 2)) * 8) % 2 === 0 ? red : white;
    for (let corner = 0; corner < 3; corner++) tint.toArray(ringColors, (vertex + corner) * 3);
  }
  ring.setAttribute('color', new BufferAttribute(ringColors, 3));
  ring.deleteAttribute('uv');
  ring.applyMatrix4(at([HOUSE.x + 0.1, floor + 0.62, HOUSE.width / 2 + 0.07]));
  parts.push(ring);
  // Flotteurs de chalut oubliés sur le pont.
  for (const [x, z] of [[2.4, 0.35], [2.6, -0.2], [-2.6, 0.55]]) {
    parts.push(piece(new SphereGeometry(0.14, 8, 6), '#f08a2c', at([x, deckAt((x + L / 2) / L) + 0.12, z]), 0.1, x));
  }
  return merge(parts);
}

/** Immatriculation peinte sur l'étrave (décor neutre : quartier maritime et département). */
function registration() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 96);
  ctx.fillStyle = 'rgba(244, 238, 222, 0.92)';
  ctx.font = '700 70px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LO 56', 128, 52, 240);
  // Peinture usée : quelques éclats retirés.
  ctx.globalCompositeOperation = 'destination-out';
  for (let index = 0; index < 26; index++) {
    ctx.beginPath();
    ctx.arc(hash(index * 3.1) * 256, hash(index * 7.3) * 96, 2 + hash(index * 1.7) * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Gwenn-ha-Du délavé et effiloché. */
function tatteredFlag() {
  const source = gwennHaDu();
  const image = source.image as HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  ctx.fillStyle = 'rgba(214, 198, 168, 0.32)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(canvas.width, 0);
  for (let step = 0; step <= 12; step++) {
    const y = (step / 12) * canvas.height;
    ctx.lineTo(canvas.width - (step % 2 === 0 ? 8 : 34 + hash(step * 3.3) * 50), y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
  for (let index = 0; index < 5; index++) {
    ctx.beginPath();
    ctx.arc(80 + hash(index * 5.3) * 260, 30 + hash(index * 2.9) * 200, 4 + hash(index) * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  source.dispose();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function flagMaterial(map: CanvasTexture) {
  const material = new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.95, alphaTest: 0.5 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // Drapeau fatigué : il flotte mollement depuis la hampe (x = 0).
        float flagFree = clamp(position.x / 1.05, 0.0, 1.0);
        transformed.z += (sin(position.x * 3.0 - uClothTime * 3.6) * 0.13 + sin(position.x * 6.4 - uClothTime * 5.1 + position.y * 2.0) * 0.04) * flagFree;
        transformed.y -= flagFree * flagFree * 0.12;`,
      );
  };
  material.customProgramCacheKey = () => 'wreck-flag-v1';
  return material;
}

/* ------------------------------------------------------------------ faune */

/** Goéland posé (corps, queue, pattes) : avant = +X. */
function gullBody() {
  return merge([
    piece(new SphereGeometry(1, 8, 6), '#f5f4ef', at([0, 0.32, 0], [0, 0, 0.12], [0.34, 0.17, 0.15])),
    piece(new ConeGeometry(0.11, 0.3, 4), '#9aa3ad', at([-0.36, 0.36, 0], [0, 0, Math.PI / 2 + 0.25], [1, 1, 0.6])),
    piece(new CylinderGeometry(0.012, 0.012, 0.2, 4), '#e8a33d', at([0.02, 0.1, 0.05])),
    piece(new CylinderGeometry(0.012, 0.012, 0.2, 4), '#e8a33d', at([0.02, 0.1, -0.05])),
  ]);
}

function gullHead() {
  return merge([
    piece(new SphereGeometry(0.1, 8, 6), '#f7f6f2', at([0, 0, 0])),
    piece(new ConeGeometry(0.03, 0.14, 4), '#f0b43c', at([0.14, -0.015, 0], [0, 0, -Math.PI / 2])),
    piece(new SphereGeometry(0.018, 5, 4), '#111111', at([0.05, 0.03, 0.07])),
    piece(new SphereGeometry(0.018, 5, 4), '#111111', at([0.05, 0.03, -0.07])),
  ]);
}

/** Aile : envergure le long de +Z depuis l'épaule, bout noir. */
function gullWing() {
  const positions = new Float32Array([
    0.12, 0, 0, -0.16, 0, 0, 0.04, 0, 0.42,
    -0.16, 0, 0, -0.2, 0, 0.4, 0.04, 0, 0.42,
    0.04, 0, 0.42, -0.2, 0, 0.4, -0.32, 0, 0.78,
  ]);
  const colors = new Float32Array(27);
  const grey = new Color('#a9b2bc');
  const tip = new Color('#2a2c30');
  for (let vertex = 0; vertex < 9; vertex++) (vertex === 8 ? tip : grey).toArray(colors, vertex * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Crabe : carapace, pinces, yeux pédonculés, pattes. */
function crabGeometry() {
  const parts: BufferGeometry[] = [
    piece(new SphereGeometry(1, 8, 5), '#e2552f', at([0, 0.09, 0], [0, 0, 0], [0.17, 0.08, 0.13]), 0.06, 1),
    piece(new SphereGeometry(0.06, 6, 4), '#ef6a3a', at([0.16, 0.1, 0.11], [0, 0, 0], [1.3, 0.8, 1])),
    piece(new SphereGeometry(0.06, 6, 4), '#ef6a3a', at([0.16, 0.1, -0.11], [0, 0, 0], [1.3, 0.8, 1])),
    piece(new CylinderGeometry(0.01, 0.01, 0.08, 4), '#e2552f', at([0.1, 0.17, 0.04])),
    piece(new CylinderGeometry(0.01, 0.01, 0.08, 4), '#e2552f', at([0.1, 0.17, -0.04])),
    piece(new SphereGeometry(0.018, 5, 4), '#141414', at([0.1, 0.215, 0.04])),
    piece(new SphereGeometry(0.018, 5, 4), '#141414', at([0.1, 0.215, -0.04])),
  ];
  for (const side of [1, -1]) {
    for (let leg = 0; leg < 3; leg++) {
      parts.push(piece(new CylinderGeometry(0.012, 0.01, 0.17, 4), '#c9472a', at([-0.06 + leg * 0.07, 0.05, side * 0.15], [side * 0.9, 0, 0])));
    }
  }
  return merge(parts);
}

const CRABS = [
  { x: 1.2, z: 3.1, span: 0.9, speed: 0.9, phase: 0 },
  { x: -2.4, z: 2.9, span: 0.7, speed: 1.2, phase: 2.1 },
  { x: 4.6, z: 1.6, span: 0.6, speed: 0.7, phase: 4.2 },
];

const ROCKS: [number, number, number, number, number][] = [
  [3.4, 0.9, 1.25, 0.2, 1],
  [4.5, -0.6, 1.55, 1.1, 2],
  [2.5, -1.6, 1.0, 2.3, 3],
  [-3.9, 1.5, 1.2, 0.7, 4],
  [-1.3, 2.4, 0.75, 1.9, 5],
  [5.4, 1.4, 0.8, 2.9, 6],
  [-4.6, -1.3, 0.9, 0.4, 7],
];

/** Hauteur du sable (repère du banc, aligné sur l'épave). */
function sandAt(x: number, z: number) {
  const angle = Math.atan2(z / SHAPE.rz, x / SHAPE.rx);
  const t = Math.hypot(x / SHAPE.rx, z / SHAPE.rz) / shoreNoise(angle, SHAPE.seed);
  return SHAPE.top - (SHAPE.top + SHAPE.depth) * Math.pow(Math.min(t, 1.2), 2.4);
}

const _dummy = new Object3D();
const _point = new Vector3();

/** Perchoirs (repère du banc) : toit de la timonerie et tronçon du mât, redressés. */
function perches() {
  const tilt = new Object3D();
  tilt.position.set(0, SINK, 0);
  tilt.rotation.set(ROLL, 0, PITCH);
  tilt.updateMatrixWorld(true);
  const mastBase = deckAt((1.6 + L / 2) / L);
  const houseTop = deckAt((HOUSE.x + L / 2) / L) + HOUSE.height + 0.1;
  return [
    _point.set(HOUSE.x - 0.35, houseTop, -0.45).applyMatrix4(tilt.matrixWorld).toArray() as [number, number, number],
    _point.set(1.6, mastBase + 2.32, 0).applyMatrix4(tilt.matrixWorld).toArray() as [number, number, number],
  ];
}

interface GullState {
  perch: [number, number, number];
  facing: number;
  /** Instant de l'envol sur l'horloge de la scène (-1 : posé). */
  flight: number;
}

/** L'épave est unique : l'état des goélands vit hors de React (comme boatState). */
const gullStates: GullState[] = (() => {
  const [roof, mast] = perches();
  return [
    { perch: roof, facing: 0.6, flight: -1 },
    { perch: mast, facing: -2.2, flight: -1 },
  ];
})();
/** Envol demandé par un clic, daté à la prochaine image. */
const takeoff = { requested: false };

const FLIGHT = 9;

function Gull({ index }: { index: number }) {
  const group = useRef<Group>(null);
  const head = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const body = useMemo(() => gullBody(), []);
  const headGeometry = useMemo(() => gullHead(), []);
  const wing = useMemo(() => gullWing(), []);

  useFrame((frame) => {
    const target = group.current;
    if (!target || !target.parent?.visible) return;
    const gull = gullStates[index];
    const time = frame.clock.elapsedTime;
    const age = gull.flight < 0 ? -1 : time - gull.flight;
    const [px, py, pz] = gull.perch;
    let flap = 0;
    let open = false;
    if (age >= 0 && age < FLIGHT) {
      // Envol, deux tours au-dessus de l'épave, retour au perchoir.
      const lift = smoothstep(0, 1.2, age);
      const land = smoothstep(FLIGHT - 1.8, FLIGHT, age);
      const angle = age * 0.85 + index * Math.PI;
      const radius = 4.2 + index * 1.4;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;
      const cy = 5 + index * 1.2 + Math.sin(age * 1.7) * 0.5;
      const k = lift * (1 - land);
      target.position.set(px + (cx - px) * k, py + (cy - py) * k, pz + (cz - pz) * k);
      const tangent = -angle - Math.PI / 2;
      target.rotation.set(0, gull.facing + shortestAngle(gull.facing, tangent) * k, -0.35 * k);
      open = k > 0.04;
      // Battements rapides au décollage, puis vol plané par moments.
      const gliding = k > 0.7 && Math.sin(age * 0.9) > 0.3;
      flap = Math.sin(age * (k > 0.7 ? 9 : 15)) * (gliding ? 0.12 : 0.85);
    } else {
      if (age >= FLIGHT) gull.flight = -1;
      target.position.set(px, py, pz);
      target.rotation.set(0, gull.facing, 0);
    }
    // Tête qui scrute l'horizon par à-coups.
    if (head.current) {
      const glance = Math.floor(time / 1.7 + index * 3.1);
      head.current.rotation.y = open ? 0 : (hash(glance * 1.37) - 0.5) * 1.6;
      head.current.rotation.z = open ? 0 : Math.sin(time * 2.1 + index) * 0.05;
    }
    for (const [ref, side] of [[left, 1], [right, -1]] as const) {
      const wingGroup = ref.current;
      if (!wingGroup) continue;
      // Repliée vers l'arrière le long du corps, ou déployée et battante.
      wingGroup.rotation.set(side * flap, -side * (open ? 0 : 1.32), 0);
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={body} material={paintMaterial()} raycast={() => null} />
      <group ref={head} position={[0.27, 0.47, 0]}>
        <mesh geometry={headGeometry} material={paintMaterial()} raycast={() => null} />
      </group>
      <group ref={left} position={[0.05, 0.38, 0.07]}>
        <mesh geometry={wing} material={paintDoubleMaterial()} raycast={() => null} />
      </group>
      <group ref={right} position={[0.05, 0.38, -0.07]} scale={[1, 1, -1]}>
        <mesh geometry={wing} material={paintDoubleMaterial()} raycast={() => null} />
      </group>
    </group>
  );
}

/* --------------------------------------------------------------- composant */

export function Wreck() {
  const root = useRef<Group>(null);
  const crabs = useRef<InstancedMesh>(null);
  const rocks = useRef<InstancedMesh>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const hull = useMemo(() => hullGeometry(), []);
  const works = useMemo(() => deckworks(), []);
  const bank = useMemo(() => sandbankGeometry(SHAPE), []);
  const foam = useMemo(() => foamRingGeometry(SHAPE.rx, SHAPE.rz, SHAPE.seed, 1.3), []);
  const foamMaterial = useMemo(() => createFoamMaterial(), []);
  const rock = useMemo(() => rockGeometry(4, 1), []);
  const crab = useMemo(() => crabGeometry(), []);
  const plate = useMemo(() => new PlaneGeometry(0.95, 0.36), []);
  const plateTexture = useMemo(() => registration(), []);
  const flagTexture = useMemo(() => tatteredFlag(), []);
  const flag = useMemo(() => flagMaterial(flagTexture), [flagTexture]);
  const flagGeometry = useMemo(() => new PlaneGeometry(1.05, 0.7, 10, 4).translate(0.525, 0, 0), []);
  // Plaque d'immatriculation tangente à l'étrave (bâbord et tribord).
  const plates = useMemo(() => {
    const t = 0.84;
    const slope = Math.atan2(beamAt(t + 0.02) - beamAt(t - 0.02), 0.04 * L);
    const y = sheerAt(t) - 0.42;
    const x = -L / 2 + t * L;
    const b = beamAt(t) + 0.02;
    return [
      { position: [x, y, b] as [number, number, number], rotation: [0, -slope, 0] as [number, number, number] },
      { position: [x, y, -b] as [number, number, number], rotation: [0, Math.PI + slope, 0] as [number, number, number] },
    ];
  }, []);
  const houseTop = deckAt((HOUSE.x + L / 2) / L) + HOUSE.height + 0.1;

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Rochers de granit rose (instanciés), posés dans le sable.
  useEffect(() => {
    const mesh = rocks.current;
    if (!mesh) return;
    const color = new Color();
    ROCKS.forEach(([x, z, size, turn, seed], index) => {
      _dummy.position.set(x, sandAt(x, z) - size * 0.25, z);
      _dummy.rotation.set(hash(seed) * 0.4, turn, hash(seed * 2.1) * 0.3);
      _dummy.scale.set(size * (1.1 + hash(seed * 3.3) * 0.4), size * (0.7 + hash(seed * 4.7) * 0.3), size);
      _dummy.updateMatrix();
      mesh.setMatrixAt(index, _dummy.matrix);
      mesh.setColorAt(index, color.set(index % 3 === 0 ? '#a99ba2' : '#c3a196').multiplyScalar(0.9 + hash(seed) * 0.2));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      foamMaterial.dispose();
      flag.dispose();
      flagTexture.dispose();
      plateTexture.dispose();
    },
    [flag, flagTexture, foamMaterial, plateTexture],
  );

  const activate = () => {
    if (!root.current?.visible) return;
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    if (!next) return;
    woodCreak();
    gullCries();
    takeoff.requested = true;
    logbook.stamp('wreck');
  };

  const close = () => {
    openRef.current = false;
    setOpen(false);
  };

  useFrame((state) => {
    const group = root.current;
    if (!group) return;
    const visible = inSight(state.camera, WRECK_SPOT.x, WRECK_SPOT.z);
    group.visible = visible;
    if (!visible) return;
    const time = state.clock.elapsedTime;
    if (takeoff.requested) {
      takeoff.requested = false;
      gullStates.forEach((gull, index) => {
        if (gull.flight < 0) gull.flight = time + index * 0.35;
      });
    }
    const mesh = crabs.current;
    if (mesh) {
      const reduced = useWorld.getState().reducedMotion;
      CRABS.forEach((crabSpot, index) => {
        // Trottinement latéral, avec des pauses.
        const cycle = time * crabSpot.speed + crabSpot.phase;
        const pause = clamp(Math.sin(cycle * 0.37) * 3, 0, 1);
        const go = reduced ? 0 : Math.sin(cycle) * crabSpot.span * (0.3 + 0.7 * pause);
        const x = crabSpot.x + go;
        const z = crabSpot.z;
        _dummy.position.set(x, sandAt(x, z) + 0.01 + Math.abs(Math.sin(cycle * 6)) * 0.015, z);
        _dummy.rotation.set(0, Math.PI / 2 + Math.sin(cycle * 6) * 0.06, 0);
        _dummy.scale.setScalar(1.15);
        _dummy.updateMatrix();
        mesh.setMatrixAt(index, _dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (openRef.current && Math.hypot(boatState.position.x - WRECK_SPOT.x, boatState.position.z - WRECK_SPOT.z) > 75) close();
  });

  return (
    <group ref={root} position={[WRECK_SPOT.x, 0, WRECK_SPOT.z]} visible={false}>
      <group rotation-y={HEADING}>
        <mesh geometry={bank} material={paintMaterial()} receiveShadow raycast={() => null} />
        <FoamCollar shape={SHAPE} world={[WRECK_SPOT.x, WRECK_SPOT.z]} geometry={foam} material={foamMaterial} />
        <instancedMesh ref={rocks} args={[rock, undefined, ROCKS.length]} castShadow receiveShadow raycast={() => null}>
          <meshStandardMaterial roughness={0.95} flatShading />
        </instancedMesh>
        <instancedMesh ref={crabs} args={[crab, paintMaterial(), CRABS.length]} raycast={() => null} />
        <Hotspot onActivate={activate} hoverScale={1.02}>
          <group position-y={SINK} rotation={[ROLL, 0, PITCH]}>
            <mesh geometry={hull} material={paintDoubleMaterial()} castShadow receiveShadow />
            <mesh geometry={works} material={paintMaterial()} castShadow />
            {plates.map((plateSpot, index) => (
              <mesh key={index} geometry={plate} position={plateSpot.position} rotation={plateSpot.rotation} raycast={() => null}>
                <meshStandardMaterial map={plateTexture} alphaTest={0.4} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
              </mesh>
            ))}
            <group position={[HOUSE.x - HOUSE.length / 2 + 0.12, houseTop - 0.1, HOUSE.width / 2 - 0.15]}>
              <mesh position-y={0.55} raycast={() => null}>
                <cylinderGeometry args={[0.025, 0.03, 1.1, 5]} />
                <meshStandardMaterial color="#cfc6b6" roughness={0.9} />
              </mesh>
              <mesh geometry={flagGeometry} material={flag} position={[0.02, 0.85, 0]} rotation-y={Math.PI} raycast={() => null} />
            </group>
            {/* Zone de clic : toute la coque. */}
            <mesh visible={false} position={[0, 1.4, 0]}>
              <boxGeometry args={[L + 0.6, 3.2, B * 2 + 0.6]} />
            </mesh>
          </group>
        </Hotspot>
        {gullStates.map((gull, index) => (
          <Gull key={index} index={index} />
        ))}
      </group>

      {open && (
        <SecretCard
          position={[0, 5.6, 0]}
          eyebrow="Épave · vieux chalutier"
          glyph="⚑"
          label="Le vieux chalutier breton"
          onClose={close}
        >
          <p className={cardStyles.quote}>
            Un vieux chalutier breton échoué : un clin d’œil aux pêcheurs de la famille.
          </p>
        </SecretCard>
      )}
    </group>
  );
}
