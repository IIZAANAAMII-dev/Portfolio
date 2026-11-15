'use client';

import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { clothClock } from '@/lib/substance-models';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { updateWindows, windowMaterial } from '@/lib/windows';
import { ChimneySmoke } from '../ChimneySmoke';
import { addClearing, ClearingContext } from '../clearings';
import { useHandFont } from '../kit';
import { bevelBox, MeshBuilder, perFace, pose, type Painter, type Vec3 } from './shapes';
import { tickWind, WIND_DIRECTION, WIND_GLSL, windUniforms } from './wind';

/**
 * La capitainerie du port de départ : une cabane de pêcheurs bretonne, murs chaulés,
 * volets et poteaux bleus, toit de tuiles corail, pignon peint « Départ ». Au guichet, un
 * store rayé qui bat au vent, des bocaux sur le comptoir ; autour, des hortensias, des
 * casiers à homards, une caisse de flotteurs, une bouée, une lanterne qui s'allume au
 * crépuscule, un tuyau de poêle qui fume et une girouette-poisson qui suit le vent.
 *
 * Tout le statique tient en deux maillages peints par sommet (la cabane, ses abords posés
 * sur le relief) ; s'y ajoutent les vitres (allumées à leur heure), la lanterne, le store,
 * l'enseigne et la girouette. Repère : façade vers +z, origine au sol, au centre.
 */

const WALL = '#f3ebdc';
const WALL_SHADE = '#e6dac6';
const TRIM = '#2f7486';
const BLUE = '#3b6ea8';
const ROOF = ['#c9553f', '#bb4a37', '#d4684b', '#c55a43'];
const RIDGE = '#9c3f30';
const WOOD = '#a8744a';
const WOOD_DARK = '#7a5034';
const STONE = '#b9ae9c';
const IRON = '#33393f';
const BRASS = '#c9a35c';

const HALF_W = 1.0;
const HALF_D = 0.8;
const FLOOR = 0.15;
const EAVE = 1.95;
const RIDGE_Y = 2.86;
const OVERHANG = 0.26;

/** Pierres du soubassement : un appareil irrégulier, chaque bloc son ton. */
const stonework = perFace((x, y, z, ny, out) => {
  const row = Math.floor((y + 0.5) / 0.15);
  const block = Math.floor((x + z) / 0.34 + row * 0.5);
  out.set(STONE).multiplyScalar(0.84 + hash(row * 13.1 + block * 7.7) * 0.22);
  if (ny > 0.5) out.multiplyScalar(1.08);
});

/** Lames verticales d'un mur chaulé : une lame sur deux un peu plus ombrée. */
function boards(width: number): Painter {
  const light = new Color(WALL);
  const dark = new Color(WALL_SHADE);
  return perFace((x, y, z, ny, out) => {
    out.copy(Math.floor((x + z) / width + 100) % 2 === 0 ? light : dark);
  });
}

/** Lames horizontales (volets) entre `from` et `to` en hauteur. */
function slats(color: string, from: number, to: number, count: number): Painter {
  return perFace((x, y, z, ny, out) => {
    out.set(color).multiplyScalar(Math.floor(((y - from) / (to - from)) * count) % 2 === 0 ? 1 : 0.86);
  });
}

