'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  ShapeGeometry,
  Shape,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ChimneySmoke } from '../../ChimneySmoke';
import { ClearingAt, on, WindowPane } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { BOX, CONE8, CYL6, CYL8, CYL12, DOME, ICO0, ICO1, Kit, RING, roughen, SPHERE } from './geometry';
import { clothMaterial, flatPaint, smoothPaint } from './materials';
import { faceCamera, farFrom, scatter, slopeAt } from './place';
import { Shrubs, type ShrubItem } from './Shrubs';
import {
  AXIS,
  channelCenter,
  channelHalfWidth,
  COTTAGE,
  COVE,
  fromFrame,
  KNOLL,
  polylineDistance,
  RADIUS,
  smooth,
  STEP_SPOTS,
  TRAIL_BRETON,
} from './terrain';
import { codeScreen, fishingNet, graniteWall } from './textures';

/**
 * LA BRETAGNE : lande verte et venteuse, chaumière de granit au toit d'ardoise,
 * Gwenn-ha-Du, menhirs sur la butte, bruyère et ajonc, canot tiré sur le sable de la
 * crique, filets qui sèchent… et un petit nuage gris qui bruine, évidemment.
 */

/* ============================================================== chaumière */

const LENGTH = 4.3;
const DEPTH = 2.5;
const EAVES = 1.75;
const RISE = 1.5;
const TILE = 1.25;

/** Murs de granit (texture de moellons) : façades, pignons, soubassement enterré. */
function cottageWalls() {
  const parts: BufferGeometry[] = [];
  const wall = (width: number, height: number) => {
    const plane = new PlaneGeometry(width, height);
    const uv = plane.attributes.uv;
    for (let index = 0; index < uv.count; index++) uv.setXY(index, (uv.getX(index) * width) / TILE, (uv.getY(index) * height) / TILE);
    return plane;
  };
  const front = wall(LENGTH, EAVES + 0.6).translate(0, (EAVES - 0.6) / 2, DEPTH / 2);
  const back = wall(LENGTH, EAVES + 0.6).rotateY(Math.PI).translate(0, (EAVES - 0.6) / 2, -DEPTH / 2);
  parts.push(front, back);
  for (const side of [-1, 1]) {
    const shape = new Shape();
    shape.moveTo(-DEPTH / 2, -0.6);
    shape.lineTo(DEPTH / 2, -0.6);
    shape.lineTo(DEPTH / 2, EAVES);
    shape.lineTo(0, EAVES + RISE);
    shape.lineTo(-DEPTH / 2, EAVES);
    shape.closePath();
    const gable = new ShapeGeometry(shape);
    const uv = gable.attributes.uv;
    for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) / TILE, uv.getY(index) / TILE);
    gable.rotateY(side * Math.PI / 2).translate((side * LENGTH) / 2, 0, 0);
    parts.push(gable);
  }
  const merged = mergeGeometries(parts.map((part) => part.toNonIndexed()))!;
  merged.computeVertexNormals();
  return merged;
}

