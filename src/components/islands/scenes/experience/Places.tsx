'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, Object3D, Shape } from 'three';
import { experiences } from '@/data/experience';
import { ambience } from '@/lib/audio/ambience';
import { focusItem } from '@/lib/focus';
import type { IslandConfig } from '@/types';
import { Hotspot, PaintedSign } from '../../kit';
import { Builder, doubleMaterial, paintMaterial } from './build';
import { GRETA, RG } from './layout';
import { Merged, usePulse, Windows, type WindowSpec } from './parts';
import { chalkboardTexture } from './textures';

/**
 * Les deux étapes précédentes, le long du chemin des années :
 *  - RG Design (Marseille) : petit studio de création à toit en sheds, nuancier en façade
 *    (les couleurs d'un design system), auvent rayé et crayon géant ;
 *  - GRETA (formation de Concepteur Designer UI) : petite école provençale à toit de tuiles,
 *    clocheton et sa cloche, tableau noir où une maquette d'interface est croquée à la craie.
 * Chaque lieu porte son panneau peint (nom court et période, tirés des données) et ouvre
 * sa fiche au clic, avec un petit rebond.
 */

const rgEntry = experiences.find((entry) => entry.id === 'rgdesign');
const gretaEntry = experiences.find((entry) => entry.id === 'greta');

/** « août 2024 — août 2026 » → « 2024 — 2026 » ; garde le texte tel quel s'il n'a pas d'années. */
function years(period: string) {
  const found = period.match(/\d{4}/g);
  if (!found) return period;
  const first = found[0];
  const last = found[found.length - 1];
  return first === last ? first : `${first} — ${last}`;
}

/** Nom court : « RG Design Agence… » → « RG Design », « GRETA Occitanie » → « GRETA ». */
function shortName(company: string) {
  const words = company.split(/\s+/);
  return words[0].length <= 3 && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

function facing(front: number) {
  return Math.atan2(Math.cos(front), Math.sin(front));
}

/** Point d'un repère de bâtiment (x à droite de la façade, z vers l'avant) vers l'île. */
function fromBuilding([cx, cz]: readonly [number, number], front: number, x: number, z: number): [number, number] {
  const fx = Math.cos(front);
  const fz = Math.sin(front);
  // Axe x local : la façade vue de face, x vers la droite.
  const rx = -fz;
  const rz = fx;
  return [cx + fx * z - rx * x, cz + fz * z - rz * x];
}

/* ================================================================ RG DESIGN */

const SWATCHES = ['#c9a7f0', '#e2553f', '#f2c14e', '#3fb5a8', '#2f4f8f'];

/** Prisme d'un shed : pente montante, puis face verticale (vitrée). */
function shedGeometry(width: number, rise: number, depth: number) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width, 0);
  shape.lineTo(width, rise);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

function studioGeometry() {
  const b = new Builder();
  b.box([3.5, 0.32, 2.6], '#e2c7a5', [0, 0.16, 0]);
  b.box([3.4, 2.1, 2.5], '#ef9f86', [0, 1.35, 0]);
  b.box([3.5, 0.1, 2.6], '#f6efe3', [0, 2.42, 0]);
  // Toit en sheds : deux dents, pentes ardoise, faces vitrées vers le nord-ouest.
  for (const x0 of [-1.7, 0]) b.add(shedGeometry(1.7, 0.85, 2.7), '#5d6b82', [x0, 2.47, 0]);
  // Fenêtre d'atelier (encadrement), porte menthe, seuil.
  b.box([1.56, 1.24, 0.06], '#f6efe3', [-0.6, 1.38, 1.26]);
  b.box([1.7, 0.08, 0.2], '#f6efe3', [-0.6, 0.74, 1.3]);
  b.box([0.84, 1.86, 0.08], '#8fc7b4', [0.95, 1.25, 1.27]);
  b.box([0.05, 0.22, 0.05], '#d9c48a', [0.66, 1.25, 1.33]);
  b.box([1.1, 0.12, 0.5], '#e2c7a5', [0.95, 0.38, 1.48]);
  // Crayon géant appuyé contre la façade.
  const tilt = 0.26;
  b.cylinder(0.14, 0.14, 2.0, 6, '#f2c14e', [-2.0, 1.15, 0.95], [0, 0, -tilt]);
  b.cylinder(0.142, 0.142, 0.22, 6, '#c9c4bd', [-2.0 + Math.sin(tilt) * 1.1, 1.15 + Math.cos(tilt) * 1.1, 0.95], [0, 0, -tilt]);
  b.cylinder(0.14, 0.14, 0.26, 6, '#f09ab0', [-2.0 + Math.sin(tilt) * 1.33, 1.15 + Math.cos(tilt) * 1.33, 0.95], [0, 0, -tilt]);
  b.cone(0.14, 0.34, 6, '#e8c9a0', [-2.0 - Math.sin(tilt) * 1.17, 1.15 - Math.cos(tilt) * 1.17, 0.95], [0, 0, Math.PI - tilt]);
  // Banc et pot de fleurs.
  b.box([1.1, 0.06, 0.36], '#9b6b45', [1.1, 0.48, 2.05]);
  for (const dx of [-0.4, 0.4]) b.box([0.06, 0.42, 0.3], '#5a4636', [1.1 + dx, 0.24, 2.05]);
  b.cylinder(0.2, 0.15, 0.32, 8, '#c8643b', [-1.45, 0.16, 1.75]);
  b.sphere(0.24, '#d8473a', [-1.45, 0.45, 1.75], [1, 0.7, 1], [7, 5]);
  return b.build();
}

