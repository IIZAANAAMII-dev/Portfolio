'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash, smoothstep } from '@/lib/utils/math';
import type { HeightSampler } from '../../terrain-shape';
import { clothMaterial } from './cloth';
import { ridgeOf } from './houses';
import { JETTY_LIGHT } from './Harbor';
import { CHAPEL, CHAPEL_AT, CHAPEL_FACING, DOCK_YAW, FISHERMAN, HARBOR, HOUSES, LAUNDRY, PASTURE, QUAY_Y, facing, fromDock, polar } from './layout';
import { lighthousePerch } from './Lighthouse';
import { Mesher, pose, type Vec3 } from './mesher';
import { netTexture } from './textures';
import { housePose } from './Village';

/**
 * La vie du hameau : goélands perchés qui tournent la tête, moutons qui paissent sur la
 * lande (dont un noir, de la race d'Ouessant), un pêcheur en ciré jaune qui ravaude ses
 * filets sur le quai, et du linge qui sèche au vent sur le plateau.
 */

const scratch = new Object3D();
const head = new Object3D();
const matrix = new Matrix4();

/* ------------------------------------------------------------------ goélands */

function gullBody() {
  const mesh = new Mesher(true, false);
  const ball = new SphereGeometry(1, 10, 8);
  mesh.add(ball, pose([0, 0.2, 0], [0, 0, 0.12], [0.26, 0.13, 0.12]), '#f5f4f0');
  // Ailes repliées gris perle, bout noir, queue.
  for (const side of [-1, 1]) {
    mesh.add(ball, pose([-0.05, 0.25, side * 0.075], [0, 0, 0.18], [0.24, 0.07, 0.06]), '#b9c0c9');
  }
  mesh.box([0.16, 0.05, 0.12], [-0.27, 0.27, 0], [0, 0, 0.25], '#25272c');
  mesh.rod([0.02, 0.0, 0.04], [0.02, 0.12, 0.04], 0.012, '#f0b545', 4);
  mesh.rod([0.02, 0.0, -0.04], [0.02, 0.12, -0.04], 0.012, '#f0b545', 4);
  ball.dispose();
  return mesh.build()!;
}

function gullHead() {
  const mesh = new Mesher(true, false);
  mesh.add(new SphereGeometry(0.075, 10, 8), pose([0.03, 0.05, 0]), '#f7f6f2');
  mesh.add(new CylinderGeometry(0.0, 0.022, 0.1, 6), pose([0.13, 0.04, 0], [0, 0, -Math.PI / 2]), '#f2c14e');
  mesh.box([0.02, 0.018, 0.02], [0.14, 0.03, 0], [0, 0, 0], '#d8433b');
  for (const side of [-1, 1]) mesh.box([0.018, 0.018, 0.01], [0.07, 0.07, side * 0.06], [0, 0, 0], '#1e1f24');
  return mesh.build()!;
}

interface Perch {
  at: Vec3;
  yaw: number;
}

