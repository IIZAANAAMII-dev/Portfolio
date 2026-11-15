'use client';

import { useMemo } from 'react';
import { MeshStandardMaterial, Vector3 } from 'three';
import type { HeightSampler } from '../terrain-shape';
import { bevelBox, MeshBuilder, perFace, pose, type Vec3 } from './shapes';

/**
 * L'annexe tirée au sec : une petite plate de pêcheur breton, coque bleue au liston crème
 * et aux œuvres vives rouges, intérieur verni, deux bancs et une paire d'avirons posés en
 * travers. Elle repose de guingois sur le sable, l'étrave tournée vers l'île. Un seul
 * maillage peint par sommet (un draw call), facettes nettes.
 * Repère : étrave vers +x, origine sous le milieu de la quille.
 */

const BLUE = '#2f6c9e';
const LISTON = '#efe6d2';
const ANTIFOULING = '#b5473a';
const VARNISH = '#c4955f';
const FLOOR = '#a97a4c';
const THWART = '#93653f';
const OAR = '#eadcc0';
const BLADE = '#c9553f';

const STERN = -1.0;
const BOW = 1.06;
const SKIN = 0.035;

/** Demi-largeur au plat-bord : tableau arrière franc, étrave fine. */
function beam(x: number) {
  return 0.5 * (x < 0 ? 1 - 0.24 * (x / STERN) ** 2 : Math.sqrt(Math.max(0, 1 - (x / BOW) ** 2)));
}
/** Tonture : le plat-bord remonte vers l'étrave. */
function sheer(x: number) {
  return 0.42 + 0.11 * Math.max(0, x / BOW) ** 2 + 0.03 * Math.max(0, x / STERN);
}
/** Quille : le pied d'étrave se relève. */
function keel(x: number) {
  return 0.17 * Math.max(0, (x - 0.3) / (BOW - 0.3)) ** 2;
}

/** Section de coque à l'abscisse x : plat-bord, bouchain, quille, bouchain, plat-bord. */
function section(x: number, inset = 0): Vec3[] {
  const w = Math.max(0, beam(x) - inset);
  const top = sheer(x);
  const bottom = keel(x) + inset;
  const chine = bottom + (top - bottom) * 0.3;
  return [
    [x, top, w],
    [x, chine + inset * 0.3, Math.max(0, w * 0.8 - inset * 0.2)],
    [x, bottom, 0],
    [x, chine + inset * 0.3, -Math.max(0, w * 0.8 - inset * 0.2)],
    [x, top, -w],
  ];
}

const p = new Vector3();
const q = new Vector3();
const r = new Vector3();
const n = new Vector3();
const toward = new Vector3();

/** Triangle orienté : sa normale s'éloigne de `from` (ou s'en approche si `facing`). */
function oriented(builder: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, color: string | ReturnType<typeof perFace>, from: Vec3, facing = false) {
  p.set(...a);
  q.set(...b);
  r.set(...c);
  n.subVectors(q, p).cross(toward.subVectors(r, p));
  toward.set((a[0] + b[0] + c[0]) / 3 - from[0], (a[1] + b[1] + c[1]) / 3 - from[1], (a[2] + b[2] + c[2]) / 3 - from[2]);
  const outward = n.dot(toward) >= 0;
  if (outward !== facing) builder.triangle(a, b, c, color);
  else builder.triangle(a, c, b, color);
}

