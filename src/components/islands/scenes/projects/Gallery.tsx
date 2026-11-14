'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { focusItem } from '@/lib/focus';
import type { Project } from '@/types';
import { Hotspot } from '../../kit';
import { Maquette, type V3 } from './builder';
import { TOWN, sitePosition, siteRotation } from './layout';
import { glass, glow, paint } from './materials';
import { Screen, type Crop } from './Screens';
import { Plaque, SignText, signFrame } from './signs';
import { CURB } from './Town';
import { Windows, type WindowSpec } from './Windows';

/**
 * 02 — EIZO FRANCE, la galerie : un pavillon blanc d'art et de technique, toit en sheds
 * de galerie (verrières qui s'allument le soir), façade vitrée sous un auvent. EIZO fait
 * des moniteurs professionnels : de grands écrans sur pied et sur chevalet exposent la
 * page « Les Rencontres EIZO » (les vraies captures), d'autres sont accrochés au fond de
 * la salle, et une charte de couleurs d'étalonnage est peinte sur le mur latéral.
 */

const BLUE = '#3f8cff';
const WHITE = '#f7f5f0';
const FRAME = '#2b2f36';

const [SX, SZ] = sitePosition('gallery');
const RY = siteRotation('gallery');

/** Pavillon (repère local, +z = façade vitrée). */
const P = { x0: -2.8, x1: 2.8, z0: -1.95, z1: 0.8, h: 3.15 };
const CANOPY = 1.75;

/** Les 24 teintes d'une charte d'étalonnage classique (neutre : aucune marque). */
const CHECKER = [
  '#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa',
  '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e',
  '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1',
  '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a79', '#555555', '#343434',
];

/** Moniteur à cadre fin (écran face +Z) ; renvoie le centre de la dalle. */
function monitor(m: Maquette, center: V3, width: number, height: number, rotationY = 0, bezel = 0.05) {
  m.box([width + bezel * 2, height + bezel * 2, 0.08], [center[0], center[1], center[2] - 0.045], FRAME, [0, rotationY, 0]);
}

