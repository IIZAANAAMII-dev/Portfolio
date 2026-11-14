'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { experiences } from '@/data/experience';
import { ambience } from '@/lib/audio/ambience';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { Hotspot } from '../../kit';
import { Builder, paintMaterial, type V3 } from './build';
import { coneUniforms, lightConeMaterial } from './Gantry';
import { OFFICE } from './layout';
import { Merged, ProvenceFlag, usePulse, Windows, type WindowSpec } from './parts';
import { companySignTexture, screensAtlasTexture, scrollingPageTexture, useSansFont } from './textures';

/**
 * L'atelier Feeder SAS – EIZO France, au sommet : façade vitrée sur deux côtés (on voit
 * les écrans allumés à l'intérieur), enseigne au nom de l'entreprise, toit-terrasse avec
 * le drapeau de Provence et un petit phare « référencement » qui balaie la nuit. Sur le
 * parvis, les métiers du poste : grand écran où défile une boutique en ligne (web,
 * e-commerce), chevalet de design, diable chargé de colis prêts à partir.
 *
 * Repère local : façade principale vers +z (nord-est, vers le ponton), côté vitré vers +x.
 */

const WHITE = '#f3f0e8';
const CHARCOAL = '#2d3440';
const WOOD = '#b07a4f';
const STONE = '#e6dac4';

const feeder = experiences.find((entry) => entry.id === 'feeder') ?? experiences[0];

function buildingGeometry() {
  const b = new Builder();
  // Parvis en pierre claire, socle épais (il rattrape la pente au bord du terre-plein).
  b.box([6.3, 0.62, 5.7], STONE, [0, -0.19, 0.65], [0, 0, 0], 0.02);
  b.box([6.36, 0.06, 5.76], '#efe6d3', [0, 0.1, 0.65]);
  // Murs pleins : arrière et pignon sud-est.
  b.box([5.6, 2.8, 0.2], WHITE, [0, 1.52, -1.8]);
  b.box([0.2, 2.8, 3.8], WHITE, [-2.7, 1.52, 0]);
  // Trumeau d'entrée et sa porte en bois.
  b.box([1.15, 2.8, 0.2], WHITE, [2.22, 1.52, 1.8]);
  b.box([0.82, 2.1, 0.06], '#8a5d3b', [2.2, 1.17, 1.92]);
  b.box([0.05, 0.3, 0.05], '#d9c48a', [1.9, 1.2, 1.97]);
  // Plancher intérieur.
  b.box([5.4, 0.04, 3.6], '#d9b98c', [0, 0.14, 0]);
  // Menuiseries anthracite des façades vitrées (devant et côté +x).
  for (const x of [-2.62, -1.55, -0.5, 0.56, 1.62]) b.box([0.07, 2.8, 0.08], CHARCOAL, [x, 1.52, 1.86]);
  for (const y of [0.2, 2.88]) b.box([4.3, 0.08, 0.1], CHARCOAL, [-0.5, y, 1.86]);
  for (const z of [-1.8, -0.6, 0.6, 1.8]) b.box([0.08, 2.8, 0.07], CHARCOAL, [2.76, 1.52, z]);
  for (const y of [0.2, 2.88]) b.box([0.1, 0.08, 3.7], CHARCOAL, [2.76, y, 0]);
  // Dalle de toit en débord sur le parvis, poteaux fins, bandeau d'enseigne.
  b.box([6.0, 0.26, 4.8], WHITE, [0, 3.05, 0.3]);
  for (const x of [-2.9, 2.9]) b.box([0.12, 2.8, 0.12], WHITE, [x, 1.52, 2.55]);
  b.box([6.0, 0.6, 0.1], CHARCOAL, [0, 3.1, 2.67]);
  // Volume en attique, brise-soleil en bois, sa dalle.
  b.box([3.0, 1.85, 2.3], WHITE, [-1.1, 4.1, -0.55]);
  b.box([3.3, 0.14, 2.6], WHITE, [-1.1, 5.08, -0.55]);
  for (let k = 0; k < 9; k++) b.box([0.06, 1.3, 0.12], WOOD, [-2.4 + k * 0.32, 4.15, 0.68]);
  // Panneaux solaires sur la dalle principale.
  for (const x of [1.05, 2.15]) {
    b.box([0.95, 0.05, 0.7], '#27406e', [x, 3.42, -1.15], [-0.4, 0, 0]);
    b.box([0.04, 0.3, 0.04], CHARCOAL, [x, 3.28, -0.9]);
  }
  // Bureau intérieur, chaises, plante, étagère de colis.
  b.box([3.8, 0.06, 0.72], '#f4f2ee', [-0.55, 0.88, 0.45]);
  for (const x of [-2.35, 1.25]) for (const z of [0.15, 0.75]) b.box([0.05, 0.74, 0.05], CHARCOAL, [x, 0.5, z]);
  for (const x of [-1.9, -1.0, -0.1, 0.8]) {
    b.box([0.42, 0.06, 0.42], '#3a4250', [x, 0.56, 1.22]);
    b.box([0.42, 0.45, 0.06], '#3a4250', [x, 0.82, 1.44]);
    b.box([0.05, 0.4, 0.05], CHARCOAL, [x, 0.33, 1.22]);
  }
  for (const x of [-1.9, -1.0, -0.1, 0.8]) {
    b.box([0.68, 0.42, 0.03], '#1e2228', [x, 1.25, 0.32]);
    b.box([0.05, 0.3, 0.05], '#1e2228', [x, 1.0, 0.28]);
    b.box([0.24, 0.02, 0.16], '#1e2228', [x, 0.92, 0.28]);
  }
  b.cylinder(0.18, 0.14, 0.36, 8, '#c8643b', [2.3, 0.33, 1.3]);
  b.sphere(0.32, '#4f8a3c', [2.3, 0.78, 1.3], [1, 1.25, 1]);
  b.box([0.3, 1.5, 2.6], '#cfc6b6', [-2.45, 0.9, -0.2]);
  for (let k = 0; k < 6; k++) {
    b.box([0.26, 0.24, 0.3], k % 2 ? '#c9955c' : '#b98349', [-2.4, 0.42 + Math.floor(k / 3) * 0.5, -1.0 + (k % 3) * 0.75]);
  }
  return b.build();
}

