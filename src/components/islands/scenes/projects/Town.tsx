'use client';

import { useEffect, useMemo } from 'react';
import { CanvasTexture, CylinderGeometry, MeshStandardMaterial, RingGeometry, SRGBColorSpace } from 'three';
import { hash } from '@/lib/utils/math';
import { ClearingAt } from '../../kit';
import { Maquette, pose, type V3 } from './builder';
import { DAIS, PLAZA, PLAZA_LANTERNS, ROAD, SHIPYARD, SITES, STAIRS, TOWN, WALK, sitePosition } from './layout';
import { lampGlow, paint } from './materials';

/**
 * L'espace public de la ville : la place pavée en rosace, la rue circulaire et ses
 * trottoirs, la rue du port et l'escalier taillé dans la falaise, les lampadaires, les
 * arbres (pins parasols, oliviers, cyprès : on est à Marseille), les bancs et les jardinières.
 * Tout ce qui est immobile tient en trois draw calls.
 */

const Y = TOWN.level;
/** Hauteur des trottoirs et de la place au-dessus de la chaussée. */
export const CURB = 0.1;
export const TOP = Y + CURB;

export const STONE = '#ead9bb';
export const STONE_DARK = '#cdb48d';
const ASPHALT = '#6b6f80';
export const IRON = '#36403f';

/* ------------------------------------------------------------- dallage de la place */

function plazaTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const scale = c / PLAZA.radius;
  ctx.fillStyle = '#e3d1b0';
  ctx.fillRect(0, 0, size, size);
  // Anneaux de pavés en secteurs, deux tons qui alternent, joints clairs.
  const rings = [3.0, 3.5, 4.05, 4.6, 5.15, 5.7, 6.2, PLAZA.radius];
  const tones = ['#ecdcbf', '#e0caa4', '#e8d5b4', '#dcc39a'];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const inner = rings[ring] * scale;
    const outer = rings[ring + 1] * scale;
    const sectors = 28 + ring * 6;
    for (let sector = 0; sector < sectors; sector++) {
      const a0 = (sector / sectors) * Math.PI * 2 + ring * 0.13;
      const a1 = ((sector + 1) / sectors) * Math.PI * 2 + ring * 0.13;
      ctx.fillStyle = ring === 5 ? (sector % 2 ? '#d9875a' : '#e49a6c') : tones[(sector + ring) % tones.length];
      ctx.beginPath();
      ctx.arc(c, c, outer, a0, a1);
      ctx.arc(c, c, inner, a1, a0, true);
      ctx.closePath();
      ctx.fill();
      // Petite variation par pavé.
      ctx.fillStyle = `rgba(120, 80, 40, ${hash(ring * 31 + sector * 1.7) * 0.07})`;
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255, 248, 232, 0.75)';
  ctx.lineWidth = 3;
  for (const radius of rings) {
    ctx.beginPath();
    ctx.arc(c, c, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Fin liseré violet (le centre cyber) au pied de la plateforme.
  ctx.strokeStyle = '#8b6bff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(c, c, (DAIS.radius + 0.28) * scale, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------------ mobilier urbain */

/** Lampadaire en fonte : le globe lumineux (centre) est à l'altitude `globeY`. */
export function lamp(m: Maquette, globes: Maquette, base: V3, globeY: number, warm: boolean) {
  const [x, y, z] = base;
  const top = globeY - 0.2;
  m.cylinder(0.13, 0.17, 0.22, [x, y + 0.11, z], IRON, 8);
  m.cylinder(0.045, 0.06, top - y - 0.2, [x, (y + 0.2 + top) / 2, z], IRON, 6);
  m.cylinder(0.09, 0.05, 0.14, [x, top - 0.02, z], IRON, 8);
  m.cone(0.2, 0.16, [x, globeY + 0.24, z], IRON, 8);
  m.sphere(0.04, [x, globeY + 0.35, z], IRON, 0);
  globes.sphere(0.165, [x, globeY, z], warm ? '#ffd38a' : '#c8fff4', 1);
}

/** Banc : dossier côté +Z local, assise tournée vers -Z. */
export function bench(m: Maquette, at: V3, rotationY: number) {
  const [x, y, z] = at;
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const local = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  for (const lx of [-0.42, 0.42]) {
    m.box([0.06, 0.34, 0.36], local(lx, 0.17, 0), IRON, [0, rotationY, 0]);
  }
  const slats: [number, number, number][] = [
    [-0.12, 0.36, 0],
    [0.04, 0.36, 0],
    [0.17, 0.53, -0.28],
    [0.2, 0.68, -0.28],
  ];
  for (const [lz, ly, tilt] of slats) {
    m.box([1.0, 0.045, 0.12], local(0, ly, lz), '#b07a4f', [tilt === 0 ? 0 : Math.PI / 2 + tilt, rotationY, 0]);
  }
}

/** Pin parasol : tronc penché, houppier plat en plusieurs coussins. */
function umbrellaPine(m: Maquette, at: V3, seed: number, size = 1) {
  const [x, y, z] = at;
  const lean = 0.25 + hash(seed) * 0.25;
  const dir = hash(seed * 3.1) * Math.PI * 2;
  const height = (3.3 + hash(seed * 1.7) * 0.8) * size;
  const topX = x + Math.cos(dir) * lean * height * 0.5;
  const topZ = z + Math.sin(dir) * lean * height * 0.5;
  m.rod([x, y - 0.1, z], [topX, y + height, topZ], 0.13 * size, '#7a5238', 6);
  const greens = ['#4f8a46', '#5c9a4c', '#44793f'];
  for (let puff = 0; puff < 5; puff++) {
    const a = (puff / 5) * Math.PI * 2 + seed;
    const r = puff === 0 ? 0 : 0.85 * size;
    m.sphere(
      (puff === 0 ? 0.95 : 0.75) * size,
      [topX + Math.cos(a) * r, y + height + 0.25 + hash(seed + puff) * 0.2, topZ + Math.sin(a) * r],
      greens[puff % 3],
      1,
      [1.35, 0.52, 1.35],
    );
  }
}

function olive(m: Maquette, at: V3, seed: number) {
  const [x, y, z] = at;
  m.box([0.7, 0.42, 0.7], [x, y + 0.21, z], '#d8c4a0');
  m.box([0.6, 0.06, 0.6], [x, y + 0.43, z], '#6b4a33');
  m.rod([x, y + 0.4, z], [x + 0.08, y + 1.2, z - 0.05], 0.06, '#6f5a45', 5);
  m.sphere(0.48, [x + 0.08, y + 1.45, z - 0.05], '#8fae6a', 1, [1, 0.8, 1]);
  m.sphere(0.32, [x - 0.18, y + 1.3, z + 0.15], hash(seed) > 0.5 ? '#9cb977' : '#83a35f', 0);
}

export function cypress(m: Maquette, at: V3, seed: number) {
  const [x, y, z] = at;
  const height = 2.4 + hash(seed) * 0.9;
  m.cylinder(0.07, 0.09, 0.4, [x, y + 0.2, z], '#6b4a33', 5);
  m.cone(0.42, height, [x, y + 0.3 + height / 2, z], '#3f6e3c', 7);
}

export function planter(m: Maquette, at: V3, seed: number, flowers: string[], rotationY = 0) {
  const [x, y, z] = at;
  m.box([1.1, 0.36, 0.55], [x, y + 0.18, z], STONE_DARK, [0, rotationY, 0]);
  m.box([1.0, 0.06, 0.45], [x, y + 0.37, z], '#6b4a33', [0, rotationY, 0]);
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  for (let flower = 0; flower < 7; flower++) {
    const lx = -0.4 + (flower / 6) * 0.8;
    const lz = (hash(seed + flower) - 0.5) * 0.25;
    m.sphere(0.1 + hash(seed * 2 + flower) * 0.05, [x + lx * c + lz * s, y + 0.48, z - lx * s + lz * c], flowers[flower % flowers.length], 0);
  }
}

/* -------------------------------------------------------------------------- ville */

function buildTown(elevation: number) {
  const m = new Maquette();
  /** Petit mobilier (lampadaires, bancs, jardinières) : pas d'ombre portée, trop fine. */
  const props = new Maquette();
  const globes = new Maquette();

  // Rue circulaire : chaussée (disque sous la place), bordure de la place, trottoir.
  m.cylinder(ROAD.outer, ROAD.outer, 0.08, [0, Y, 0], ASPHALT, 72, [0, 0, 0], 0.02);
  m.add(new CylinderGeometry(PLAZA.radius, PLAZA.radius, CURB, 72, 1, true), STONE_DARK, pose([0, Y + CURB / 2, 0]), 0);
  m.torus(PLAZA.radius + 0.06, 0.07, [0, Y + 0.06, 0], '#f1e6d2', [Math.PI / 2, 0, 0], 72);
  m.add(new RingGeometry(ROAD.outer, WALK.outer, 72, 1), STONE, pose([0, TOP, 0], [-Math.PI / 2, 0, 0]), 0);
  m.add(new CylinderGeometry(WALK.outer, WALK.outer, CURB + 0.1, 72, 1, true), STONE_DARK, pose([0, TOP - (CURB + 0.1) / 2, 0]), 0);
  m.torus(ROAD.outer + 0.02, 0.07, [0, Y + 0.06, 0], '#f1e6d2', [Math.PI / 2, 0, 0], 72);

  // Pointillés au milieu de la chaussée (interrompus au passage piéton).
  for (let dash = 0; dash < 30; dash++) {
    const angle = (dash / 30) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(angle - STAIRS.angle), Math.cos(angle - STAIRS.angle))) < 0.2) continue;
    m.box([0.11, 0.02, 0.55], [Math.cos(angle) * ROAD.center, Y + 0.05, Math.sin(angle) * ROAD.center], '#f4f1e8', [0, -angle, 0], 0);
  }

  // Passage piéton vers la rue du port.
  const cx = Math.cos(STAIRS.angle);
  const cz = Math.sin(STAIRS.angle);
  const side: [number, number] = [-cz, cx];
  for (let stripe = -3; stripe <= 3; stripe++) {
    const offset = stripe * 0.34;
    m.box([1.2, 0.02, 0.2], [cx * ROAD.center + side[0] * offset, Y + 0.05, cz * ROAD.center + side[1] * offset], '#f6f3ea', [0, -STAIRS.angle, 0], 0);
  }

  // Rue du port : dalles du trottoir jusqu'au haut de l'escalier.
  const streetFrom = WALK.outer - 0.2;
  const streetTo = STAIRS.top + 0.05;
  const streetLength = streetTo - streetFrom;
  const streetMid = (streetFrom + streetTo) / 2;
  const streetWidth = STAIRS.halfWidth * 2 + 0.5;
  m.box([streetLength, 0.3, streetWidth], [cx * streetMid, TOP - 0.15, cz * streetMid], STONE, [0, -STAIRS.angle, 0]);
  for (let joint = 1; joint < 4; joint++) {
    const d = streetFrom + (joint / 4) * streetLength;
    m.box([0.05, 0.012, streetWidth], [cx * d, TOP + 0.003, cz * d], STONE_DARK, [0, -STAIRS.angle, 0], 0);
  }

  // Escalier taillé dans la falaise, jusqu'au ponton.
  const steps = 14;
  const run = STAIRS.bottom - STAIRS.top;
  for (let step = 0; step < steps; step++) {
    const t0 = step / steps;
    const t1 = (step + 1) / steps;
    const d0 = STAIRS.top + t0 * run;
    const d1 = STAIRS.top + t1 * run;
    const stepTop = TOP + (STAIRS.foot - TOP) * t1;
    const bottom = stepTop - 1.4;
    const mid = (d0 + d1) / 2;
    m.box([d1 - d0 + 0.02, stepTop - bottom, STAIRS.halfWidth * 2], [cx * mid, (stepTop + bottom) / 2, cz * mid], step % 2 ? '#d7c19c' : '#dfcba8', [0, -STAIRS.angle, 0]);
  }
  // Parapets de part et d'autre, qui suivent la pente.
  for (const s of [-1, 1]) {
    const ox = side[0] * s * (STAIRS.halfWidth + 0.14);
    const oz = side[1] * s * (STAIRS.halfWidth + 0.14);
    const a: V3 = [cx * (STAIRS.top - 0.3) + ox, TOP + 0.2, cz * (STAIRS.top - 0.3) + oz];
    const b: V3 = [cx * (STAIRS.bottom - 0.25) + ox, STAIRS.foot + 0.3, cz * (STAIRS.bottom - 0.25) + oz];
    m.beam(a, b, 0.26, '#d9c29b');
    m.beam([a[0], a[1] - 0.42, a[2]], [b[0], b[1] - 0.48, b[2]], 0.3, '#c2a57c');
    m.box([0.36, 0.62, 0.36], [b[0], b[1] - 0.1, b[2]], '#d9c29b');
    m.box([0.36, 0.7, 0.36], [a[0], a[1] - 0.1, a[2]], '#d9c29b');
    m.sphere(0.13, [a[0], a[1] + 0.32, a[2]], '#e8d6b4', 0);
    m.sphere(0.13, [b[0], b[1] + 0.27, b[2]], '#e8d6b4', 0);
  }

  // Lampadaires : sous les globes communs de la place, autour de la rue, au port.
  PLAZA_LANTERNS.forEach(([x, k, z]) => {
    lamp(props, globes, [x, TOP, z], elevation * k + 0.38, false);
  });
  [-2.45, -1.0, 0.16, 1.3, 2.55].forEach((angle) => {
    const r = WALK.outer - 0.24;
    lamp(props, globes, [Math.cos(angle) * r, TOP, Math.sin(angle) * r], TOP + 2.05, true);
  });
  for (const s of [-1, 1]) {
    const d = STAIRS.top - 0.45;
    lamp(props, globes, [cx * d + side[0] * s * 1.2, TOP, cz * d + side[1] * s * 1.2], TOP + 2.0, true);
  }

  // Bancs face à l'hologramme.
  [-2.9, -1.6, 1.05, 2.3].forEach((angle) => {
    const r = 4.6;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    bench(props, [x, TOP, z], Math.atan2(x, z));
  });

  // Jardinières fleuries et oliviers sur la place.
  const flowers = ['#f2a6c8', '#ffd35c', '#ffffff', '#e8668c'];
  [[-0.62, 5.75], [0.58, 5.8], [2.72, 5.75], [-2.4, 5.7]].forEach(([angle, r], index) => {
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (index % 2) olive(props, [x, TOP, z], index * 3.3);
    else planter(props, [x, TOP, z], index * 5.1, flowers, -angle + Math.PI / 2);
  });

  // Pins parasols au bord du plateau, cyprès entre les façades.
  const pines: [number, number, number][] = [
    [0.08, 12.3, 1.1],
    [-2.25, 11.9, 0.95],
    [-1.08, 12.7, 0.9],
    [1.08, 12.9, 0.85],
  ];
  pines.forEach(([angle, r, size], index) => {
    umbrellaPine(m, [Math.cos(angle) * r, Y, Math.sin(angle) * r], index * 7.7 + 1, size);
  });
  const cypresses: [number, number][] = [
    [-0.16, 9.35],
    [0.24, 9.3],
    [2.25, 9.15],
    [-2.08, 9.2],
    [-1.08, 9.3],
  ];
  cypresses.forEach(([angle, r], index) => {
    cypress(m, [Math.cos(angle) * r, Y, Math.sin(angle) * r], index * 4.1);
  });

  // Lampadaire de quai, en contrebas, au chantier naval.
  const yardAngle = SHIPYARD.angle + 0.24;
  const yardR = SHIPYARD.inner + 0.5;
  lamp(props, globes, [Math.cos(yardAngle) * yardR, SHIPYARD.level, Math.sin(yardAngle) * yardR], SHIPYARD.level + 2.0, true);

  return { town: m.build(), props: props.build(), globes: globes.build() };
}

