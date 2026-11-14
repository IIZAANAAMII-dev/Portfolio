'use client';

import { useLayoutEffect, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { hash } from '@/lib/utils/math';
import { ICO1, Kit, OCTA, roughen } from './geometry';
import { smooth } from './terrain';

/**
 * Buissons fleuris instanciés : bruyère et ajonc en Bretagne, lentisque et lavande en
 * Provence. Deux draw calls pour tous les buissons d'une moitié : le feuillage (teinte
 * par instance) et ses fleurs (teinte par instance).
 */

export interface ShrubItem {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  body: Color;
  bloom: Color;
}

const BLOBS: [number, number, number, number][] = [
  [0, 0.3, 0, 0.5],
  [0.3, 0.22, 0.12, 0.36],
  [-0.24, 0.2, -0.14, 0.34],
];

/** Feuillage : trois boules facettées, pied plus sombre (occlusion peinte). */
const BUSH = (() => {
  const kit = new Kit();
  BLOBS.forEach(([x, y, z, r], index) => {
    kit.add(roughen(ICO1, 0.3, index * 3.3 + 1), '#ffffff', { position: [x, y, z], scale: [r, r * 0.8, r] }, {
      jitter: 0.18,
      seed: index,
      paint: (_x, py, _z, out) => out.setScalar(0.55 + smooth(0, 0.62, py) * 0.5),
    });
  });
  return kit.build();
})();

/** Fleurs : petites étoiles semées sur le haut du feuillage. */
const BLOOMS = (() => {
  const kit = new Kit();
  let seed = 0;
  BLOBS.forEach(([x, y, z, r]) => {
    const count = Math.round(r * 16);
    for (let index = 0; index < count; index++) {
      seed += 1;
      const a = hash(seed * 2.17) * Math.PI * 2;
      const up = 0.25 + hash(seed * 3.91) * 0.65;
      const ring = Math.sqrt(1 - up * up);
      kit.add(OCTA, '#ffffff', {
        position: [x + Math.cos(a) * ring * r * 1.02, y + up * r * 0.82, z + Math.sin(a) * ring * r * 1.02],
        rotation: [hash(seed) * 3, hash(seed * 1.7) * 3, 0],
        scale: 0.045 + hash(seed * 5.3) * 0.03,
      });
    }
  });
  return kit.build();
})();

export function Shrubs({ items, shadows = true }: { items: ShrubItem[]; shadows?: boolean }) {
  const bodies = useRef<InstancedMesh>(null);
  const blooms = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (const [mesh, key] of [[bodies.current, 'body'], [blooms.current, 'bloom']] as const) {
      if (!mesh) continue;
      items.forEach((item, index) => {
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(0, item.yaw, 0);
        dummy.scale.setScalar(item.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, item[key]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [items]);

  if (items.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={bodies} args={[BUSH, undefined, items.length]} castShadow={shadows} receiveShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={blooms} args={[BLOOMS, undefined, items.length]} raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.7} flatShading />
      </instancedMesh>
    </group>
  );
}