/** Accessoires du parvis : grand écran, chevalet de design, diable et colis, oliviers en pot. */
function terraceGeometry() {
  const b = new Builder();
  // Grand écran sur pied (l'écran lui-même est dessiné à part).
  b.box([1.9, 1.12, 0.08], '#1e2228', [0, 1.62, 0]);
  b.box([0.12, 1.1, 0.1], CHARCOAL, [0, 0.6, -0.08]);
  b.box([0.9, 0.06, 0.5], CHARCOAL, [0, 0.14, -0.08]);
  return b.build();
}

function easelGeometry() {
  const b = new Builder();
  b.beam([-0.38, 0.12, 0.22], [-0.05, 1.75, 0], 0.05, '#9b6b45');
  b.beam([0.38, 0.12, 0.22], [0.05, 1.75, 0], 0.05, '#9b6b45');
  b.beam([0, 0.12, -0.42], [0, 1.6, -0.05], 0.05, '#9b6b45');
  b.box([0.95, 0.05, 0.12], '#9b6b45', [0, 0.82, 0.12]);
  // Toile : plan blanc, aplats de couleurs du nuancier de l'île.
  b.box([0.9, 0.7, 0.03], '#f7f3ec', [0, 1.2, 0.14], [-0.12, 0, 0]);
  b.box([0.5, 0.2, 0.01], '#c9a7f0', [-0.12, 1.33, 0.17], [-0.12, 0, 0]);
  b.cylinder(0.11, 0.11, 0.01, 12, '#e2553f', [0.2, 1.08, 0.15], [Math.PI / 2 - 0.12, 0, 0]);
  b.box([0.28, 0.08, 0.01], '#2f6fc0', [-0.15, 1.02, 0.15], [-0.12, 0, 0]);
  b.box([0.16, 0.16, 0.01], '#f2c14e', [0.22, 1.36, 0.17], [-0.12, 0, 0]);
  return b.build();
}