function cottageDetails() {
  const kit = new Kit();
  const slate = ['#4a5466', '#545f72', '#434c5d', '#5b667a'];
  const slope = Math.atan2(RISE + 0.12, DEPTH / 2 + 0.22);
  const run = Math.hypot(DEPTH / 2 + 0.22, RISE + 0.12);
  // Toit d'ardoise : rangs superposés de chaque côté (teintes alternées).
  for (const side of [-1, 1]) {
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.5) / rows;
      const along = run * t;
      const z = side * (DEPTH / 2 + 0.22 - Math.cos(slope) * along);
      const y = EAVES - 0.12 + Math.sin(slope) * along + 0.06;
      kit.add(BOX, slate[(row + (side > 0 ? 0 : 2)) % slate.length], {
        position: [0, y, z],
        rotation: [side * slope, 0, 0],
        scale: [LENGTH + 0.36, 0.1, run / rows + 0.08],
      }, { jitter: 0.1, seed: row + side * 9 });
    }
  }
  // Faîtage clair et deux cheminées de granit sur les pignons.
  kit.add(BOX, '#7b8494', { position: [0, EAVES + RISE + 0.06, 0], rotation: [Math.PI / 4, 0, 0], scale: [LENGTH + 0.4, 0.2, 0.2] });
  for (const side of [-1, 1]) {
    const x = side * (LENGTH / 2 - 0.12);
    kit.add(BOX, '#a7a19b', { position: [x, EAVES + RISE * 0.5 + 0.35, 0], scale: [0.5, RISE + 1.0, 0.62] }, { jitter: 0.08, seed: side });
    kit.add(BOX, '#8e8984', { position: [x, EAVES + RISE + 0.88, 0], scale: [0.62, 0.1, 0.74] });
    kit.add(CYL8, '#b8653f', { position: [x, EAVES + RISE + 1.02, 0.12], scale: [0.08, 0.2, 0.08] });
    kit.add(CYL8, '#b8653f', { position: [x, EAVES + RISE + 1.0, -0.13], scale: [0.08, 0.16, 0.08] });
  }
  // Porte bleue, linteau et piédroits de granit clair.
  const blue = '#3d6ea6';
  kit.add(BOX, blue, { position: [0.35, 0.68, DEPTH / 2 + 0.03], scale: [0.72, 1.36, 0.06] });
  kit.add(BOX, '#2f5788', { position: [0.35, 0.68, DEPTH / 2 + 0.065], scale: [0.06, 1.3, 0.02] });
  kit.add(BOX, '#d3cbbf', { position: [0.35, 1.44, DEPTH / 2 + 0.05], scale: [1.02, 0.18, 0.12] }, { jitter: 0.1, seed: 4 });
  for (const x of [-0.12, 0.82]) kit.add(BOX, '#cbc3b6', { position: [x, 0.7, DEPTH / 2 + 0.04], scale: [0.18, 1.42, 0.1] }, { jitter: 0.12, seed: x });
  kit.add(SPHERE, '#d8b45a', { position: [0.62, 0.7, DEPTH / 2 + 0.08], scale: 0.035 });
  // Fenêtres : encadrement blanc, volets bleus ouverts.
  for (const x of [-1.3, 1.45]) {
    kit.add(BOX, '#f2eee6', { position: [x, 1.05, DEPTH / 2 + 0.025], scale: [0.72, 0.78, 0.05] });
    for (const side of [-1, 1]) {
      kit.add(BOX, blue, { position: [x + side * 0.56, 1.05, DEPTH / 2 + 0.1], rotation: [0, side * 0.5, 0], scale: [0.32, 0.7, 0.04] });
    }
    kit.add(BOX, '#d3cbbf', { position: [x, 0.62, DEPTH / 2 + 0.07], scale: [0.86, 0.08, 0.16] });
  }
  // Soubassement et marche.
  kit.add(BOX, '#8d8883', { position: [0, -0.25, 0], scale: [LENGTH + 0.14, 0.6, DEPTH + 0.14] }, { jitter: 0.12, seed: 8 });
  kit.add(BOX, '#b2aca5', { position: [0.35, 0.06, DEPTH / 2 + 0.3], scale: [0.95, 0.14, 0.5] });
  // Hortensias bleus et roses de part et d'autre de la porte.
  for (const [x, color] of [[-0.45, '#7f9fe6'], [1.0, '#e58fb8'], [-2.0, '#9a8ce0']] as const) {
    kit.add(roughen(ICO1, 0.25, x), '#4f7f3a', { position: [x, 0.22, DEPTH / 2 + 0.35], scale: [0.36, 0.26, 0.3] }, { jitter: 0.2, seed: x });
    for (let k = 0; k < 4; k++) {
      kit.add(ICO1, color, {
        position: [x + (k - 1.5) * 0.17, 0.4 + (k % 2) * 0.08, DEPTH / 2 + 0.38 + (k % 2) * 0.1],
        scale: 0.13,
      }, { jitter: 0.25, seed: k + x * 5 });
    }
  }
  // Banc de bois sous la fenêtre de droite, et l'ordinateur des premiers essais.
  kit.add(BOX, '#8a6142', { position: [1.55, 0.42, DEPTH / 2 + 0.42], scale: [1.05, 0.07, 0.34] });
  for (const x of [1.15, 1.95]) kit.add(BOX, '#6f4b33', { position: [x, 0.2, DEPTH / 2 + 0.42], scale: [0.07, 0.4, 0.28] });
  kit.add(BOX, '#cfd4dc', { position: [1.6, 0.47, DEPTH / 2 + 0.46], scale: [0.34, 0.025, 0.24] });
  kit.add(BOX, '#cfd4dc', { position: [1.6, 0.6, DEPTH / 2 + 0.35], rotation: [-0.3, 0, 0], scale: [0.34, 0.22, 0.02] });
  // Deux casiers à homard contre le mur, une bouée orange.
  for (const [x, z, s] of [[-2.55, 0.9, 1], [-2.6, 0.35, 0.85]] as const) {
    kit.add(BOX, '#7b5a3c', { position: [x, 0.08 * s, z], scale: [0.5 * s, 0.16 * s, 0.4 * s] });
    kit.add(DOME, '#b48a55', { position: [x, 0.16 * s, z], scale: [0.25 * s, 0.24 * s, 0.2 * s] }, { jitter: 0.2, seed: x });
  }
  kit.add(SPHERE, '#ef7d2e', { position: [-2.45, 0.55, -0.2], scale: 0.16 });
  return kit.build();
}

