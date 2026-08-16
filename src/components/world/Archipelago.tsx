'use client';

import { Island } from '@/components/islands/Island';
import { islands } from '@/data/islands';

/** Archipel des îles secondaires, révélé progressivement par le cercle d'intro. */
export function Archipelago() {
  return (
    <group>
      {islands.map((island, index) => (
        <Island key={island.id} island={island} index={index} />
      ))}
    </group>
  );
}
