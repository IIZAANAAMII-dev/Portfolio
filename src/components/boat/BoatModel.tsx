'use client';

import { useMemo } from 'react';
import { MODEL, useModelScene } from '@/lib/models';

/**
 * Kenney Pirate Kit — `ship-small` (CC0, voir docs/ASSETS.md).
 * Le modèle a sa proue vers +Z et sa base à y = 0 ; la logique de navigation raisonne
 * en « avant = +X », d'où la rotation d'un quart de tour appliquée ici et nulle part
 * ailleurs. Aucun autre composant n'a besoin de connaître l'orientation de l'asset.
 */
const FORWARD_FIX = Math.PI / 2;
const SCALE = 0.42;

export function BoatModel() {
  const scene = useModelScene(MODEL.ship);

  // Le même GLB peut être monté plusieurs fois (bateau + easter eggs) : on clone.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return (
    <group rotation-y={FORWARD_FIX} scale={SCALE} position-y={-0.25}>
      <primitive object={model} />
    </group>
  );
}
