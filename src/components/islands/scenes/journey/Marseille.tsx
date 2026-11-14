'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { windowMaterial } from '@/lib/windows';
import { on } from '../../kit';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import { BOX, CONE8, CYL6, CYL8, CYL12, GABLE, ICO1, Kit, placeMatrix, roughen, SPHERE } from './geometry';
import { clothMaterial, flatPaint, smoothPaint, swayMaterial } from './materials';
import { FRAME_YAW } from './route';
import { channelCenter, channelHalfWidth, fromFrame, PORT, smooth } from './terrain';

/**
 * MARSEILLE, côté port : le Panier (façades ocre, rose, jaune, toits de tuiles, volets,
 * linge aux fenêtres), le Vieux-Port et ses quais, pointus et voiliers qui dansent,
 * le fort Saint-Jean à l'entrée, les lanternes dorées du soir.
 */

/* ================================================================== maisons */

interface House {
  u: number;
  v: number;
  /** Largeur de façade (m), profondeur, nombre d'étages. */
  w: number;
  d: number;
  floors: number;
  color: string;
  shutter: string;
  /** Rotation supplémentaire autour de y (0 : façade vers +u, le port et la caméra). */
  turn?: number;
}

const HOUSES: House[] = [
  // Front de mer, sur le quai du fond.
  { u: 3.3, v: 3.75, w: 1.3, d: 1.5, floors: 2, color: '#e7ab5b', shutter: '#4f8a63' },
  { u: 3.3, v: 5.0, w: 1.15, d: 1.5, floors: 3, color: '#eda4a0', shutter: '#5c7fa8' },
  { u: 3.3, v: 6.2, w: 1.25, d: 1.5, floors: 2, color: '#f2cf6a', shutter: '#4f8a63' },
  { u: 3.25, v: 7.4, w: 1.2, d: 1.4, floors: 3, color: '#ef9c76', shutter: '#6f9fb8' },
  { u: 3.35, v: 8.65, w: 1.3, d: 1.5, floors: 2, color: '#f4e4c4', shutter: '#5c7fa8' },
  // Seconde rangée, plus haute, derrière la rue qui monte.
  { u: -1.6, v: 4.45, w: 1.3, d: 1.4, floors: 3, color: '#dc8d60', shutter: '#5f9a7a' },
  { u: -1.65, v: 5.75, w: 1.2, d: 1.4, floors: 4, color: '#e9ba5c', shutter: '#5c7fa8' },
  { u: -1.6, v: 7.0, w: 1.3, d: 1.4, floors: 3, color: '#e6a3ab', shutter: '#4f8a63' },
  { u: -1.55, v: 8.3, w: 1.2, d: 1.4, floors: 3, color: '#f3dcb8', shutter: '#6f9fb8' },
  // Quai du Port : maisons tournées vers le bassin.
  { u: 8.0, v: 9.65, w: 1.3, d: 1.3, floors: 3, color: '#f0c46a', shutter: '#4f8a63', turn: -0.75 },
  { u: 9.45, v: 9.75, w: 1.3, d: 1.3, floors: 2, color: '#e99a85', shutter: '#5c7fa8', turn: -0.75 },
  { u: 10.9, v: 9.85, w: 1.25, d: 1.3, floors: 3, color: '#f5e6c8', shutter: '#4f8a63', turn: -0.75 },
];

const FLOOR = 0.92;
const WINDOW_W = 0.32;
const WINDOW_H = 0.46;

function bucketSeeds(count: number) {
  const seeds: number[] = [];
  const used = new Set<number>();
  for (let seed = 1; seeds.length < count && seed < 400; seed++) {
    const bucket = Math.floor(hash(seed * 7.13 + 0.5) * 7);
    if (used.has(bucket)) continue;
    used.add(bucket);
    seeds.push(seed);
  }
  return seeds;
}

/** Quatre heures d'allumage différentes pour les fenêtres du Panier. */
const WINDOW_SEEDS = bucketSeeds(4);
const PANE = new PlaneGeometry(WINDOW_W, WINDOW_H);

interface TownBuild {
  geometry: BufferGeometry;
  windows: Matrix4[][];
  lamps: Matrix4[];
  laundry: { start: [number, number, number]; end: [number, number, number] }[];
}