function Cottage({ sampler }: { sampler: HeightSampler }) {
  const walls = useMemo(() => cottageWalls(), []);
  const details = useMemo(() => cottageDetails(), []);
  const wallMaterial = useMemo(() => new MeshStandardMaterial({ map: graniteWall(), roughness: 0.95 }), []);
  const screen = useRef<MeshStandardMaterial>(null);
  const [x, z] = fromFrame(COTTAGE.u, COTTAGE.v);
  const base = on(sampler, x, z, 2.2, 0.12);
  const yaw = faceCamera(x, z, -0.45);
  const chimney = useMemo<[number, number, number]>(() => {
    const local = LENGTH / 2 - 0.12;
    const y = base[1] + EAVES + RISE + 1.1;
    return [base[0] + Math.cos(yaw) * local, y, base[2] - Math.sin(yaw) * local];
  }, [base, yaw]);
  const texture = useMemo(() => codeScreen(), []);

  useFrame(() => {
    if (screen.current) screen.current.emissiveIntensity = 0.5 + skyState.dayNight * 1.6;
  });

  return (
    <group>
      <ClearingAt x={x} z={z} radius={3.2} />
      <group position={base} rotation-y={yaw}>
        <mesh geometry={walls} material={wallMaterial} castShadow receiveShadow />
        <mesh geometry={details} material={flatPaint} castShadow receiveShadow />
        <mesh position={[1.6, 0.605, DEPTH / 2 + 0.362]} rotation-x={-0.3}>
          <planeGeometry args={[0.3, 0.19]} />
          <meshStandardMaterial ref={screen} map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.5} roughness={0.4} />
        </mesh>
        <WindowPane seed={11} width={0.56} height={0.62} position={[-1.3, 1.05, DEPTH / 2 + 0.055]} />
        <WindowPane seed={23} width={0.56} height={0.62} position={[1.45, 1.05, DEPTH / 2 + 0.055]} />
        <WindowPane seed={5} width={0.5} height={0.5} position={[-0.9, 1.05, -DEPTH / 2 - 0.02]} rotation={[0, Math.PI, 0]} />
      </group>
      <ChimneySmoke position={chimney} />
    </group>
  );
}

/* ============================================================== Gwenn-ha-Du */

