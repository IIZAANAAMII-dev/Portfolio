'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import type { Project } from '@/types';
import { Hotspot } from '../../kit';
import { Maquette, type V3 } from './builder';
import { TOWN, VIEWPOINT, faceToward, facing, polar, sitePosition } from './layout';
import { glow, paint } from './materials';
import { Plaque, SignText, signFrame } from './signs';
import { CURB } from './Town';

/**
 * 05 — FEEDER GRAPHIC · INDUSTRIE · DÉFENSE : un vrai chantier. Ces trois sites ne sont
 * pas terminés, et ça se voit : palissade jaune, grue à tour qui pivote, échafaudages,
 * bâches, bétonnière qui tourne. Trois petits bâtiments en cours : l'atelier créatif (un
 * pinceau géant, une palette), l'atelier industriel (un engrenage qui tourne, une presse)
 * et le centre de défense (un bunker en coffrage, son radar en essai).
 */

const YELLOW = '#ffc83d';
const TIMBER = '#c58a55';
const STEEL = '#4b525c';
const CONCRETE = '#b9b5ab';

const [SX, SZ] = sitePosition('workshops');
const ANGLES = [-2.0, -1.62, -1.24];
const HUT_R = 11.35;

/** Pose (repère du site) d'une case : position relative au centre du site et rotation. */
function hutPose(index: number) {
  const [x, z] = polar(ANGLES[index], HUT_R);
  return { at: [x - SX, 0, z - SZ] as V3, ry: facing(x, z, 0.6) };
}

/** Ajoute une pièce dans le repère d'une case (rotation autour de Y). */
function local(at: V3, ry: number) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return (x: number, y: number, z: number): V3 => [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c];
}

