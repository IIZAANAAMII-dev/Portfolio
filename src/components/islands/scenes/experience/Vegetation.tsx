'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../../terrain-shape';
import { groundAt } from '../../terrain-shape';
import { BEC } from './layout';

/**
 * Végétation provençale : pins parasols (tronc élancé qui se cambre, houppier plat en
 * ombrelle), cyprès en fuseau, oliviers gris-vert, un carré de lavande et des touffes de
 * garrigue ; rochers de poudingue sur la grève. Tout est instancié : cinq appels de dessin.
 */

type XZ = readonly [number, number];

/** Pins parasols : position, taille ; les deux derniers disparaissent en basse qualité. */
const PINES: [number, number, number][] = [
  [-4.7, 3.4, 1.0],
  [0.4, 7.6, 1.1],
  [9.6, -3.4, 0.95],
  [-1.9, -9.6, 0.9],
  [2.0, 10.0, 1.05],
  [-9.0, 5.6, 1.0],
  [-5.6, 8.4, 0.9],
];
const OLIVES: [number, number][] = [[8.6, 6.4], [-8.7, 1.2], [10.4, -0.6]];
const CYPRESSES: [number, number, number][] = [[2.42, -9.82, 1.0], [3.2, -4.68, 0.85], [9.2, 4.6, 0.95], [-4.2, -2.4, 0.9]];
const LAVENDER = { center: [3.9, 7.4] as XZ, rows: 5, perRow: 8, along: [0.94, 0.34] as XZ };
/** Angles de la grève où poser des rochers (ni port, ni chantier, ni ponton). */
const ROCK_ANGLES = [-0.95, -0.62, -0.3, 0.05, 0.32, 0.55, 0.85, 1.12, 1.45, 1.75, 2.05, 2.32, 2.55];

interface Puff {
  at: Vector3;
  scale: Vector3;
  color: Color;
}

interface Limb {
  from: Vector3;
  to: Vector3;
  radius: number;
}

const PINE_DARK = new Color('#3f6b38');
const PINE_MID = new Color('#4f7d3f');
const PINE_LIGHT = new Color('#6b9547');
const OLIVE_DARK = new Color('#7d9460');
const OLIVE_LIGHT = new Color('#a7b88a');

function pine(sampler: HeightSampler, x: number, z: number, size: number, seed: number, limbs: Limb[], puffs: Puff[]) {
  const y = groundAt(sampler, x, z, 0.3) - 0.1;
  const height = (3.1 + hash(seed * 1.7) * 0.7) * size;
  const leanAngle = hash(seed * 2.9) * Math.PI * 2;
  const lean = (0.16 + hash(seed * 3.7) * 0.14) * height;
  const base = new Vector3(x, y, z);
  // Tronc en deux segments : il penche, puis se redresse sous le houppier.
  const middle = new Vector3(x + Math.cos(leanAngle) * lean * 0.75, y + height * 0.55, z + Math.sin(leanAngle) * lean * 0.75);
  const top = new Vector3(x + Math.cos(leanAngle) * lean, y + height, z + Math.sin(leanAngle) * lean);
  limbs.push({ from: base, to: middle, radius: 0.2 * size }, { from: middle, to: top, radius: 0.15 * size });
  const crown = 1.55 * size;
  puffs.push({ at: top.clone().add(new Vector3(0, 0.35 * size, 0)), scale: new Vector3(crown, crown * 0.36, crown), color: PINE_MID.clone() });
  const count = 5;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + hash(seed + index * 1.3) * 0.8;
    const reach = crown * (0.78 + hash(seed + index * 2.1) * 0.2);
    const at = top.clone().add(new Vector3(Math.cos(angle) * reach, (hash(seed + index * 3.3) - 0.3) * 0.35 * size, Math.sin(angle) * reach));
    const scale = crown * (0.62 + hash(seed + index * 4.7) * 0.18);
    puffs.push({
      at,
      scale: new Vector3(scale, scale * 0.42, scale),
      color: (index % 2 ? PINE_DARK : PINE_LIGHT).clone().multiplyScalar(0.92 + hash(seed + index) * 0.16),
    });
    if (index % 2 === 0) limbs.push({ from: top.clone().setY(top.y - 0.25 * size), to: at.clone().setY(at.y - 0.15), radius: 0.07 * size });
  }
}