function houseFrame(house: House, sampler: HeightSampler) {
  const [x, z] = fromFrame(house.u, house.v);
  const y = groundAt(sampler, x, z, Math.max(house.w, house.d) * 0.5) - 0.05;
  const yaw = FRAME_YAW + (house.turn ?? 0);
  return { x, y, z, yaw, matrix: placeMatrix({ position: [x, y, z], rotation: [0, yaw, 0] }) };
}

function buildTown(sampler: HeightSampler): TownBuild {
  const kit = new Kit();
  const windows: Matrix4[][] = WINDOW_SEEDS.map(() => []);
  const lamps: Matrix4[] = [];
  const local = new Matrix4();
  const tint = new Color();

  HOUSES.forEach((house, index) => {
    const { x, y, z, yaw, matrix } = houseFrame(house, sampler);
    const height = house.floors * FLOOR + 0.3;
    const part = new Kit();
    const { w, d } = house;
    const front = d / 2;
    // Corps, soubassement, chaînages d'angle clairs.
    part.add(BOX, house.color, { position: [0, (height - 0.9) / 2, 0], scale: [w, height + 0.9, d] }, { jitter: 0.05, seed: index });
    part.add(BOX, tint.set(house.color).multiplyScalar(0.78).clone(), { position: [0, 0.16, 0], scale: [w + 0.03, 0.34, d + 0.03] });
    if (index % 3 === 0) {
      for (const side of [-1, 1]) part.add(BOX, '#efe4cf', { position: [side * (w / 2 - 0.04), height / 2, front - 0.04], scale: [0.1, height, 0.1] });
    }
    // Toit de tuiles et génoise sous l'avant-toit.
    part.add(GABLE, '#c4603a', { position: [0, height, 0], scale: [w + 0.24, 0.42, d + 0.32] }, { jitter: 0.12, seed: index * 3 });
    part.add(BOX, '#f1e4c9', { position: [0, height - 0.05, front + 0.07], scale: [w + 0.14, 0.1, 0.12] });
    part.add(BOX, '#c97a4f', { position: [0, height - 0.13, front + 0.05], scale: [w + 0.1, 0.05, 0.08] });
    if (index % 2 === 0) part.add(BOX, '#d9cbb5', { position: [w * 0.25, height + 0.3, -d * 0.15], scale: [0.22, 0.5, 0.22] });
    // Porte au rez-de-chaussée.
    const doorX = w > 1.2 ? -w * 0.22 : 0;
    const doors = ['#2f5a46', '#2f4f7a', '#6b4a33', '#7a2f35'];
    part.add(BOX, doors[index % doors.length], { position: [doorX, 0.4, front + 0.02], scale: [0.36, 0.78, 0.04] });
    part.add(BOX, '#efe4cf', { position: [doorX, 0.82, front + 0.03], scale: [0.46, 0.07, 0.05] });
    // Fenêtres : volets ouverts, appuis, balcons et géraniums par endroits.
    const columns = w > 1.2 ? [-w * 0.24, w * 0.24] : [0];
    for (let floor = 0; floor < house.floors; floor++) {
      const wy = 0.5 + floor * FLOOR;
      columns.forEach((wx, column) => {
        if (floor === 0 && Math.abs(wx - doorX) < 0.3) return;
        const key = index * 17 + floor * 5 + column;
        local.makeTranslation(wx, wy, front + 0.012);
        windows[Math.floor(hash(key * 2.7) * windows.length)].push(matrix.clone().multiply(local));
        part.add(BOX, '#f2ebdf', { position: [wx, wy, front + 0.006], scale: [WINDOW_W + 0.08, WINDOW_H + 0.08, 0.01] });
        for (const side of [-1, 1]) {
          part.add(BOX, house.shutter, { position: [wx + side * (WINDOW_W / 2 + 0.1), wy, front + 0.04], rotation: [0, side * 0.35, 0], scale: [0.17, WINDOW_H, 0.025] });
        }
        part.add(BOX, '#e8dcc6', { position: [wx, wy - WINDOW_H / 2 - 0.03, front + 0.05], scale: [WINDOW_W + 0.12, 0.04, 0.1] });
        const r = hash(key * 3.3);
        if (floor > 0 && r > 0.72) {
          part.add(BOX, '#2d2a30', { position: [wx, wy - WINDOW_H / 2 - 0.02, front + 0.13], scale: [WINDOW_W + 0.2, 0.03, 0.24] });
          part.add(BOX, '#2d2a30', { position: [wx, wy - WINDOW_H / 2 + 0.1, front + 0.25], scale: [WINDOW_W + 0.2, 0.2, 0.012] });
        } else if (r > 0.45) {
          part.add(BOX, '#c4673d', { position: [wx, wy - WINDOW_H / 2 + 0.02, front + 0.08], scale: [WINDOW_W, 0.07, 0.08] });
          part.add(SPHERE, r > 0.6 ? '#d8423a' : '#e86aa0', { position: [wx, wy - WINDOW_H / 2 + 0.09, front + 0.09], scale: [WINDOW_W * 0.55, 0.06, 0.06] }, { jitter: 0.3, seed: key });
        }
      });
    }
    // Bougainvillée qui grimpe à l'angle de quelques maisons.
    if (index === 1 || index === 6 || index === 10) {
      for (let k = 0; k < 6; k++) {
        part.add(roughen(ICO1, 0.3, k + index), k % 2 ? '#d1408f' : '#b52f7c', {
          position: [w / 2 - 0.02, 0.4 + k * 0.32, front - 0.02 - (k % 3) * 0.06],
          scale: [0.2, 0.22, 0.16],
        }, { jitter: 0.25, seed: k });
      }
      part.add(BOX, '#5b7a3a', { position: [w / 2 + 0.01, 0.9, front - 0.05], scale: [0.04, 1.8, 0.04] });
    }
    kit.merge(part, { position: [x, y, z], rotation: [0, yaw, 0] });
  });

  // Lanternes du port et de la rue (têtes lumineuses à part).
  const lampSpots: [number, number][] = [[5.0, 3.0], [5.0, 5.6], [7.6, 7.6], [10.2, 7.6], [12.0, 7.3], [0.5, 6.7], [-0.2, 3.9]];
  lampSpots.forEach(([u, v]) => {
    const [x, z] = fromFrame(u, v);
    const y = groundAt(sampler, x, z, 0.2) - 0.03;
    kit.add(CYL8, '#2c2d33', { position: [x, y + 0.12, z], scale: [0.12, 0.24, 0.12] });
    kit.add(CYL6, '#2c2d33', { position: [x, y + 0.95, z], scale: [0.045, 1.7, 0.045] });
    kit.add(CONE8, '#2c2d33', { position: [x, y + 2.07, z], scale: [0.17, 0.16, 0.17] });
    lamps.push(placeMatrix({ position: [x, y + 1.9, z] }));
  });

  // Fils à linge en travers de la rue.
  const laundry: TownBuild['laundry'] = [];
  for (const [a, b] of [[2, 7], [3, 8]] as const) {
    const ha = houseFrame(HOUSES[a], sampler);
    const hb = houseFrame(HOUSES[b], sampler);
    const ya = ha.y + FLOOR * 1.75;
    const yb = hb.y + FLOOR * 1.75;
    const [ax, az] = fromFrame(HOUSES[a].u - HOUSES[a].d / 2, HOUSES[a].v);
    const [bx, bz] = fromFrame(HOUSES[b].u + HOUSES[b].d / 2, HOUSES[b].v);
    laundry.push({ start: [ax, ya, az], end: [bx, yb, bz] });
  }
  return { geometry: kit.build(), windows, lamps, laundry };
}

