'use client';

import { useMemo } from 'react';
import { yellowStaticIsland } from '@/data/yellow-static';
import { Terrain } from '@/components/islands/Terrain';
import { createHeightSampler, type TerrainShape } from '@/components/islands/terrain-shape';

/**
 * YELLOW STATIC — l'île secrète (racine). Version provisoire : le relief seul.
 */
export default function YellowStaticIsland() {
  const shape = useMemo<TerrainShape>(
    () => ({ radius: yellowStaticIsland.radius, elevation: yellowStaticIsland.elevation, seed: 97 }),
    [],
  );
  const sampler = useMemo(() => createHeightSampler(shape), [shape]);
  return (
    <group position={[yellowStaticIsland.position[0], 0, yellowStaticIsland.position[1]]}>
      <Terrain shape={shape} sampler={sampler} cliff={yellowStaticIsland.terrain.cliff} top={yellowStaticIsland.terrain.top} />
    </group>
  );
}