function kioskGeometry() {
  const wood = new MeshBuilder();
  const glow = new MeshBuilder();

  // Soubassement en pierre, avec le perron devant le guichet.
  wood.add(new BoxGeometry(2.3, 0.6, 2.45, 7, 4, 7), stonework, pose([0, -0.15, 0.28]));
  for (let index = 0; index < 4; index++) {
    const tone = new Color(WOOD).multiplyScalar(0.92 + hash(index * 3.3) * 0.16);
    wood.add(bevelBox(2.24, 0.05, 0.135, 0.012), tone.getStyle(), pose([0, FLOOR + 0.025, 0.95 + index * 0.15]), 0.15);
  }

  // Murs en lames chaulées.
  const wallHeight = EAVE - FLOOR;
  const wallY = FLOOR + wallHeight / 2;
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(HALF_W * 2, wallHeight, 0.08, 8, 1, 1), boards(0.25), pose([0, wallY, side * (HALF_D - 0.04)]));
    wood.add(new BoxGeometry(0.08, wallHeight, HALF_D * 2, 1, 1, 8), boards(0.2), pose([side * (HALF_W - 0.04), wallY, 0]));
  }
  // Pignons avant et arrière (deux faces chacun).
  for (const side of [-1, 1]) {
    const z = side * (HALF_D - 0.02);
    wood.triangle([-HALF_W, EAVE, z + side * 0.002], [HALF_W, EAVE, z + side * 0.002], [0, RIDGE_Y - 0.06, z + side * 0.002], WALL);
    wood.triangle([HALF_W, EAVE, z - side * 0.002], [-HALF_W, EAVE, z - side * 0.002], [0, RIDGE_Y - 0.06, z - side * 0.002], WALL);
  }
  // Poteaux d'angle et lisses hautes, bleu canard.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      wood.add(bevelBox(0.11, wallHeight + 0.04, 0.11, 0.015), TRIM, pose([sx * (HALF_W - 0.03), wallY + 0.02, sz * (HALF_D - 0.03)]), 0.12);
    }
    wood.add(new BoxGeometry(HALF_W * 2 + 0.06, 0.08, 0.05), TRIM, pose([0, EAVE - 0.04, sx * (HALF_D + 0.01)]), 0.1);
  }

  // Toit : deux pans, rangs de tuiles décalés (bord bas relevé), faîtage arrondi.
  const run = HALF_W + OVERHANG;
  const rise = RIDGE_Y - (EAVE - 0.03);
  const slope = Math.atan2(rise, run);
  const length = Math.hypot(run, rise);
  const depth = HALF_D * 2 + OVERHANG * 2;
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(length, 0.07, depth), RIDGE, pose([side * run / 2, RIDGE_Y - rise / 2, 0], [0, 0, -side * slope]));
    const rows = 6;
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.5) / rows;
      const tiles = perFace((x, y, z, ny, out) => {
        const tile = Math.floor((z + 2) / (depth / 12));
        out.set(ROOF[(row * 3 + tile + (side > 0 ? 1 : 0)) % ROOF.length]).multiplyScalar(0.94 + hash(tile * 3.7 + row * 11.1 + side) * 0.1);
        if (ny < 0.2) out.multiplyScalar(0.78);
      });
      wood.add(
        new BoxGeometry(length / rows + 0.05, 0.035, depth + 0.02, 1, 1, 12),
        tiles,
        pose([side * run * t, RIDGE_Y - rise * t + 0.062, 0], [0, 0, -side * (slope + 0.07)]),
      );
    }
  }
  wood.add(new CylinderGeometry(0.075, 0.075, depth + 0.04, 8, 1).rotateX(Math.PI / 2), RIDGE, pose([0, RIDGE_Y + 0.03, 0]), 0.1);
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      wood.add(new BoxGeometry(length + 0.04, 0.13, 0.04), TRIM, pose([side * run / 2, RIDGE_Y - rise / 2 - 0.02, end * (depth / 2 + 0.015)], [0, 0, -side * slope]), 0.1);
    }
  }

  // Guichet : intérieur (vitre qui s'allume le soir), cadre, comptoir, bocaux, clochette.
  glow.add(new PlaneGeometry(1.24, 0.6), '#ffffff', pose([0, 1.28, HALF_D + 0.004]));
  for (const [w, h, x, y] of [[1.36, 0.07, 0, 1.6], [1.36, 0.06, 0, 0.96], [0.07, 0.66, -0.66, 1.28], [0.07, 0.66, 0.66, 1.28]] as const) {
    wood.add(new BoxGeometry(w, h, 0.05), TRIM, pose([x, y, HALF_D + 0.02]), 0.1);
  }
  wood.add(bevelBox(1.56, 0.06, 0.3, 0.012), WOOD, pose([0, 0.97, HALF_D + 0.13]), 0.2);
  for (const x of [-0.6, 0.6]) wood.add(new BoxGeometry(0.05, 0.22, 0.05), WOOD_DARK, pose([x, 0.84, HALF_D + 0.06], [0.7, 0, 0]));
  const jars: [number, string][] = [[-0.5, '#e0a040'], [-0.33, '#5fb3a8'], [-0.17, '#e2725b']];
  jars.forEach(([x, color], index) => {
    const h = 0.12 + index * 0.02;
    wood.add(new CylinderGeometry(0.05, 0.05, h, 8), color, pose([x, 1.0 + h / 2, HALF_D + 0.14]), 0.2);
    wood.add(new CylinderGeometry(0.053, 0.053, 0.03, 8), '#efe2c4', pose([x, 1.0 + h + 0.015, HALF_D + 0.14]));
  });
  wood.add(new SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), BRASS, pose([0.45, 1.0, HALF_D + 0.15]), 0.15);
  wood.add(new CylinderGeometry(0.012, 0.012, 0.05, 4), BRASS, pose([0.45, 1.075, HALF_D + 0.15]));
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(0.3, 0.62, 0.03, 1, 6, 1), slats(BLUE, 0.97, 1.59, 6), pose([side * 0.85, 1.28, HALF_D + 0.035]));
  }

  // Planche de l'enseigne, sur le pignon (le texte est une texture à part).
  wood.add(new BoxGeometry(1.02, 0.34, 0.04), WOOD_DARK, pose([0, 2.24, HALF_D + 0.03]), 0.1);

  // Porte bleue sur le flanc gauche, poignée en laiton, marche de pierre.
  wood.add(new BoxGeometry(0.04, 1.42, 0.68, 1, 1, 4), perFace((x, y, z, ny, out) => {
    out.set(BLUE).multiplyScalar(Math.floor((z + 0.42) / 0.17) % 2 === 0 ? 1 : 0.88);
  }), pose([-HALF_W - 0.02, FLOOR + 0.73, -0.08]));
  wood.add(new SphereGeometry(0.035, 6, 4), BRASS, pose([-HALF_W - 0.05, 0.92, 0.18]));
  wood.add(bevelBox(0.3, 0.12, 0.7, 0.02), stonework, pose([-HALF_W - 0.2, 0.02, -0.08]));

  // Hublot sur le flanc droit, et bouée de sauvetage.
  wood.add(new TorusGeometry(0.22, 0.035, 6, 16), BRASS, pose([HALF_W + 0.02, 1.25, 0.12], [0, Math.PI / 2, 0]), 0.1);
  glow.add(new CircleGeometry(0.2, 16), '#ffffff', pose([HALF_W + 0.012, 1.25, 0.12], [0, Math.PI / 2, 0]));
  const buoy: Vec3 = [HALF_W + 0.06, 0.98, -0.45];
  wood.add(new TorusGeometry(0.2, 0.065, 6, 16), perFace((x, y, z, ny, out) => {
    const turn = Math.atan2(y - buoy[1], z - buoy[2]) + Math.PI;
    out.set(Math.floor(turn / (Math.PI / 4)) % 2 === 0 ? '#e0533d' : '#f5efe3');
  }), pose(buoy, [0, Math.PI / 2, 0]));

  // Lanterne sur potence, à l'angle avant droit (sa vitre est un maillage à part).
  wood.add(new BoxGeometry(0.36, 0.04, 0.04), IRON, pose([HALF_W + 0.14, 1.86, HALF_D + 0.02]));
  wood.add(new BoxGeometry(0.035, 0.22, 0.035), IRON, pose([HALF_W + 0.06, 1.76, HALF_D + 0.02], [0, 0, 0.8]));
  const lantern: Vec3 = [HALF_W + 0.28, 1.6, HALF_D + 0.02];
  wood.add(new CylinderGeometry(0.008, 0.008, 0.14, 4), IRON, pose([lantern[0], 1.79, lantern[2]]));
  wood.add(new BoxGeometry(0.2, 0.03, 0.2), IRON, pose([lantern[0], lantern[1] - 0.13, lantern[2]]));
  wood.add(new ConeGeometry(0.17, 0.14, 4), '#c8553d', pose([lantern[0], lantern[1] + 0.18, lantern[2]], [0, Math.PI / 4, 0]), 0.12);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      wood.add(new BoxGeometry(0.022, 0.24, 0.022), IRON, pose([lantern[0] + cx * 0.085, lantern[1], lantern[2] + cz * 0.085]));
    }
  }

  // Tuyau de poêle sur le pan droit, avec son chapeau ; tige de la girouette.
  const pipeX = 0.6;
  const pipeZ = -0.38;
  const roofAt = RIDGE_Y - (pipeX / run) * rise + 0.05;
  wood.add(new CylinderGeometry(0.065, 0.07, 0.95, 8), IRON, pose([pipeX, roofAt + 0.38, pipeZ]), 0.15);
  wood.add(new ConeGeometry(0.13, 0.1, 8), IRON, pose([pipeX, roofAt + 0.9, pipeZ]), 0.15);
  wood.add(new CylinderGeometry(0.018, 0.022, 0.62, 5), IRON, pose([0, RIDGE_Y + 0.33, -HALF_D - 0.05]));
  wood.add(new SphereGeometry(0.04, 6, 4), BRASS, pose([0, RIDGE_Y + 0.66, -HALF_D - 0.05]));

  return {
    wood: wood.build()!,
    glow: glow.build()!,
    lantern,
    chimney: [pipeX, roofAt + 1.0, pipeZ] as Vec3,
    vane: [0, RIDGE_Y + 0.56, -HALF_D - 0.05] as Vec3,
  };
}

