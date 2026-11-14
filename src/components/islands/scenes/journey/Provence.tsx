'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ClearingAt, on } from '../../kit';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import { BOX, CONE8, CYL6, CYL12, DOME, ICO0, ICO1, Kit, roughen, SPHERE } from './geometry';
import { flatPaint, smoothPaint } from './materials';
import { faceCamera, farFrom, scatter, slopeAt } from './place';
import { FRAME_YAW } from './route';
import { Shrubs, type ShrubItem } from './Shrubs';
import {
  CALANQUE,
  calanqueDistance,
  channelCenter,
  channelHalfWidth,
  fromFrame,
  GARDE,
  polylineDistance,
  portDistance,
  smooth,
  STEP_SPOTS,
  TECH,
  TRAIL_PROVENCE,
} from './terrain';
import { codeScreen } from './textures';

/**
 * MARSEILLE, côté colline : Notre-Dame-de-la-Garde et sa Bonne Mère dorée, pins
 * parasols, garrigue et lavande, rochers blancs de la calanque, et le petit quartier
 * « tech » : un immeuble de verre aux écrans allumés (la carrière de développeur).
 */

/* ============================================================ la Bonne Mère */

const STRIPE_LIGHT = new Color('#f1eadc');
const STRIPE_DARK = new Color('#93a294');

/** Pierre rayée de la basilique : bandes claires et vert-de-gris. */
function striped(y: number, out: Color) {
  return out.copy(Math.floor(y / 0.17) % 2 === 0 ? STRIPE_LIGHT : STRIPE_DARK);
}

function buildBasilica() {
  const kit = new Kit();
  const paint = { paint: (_x: number, y: number, _z: number, out: Color) => striped(y, out) };
  // Terrasse et remparts.
  kit.add(CYL12, '#ddd2bf', { position: [0, -0.3, 0], scale: [2.0, 0.7, 1.6] }, { jitter: 0.06, seed: 1 });
  kit.add(CYL12, '#e9dfcc', { position: [0, 0.07, 0], scale: [2.05, 0.06, 1.65] });
  // Nef, transept, dôme.
  kit.add(BOX, '#f1eadc', { position: [-0.15, 0.55, 0], scale: [2.0, 1.0, 0.85] }, paint);
  kit.add(BOX, '#b45a3c', { position: [-0.15, 1.1, 0], rotation: [Math.PI / 4, 0, 0], scale: [2.0, 0.6, 0.6] });
  kit.add(BOX, '#f1eadc', { position: [0.45, 0.6, 0], scale: [0.6, 1.1, 1.25] }, paint);
  kit.add(CYL12, '#f1eadc', { position: [0.45, 1.32, 0], scale: [0.36, 0.42, 0.36] }, paint);
  kit.add(DOME, '#c9a35b', { position: [0.45, 1.52, 0], scale: [0.4, 0.42, 0.4] });
  kit.add(SPHERE, '#e6c15c', { position: [0.45, 1.98, 0], scale: 0.06 });
  // Clocher carré, beffroi ajouré, piédestal rond de la statue.
  kit.add(BOX, '#f1eadc', { position: [-1.2, 1.2, 0], scale: [0.66, 2.4, 0.66] }, paint);
  kit.add(BOX, '#f1eadc', { position: [-1.2, 2.62, 0], scale: [0.74, 0.44, 0.74] });
  for (const [x, z] of [[0, 0.375], [0, -0.375], [0.375, 0], [-0.375, 0]] as const) {
    kit.add(BOX, '#5d5a63', { position: [-1.2 + x, 2.62, z], scale: [x ? 0.02 : 0.3, 0.3, z ? 0.02 : 0.3] });
  }
  kit.add(BOX, '#e3d7c2', { position: [-1.2, 2.88, 0], scale: [0.8, 0.08, 0.8] });
  kit.add(CYL12, '#f1eadc', { position: [-1.2, 3.18, 0], scale: [0.22, 0.52, 0.22] }, paint);
  kit.add(CYL12, '#e3d7c2', { position: [-1.2, 3.46, 0], scale: [0.27, 0.06, 0.27] });
  // Portail et rosace.
  kit.add(BOX, '#6a4c3a', { position: [-0.86, 0.32, 0], scale: [0.02, 0.5, 0.26] });
  kit.add(CYL12, '#7aa0c9', { position: [1.16, 0.85, 0], rotation: [0, 0, Math.PI / 2], scale: [0.16, 0.02, 0.16] });
  return kit.build();
}