/** Auvent rayé (toile double face) au-dessus de la fenêtre. */
function awningGeometry() {
  const b = new Builder();
  for (let k = 0; k < 6; k++) {
    b.box([0.28, 0.03, 0.75], k % 2 ? '#f6efe3' : '#9c7fd9', [-1.31 + k * 0.28 + 0.14, 2.0, 1.55], [0.42, 0, 0]);
  }
  for (let k = 0; k < 6; k++) {
    b.box([0.28, 0.14, 0.02], k % 2 ? '#f6efe3' : '#9c7fd9', [-1.31 + k * 0.28 + 0.14, 1.79, 1.87]);
  }
  return b.build();
}

const STUDIO_WINDOWS: WindowSpec[] = [
  { seed: 83, at: [-0.6, 1.38, 1.295], width: 1.4, height: 1.08 },
  // Faces vitrées des sheds.
  { seed: 89, at: [0.005, 2.9, 0], turn: Math.PI / 2, width: 2.5, height: 0.7 },
  { seed: 97, at: [1.705, 2.9, 0], turn: Math.PI / 2, width: 2.5, height: 0.7 },
  { seed: 101, at: [1.705, 1.22, -0.25], turn: Math.PI / 2, width: 0.9, height: 0.75 },
];

function Swatches({ kickAt }: { kickAt: { current: number } }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const color = new Color();
    SWATCHES.forEach((swatch, index) => target.setColorAt(index, color.set(swatch)));
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const t = state.clock.elapsedTime;
    const since = t - kickAt.current;
    // Toutes les dix secondes, une vague parcourt le nuancier ; au clic, les cases pivotent.
    const idle = t % 10;
    SWATCHES.forEach((_, index) => {
      const delay = index * 0.09;
      const spin = since > delay && since < delay + 0.7 ? ((since - delay) / 0.7) * Math.PI * 2 : 0;
      const wave = Math.max(0, Math.sin((idle - index * 0.15) * 4)) * (idle - index * 0.15 < Math.PI / 4 && idle > index * 0.15 ? 0.12 : 0);
      dummy.position.set(1.73, 2.0 + wave, -0.85 + index * 0.4);
      dummy.rotation.set(0, Math.PI / 2 + spin, 0);
      dummy.scale.set(0.32, 0.32, 0.05);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SWATCHES.length]} castShadow raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}