function buildGallery() {
  const m = new Maquette();
  const lights = new Maquette();
  const panes = new Maquette();
  const { x0, x1, z0, z1, h } = P;

  // Parvis en pierre claire et joints.
  m.block(-3.4, 0, -2.1, 3.3, CURB - 0.012, 2.55, '#e8dcc4', 0.04);
  for (let joint = -3; joint <= 3; joint++) m.block(joint - 0.015, CURB - 0.012, z1, joint + 0.015, CURB - 0.008, 2.55, '#d3c3a5', 0);

  // Socle, sol intérieur, murs.
  m.block(x0 - 0.06, 0.05, z0 - 0.06, x1 + 0.06, 0.16, z1 + 0.06, '#d9d4ca');
  m.block(x0 + 0.1, 0.16, z0 + 0.1, x1 - 0.1, 0.19, z1 - 0.05, '#c9a77c', 0);
  m.block(x0, 0.16, z0, x1, h, z0 + 0.14, WHITE);
  m.block(x0, 0.16, z0, x0 + 0.14, h, z1, WHITE);
  m.block(x1 - 0.14, 0.16, z0, x1, h, z1, WHITE);
  // Façade vitrée : montants fins, porte ouverte au centre.
  for (const mx of [x0 + 0.07, -1.35, -0.5, 0.5, 1.35, x1 - 0.07]) m.block(mx - 0.035, 0.16, z1 - 0.06, mx + 0.035, h, z1, FRAME, 0);
  m.block(x0, h - 0.12, z1 - 0.06, x1, h, z1, FRAME, 0);
  panes.box([x1 - x0 - 0.2, h - 0.3, 0.02], [0, (h + 0.16) / 2 - 0.05, z1 - 0.03], '#ffffff');

  // Toit-terrasse débordant en auvent, liseré bleu, deux poteaux fins.
  m.block(x0 - 0.25, h, z0 - 0.15, x1 + 0.25, h + 0.22, CANOPY, WHITE);
  m.block(x0 - 0.26, h + 0.02, CANOPY, x1 + 0.26, h + 0.2, CANOPY + 0.05, BLUE);
  lights.block(x0 - 0.1, h - 0.02, CANOPY - 0.2, x1 + 0.1, h, CANOPY - 0.12, '#dfeaff');
  for (const cx of [x0 + 0.15, x1 - 0.15]) m.cylinder(0.05, 0.05, h - 0.1, [cx, (h + 0.1) / 2, CANOPY - 0.18], FRAME, 8);

  // Sheds de galerie : trois dents de scie, faces vitrées tournées vers la place.
  const teeth = [1.15, -0.05, -1.25];
  for (const front of teeth) {
    m.extrude(
      [
        [0, 0],
        [0, 0.72],
        [-1.15, 0],
      ],
      x1 - x0 - 0.1,
      [0, h + 0.22, front],
      WHITE,
      [0, Math.PI / 2, 0],
    );
  }

  // Intérieur : deux moniteurs au mur du fond, un banc, un socle.
  monitor(m, [-1.25, 1.75, z0 + 0.2], 1.3, 0.81);
  monitor(m, [1.25, 1.75, z0 + 0.2], 1.3, 0.81);
  m.block(-0.7, 0.19, -0.75, 0.7, 0.42, -0.45, '#ffffff');
  lights.block(x0 + 0.2, h - 0.08, z0 + 0.16, x1 - 0.2, h - 0.04, z0 + 0.2, '#fff4dc');

  // Grand moniteur sur pied (la page « Les Rencontres EIZO »).
  const big = { x: -1.7, y: 1.75, z: 2.05, w: 2.0, h: 1.25 };
  monitor(m, [big.x, big.y, big.z], big.w, big.h, 0, 0.045);
  m.block(big.x - 0.06, 0.1, big.z - 0.14, big.x + 0.06, big.y - big.h / 2, big.z - 0.06, FRAME);
  m.box([0.9, 0.06, 0.5], [big.x, 0.13, big.z - 0.1], FRAME);

  // Chevalet de peintre en bois, avec un moniteur posé dessus.
  const easel = { x: 1.75, z: 2.0, ry: -0.22 };
  const ce = Math.cos(easel.ry);
  const se = Math.sin(easel.ry);
  const at = (lx: number, ly: number, lz: number): V3 => [easel.x + lx * ce + lz * se, ly, easel.z - lx * se + lz * ce];
  m.beam(at(-0.55, 0.1, 0.25), at(-0.12, 2.3, -0.05), 0.07, '#a87548');
  m.beam(at(0.55, 0.1, 0.25), at(0.12, 2.3, -0.05), 0.07, '#a87548');
  m.beam(at(0, 0.1, -0.7), at(0, 2.0, -0.12), 0.06, '#8c5f39');
  m.box([1.2, 0.07, 0.16], at(0, 0.98, 0.14), '#a87548', [0, easel.ry, 0]);
  monitor(m, at(0, 1.48, 0.16), 1.3, 0.81, easel.ry, 0.04);

  // Charte de couleurs peinte sur le mur latéral droit (face +X).
  const tile = 0.34;
  for (let index = 0; index < CHECKER.length; index++) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const z = -1.45 + col * (tile + 0.05);
    const y = 2.55 - row * (tile + 0.05);
    m.box([0.03, tile, tile], [x1 + 0.015, y, z], CHECKER[index], [0, 0, 0], 0);
  }
  m.box([0.02, 4 * (tile + 0.05) + 0.1, 6 * (tile + 0.05) + 0.1], [x1 + 0.005, 2.55 - 1.5 * (tile + 0.05), -1.45 + 2.5 * (tile + 0.05)], '#1d2026', [0, 0, 0], 0);

  // Oriflammes bleues accrochées sous l'auvent.
  for (const bx of [x0 + 0.55, x1 - 0.55]) {
    m.box([0.5, 1.5, 0.03], [bx, h - 0.95, CANOPY - 0.1], BLUE, [0, 0, 0], 0);
    m.box([0.5, 0.08, 0.035], [bx, h - 1.55, CANOPY - 0.1], '#ffffff', [0, 0, 0], 0);
    m.rod([bx - 0.3, h - 0.18, CANOPY - 0.1], [bx + 0.3, h - 0.18, CANOPY - 0.1], 0.02, FRAME);
  }

  // Totem de la galerie (porte la plaque du numéro).
  m.block(-3.25, 0.1, 1.95, -2.75, 2.7, 2.15, WHITE);
  m.block(-3.27, 0.1, 2.15, -2.73, 0.45, 2.17, BLUE, 0);
  lights.block(-3.27, 0.5, 2.15, -3.21, 2.6, 2.18, '#9ec2ff');

  return { body: m.build(), lights: lights.build(), panes: panes.build(), big, easel };
}