/** La statue dorée : silhouette effilée, tête, auréole. */
function buildStatue() {
  const kit = new Kit();
  kit.add(CONE8, '#e9bf4f', { position: [0, 0.22, 0], scale: [0.11, 0.44, 0.11] });
  kit.add(SPHERE, '#efc95a', { position: [0, 0.5, 0], scale: 0.065 });
  kit.add(SPHERE, '#efc95a', { position: [0.06, 0.34, 0.04], scale: 0.05 });
  return kit.build();
}

const BASILICA_PAINT = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
  emissive: '#ffcf8f',
  emissiveIntensity: 0,
});
const GOLD = new MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.65, emissive: '#ffb53a', emissiveIntensity: 0.15 });

function Basilica({ sampler }: { sampler: HeightSampler }) {
  const body = useMemo(() => buildBasilica(), []);
  const statue = useMemo(() => buildStatue(), []);
  const [x, z] = fromFrame(GARDE.u, GARDE.v);
  const base = on(sampler, x, z, 1.4, 0.0);
  const glint = useRef<Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const night = skyState.dayNight;
    BASILICA_PAINT.emissiveIntensity = smooth(0.25, 0.7, night) * 0.16;
    // Reflet qui passe sur la statue toutes les quelques secondes, plus doux la nuit.
    const flash = Math.pow(Math.max(0, Math.sin(t * 0.9)), 24);
    GOLD.emissiveIntensity = 0.12 + flash * 1.6 + night * 0.9;
    if (glint.current) {
      glint.current.scale.setScalar(0.05 + flash * 0.5);
      glint.current.rotation.z = t * 0.6;
    }
  });
  return (
    <group>
      <ClearingAt x={x} z={z} radius={2.6} />
      <group position={base} rotation-y={FRAME_YAW + 0.12}>
        <mesh geometry={body} material={BASILICA_PAINT} castShadow receiveShadow />
        <mesh geometry={statue} material={GOLD} position={[-1.2, 3.49, 0]} castShadow />
        <mesh ref={glint} position={[-1.2, 4.05, 0.12]} scale={0.05} raycast={() => null}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#fff2c4" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================ pins parasols */

const PINE_TRUNK = (() => {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0.12, 0.9, 0.04),
    new Vector3(0.02, 1.9, 0.0),
    new Vector3(0.28, 2.75, -0.06),
  ]);
  const tube = new TubeGeometry(curve, 10, 0.11, 6, false);
  const positions = tube.attributes.position;
  // Fût qui s'affine vers le haut.
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    const t = Math.min(1, Math.max(0, y / 2.75));
    const center = curve.getPointAt(Math.min(1, t));
    const k = 1 - t * 0.45;
    positions.setX(index, center.x + (positions.getX(index) - center.x) * k);
    positions.setZ(index, center.z + (positions.getZ(index) - center.z) * k);
  }
  const branch = new TubeGeometry(
    new CatmullRomCurve3([new Vector3(0.05, 2.0, 0), new Vector3(-0.45, 2.45, 0.1), new Vector3(-0.7, 2.62, 0.15)]),
    5,
    0.05,
    5,
    false,
  );
  const merged = mergeGeometries([tube.toNonIndexed(), branch.toNonIndexed()])!;
  merged.computeVertexNormals();
  return merged;
})();