function Studio({ island }: { island: IslandConfig }) {
  const studio = useMemo(() => studioGeometry(), []);
  const awning = useMemo(() => awningGeometry(), []);
  const [pulseGroup, kick] = usePulse(0.07);
  const kickAt = useRef(-100);
  const clock = useRef(0);
  useFrame((state) => {
    clock.current = state.clock.elapsedTime;
  });
  if (!rgEntry) return null;
  const [sx, sz] = fromBuilding(RG.at, RG.front, -1.55, 2.35);
  return (
    <>
      <group position={[RG.at[0], RG.y, RG.at[1]]} rotation-y={facing(RG.front)}>
        <Hotspot
          hoverScale={1.04}
          onActivate={() => {
            kickAt.current = clock.current;
            kick();
            ambience.motif('design');
            focusItem('experience', rgEntry.id);
          }}
        >
          <group ref={pulseGroup}>
            <Merged geometry={studio} material={paintMaterial()} />
            <Merged geometry={awning} material={doubleMaterial()} />
            <Windows specs={STUDIO_WINDOWS} lit="#ffd6a0" />
            <Swatches kickAt={kickAt} />
            <mesh position={[0, 1.6, 0.4]} visible={false}>
              <boxGeometry args={[4.4, 3.4, 3.4]} />
            </mesh>
          </group>
        </Hotspot>
      </group>
      <PaintedSign
        lines={[shortName(rgEntry.company), years(rgEntry.period)]}
        position={[sx, RG.y - 0.04, sz]}
        rotation={facing(RG.front) + 0.25}
        accent={island.accent}
        width={1.9}
        post={1.15}
      />
    </>
  );
}

/* ================================================================== GRETA */

/** Toit à quatre pans : trapèzes devant et derrière, triangles sur les côtés. */
function hipRoofGeometry(halfWidth: number, halfDepth: number, ridgeHalf: number, height: number) {
  const a = [-halfWidth, 0, halfDepth];
  const b = [halfWidth, 0, halfDepth];
  const c = [halfWidth, 0, -halfDepth];
  const d = [-halfWidth, 0, -halfDepth];
  const r1 = [-ridgeHalf, height, 0];
  const r2 = [ridgeHalf, height, 0];
  const faces = [
    [a, b, r2], [a, r2, r1],
    [c, d, r1], [c, r1, r2],
    [b, c, r2],
    [d, a, r1],
  ];
  const positions = new Float32Array(faces.flat(2));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function schoolGeometry() {
  const b = new Builder();
  b.box([4.3, 0.38, 2.6], '#d8c4a0', [0, 0.19, 0], [0, 0, 0], 0.03);
  b.box([4.2, 1.95, 2.5], '#f2e0b8', [0, 1.34, 0]);
  b.box([4.36, 0.1, 2.66], '#f7efdc', [0, 2.32, 0]);
  b.add(hipRoofGeometry(2.42, 1.52, 0.9, 1.05), '#c8643b', [0, 2.36, 0]);
  // Rangs de tuiles : arêtes plus sombres au faîtage.
  b.box([1.9, 0.09, 0.14], '#a9522f', [0, 3.42, 0]);
  // Clocheton : quatre poteaux et un petit toit (la cloche est animée à part).
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) b.box([0.06, 0.62, 0.06], '#f7efdc', [x, 3.72, z]);
  b.cone(0.36, 0.34, 4, '#c8643b', [0, 4.2, 0], [0, Math.PI / 4, 0]);
  // Porte double, marches, horloge au-dessus.
  b.box([1.0, 1.75, 0.08], '#3f6b5a', [0, 1.25, 1.26]);
  b.box([0.03, 1.7, 0.1], '#2c4d40', [0, 1.25, 1.28]);
  b.box([1.3, 0.14, 0.42], '#d8c4a0', [0, 0.32, 1.45]);
  b.box([1.5, 0.14, 0.62], '#d8c4a0', [0, 0.18, 1.52]);
  b.cylinder(0.25, 0.25, 0.05, 16, '#f7f3ec', [0, 2.06, 1.27], [Math.PI / 2, 0, 0]);
  b.cylinder(0.28, 0.28, 0.03, 16, '#3b2f25', [0, 2.06, 1.255], [Math.PI / 2, 0, 0]);
  b.box([0.025, 0.17, 0.02], '#2a2d33', [0, 2.12, 1.3]);
  b.box([0.12, 0.025, 0.02], '#2a2d33', [0.05, 2.06, 1.3]);
  // Fenêtres à volets bleus.
  for (const x of [-1.6, -0.95, 0.95, 1.6]) {
    b.box([0.6, 0.06, 0.16], '#f7efdc', [x, 0.86, 1.3]);
    for (const side of [-1, 1]) b.box([0.26, 0.86, 0.05], '#8aa7d6', [x + side * 0.42, 1.36, 1.28]);
  }
  for (const side of [-1, 1]) {
    b.box([0.16, 0.06, 0.6], '#f7efdc', [side * 2.15, 0.86, 0]);
    for (const dz of [-1, 1]) b.box([0.05, 0.86, 0.26], '#8aa7d6', [side * 2.13, 1.36, dz * 0.42]);
  }
  // Tableau noir sur chevalet (le croquis est une texture à part).
  b.beam([2.55, 0.0, 2.05], [2.6, 1.55, 2.25], 0.06, '#9b6b45');
  b.beam([3.45, 0.0, 2.05], [3.4, 1.55, 2.25], 0.06, '#9b6b45');
  b.beam([3.0, 0.0, 1.6], [3.0, 1.45, 2.15], 0.06, '#9b6b45');
  b.box([1.02, 0.7, 0.05], '#7a5034', [3.0, 1.12, 2.25], [-0.18, 0, 0]);
  return b.build();
}