function galleryWindows() {
  // Verrières des sheds (s'allument le soir comme les fenêtres de la ville).
  const list: WindowSpec[] = [];
  const teeth = [1.15, -0.05, -1.25];
  teeth.forEach((front, index) => {
    list.push({ at: [0, P.h + 0.22 + 0.36, front + 0.012], width: P.x1 - P.x0 - 0.3, height: 0.6, seed: 11 + index * 2, lit: '#fff1d0', glass: '#4f78b8' });
  });
  return list;
}

/** Recadrages (même rapport 16/10 que les écrans) : la grille « bento », le titre. */
const BENTO: Crop = [0.47, 0.21, 1.0, 0.74];
const BENTO_LOW: Crop = [0.47, 0.47, 1.0, 1.0];
const HERO: Crop = [0.0, 0.17, 0.5, 0.67];
const HERO_LOW: Crop = [0.0, 0.45, 0.5, 0.95];

export function Gallery({ project }: { project: Project }) {
  const parts = useMemo(() => buildGallery(), []);
  const windows = useMemo(() => galleryWindows(), []);
  const sign = useMemo(() => {
    const m = new Maquette();
    const text = signFrame(m, [2.85, CURB, 2.2], -0.12, 1.9, 1.1);
    return { geometry: m.build(), text };
  }, []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.lights.dispose();
      parts.panes.dispose();
      sign.geometry.dispose();
    },
    [parts, sign],
  );
  const shots = project.screenshots ?? [];
  const main = shots[0];
  const second = shots[1] ?? shots[0];
  const { big, easel } = parts;
  const easelScreen: V3 = [
    easel.x + 0.16 * Math.sin(easel.ry) + 0.0,
    1.48,
    easel.z + 0.16 * Math.cos(easel.ry),
  ];
  const banner = useRef<Group>(null);
  useFrame((state) => {
    if (banner.current) banner.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.3) * 0.04;
  });

  return (
    <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.04} position={[SX, TOWN.level, SZ]} rotation={[0, RY, 0]}>
      <mesh geometry={parts.body} material={paint} castShadow receiveShadow />
      <mesh geometry={parts.lights} material={glow} />
      <mesh geometry={parts.panes} material={glass} />
      <Windows windows={windows} />
      <Screen width={big.w} height={big.h} url={main} fallback="bento" position={[big.x, big.y, big.z + 0.006]} />
      <Screen width={1.3} height={0.81} url={second} fallback="form" position={easelScreen} rotation={[0, easel.ry, 0]} />
      <Screen width={1.3} height={0.81} url={main} fallback="bento" crop={BENTO} pan={[BENTO, BENTO_LOW]} position={[-1.25, 1.75, P.z0 + 0.21]} />
      <Screen width={1.3} height={0.81} url={main} fallback="grid" crop={HERO} pan={[HERO, HERO_LOW]} panSpeed={0.07} position={[1.25, 1.75, P.z0 + 0.21]} />
      <Plaque index={project.index} accent={project.accent} size={0.62} position={[-3.0, 2.25, 2.16]} />
      <group ref={banner} />
      <mesh geometry={sign.geometry} material={paint} castShadow />
      <SignText lines={[project.title]} accent={project.accent} width={1.9} position={sign.text} rotation={[0, -0.12, 0]} />
    </Hotspot>
  );
}
