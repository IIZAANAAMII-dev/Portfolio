'use client';

import { ToyFx } from './toys/ToyFx';
import { Toys } from './toys/Toys';

/** Rond dans l'eau (utilisé aussi par la bouteille à la mer, le port, les secrets…). */
export { ripple } from './toys/effects';

/**
 * La mer comme terrain de jeu : caisses à poissons, tonneaux, casiers à homard, bouées,
 * ballons, bouées couronnes, la cane marin et ses canetons, balises lumineuses… Tout flotte
 * sur la vraie houle, tangue, s'écarte devant l'étrave, danse dans le sillage, culbute et
 * éclabousse quand on le percute, puis dérive doucement vers son coin.
 * Devant le port, « le chamboule-tout » : une pyramide de caisses sur un radeau, à renverser
 * d'un coup d'étrave (elle se reconstruit toute seule). Voir ./toys/.
 */
export function Flotsam() {
  return (
    <group>
      <Toys />
      <ToyFx />
    </group>
  );
}
