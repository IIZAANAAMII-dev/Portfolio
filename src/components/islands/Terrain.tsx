'use client';

import { useMemo } from 'react';
import { RingGeometry } from 'three';
import { getSubstanceMaterial } from '@/lib/materials/substance-material';
import type { SubstanceId } from '@/lib/materials/substances';
import { BEACH_HEIGHT, buildTerrainGeometry, type HeightSampler, type TerrainShape } from './terrain-shape';

interface TerrainProps {
  shape: TerrainShape;
  sampler: HeightSampler;
  /** Roche des falaises. */
  cliff?: SubstanceId;
  /** Couvert des plateaux. */
  top?: SubstanceId;
}

function makeReef(radius: number, seed: number, inner: number, outer: number) {
  const geometry = new RingGeometry(radius * inner, radius * outer, 40, 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const distance = Math.hypot(x, y);
    if (distance < 0.001) continue;
    const angle = Math.atan2(y, x);
    const breakup = 1
      + Math.sin(angle * 3 + seed) * 0.075
      + Math.sin(angle * 7 - seed * 0.7) * 0.04
      + Math.sin(angle * 13 + seed * 1.9) * 0.018;
    positions.setXY(index, x * breakup, y * breakup);
  }
  positions.needsUpdate = true;
  return geometry;
}

/**
 * Le relief d'une île, en un seul maillage. Le matériau Substance choisit la texture
 * selon la forme : roche sur les pentes, herbe sur les plateaux, sable sous la ligne de
 * plage (projection triplanaire, sans UV ni couture).
 */
export function Terrain({ shape, sampler, cliff = 'island_cliff', top = 'wild_grass' }: TerrainProps) {
  const geometry = useMemo(() => buildTerrainGeometry(shape, sampler), [shape, sampler]);
  const material = useMemo(
    () =>
      getSubstanceMaterial(cliff, {
        projection: 'triplanar',
        // Géométrie procédurale en mètres : l'espace objet suit l'île pendant sa révélation.
        space: 'object',
        top,
        topThreshold: 0.78,
        topSoftness: 0.09,
        low: 'fine_sand_beach',
        lowBelow: BEACH_HEIGHT,
        lowSoftness: 0.2,
      }),
    [cliff, top],
  );
  const reef = useMemo(() => makeReef(shape.radius, shape.seed + 8.1, 1.22, 1.5), [shape.radius, shape.seed]);

  return (
    <group>
      <mesh geometry={reef} rotation-x={-Math.PI / 2} position-y={-1.7} receiveShadow>
        <meshStandardMaterial color="#68c7b0" roughness={1} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </group>
  );
}
