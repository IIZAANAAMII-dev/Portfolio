'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { CatmullRomCurve3, Color, ExtrudeGeometry, InstancedMesh, Object3D, Shape, Vector3 } from 'three';
import { hash } from '@/lib/utils/math';
import { groundAt, type HeightSampler } from '../../terrain-shape';
import { BOX, CYL6, CYL8, ICO0, Kit, roughen, SPHERE } from './geometry';
import { flatPaint } from './materials';
import { BRIDGE_WIDTH, bridgeSpan, deckHeight, FRAME_YAW } from './route';
import { BRIDGE_U, channelHalfWidth, fromFrame, LANDING, smooth, TRAIL_BRETON, TRAIL_PROVENCE } from './terrain';

/**
 * Le pont de pierre qui relie les deux moitiés : une arche en anse de panier, parapets,
 * claveaux clairs. La pierre passe du granit gris (côté Bretagne) au calcaire doré
 * (côté Marseille) : le pont lui-même raconte le voyage.
 */

const GRANITE = new Color('#a29e9b');
const LIMESTONE = new Color('#e8dcc4');
const COBBLE_B = new Color('#8f8a86');
const COBBLE_P = new Color('#d6c7aa');
const MOSS = new Color('#5f8143');

function stoneAt(s: number, out: Color, top = false) {
  const t = smooth(-1.4, 1.4, s);
  return out.copy(top ? COBBLE_B : GRANITE).lerp(top ? COBBLE_P : LIMESTONE, t);
}

function buildBridge() {
  const { length } = bridgeSpan();
  const half = length / 2;
  const water = channelHalfWidth(BRIDGE_U);
  const arch = water - 0.12;
  const spring = 0.12;
  const rise = 1.32;
  const outline: [number, number][] = [[-half, LANDING - 0.75]];
  for (let index = 0; index <= 18; index++) {
    const s = -half + (length * index) / 18;
    outline.push([s, deckHeight(s)]);
  }
  outline.push([half, LANDING - 0.75], [arch + 0.6, -0.6], [arch, spring]);
  for (let index = 1; index < 20; index++) {
    const t = (index / 20) * Math.PI;
    outline.push([Math.cos(t) * arch, spring + Math.sin(t) * rise]);
  }
  outline.push([-arch, spring], [-arch - 0.6, -0.6]);
  const shape = new Shape();
  outline.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  const body = new ExtrudeGeometry(shape, { depth: BRIDGE_WIDTH, bevelEnabled: false, curveSegments: 1 });
  body.translate(0, 0, -BRIDGE_WIDTH / 2);

  const kit = new Kit();
  kit.add(body, GRANITE, {}, {
    jitter: 0.12,
    seed: 3,
    paint: (x, y, _z, out, ny) => {
      stoneAt(x, out, ny > 0.7 && y > LANDING);
      // Mousse au ras de l'eau, surtout côté breton.
      out.lerp(MOSS, (1 - smooth(-0.1, 0.75, y)) * (0.75 - smooth(-2, 2, x) * 0.45));
    },
  });

  // Claveaux : un anneau de pierres claires autour de l'arche, sur les deux faces.
  const ring = new Color();
  for (const side of [-1, 1]) {
    for (let index = 0; index <= 12; index++) {
      const t = (index / 12) * Math.PI;
      const keystone = index === 6;
      const radiusX = arch + 0.16;
      const radiusY = rise + 0.16;
      const x = Math.cos(t) * radiusX;
      const y = spring + Math.sin(t) * radiusY;
      const normal = Math.atan2(Math.sin(t) * radiusX, Math.cos(t) * radiusY);
      stoneAt(x, ring).multiplyScalar(1.12);
      kit.add(BOX, ring.clone(), {
        position: [x, y, side * (BRIDGE_WIDTH / 2 + 0.03)],
        rotation: [0, 0, normal - Math.PI / 2],
        scale: [keystone ? 0.34 : 0.26, keystone ? 0.46 : 0.36, 0.1],
      }, { jitter: 0.08, seed: index + side });
    }
  }

  // Parapets qui suivent le bombé, chaperons clairs, bornes aux extrémités.
  const segments = 12;
  const stone = new Color();
  for (const side of [-1, 1]) {
    const z = side * (BRIDGE_WIDTH / 2 - 0.11);
    for (let index = 0; index < segments; index++) {
      const s0 = -half + 0.2 + ((length - 0.4) * index) / segments;
      const s1 = -half + 0.2 + ((length - 0.4) * (index + 1)) / segments;
      const y0 = deckHeight(s0);
      const y1 = deckHeight(s1);
      const span = Math.hypot(s1 - s0, y1 - y0);
      const angle = Math.atan2(y1 - y0, s1 - s0);
      const mid = (s0 + s1) / 2;
      const y = (y0 + y1) / 2;
      kit.add(BOX, stoneAt(mid, stone).clone(), { position: [mid, y + 0.2, z], rotation: [0, 0, angle], scale: [span + 0.01, 0.4, 0.2] }, { jitter: 0.1, seed: index * 3 + side });
      kit.add(BOX, stoneAt(mid, stone).multiplyScalar(1.12).clone(), { position: [mid, y + 0.43, z], rotation: [0, 0, angle], scale: [span + 0.03, 0.08, 0.27] });
    }
    for (const end of [-1, 1]) {
      const s = end * (half - 0.12);
      kit.add(BOX, stoneAt(s, stone).clone(), { position: [s, deckHeight(s) + 0.32, z], scale: [0.32, 0.66, 0.32] }, { jitter: 0.08, seed: end + side * 5 });
      kit.add(CYL8, stoneAt(s, stone).multiplyScalar(1.1).clone(), { position: [s, deckHeight(s) + 0.7, z], scale: [0.13, 0.1, 0.13] });
    }
  }

  // Lierre qui retombe sur la face bretonne, pots de géraniums côté Marseille.
  for (const [x, y, z, size] of [[-1.3, 0.9, 0.82, 0.32], [-2.1, 1.1, 0.83, 0.26], [-1.6, 0.55, -0.83, 0.3]] as const) {
    kit.add(roughen(ICO0, 0.3, x * 7), '#4e7a3c', { position: [x, y, z], scale: [size * 1.3, size, size * 0.45] }, { jitter: 0.2, seed: x });
  }
  for (const side of [-1, 1]) {
    const s = half - 0.55;
    const y = deckHeight(s);
    const z = side * (BRIDGE_WIDTH / 2 - 0.3);
    kit.add(CYL6, '#c4673d', { position: [s, y + 0.13, z], scale: [0.13, 0.26, 0.13] });
    kit.add(SPHERE, '#d8423a', { position: [s, y + 0.33, z], scale: [0.15, 0.11, 0.15] }, { jitter: 0.25, seed: side });
    kit.add(SPHERE, '#5b8a3d', { position: [s + 0.05, y + 0.27, z + 0.04], scale: [0.16, 0.08, 0.16] });
  }
  return kit.build();
}

