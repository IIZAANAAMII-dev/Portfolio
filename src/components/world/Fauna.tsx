'use client';

import { Jellyfish } from '@/components/world/fauna/Jellyfish';
import { MantaRays } from '@/components/world/fauna/Mantas';
import { Sharks } from '@/components/world/fauna/Shark';
import { SeaTurtles } from '@/components/world/fauna/Turtles';

/**
 * Faune « remarquable » du large et des lagons : raies manta à mi-eau, tortues qui font le
 * tour des îles dans l'eau turquoise, méduses bioluminescentes la nuit, et l'aileron du requin
 * qui tourne autour de l'île Contact. Les bancs ordinaires vivent dans MarineLife ; les
 * rencontres de surface (dauphins, baleine, sauts) dans SeaLife.
 * Tout est procédural et instancié : un draw call par espèce, aucun modèle à télécharger.
 * Sur mobile / qualité basse, chaque composant garde une population représentative.
 */
export function Fauna({ mobile }: { mobile: boolean }) {
  return (
    <group>
      <MantaRays mobile={mobile} />
      <SeaTurtles mobile={mobile} />
      <Jellyfish mobile={mobile} />
      <Sharks />
    </group>
  );
}