function Gulls({ perches }: { perches: Perch[] }) {
  const bodies = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => ({ body: gullBody(), head: gullHead() }), []);
  useEffect(() => () => {
    geometry.body.dispose();
    geometry.head.dispose();
  }, [geometry]);
  useLayoutEffect(() => {
    const target = bodies.current;
    if (!target) return;
    perches.forEach(({ at, yaw }, index) => {
      scratch.position.set(...at);
      scratch.rotation.set(0, yaw, 0);
      scratch.scale.setScalar(1.25);
      scratch.updateMatrix();
      target.setMatrixAt(index, scratch.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [perches]);
  useFrame((state) => {
    const target = heads.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    perches.forEach(({ at, yaw }, index) => {
      // La tête se pose, regarde ailleurs d'un coup sec ; de temps en temps un hochement.
      const clock = time * 0.42 + index * 1.37;
      const step = Math.floor(clock);
      const from = (hash(step + index * 11) - 0.5) * 1.6;
      const to = (hash(step + 1 + index * 11) - 0.5) * 1.6;
      const turn = from + (to - from) * smoothstep(0.82, 0.95, clock - step);
      const nod = Math.pow(Math.max(0, Math.sin(time * 0.85 + index * 2.3)), 40) * 0.7;
      scratch.position.set(...at);
      scratch.rotation.set(0, yaw, 0);
      scratch.scale.setScalar(1.25);
      scratch.updateMatrix();
      head.position.set(0.17, 0.3 + Math.sin(time * 2 + index) * 0.004, 0);
      head.rotation.set(0, turn, -nod);
      head.updateMatrix();
      matrix.multiplyMatrices(scratch.matrix, head.matrix);
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={bodies} args={[geometry.body, undefined, perches.length]} castShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geometry.head, undefined, perches.length]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
    </>
  );
}

/* -------------------------------------------------------------------- moutons */

function sheepBody(dark: boolean) {
  const mesh = new Mesher(true, false);
  const fleece = new IcosahedronGeometry(1, 1);
  const wool = dark ? '#3b3330' : '#f1ece2';
  mesh.add(fleece, pose([0, 0.42, 0], [0, 0, 0], [0.36, 0.24, 0.22]), wool);
  for (const [x, y, z] of [[0.18, 0.55, 0.08], [-0.14, 0.56, -0.07], [0.0, 0.6, 0.1], [-0.2, 0.5, 0.1]]) {
    mesh.add(fleece, pose([x, y, z], [x, y, z], 0.13), wool);
  }
  for (const [x, z] of [[0.2, 0.1], [0.2, -0.1], [-0.2, 0.1], [-0.2, -0.1]]) {
    mesh.rod([x, 0, z], [x, 0.3, z], 0.03, '#2a2422', 4);
  }
  fleece.dispose();
  return mesh.build()!;
}

function sheepHead(dark: boolean) {
  const mesh = new Mesher(true, false);
  const face = dark ? '#2a2422' : '#3a3330';
  mesh.add(new IcosahedronGeometry(1, 1), pose([0.1, -0.02, 0], [0, 0, -0.4], [0.13, 0.08, 0.075]), face);
  for (const side of [-1, 1]) mesh.box([0.04, 0.03, 0.1], [0.02, 0.04, side * 0.09], [0.4 * side, 0, 0], face);
  mesh.add(new IcosahedronGeometry(1, 0), pose([0.0, 0.05, 0]), dark ? '#3b3330' : '#f1ece2');
  return mesh.build()!;
}

const FLOCK = [
  { phase: 0.0, speed: 0.045, dark: false },
  { phase: 2.1, speed: 0.038, dark: false },
  { phase: 4.0, speed: 0.05, dark: true },
  { phase: 5.3, speed: 0.033, dark: false },
];

function Sheep({ sampler }: { sampler: HeightSampler }) {
  const white = useRef<InstancedMesh>(null);
  const dark = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const darkHead = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => ({ white: sheepBody(false), dark: sheepBody(true), head: sheepHead(false), darkHead: sheepHead(true) }), []);
  useEffect(() => () => Object.values(geometry).forEach((item) => item.dispose()), [geometry]);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    let whiteIndex = 0;
    FLOCK.forEach((sheep) => {
      // Une promenade lente en courbe de Lissajous dans le pré.
      const t = time * sheep.speed + sheep.phase;
      const x = PASTURE.center[0] + Math.sin(t * 1.0) * PASTURE.radius * 0.85;
      const z = PASTURE.center[1] + Math.sin(t * 1.7 + 0.8) * PASTURE.radius * 0.6;
      const vx = Math.cos(t) * 1.0;
      const vz = Math.cos(t * 1.7 + 0.8) * 1.7 * 0.7;
      const y = sampler(x, z);
      // Broute (tête en bas), relève la tête et mâche, puis reprend.
      const graze = smoothstep(0.2, 0.5, Math.sin(time * 0.31 + sheep.phase * 3) * 0.5 + 0.5);
      const chew = Math.sin(time * 9 + sheep.phase) * 0.04 * (1 - graze);
      scratch.position.set(x, y - 0.02, z);
      scratch.rotation.set(0, Math.atan2(-vz, vx), 0);
      scratch.scale.setScalar(1.15);
      scratch.updateMatrix();
      head.position.set(0.36, 0.52 - graze * 0.24, 0);
      head.rotation.set(0, 0, -graze * 0.75 + chew);
      head.updateMatrix();
      matrix.multiplyMatrices(scratch.matrix, head.matrix);
      if (sheep.dark) {
        dark.current?.setMatrixAt(0, scratch.matrix);
        darkHead.current?.setMatrixAt(0, matrix);
      } else {
        white.current?.setMatrixAt(whiteIndex, scratch.matrix);
        heads.current?.setMatrixAt(whiteIndex, matrix);
        whiteIndex += 1;
      }
    });
    for (const mesh of [white.current, dark.current, heads.current, darkHead.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  const whites = FLOCK.filter((sheep) => !sheep.dark).length;
  return (
    <group>
      <instancedMesh ref={white} args={[geometry.white, undefined, whites]} castShadow frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geometry.head, undefined, whites]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={dark} args={[geometry.dark, undefined, 1]} castShadow frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={darkHead} args={[geometry.darkHead, undefined, 1]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------- pêcheur */

const OILSKIN = '#f2c230';

function fishermanBody() {
  const mesh = new Mesher(true, false);
  // Caisse retournée qui lui sert de siège.
  mesh.box([0.42, 0.32, 0.58], [-0.05, 0.16, 0], [0, 0, 0], '#b98a55');
  // Jambes (pantalon bleu) et bottes noires.
  for (const side of [-1, 1]) {
    mesh.box([0.36, 0.13, 0.13], [0.15, 0.38, side * 0.09], [0, 0, 0], '#2f3f63');
    mesh.box([0.13, 0.3, 0.13], [0.32, 0.17, side * 0.09], [0, 0, 0], '#2f3f63');
    mesh.box([0.2, 0.1, 0.13], [0.36, 0.05, side * 0.09], [0, 0, 0], '#1d1e22');
  }
  // Ciré jaune, un peu penché sur l'ouvrage.
  mesh.box([0.26, 0.42, 0.36], [0.0, 0.62, 0], [0, 0, -0.18], OILSKIN);
  mesh.box([0.28, 0.08, 0.38], [0.04, 0.84, 0], [0, 0, -0.18], '#e2b325');
  // Tête, barbe blanche, casquette de marin.
  mesh.add(new SphereGeometry(0.1, 10, 8), pose([0.09, 0.97, 0]), '#f0c6a0');
  mesh.add(new SphereGeometry(0.07, 8, 6), pose([0.15, 0.91, 0], [0, 0, 0], [0.9, 0.8, 1.1]), '#f2efe8');
  mesh.add(new CylinderGeometry(0.1, 0.105, 0.06, 12), pose([0.09, 1.06, 0]), '#24324f');
  mesh.box([0.1, 0.015, 0.14], [0.19, 1.04, 0], [0, 0, -0.15], '#1b2438');
  return mesh.build()!;
}

function fishermanArm() {
  const mesh = new Mesher(true, false);
  mesh.rod([0, 0, 0], [0.24, -0.16, 0], 0.045, OILSKIN, 5);
  mesh.add(new SphereGeometry(0.04, 6, 5), pose([0.26, -0.17, 0]), '#f0c6a0');
  return mesh.build()!;
}

function Fisherman() {
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const geometry = useMemo(() => ({ body: fishermanBody(), arm: fishermanArm() }), []);
  const net = useMemo(() => {
    const map = netTexture().clone();
    map.repeat.set(0.7 / 0.12, 0.6 / 0.12);
    map.needsUpdate = true;
    return clothMaterial({ color: '#3f7a78', map, mode: 'hang', amplitude: 0.03, speed: 0.5, alphaTest: 0.45 });
  }, []);
  useEffect(() => () => {
    geometry.body.dispose();
    geometry.arm.dispose();
    net.map?.dispose();
    net.dispose();
  }, [geometry, net]);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // L'aiguille à ramender va et vient, une main après l'autre.
    if (leftArm.current) leftArm.current.rotation.set(Math.sin(time * 2.6) * 0.25, 0, -0.1 + Math.sin(time * 2.6) * 0.18);
    if (rightArm.current) rightArm.current.rotation.set(-Math.sin(time * 2.6 + 1.4) * 0.25, 0, -0.1 + Math.sin(time * 2.6 + 1.4) * 0.12);
    if (torso.current) torso.current.rotation.z = Math.sin(time * 0.5) * 0.03;
  });
  const [x, z] = fromDock(FISHERMAN[0], FISHERMAN[1]);
  return (
    <group position={[x, QUAY_Y + 0.04, z]} rotation-y={DOCK_YAW}>
      <group ref={torso}>
        <mesh geometry={geometry.body} castShadow raycast={() => null}>
          <meshStandardMaterial vertexColors roughness={0.75} />
        </mesh>
        <group ref={leftArm} position={[0.05, 0.8, 0.17]}>
          <mesh geometry={geometry.arm} raycast={() => null}>
            <meshStandardMaterial vertexColors roughness={0.75} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.05, 0.8, -0.17]}>
          <mesh geometry={geometry.arm} raycast={() => null}>
            <meshStandardMaterial vertexColors roughness={0.75} />
          </mesh>
        </group>
      </group>
      {/* Le filet sur les genoux, qui retombe jusqu'au quai. */}
      <mesh material={net} position={[0.5, 0.33, 0]} rotation={[0, Math.PI / 2, 0.45]} raycast={() => null}>
        <planeGeometry args={[0.7, 0.6, 6, 6]} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------- linge au vent */

function laundryTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Drap blanc à liseré bleu.
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#7fa6d6';
  ctx.fillRect(0, 112, 128, 8);
  // Marinière : rayures marine sur fond blanc.
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(128, 0, 128, 128);
  ctx.fillStyle = '#22335c';
  for (let y = 10; y < 128; y += 16) ctx.fillRect(128, y, 128, 7);
  // Chemise rouge et pantalon de toile bleue.
  ctx.fillStyle = '#d8433b';
  ctx.fillRect(256, 0, 128, 128);
  ctx.fillStyle = '#b8352e';
  ctx.fillRect(300, 0, 40, 18);
  ctx.fillStyle = '#4f6f9e';
  ctx.fillRect(384, 0, 128, 128);
  ctx.fillStyle = '#3f5c88';
  ctx.fillRect(445, 30, 6, 98);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Pièces de linge : [atlas, début et fin sur le fil (m), hauteur (m)]. */
const CLOTHES: [number, number, number, number][] = [
  [0, 0.12, 0.72, 0.62],
  [1, 0.8, 1.15, 0.5],
  [2, 1.2, 1.5, 0.46],
  [3, 1.55, 1.72, 0.62],
];

function Laundry({ sampler }: { sampler: HeightSampler }) {
  const geometry = useMemo(() => {
    const pieces: BufferGeometry[] = CLOTHES.map(([cell, from, to, height]) => {
      const plane = new PlaneGeometry(to - from, height, 5, 5);
      const uv = plane.attributes.uv;
      for (let index = 0; index < uv.count; index++) uv.setX(index, (cell + uv.getX(index)) / 4);
      plane.translate((from + to) / 2, -height / 2, 0);
      return plane;
    });
    const merged = mergeGeometries(pieces)!;
    pieces.forEach((piece) => piece.dispose());
    return merged;
  }, []);
  const material = useMemo(() => clothMaterial({ map: laundryTexture(), mode: 'drape', amplitude: 0.12, speed: 1.1 }), []);
  useEffect(() => () => {
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
  }, [geometry, material]);
  const [ax, az] = polar(LAUNDRY.angle, LAUNDRY.from);
  const [bx, bz] = polar(LAUNDRY.angle, LAUNDRY.to);
  const length = Math.hypot(bx - ax, bz - az);
  const ground = Math.min(sampler(ax, az), sampler(bx, bz));
  const yaw = -LAUNDRY.angle;
  const line = 1.75;
  return (
    <group position={[ax, ground, az]} rotation-y={yaw}>
      {[0, length].map((x) => (
        <mesh key={x} position={[x, line / 2, 0]} castShadow raycast={() => null}>
          <cylinderGeometry args={[0.04, 0.05, line, 6]} />
          <meshStandardMaterial color="#7a5034" roughness={1} />
        </mesh>
      ))}
      <mesh position={[length / 2, line - 0.08, 0]} rotation-z={Math.PI / 2} raycast={() => null}>
        <cylinderGeometry args={[0.008, 0.008, length, 4]} />
        <meshStandardMaterial color="#e9e2d0" roughness={1} />
      </mesh>
      <mesh geometry={geometry} material={material} position={[(length - 1.85) / 2, line - 0.08, 0]} castShadow raycast={() => null} />
    </group>
  );
}

/* ---------------------------------------------------------------------- vie */

export function Life({ sampler }: { sampler: HeightSampler }) {
  const perches = useMemo<Perch[]>(() => {
    const list: Perch[] = [];
    for (const plan of HOUSES) {
      const { position, yaw } = housePose(sampler, plan);
      const ridge = ridgeOf(plan);
      const along = plan.kind === 'penty' ? [0.6] : [-plan.width / 2 + 0.75, plan.width / 2 - 1.1];
      along.forEach((offset, index) => {
        list.push({
          at: [position[0] + Math.cos(yaw) * offset, position[1] + ridge + 0.04, position[2] - Math.sin(yaw) * offset],
          yaw: yaw + (index % 2 ? Math.PI / 2 : -Math.PI / 2) + hash(offset) * 0.6,
        });
      });
    }
    const [ls, ly, lt] = JETTY_LIGHT;
    const [jx, jz] = fromDock(ls, lt);
    list.push({ at: [jx, ly + 2.38, jz], yaw: 1.2 });
    const [bx, bz] = fromDock(HARBOR.quayFront - 0.45, -4.6);
    list.push({ at: [bx, QUAY_Y + 0.4, bz], yaw: DOCK_YAW + 0.4 });
    const perch = lighthousePerch(sampler);
    list.push({ at: perch, yaw: 2.4 });
    const chapelYaw = facing(CHAPEL_FACING);
    const chapelGround = sampler(CHAPEL_AT[0], CHAPEL_AT[1]) - 0.12;
    const offset = -CHAPEL.width / 2 + 0.6;
    list.push({
      at: [CHAPEL_AT[0] + Math.cos(chapelYaw) * offset, chapelGround + ridgeOf(CHAPEL) + 0.04, CHAPEL_AT[1] - Math.sin(chapelYaw) * offset],
      yaw: chapelYaw + Math.PI / 2,
    });
    return list;
  }, [sampler]);
  return (
    <>
      <Gulls perches={perches} />
      <Sheep sampler={sampler} />
      <Fisherman />
      <Laundry sampler={sampler} />
    </>
  );
}
