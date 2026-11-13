'use client';

import { lazy } from 'react';
import { Island } from '@/components/islands/Island';
import { PersonalityIslets } from '@/components/islets/PersonalityIslet';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { islands } from '@/data/islands';
import { preview } from '@/lib/preview';

const YellowStaticIsland = lazy(() => import('@/components/secret/YellowStaticIsland'));

/** Archipel des îles secondaires, révélé progressivement par le cercle d'intro. */
export function Archipelago() {
  const solo = preview.solo;
  return (
    <group>
      {islands.map((island, index) =>
        solo === null || solo === island.id ? <Island key={island.id} island={island} index={index} /> : null,
      )}
      {solo === null && <PersonalityIslets />}
      {(solo === null || solo === 'static') && (
        <AssetBoundary>
          <YellowStaticIsland />
        </AssetBoundary>
      )}
    </group>
  );
}