/* ------------------------------------------------------------------ abords */

type Ground = (x: number, z: number) => number;

const LEAF_BALL = new IcosahedronGeometry(1, 0);
const FLOWER_BALL = new IcosahedronGeometry(1, 1);

/** Hortensia : un coussin de feuilles et des boules de fleurs bleues, mauves ou roses. */
function hydrangea(builder: MeshBuilder, x: number, z: number, ground: Ground, seed: number, hues: string[]) {
  const y = ground(x, z);
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2 + hash(seed + index) * 0.6;
    const r = 0.16 + hash(seed + index * 2.1) * 0.08;
    const size = 0.17 + hash(seed + index * 3.3) * 0.07;
    const tone = new Color('#3f6f34').multiplyScalar(0.9 + hash(seed + index * 4.4) * 0.25);
    builder.add(LEAF_BALL, tone.getStyle(), pose(
      [x + Math.cos(angle) * r, y + size * 0.7, z + Math.sin(angle) * r],
      [hash(seed + index * 5.5) * 3, hash(seed + index * 6.6) * 3, 0],
      [size * 1.15, size * 0.8, size * 1.15],
    ), 0.15);
  }
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + hash(seed + index * 7.7);
    const r = index === 0 ? 0 : 0.13 + hash(seed + index * 8.8) * 0.12;
    const size = 0.1 + hash(seed + index * 9.9) * 0.05;
    const hue = new Color(hues[Math.floor(hash(seed + index * 1.3) * hues.length) % hues.length]);
    const top = y + 0.33 + (index === 0 ? 0.12 : hash(seed + index * 2.9) * 0.1);
    // Fleurettes : chaque facette un peu différente, le dessus plus clair.
    builder.add(FLOWER_BALL, perFace((px, py, pz, ny, out) => {
      out.copy(hue).multiplyScalar(0.84 + hash(px * 91.7 + py * 47.3 + pz * 13.1) * 0.24 + Math.max(0, ny) * 0.1);
    }), pose([x + Math.cos(angle) * r, top, z + Math.sin(angle) * r], [hash(seed + index) * 3, hash(seed + index * 3.1) * 3, 0], size));
  }
}