/** Pierres du chemin : pas japonais de granit côté breton, dallage clair côté Marseille. */
function useTrailStones(sampler: HeightSampler) {
  return useMemo(() => {
    const items: { x: number; y: number; z: number; yaw: number; sx: number; sz: number; color: Color }[] = [];
    const toVec = ([u, v]: [number, number]) => {
      const [x, z] = fromFrame(u, v);
      return new Vector3(x, 0, z);
    };
    const granite = new Color('#a9a6a3');
    const lime = new Color('#eadfca');
    const lay = (points: [number, number][], breton: boolean) => {
      const curve = new CatmullRomCurve3(points.map(toVec), false, 'centripetal');
      const length = curve.getLength();
      const step = breton ? 0.62 : 0.5;
      const count = Math.floor(length / step);
      const point = new Vector3();
      const tangent = new Vector3();
      for (let index = 0; index <= count; index++) {
        const t = index / count;
        curve.getPointAt(t, point);
        curve.getTangentAt(t, tangent);
        const yaw = Math.atan2(tangent.x, tangent.z);
        const key = index * 7.31 + (breton ? 0 : 100);
        const lanes = breton ? [((index % 2) - 0.5) * 0.36 + (hash(key) - 0.5) * 0.12] : [-0.27, 0.27];
        for (const lane of lanes) {
          const x = point.x + Math.cos(yaw) * lane;
          const z = point.z - Math.sin(yaw) * lane;
          const color = (breton ? granite : lime).clone().multiplyScalar(0.86 + hash(key + lane) * 0.22);
          items.push({
            x,
            y: groundAt(sampler, x, z, 0.22) + (breton ? 0.0 : 0.01),
            z,
            yaw: yaw + (breton ? hash(key + 2.2) * 1.2 : 0),
            sx: breton ? 0.3 + hash(key + 3.1) * 0.1 : 0.26,
            sz: breton ? 0.24 + hash(key + 4.7) * 0.1 : 0.22,
            color,
          });
        }
      }
    };
    lay(TRAIL_BRETON, true);
    lay(TRAIL_PROVENCE, false);
    return items;
  }, [sampler]);
}

const STONE = roughen(CYL6, 0.18, 4.2);

export function Bridge({ sampler }: { sampler: HeightSampler }) {
  const geometry = useMemo(() => buildBridge(), []);
  const stones = useTrailStones(sampler);
  const mesh = useRef<InstancedMesh>(null);
  const { middle } = bridgeSpan();
  const [x, z] = fromFrame(BRIDGE_U, middle);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    stones.forEach((stone, index) => {
      dummy.position.set(stone.x, stone.y, stone.z);
      dummy.rotation.set(0, stone.yaw, 0);
      dummy.scale.set(stone.sx, 0.07, stone.sz);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, stone.color);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [stones]);

  return (
    <group>
      <mesh geometry={geometry} material={flatPaint} position={[x, 0, z]} rotation-y={FRAME_YAW} castShadow receiveShadow />
      <instancedMesh ref={mesh} args={[STONE, undefined, stones.length]} receiveShadow raycast={() => null}>
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}