const SCHOOL_WINDOWS: WindowSpec[] = [
  ...[-1.6, -0.95, 0.95, 1.6].map((x, index) => ({ seed: 107 + index * 6, at: [x, 1.36, 1.256] as const, width: 0.5, height: 0.82 })),
  { seed: 131, at: [2.105, 1.36, 0], turn: Math.PI / 2, width: 0.5, height: 0.82 },
  { seed: 137, at: [-2.105, 1.36, 0], turn: -Math.PI / 2, width: 0.5, height: 0.82 },
];

function SchoolBell({ ringAt }: { ringAt: { current: number } }) {
  const bell = useRef<Group>(null);
  useFrame((state) => {
    if (!bell.current) return;
    const since = state.clock.elapsedTime - ringAt.current;
    bell.current.rotation.x = since < 6 ? Math.sin(since * 7.5) * 0.55 * Math.exp(-since * 0.9) : 0;
  });
  return (
    <group ref={bell} position={[0, 3.98, 0]}>
      <mesh position-y={-0.2} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.07, 0.15, 0.22, 10, 1, true]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position-y={-0.08} raycast={() => null}>
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} />
      </mesh>
    </group>
  );
}

function School({ island }: { island: IslandConfig }) {
  const school = useMemo(() => schoolGeometry(), []);
  const chalk = useMemo(() => chalkboardTexture(), []);
  useEffect(() => () => chalk.dispose(), [chalk]);
  const [pulseGroup, kick] = usePulse(0.06);
  const ringAt = useRef(-100);
  const clock = useRef(0);
  useFrame((state) => {
    clock.current = state.clock.elapsedTime;
  });
  if (!gretaEntry) return null;
  const [sx, sz] = fromBuilding(GRETA.at, GRETA.front, -1.75, 2.6);
  return (
    <>
      <group position={[GRETA.at[0], GRETA.y, GRETA.at[1]]} rotation-y={facing(GRETA.front)}>
        <Hotspot
          hoverScale={1.04}
          onActivate={() => {
            ringAt.current = clock.current;
            kick();
            ambience.bell(0.55);
            focusItem('experience', gretaEntry.id);
          }}
        >
          <group ref={pulseGroup}>
            <Merged geometry={school} material={paintMaterial()} />
            <Windows specs={SCHOOL_WINDOWS} />
            <SchoolBell ringAt={ringAt} />
            <mesh position={[3.0, 1.125, 2.28]} rotation-x={-0.18} raycast={() => null}>
              <planeGeometry args={[0.92, 0.6]} />
              <meshStandardMaterial map={chalk} roughness={0.95} />
            </mesh>
            <mesh position={[0.4, 1.8, 0.4]} visible={false}>
              <boxGeometry args={[5.4, 3.8, 3.6]} />
            </mesh>
          </group>
        </Hotspot>
      </group>
      <PaintedSign
        lines={[shortName(gretaEntry.company), years(gretaEntry.period)]}
        position={[sx, GRETA.y - 0.04, sz]}
        rotation={facing(GRETA.front) - 0.2}
        accent={island.accent}
        width={1.9}
        post={1.15}
      />
    </>
  );
}

export function Places({ island }: { island: IslandConfig }) {
  return (
    <>
      <Studio island={island} />
      <School island={island} />
    </>
  );
}