/** Casier à homards : socle de bois, filet tendu sur trois arceaux. */
function lobsterPot(builder: MeshBuilder, at: Vec3, yaw: number) {
  const place = pose(at, [0, yaw, 0]);
  builder.add(new BoxGeometry(0.62, 0.06, 0.42), WOOD_DARK, place.clone().multiply(pose([0, 0.03, 0])), 0.15);
  const net = new CylinderGeometry(0.2, 0.2, 0.6, 10, 1, true, 0, Math.PI);
  builder.add(net, perFace((x, y, z, ny, out) => {
    out.set('#c8a46b').multiplyScalar(0.8 + (Math.floor((x + z) * 14 + 50) % 2) * 0.2);
  }), place.clone().multiply(pose([0, 0.06, 0], [0, 0, Math.PI / 2])));
  for (const x of [-0.28, 0, 0.28]) {
    builder.add(new TorusGeometry(0.2, 0.018, 4, 10, Math.PI), WOOD, place.clone().multiply(pose([x, 0.06, 0], [0, Math.PI / 2, 0])));
  }
}

/** Caisse de flotteurs de verre colorés. */
function floatCrate(builder: MeshBuilder, at: Vec3, yaw: number) {
  const place = pose(at, [0, yaw, 0]);
  builder.add(new BoxGeometry(0.56, 0.26, 0.4, 1, 3, 1), slats(WOOD, at[1], at[1] + 0.26, 3), place.clone().multiply(pose([0, 0.13, 0])), 0.1);
  const colors = ['#e8823f', '#5fb3a8', '#f2c14e', '#d9483f', '#9fd0e8'];
  colors.forEach((color, index) => {
    const x = -0.17 + (index % 3) * 0.17 + (index > 2 ? 0.08 : 0);
    const z = index < 3 ? -0.08 : 0.09;
    builder.add(new IcosahedronGeometry(0.1, 1), color, place.clone().multiply(pose([x, 0.29 + (index > 2 ? 0.05 : 0), z])), 0.2);
  });
}

