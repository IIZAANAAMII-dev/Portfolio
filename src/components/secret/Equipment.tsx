'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { PaintedSign } from '@/components/islands/kit';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { merge, part, placed } from './geo';
import { GLOW, setGlow } from './Glows';
import {
  CONSOLE,
  DEAD_TREE,
  FACADE_Z,
  GENERATOR,
  groundSite,
  ISLAND,
  LANDING,
  restSite,
  RIFT,
  sampler,
  SENSOR,
  siteToIsland,
  STAIRS,
  STANDS,
  TAPE_STAKES,
  YARD_HEIGHT,
} from './layout';
import { flicker } from './signal';
import { poolTexture, tapeTexture } from './textures';

/**
 * Le matériel de l'équipe et les abords : console à trois écrans, néons de chantier sur
 * trépied, groupe électrogène qui tremble, câbles qui serpentent jusque dans la faille,
 * ruban de chantier, vieux ponton, arbre mort, rochers gris.
 *
 * Tout ce qui ne bouge pas est fusionné en un seul maillage à couleurs par sommet.
 */

const WOOD = ['#8a8578', '#7d786b', '#959081', '#6f6a5e'];
const METAL = '#8d9193';
const DARK = '#2a2c2e';

/** Orientation (lacet) d'un objet du site qui regarde un point. */
function aim(fromX: number, fromZ: number, toX: number, toZ: number) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

/* ------------------------------------------------------------- pièces fixes */

function tripod(pieces: BufferGeometry[], x: number, z: number, height: number, yaw: number) {
  const y = restSite(x, z, 0.4);
  for (let leg = 0; leg < 3; leg++) {
    const angle = yaw + (leg / 3) * Math.PI * 2;
    const spread = 0.42;
    const lx = x + Math.sin(angle) * spread * 0.5;
    const lz = z + Math.cos(angle) * spread * 0.5;
    const tilt = Math.atan2(spread, height * 0.55);
    pieces.push(part(new CylinderGeometry(0.022, 0.022, height * 0.58, 5), METAL, {
      at: [lx, y + height * 0.27, lz],
      rot: [Math.cos(angle) * tilt, 0, -Math.sin(angle) * tilt],
    }));
  }
  pieces.push(part(new CylinderGeometry(0.028, 0.028, height, 6), METAL, { at: [x, y + height / 2, z] }));
  return y;
}

