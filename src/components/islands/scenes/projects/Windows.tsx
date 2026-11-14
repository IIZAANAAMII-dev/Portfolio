'use client';

import { useEffect, useMemo } from 'react';
import { PlaneGeometry, type BufferGeometry, type MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windowMaterial } from '@/lib/windows';
import { pose, type V3 } from './builder';

/**
 * Fenêtres d'un bâtiment : mêmes matériaux que les `WindowPane` du kit (elles s'allument
 * une à une au crépuscule), mais fusionnées par matériau — une façade entière de vitres
 * ne coûte qu'un à trois draw calls.
 */
export interface WindowSpec {
  at: V3;
  width: number;
  height: number;
  /** Orientation (Y) de la vitre, face +Z par défaut. */
  rotationY?: number;
  seed: number;
  lit?: string;
  glass?: string;
}

export function Windows({ windows }: { windows: WindowSpec[] }) {
  const groups = useMemo(() => {
    const byMaterial = new Map<MeshStandardMaterial, BufferGeometry[]>();
    for (const spec of windows) {
      const material = windowMaterial(spec.seed, spec.lit, spec.glass);
      const plane = new PlaneGeometry(spec.width, spec.height);
      plane.applyMatrix4(pose(spec.at, [0, spec.rotationY ?? 0, 0]));
      const list = byMaterial.get(material) ?? [];
      list.push(plane);
      byMaterial.set(material, list);
    }
    return [...byMaterial.entries()].map(([material, planes]) => {
      const geometry = mergeGeometries(planes, false);
      planes.forEach((plane) => plane.dispose());
      return { material, geometry };
    });
  }, [windows]);
  useEffect(() => () => groups.forEach(({ geometry }) => geometry?.dispose()), [groups]);
  return (
    <>
      {groups.map(({ material, geometry }) =>
        geometry ? <mesh key={material.uuid} geometry={geometry} material={material} raycast={() => null} /> : null,
      )}
    </>
  );
}

/** Rangée de fenêtres régulières sur une façade (face +Z), de x0 à x1. */
export function windowRow(
  list: WindowSpec[],
  { x0, x1, y, z, count, width, height, seeds, rotationY = 0, lit, glass }: {
    x0: number;
    x1: number;
    y: number;
    z: number;
    count: number;
    width: number;
    height: number;
    seeds: number[];
    rotationY?: number;
    lit?: string;
    glass?: string;
  },
) {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  for (let index = 0; index < count; index++) {
    const lx = count === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * index) / (count - 1);
    list.push({
      at: [lx * c + z * s, y, -lx * s + z * c],
      width,
      height,
      rotationY,
      seed: seeds[index % seeds.length],
      lit,
      glass,
    });
  }
  return list;
}
