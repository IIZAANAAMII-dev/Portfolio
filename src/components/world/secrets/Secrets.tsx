'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { SOLIDS, type Circle } from '@/lib/navigation';
import { useLogbook } from '@/lib/logbook';
import { preview } from '@/lib/preview';
import { useWorld } from '@/lib/store';
import { voyage } from '@/lib/voyage';
import { Bubbles } from './Bubbles';
import { secretsDebug } from './debug';
import {
  CHEST_SOLID_RADIUS,
  CHEST_SPOT,
  LAGOON_SOLID_RADIUS,
  LAGOON_SPOT,
  WRECK_SOLID_RADIUS,
  WRECK_SPOT,
} from './layout';
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
 * L'épave, la piscine de rochers et le banc du coffre sont des obstacles : le bateau les
 * contourne au lieu de passer au travers (un clic sur le sable l'arrête au bord du banc,
 * le coffre à portée de clic). Ajoutés aux cercles de navigation pendant que les secrets
 * sont montés.
 */
const OBSTACLES: Circle[] = [
  { x: WRECK_SPOT.x, z: WRECK_SPOT.z, r: WRECK_SOLID_RADIUS },
  { x: LAGOON_SPOT.x, z: LAGOON_SPOT.z, r: LAGOON_SOLID_RADIUS },
  { x: CHEST_SPOT.x, z: CHEST_SPOT.z, r: CHEST_SOLID_RADIUS },
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

/**
 * Outils de capture d'écran, en développement seulement : carnet, tracé de route, état des
 * secrets, heure figée, et `__secrets.state.cam = [x, y, z, tx, ty, tz]` pour poser la
 * caméra sur un secret sans recharger la page.
 */
function useDevHooks() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__secrets = { logbook: useLogbook, voyage, world: useWorld, preview, state: secretsDebug };
    return () => {
      delete target.__secrets;
    };
  }, []);
}

/**
 * Caméra de capture (développement) : appliquée après celle du jeu et avant les secrets
 * (premier enfant monté), pour que leur test de visibilité voie la bonne caméra.
 */
function DebugCamera() {
  useFrame((state) => {
    if (process.env.NODE_ENV === 'production') return;
    const pose = secretsDebug.cam as number[] | undefined;
    if (!pose || pose.length !== 6) return;
    state.camera.position.set(pose[0], pose[1], pose[2]);
    state.camera.lookAt(pose[3], pose[4], pose[5]);
    state.camera.updateMatrixWorld();
  });
  return null;
}

export default function Secrets() {
  useObstacles();
  useDevHooks();
  return (
    <group>
      <DebugCamera />
      <Bubbles />
      <TreasureChest />
      <Wreck />
      <Submarine />
      <MechaFish />
      <SeaSerpent />
    </group>
  );
}
