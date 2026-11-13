'use client';

import { AssetBoundary } from '@/components/world/AssetBoundary';
import { SubstanceScatter } from './bell-island';
import type { SceneProps } from './kit';
import { sceneComponents, sceneConfigs } from './scenes/registry';

/** Habillage commun : rochers au bord de l'eau et au pied des falaises, fleurs, étoiles de mer. */
export function IslandDressing({ island, sampler, features, seed }: SceneProps & { seed: number }) {
  const avoid = { avoidAngle: island.dockAngle, avoidWidth: 0.42 };
  return (
    <>
      <SubstanceScatter
        name="rocks-small"
        sampler={sampler}
        zone={{ inner: island.radius * 0.86, outer: island.radius * 1.12, minHeight: -0.6, maxHeight: 0.55, ...avoid }}
        count={Math.round(island.radius * 1.1)}
        seed={seed + 11}
        scale={[0.7, 1.35]}
        variety={5}
        sink={0.25}
      />
      <SubstanceScatter
        name="rocks-edged"
        sampler={sampler}
        zone={{ inner: island.radius * 0.6, outer: island.radius * 0.84, minHeight: 0.5, ...avoid }}
        count={Math.round(island.radius * 0.6)}
        seed={seed + 23}
        scale={[0.55, 1.05]}
        variety={4}
        sink={0.3}
      />
      <SubstanceScatter
        name="flower-clump"
        sampler={sampler}
        mode="together"
        zone={{ inner: 0, outer: island.radius * 0.76, minHeight: features.plateau - 0.4, maxSlope: 0.22, ...avoid }}
        count={Math.round(island.radius * 1.6)}
        seed={seed + 37}
        scale={[1.5, 2.6]}
        sink={0.02}
        shadows={false}
      />
      <SubstanceScatter
        name="starfish"
        sampler={sampler}
        mode="together"
        zone={{ inner: island.radius * 0.8, outer: island.radius * 1.02, minHeight: 0.1, maxHeight: 0.85, ...avoid }}
        count={5}
        seed={seed + 41}
        scale={[1.6, 2.4]}
        sink={0}
        shadows={false}
      />
    </>
  );
}

export function Silhouette(props: SceneProps & { seed: number }) {
  const Scene = sceneComponents[props.island.id];
  const config = sceneConfigs[props.island.id];
  // Une île sans décor reste navigable : seul ce qui échoue disparaît.
  return (
    <>
      <AssetBoundary>
        <Scene island={props.island} sampler={props.sampler} features={props.features} />
      </AssetBoundary>
      {config.dressing && (
        <AssetBoundary>
          <IslandDressing {...props} />
        </AssetBoundary>
      )}
    </>
  );
}