function buildSite(names: string[]) {
  const m = new Maquette();
  const lights = new Maquette();
  const textSpots: { at: V3; ry: number; lines: string[]; width: number }[] = [];

  /* Case A — atelier créatif : ossature bois à moitié bardée, pinceau géant, palette. */
  {
    const { at, ry } = hutPose(0);
    const p = local(at, ry);
    const rot: V3 = [0, ry, 0];
    m.box([2.5, 0.16, 2.2], p(0, 0.08, 0), CONCRETE, rot);
    for (const [x, z] of [[-1.1, -0.95], [1.1, -0.95], [-1.1, 0.95], [1.1, 0.95]]) m.box([0.13, 2.2, 0.13], p(x, 1.26, z), TIMBER, rot);
    m.box([2.35, 0.12, 0.13], p(0, 2.3, 0.95), TIMBER, rot);
    m.box([2.35, 0.12, 0.13], p(0, 2.3, -0.95), TIMBER, rot);
    for (const x of [-1.1, 0, 1.1]) {
      m.box([0.1, 0.1, 1.42], p(x, 2.68, 0.5), TIMBER, [0.58, ry, 0]);
      m.box([0.1, 0.1, 1.42], p(x, 2.68, -0.5), TIMBER, [-0.58, ry, 0]);
    }
    // Pan arrière couvert, pan avant encore ouvert.
    m.box([2.5, 0.07, 1.5], p(0, 2.74, -0.5), '#a0613c', [-0.58, ry, 0]);
    m.box([2.2, 2.1, 0.08], p(0, 1.25, -0.95), '#e2c79a', rot);
    // Panneaux de couleur (cyan, magenta, jaune) posés sur le flanc gauche.
    ['#2ec5e8', '#e8418e', YELLOW].forEach((color, index) => {
      m.box([0.08, 0.66, 0.6], p(-1.12, 0.5 + index * 0.68, -0.55 + (index % 2) * 0.45), color, rot);
    });
    m.box([0.06, 1.4, 1.0], p(1.15, 0.9, 0.35), '#3b7fd1', [0, ry, 0.06]);
    // Pinceau géant appuyé contre la façade.
    m.rod(p(-1.75, 0.1, 1.05), p(-1.05, 2.15, 0.7), 0.075, '#d9a35f', 8);
    m.rod(p(-1.03, 2.2, 0.69), p(-0.92, 2.5, 0.63), 0.1, '#c9ced6', 8);
    m.rod(p(-0.92, 2.5, 0.63), p(-0.8, 2.95, 0.57), 0.14, '#e8418e', 8);
    m.cylinder(0.32, 0.36, 0.02, p(-1.6, 0.17, 1.25), '#e8418e', 14);
    // Palette sur le faîtage, face à la place.
    m.cylinder(0.55, 0.55, 0.05, p(0, 3.35, 0.05), '#d8b07c', 16, [Math.PI / 2, ry, 0]);
    ['#e8418e', '#2ec5e8', YELLOW, '#5bd06a', '#ffffff'].forEach((color, index) => {
      const a = 0.6 + index * 0.85;
      m.sphere(0.085, p(Math.cos(a) * 0.33, 3.35 + Math.sin(a) * 0.33, 0.1), color, 0, [1, 1, 0.5]);
    });
    m.box([0.08, 0.5, 0.08], p(0, 2.9, 0.02), TIMBER, rot);
    textSpots.push({ at: p(0.15, 1.6, 1.02), ry, lines: [names[0]], width: 1.25 });
  }

  /* Case B — atelier industriel : charpente métallique, sheds en cours, bardage partiel. */
  {
    const { at, ry } = hutPose(1);
    const p = local(at, ry);
    const rot: V3 = [0, ry, 0];
    m.box([2.6, 0.16, 2.3], p(0, 0.08, 0), CONCRETE, rot);
    for (const [x, z] of [[-1.15, -1.0], [1.15, -1.0], [-1.15, 1.0], [1.15, 1.0], [0, -1.0], [0, 1.0]]) m.box([0.12, 2.4, 0.12], p(x, 1.36, z), STEEL, rot);
    m.box([2.45, 0.12, 0.12], p(0, 2.5, 1.0), STEEL, rot);
    m.box([2.45, 0.12, 0.12], p(0, 2.5, -1.0), STEEL, rot);
    // Sheds : deux dents, une seule couverte.
    for (const x of [-0.6, 0.6]) {
      m.box([0.1, 0.62, 0.1], p(x + 0.55, 2.82, 0), STEEL, rot);
      m.box([1.25, 0.08, 0.08], p(x, 2.82, 1.0), STEEL, [0, ry, 0.45]);
      m.box([1.25, 0.08, 0.08], p(x, 2.82, -1.0), STEEL, [0, ry, 0.45]);
    }
    m.box([1.3, 0.05, 2.1], p(-0.6, 2.84, 0), '#8796a6', [0, ry, 0.45]);
    m.box([2.2, 2.25, 0.07], p(0, 1.3, -1.02), '#6f8aa3', rot);
    m.box([0.07, 1.5, 1.9], p(1.17, 0.9, 0), '#6f8aa3', rot);
    // Presse devant la case (son piston est animé à part).
    m.box([0.9, 0.3, 0.6], p(0.75, 0.31, 1.55), '#e0912f', rot);
    m.box([0.12, 1.4, 0.12], p(0.4, 0.86, 1.55), STEEL, rot);
    m.box([0.12, 1.4, 0.12], p(1.1, 0.86, 1.55), STEEL, rot);
    m.box([0.9, 0.16, 0.5], p(0.75, 1.6, 1.55), '#e0912f', rot);
    // Barres d'acier en fagot.
    for (let bar = 0; bar < 5; bar++) m.rod(p(-1.5, 0.22 + (bar % 2) * 0.09, 1.2 + bar * 0.09), p(-0.4, 0.22 + (bar % 2) * 0.09, 1.25 + bar * 0.09), 0.045, '#8b95a1', 6);
    textSpots.push({ at: p(-0.35, 1.75, 1.05), ry, lines: [names[1]], width: 1.25 });
  }

  /* Case C — centre de défense : bunker en coffrage, échafaudage, mât du radar. */
  {
    const { at, ry } = hutPose(2);
    const p = local(at, ry);
    const rot: V3 = [0, ry, 0];
    m.box([2.6, 0.16, 2.3], p(0, 0.08, 0), CONCRETE, rot);
    m.box([2.2, 1.35, 1.8], p(0, 0.83, -0.15), '#7c8a6c', rot);
    m.box([2.2, 0.6, 0.7], p(0, 0.45, 0.85), '#7c8a6c', [-0.5, ry, 0]);
    // Coffrage en planches encore en place sur la moitié droite.
    for (let plank = 0; plank < 6; plank++) m.box([0.05, 1.4, 0.22], p(1.13, 0.85, -0.95 + plank * 0.26), '#c9935a', rot);
    m.box([1.0, 0.2, 1.6], p(0.6, 1.62, -0.15), '#c9935a', rot);
    // Échafaudage côté gauche.
    for (const z of [-0.9, 0.6]) {
      m.rod(p(-1.45, 0.16, z), p(-1.45, 2.6, z), 0.035, '#d0d4d8');
      m.rod(p(-1.85, 0.16, z), p(-1.85, 2.6, z), 0.035, '#d0d4d8');
    }
    for (const y of [1.0, 1.85, 2.55]) {
      m.box([0.5, 0.05, 1.7], p(-1.65, y, -0.15), '#a5784c', rot);
      m.rod(p(-1.85, y + 0.45, -0.9), p(-1.85, y + 0.45, 0.6), 0.025, '#d0d4d8');
    }
    m.box([0.06, 1.2, 1.6], p(-1.9, 1.6, -0.15), '#4f8fd6', [0, ry, 0.08]);
    // Mât en treillis du radar.
    for (const [x, z] of [[-0.2, -0.35], [0.2, -0.35], [-0.2, 0.05], [0.2, 0.05]]) m.rod(p(x, 1.5, z), p(x * 0.4, 2.55, -0.15 + (z + 0.15) * 0.4), 0.03, STEEL);
    m.cylinder(0.14, 0.14, 0.12, p(0, 2.6, -0.15), STEEL, 10);
    lights.sphere(0.06, p(0.0, 3.55, -0.15), '#ff3b30', 0);
    textSpots.push({ at: p(-0.25, 1.15, 0.95), ry, lines: [names[2]], width: 1.25 });
  }

  /* Palissade de chantier jaune, interrompue par le portail. */
  for (let panel = 0; panel < 14; panel++) {
    const angle = -2.25 + panel * 0.093;
    if (Math.abs(angle + 1.62) < 0.12) continue;
    const [x, z] = polar(angle, 9.3);
    const ry = Math.atan2(x, z);
    const at: V3 = [x - SX, 0, z - SZ];
    m.box([0.84, 1.0, 0.06], [at[0], 0.62, at[2]], panel % 2 ? YELLOW : '#f4b72e', [0, ry + Math.PI / 2, 0]);
    m.box([0.84, 0.12, 0.065], [at[0], 0.95, at[2]], '#2f3338', [0, ry + Math.PI / 2, 0], 0);
    m.box([0.06, 1.15, 0.06], [at[0], 0.6, at[2]], '#2f3338', [0, ry, 0]);
  }

  /* Tas de briques, sable, cônes, brouette. */
  const [bx, bz] = polar(-1.43, 10.05);
  for (let brick = 0; brick < 12; brick++) {
    m.box([0.28, 0.12, 0.14], [bx - SX + (brick % 3) * 0.3 - 0.3, 0.16 + Math.floor(brick / 6) * 0.13, bz - SZ + (Math.floor(brick / 3) % 2) * 0.16], '#c4683f');
  }
  const [sx2, sz2] = polar(-1.82, 10.0);
  m.cone(0.7, 0.55, [sx2 - SX, 0.3, sz2 - SZ], '#e6c48a', 9);
  for (const angle of [-2.12, -1.95, -1.3, -1.12]) {
    const [cx, cz] = polar(angle, 9.75);
    m.cone(0.14, 0.42, [cx - SX, 0.3, cz - SZ], '#ff7a2f', 8);
    m.cylinder(0.145, 0.15, 0.07, [cx - SX, 0.19, cz - SZ], '#ffffff', 8);
    m.box([0.34, 0.04, 0.34], [cx - SX, 0.12, cz - SZ], '#2f3338');
  }

  /* Grue à tour (le mât ; la flèche pivote, voir plus bas). */
  const [gx, gz] = polar(-1.62, 13.25);
  const crane: V3 = [gx - SX, 0, gz - SZ];
  m.box([1.2, 0.35, 1.2], [crane[0], 0.27, crane[2]], CONCRETE);
  for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) m.rod([crane[0] + dx, 0.4, crane[2] + dz], [crane[0] + dx, 6.3, crane[2] + dz], 0.045, YELLOW, 6);
  for (let level = 0; level < 10; level++) {
    const y0 = 0.45 + level * 0.58;
    m.rod([crane[0] - 0.25, y0, crane[2] - 0.25], [crane[0] + 0.25, y0 + 0.58, crane[2] - 0.25], 0.025, YELLOW, 4);
    m.rod([crane[0] - 0.25, y0, crane[2] + 0.25], [crane[0] + 0.25, y0 + 0.58, crane[2] + 0.25], 0.025, YELLOW, 4);
    m.rod([crane[0] - 0.25, y0, crane[2] - 0.25], [crane[0] - 0.25, y0 + 0.58, crane[2] + 0.25], 0.025, YELLOW, 4);
    m.rod([crane[0] + 0.25, y0, crane[2] - 0.25], [crane[0] + 0.25, y0 + 0.58, crane[2] + 0.25], 0.025, YELLOW, 4);
  }
  return { body: m.build(), lights: lights.build(), textSpots, crane };
}