function dinghyGeometry() {
  const builder = new MeshBuilder();
  const stations = [STERN, -0.78, -0.45, -0.1, 0.25, 0.55, 0.8, 0.96, BOW];
  // Bordé extérieur : liston crème sous le plat-bord, bleu, œuvres vives rouges.
  const hull = perFace((x, y, _z, _ny, out) => {
    const top = sheer(x);
    out.set(y > top - 0.075 ? LISTON : y < keel(x) + (top - keel(x)) * 0.24 ? ANTIFOULING : BLUE);
  });
  const inside = perFace((x, y, _z, ny, out) => {
    out.set(ny > 0.75 || y < keel(x) + 0.09 ? FLOOR : VARNISH);
  });
  for (let index = 0; index < stations.length - 1; index++) {
    const a = section(stations[index]);
    const b = section(stations[index + 1]);
    const ai = section(stations[index], SKIN);
    const bi = section(stations[index + 1], SKIN);
    const mid = (stations[index] + stations[index + 1]) / 2;
    const axis: Vec3 = [mid, sheer(mid) * 0.55, 0];
    const above: Vec3 = [mid, sheer(mid) + 0.9, 0];
    for (let k = 0; k < 4; k++) {
      oriented(builder, a[k], b[k], b[k + 1], hull, axis);
      oriented(builder, a[k], b[k + 1], a[k + 1], hull, axis);
      oriented(builder, ai[k], bi[k], bi[k + 1], inside, above, true);
      oriented(builder, ai[k], bi[k + 1], ai[k + 1], inside, above, true);
    }
    // Plat-bord : la tranche claire qui dessine la silhouette vue d'en haut.
    for (const [outer, inner] of [[0, 0], [4, 4]] as const) {
      builder.triangleUp(a[outer], b[outer], bi[inner], LISTON);
      builder.triangleUp(a[outer], bi[inner], ai[inner], LISTON);
    }
  }
  // Tableau arrière : bleu dehors, verni dedans (faces opposées d'un même plan).
  const transom = section(STERN);
  const transomIn = section(STERN, SKIN);
  const centre: Vec3 = [STERN, sheer(STERN) * 0.5, 0];
  const ahead: Vec3 = [STERN + 1, centre[1], 0];
  for (let k = 0; k < 4; k++) {
    oriented(builder, centre, transom[k], transom[k + 1], BLUE, ahead);
    oriented(builder, centre, transomIn[k], transomIn[k + 1], VARNISH, ahead, true);
  }
  // Bancs.
  for (const [x, depth] of [[-0.62, 0.22], [0.22, 0.18]] as const) {
    const y = sheer(x) - 0.13;
    const width = (beam(x) - SKIN) * 2 * 0.97;
    builder.add(bevelBox(depth, 0.04, width, 0.01), THWART, pose([x, y, 0]), 0.25);
  }
  // Avirons croisés sur les bancs, pelles rouges vers l'arrière.
  for (const side of [-1, 1]) {
    const yaw = side * 0.09;
    const at: Vec3 = [-0.12, sheer(-0.1) - 0.07 + (side > 0 ? 0.035 : 0), side * 0.11];
    builder.add(bevelBox(1.75, 0.035, 0.035, 0.006), OAR, pose(at, [0, yaw, 0]), 0.2);
    const blade: Vec3 = [at[0] - Math.cos(yaw) * 0.95, at[1], at[2] + Math.sin(yaw) * 0.95];
    builder.add(bevelBox(0.42, 0.014, 0.12, 0.004), BLADE, pose(blade, [0, yaw, 0]), 0.2);
  }
  // Anneau d'étrave et bout d'amarre lové.
  builder.add(bevelBox(0.05, 0.05, 0.05, 0.01), '#33393f', pose([BOW - 0.04, sheer(BOW) - 0.05, 0]), 0.2);
  return builder.build()!;
}

const GEOMETRY = dinghyGeometry();
const MATERIAL = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
MATERIAL.name = 'dinghy';

/**
 * L'annexe posée sur le sable en (x, z), étrave orientée selon `yaw` (repère du parent).
 * Assiette et gîte suivent la pente de la plage ; `heel` ajoute une gîte (radians).
 */
export function Dinghy({ sampler, x, z, yaw, heel = 0 }: { sampler: HeightSampler; x: number; z: number; yaw: number; heel?: number }) {
  const placement = useMemo(() => {
    // Axes de la coque dans le repère du parent : étrave (+x local) et bâbord (+z local).
    const ax = Math.cos(yaw);
    const az = -Math.sin(yaw);
    const bow = sampler(x + ax * 0.9, z + az * 0.9);
    const stern = sampler(x - ax * 0.9, z - az * 0.9);
    const port = sampler(x - az * 0.45, z + ax * 0.45);
    const starboard = sampler(x + az * 0.45, z - ax * 0.45);
    const ground = (sampler(x, z) * 2 + bow + stern) / 4;
    return {
      y: ground - 0.08,
      pitch: Math.atan2(bow - stern, 1.8),
      // Couchée sur son bouchain, côté aval de la pente.
      roll: -Math.atan2(port - starboard, 0.9) * 0.85,
    };
  }, [sampler, x, yaw, z]);
  return (
    <group position={[x, placement.y, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={GEOMETRY} material={MATERIAL} rotation={[placement.roll + heel, 0, placement.pitch]} castShadow receiveShadow raycast={() => null} />
    </group>
  );
}