const PINE_CANOPY = (() => {
  const kit = new Kit();
  const blobs: [number, number, number, number][] = [
    [0.3, 2.95, 0, 1.0], [-0.55, 2.82, 0.2, 0.75], [0.95, 2.8, -0.25, 0.7], [0.1, 2.85, -0.75, 0.72], [-0.1, 2.85, 0.8, 0.7], [0.35, 3.15, 0.1, 0.62],
  ];
  blobs.forEach(([x, y, z, r], index) => {
    kit.add(roughen(ICO1, 0.22, index * 1.9), '#ffffff', { position: [x, y, z], scale: [r, r * 0.38, r] }, {
      jitter: 0.12,
      seed: index,
      // Dessous sombre, dessus lumineux : la galette du pin parasol.
      paint: (_px, py, _pz, out) => out.set('#2e5531').lerp(new Color('#5d8f45'), smooth(2.7, 3.25, py)),
    });
  });
  return kit.build();
})();

function Pines({ spots }: { spots: { x: number; y: number; z: number; s: number; yaw: number }[] }) {
  const trunks = useRef<InstancedMesh>(null);
  const canopies = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (const mesh of [trunks.current, canopies.current]) {
      if (!mesh) continue;
      spots.forEach((spot, index) => {
        dummy.position.set(spot.x, spot.y, spot.z);
        dummy.rotation.set(0, spot.yaw, 0);
        dummy.scale.setScalar(spot.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[PINE_TRUNK, undefined, spots.length]} castShadow raycast={() => null}>
        <meshStandardMaterial color="#8a5a3e" roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[PINE_CANOPY, smoothPaint, spots.length]} castShadow receiveShadow raycast={() => null} />
    </group>
  );
}

/* ============================================================ immeuble tech */

const TECH_W = 2.7;
const TECH_D = 2.0;
const STOREY = 1.05;
const STOREYS = 3;

function buildTechFrame() {
  const kit = new Kit();
  const white = '#f3f4f2';
  // Dalles blanches, poteaux fins, toit-terrasse.
  for (let level = 0; level <= STOREYS; level++) {
    kit.add(BOX, white, { position: [0, level * STOREY, 0], scale: [TECH_W + (level === STOREYS ? 0.2 : 0.1), 0.12, TECH_D + 0.1] });
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    kit.add(BOX, white, { position: [x * (TECH_W / 2 - 0.04), (STOREYS * STOREY) / 2, z * (TECH_D / 2 - 0.04)], scale: [0.09, STOREYS * STOREY, 0.09] });
  }
  kit.add(BOX, '#cfd6db', { position: [0, -0.35, 0], scale: [TECH_W + 0.3, 0.6, TECH_D + 0.3] });
  // Toit : panneaux solaires, édicule, mât d'antenne.
  for (const x of [-0.75, 0, 0.75]) {
    kit.add(BOX, '#2d4a7a', { position: [x, STOREYS * STOREY + 0.22, -0.35], rotation: [-0.45, 0, 0], scale: [0.62, 0.03, 0.8] });
    kit.add(BOX, '#9aa3ab', { position: [x, STOREYS * STOREY + 0.12, -0.15], scale: [0.04, 0.2, 0.04] });
  }
  kit.add(BOX, '#e3e6e8', { position: [0.85, STOREYS * STOREY + 0.3, 0.5], scale: [0.6, 0.5, 0.5] });
  kit.add(CYL6, '#b9c0c6', { position: [-0.9, STOREYS * STOREY + 0.7, 0.55], scale: [0.025, 1.3, 0.025] });
  // Place devant : banc, jardinière et son olivier.
  kit.add(BOX, '#d8cbb2', { position: [0, -0.04, TECH_D / 2 + 0.75], scale: [TECH_W + 0.6, 0.08, 1.4] });
  kit.add(BOX, '#8a6142', { position: [-0.7, 0.24, TECH_D / 2 + 1.1], scale: [0.8, 0.06, 0.26] });
  for (const x of [-1.0, -0.4]) kit.add(BOX, '#555a61', { position: [x, 0.11, TECH_D / 2 + 1.1], scale: [0.05, 0.22, 0.22] });
  kit.add(BOX, '#b9b2a6', { position: [0.85, 0.18, TECH_D / 2 + 1.0], scale: [0.6, 0.36, 0.6] });
  kit.add(CYL6, '#7a6a55', { position: [0.85, 0.65, TECH_D / 2 + 1.0], rotation: [0, 0, 0.15], scale: [0.05, 0.7, 0.05] });
  kit.add(roughen(ICO1, 0.3, 4), '#8c9a6a', { position: [0.8, 1.08, TECH_D / 2 + 1.0], scale: [0.42, 0.3, 0.42] }, { jitter: 0.2, seed: 3 });
  return kit.build();
}

/** Écrans allumés derrière les vitres (une seule géométrie, une seule texture). */
function buildScreens() {
  const parts = [];
  for (let level = 0; level < STOREYS; level++) {
    for (const x of [-0.8, 0.05, 0.85]) {
      if ((level + x * 3) % 2 === 1) continue;
      const plane = new PlaneGeometry(0.46, 0.3).translate(x, level * STOREY + 0.55, TECH_D / 2 - 0.22);
      parts.push(plane.toNonIndexed());
    }
    const side = new PlaneGeometry(0.46, 0.3).rotateY(Math.PI / 2).translate(TECH_W / 2 - 0.2, level * STOREY + 0.55, 0.2 - level * 0.3);
    parts.push(side.toNonIndexed());
  }
  return mergeGeometries(parts)!;
}

const GLASS = new MeshStandardMaterial({
  color: '#8fd0de',
  roughness: 0.12,
  metalness: 0.25,
  transparent: true,
  opacity: 0.5,
  emissive: '#dff6ff',
  emissiveIntensity: 0,
  depthWrite: false,
});

const LED = new MeshStandardMaterial({ color: '#ff5a4f', emissive: '#ff3b30', emissiveIntensity: 2 });

function TechBuilding({ sampler }: { sampler: HeightSampler }) {
  const frame = useMemo(() => buildTechFrame(), []);
  const screens = useMemo(() => buildScreens(), []);
  const screenTexture = useMemo(() => codeScreen(), []);
  const screenMaterial = useRef<MeshStandardMaterial>(null);
  const dish = useRef<Group>(null);
  const [x, z] = fromFrame(TECH.u, TECH.v);
  const base = on(sampler, x, z, 1.4, 0.05);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const night = skyState.dayNight;
    GLASS.emissiveIntensity = smooth(0.15, 0.55, night) * 0.55;
    LED.emissiveIntensity = (Math.sin(t * 3.2) > 0.55 ? 3.2 : 0.25) * (0.6 + night * 0.6);
    if (screenMaterial.current) screenMaterial.current.emissiveIntensity = 0.7 + night * 1.3 + Math.sin(t * 7) * 0.04;
    if (dish.current) dish.current.rotation.y = Math.sin(t * 0.35) * 1.1;
  });
  return (
    <group position={base} rotation-y={faceCamera(x, z, -0.35)}>
      <mesh geometry={frame} material={flatPaint} castShadow receiveShadow />
      <mesh geometry={screens}>
        <meshStandardMaterial ref={screenMaterial} map={screenTexture} emissive="#ffffff" emissiveMap={screenTexture} emissiveIntensity={0.8} roughness={0.4} />
      </mesh>
      <mesh material={GLASS} position={[0, (STOREYS * STOREY) / 2, 0]} renderOrder={4} raycast={() => null}>
        <boxGeometry args={[TECH_W - 0.12, STOREYS * STOREY - 0.02, TECH_D - 0.12]} />
      </mesh>
      <mesh material={LED} position={[-0.9, STOREYS * STOREY + 1.37, 0.55]}>
        <sphereGeometry args={[0.06, 8, 6]} />
      </mesh>
      <group ref={dish} position={[0.85, STOREYS * STOREY + 0.6, 0.5]}>
        <mesh rotation={[-0.7, 0, 0]} position={[0, 0.12, 0.05]} castShadow>
          <sphereGeometry args={[0.24, 12, 6, 0, Math.PI * 2, 0, 1.0]} />
          <meshStandardMaterial color="#f2f3f4" roughness={0.5} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.16, 6]} />
          <meshStandardMaterial color="#9aa3ab" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================ rochers blancs */