function buildCraneTop() {
  const m = new Maquette();
  // Pivot, cabine, flèche (+X) et contre-flèche avec son lest.
  m.cylinder(0.32, 0.32, 0.2, [0, 0.1, 0], STEEL, 10);
  m.box([0.5, 0.45, 0.45], [0.15, 0.42, 0.35], YELLOW);
  m.box([0.04, 0.25, 0.36], [0.41, 0.48, 0.35], '#9fd3f0');
  for (const side of [-0.17, 0.17]) m.rod([-1.7, 0.35, side], [5.0, 0.35, side], 0.035, YELLOW, 4);
  m.rod([-1.7, 0.72, 0], [5.0, 0.72, 0], 0.035, YELLOW, 4);
  for (let step = 0; step < 13; step++) {
    const x = -1.6 + step * 0.52;
    m.rod([x, 0.35, -0.17], [x + 0.26, 0.72, 0], 0.02, YELLOW, 4);
    m.rod([x + 0.26, 0.72, 0], [x + 0.52, 0.35, 0.17], 0.02, YELLOW, 4);
  }
  m.rod([0, 0.2, 0], [0, 1.5, 0], 0.05, YELLOW, 6);
  m.rod([0, 1.5, 0], [4.6, 0.75, 0], 0.018, '#3a3f45', 4);
  m.rod([0, 1.5, 0], [-1.6, 0.75, 0], 0.018, '#3a3f45', 4);
  m.box([0.6, 0.5, 0.55], [-1.45, 0.15, 0], CONCRETE);
  return m.build();
}