/** Banc de bois face à la mer. */
function bench(builder: MeshBuilder, at: Vec3, yaw: number) {
  const place = pose(at, [0, yaw, 0]);
  builder.add(bevelBox(1.1, 0.05, 0.32, 0.012), WOOD, place.clone().multiply(pose([0, 0.42, 0])), 0.2);
  builder.add(new BoxGeometry(1.1, 0.16, 0.04), WOOD, place.clone().multiply(pose([0, 0.66, -0.15], [-0.2, 0, 0])), 0.15);
  for (const x of [-0.45, 0.45]) {
    builder.add(new BoxGeometry(0.06, 0.42, 0.28), WOOD_DARK, place.clone().multiply(pose([x, 0.21, 0])), 0.1);
    builder.add(new BoxGeometry(0.05, 0.3, 0.05), WOOD_DARK, place.clone().multiply(pose([x, 0.56, -0.15])));
  }
}

/** Abords de la cabane, chacun posé sur le relief (repère de la cabane). */
function surroundings(ground: Ground) {
  const builder = new MeshBuilder();
  hydrangea(builder, -1.4, 1.22, ground, 3, ['#7f9fe3', '#8f8be0', '#a5b8f0']);
  hydrangea(builder, 1.42, 1.2, ground, 11, ['#e9a3c4', '#d68bd0', '#f1bfd2']);
  hydrangea(builder, -1.52, -0.85, ground, 23, ['#7f9fe3', '#b09ae6']);
  const pot = ground(1.52, 0.25);
  lobsterPot(builder, [1.52, pot, 0.25], 1.45);
  lobsterPot(builder, [1.5, pot + 0.26, 0.27], 1.62);
  floatCrate(builder, [1.45, ground(1.45, -0.62), -0.62], 1.2);
  bench(builder, [-1.78, ground(-1.78, 0.42), 0.42], 1.15);
  return builder.build()!;
}

/* --------------------------------------------------------------- enseigne */