function buildStatics() {
  const pieces: BufferGeometry[] = [];

  // Trépieds des néons (la réglette est posée à part, orientée).
  const standTops = STANDS.map((stand) => {
    const yaw = aim(stand.x, stand.z, RIFT.x, RIFT.z);
    const y = tripod(pieces, stand.x, stand.z, 1.85, yaw);
    return { x: stand.x, y: y + 1.97, z: stand.z, yaw };
  });

  // Console : table pliante, trois moniteurs cathodiques, clavier, cassettes empilées.
  {
    const { x, z } = CONSOLE;
    const y = restSite(x, z, 0.6);
    pieces.push(part(new BoxGeometry(1.45, 0.05, 0.66), '#77736a', { at: [x, y + 0.76, z] }));
    for (const [lx, lz] of [[-0.66, -0.28], [0.66, -0.28], [-0.66, 0.28], [0.66, 0.28]]) {
      pieces.push(part(new CylinderGeometry(0.022, 0.022, 0.76, 5), METAL, { at: [x + lx, y + 0.38, z + lz] }));
    }
    [-0.46, 0, 0.46].forEach((mx, index) => {
      const turn = -mx * 0.55;
      const monitor = merge([
        part(new BoxGeometry(0.42, 0.36, 0.36), '#bdb8a6', { at: [0, 0.18, -0.02] }),
        part(new BoxGeometry(0.3, 0.26, 0.2), '#a9a492', { at: [0, 0.17, -0.27] }),
        part(new BoxGeometry(0.36, 0.29, 0.02), '#1c1f1f', { at: [0, 0.19, 0.16] }),
        part(new BoxGeometry(0.06, 0.02, 0.02), index === 1 ? '#c94a3a' : '#5b5d55', { at: [0.13, 0.03, 0.165] }),
      ]);
      pieces.push(placed(monitor, { at: [x + mx, y + 0.785, z - 0.1 + Math.abs(mx) * 0.12], rot: [0, turn, 0] }));
      monitor.dispose();
    });
    pieces.push(part(new BoxGeometry(0.5, 0.03, 0.16), '#cfcab8', { at: [x + 0.05, y + 0.8, z + 0.2] }));
    for (let tape = 0; tape < 3; tape++) {
      pieces.push(part(new BoxGeometry(0.2, 0.026, 0.11), tape === 1 ? '#efe8d4' : '#1b1b1d', {
        at: [x - 0.55, y + 0.8 + tape * 0.028, z + 0.18],
        rot: [0, (hash(tape * 3.3) - 0.5) * 0.4, 0],
      }));
    }
    pieces.push(part(new CylinderGeometry(0.04, 0.035, 0.09, 8), '#d8d2c2', { at: [x + 0.48, y + 0.83, z + 0.2] }));
    // Mallettes de transport noires à coins jaunes.
    for (const [cx, cz, turn] of [[x + 0.95, z + 0.55, 0.3], [x + 1.05, z + 0.0, -0.2]]) {
      const cy = restSite(cx, cz, 0.3);
      const box = merge([
        part(new BoxGeometry(0.62, 0.36, 0.42), '#26292b', { at: [0, 0.18, 0] }),
        part(new BoxGeometry(0.64, 0.05, 0.44), '#d8b22a', { at: [0, 0.36, 0] }),
        part(new BoxGeometry(0.12, 0.04, 0.04), METAL, { at: [0, 0.4, 0] }),
      ]);
      pieces.push(placed(box, { at: [cx, cy, cz], rot: [0, turn, 0] }));
      box.dispose();
    }
  }

  // Groupe électrogène (corps fixe ; le tremblement est sur un maillage à part).
  // Capteur sur trépied au pied de la faille.
  {
    const yaw = aim(SENSOR.x, SENSOR.z, RIFT.x, RIFT.z);
    const y = tripod(pieces, SENSOR.x, SENSOR.z, 0.95, yaw);
    const sensor = merge([
      part(new BoxGeometry(0.22, 0.16, 0.18), '#d8b22a', { at: [0, 0.08, 0] }),
      part(new CylinderGeometry(0.05, 0.05, 0.06, 10), DARK, { at: [0, 0.08, 0.12], rot: [Math.PI / 2, 0, 0] }),
      part(new CylinderGeometry(0.008, 0.008, 0.4, 4), METAL, { at: [0.08, 0.36, -0.04] }),
    ]);
    pieces.push(placed(sensor, { at: [SENSOR.x, y + 0.95, SENSOR.z], rot: [0, yaw, 0] }));
    sensor.dispose();
  }

  // Ruban de chantier : les piquets.
  TAPE_STAKES.forEach(([sx, sz], index) => {
    const y = restSite(sx, sz, 0.1);
    pieces.push(part(new CylinderGeometry(0.03, 0.035, 1.02, 5), index % 2 ? '#c9c4b4' : '#d77a3a', { at: [sx, y + 0.48, sz], rot: [(hash(index) - 0.5) * 0.08, 0, (hash(index + 4) - 0.5) * 0.08] }));
  });

  // Le ponton : planches grises disjointes, une manquante, une cassée.
  {
    const planks = 9;
    const span = LANDING.to - LANDING.from;
    for (let index = 0; index < planks; index++) {
      if (index === 6) continue;
      const z = LANDING.from + ((index + 0.5) / planks) * span;
      const broken = index === 3;
      const width = broken ? 0.9 : LANDING.width + (hash(index * 2.1) - 0.5) * 0.12;
      pieces.push(part(new BoxGeometry(width, 0.065, span / planks - 0.045), WOOD[index % WOOD.length], {
        at: [broken ? -0.28 : (hash(index * 5.3) - 0.5) * 0.06, LANDING.deck + (hash(index) - 0.5) * 0.02, z],
        rot: [(hash(index * 1.7) - 0.5) * 0.04, (hash(index * 3.9) - 0.5) * 0.05, broken ? 0.08 : (hash(index * 7.1) - 0.5) * 0.03],
      }));
    }
    for (const side of [-1, 1]) {
      pieces.push(part(new BoxGeometry(0.1, 0.12, span + 0.2), '#5f5a50', { at: [side * 0.58, LANDING.deck - 0.09, (LANDING.from + LANDING.to) / 2] }));
      for (const z of [LANDING.from + 0.15, (LANDING.from + LANDING.to) / 2, LANDING.to - 0.1]) {
        const bottom = Math.min(groundSite(side * 0.7, z), 0.2) - 1.2;
        const top = LANDING.deck + (z > LANDING.to - 0.5 ? 0.38 : 0.02);
        pieces.push(part(new CylinderGeometry(0.075, 0.085, top - bottom, 6), '#5c564b', { at: [side * 0.7, (top + bottom) / 2, z] }));
      }
    }
    // Escalier : six marches de la falaise au ponton, limons et main courante.
    {
      const { top, bottom, steps, width } = STAIRS;
      const high = YARD_HEIGHT;
      const run = (bottom - top) / steps;
      const rise = (high - LANDING.deck) / steps;
      for (let step = 0; step < steps; step++) {
        const z = top + (step + 0.5) * run;
        const y = high - (step + 1) * rise + 0.02;
        pieces.push(part(new BoxGeometry(width + (hash(step * 3.3) - 0.5) * 0.08, 0.06, run + 0.05), WOOD[(step + 1) % WOOD.length], {
          at: [(hash(step * 7.7) - 0.5) * 0.04, y, z],
          rot: [0, (hash(step * 5.5) - 0.5) * 0.06, (hash(step * 2.2) - 0.5) * 0.04],
        }));
      }
      const length = Math.hypot(bottom - top, high - LANDING.deck);
      const slope = Math.atan2(high - LANDING.deck, bottom - top);
      for (const side of [-1, 1]) {
        pieces.push(part(new BoxGeometry(0.07, 0.2, length + 0.2), '#5f5a50', {
          at: [side * (width / 2 + 0.04), (high + LANDING.deck) / 2 - 0.08, (top + bottom) / 2],
          rot: [slope, 0, 0],
        }));
        // Poteaux et main courante (côté droit seulement : l'autre est tombée).
        if (side > 0) {
          for (const z of [top + 0.1, bottom - 0.05]) {
            const base = z < (top + bottom) / 2 ? high : LANDING.deck;
            pieces.push(part(new CylinderGeometry(0.035, 0.04, 0.95, 5), '#5c564b', { at: [side * (width / 2 + 0.1), base + 0.45, z] }));
          }
          pieces.push(part(new CylinderGeometry(0.025, 0.025, length, 5), '#6c665a', {
            at: [side * (width / 2 + 0.1), (high + LANDING.deck) / 2 + 0.88, (top + bottom) / 2],
            rot: [slope - Math.PI / 2, 0, 0],
          }));
        }
      }
    }
    // Poteau de la lanterne, taquet et glène de cordage.
    pieces.push(part(new CylinderGeometry(0.045, 0.05, 1.5, 6), '#4f4b44', { at: [0.66, LANDING.deck + 0.72, LANDING.to - 0.25] }));
    pieces.push(part(new BoxGeometry(0.3, 0.04, 0.04), '#4f4b44', { at: [0.55, LANDING.deck + 1.44, LANDING.to - 0.25] }));
    pieces.push(part(new TorusGeometry(0.17, 0.045, 5, 14), '#b7a78a', { at: [-0.4, LANDING.deck + 0.05, LANDING.to - 0.55], rot: [Math.PI / 2, 0, 0] }));
    pieces.push(part(new TorusGeometry(0.12, 0.04, 5, 12), '#a99a7e', { at: [-0.4, LANDING.deck + 0.1, LANDING.to - 0.55], rot: [Math.PI / 2, 0, 0.3] }));
  }

  // Arbre mort, tordu, derrière la maison.
  {
    const { x, z } = DEAD_TREE;
    const y = restSite(x, z, 0.3) - 0.1;
    const bark = '#4d4842';
    const branch = (bx: number, by: number, bz: number, length: number, radius: number, pitch: number, yaw: number, depth: number) => {
      const dir = new Vector3(Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), Math.sin(pitch) * Math.cos(yaw));
      const cylinder = new CylinderGeometry(radius * 0.62, radius, length, 6);
      cylinder.translate(0, length / 2, 0);
      const matrix = new Matrix4().lookAt(new Vector3(), dir, new Vector3(0, 0, 1));
      const rotation = new Matrix4().makeRotationX(Math.PI / 2);
      cylinder.applyMatrix4(rotation).applyMatrix4(matrix);
      pieces.push(part(cylinder, bark, { at: [bx, by, bz] }));
      if (depth <= 0) return;
      const ex = bx + dir.x * length;
      const ey = by + dir.y * length;
      const ez = bz + dir.z * length;
      const children = depth === 2 ? 3 : 2;
      for (let index = 0; index < children; index++) {
        const key = depth * 13.1 + index * 3.7 + bx;
        branch(ex, ey, ez, length * (0.55 + hash(key) * 0.15), radius * 0.6, pitch * 0.6 + 0.45 + hash(key + 1) * 0.35, yaw + (index - (children - 1) / 2) * 1.9 + hash(key + 2) * 0.6, depth - 1);
      }
    };
    branch(x, y, z, 1.9, 0.17, 0.12, 0.6, 2);
  }

  return { geometry: merge(pieces), standTops };
}