function buildLoad() {
  const m = new Maquette();
  // Câble et palette de briques suspendue (pivot au chariot).
  m.rod([0, 0, 0], [0, -2.3, 0], 0.012, '#2f3338', 4);
  m.box([0.12, 0.12, 0.12], [0, -2.36, 0], '#2f3338');
  m.box([0.6, 0.08, 0.5], [0, -2.72, 0], '#a5784c');
  for (let brick = 0; brick < 6; brick++) m.box([0.26, 0.12, 0.2], [-0.15 + (brick % 2) * 0.3, -2.62 + Math.floor(brick / 2) * 0.12, 0], '#c4683f');
  m.rod([-0.28, -2.66, 0], [0, -2.36, 0], 0.01, '#2f3338', 3);
  m.rod([0.28, -2.66, 0], [0, -2.36, 0], 0.01, '#2f3338', 3);
  return m.build();
}

function buildMixer() {
  const m = new Maquette();
  m.lathe(
    [
      [0.05, -0.42],
      [0.3, -0.3],
      [0.36, 0.0],
      [0.3, 0.25],
      [0.16, 0.42],
    ],
    [0, 0, 0],
    '#e0912f',
    12,
  );
  m.torus(0.33, 0.03, [0, 0.05, 0], '#3a3f45', [Math.PI / 2, 0, 0], 16);
  return m.build();
}

