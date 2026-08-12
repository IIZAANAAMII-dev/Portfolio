'use client';

import { Island } from '@/components/islands/Island';
import { islands } from '@/data/islands';
import { HomeIsland } from './HomeIsland';

export function Archipelago() {
  return (
    <group>
      <HomeIsland />
      {islands.map((island, index) => (
        <Island key={island.id} island={island} index={index} />
      ))}
    </group>
  );
}