const LIMESTONE_ROCK = roughen(ICO0, 0.35, 8.1, [1, 0.8, 1]);

function WhiteRocks({ items }: { items: { x: number; y: number; z: number; s: number; yaw: number; tone: number }[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    const color = new Color();
    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(item.yaw * 0.3, item.yaw, item.yaw * 0.2);
      dummy.scale.set(item.s * 1.15, item.s * 0.8, item.s);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, color.set('#ece6da').multiplyScalar(0.88 + item.tone * 0.16));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={mesh} args={[LIMESTONE_ROCK, undefined, items.length]} castShadow receiveShadow raycast={() => null}>
      <meshStandardMaterial roughness={0.9} flatShading />
    </instancedMesh>
  );
}

/** Petit bateau à l'ancre au fond de la calanque. */
function CalanqueBoat() {
  const geometry = useMemo(() => {
    const kit = new Kit();
    kit.add(roughen(SPHERE, 0.02, 1), '#f5f3ee', { position: [0, -0.05, 0], scale: [0.75, 0.22, 0.3] }, {
      paint: (_x, y, _z, out) => out.set(y < -0.12 ? '#d6513f' : '#f5f3ee'),
    });
    kit.add(BOX, '#c9a477', { position: [0, 0.08, 0], scale: [1.0, 0.03, 0.42] });
    kit.add(BOX, '#2f73c4', { position: [-0.2, 0.2, 0], scale: [0.3, 0.2, 0.34] });
    return kit.build();
  }, []);
  const group = useRef<Group>(null);
  const [x, z] = fromFrame(CALANQUE.headU - 1.6, CALANQUE.headV + 2.6);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = 0.1 + Math.sin(t * 1.3) * 0.03;
    group.current.rotation.y = 0.6 + Math.sin(t * 0.25) * 0.25;
    group.current.rotation.z = Math.sin(t * 1.1) * 0.05;
  });
  return (
    <group ref={group} position={[x, 0.1, z]}>
      <mesh geometry={geometry} material={smoothPaint} castShadow />
    </group>
  );
}

