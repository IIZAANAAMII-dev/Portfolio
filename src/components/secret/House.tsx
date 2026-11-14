'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { WindowPane } from '@/components/islands/kit';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { merge, part, quad } from './geo';
import { HOUSE, YARD_HEIGHT } from './layout';
import { flicker } from './signal';
import { shingleTexture, sidingTexture } from './textures';

/**
 * La maison : vieux bâtiment à deux étages, bardage écaillé, fenêtres condamnées par des
 * planches, une fenêtre de l'étage qui grésille (un néon à l'intérieur). C'est le QG de
 * l'équipe ; la faille a arraché la porte d'entrée.
 *
 * Trois maillages fusionnés : murs (bardage), toit (bardeaux), détails (couleurs par
 * sommet : chambranles, planches, soubassement, cheminée, antenne…).
 */

const W = HOUSE.width / 2;
const D = HOUSE.depth / 2;
const FLOOR = HOUSE.plinth;
const EAVE = HOUSE.plinth + HOUSE.ground + HOUSE.upper;
const RIDGE = EAVE + HOUSE.roof;
const OVERHANG = 0.36;
const SIDE_OVERHANG = 0.24;
const PITCH = HOUSE.roof / D;
const TILE = 4;

type Side = 'front' | 'back' | 'left' | 'right';
type WindowKind = 'boarded' | 'crossed' | 'dark' | 'pane' | 'flicker';

interface WindowSpec {
  side: Side;
  /** Position le long du mur (repère du mur : +X à droite vu de face). */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: WindowKind;
}

const WINDOWS: WindowSpec[] = [
  { side: 'front', x: -1.55, y: 1.6, w: 0.84, h: 1.12, kind: 'boarded' },
  { side: 'front', x: 1.5, y: 1.6, w: 0.84, h: 1.12, kind: 'pane' },
  { side: 'front', x: -1.5, y: 3.95, w: 0.74, h: 0.98, kind: 'crossed' },
  { side: 'front', x: 0.05, y: 3.95, w: 0.74, h: 0.98, kind: 'dark' },
  { side: 'front', x: 1.5, y: 3.95, w: 0.74, h: 0.98, kind: 'flicker' },
  { side: 'left', x: 0.35, y: 1.6, w: 0.8, h: 1.08, kind: 'dark' },
  { side: 'left', x: -0.5, y: 3.95, w: 0.7, h: 0.95, kind: 'boarded' },
  { side: 'right', x: -0.4, y: 1.6, w: 0.8, h: 1.08, kind: 'pane' },
  { side: 'right', x: 0.45, y: 3.95, w: 0.7, h: 0.95, kind: 'dark' },
  { side: 'back', x: -1.0, y: 1.6, w: 0.8, h: 1.08, kind: 'crossed' },
  { side: 'back', x: 1.1, y: 3.95, w: 0.7, h: 0.95, kind: 'boarded' },
];

/** Repère de chaque mur : +Z sortant, +X le long du mur vu de l'extérieur. */
function wallMatrix(side: Side) {
  const matrix = new Matrix4();
  if (side === 'front') matrix.makeTranslation(0, 0, D);
  else if (side === 'back') matrix.makeRotationY(Math.PI).setPosition(0, 0, -D);
  else if (side === 'left') matrix.makeRotationY(-Math.PI / 2).setPosition(-W, 0, 0);
  else matrix.makeRotationY(Math.PI / 2).setPosition(W, 0, 0);
  return matrix;
}

const COLORS = {
  trim: '#d2d3c1',
  trimDirty: '#aeae9c',
  glass: '#252e33',
  plank: ['#7b6b55', '#6a5d4b', '#887760'],
  plinth: '#8b8a82',
  under: '#3a3e3b',
  ridge: '#3d4440',
  chimney: '#5f5853',
  cap: '#7b7671',
  metal: '#8c9194',
  dark: '#2b2d2e',
  door: '#5d4c3d',
};

