'use client';

import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { getPaintedTerrainMaterial } from '@/lib/materials/painted-terrain';
import type { IslandConfig } from '@/types';
import config from './config';
import { BEC } from './layout';

/**
 * Le bec du Bec de l'Aigle : le relief (config.ts) dresse la tête en falaise au-dessus du
 * port ; ce maillage ajoute ce qu'un relief en hauteurs ne sait pas faire, le surplomb
 * crochu. Ses sommets sont dans le repère de l'île et il porte le matériau même du
 * terrain : strates, teinte de poudingue et maquis au sommet se raccordent sans couture.
 */

/** Sections le long du bec : distance devant la tête, hauteur, demi-largeur, dessus, dessous. */
const SECTIONS: [number, number, number, number, number][] = [
  [1.1, 11.95, 1.55, 0.42, 1.35],
  [2.55, 12.08, 1.2, 0.4, 0.9],
  [3.55, 11.8, 0.78, 0.32, 0.55],
  [4.3, 11.05, 0.4, 0.2, 0.28],
  [4.72, 10.3, 0.03, 0.03, 0.03],
];

/** Contour d'une section (côté, hauteur) : dessus aplati, dessous en carène. */
const RING: [number, number][] = [
  [0, 1],
  [0.86, 0.55],
  [0.72, -0.45],
  [0, -1],
  [-0.72, -0.45],
  [-0.86, 0.55],
];

function beakGeometry() {
  const [kx, kz] = BEC.head;
  const forward = new Vector3(Math.cos(BEC.beak), 0, Math.sin(BEC.beak));
  const side = new Vector3(-forward.z, 0, forward.x);
  const rings = SECTIONS.map(([reach, height, width, top, bottom]) =>
    RING.map(([s, h]) => new Vector3(
      kx + forward.x * reach + side.x * s * width,
      height + (h > 0 ? h * top : h * bottom),
      kz + forward.z * reach + side.z * s * width,
    )));
  const positions: number[] = [];
  const push = (...points: Vector3[]) => points.forEach((p) => positions.push(p.x, p.y, p.z));
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < RING.length; j++) {
      const a = rings[i][j];
      const b = rings[i][(j + 1) % RING.length];
      const c = rings[i + 1][(j + 1) % RING.length];
      const d = rings[i + 1][j];
      push(a, c, d, a, b, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function Beak({ island }: { island: IslandConfig }) {
  const geometry = useMemo(() => beakGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Même matériau (même cache) que le relief de l'île.
  const material = getPaintedTerrainMaterial(island.terrain.cliff, island.terrain.top, config.cliffTint);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow raycast={() => null} />;
}