function splitTitle(title: string) {
  const parts = title.split(' · ');
  if (parts.length < 2) return [title];
  return [parts[0], parts.slice(1).join(' · ')];
}

export function Workshops({ project }: { project: Project }) {
  const names = useMemo(() => (project.parts ?? []).map((part) => part.name), [project.parts]);
  const site = useMemo(() => buildSite([names[0] ?? 'Graphic', names[1] ?? 'Industrie', names[2] ?? 'Défense']), [names]);
  const craneTop = useMemo(() => buildCraneTop(), []);
  const load = useMemo(() => buildLoad(), []);
  const mixer = useMemo(() => buildMixer(), []);

  // Panneau du titre et panneau « En chantier », de part et d'autre du portail.
  // La plaque du numéro est vissée sur la palissade, juste à gauche du portail.
  const plaque = polar(-1.785, 9.24);
  const signs = useMemo(() => {
    const m = new Maquette();
    const spots: { at: V3; ry: number }[] = [];
    for (const [angle, r] of [[-1.71, 8.95], [-1.5, 8.95]] as const) {
      const [x, z] = polar(angle, r);
      const ry = faceToward(x, z, VIEWPOINT[0], VIEWPOINT[1]);
      spots.push({ at: signFrame(m, [x - SX, CURB, z - SZ], ry, 1.9, 1.15), ry });
    }
    // Petits supports des noms de chaque case.
    return { geometry: m.build(), spots };
  }, []);
  useEffect(
    () => () => {
      site.body.dispose();
      site.lights.dispose();
      craneTop.dispose();
      load.dispose();
      mixer.dispose();
      signs.geometry.dispose();
    },
    [craneTop, load, mixer, signs, site],
  );

  const jib = useRef<Group>(null);
  const trolley = useRef<Group>(null);
  const hook = useRef<Group>(null);
  const gear = useRef<Group>(null);
  const piston = useRef<Mesh>(null);
  const radar = useRef<Group>(null);
  const drum = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);

  const hutB = hutPose(1);
  const hutC = hutPose(2);
  const toLocal = (pose: { at: V3; ry: number }, x: number, y: number, z: number) => local(pose.at, pose.ry)(x, y, z);
  const gearAt = toLocal(hutB, -0.75, 1.55, 1.12);
  const pistonAt = toLocal(hutB, 0.75, 1.15, 1.55);
  const radarAt = toLocal(hutC, 0, 2.66, -0.15);
  const [mx, mz] = polar(-1.25, 9.95);
  const jibBase = Math.atan2(-(SZ + site.crane[2]), -(SX + site.crane[0]));

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // La flèche balaie le chantier de profil (vers l'ouest), lisible depuis le ponton.
    if (jib.current) jib.current.rotation.y = -(jibBase + 1.15) + Math.sin(t * 0.16) * 0.8;
    if (trolley.current) trolley.current.position.x = 2.6 + Math.sin(t * 0.23 + 1) * 1.6;
    if (hook.current) {
      hook.current.rotation.z = Math.sin(t * 1.4) * 0.06;
      hook.current.rotation.x = Math.sin(t * 1.1 + 0.5) * 0.05;
    }
    if (gear.current) gear.current.rotation.z = t * 0.6;
    if (piston.current) piston.current.position.y = pistonAt[1] - Math.abs(Math.sin(t * 1.6)) * 0.42;
    if (radar.current) radar.current.rotation.y = t * 0.9;
    if (drum.current) drum.current.rotation.y = t * 2.2;
    if (beacon.current) beacon.current.visible = Math.sin(t * 3.4) > 0 || skyState.dayNight < 0.05;
  });

  return (
    <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.035} position={[SX, TOWN.level, SZ]}>
      <mesh geometry={site.body} material={paint} castShadow receiveShadow />
      <mesh ref={beacon} geometry={site.lights} material={glow} />
      {site.textSpots.map((spot) => (
        <SignText key={spot.lines[0]} lines={spot.lines} accent={project.accent} width={spot.width} position={spot.at} rotation={[0, spot.ry, 0]} />
      ))}
      {/* Grue : flèche qui pivote, chariot qui va et vient, charge qui se balance. */}
      <group position={[site.crane[0], 6.3, site.crane[2]]}>
        <group ref={jib}>
          <mesh geometry={craneTop} material={paint} castShadow />
          <group ref={trolley} position={[2.6, 0.33, 0]}>
            <group ref={hook}>
              <mesh geometry={load} material={paint} castShadow />
            </group>
          </group>
        </group>
      </group>
      {/* Engrenage géant de l'atelier industriel, piston de la presse. */}
      <group ref={gear} position={gearAt} rotation={[0, hutB.ry, 0]}>
        <GearMesh />
      </group>
      <mesh ref={piston} position={pistonAt} rotation={[0, hutB.ry, 0]} castShadow>
        <boxGeometry args={[0.36, 0.5, 0.36]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.5} />
      </mesh>
      {/* Radar en essai sur le bunker. */}
      <group ref={radar} position={radarAt}>
        <mesh position={[0, 0.42, 0]} rotation={[-0.35, 0, 0]} castShadow>
          <sphereGeometry args={[0.55, 14, 6, 0, Math.PI * 2, 0, 0.95]} />
          <meshStandardMaterial color="#e3e7ea" roughness={0.55} side={2} flatShading />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.4, 6]} />
          <meshStandardMaterial color={STEEL} roughness={0.6} />
        </mesh>
      </group>
      {/* Bétonnière. */}
      <group position={[mx - SX, 0.75, mz - SZ]}>
        <group ref={drum} rotation={[0.5, 0, 0]}>
          <mesh geometry={mixer} material={paint} castShadow />
        </group>
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.7, 0.12, 0.5]} />
          <meshStandardMaterial color={STEEL} roughness={0.7} />
        </mesh>
      </group>
      <mesh geometry={signs.geometry} material={paint} castShadow />
      <SignText lines={splitTitle(project.title)} accent={project.accent} width={1.9} position={signs.spots[0].at} rotation={[0, signs.spots[0].ry, 0]} />
      <SignText lines={['En chantier']} accent="#e2553f" width={1.9} position={signs.spots[1].at} rotation={[0, signs.spots[1].ry, 0]} />
      <Plaque index={project.index} accent={project.accent} size={0.9} position={[plaque[0] - SX, 0.62, plaque[1] - SZ]} rotation={[0, Math.atan2(-plaque[0], -plaque[1]), 0]} />
    </Hotspot>
  );
}

function GearMesh() {
  const geometry = useMemo(() => {
    const m = new Maquette();
    m.cylinder(0.55, 0.55, 0.16, [0, 0, 0], '#f0a32a', 18, [Math.PI / 2, 0, 0]);
    m.cylinder(0.16, 0.16, 0.2, [0, 0, 0], STEEL, 10, [Math.PI / 2, 0, 0]);
    for (let tooth = 0; tooth < 12; tooth++) {
      const a = (tooth / 12) * Math.PI * 2;
      m.box([0.18, 0.2, 0.16], [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0], '#f0a32a', [0, 0, a]);
    }
    for (let spoke = 0; spoke < 4; spoke++) {
      const a = (spoke / 4) * Math.PI * 2;
      m.box([0.75, 0.08, 0.18], [0, 0, 0], '#d68a1c', [0, 0, a]);
    }
    return m.build();
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={paint} castShadow />;
}