/** Murs : bardage, assombri au pied (crasse, mousse) et sous l'avancée du toit. */
function buildWalls() {
  const pieces: BufferGeometry[] = [];
  const bands = [FLOOR, 0.95, EAVE - 0.5, EAVE];
  const shadeAt = (y: number) => (y <= FLOOR + 0.01 ? 0.6 : y < 1 ? 0.92 : y < EAVE - 0.1 ? 1 : 0.84);
  const walls: { side: Side; half: number }[] = [
    { side: 'front', half: W },
    { side: 'back', half: W },
    { side: 'left', half: D },
    { side: 'right', half: D },
  ];
  walls.forEach(({ side, half }, index) => {
    const matrix = wallMatrix(side);
    const offset = index * 0.37;
    for (let band = 0; band < bands.length - 1; band++) {
      const y0 = bands[band];
      const y1 = bands[band + 1];
      const piece = quad(
        [[-half, y0, 0], [half, y0, 0], [half, y1, 0], [-half, y1, 0]],
        [[offset + -half / TILE, y0 / TILE], [offset + half / TILE, y0 / TILE], [offset + half / TILE, y1 / TILE], [offset + -half / TILE, y1 / TILE]],
        [shadeAt(y0), shadeAt(y0), shadeAt(y1), shadeAt(y1)],
      );
      piece.applyMatrix4(matrix);
      pieces.push(piece);
    }
    // Pignons triangulaires sur les côtés.
    if (side === 'left' || side === 'right') {
      const gable = quad(
        [[-half, EAVE, 0], [half, EAVE, 0], [0.0001, RIDGE, 0], [-0.0001, RIDGE, 0]],
        [[offset - half / TILE, EAVE / TILE], [offset + half / TILE, EAVE / TILE], [offset, RIDGE / TILE], [offset, RIDGE / TILE]],
        [0.86, 0.86, 0.95, 0.95],
      );
      gable.applyMatrix4(matrix);
      pieces.push(gable);
    }
  });
  const merged = merge(pieces);
  return merged;
}

/** Toit à deux pans : la surface en bardeaux (uv en mètres le long de la pente). */
function buildRoof() {
  const xa = -W - SIDE_OVERHANG;
  const xb = W + SIDE_OVERHANG;
  const eaveY = EAVE - OVERHANG * PITCH;
  const eaveZ = D + OVERHANG;
  const slope = Math.hypot(eaveZ, RIDGE - eaveY);
  const front = quad(
    [[xa, eaveY, eaveZ], [xb, eaveY, eaveZ], [xb, RIDGE, 0], [xa, RIDGE, 0]],
    [[xa / 2, 0], [xb / 2, 0], [xb / 2, slope / 2], [xa / 2, slope / 2]],
    [0.82, 0.82, 1, 1],
  );
  const back = quad(
    [[xb, eaveY, -eaveZ], [xa, eaveY, -eaveZ], [xa, RIDGE, 0], [xb, RIDGE, 0]],
    [[xb / 2 + 0.3, 0], [xa / 2 + 0.3, 0], [xa / 2 + 0.3, slope / 2], [xb / 2 + 0.3, slope / 2]],
    [0.82, 0.82, 1, 1],
  );
  return merge([front, back]);
}

function windowPieces(spec: WindowSpec, index: number) {
  const pieces: BufferGeometry[] = [];
  const { x, y, w, h, kind } = spec;
  const trim = 0.085;
  const trimColor = index % 3 === 0 ? COLORS.trimDirty : COLORS.trim;
  if (kind !== 'pane' && kind !== 'flicker') {
    pieces.push(part(new BoxGeometry(w, h, 0.02), COLORS.glass, { at: [x, y, 0.012] }));
  }
  // Chambranle et appui.
  pieces.push(part(new BoxGeometry(w + trim * 2, trim, 0.07), trimColor, { at: [x, y + h / 2 + trim / 2, 0.02] }));
  pieces.push(part(new BoxGeometry(trim, h, 0.07), trimColor, { at: [x - w / 2 - trim / 2, y, 0.02] }));
  pieces.push(part(new BoxGeometry(trim, h, 0.07), trimColor, { at: [x + w / 2 + trim / 2, y, 0.02] }));
  pieces.push(part(new BoxGeometry(w + 0.26, 0.07, 0.15), trimColor, { at: [x, y - h / 2 - 0.035, 0.06] }, 0.92));
  // Croisillon de la fenêtre.
  if (kind === 'dark' || kind === 'pane') {
    pieces.push(part(new BoxGeometry(0.035, h, 0.03), trimColor, { at: [x, y, 0.03] }));
    pieces.push(part(new BoxGeometry(w, 0.035, 0.03), trimColor, { at: [x, y + h * 0.08, 0.03] }));
  }
  // Planches clouées : à l'horizontale, ou en croix.
  if (kind === 'boarded') {
    const planks = 3;
    for (let plank = 0; plank < planks; plank++) {
      const key = index * 7.1 + plank * 2.3;
      const py = y - h * 0.33 + (plank / (planks - 1)) * h * 0.66 + (hash(key) - 0.5) * 0.08;
      pieces.push(part(new BoxGeometry(w + 0.3, 0.17, 0.035), COLORS.plank[plank % 3], {
        at: [x + (hash(key + 1) - 0.5) * 0.08, py, 0.07],
        rot: [0, 0, (hash(key + 2) - 0.5) * 0.3],
      }));
    }
  } else if (kind === 'crossed') {
    for (const sign of [1, -1]) {
      pieces.push(part(new BoxGeometry(Math.hypot(w, h) + 0.12, 0.16, 0.035), COLORS.plank[sign > 0 ? 0 : 2], {
        at: [x, y, sign > 0 ? 0.07 : 0.1],
        rot: [0, 0, sign * Math.atan2(h, w)],
      }));
    }
  }
  return pieces;
}

