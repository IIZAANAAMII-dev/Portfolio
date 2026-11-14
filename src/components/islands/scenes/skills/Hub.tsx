'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { windowMaterial } from '@/lib/windows';
import type { SkillZoneId } from '@/types';
import { useClearing } from '../../kit';
import { flatRing, Merger, pose, topAndSides } from './geometry';
import { DOCK_ANGLE, HUB, PLAZA_TOP, ZONE_SPOTS } from './layout';
import { glassMaterial, glowMaterial, labState, paintMaterial } from './materials';
import { noRaycast } from './Zone';

/**
 * LE NOYAU — au centre du laboratoire, une place ronde et un petit observatoire à
 * coupole de verre. Dedans, un cristal lumineux tourne entre deux anneaux ; au-dessus,
 * un mât porte un anémomètre (on reste au bord de la mer) et une balise qui pulse. Les
 * allées partent de la place vers chaque zone, avec leurs lignes de lumière.
 */

const DRUM_TOP = PLAZA_TOP + 0.78;
const DOME = 1.24;
const CORE_Y = DRUM_TOP + 0.6;
const MAST_BASE = DRUM_TOP + DOME + 0.04;
const MAST_TOP = MAST_BASE + 1.9;

function buildStatic(accent: string, accents: Record<SkillZoneId, string>) {
  const paint = new Merger();
  const glow = new Merger();
  // Place : dalle claire, deux cercles de pierre.
  paint.add(
    new CylinderGeometry(HUB.radius, HUB.radius + 0.06, 0.7, 36),
    topAndSides('#e8e0d0', '#c8bba6'),
    pose([0, PLAZA_TOP - 0.35, 0]),
    0.05,
  );
  paint.add(flatRing(HUB.radius - 0.32, HUB.radius - 0.24, 36), '#cfc0a6', pose([0, PLAZA_TOP + 0.003, 0]), 0);
  paint.add(flatRing(1.36, 1.43, 36), '#cfc0a6', pose([0, PLAZA_TOP + 0.003, 0]), 0);
  // Tambour crème, soubassement, corniche.
  paint.cylinder(1.2, 1.26, 0.78, 28, '#f3ead8', [0, PLAZA_TOP + 0.39, 0], undefined, 0.06);
  paint.cylinder(1.29, 1.3, 0.12, 28, '#d8cbb3', [0, PLAZA_TOP + 0.06, 0]);
  paint.cylinder(1.33, 1.29, 0.08, 28, '#d8cbb3', [0, DRUM_TOP, 0]);
  // Porte tournée vers l'escalier du ponton.
  const doorTurn = Math.atan2(Math.cos(DOCK_ANGLE), Math.sin(DOCK_ANGLE));
  paint.group(pose([0, 0, 0], [0, doorTurn, 0]), () => {
    paint.box([0.5, 0.56, 0.12], '#3d4658', [0, PLAZA_TOP + 0.28, 1.2]);
    paint.cylinder(0.25, 0.25, 0.12, 12, '#3d4658', [0, PLAZA_TOP + 0.56, 1.2], [Math.PI / 2, 0, 0]);
    paint.box([0.6, 0.06, 0.3], '#d8cbb3', [0, PLAZA_TOP + 0.03, 1.36]);
  });
  // Nervures de la coupole, lanterneau.
  for (let index = 0; index < 6; index++) {
    paint.torus(DOME + 0.01, 0.028, '#ebe2d0', [0, DRUM_TOP + 0.03, 0], [0, (index / 6) * Math.PI, 0], Math.PI, [5, 20]);
  }
  paint.torus(DOME * Math.cos(Math.PI / 4) + 0.01, 0.026, '#ebe2d0', [0, DRUM_TOP + 0.03 + DOME * Math.sin(Math.PI / 4), 0], [Math.PI / 2, 0, 0]);
  paint.cylinder(0.2, 0.24, 0.12, 12, '#d8cbb3', [0, DRUM_TOP + DOME + 0.02, 0]);
  // Mât, vergues.
  paint.cylinder(0.035, 0.05, MAST_TOP - MAST_BASE, 6, '#d3dbe4', [0, (MAST_BASE + MAST_TOP) / 2, 0], undefined, 0);
  paint.box([0.6, 0.035, 0.035], '#d3dbe4', [0, MAST_BASE + 0.9, 0], [0, 0.6, 0], 0);
  paint.box([0.4, 0.03, 0.03], '#d3dbe4', [0, MAST_BASE + 1.25, 0], [0, -0.4, 0], 0);
  // Bancs sur la place, face aux zones.
  for (const angle of [DOCK_ANGLE + 1.1, DOCK_ANGLE - 1.15]) {
    const x = Math.cos(angle) * 1.85;
    const z = Math.sin(angle) * 1.85;
    const turn = Math.atan2(x, z);
    paint.group(pose([x, PLAZA_TOP, z], [0, turn, 0]), () => {
      paint.box([0.8, 0.06, 0.28], '#9b6b45', [0, 0.32, 0]);
      for (const side of [-0.32, 0.32]) paint.box([0.06, 0.3, 0.24], '#6e4a33', [side, 0.15, 0]);
    });
  }
  // Voyants sur le tambour, au-dessus de chaque allée, à la couleur de la zone.
  for (const spot of ZONE_SPOTS) {
    const angle = Math.atan2(spot.z, spot.x);
    const turn = Math.atan2(Math.cos(angle), Math.sin(angle));
    glow.group(pose([0, 0, 0], [0, turn, 0]), () => {
      glow.cylinder(0.075, 0.075, 0.03, 12, accents[spot.id], [0, PLAZA_TOP + 0.5, 1.235], [Math.PI / 2, 0, 0], 0);
    });
  }
  glow.cylinder(0.06, 0.06, 0.02, 10, accent, [0, MAST_BASE + 0.9, 0], undefined, 0);
  return { paint: paint.build(), glow: glow.build() };
}