/** Enseigne : lettres peintes à la main (police du site) sur planche crème. */
function signTexture(text: string, family: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f1e2c2';
  ctx.fillRect(0, 0, 512, 160);
  for (let index = 0; index < 10; index++) {
    ctx.strokeStyle = `rgba(140, 100, 60, ${0.05 + hash(index * 1.7) * 0.06})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const y = 8 + hash(index * 3.1) * 144;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 5, 340, y - 5, 512, y + 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9553f';
  ctx.lineWidth = 9;
  ctx.strokeRect(9, 9, 494, 142);
  ctx.fillStyle = '#2f4c66';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 104px ${family}`;
  ctx.fillText(text, 256, 86, 470);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function Sign({ text }: { text: string }) {
  const family = useHandFont();
  const texture = useMemo(() => (family ? signTexture(text, family) : null), [family, text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={[0, 2.24, HALF_D + 0.053]} raycast={() => null}>
      <planeGeometry args={[0.95, 0.3]} />
      <meshStandardMaterial map={texture} roughness={0.95} />
    </mesh>
  );
}

/* ------------------------------------------------------------------- store */

const AWNING_PARS = /* glsl */ `
attribute float aFree;
uniform float uClothTime;
${WIND_GLSL}
`;

/** Le bord libre (et le lambrequin) ondule comme les autres tissus ; le haut reste cloué. */
const AWNING_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  vec4 awningWorld = modelMatrix * vec4( position, 1.0 );
  float gust = windGust( awningWorld.xz );
  float phase = dot( awningWorld.xz, vec2( 0.84, 0.54 ) ) * 2.6 - uClothTime * 5.2;
  float wave = sin( phase + position.x * 4.0 ) * 0.7 + sin( phase * 1.7 - position.x * 7.0 ) * 0.3;
  transformed.y += aFree * wave * ( 0.012 + gust * 0.03 );
  transformed.z += aFree * aFree * ( wave * 0.012 + gust * 0.035 );
}
`;

/** Store rayé rouge et crème, toile un peu bombée, lambrequin festonné. */
function awningGeometry() {
  const builder = new MeshBuilder(['aFree']);
  const left = -0.76;
  const right = 0.76;
  const stripes = 8;
  const top: [number, number] = [1.74, HALF_D + 0.02];
  const bottom: [number, number] = [1.46, HALF_D + 0.66];
  const rows = 3;
  const free = (x: number, y: number, z: number) => Math.min(1, Math.max(0, (z - top[1]) / (bottom[1] - top[1])));
  for (let stripe = 0; stripe < stripes; stripe++) {
    const x0 = left + ((right - left) * stripe) / stripes;
    const x1 = left + ((right - left) * (stripe + 1)) / stripes;
    const color = stripe % 2 === 0 ? '#d4553f' : '#f4ead6';
    for (let row = 0; row < rows; row++) {
      const t0 = row / rows;
      const t1 = (row + 1) / rows;
      const y0 = top[0] + (bottom[0] - top[0]) * t0 - Math.sin(t0 * Math.PI) * 0.03;
      const y1 = top[0] + (bottom[0] - top[0]) * t1 - Math.sin(t1 * Math.PI) * 0.03;
      const z0 = top[1] + (bottom[1] - top[1]) * t0;
      const z1 = top[1] + (bottom[1] - top[1]) * t1;
      builder.quad([x0, y0, z0], [x0, y1, z1], [x1, y1, z1], [x1, y0, z0], color, { aFree: free });
    }
    const [yb, zb] = bottom;
    const xm = (x0 + x1) / 2;
    builder.quad([x0, yb, zb], [x0, yb - 0.08, zb + 0.004], [x1, yb - 0.08, zb + 0.004], [x1, yb, zb], color, { aFree: 1 });
    builder.triangle([x0, yb - 0.08, zb + 0.004], [xm, yb - 0.15, zb + 0.006], [x1, yb - 0.08, zb + 0.004], color, { aFree: 1 });
  }
  return builder.build()!;
}

function createAwningMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92, metalness: 0, side: DoubleSide });
  material.name = 'kiosk-awning';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${AWNING_PARS}`)
      .replace('#include <begin_vertex>', AWNING_VERTEX);
  };
  material.customProgramCacheKey = () => 'kiosk-awning-v1';
  return material;
}

/* --------------------------------------------------------------- girouette */

/** Poisson-girouette : silhouette plate, la tête (+x local) face au vent. */
function vaneGeometry() {
  const builder = new MeshBuilder();
  const outline: Vec3[] = [[0.3, 0, 0], [0.18, 0.08, 0], [-0.05, 0.09, 0], [-0.2, 0.03, 0], [-0.32, 0.11, 0], [-0.3, 0, 0], [-0.32, -0.11, 0], [-0.2, -0.03, 0], [-0.05, -0.08, 0], [0.18, -0.07, 0]];
  for (const side of [1, -1]) {
    const depth = side * 0.012;
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index];
      const b = outline[(index + 1) % outline.length];
      const center: Vec3 = [0.02, 0, depth];
      const p: Vec3 = [a[0], a[1], depth];
      const q: Vec3 = [b[0], b[1], depth];
      if (side > 0) builder.triangle(center, p, q, BRASS);
      else builder.triangle(center, q, p, BRASS);
    }
  }
  builder.add(new SphereGeometry(0.02, 5, 4), IRON, pose([0.2, 0.025, 0.014]));
  builder.add(new SphereGeometry(0.02, 5, 4), IRON, pose([0.2, 0.025, -0.014]));
  return builder.build()!;
}

/* ------------------------------------------------------------------ montage */

const WOOD_MATERIAL = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.86, metalness: 0, flatShading: true });
WOOD_MATERIAL.name = 'kiosk-wood';
const LANTERN_MATERIAL = new MeshStandardMaterial({ color: '#ffe7b3', emissive: '#ffb85c', emissiveIntensity: 0.3, roughness: 0.25 });
const VANE_MATERIAL = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.45, metalness: 0.5, flatShading: true, side: DoubleSide });
const AWNING_MATERIAL = createAwningMaterial();