function WindowSet({ matrices, seed }: { matrices: Matrix4[]; seed: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useMemo(() => windowMaterial(seed, '#ffc46b', '#3d5a73', 2.4), [seed]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    matrices.forEach((matrix, index) => target.setMatrixAt(index, matrix));
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [matrices]);
  if (matrices.length === 0) return null;
  return <instancedMesh ref={mesh} args={[PANE, material, matrices.length]} raycast={() => null} />;
}

/* ============================================================ lanternes */

const LAMP_GLOW = new MeshStandardMaterial({ color: '#fff1cf', emissive: '#ffbe62', emissiveIntensity: 0.3, roughness: 0.4 });
const LAMP_HEAD = new SphereGeometry(0.15, 10, 8);

function Lamps({ matrices }: { matrices: Matrix4[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    matrices.forEach((matrix, index) => target.setMatrixAt(index, matrix));
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [matrices]);
  useFrame((state) => {
    const night = skyState.dayNight;
    LAMP_GLOW.emissiveIntensity = 0.25 + smooth(0.1, 0.5, night) * 3.2 + Math.sin(state.clock.elapsedTime * 3.1) * 0.05 * night;
  });
  return <instancedMesh ref={mesh} args={[LAMP_HEAD, LAMP_GLOW, matrices.length]} raycast={() => null} />;
}

/* ============================================================ linge */

/**
 * Cordes et vêtements en une géométrie : l'attribut `aFree` (0 à l'attache, 1 au bord
 * libre) règle l'ampleur du balancement (voir swayMaterial).
 */
function laundryGeometry(lines: TownBuild['laundry']) {
  const parts: BufferGeometry[] = [];
  const colors = ['#f4f1ea', '#e85d5d', '#5b8fd6', '#f2c14e', '#7fc6a4', '#f4f1ea', '#e98bb7'];
  const tint = new Color();
  const push = (geometry: BufferGeometry, color: string, free: (y: number) => number, place: Parameters<typeof placeMatrix>[0]) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    part.deleteAttribute('uv');
    const positions = part.attributes.position;
    const freeArray = new Float32Array(positions.count);
    const colorArray = new Float32Array(positions.count * 3);
    tint.set(color);
    for (let index = 0; index < positions.count; index++) {
      freeArray[index] = free(positions.getY(index));
      colorArray.set([tint.r, tint.g, tint.b], index * 3);
    }
    part.setAttribute('aFree', new BufferAttribute(freeArray, 1));
    part.setAttribute('color', new BufferAttribute(colorArray, 3));
    part.applyMatrix4(placeMatrix(place));
    parts.push(part);
  };
  lines.forEach(({ start, end }, line) => {
    const [ax, ay, az] = start;
    const [bx, by, bz] = end;
    const length = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bz - az, bx - ax);
    const sag = (t: number) => Math.sin(t * Math.PI) * 0.18;
    for (let k = 0; k < 6; k++) {
      const t0 = k / 6;
      const t1 = (k + 1) / 6;
      const p0 = [ax + (bx - ax) * t0, ay + (by - ay) * t0 - sag(t0), az + (bz - az) * t0];
      const p1 = [ax + (bx - ax) * t1, ay + (by - ay) * t1 - sag(t1), az + (bz - az) * t1];
      push(new PlaneGeometry(1, 1).rotateX(Math.PI / 2), '#efe9dc', () => 0, {
        position: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2],
        rotation: [0, -yaw, Math.atan2(p1[1] - p0[1], Math.hypot(p1[0] - p0[0], p1[2] - p0[2]))],
        scale: [length / 6 + 0.02, 1, 0.025],
      });
    }
    const items = 5;
    for (let k = 0; k < items; k++) {
      const t = (k + 0.6) / (items + 0.2);
      const width = 0.22 + hash(line * 9 + k) * 0.16;
      const height = 0.26 + hash(line * 5 + k * 3) * 0.2;
      const cloth = new PlaneGeometry(width, height, 2, 3).translate(0, -height / 2, 0);
      push(cloth, colors[(line * 3 + k) % colors.length], (y) => Math.min(1, -y / height), {
        position: [ax + (bx - ax) * t, ay + (by - ay) * t - sag(t), az + (bz - az) * t],
        rotation: [0, -yaw, 0],
      });
    }
  });
  const merged = mergeGeometries(parts) ?? new BufferGeometry();
  merged.computeVertexNormals();
  return merged;
}