const FLAG_W = 1.5;
const FLAG_H = 1.0;

function BreizhFlag({ sampler }: { sampler: HeightSampler }) {
  const [x, z] = fromFrame(COTTAGE.u + 2.6, COTTAGE.v - 1.6);
  const base = on(sampler, x, z, 0.3, 0.05);
  const pole = useMemo(() => {
    const kit = new Kit();
    kit.add(CYL8, '#ece6da', { position: [0, 1.7, 0], scale: [0.045, 3.4, 0.045] });
    kit.add(SPHERE, '#d6a84a', { position: [0, 3.45, 0], scale: 0.08 });
    kit.add(CYL8, '#9a958f', { position: [0, 0.08, 0], scale: [0.22, 0.16, 0.22] });
    return kit.build();
  }, []);
  const cloth = useMemo(() => new PlaneGeometry(FLAG_W, FLAG_H, 14, 5).translate(FLAG_W / 2, 0, 0), []);
  const material = useMemo(() => clothMaterial({ map: gwennHaDu(), length: FLAG_W, amplitude: 0.13 }), []);
  return (
    <group position={base} rotation-y={faceCamera(x, z, Math.PI / 2 - 0.5)}>
      <mesh geometry={pole} material={flatPaint} castShadow />
      <mesh geometry={cloth} material={material} position={[0.04, 2.9, 0]} castShadow />
    </group>
  );
}

/* ================================================================ menhirs */

function menhirGeometry(seed: number) {
  const box = new SphereGeometry(1, 7, 6);
  const positions = box.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    // Pierre levée : fuselée en haut, épaisse en bas, flancs irréguliers.
    const taper = 1 - (y + 1) * 0.16;
    const key = Math.round(x * 50) * 1.3 + Math.round(y * 50) * 2.7 + Math.round(z * 50) * 4.1 + seed;
    const k = 0.86 + hash(key) * 0.24;
    positions.setXYZ(index, x * 0.42 * taper * k, (y + 1) * 0.5, z * 0.28 * taper * k);
  }
  box.computeVertexNormals();
  return box;
}

function Menhirs({ sampler }: { sampler: HeightSampler }) {
  const geometry = useMemo(() => {
    const kit = new Kit();
    const stones: [number, number, number, number, number][] = [
      // u, v, hauteur, inclinaison, cap
      [KNOLL.u + 0.5, KNOLL.v + 0.7, 3.3, 0.04, 0.4],
      [KNOLL.u - 0.9, KNOLL.v - 0.9, 2.3, -0.12, 1.3],
    ];
    stones.forEach(([u, v, height, tilt, yaw], index) => {
      const [x, z] = fromFrame(u, v);
      const y = on(sampler, x, z, 0.5, 0.35)[1];
      kit.add(menhirGeometry(index * 7 + 1), '#a5a19c', { position: [x, y, z], rotation: [tilt, yaw, tilt * 0.5], scale: [1, height, 1] }, {
        jitter: 0.1,
        seed: index,
        // Lichen jaune et mousse verte sur les faces exposées.
        paint: (px, py, pz, out) => {
          out.set('#a5a19c');
          const n = hash(Math.round(px * 6) * 1.7 + Math.round(py * 6) * 3.1 + Math.round(pz * 6) * 5.3);
          if (n > 0.86) out.set('#c9b860');
          else if (n > 0.74) out.set('#7e8f5c');
          else if (py - y < 0.35) out.set('#7d7a6f');
        },
      });
    });
    // Petites pierres couchées au pied.
    for (let index = 0; index < 5; index++) {
      const a = index * 1.9 + 0.4;
      const [x, z] = fromFrame(KNOLL.u + Math.cos(a) * 1.7, KNOLL.v + Math.sin(a) * 1.5);
      const y = sampler(x, z);
      kit.add(roughen(ICO0, 0.3, index), '#9f9a94', { position: [x, y - 0.05, z], rotation: [0, a, 0], scale: [0.32, 0.18, 0.24] }, { jitter: 0.15, seed: index });
    }
    return kit.build();
  }, [sampler]);
  const [cx, cz] = fromFrame(KNOLL.u, KNOLL.v);
  return (
    <group>
      <ClearingAt x={cx} z={cz} radius={2.6} />
      <mesh geometry={geometry} material={flatPaint} castShadow receiveShadow />
    </group>
  );
}