/* --------------------------------------------------------------- les câbles */

const CABLES: [number, number, number?][][] = [
  [[GENERATOR.x + 0.2, GENERATOR.z + 0.3], [-3.0, 0.7], [-2.5, 1.0], [-2.0, 1.45], [STANDS[0].x - 0.05, STANDS[0].z - 0.05]],
  [[GENERATOR.x + 0.25, GENERATOR.z + 0.35], [-2.75, 1.5], [-2.05, 2.55], [-0.8, 2.9], [0.25, 2.55], [STANDS[1].x - 0.05, STANDS[1].z - 0.05]],
  [[GENERATOR.x + 0.1, GENERATOR.z + 0.4], [-3.15, 1.6], [-2.6, 3.25], [-1.5, 4.45], [0.15, 4.75], [1.35, 4.2], [CONSOLE.x - 0.4, CONSOLE.z + 0.15]],
  [[CONSOLE.x - 0.3, CONSOLE.z - 0.1], [1.6, 2.65], [1.15, 2.25], [SENSOR.x + 0.08, SENSOR.z + 0.1]],
  [[CONSOLE.x + 0.4, CONSOLE.z - 0.1], [3.2, 2.5], [3.65, 1.5], [3.82, 0.75]],
  // Celui-ci entre dans la faille : on a envoyé une sonde de l'autre côté.
  [[CONSOLE.x - 0.5, CONSOLE.z - 0.05], [1.2, 2.95], [0.45, 2.45], [0.05, 1.7], [RIFT.x + 0.1, FACADE_Z + 0.32, 0.06], [RIFT.x + 0.05, FACADE_Z + 0.02, 0.2]],
];