function buildDetails() {
  const pieces: BufferGeometry[] = [];
  // Soubassement en béton.
  pieces.push(part(new BoxGeometry(HOUSE.width + 0.16, FLOOR + 0.3, HOUSE.depth + 0.16), COLORS.plinth, { at: [0, (FLOOR - 0.3) / 2, 0] }));
  // Planches d'angle et bandeau entre les étages.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    pieces.push(part(new BoxGeometry(0.15, EAVE - FLOOR, 0.15), COLORS.trimDirty, { at: [sx * W, (EAVE + FLOOR) / 2, sz * D] }));
  }
  const band = FLOOR + HOUSE.ground;
  pieces.push(part(new BoxGeometry(HOUSE.width + 0.12, 0.11, 0.08), COLORS.trimDirty, { at: [0, band, D + 0.02] }));
  pieces.push(part(new BoxGeometry(HOUSE.width + 0.12, 0.11, 0.08), COLORS.trimDirty, { at: [0, band, -D - 0.02] }));
  pieces.push(part(new BoxGeometry(0.08, 0.11, HOUSE.depth + 0.12), COLORS.trimDirty, { at: [-W - 0.02, band, 0] }));
  pieces.push(part(new BoxGeometry(0.08, 0.11, HOUSE.depth + 0.12), COLORS.trimDirty, { at: [W + 0.02, band, 0] }));
  // Fenêtres (dans le repère de leur mur).
  WINDOWS.forEach((spec, index) => {
    const matrix = wallMatrix(spec.side);
    windowPieces(spec, index).forEach((piece) => pieces.push(piece.applyMatrix4(matrix)));
  });
  // Encadrement de porte arraché : un montant debout, l'autre penché, la porte au sol.
  pieces.push(part(new BoxGeometry(0.1, 2.1, 0.09), COLORS.trimDirty, { at: [-0.86, FLOOR + 1.05, D + 0.03], rot: [0, 0, 0.04] }));
  pieces.push(part(new BoxGeometry(0.1, 1.5, 0.09), COLORS.trimDirty, { at: [0.72, FLOOR + 0.75, D + 0.1], rot: [0.18, 0, -0.22] }));
  // Marche de seuil.
  pieces.push(part(new BoxGeometry(1.5, 0.16, 0.42), COLORS.plinth, { at: [-0.15, 0.04, D + 0.24] }, 0.95));
  // Avancée du toit : sous-face sombre, rives et faîtage.
  const eaveY = EAVE - OVERHANG * PITCH;
  const eaveZ = D + OVERHANG;
  const slopeLength = Math.hypot(eaveZ, RIDGE - eaveY);
  const slopeAngle = Math.atan2(RIDGE - eaveY, eaveZ);
  for (const sign of [1, -1]) {
    // Épaisseur du pan (sous-face visible depuis le bas).
    pieces.push(part(new BoxGeometry(HOUSE.width + SIDE_OVERHANG * 2, 0.12, slopeLength), COLORS.under, {
      at: [0, (eaveY + RIDGE) / 2 - 0.13, (sign * eaveZ) / 2],
      rot: [sign * slopeAngle, 0, 0],
    }));
    // Bordure de rive (planche de bord du pignon), de chaque côté.
    for (const side of [-1, 1]) {
      pieces.push(part(new BoxGeometry(0.07, 0.2, slopeLength + 0.05), COLORS.trimDirty, {
        at: [side * (W + SIDE_OVERHANG), (eaveY + RIDGE) / 2 - 0.02, (sign * eaveZ) / 2],
        rot: [sign * slopeAngle, 0, 0],
      }));
    }
    // Planche de rive le long de l'égout, et gouttière.
    pieces.push(part(new BoxGeometry(HOUSE.width + SIDE_OVERHANG * 2, 0.17, 0.06), COLORS.trimDirty, { at: [0, eaveY - 0.06, sign * (eaveZ + 0.01)] }));
  }
  pieces.push(part(new CylinderGeometry(0.06, 0.06, HOUSE.width + 0.3, 8), COLORS.metal, { at: [0, eaveY - 0.14, eaveZ + 0.08], rot: [0, 0, Math.PI / 2] }, 0.8));
  pieces.push(part(new CylinderGeometry(0.045, 0.045, eaveY - 0.25, 8), COLORS.metal, { at: [W - 0.16, (eaveY - 0.25) / 2, D + 0.1] }, 0.8));
  pieces.push(part(new BoxGeometry(0.08, 0.08, eaveZ - D + 0.02), COLORS.metal, { at: [W - 0.16, eaveY - 0.24, (eaveZ + D) / 2 + 0.05] }, 0.8));
  pieces.push(part(new BoxGeometry(HOUSE.width + SIDE_OVERHANG * 2 + 0.05, 0.13, 0.26), COLORS.ridge, { at: [0, RIDGE + 0.02, 0] }));
  // Cheminée de briques, côté droit, derrière le faîte.
  pieces.push(part(new BoxGeometry(0.56, 2.3, 0.56), COLORS.chimney, { at: [1.45, RIDGE - 0.45, -0.85] }));
  pieces.push(part(new BoxGeometry(0.7, 0.14, 0.7), COLORS.cap, { at: [1.45, RIDGE + 0.76, -0.85] }));
  // Antenne râteau et parabole : le QG écoute.
  const mastX = -1.75;
  pieces.push(part(new CylinderGeometry(0.035, 0.04, 2.6, 6), COLORS.metal, { at: [mastX, RIDGE + 1.2, -0.05] }));
  for (const [y, length] of [[RIDGE + 1.6, 1.2], [RIDGE + 2.05, 0.95], [RIDGE + 2.42, 0.7]]) {
    pieces.push(part(new CylinderGeometry(0.018, 0.018, length, 5), COLORS.metal, { at: [mastX, y, -0.05], rot: [0, 0.5, Math.PI / 2] }));
  }
  pieces.push(part(new SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), '#c9cbc6', {
    at: [0.55, RIDGE - 0.55, -1.15],
    rot: [-1.0, 0.4, 0],
    scale: [1, 0.45, 1],
  }));
  pieces.push(part(new CylinderGeometry(0.03, 0.03, 0.5, 5), COLORS.metal, { at: [0.55, RIDGE - 0.75, -1.2] }));
  return merge(pieces);
}