/* ============================================================ racine */

export function Provence({ sampler }: { sampler: HeightSampler }) {
  const quality = useWorld((state) => state.quality);
  const layout = useMemo(() => {
    const steps = Object.values(STEP_SPOTS).map(([u, v]) => [u, v, 1.6] as [number, number, number]);
    const avoid: [number, number, number][] = [
      [GARDE.u, GARDE.v, 2.4],
      [TECH.u, TECH.v, 2.8],
      [13.6, 7.9, 1.8],
      ...steps,
    ];
    const marseille = (u: number, v: number) => v - channelCenter(u) > channelHalfWidth(u) + 0.5;
    const town = (u: number, v: number) => u > -2.6 && u < 4.4 && v > 2.6 && v < 9.6;
    const pinePlaces: [number, number, number][] = [
      [2.6, 11.4, 1.05], [-4.4, 13.0, 1.15], [8.2, 11.2, 0.95], [-6.6, 2.9, 1.0], [-12.4, 9.4, 0.9], [-3.6, 6.2, 0.85], [-13.0, 3.6, 0.95],
    ];
    const pines = pinePlaces.map(([u, v, s], index) => {
      const [x, z] = fromFrame(u, v);
      return { x, z, y: groundAt(sampler, x, z, 0.3) - 0.08, s, yaw: index * 2.1 };
    });
    const avoidAll = [...avoid, ...pinePlaces.map(([u, v]) => [u, v, 1.2] as [number, number, number])];
    const shrubSpots = scatter(sampler, {
      count: 44,
      seed: 41,
      u: [-15, 14],
      v: [1, 17],
      spacing: 0.95,
      accept: ({ x, z, y, u, v }) =>
        marseille(u, v)
        && !town(u, v)
        && y > 1.05
        && portDistance(u, v) > 2.8
        && calanqueDistance(u, v) > 0.9
        && slopeAt(sampler, x, z) < 1.0
        && polylineDistance(TRAIL_PROVENCE, u, v) > 0.9
        && farFrom(u, v, avoidAll),
    });
    const olive = [new Color('#6f7d3e'), new Color('#86915f'), new Color('#59682f')];
    const blooms = [new Color('#a291df'), new Color('#f3eee4'), new Color('#e9a1c0'), new Color('#9d8fd6')];
    const shrubs: ShrubItem[] = shrubSpots.map((spot) => ({
      x: spot.x,
      y: spot.y - 0.06,
      z: spot.z,
      scale: 0.5 + hash(spot.r * 13) * 0.4,
      yaw: spot.r * 9,
      body: olive[Math.floor(spot.r * 3) % 3],
      bloom: blooms[Math.floor(hash(spot.r * 5) * 4)],
    }));
    // Petit champ de lavande devant l'immeuble tech : rangs violets.
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 5; k++) {
        const u = TECH.u + 2.8 + row * 0.55;
        const v = TECH.v - 2.6 + k * 0.6 + row * 0.2;
        const [x, z] = fromFrame(u, v);
        shrubs.push({
          x,
          z,
          y: sampler(x, z) - 0.05,
          scale: 0.42,
          yaw: k + row,
          body: new Color('#6b6994'),
          bloom: new Color('#a58ae6'),
        });
      }
    }
    // Rochers blancs : bords de la calanque, pied de la colline, quelques blocs en garrigue.
    const rocks: { x: number; y: number; z: number; s: number; yaw: number; tone: number }[] = [];
    for (let index = 0; index < 14; index++) {
      const t = index / 13;
      const side = index % 2 ? 1 : -1;
      const u = CALANQUE.headU + (CALANQUE.mouthU - CALANQUE.headU) * (0.25 + t * 0.85);
      const v = CALANQUE.headV + (CALANQUE.mouthV - CALANQUE.headV) * (0.25 + t * 0.85);
      const offset = (1.2 + t * 1.6) * side;
      const [x, z] = fromFrame(u + offset * 0.85, v + offset * 0.5);
      const s = 0.35 + hash(index * 3.3) * 0.5;
      rocks.push({ x, z, y: sampler(x, z) - s * 0.3, s, yaw: hash(index) * 6, tone: hash(index * 7) });
    }
    for (const [u, v, s] of [[-7.4, 8.2, 0.6], [-12.0, 6.0, 0.7], [-5.6, 15.0, 0.55], [5.6, 14.2, 0.5], [9.8, 12.9, 0.6], [-1.0, 15.2, 0.5]] as const) {
      const [x, z] = fromFrame(u, v);
      rocks.push({ x, z, y: sampler(x, z) - s * 0.3, s, yaw: u + v, tone: hash(u * v) });
    }
    return { pines, shrubs, rocks };
  }, [sampler]);

  return (
    <group>
      <Basilica sampler={sampler} />
      <Pines spots={layout.pines} />
      <TechBuilding sampler={sampler} />
      <Shrubs items={layout.shrubs} shadows={quality !== 'low'} />
      <WhiteRocks items={layout.rocks} />
      <CalanqueBoat />
    </group>
  );
}