const LAUNDRY_MATERIAL = swayMaterial(0.08);

/* ================================================================== quais */

function buildQuays() {
  const kit = new Kit();
  // Bord du bassin : quai du fond (u = u0), coin arrondi, quai du Port (v = v1).
  const r = 1.2;
  const path: [number, number, number][] = [];
  const start = channelCenter(PORT.u0) + channelHalfWidth(PORT.u0) - 0.3;
  for (let v = start; v <= PORT.v1 - r; v += 0.5) path.push([PORT.u0, v, 0]);
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * (-Math.PI / 2);
    path.push([PORT.u0 + r + Math.cos(a) * r, PORT.v1 - r - Math.sin(a) * r, 0]);
  }
  for (let u = PORT.u0 + r + 0.5; u <= 14.2; u += 0.5) path.push([u, PORT.v1, 0]);
  const coping = new Color('#ebdfc8');
  const face = new Color('#bcae93');
  for (let index = 0; index < path.length - 1; index++) {
    const [u0, v0] = path[index];
    const [u1, v1] = path[index + 1];
    const [x0, z0] = fromFrame(u0, v0);
    const [x1, z1] = fromFrame(u1, v1);
    const length = Math.hypot(x1 - x0, z1 - z0);
    const yaw = -Math.atan2(z1 - z0, x1 - x0);
    // Normale vers l'eau (à droite du sens de parcours dans le repère u, v).
    const du = (u1 - u0) / (length || 1);
    const dv = (v1 - v0) / (length || 1);
    const [ox, oz] = fromFrame(dv * 0.12, -du * 0.12);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    kit.add(BOX, coping.clone().multiplyScalar(0.92 + hash(index * 1.7) * 0.12), {
      position: [cx - ox * 0.4, PORT.quay + 0.05, cz - oz * 0.4],
      rotation: [0, yaw, 0],
      scale: [length + 0.03, 0.12, 0.36],
    });
    kit.add(BOX, face, { position: [cx + ox * 0.6, PORT.quay - 0.68, cz + oz * 0.6], rotation: [0, yaw, 0], scale: [length + 0.03, 1.5, 0.16] }, {
      jitter: 0.08,
      seed: index,
      paint: (_x, y, _z, out) => out.copy(face).lerp(new Color('#7f8467'), 1 - smooth(-0.3, 0.35, y)),
    });
    if (index % 3 === 1) {
      const [bx, bz] = [cx - ox * 1.7, cz - oz * 1.7];
      kit.add(CYL8, '#4a4d55', { position: [bx, PORT.quay + 0.2, bz], scale: [0.09, 0.26, 0.09] });
      kit.add(SPHERE, '#4a4d55', { position: [bx, PORT.quay + 0.33, bz], scale: [0.1, 0.06, 0.1] });
    }
  }
  return kit.build();
}