/** Fenêtre de l'étage : un néon fatigué à l'intérieur, qui grésille jour et nuit. */
function FlickerWindow({ spec }: { spec: WindowSpec }) {
  const material = useRef<MeshStandardMaterial>(null);
  const matrix = useMemo(() => wallMatrix(spec.side), [spec.side]);
  useFrame(() => {
    const target = material.current;
    if (!target) return;
    const night = skyState.dayNight;
    target.emissiveIntensity = (0.35 + night * 2.1) * flicker.window;
  });
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <mesh position={[spec.x, spec.y, 0.012]} raycast={() => null}>
        <planeGeometry args={[spec.w, spec.h]} />
        <meshStandardMaterial ref={material} color="#3a4440" emissive="#dce9a6" emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

function PaneWindow({ spec, seed }: { spec: WindowSpec; seed: number }) {
  const matrix = useMemo(() => wallMatrix(spec.side), [spec.side]);
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <WindowPane seed={seed} width={spec.w} height={spec.h} lit="#e8d98a" glass="#2a353a" position={[spec.x, spec.y, 0.012]} />
    </group>
  );
}

const WALL_TINT = new Color('#ffffff');

export function House({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const walls = useMemo(() => buildWalls(), []);
  const roof = useMemo(() => buildRoof(), []);
  const details = useMemo(() => buildDetails(), []);
  const wallMaterial = useMemo(
    () => new MeshStandardMaterial({ map: sidingTexture(), vertexColors: true, roughness: 0.94, color: WALL_TINT }),
    [],
  );
  const roofMaterial = useMemo(
    () => new MeshStandardMaterial({ map: shingleTexture(), vertexColors: true, roughness: 0.9 }),
    [],
  );
  const detailMaterial = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, flatShading: true }), []);

  useEffect(() => () => {
    walls.dispose();
    roof.dispose();
    details.dispose();
    wallMaterial.dispose();
    roofMaterial.dispose();
    detailMaterial.dispose();
  }, [details, detailMaterial, roof, roofMaterial, wallMaterial, walls]);

  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={walls} material={wallMaterial} castShadow receiveShadow />
      <mesh geometry={roof} material={roofMaterial} castShadow receiveShadow />
      <mesh geometry={details} material={detailMaterial} castShadow receiveShadow />
      {WINDOWS.map((spec, index) =>
        spec.kind === 'flicker' ? (
          <FlickerWindow key={index} spec={spec} />
        ) : spec.kind === 'pane' ? (
          <PaneWindow key={index} spec={spec} seed={index * 3.7 + 11} />
        ) : null,
      )}
    </group>
  );
}

/** Hauteur de pose de la maison (le soubassement s'enfonce un peu dans le sol). */
export const HOUSE_BASE = YARD_HEIGHT - 0.03;
export const HOUSE_HEIGHTS = { floor: FLOOR, eave: EAVE, ridge: RIDGE };
