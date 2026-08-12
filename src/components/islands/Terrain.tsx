'use client';

import { useMemo } from 'react';
import { hash } from '@/lib/utils/math';

interface TerrainProps {
  radius: number;
  elevation: number;
  ground: string;
  /** Graine : deux îles de mêmes dimensions ne doivent pas être identiques. */
  seed: number;
}

/**
 * Relief en plateaux empilés. Volontairement facetté (peu de segments radiaux,
 * flatShading) : c'est la signature graphique de l'archipel, et c'est très bon marché
 * (4 cylindres, un seul matériau par île).
 */
export function Terrain({ radius, elevation, ground, seed }: TerrainProps) {
  const layers = useMemo(
    () =>
      [
        { r: radius, h: 1.6, color: '#e8d9b8', segments: 9 },
        { r: radius * 0.86, h: elevation * 0.42, color: ground, segments: 8 },
        { r: radius * 0.56, h: elevation * 0.34, color: ground, segments: 7 },
        { r: radius * 0.26, h: elevation * 0.24, color: ground, segments: 6 },
      ].map((layer, index) => ({ ...layer, spin: hash(seed + index * 7.13) * Math.PI })),
    [radius, elevation, ground, seed],
  );

  let y = -1.1;
  return (
    <group>
      {layers.map((layer, index) => {
        const centerY = y + layer.h / 2;
        y += layer.h * 0.82;
        return (
          <mesh
            key={index}
            position={[0, centerY, 0]}
            rotation-y={layer.spin}
            castShadow
            receiveShadow
          >
            <cylinderGeometry
              args={[layer.r * 0.9, layer.r, layer.h, layer.segments, 1]}
            />
            <meshStandardMaterial color={layer.color} roughness={1} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}