/* ================================================================== fort */

const FORT = { u: 13.6, v: 7.9 };

function buildFort() {
  const kit = new Kit();
  const stone = '#e8d8b9';
  // Donjon carré crénelé, tour ronde du Fanal, courtine.
  kit.add(BOX, stone, { position: [0, 0.6, 0], scale: [1.8, 2.4, 1.8] }, { jitter: 0.06, seed: 1 });
  for (let k = 0; k < 12; k++) {
    const side = Math.floor(k / 3);
    const t = ((k % 3) - 1) * 0.6;
    const [x, z] = [[t, 0.85], [0.85, t], [t, -0.85], [-0.85, t]][side];
    kit.add(BOX, stone, { position: [x, 1.92, z], scale: [0.3, 0.26, 0.3] });
  }
  kit.add(BOX, '#d9c7a5', { position: [0, 1.76, 0], scale: [1.9, 0.08, 1.9] });
  kit.add(CYL12, stone, { position: [1.3, 0.9, 1.0], scale: [0.55, 3.0, 0.55] }, { jitter: 0.05, seed: 2 });
  kit.add(CYL12, '#d9c7a5', { position: [1.3, 2.46, 1.0], scale: [0.62, 0.12, 0.62] });
  kit.add(CYL8, '#f3eadb', { position: [1.3, 2.78, 1.0], scale: [0.32, 0.5, 0.32] });
  kit.add(CONE8, '#9a6b48', { position: [1.3, 3.2, 1.0], scale: [0.4, 0.36, 0.4] });
  kit.add(BOX, stone, { position: [-1.3, 0.25, 0.7], rotation: [0, 0.3, 0], scale: [1.6, 1.3, 0.5] }, { jitter: 0.06, seed: 3 });
  // Meurtrières et porte.
  for (const [x, y] of [[-0.4, 0.9], [0.4, 0.9], [0, 1.4]] as const) kit.add(BOX, '#5a4f45', { position: [x, y, 0.91], scale: [0.08, 0.26, 0.02] });
  kit.add(BOX, '#5a4f45', { position: [0, 0.2, 0.91], scale: [0.4, 0.55, 0.02] });
  // Mât du drapeau.
  kit.add(CYL6, '#ece6da', { position: [-0.5, 2.6, -0.5], scale: [0.03, 1.6, 0.03] });
  return kit.build();
}