function cartGeometry() {
  const b = new Builder();
  b.beam([-0.2, 0.08, 0], [-0.32, 1.25, 0], 0.05, '#d8473a');
  b.beam([0.2, 0.08, 0], [0.08, 1.25, 0], 0.05, '#d8473a');
  b.rod([-0.32, 1.22, 0], [0.08, 1.22, 0], 0.03, '#2a2d33');
  b.box([0.5, 0.04, 0.32], '#d8473a', [0, 0.06, 0.12]);
  for (const x of [-0.24, 0.24]) b.cylinder(0.13, 0.13, 0.07, 10, '#23262b', [x, 0.13, -0.08], [0, 0, Math.PI / 2]);
  const boxes: [number, number, number, number][] = [[0.46, 0.3, 0.36, 0.23], [0.4, 0.26, 0.32, 0.51], [0.32, 0.22, 0.28, 0.75]];
  boxes.forEach(([w, h, d, y], index) => {
    b.box([w, h, d], index % 2 ? '#c9955c' : '#b98349', [-0.04 - index * 0.04, y, 0.1], [0, index * 0.12, 0]);
    b.box([w + 0.005, 0.04, d + 0.005], '#e9dcc0', [-0.04 - index * 0.04, y, 0.1], [0, index * 0.12, 0]);
  });
  b.box([0.5, 0.36, 0.4], '#c9955c', [0.62, 0.18, 0.32], [0, 0.3, 0]);
  b.box([0.36, 0.28, 0.3], '#b98349', [0.58, 0.5, 0.3], [0, -0.2, 0]);
  return b.build();
}

function pottedOliveGeometry() {
  const b = new Builder();
  b.cylinder(0.32, 0.24, 0.55, 10, '#c8643b', [0, 0.27, 0]);
  b.cylinder(0.34, 0.34, 0.06, 10, '#b4532f', [0, 0.56, 0]);
  b.beam([0, 0.5, 0], [0.08, 1.25, 0.04], 0.09, '#7c6a55');
  b.sphere(0.42, '#8fa36f', [0.1, 1.45, 0.05], [1, 0.75, 1], [8, 6]);
  b.sphere(0.32, '#a7b88a', [-0.2, 1.35, -0.1], [1, 0.7, 1], [8, 6]);
  b.sphere(0.28, '#7f9562', [0.3, 1.3, -0.18], [1, 0.72, 1], [8, 6]);
  return b.build();
}

/** Écrans du bureau : quatre cases de l'atlas, un seul maillage. */
function screensGeometry() {
  const cells: [number, number][] = [[0, 1], [1, 1], [0, 0], [1, 0]];
  const parts: BufferGeometry[] = [-1.9, -1.0, -0.1, 0.8].map((x, index) => {
    const plane = new PlaneGeometry(0.62, 0.36);
    const uv = plane.attributes.uv;
    const [cx, cy] = cells[index];
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 2, (cy + uv.getY(i)) / 2);
    plane.translate(x, 1.25, 0.34);
    return plane;
  });
  const merged = mergeGeometries(parts, false) ?? new BufferGeometry();
  parts.forEach((part) => part.dispose());
  return merged;
}

const ROOM_WINDOWS: WindowSpec[] = [
  // Murs intérieurs : ils s'allument au crépuscule et éclairent la salle vue du dehors.
  { seed: 61, at: [0, 1.5, -1.69], width: 5.2, height: 2.6 },
  { seed: 67, at: [-2.59, 1.5, 0], turn: Math.PI / 2, width: 3.5, height: 2.6 },
];

const ATTIC_WINDOWS: WindowSpec[] = [
  { seed: 71, at: [-1.1, 4.15, 0.585], width: 2.6, height: 0.9 },
  { seed: 73, at: [0.41, 4.15, -0.55], turn: Math.PI / 2, width: 1.9, height: 0.9 },
  { seed: 79, at: [-2.61, 4.15, -0.55], turn: -Math.PI / 2, width: 1.6, height: 0.9 },
];

