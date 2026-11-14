'use client';

import { useEffect } from 'react';
import { SOLIDS, type Circle } from '@/lib/navigation';
import { useLogbook } from '@/lib/logbook';
import { voyage } from '@/lib/voyage';
import { Bubbles } from './Bubbles';
import { secretsDebug } from './debug';
import { LAGOON_SOLID_RADIUS, LAGOON_SPOT, WRECK_SOLID_RADIUS, WRECK_SPOT } from './layout';
import { MechaFish } from './MechaFish';
import { SeaSerpent } from './SeaSerpent';
import { Submarine } from './Submarine';
import { TreasureChest } from './TreasureChest';
import { Wreck } from './Wreck';

/**
 * Secrets du monde (racine, coordonnées monde) : le coffre au trésor sur son banc de sable,
 * le vieux chalutier échoué, le mini sous-marin, le poisson à remontoir et le serpent de mer.
 * Chaque secret ne se dessine (et ne s'anime) que lorsque la caméra est assez proche.
 */

/**
 * L'épave et la piscine de rochers sont des obstacles : le bateau les contourne au lieu de
 * passer au travers. Ajoutés à la liste des cercles de navigation pendant que les secrets
 * sont montés (le banc du coffre, plat, reste franchissable).
 */
const OBSTACLES: Circle[] = [
  { x: WRECK_SPOT.x, z: WRECK_SPOT.z, r: WRECK_SOLID_RADIUS },
  { x: LAGOON_SPOT.x, z: LAGOON_SPOT.z, r: LAGOON_SOLID_RADIUS },
];

function useObstacles() {
  useEffect(() => {
    const added = OBSTACLES.filter((circle) => !SOLIDS.some((solid) => solid.x === circle.x && solid.z === circle.z));
    SOLIDS.push(...added);
    return () => {
      for (const circle of added) {
        const index = SOLIDS.indexOf(circle);
        if (index >= 0) SOLIDS.splice(index, 1);
      }
    };
  }, []);
}

/** Outils de capture d'écran, en développement seulement (carnet, tracé de route). */
function useDevHooks() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__secrets = { logbook: useLogbook, voyage, state: secretsDebug };
    return () => {
      delete target.__secrets;
    };
  }, []);
}

export default function Secrets() {
  useObstacles();
  useDevHooks();
  return (
    <group>
      <Bubbles />
      <TreasureChest />
      <Wreck />
      <Submarine />
      <MechaFish />
      <SeaSerpent />
    </group>
  );
}