/** Clairières : pas d'herbe sur la place, la rue, ni sous les bâtiments. */
function TownClearings() {
  const sites = (Object.keys(SITES) as (keyof typeof SITES)[]).filter((id) => id !== 'cyber' && id !== 'shipyard');
  const street = (STAIRS.top + WALK.outer) / 2;
  return (
    <>
      <ClearingAt x={0} z={0} radius={WALK.outer / 0.8 + 0.2} />
      {sites.map((id) => {
        const [x, z] = sitePosition(id);
        return <ClearingAt key={id} x={x} z={z} radius={5.2} />;
      })}
      <ClearingAt x={Math.cos(STAIRS.angle) * street} z={Math.sin(STAIRS.angle) * street} radius={2.8} />
    </>
  );
}

export function Town({ elevation }: { elevation: number }) {
  const { town, props, globes } = useMemo(() => buildTown(elevation), [elevation]);
  const texture = useMemo(() => plazaTexture(), []);
  const plazaMaterial = useMemo(() => new MeshStandardMaterial({ map: texture, roughness: 0.92 }), [texture]);
  useEffect(
    () => () => {
      town.dispose();
      props.dispose();
      globes.dispose();
      texture.dispose();
      plazaMaterial.dispose();
    },
    [globes, plazaMaterial, props, texture, town],
  );
  return (
    <group>
      <TownClearings />
      <mesh geometry={town} material={paint} castShadow receiveShadow raycast={() => null} />
      <mesh geometry={props} material={paint} receiveShadow raycast={() => null} />
      <mesh geometry={globes} material={lampGlow} raycast={() => null} />
      {/* Place : un disque pavé (la rosace est peinte dans une petite texture). */}
      <mesh rotation-x={-Math.PI / 2} position-y={TOP} material={plazaMaterial} receiveShadow raycast={() => null}>
        <circleGeometry args={[PLAZA.radius, 72]} />
      </mesh>
    </group>
  );
}