let shared: { kiosk: ReturnType<typeof kioskGeometry>; awning: ReturnType<typeof awningGeometry>; vane: ReturnType<typeof vaneGeometry> } | null = null;
/** Géométries communes, construites une seule fois (au premier montage, côté client). */
function kioskParts() {
  shared ??= { kiosk: kioskGeometry(), awning: awningGeometry(), vane: vaneGeometry() };
  return shared;
}

/** Cap du vent (rotation autour de y qui aligne +x local sur la direction d'où il vient). */
const WIND_YAW = Math.atan2(WIND_DIRECTION.z, -WIND_DIRECTION.x);

export function Kiosk({
  position,
  rotation = 0,
  scale = 1,
  sign = 'Départ',
  ground,
}: {
  /** Pied de la cabane, dans le repère de l'île. */
  position: [number, number, number];
  /** Rotation autour de la verticale (façade vers +z local). */
  rotation?: number;
  scale?: number;
  sign?: string;
  /** Hauteur du sol (repère de l'île) : les abords épousent le relief. */
  ground?: (x: number, z: number) => number;
}) {
  const parts = useMemo(() => kioskParts(), []);
  const vane = useRef<Group>(null);
  const lantern = useRef<Mesh>(null);
  const clearings = useContext(ClearingContext);
  const quality = useWorld((state) => state.quality);
  const glass = useMemo(() => windowMaterial(41, '#ffc46b', '#2f4a63', 1.8), []);
  const [px, py, pz] = position;

  // Abords posés sur le relief : repère de la cabane → repère de l'île, et retour.
  const around = useMemo(() => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const local: Ground = (x, z) => {
      if (!ground) return 0;
      const ix = px + (x * cos + z * sin) * scale;
      const iz = pz + (-x * sin + z * cos) * scale;
      return (ground(ix, iz) - py) / scale - 0.03;
    };
    return surroundings(local);
  }, [ground, px, py, pz, rotation, scale]);
  useEffect(() => () => around.dispose(), [around]);

  // Emprise de la cabane et de ses abords : l'herbe ne traverse pas le perron.
  useLayoutEffect(() => {
    const remove = addClearing(clearings, px, pz, 1.8 * scale);
    return () => remove?.();
  }, [clearings, px, pz, scale]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    tickWind(time);
    updateWindows(skyState.dayNight);
    const target = vane.current;
    if (target) {
      // La girouette cherche le vent et hésite un peu autour de son cap.
      const wanted = WIND_YAW - rotation + Math.sin(time * 0.7) * 0.18 + Math.sin(time * 1.9) * 0.06;
      const current = target.rotation.y;
      const step = Math.atan2(Math.sin(wanted - current), Math.cos(wanted - current));
      target.rotation.y = current + step * Math.min(1, Math.min(delta, 1 / 30) * 2.5);
    }
    const glassMesh = lantern.current;
    if (glassMesh) {
      const flicker = 1 + Math.sin(time * 7.7) * 0.04 + Math.sin(time * 12.3) * 0.03;
      (glassMesh.material as MeshStandardMaterial).emissiveIntensity = (0.25 + skyState.dayNight * 3.2) * flicker;
    }
  });

  const { kiosk } = parts;
  return (
    <group position={position} rotation-y={rotation} scale={scale}>
      <mesh geometry={kiosk.wood} material={WOOD_MATERIAL} castShadow receiveShadow raycast={() => null} />
      <mesh geometry={around} material={WOOD_MATERIAL} castShadow={quality !== 'low'} receiveShadow raycast={() => null} />
      <mesh geometry={kiosk.glow} material={glass} raycast={() => null} />
      <mesh geometry={parts.awning} material={AWNING_MATERIAL} castShadow receiveShadow raycast={() => null} />
      <mesh ref={lantern} position={kiosk.lantern} material={LANTERN_MATERIAL} raycast={() => null}>
        <boxGeometry args={[0.15, 0.2, 0.15]} />
      </mesh>
      <group ref={vane} position={kiosk.vane}>
        <mesh geometry={parts.vane} material={VANE_MATERIAL} castShadow raycast={() => null} />
      </group>
      <Sign text={sign} />
      {quality !== 'low' && <ChimneySmoke position={kiosk.chimney} />}
    </group>
  );
}