/* ================================================================ rochers */

const BOULDER = roughen(ICO1, 0.32, 2.7, [1, 0.7, 1]);

function Boulders({ sampler }: { sampler: HeightSampler }) {
  const mesh = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const list: { x: number; y: number; z: number; s: number; yaw: number; tone: Color }[] = [];
    const tones = ['#b9a39b', '#a9a49f', '#c2b0a4', '#9c9894'].map((hex) => new Color(hex));
    // Le long de la côte bretonne : on cherche le bord de l'eau rayon par rayon.
    for (let index = 0; index < 26; index++) {
      const angle = AXIS + 0.32 + (index / 25) * (Math.PI - 0.64) + (hash(index * 3.1) - 0.5) * 0.08;
      let r = RADIUS * 0.7;
      while (r < RADIUS * 1.25 && sampler(Math.cos(angle) * r, Math.sin(angle) * r) > 0.5) r += 0.2;
      r += (hash(index * 7.7) - 0.6) * 1.0;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const s = 0.45 + hash(index * 5.3) * 0.7;
      list.push({ x, z, y: sampler(x, z) - s * 0.25, s, yaw: hash(index) * 6, tone: tones[index % tones.length] });
      // Un second bloc plus petit, parfois.
      if (hash(index * 9.1) > 0.55) {
        const x2 = x + Math.cos(angle + 1.7) * 0.9;
        const z2 = z + Math.sin(angle + 1.7) * 0.9;
        list.push({ x: x2, z: z2, y: sampler(x2, z2) - 0.12, s: s * 0.55, yaw: hash(index * 2) * 6, tone: tones[(index + 1) % tones.length] });
      }
    }
    // Quelques blocs sur la lande et la butte.
    for (const [u, v, s] of [[-6.5, -11.5, 0.8], [-12.2, -4.5, 0.7], [1.5, -11.6, 0.6], [-7.4, -3.4, 0.5], [3.2, -9.2, 0.45]] as const) {
      const [x, z] = fromFrame(u, v);
      list.push({ x, z, y: sampler(x, z) - s * 0.3, s, yaw: u, tone: tones[Math.round(Math.abs(u)) % tones.length] });
    }
    return list;
  }, [sampler]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.yaw, 0);
      dummy.scale.set(item.s * 1.2, item.s, item.s);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, item.tone);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh ref={mesh} args={[BOULDER, undefined, items.length]} castShadow receiveShadow raycast={() => null}>
      <meshStandardMaterial roughness={0.95} flatShading />
    </instancedMesh>
  );
}

/* ============================================================ bruyère, ajonc */

function useHeath(sampler: HeightSampler) {
  return useMemo(() => {
    const avoid: [number, number, number][] = [
      [COTTAGE.u, COTTAGE.v, 3.4],
      [KNOLL.u, KNOLL.v, 2.4],
      [COTTAGE.u + 2.6, COTTAGE.v - 1.6, 0.8],
      ...Object.values(STEP_SPOTS).map(([u, v]) => [u, v, 1.6] as [number, number, number]),
    ];
    const spots = scatter(sampler, {
      count: 46,
      seed: 17,
      u: [-15, 13],
      v: [-16, -2],
      spacing: 1.0,
      accept: ({ x, z, y, u, v }) =>
        v - channelCenter(u) < -channelHalfWidth(u) - 0.6
        && y > 1.2
        && slopeAt(sampler, x, z) < 0.9
        && polylineDistance(TRAIL_BRETON, u, v) > 1.0
        && farFrom(u, v, avoid),
    });
    const heatherBody = new Color('#7a5683');
    const heatherBloom = new Color('#d68bdd');
    const gorseBody = new Color('#3f6a35');
    const gorseBloom = new Color('#f6c42c');
    return spots.map<ShrubItem>((spot) => {
      const gorse = spot.r > 0.58;
      return {
        x: spot.x,
        y: spot.y - 0.08,
        z: spot.z,
        scale: (gorse ? 0.85 : 0.65) + hash(spot.r * 31) * 0.45,
        yaw: spot.r * 12,
        body: (gorse ? gorseBody : heatherBody).clone().multiplyScalar(0.9 + hash(spot.r * 7) * 0.2),
        bloom: gorse ? gorseBloom : heatherBloom,
      };
    });
  }, [sampler]);
}