const BEACON = coneUniforms('#ffe7b8');

function Beacon({ flashAt }: { flashAt: { current: number } }) {
  const head = useRef<Group>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const beam = useMemo(() => lightConeMaterial(BEACON), []);
  const cone = useMemo(() => new CylinderGeometry(0.05, 1.6, 9, 14, 1, true).rotateZ(Math.PI / 2).translate(4.6, 0, 0), []);
  useEffect(() => () => {
    beam.dispose();
    cone.dispose();
  }, [beam, cone]);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const flash = Math.max(0, 1 - (t - flashAt.current) / 3.5);
    if (head.current) head.current.rotation.y += Math.min(delta, 1 / 30) * (0.8 + flash * 5);
    const strength = Math.max(skyState.dayNight * 0.7, flash * 0.9);
    BEACON.uStrength.value = strength;
    if (lamp.current) lamp.current.emissiveIntensity = 0.5 + Math.max(skyState.dayNight, flash) * 3.2;
  });
  return (
    <group position={[-1.6, 5.15, -0.9]}>
      <mesh position-y={0.3} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.16, 0.22, 0.6, 10]} />
        <meshStandardMaterial color="#f4efe6" roughness={0.7} />
      </mesh>
      <mesh position-y={0.42} raycast={() => null}>
        <cylinderGeometry args={[0.175, 0.19, 0.16, 10]} />
        <meshStandardMaterial color="#d8473a" roughness={0.6} />
      </mesh>
      <mesh position-y={0.74} raycast={() => null}>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 10]} />
        <meshStandardMaterial ref={lamp} color="#fff2cf" emissive="#ffc76e" emissiveIntensity={0.5} roughness={0.2} />
      </mesh>
      <mesh position-y={1.02} castShadow raycast={() => null}>
        <coneGeometry args={[0.22, 0.26, 10]} />
        <meshStandardMaterial color="#d8473a" roughness={0.55} />
      </mesh>
      <group ref={head} position-y={0.74}>
        <mesh geometry={cone} material={beam} raycast={() => null} />
      </group>
    </group>
  );
}

function BigScreen({ texture }: { texture: ReturnType<typeof scrollingPageTexture> }) {
  const material = useRef<MeshStandardMaterial>(null);
  useFrame((state) => {
    const screen = material.current;
    if (!screen?.map) return;
    // La page défile, s'arrête un instant sur chaque section, puis repart.
    const t = state.clock.elapsedTime * 0.08;
    const step = Math.floor(t);
    const f = t - step;
    const eased = f < 0.6 ? 0 : (f - 0.6) / 0.4;
    screen.map.offset.y = -((step + eased * eased * (3 - 2 * eased)) * 0.25) % 1;
    screen.emissiveIntensity = 0.55 + skyState.dayNight * 0.9;
  });
  return (
    <mesh position={[0, 1.62, 0.045]} raycast={() => null}>
      <planeGeometry args={[1.78, 1.0]} />
      <meshStandardMaterial ref={material} map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.55} roughness={0.5} />
    </mesh>
  );
}