let marseilleFlag: CanvasTexture | null = null;

/** Drapeau de Marseille : blanc à croix bleu azur. */
function marseilleFlagTexture() {
  if (marseilleFlag) return marseilleFlag;
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f5ef';
  ctx.fillRect(0, 0, 192, 128);
  ctx.fillStyle = '#2f73c4';
  ctx.fillRect(0, 50, 192, 28);
  ctx.fillRect(68, 0, 28, 128);
  marseilleFlag = new CanvasTexture(canvas);
  marseilleFlag.colorSpace = SRGBColorSpace;
  return marseilleFlag;
}

function Fort({ sampler }: { sampler: HeightSampler }) {
  const geometry = useMemo(() => buildFort(), []);
  const cloth = useMemo(() => new PlaneGeometry(0.9, 0.6, 10, 4).translate(0.45, 0, 0), []);
  const material = useMemo(() => clothMaterial({ map: marseilleFlagTexture(), length: 0.9, amplitude: 0.09 }), []);
  const [x, z] = fromFrame(FORT.u, FORT.v);
  const base = on(sampler, x, z, 1.0, 0.25);
  return (
    <group position={base} rotation-y={FRAME_YAW - 0.35}>
      <mesh geometry={geometry} material={flatPaint} castShadow receiveShadow />
      <mesh geometry={cloth} material={material} position={[-0.47, 3.08, -0.5]} castShadow />
    </group>
  );
}

/* ================================================================== bateaux */