/* ============================================================ la crique */

function hullGeometry() {
  // Coque : demi-sphère étirée, étrave pincée, tonture relevée aux extrémités.
  const hull = new SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const positions = hull.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    let y = positions.getY(index);
    let z = positions.getZ(index);
    const bow = Math.max(0, x);
    z *= 1 - bow * bow * 0.55;
    y = y * 0.55 + (Math.abs(y) < 0.02 ? x * x * 0.14 : 0);
    positions.setXYZ(index, x * 1.55, y, z * 0.62);
  }
  hull.computeVertexNormals();
  return hull;
}

function fishingBoat() {
  const kit = new Kit();
  kit.add(hullGeometry(), '#2f6d9e', {}, {
    paint: (_x, y, _z, out) => {
      if (y < -0.36) out.set('#b9442f');
      else if (y > -0.09) out.set('#f2ede2');
      else out.set('#2f6d9e');
    },
  });
  // Pont, plat-bord, banc, mât et voile rouge ferlée sur sa bôme.
  kit.add(CYL12, '#b98c5c', { position: [0, 0.0, 0], scale: [1.48, 0.04, 0.58] });
  kit.add(RING, '#f3eee3', { position: [0, 0.03, 0], rotation: [Math.PI / 2, 0, 0], scale: [1.5, 0.6, 0.5] });
  kit.add(BOX, '#a57a4f', { position: [-0.2, 0.1, 0], scale: [0.18, 0.06, 1.0] });
  kit.add(CYL6, '#8a6040', { position: [0.45, 1.15, 0], scale: [0.045, 2.3, 0.045] });
  kit.add(CYL6, '#8a6040', { position: [-0.15, 0.55, 0], rotation: [0, 0, Math.PI / 2 - 0.08], scale: [0.035, 1.3, 0.035] });
  kit.add(roughen(CYL8, 0.2, 3), '#b5502c', { position: [-0.15, 0.64, 0], rotation: [0, 0, Math.PI / 2 - 0.08], scale: [0.11, 1.25, 0.11] }, { jitter: 0.15, seed: 2 });
  kit.add(BOX, '#2a2c30', { position: [1.62, 0.12, 0], scale: [0.08, 0.06, 0.06] });
  // Avirons posés en travers.
  kit.add(BOX, '#c9a06a', { position: [0.15, 0.13, 0.05], rotation: [0, 0.18, 0.04], scale: [1.9, 0.035, 0.07] });
  return kit.build();
}