function buildCables() {
  const tubes = CABLES.map((route) => {
    const points = route.map(([x, z, lift = 0]) => new Vector3(x, groundSite(x, z) + 0.035 + lift, z));
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    const segments = Math.max(12, Math.round(curve.getLength() / 0.12));
    return part(new TubeGeometry(curve, segments, 0.03, 4, false), '#1f2123');
  });
  return merge(tubes);
}

/* ---------------------------------------------------------- ruban de chantier */

const tapeUniforms = { uTapeTime: { value: 0 } };

function buildTape() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const flutter: number[] = [];
  const sides: number[] = [];
  const indices: number[] = [];
  let base = 0;
  const span = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number, phase: number) => {
    const length = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / length;
    const nz = (bx - ax) / length;
    const steps = 12;
    let u = 0;
    for (let index = 0; index <= steps; index++) {
      const t = index / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = ay + (by - ay) * t - sag * 4 * t * (1 - t);
      if (index > 0) u += length / steps;
      // Le ruban se vrille un peu : sa largeur pivote le long de la portée.
      const twist = Math.sin(t * Math.PI * 2 + phase) * 0.6;
      const wy = Math.cos(twist) * 0.04;
      const wn = Math.sin(twist) * 0.04;
      positions.push(x + nx * wn, y + wy, z + nz * wn, x - nx * wn, y - wy, z - nz * wn);
      uvs.push(u / 0.5, 1, u / 0.5, 0);
      const f = 4 * t * (1 - t);
      flutter.push(f, f);
      sides.push(nx, nz, nx, nz);
      if (index > 0) indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
      base += 2;
    }
  };
  for (let index = 0; index < TAPE_STAKES.length - 1; index++) {
    const [ax, az] = TAPE_STAKES[index];
    const [bx, bz] = TAPE_STAKES[index + 1];
    span(ax, restSite(ax, az, 0.1) + 0.9, az, bx, restSite(bx, bz, 0.1) + 0.9, bz, 0.12, index * 1.3);
  }
  // Un bout arraché qui pend du dernier piquet.
  const [lx, lz] = TAPE_STAKES[TAPE_STAKES.length - 1];
  const ly = restSite(lx, lz, 0.1) + 0.9;
  span(lx, ly, lz, lx + 0.25, ly - 0.55, lz + 0.18, -0.06, 2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute('aFlutter', new BufferAttribute(new Float32Array(flutter), 1));
  geometry.setAttribute('aSide', new BufferAttribute(new Float32Array(sides), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tapeMaterial() {
  const material = new MeshStandardMaterial({ map: tapeTexture(), side: DoubleSide, roughness: 0.55 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTapeTime = tapeUniforms.uTapeTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTapeTime;\nattribute float aFlutter;\nattribute vec2 aSide;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tapeWave = sin(uTapeTime * 5.3 + position.x * 3.1 + position.z * 2.3) + sin(uTapeTime * 8.1 + position.x * 5.0) * 0.4;
        transformed.xz += aSide * tapeWave * 0.035 * aFlutter;
        transformed.y += cos(uTapeTime * 4.2 + position.z * 2.0) * 0.012 * aFlutter;`,
      );
  };
  material.customProgramCacheKey = () => 'yellow-static-tape';
  return material;
}

/* ------------------------------------------------------------- les écrans */

/** Trois écrans de la console : oscilloscope, retour caméra, spectre. Un seul canevas. */
let screenState: { canvas: HTMLCanvasElement; texture: CanvasTexture; last: number } | null = null;

function consoleScreens() {
  if (!screenState) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    screenState = { canvas, texture, last: -1 };
  }
  return screenState;
}

function drawScreens(canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // 1 — oscilloscope vert.
  ctx.fillStyle = '#071a10';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = 'rgba(80, 200, 120, 0.25)';
  ctx.lineWidth = 1;
  for (let k = 16; k < 128; k += 16) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, 96);
    ctx.stroke();
  }
  for (let k = 16; k < 96; k += 16) {
    ctx.beginPath();
    ctx.moveTo(0, k);
    ctx.lineTo(128, k);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8dffb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 128; x += 2) {
    const spike = Math.sin(time * 1.7) > 0.85 ? Math.sin(x * 1.3 + time * 40) * 18 : 0;
    const y = 48 + Math.sin(x * 0.12 + time * 5) * 16 * Math.sin(time * 0.7 + x * 0.01) + spike;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 2 — retour du caméscope : neige, la faille au centre, REC.
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(128, 0, 128, 96);
  for (let k = 0; k < 220; k++) {
    const shade = Math.floor(hash(k * 7.3 + Math.floor(time * 12) * 1.1) * 90) + 40;
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 6})`;
    ctx.fillRect(128 + hash(k * 3.1 + time) * 128, hash(k * 5.7 + time * 2) * 96, 2, 1);
  }
  const glowX = 192 + Math.sin(time * 0.45) * 6;
  const gradient = ctx.createLinearGradient(glowX - 22, 0, glowX + 22, 0);
  gradient.addColorStop(0, 'rgba(255, 210, 80, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 236, 160, 0.95)');
  gradient.addColorStop(1, 'rgba(255, 210, 80, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(glowX, 14);
  ctx.lineTo(glowX + 9, 40);
  ctx.lineTo(glowX + 4, 60);
  ctx.lineTo(glowX + 8, 86);
  ctx.lineTo(glowX - 8, 86);
  ctx.lineTo(glowX - 5, 58);
  ctx.lineTo(glowX - 10, 38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = Math.sin(time * Math.PI * 1.8) > 0 ? '#ff3b2f' : 'rgba(255, 59, 47, 0.25)';
  ctx.beginPath();
  ctx.arc(140, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f2ea';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('REC', 148, 16);
  const seconds = Math.floor(time);
  const code = `${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}:${String(Math.floor((time % 1) * 25)).padStart(2, '0')}`;
  ctx.fillText(code, 196, 90);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 96; y += 3) ctx.fillRect(128, y, 128, 1);

  // 3 — spectre ambre.
  ctx.fillStyle = '#1b1306';
  ctx.fillRect(256, 0, 128, 96);
  for (let bar = 0; bar < 14; bar++) {
    const level = 0.25 + 0.6 * Math.abs(Math.sin(time * (1.3 + bar * 0.37) + bar * 1.7)) * (bar < 4 ? 1 : 0.7);
    const height = Math.round(level * 80);
    for (let cell = 0; cell < height; cell += 5) {
      ctx.fillStyle = cell > 60 ? '#ff6a3a' : cell > 40 ? '#ffc04a' : '#e7b13a';
      ctx.fillRect(262 + bar * 8.6, 90 - cell - 4, 6.5, 4);
    }
  }
}

/** Les trois faces d'écran (uv découpées dans le canevas). */
function screenGeometry() {
  const faces = [-0.46, 0, 0.46].map((mx, index) => {
    const plane = new PlaneGeometry(0.33, 0.25);
    const uv = plane.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (index + uv.getX(k)) / 3);
    const turn = -mx * 0.55;
    const matrix = new Matrix4().makeRotationY(turn);
    const local = new Vector3(0, 0.19, 0.172).applyMatrix4(matrix);
    plane.applyMatrix4(matrix);
    plane.translate(mx + local.x, 0.785 + local.y, -0.1 + Math.abs(mx) * 0.12 + local.z);
    return plane;
  });
  const geometry = new BufferGeometry();
  const merged = faces.reduce<{ positions: number[]; uvs: number[]; indices: number[] }>(
    (acc, face) => {
      const offset = acc.positions.length / 3;
      acc.positions.push(...face.attributes.position.array);
      acc.uvs.push(...face.attributes.uv.array);
      acc.indices.push(...Array.from(face.index?.array ?? []).map((value) => value + offset));
      face.dispose();
      return acc;
    },
    { positions: [], uvs: [], indices: [] },
  );
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(merged.positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(merged.uvs), 2));
  geometry.setIndex(merged.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ----------------------------------------------------------- le générateur */

function generatorGeometry() {
  return merge([
    part(new BoxGeometry(0.78, 0.05, 0.52), DARK, { at: [0, 0.03, 0] }),
    part(new BoxGeometry(0.62, 0.38, 0.42), '#5d6547', { at: [0, 0.26, 0] }),
    part(new BoxGeometry(0.5, 0.16, 0.36), '#a3452f', { at: [0, 0.53, 0] }),
    part(new CylinderGeometry(0.05, 0.05, 0.04, 8), '#d8d2bd', { at: [0.12, 0.63, 0] }),
    part(new BoxGeometry(0.03, 0.18, 0.12), '#2d3031', { at: [0.32, 0.3, 0.08] }),
    part(new CylinderGeometry(0.035, 0.035, 0.32, 6), '#55585a', { at: [-0.34, 0.42, -0.12] }),
    ...[-1, 1].flatMap((side) => [
      part(new CylinderGeometry(0.02, 0.02, 0.62, 5), METAL, { at: [side * 0.38, 0.33, 0.24] }),
      part(new CylinderGeometry(0.02, 0.02, 0.62, 5), METAL, { at: [side * 0.38, 0.33, -0.24] }),
      part(new CylinderGeometry(0.02, 0.02, 0.5, 5), METAL, { at: [side * 0.38, 0.64, 0], rot: [Math.PI / 2, 0, 0] }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ rochers */

function rockGeometry() {
  const rock = new IcosahedronGeometry(1, 1);
  const positions = rock.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const key = Math.round(positions.getX(index) * 7 + positions.getY(index) * 13 + positions.getZ(index) * 17);
    const factor = 0.8 + hash(key) * 0.32;
    positions.setXYZ(index, positions.getX(index) * factor, positions.getY(index) * factor * 0.7, positions.getZ(index) * factor);
  }
  rock.computeVertexNormals();
  return rock;
}

/* -------------------------------------------------------------- composants */

const COOL_TUBE = new Color('#eaffd6');
const LAMP_COLOR = new Color('#ffd98a');
const GEN_LED = new Color('#7dff8a');
const SCREEN_GLOW = new Color('#9fe8c0');
const SENSOR_LED = new Color('#ffcf3a');
const dummy = new Object3D();
const lift = new Vector3();

function Stands({ tops }: { tops: { x: number; y: number; z: number; yaw: number }[] }) {
  const fixture = useMemo(
    () => merge([
      part(new BoxGeometry(1.0, 0.16, 0.2), '#d9dccf'),
      part(new BoxGeometry(1.02, 0.04, 0.24), '#9ea197', { at: [0, 0.09, 0] }),
      part(new BoxGeometry(0.94, 0.1, 0.02), '#f4f6ea', { at: [0, -0.01, 0.1] }),
    ]),
    [],
  );
  const tubes = useMemo(
    () => merge([
      part(new CylinderGeometry(0.028, 0.028, 0.9, 8), '#ffffff', { at: [0, 0.035, 0.12], rot: [0, 0, Math.PI / 2] }),
      part(new CylinderGeometry(0.028, 0.028, 0.9, 8), '#ffffff', { at: [0, -0.04, 0.12], rot: [0, 0, Math.PI / 2] }),
    ]),
    [],
  );
  const bodyMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), []);
  const tubeMaterialA = useRef<MeshBasicMaterial>(null);
  const tubeMaterialB = useRef<MeshBasicMaterial>(null);
  const pools = useRef<InstancedMesh>(null);
  const poolGeometry = useMemo(() => new PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), []);

  useLayoutEffect(() => {
    const target = pools.current;
    if (!target) return;
    target.instanceColor = new InstancedBufferAttribute(new Float32Array(6), 3);
    tops.forEach((top, index) => {
      // La tache de lumière tombe devant la réglette, vers la faille.
      const x = top.x + Math.sin(top.yaw) * 0.9;
      const z = top.z + Math.cos(top.yaw) * 0.9;
      dummy.position.set(x, groundSite(x, z) + 0.04, z);
      dummy.rotation.set(0, top.yaw, 0);
      dummy.scale.set(1, 1, 1.25);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [tops]);

  useFrame(() => {
    const night = skyState.dayNight;
    const levels = [flicker.standA, flicker.standB];
    [tubeMaterialA.current, tubeMaterialB.current].forEach((material, index) => {
      if (!material) return;
      const level = levels[index];
      material.color.copy(COOL_TUBE).multiplyScalar(0.35 + level * (1.1 + night * 0.9));
    });
    const target = pools.current;
    if (target?.instanceColor) {
      levels.forEach((level, index) => {
        lift.set(0.85, 0.95, 0.7).multiplyScalar(level * (0.12 + night * 0.55));
        target.instanceColor?.setXYZ(index, lift.x, lift.y, lift.z);
      });
      target.instanceColor.needsUpdate = true;
    }
    tops.forEach((top, index) => {
      setGlow(GLOW.stand + index, top.x + Math.sin(top.yaw) * 0.12, top.y, top.z + Math.cos(top.yaw) * 0.12, 1.9, COOL_TUBE, levels[index] * 0.6, 0.08);
    });
  });

  return (
    <group>
      {tops.map((top, index) => (
        <group key={index} position={[top.x, top.y, top.z]} rotation={[0, top.yaw, 0]}>
          <group rotation-x={0.38}>
            <mesh geometry={fixture} material={bodyMaterial} castShadow />
            <mesh geometry={tubes} raycast={() => null}>
              <meshBasicMaterial ref={index === 0 ? tubeMaterialA : tubeMaterialB} color="#eaffd6" toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
      <instancedMesh ref={pools} args={[poolGeometry, undefined, 2]} renderOrder={2} raycast={() => null}>
        <meshBasicMaterial map={poolTexture()} transparent depthWrite={false} blending={AdditiveBlending} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
    </group>
  );
}

function Generator() {
  const mesh = useRef<Mesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => generatorGeometry(), []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), []);
  const base = useMemo(() => {
    const y = restSite(GENERATOR.x, GENERATOR.z, 0.35);
    return { x: GENERATOR.x, y, z: GENERATOR.z, yaw: aim(GENERATOR.x, GENERATOR.z, 0, 2) };
  }, []);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const motion = flicker.motion;
    if (mesh.current) {
      mesh.current.position.set(
        base.x + Math.sin(time * 61) * 0.006 * motion,
        base.y + Math.abs(Math.sin(time * 47)) * 0.008 * motion,
        base.z + Math.sin(time * 53 + 1) * 0.005 * motion,
      );
    }
    const target = puffs.current;
    if (target) {
      const exhaustX = base.x - Math.cos(base.yaw) * 0.34 - Math.sin(base.yaw) * 0.12;
      const exhaustZ = base.z + Math.sin(base.yaw) * 0.34 - Math.cos(base.yaw) * 0.12;
      for (let index = 0; index < 4; index++) {
        const life = (time * 0.5 + index / 4) % 1;
        dummy.position.set(exhaustX + life * 0.5, base.y + 0.62 + life * 1.3, exhaustZ + life * 0.3);
        dummy.scale.setScalar((0.06 + life * 0.22) * (life > 0.7 ? (1 - life) / 0.3 : 1) * motion);
        dummy.rotation.set(index, time * 0.4, 0);
        dummy.updateMatrix();
        target.setMatrixAt(index, dummy.matrix);
      }
      target.instanceMatrix.needsUpdate = true;
    }
    const blink = Math.sin(time * 2.2) > -0.6 ? 0.9 : 0.2;
    setGlow(GLOW.generator, base.x + Math.cos(base.yaw) * 0.33, base.y + 0.36, base.z - Math.sin(base.yaw) * 0.33, 0.24, GEN_LED, blink, 0.4);
  });
  return (
    <group>
      <mesh ref={mesh} geometry={geometry} material={material} rotation-y={base.yaw} castShadow receiveShadow />
      <instancedMesh ref={puffs} args={[undefined, undefined, 4]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8d8f88" roughness={1} flatShading transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function Console() {
  const texture = useMemo(() => consoleScreens().texture, []);
  const geometry = useMemo(() => screenGeometry(), []);
  const position = useMemo<[number, number, number]>(() => [CONSOLE.x, restSite(CONSOLE.x, CONSOLE.z, 0.6), CONSOLE.z], []);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // Dix images par seconde suffisent à un vieux moniteur, et seulement si l'on regarde.
    const camera = state.camera.position;
    const [ix, iz] = siteToIsland(CONSOLE.x, CONSOLE.z);
    const distance = Math.hypot(camera.x - ISLAND.position[0] - ix, camera.z - ISLAND.position[1] - iz);
    const frame = Math.floor(time * 10);
    const screens = consoleScreens();
    if (distance < 95 && frame !== screens.last) {
      screens.last = frame;
      drawScreens(screens.canvas, time);
      screens.texture.needsUpdate = true;
    }
    setGlow(GLOW.screens, position[0], position[1] + 1.0, position[2] - 0.05, 1.5, SCREEN_GLOW, 0.32, 0.05);
  });
  return (
    <mesh geometry={geometry} position={position} raycast={() => null}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function LandingLamp() {
  const material = useRef<MeshBasicMaterial>(null);
  const position: [number, number, number] = [0.4, LANDING.deck + 1.32, LANDING.to - 0.25];
  useFrame(() => {
    const level = flicker.lamp * (0.4 + skyState.dayNight * 1.4);
    material.current?.color.copy(LAMP_COLOR).multiplyScalar(0.5 + level);
    setGlow(GLOW.lamp, position[0], position[1], position[2], 1.1, LAMP_COLOR, flicker.lamp, 0.15);
  });
  return (
    <group position={position}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial ref={material} color="#ffd98a" toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 6, 1, true]} />
        <meshStandardMaterial color="#3b3a36" wireframe roughness={1} />
      </mesh>
    </group>
  );
}

function Tape() {
  const geometry = useMemo(() => buildTape(), []);
  const material = useMemo(() => tapeMaterial(), []);
  useFrame((state) => {
    tapeUniforms.uTapeTime.value = state.clock.elapsedTime * flicker.motion;
  });
  return <mesh geometry={geometry} material={material} castShadow={false} receiveShadow raycast={() => null} />;
}

function Rocks() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => rockGeometry(), []);
  const count = 15;
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const tint = new Color();
    for (let index = 0; index < count; index++) {
      let angle = (index / count) * Math.PI * 2 + hash(index * 3.1) * 0.35;
      // Rien sur le passage du ponton.
      if (Math.abs(Math.atan2(Math.sin(angle - ISLAND.dockAngle), Math.cos(angle - ISLAND.dockAngle))) < 0.35) angle += 0.6;
      const distance = ISLAND.radius * (0.86 + hash(index * 2.7) * 0.2);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const size = 0.32 + hash(index * 5.9) * 0.55;
      dummy.position.set(x, sampler(x, z) - size * 0.3, z);
      dummy.rotation.set((hash(index) - 0.5) * 0.5, hash(index * 7.3) * Math.PI * 2, (hash(index * 1.9) - 0.5) * 0.4);
      dummy.scale.set(size * 1.3, size, size);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, tint.set('#ffffff').multiplyScalar(0.82 + hash(index * 4.4) * 0.25));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [geometry]);
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} castShadow receiveShadow raycast={() => null}>
      <meshStandardMaterial color="#8f918a" roughness={0.95} flatShading />
    </instancedMesh>
  );
}

/** Le matériel posé dans la cour (repère du site). */
export function Equipment() {
  const statics = useMemo(() => buildStatics(), []);
  const cables = useMemo(() => buildCables(), []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true }), []);
  const cableMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), []);
  useEffect(() => () => {
    statics.geometry.dispose();
    cables.dispose();
  }, [cables, statics]);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pulse = Math.sin(time * 3.1) > 0.3 ? 1 : 0.25;
    setGlow(GLOW.sensor, SENSOR.x, restSite(SENSOR.x, SENSOR.z, 0.4) + 1.12, SENSOR.z, 0.22, SENSOR_LED, pulse, 0.5);
  });
  return (
    <group>
      <mesh geometry={statics.geometry} material={material} castShadow receiveShadow />
      <mesh geometry={cables} material={cableMaterial} receiveShadow raycast={() => null} />
      <Stands tops={statics.standTops} />
      <Generator />
      <Console />
      <LandingLamp />
      <Tape />
      <PaintedSign lines={['Accès interdit']} position={[1.05, restSite(1.05, 6.45, 0.3), 6.45]} rotation={0.2} accent="#d8b22a" width={1.4} post={1.0} />
    </group>
  );
}

/** Les rochers sont posés dans le repère de l'île (autour de la côte). */
export { Rocks };
