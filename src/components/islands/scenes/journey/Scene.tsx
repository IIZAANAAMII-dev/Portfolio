'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { skyState } from '@/lib/sky';
import type { SceneProps } from '../../kit';
import { Bretagne } from './Bretagne';
import { Bridge } from './Bridge';
import { buildProvenceGround, provenceGroundMaterial } from './ground';
import { Markers } from './Markers';
import { Marseille } from './Marseille';
import { Provence } from './Provence';
import { Walker } from './Walker';
import { buildCalmWater, createCalmWaterMaterial } from './water';

/**
 * ÎLE PARCOURS — de la Bretagne à Marseille.
 *
 * Deux moitiés que sépare un chenal : à gauche la lande bretonne (granit, bruyère,
 * crachin), à droite Marseille (calcaire blanc, garrigue, Vieux-Port, Bonne Mère).
 * Un pont de pierre les relie ; le chemin de l'histoire passe par cinq lanternes.
 */

const CALM_WATER = createCalmWaterMaterial();

export default function Scene({ island, sampler }: SceneProps) {
  const ground = useMemo(() => buildProvenceGround(sampler, island.radius), [island.radius, sampler]);
  const water = useMemo(() => buildCalmWater(sampler, island.radius), [island.radius, sampler]);

  useFrame((state) => {
    CALM_WATER.uniforms.uTime.value = state.clock.elapsedTime;
    CALM_WATER.uniforms.uNight.value = skyState.dayNight;
    CALM_WATER.uniforms.uGolden.value = skyState.golden;
  });

  return (
    <group>
      <mesh geometry={ground} material={provenceGroundMaterial} receiveShadow raycast={() => null} />
      <mesh geometry={water} material={CALM_WATER} renderOrder={3} raycast={() => null} />
      <Bridge sampler={sampler} />
      <Bretagne sampler={sampler} />
      <Marseille sampler={sampler} />
      <Provence sampler={sampler} />
      <Markers sampler={sampler} />
      <Walker sampler={sampler} />
    </group>
  );
}