function coveGear() {
  const kit = new Kit();
  // Filet tendu entre deux perches (le filet lui-même est à part, transparent).
  for (const x of [-1.1, 1.1]) kit.add(CYL6, '#8a6a4c', { position: [x, 0.8, 0], scale: [0.045, 1.6, 0.045] });
  for (let k = 0; k < 6; k++) kit.add(SPHERE, '#e8b64a', { position: [-0.95 + k * 0.38, 1.47 - Math.sin((k / 5) * Math.PI) * 0.12, 0.03], scale: [0.07, 0.05, 0.07] });
  // Casier, bouées, cordage lové, ancre.
  kit.add(BOX, '#7b5a3c', { position: [1.8, 0.08, 0.9], scale: [0.5, 0.16, 0.4] });
  kit.add(DOME, '#b48a55', { position: [1.8, 0.16, 0.9], scale: [0.25, 0.24, 0.2] }, { jitter: 0.2, seed: 5 });
  kit.add(SPHERE, '#e5552f', { position: [-1.6, 0.14, 0.8], scale: 0.15 });
  kit.add(SPHERE, '#f2c14e', { position: [-1.85, 0.12, 0.55], scale: 0.12 });
  kit.add(RING, '#d6c39b', { position: [1.2, 0.05, 1.5], rotation: [Math.PI / 2, 0, 0], scale: [0.26, 0.26, 0.5] });
  kit.add(RING, '#d6c39b', { position: [1.2, 0.1, 1.5], rotation: [Math.PI / 2, 0, 0], scale: [0.2, 0.2, 0.5] });
  // Ancre rouillée couchée sur le sable.
  kit.add(BOX, '#5d4a40', { position: [-0.6, 0.06, 1.7], rotation: [0, 0.6, 0], scale: [0.08, 0.08, 0.9] });
  kit.add(RING, '#5d4a40', { position: [-0.33, 0.07, 2.08], rotation: [Math.PI / 2, 0, 0.6], scale: [0.1, 0.1, 0.6] });
  kit.add(CONE8, '#5d4a40', { position: [-0.86, 0.06, 1.35], rotation: [Math.PI / 2, 0, 0.6 + Math.PI / 2], scale: [0.09, 0.5, 0.06] });
  return kit.build();
}

function FishingCove({ sampler }: { sampler: HeightSampler }) {
  const boat = useMemo(() => fishingBoat(), []);
  const gear = useMemo(() => coveGear(), []);
  const net = useMemo(() => {
    const texture = fishingNet().clone();
    texture.repeat.set(3, 1.4);
    texture.needsUpdate = true;
    return clothMaterial({ map: texture, length: 1.3, amplitude: 0.06, hang: true, speed: 2.4, alphaTest: 0.3 });
  }, []);
  const netGeometry = useMemo(() => new PlaneGeometry(2.1, 1.25, 8, 5).translate(0, -0.625, 0), []);
  // Le canot, proue vers l'eau, couché sur son bouchain.
  const edge = channelCenter(COVE.u) - channelHalfWidth(COVE.u);
  const [bx, bz] = fromFrame(COVE.u + 0.3, edge - 1.75);
  const boatY = sampler(bx, bz) + 0.42;
  const boatYaw = Math.PI / 2 - AXIS + 0.35;
  const [gx, gz] = fromFrame(COVE.u - 1.6, edge - 2.6);
  const gearBase = on(sampler, gx, gz, 0.8, 0.05);
  return (
    <group>
      <ClearingAt x={bx} z={bz} radius={2} />
      <group position={[bx, boatY, bz]} rotation-y={boatYaw}>
        <mesh geometry={boat} material={smoothPaint} rotation-x={0.22} castShadow receiveShadow />
      </group>
      <group position={gearBase} rotation-y={faceCamera(gx, gz, 0.4)}>
        <mesh geometry={gear} material={flatPaint} castShadow receiveShadow />
        <mesh geometry={netGeometry} material={net} position={[0, 1.48, 0]} castShadow />
      </group>
    </group>
  );
}

/* ============================================================ le crachin */

const DROPS = 90;

const rainVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uFall;
varying float vAlpha;
void main() {
  vec3 p = position;
  float speed = 6.5 + fract(aSeed * 7.13) * 2.0;
  float fall = mod(uTime * speed + aSeed * uFall, uFall);
  p.y -= fall;
  p.x += fall * 0.12;
  vAlpha = smoothstep(0.0, 0.6, fall) * (1.0 - smoothstep(uFall - 0.9, uFall, fall));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const rainFragment = /* glsl */ `
uniform float uNight;
varying float vAlpha;
void main() {
  vec3 color = mix(vec3(0.86, 0.93, 1.0), vec3(0.45, 0.55, 0.7), uNight);
  gl_FragColor = vec4(color, vAlpha * 0.75);
}
`;

function cloudGeometry() {
  const kit = new Kit();
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1.15], [1.15, -0.15, 0.25, 0.85], [-1.1, -0.2, -0.1, 0.9], [0.4, 0.45, -0.35, 0.85],
    [-0.45, 0.35, 0.45, 0.75], [1.85, -0.35, -0.3, 0.55], [-1.9, -0.4, 0.3, 0.55],
  ];
  puffs.forEach(([x, y, z, r], index) => {
    kit.add(roughen(ICO1, 0.16, index * 2.1), '#ffffff', { position: [x, y, z], scale: [r, r * 0.78, r * 0.92] }, {
      // Ventre gris ardoise, sommet clair.
      paint: (_px, py, _pz, out) => out.set('#7f8a9c').lerp(new Color('#e3e8ef'), smooth(-0.7, 0.9, py)),
    });
  });
  return kit.build();
}

function rainGeometry() {
  const positions = new Float32Array(DROPS * 6);
  const seeds = new Float32Array(DROPS * 2);
  for (let index = 0; index < DROPS; index++) {
    const a = hash(index * 2.31) * Math.PI * 2;
    const r = Math.sqrt(hash(index * 4.77)) * 2.3;
    const x = Math.cos(a) * r * 1.25;
    const z = Math.sin(a) * r * 0.85;
    const length = 0.28 + hash(index * 1.13) * 0.14;
    positions.set([x, 0, z, x + length * 0.12, -length, z], index * 6);
    seeds[index * 2] = hash(index * 9.73);
    seeds[index * 2 + 1] = seeds[index * 2];
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  return geometry;
}

const RAIN_MATERIAL = new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uFall: { value: 5 }, uNight: { value: 0 } },
  vertexShader: rainVertex,
  fragmentShader: rainFragment,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
});

function RainCloud({ sampler }: { sampler: HeightSampler }) {
  const group = useRef<Group>(null);
  const cloud = useMemo(() => cloudGeometry(), []);
  const [u, v] = [COTTAGE.u + 1.4, COTTAGE.v + 1.6];
  const [x, z] = fromFrame(u, v);
  const ground = sampler(x, z);
  const height = ground + 5.6;
  const rain = useMemo(() => rainGeometry(), []);
  const quality = useWorld((state) => state.quality);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.set(x + Math.sin(t * 0.21) * 0.5, height + Math.sin(t * 0.7) * 0.12, z + Math.cos(t * 0.17) * 0.35);
      group.current.rotation.y = Math.sin(t * 0.1) * 0.12;
    }
    RAIN_MATERIAL.uniforms.uTime.value = t;
    RAIN_MATERIAL.uniforms.uNight.value = skyState.dayNight;
  });

  useLayoutEffect(() => {
    RAIN_MATERIAL.uniforms.uFall.value = height - ground - 0.7;
  }, [ground, height]);

  return (
    <group ref={group} position={[x, height, z]}>
      <mesh geometry={cloud} material={smoothPaint} scale={0.95} castShadow raycast={() => null} />
      {quality !== 'low' && (
        <lineSegments geometry={rain} material={RAIN_MATERIAL} position-y={-0.55} frustumCulled={false} raycast={() => null} />
      )}
    </group>
  );
}

/* ================================================================ racine */

export function Bretagne({ sampler }: { sampler: HeightSampler }) {
  const heath = useHeath(sampler);
  return (
    <group>
      <Cottage sampler={sampler} />
      <BreizhFlag sampler={sampler} />
      <Menhirs sampler={sampler} />
      <Boulders sampler={sampler} />
      <Shrubs items={heath} />
      <FishingCove sampler={sampler} />
      <RainCloud sampler={sampler} />
    </group>
  );
}