export function Office() {
  const family = useSansFont();
  const building = useMemo(() => buildingGeometry(), []);
  const terrace = useMemo(() => terraceGeometry(), []);
  const easel = useMemo(() => easelGeometry(), []);
  const cart = useMemo(() => cartGeometry(), []);
  const olive = useMemo(() => pottedOliveGeometry(), []);
  const screens = useMemo(() => screensGeometry(), []);
  const atlas = useMemo(() => screensAtlasTexture(), []);
  const page = useMemo(() => {
    const texture = scrollingPageTexture();
    texture.repeat.set(1, 0.5);
    return texture;
  }, []);
  const sign = useMemo(() => (family ? companySignTexture(feeder.company, family, '#c9a7f0') : null), [family]);
  useEffect(() => () => {
    atlas.dispose();
    page.dispose();
    screens.dispose();
  }, [atlas, page, screens]);
  useEffect(() => () => sign?.dispose(), [sign]);
  const screenMaterial = useRef<MeshStandardMaterial>(null);
  const signMaterial = useRef<MeshStandardMaterial>(null);
  const flashAt = useRef(-100);
  const clock = useThree((state) => state.clock);
  const [pulseGroup, kick] = usePulse(0.05);
  const quality = useWorld((state) => state.quality);

  useFrame((state) => {
    const night = skyState.dayNight;
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 3.1) * 0.04;
    if (screenMaterial.current) screenMaterial.current.emissiveIntensity = (0.5 + night * 1.0) * flicker;
    if (signMaterial.current) signMaterial.current.emissiveIntensity = 0.12 + night * 1.15;
  });

  const rotation = Math.atan2(Math.cos(OFFICE.front), Math.sin(OFFICE.front));
  const glassFront: V3 = [-0.5, 1.52, 1.86];
  return (
    <group position={[OFFICE.x, OFFICE.y, OFFICE.z]} rotation-y={rotation}>
      <Hotspot
        hoverScale={1.03}
        onActivate={() => {
          flashAt.current = clock.elapsedTime;
          kick();
          ambience.motif('tech');
          focusItem('experience', feeder.id);
        }}
      >
        <group ref={pulseGroup}>
          <Merged geometry={building} material={paintMaterial()} />
          <Windows specs={ROOM_WINDOWS} lit="#ffd9a0" glass="#d9dde0" intensity={1.6} />
          <Windows specs={ATTIC_WINDOWS} />
          <mesh geometry={screens} raycast={() => null}>
            <meshStandardMaterial ref={screenMaterial} map={atlas} emissive="#ffffff" emissiveMap={atlas} emissiveIntensity={0.5} roughness={0.5} />
          </mesh>
          {/* Vitrages (transparents) : façade et côté nord-ouest. */}
          <mesh position={glassFront as [number, number, number]} raycast={() => null}>
            <planeGeometry args={[4.3, 2.72]} />
            <meshStandardMaterial color="#a9d8ea" transparent opacity={0.28} roughness={0.08} metalness={0.2} depthWrite={false} />
          </mesh>
          <mesh position={[2.76, 1.52, 0]} rotation-y={Math.PI / 2} raycast={() => null}>
            <planeGeometry args={[3.7, 2.72]} />
            <meshStandardMaterial color="#a9d8ea" transparent opacity={0.28} roughness={0.08} metalness={0.2} depthWrite={false} />
          </mesh>
          {sign && (
            <mesh position={[0, 3.1, 2.725]} raycast={() => null}>
              <planeGeometry args={[5.8, 0.58]} />
              <meshStandardMaterial ref={signMaterial} map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.12} roughness={0.6} />
            </mesh>
          )}
          <Beacon flashAt={flashAt} />
          <ProvenceFlag position={[2.55, 3.18, 2.35]} rotation={-0.4} height={2.3} />
          <group position={[-2.05, 0.12, 3.05]} rotation-y={-0.55}>
            <Merged geometry={terrace} material={paintMaterial()} />
            <BigScreen texture={page} />
          </group>
          <group position={[0.15, 0.12, 3.0]} rotation-y={-0.35}>
            <Merged geometry={easel} material={paintMaterial()} />
          </group>
          <group position={[2.35, 0.12, 2.75]} rotation-y={0.5}>
            <Merged geometry={cart} material={paintMaterial()} />
          </group>
          {quality !== 'low' && (
            <>
              <group position={[-2.95, 0.12, 3.1]}>
                <Merged geometry={olive} material={paintMaterial()} />
              </group>
              <group position={[3.05, 0.12, -2.1]} rotation-y={1.2}>
                <Merged geometry={olive} material={paintMaterial()} />
              </group>
            </>
          )}
          {/* Volume de clic : un seul pavé invisible couvre l'atelier et son parvis. */}
          <mesh position={[0, 2.4, 0.65]} visible={false}>
            <boxGeometry args={[6.4, 5.2, 5.8]} />
          </mesh>
        </group>
      </Hotspot>
    </group>
  );
}
