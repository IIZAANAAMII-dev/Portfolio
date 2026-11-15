'use client';

import { useMemo } from 'react';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import type { SceneProps } from './kit';
import { hash } from '@/lib/utils/math';
import { BeachTreasures } from './props/Beach';
import { Butterflies } from './props/Butterflies';
import { FlowerScatter } from './props/Flowers';
import { RockScatter, type RockGroup } from './props/Rocks';
import { sceneComponents, sceneConfigs } from './scenes/registry';

/**
 * Habillage commun, entièrement procédural (identique en local et en production) :
 * galets et rochers de la grève, blocs moussus au pied des falaises, pierres dans l'herbe,
 * touffes de fleurs aux couleurs de l'île, étoiles de mer, coquillages et papillons. Six
 * draw calls en tout ; rochers et fleurs s'effacent sous les clairières des bâtiments.
 */
export function IslandDressing({ island, sampler, features, seed }: SceneProps & { seed: number }) {
  const { radius, dockAngle } = island;
  const plateau = features.plateau;
  const rocks = useMemo<RockGroup[]>(() => {
    const avoid = { avoidAngle: dockAngle, avoidWidth: 0.42 };
    return [
      { kind: 'pebble', zone: { inner: radius * 0.84, outer: radius * 1.1, minHeight: -0.5, maxHeight: 0.6, ...avoid }, groups: Math.round(radius * 0.5), seed: seed + 11, size: [0.6, 1.25], satellites: [1, 3] },
      { kind: 'boulder', zone: { inner: radius * 0.7, outer: radius * 0.86, minHeight: 0.4, maxHeight: plateau - 0.25, ...avoid }, groups: Math.round(radius * 0.28), seed: seed + 23, size: [1.1, 2.0], satellites: [1, 2], moss: 0.6 },
      { kind: 'stone', zone: { inner: radius * 0.3, outer: radius * 0.66, minHeight: plateau - 0.3, maxSlope: 0.25, ...avoid }, groups: Math.round(radius * 0.14), seed: seed + 29, size: [0.55, 0.95], satellites: [0, 1], moss: 0.9 },
    ];
  }, [dockAngle, plateau, radius, seed]);
  // Trois papillons au-dessus du plateau.
  const butterflies = useMemo(() => Array.from({ length: 3 }, (_, index): [number, number, number] => {
    const angle = hash(seed * 1.7 + index * 3.1) * Math.PI * 2;
    const spread = radius * (0.25 + hash(seed * 2.3 + index * 5.7) * 0.35);
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    return [x, sampler(x, z), z];
  }), [radius, sampler, seed]);
  const avoid = { avoidAngle: dockAngle, avoidWidth: 0.42 };
  return (
    <>
      <RockScatter sampler={sampler} groups={rocks} />
      <Butterflies spots={butterflies} seed={seed} />
      <FlowerScatter
        sampler={sampler}
        zone={{ inner: 0, outer: radius * 0.76, minHeight: plateau - 0.4, maxSlope: 0.22, ...avoid }}
        count={Math.round(radius * 1.5)}
        seed={seed + 37}
      />
      <BeachTreasures
        sampler={sampler}
        zone={{ inner: radius * 0.8, outer: radius * 1.02, minHeight: 0.12, maxHeight: 0.85, ...avoid }}
        starfish={5}
        shells={7}
        seed={seed + 41}
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