function olive(sampler: HeightSampler, x: number, z: number, seed: number, limbs: Limb[], puffs: Puff[]) {
  const y = groundAt(sampler, x, z, 0.3) - 0.08;
  const base = new Vector3(x, y, z);
  const knee = new Vector3(x + (hash(seed) - 0.5) * 0.5, y + 0.75, z + (hash(seed * 2) - 0.5) * 0.5);
  const top = knee.clone().add(new Vector3((hash(seed * 3) - 0.5) * 0.6, 0.7, (hash(seed * 4) - 0.5) * 0.6));
  limbs.push({ from: base, to: knee, radius: 0.17 }, { from: knee, to: top, radius: 0.12 });
  for (let index = 0; index < 4; index++) {
    const angle = index * 1.7 + hash(seed + index) * 0.6;
    const reach = index === 0 ? 0 : 0.62;
    const s = 0.75 + hash(seed + index * 5.1) * 0.25;
    puffs.push({
      at: top.clone().add(new Vector3(Math.cos(angle) * reach, 0.25 + (index === 0 ? 0.25 : 0), Math.sin(angle) * reach)),
      scale: new Vector3(s, s * 0.7, s),
      color: OLIVE_DARK.clone().lerp(OLIVE_LIGHT, hash(seed + index * 2.2)),
    });
  }
}

const UP = new Vector3(0, 1, 0);
const tmpDirection = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpPosition = new Vector3();

const TRUNK_GEOMETRY = new CylinderGeometry(0.65, 1, 1, 6).translate(0, 0.5, 0);
const PUFF_GEOMETRY = new IcosahedronGeometry(1, 1);
const CYPRESS_GEOMETRY = new LatheGeometry(
  [[0, 0], [0.32, 0.04], [0.5, 0.3], [0.5, 0.55], [0.38, 0.78], [0.2, 0.94], [0, 1.04]].map(([r, y]) => new Vector2(r, y)),
  7,
);
const BUSH_GEOMETRY = new SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const ROCK_GEOMETRY = new IcosahedronGeometry(1, 0);

const BARK = new MeshStandardMaterial({ color: '#7a5a44', roughness: 1, flatShading: true });
const FOLIAGE = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
const CYPRESS = new MeshStandardMaterial({ color: '#3d6436', roughness: 1, flatShading: true });
const LAVENDER_MATERIAL = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
const ROCK = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });

/** Remplit une InstancedMesh (matrices, couleurs éventuelles). */
function fill(target: InstancedMesh | null, matrices: Matrix4[], colors?: Color[]) {
  if (!target) return;
  matrices.forEach((m, index) => target.setMatrixAt(index, m));
  colors?.forEach((color, index) => target.setColorAt(index, color));
  target.instanceMatrix.needsUpdate = true;
  if (target.instanceColor) target.instanceColor.needsUpdate = true;
  target.computeBoundingSphere();
}