function portholes() {
  const parts = [1, 2, 3, 4].map((step) => {
    const angle = DOCK_ANGLE + step * ((Math.PI * 2) / 5);
    const x = Math.cos(angle) * 1.255;
    const z = Math.sin(angle) * 1.255;
    return new CircleGeometry(0.13, 14).rotateY(Math.atan2(x, z)).translate(x, PLAZA_TOP + 0.48, z);
  });
  parts.forEach((part) => part.deleteAttribute('uv'));
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

function coreGeometry(accent: string) {
  const merger = new Merger();
  merger.add(new IcosahedronGeometry(0.26, 0), new Color(accent).lerp(new Color('#ffffff'), 0.35).getStyle(), undefined, 0);
  return merger.build();
}

function orbitGeometry(accent: string) {
  const merger = new Merger();
  merger.add(new TorusGeometry(0.46, 0.016, 4, 36), accent, pose([0, 0, 0], [Math.PI / 2 + 0.4, 0, 0]), 0);
  merger.add(new TorusGeometry(0.56, 0.014, 4, 36), '#ffffff', pose([0, 0, 0], [Math.PI / 2 - 0.5, 0.6, 0]), 0);
  return merger.build();
}

function anemometerGeometry() {
  const merger = new Merger();
  for (let index = 0; index < 3; index++) {
    const angle = (index / 3) * Math.PI * 2;
    merger.rod([0, 0, 0], [Math.cos(angle) * 0.26, 0, Math.sin(angle) * 0.26], 0.012, '#d3dbe4', 4);
    merger.sphere(0.055, '#e2553f', [Math.cos(angle) * 0.28, 0, Math.sin(angle) * 0.28], [1, 1, 0.6], [8, 6], 0.05);
  }
  merger.cylinder(0.03, 0.03, 0.08, 6, '#5b6472', [0, 0, 0], undefined, 0);
  return merger.build();
}

export function Hub({ accent, accents }: { accent: string; accents: Record<SkillZoneId, string> }) {
  const core = useRef<Group>(null);
  const crystal = useRef<Mesh>(null);
  const orbits = useRef<Mesh>(null);
  const spinner = useRef<Mesh>(null);
  const beacon = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const quality = useWorld((state) => state.quality);
  useClearing(HUB.x, HUB.z, HUB.radius + 0.4);

  const built = useMemo(() => buildStatic(accent, accents), [accent, accents]);
  const windows = useMemo(() => portholes(), []);
  const portholeGlass = useMemo(() => windowMaterial(53, '#bff3ff', '#36506b', 2.2), []);
  const dome = useMemo(() => new SphereGeometry(DOME, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const crystalShape = useMemo(() => coreGeometry(accent), [accent]);
  const orbitShape = useMemo(() => orbitGeometry(accent), [accent]);
  const anemometer = useMemo(() => anemometerGeometry(), []);
  const beaconShape = useMemo(() => new Merger().sphere(0.1, accent, [0, 0, 0], 1, [10, 8], 0).build(), [accent]);

  useEffect(
    () => () => {
      [built.paint, built.glow, windows, dome, crystalShape, orbitShape, anemometer, beaconShape].forEach((geometry) => geometry.dispose());
    },
    [anemometer, beaconShape, built, crystalShape, dome, orbitShape, windows],
  );

  useFrame((state) => {
    if (!labState.awake) return;
    const t = state.clock.elapsedTime;
    if (core.current) core.current.position.y = CORE_Y + Math.sin(t * 1.2) * 0.06;
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.8;
      crystal.current.rotation.x = Math.sin(t * 0.5) * 0.4;
    }
    if (orbits.current) {
      orbits.current.rotation.y = -t * 0.9;
      orbits.current.rotation.z = Math.sin(t * 0.4) * 0.3;
    }
    if (spinner.current) spinner.current.rotation.y = -t * (3.2 + Math.sin(t * 0.3) * 1.2);
    if (beacon.current) beacon.current.scale.setScalar(0.85 + Math.max(0, Math.sin(t * 2.2)) * 0.45);
    if (light.current) light.current.intensity = skyState.dayNight * 5.5 * (0.85 + Math.sin(t * 1.2) * 0.15);
  });

  return (
    <group position={[HUB.x, HUB.level, HUB.z]}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={windows} material={portholeGlass} raycast={noRaycast} />
      <group ref={core} position-y={CORE_Y}>
        <mesh ref={crystal} geometry={crystalShape} material={glowMaterial} raycast={noRaycast} />
        <mesh ref={orbits} geometry={orbitShape} material={glowMaterial} raycast={noRaycast} />
        {quality === 'high' && <pointLight ref={light} color={accent} intensity={0} distance={9} decay={2} />}
      </group>
      <mesh geometry={dome} material={glassMaterial} position-y={DRUM_TOP + 0.03} raycast={noRaycast} />
      <mesh ref={spinner} geometry={anemometer} material={paintMaterial} position-y={MAST_BASE + 1.55} raycast={noRaycast} />
      <mesh ref={beacon} geometry={beaconShape} material={glowMaterial} position-y={MAST_TOP + 0.08} raycast={noRaycast} />
    </group>
  );
}