function hull(length: number, beam: number, depth: number, pointedStern: boolean) {
  const geometry = new SphereGeometry(1, 16, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    let y = positions.getY(index);
    let z = positions.getZ(index);
    const end = pointedStern ? Math.abs(x) : Math.max(0, x);
    z *= 1 - end * end * 0.62;
    y = y * depth + (Math.abs(y) < 0.02 ? x * x * 0.12 : 0);
    positions.setXYZ(index, (x * length) / 2, y, z * (beam / 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function sailboat(trim: string) {
  const kit = new Kit();
  kit.add(hull(2.3, 0.82, 0.42, false), '#f6f4ee', {}, {
    paint: (_x, y, _z, out) => (y < -0.25 ? out.set('#2c3e5c') : y < -0.17 ? out.set(trim) : out.set('#f6f4ee')),
  });
  kit.add(CYL12, '#c9a477', { position: [0, 0.01, 0], scale: [1.08, 0.03, 0.37] });
  kit.add(BOX, '#f6f4ee', { position: [-0.15, 0.16, 0], scale: [0.8, 0.26, 0.5] });
  kit.add(BOX, '#3c5674', { position: [-0.15, 0.2, 0.256], scale: [0.6, 0.08, 0.01] });
  kit.add(BOX, '#3c5674', { position: [-0.15, 0.2, -0.256], scale: [0.6, 0.08, 0.01] });
  kit.add(CYL6, '#e9ecef', { position: [0.25, 1.65, 0], scale: [0.03, 3.3, 0.03] });
  kit.add(CYL6, '#d9dde2', { position: [-0.3, 0.55, 0], rotation: [0, 0, Math.PI / 2], scale: [0.025, 1.1, 0.025] });
  kit.add(CYL8, trim, { position: [-0.3, 0.6, 0], rotation: [0, 0, Math.PI / 2], scale: [0.07, 1.0, 0.07] });
  return kit.build();
}

function pointu(band: string, inner: string) {
  const kit = new Kit();
  kit.add(hull(1.85, 0.72, 0.36, true), '#f7f3ea', {}, {
    paint: (_x, y, _z, out) => (y > -0.06 ? out.set(band) : y < -0.27 ? out.set('#8a4b35') : out.set('#f7f3ea')),
  });
  kit.add(CYL12, inner, { position: [0, 0.01, 0], scale: [0.86, 0.03, 0.3] });
  kit.add(BOX, '#b98c5c', { position: [0.1, 0.06, 0], scale: [0.14, 0.05, 0.62] });
  // Étrave haute caractéristique du pointu.
  kit.add(BOX, band, { position: [0.98, 0.16, 0], rotation: [0, 0, -0.35], scale: [0.06, 0.32, 0.05] });
  kit.add(CYL6, '#8a6040', { position: [0.25, 0.75, 0], scale: [0.03, 1.5, 0.03] });
  kit.add(CYL6, '#8a6040', { position: [0.05, 1.25, 0], rotation: [0, 0, 1.1], scale: [0.022, 1.5, 0.022] });
  return kit.build();
}

interface Mooring {
  u: number;
  v: number;
  /** Cap de la proue dans le repère (u, v). */
  bowU: number;
  bowV: number;
  kind: 'sail' | 'pointu';
  colors: [string, string];
}

const MOORINGS: Mooring[] = [
  { u: 8.3, v: 5.1, bowU: 0, bowV: -1, kind: 'sail', colors: ['#2f6fb3', ''] },
  { u: 9.35, v: 5.35, bowU: 0, bowV: -1, kind: 'pointu', colors: ['#d9473b', '#3e7fc1'] },
  { u: 10.35, v: 5.1, bowU: 0, bowV: -1, kind: 'sail', colors: ['#c2453a', ''] },
  { u: 11.4, v: 5.35, bowU: 0, bowV: -1, kind: 'pointu', colors: ['#3e8f5e', '#f2c14e'] },
  { u: 7.85, v: 3.35, bowU: 1, bowV: 0, kind: 'pointu', colors: ['#2f73c4', '#f4f1ea'] },
  { u: 12.5, v: 5.0, bowU: 0, bowV: -1, kind: 'sail', colors: ['#3a8a8a', ''] },
];

function Boat({ mooring, index }: { mooring: Mooring; index: number }) {
  const geometry = useMemo(
    () => (mooring.kind === 'sail' ? sailboat(mooring.colors[0]) : pointu(mooring.colors[0], mooring.colors[1])),
    [mooring],
  );
  const group = useRef<Group>(null);
  const [x, z] = fromFrame(mooring.u, mooring.v);
  // Proue (+x local) vers la direction (bowU, bowV).
  const [dx, dz] = fromFrame(mooring.bowU, mooring.bowV);
  const yaw = -Math.atan2(dz, dx);
  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const t = state.clock.elapsedTime + index * 1.7;
    target.position.y = 0.08 + Math.sin(t * 1.1) * 0.035;
    target.rotation.x = Math.sin(t * 0.9) * 0.06;
    target.rotation.z = Math.sin(t * 0.7 + 1.3) * 0.025;
  });
  return (
    <group position={[x, 0.08, z]} rotation-y={yaw}>
      <group ref={group}>
        <mesh geometry={geometry} material={smoothPaint} castShadow />
      </group>
    </group>
  );
}

/* ================================================================== racine */

export function Marseille({ sampler }: { sampler: HeightSampler }) {
  const town = useMemo(() => buildTown(sampler), [sampler]);
  const quays = useMemo(() => buildQuays(), []);
  const laundry = useMemo(() => laundryGeometry(town.laundry), [town]);
  return (
    <group>
      <mesh geometry={town.geometry} material={flatPaint} castShadow receiveShadow />
      {town.windows.map((matrices, index) => (
        <WindowSet key={WINDOW_SEEDS[index]} matrices={matrices} seed={WINDOW_SEEDS[index]} />
      ))}
      <Lamps matrices={town.lamps} />
      <mesh geometry={laundry} material={LAUNDRY_MATERIAL} castShadow raycast={() => null} />
      <mesh geometry={quays} material={flatPaint} receiveShadow />
      <Fort sampler={sampler} />
      {MOORINGS.map((mooring, index) => (
        <Boat key={`${mooring.u}:${mooring.v}`} mooring={mooring} index={index} />
      ))}
    </group>
  );
}