export function Vegetation({ sampler }: { sampler: HeightSampler }) {
  const quality = useWorld((state) => state.quality);
  const low = quality === 'low';
  const trunks = useRef<InstancedMesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const cypresses = useRef<InstancedMesh>(null);
  const lavender = useRef<InstancedMesh>(null);
  const rocks = useRef<InstancedMesh>(null);

  const trees = useMemo(() => {
    const limbs: Limb[] = [];
    const leaves: Puff[] = [];
    PINES.slice(0, low ? 5 : PINES.length).forEach(([x, z, size], index) => pine(sampler, x, z, size, index * 7.3 + 2, limbs, leaves));
    OLIVES.forEach(([x, z], index) => olive(sampler, x, z, index * 5.1 + 9, limbs, leaves));
    // Maquis ras sur la tête et le dos du Bec de l'Aigle, touffes de garrigue au bord du plateau.
    const scrub: [number, number, number][] = [
      [BEC.head[0] - 0.9, BEC.head[1] + 0.7, 0.55], [BEC.head[0] + 0.8, BEC.head[1] + 0.2, 0.5], [BEC.head[0] - 0.2, BEC.head[1] + 1.6, 0.6],
      [-7.3, -8.6, 0.6], [-6.7, -7.3, 0.55], [-7.9, -7.6, 0.45],
      [10.6, -5.6, 0.45], [11.2, 2.8, 0.42], [-10.4, 7.2, 0.5], [7.9, 8.9, 0.45], [-3.3, 10.4, 0.5], [-10.8, -4.9, 0.4],
    ];
    scrub.forEach(([x, z, s], index) => {
      leaves.push({
        at: new Vector3(x, sampler(x, z) + s * 0.2, z),
        scale: new Vector3(s * 1.15, s * 0.62, s),
        color: new Color(index < 6 ? '#566f3b' : '#7f9466').multiplyScalar(0.92 + hash(index * 3.1) * 0.16),
      });
    });
    const limbMatrices = limbs.map(({ from, to, radius }) => {
      tmpDirection.copy(to).sub(from);
      const length = tmpDirection.length();
      tmpQuaternion.setFromUnitVectors(UP, tmpDirection.normalize());
      return new Matrix4().compose(from, tmpQuaternion, tmpScale.set(radius, length, radius));
    });
    const puffMatrices = leaves.map(({ at, scale }, index) => {
      tmpQuaternion.setFromAxisAngle(UP, hash(index * 1.9) * Math.PI);
      return new Matrix4().compose(at, tmpQuaternion, scale);
    });
    return { limbMatrices, puffMatrices, puffColors: leaves.map((leaf) => leaf.color) };
  }, [low, sampler]);

  const cypressMatrices = useMemo(() => CYPRESSES.map(([x, z, size], index) => {
    const y = groundAt(sampler, x, z, 0.3) - 0.1;
    tmpQuaternion.setFromAxisAngle(UP, hash(index * 2.3) * Math.PI);
    return new Matrix4().compose(tmpPosition.set(x, y, z), tmpQuaternion, tmpScale.set(0.62 * size, 4.4 * size, 0.62 * size));
  }), [sampler]);

  const field = useMemo(() => {
    const matrices: Matrix4[] = [];
    const colors: Color[] = [];
    const [ax, az] = LAVENDER.along;
    const [cx, cz] = LAVENDER.center;
    const base = new Color('#8f74cf');
    const light = new Color('#b59ae6');
    for (let row = 0; row < LAVENDER.rows; row++) {
      for (let k = 0; k < LAVENDER.perRow; k++) {
        const along = (k - (LAVENDER.perRow - 1) / 2) * 0.58;
        const across = (row - (LAVENDER.rows - 1) / 2) * 0.82;
        const x = cx + ax * along - az * across;
        const z = cz + az * along + ax * across;
        const s = 0.3 + hash(row * 11.3 + k * 3.1) * 0.06;
        tmpQuaternion.setFromAxisAngle(UP, hash(row * 7 + k) * Math.PI);
        matrices.push(new Matrix4().compose(tmpPosition.set(x, sampler(x, z) - 0.04, z), tmpQuaternion, tmpScale.set(s * 1.1, s * 1.25, s)));
        colors.push(base.clone().lerp(light, hash(row * 5.7 + k * 1.3)));
      }
    }
    return { matrices, colors };
  }, [sampler]);

  const stones = useMemo(() => {
    const matrices: Matrix4[] = [];
    const colors: Color[] = [];
    const dummy = new Object3D();
    ROCK_ANGLES.forEach((angle, index) => {
      // Pied de falaise ou bord de l'eau, selon le tirage.
      const reach = 13.6 + hash(index * 4.1) * 2.4;
      const x = Math.cos(angle) * reach;
      const z = Math.sin(angle) * reach;
      const size = 0.45 + hash(index * 2.7) * 0.5;
      dummy.position.set(x, sampler(x, z) - size * 0.3, z);
      dummy.rotation.set(hash(index * 1.1) * 3, hash(index * 1.7) * 3, hash(index * 2.3) * 3);
      dummy.scale.set(size * 1.2, size * 0.75, size);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(new Color('#b79673').lerp(new Color('#8f7a66'), hash(index * 6.1)));
    });
    return { matrices, colors };
  }, [sampler]);

  useLayoutEffect(() => {
    fill(trunks.current, trees.limbMatrices);
    fill(puffs.current, trees.puffMatrices, trees.puffColors);
  }, [trees]);
  useLayoutEffect(() => fill(cypresses.current, cypressMatrices), [cypressMatrices]);
  useLayoutEffect(() => fill(lavender.current, field.matrices, field.colors), [field, low]);
  useLayoutEffect(() => fill(rocks.current, stones.matrices, stones.colors), [stones]);

  return (
    <>
      <instancedMesh ref={trunks} args={[TRUNK_GEOMETRY, BARK, trees.limbMatrices.length]} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={puffs} args={[PUFF_GEOMETRY, FOLIAGE, trees.puffMatrices.length]} castShadow raycast={() => null} />
      <instancedMesh ref={cypresses} args={[CYPRESS_GEOMETRY, CYPRESS, cypressMatrices.length]} castShadow raycast={() => null} />
      {!low && <instancedMesh ref={lavender} args={[BUSH_GEOMETRY, LAVENDER_MATERIAL, field.matrices.length]} raycast={() => null} />}
      <instancedMesh ref={rocks} args={[ROCK_GEOMETRY, ROCK, stones.matrices.length]} castShadow receiveShadow raycast={() => null} />
    </>
  );
}
