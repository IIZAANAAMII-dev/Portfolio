'use client';

import { MODEL } from '@/lib/models';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { Prop } from './decor';

/** Repli procédural : quelques planches et deux pilotis. */
function PlankDock({ reach }: { reach: number }) {
  const planks = 6;
  return (
    <>
      {Array.from({ length: planks }, (_, i) => {
        const x = reach - 3.6 + (i / (planks - 1)) * 5.2;
        return (
          <mesh key={i} position={[x, 0.9, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.14, 2.1]} />
            <meshStandardMaterial color="#8a6b4d" roughness={1} flatShading />
          </mesh>
        );
      })}
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[reach + 1.4, 0.2, z]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 2.4, 5]} />
          <meshStandardMaterial color="#6b5238" roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}

/**
 * Ponton : trois plateformes du Kenney Pirate Kit alignées vers le large.
 * Le groupe est tourné pour que le ponton parte dans la direction `angle`, exprimée
 * dans la même convention que le cap du bateau.
 */
export function Dock({ angle, reach }: { angle: number; reach: number }) {
  const tiles = [reach - 2.6, reach - 0.4, reach + 1.8];

  return (
    <group rotation-y={-angle}>
      <AssetBoundary fallback={<PlankDock reach={reach} />}>
        {tiles.map((x, i) => (
          <Prop
            key={x}
            name={i === tiles.length - 1 ? MODEL.dockSmall : MODEL.dock}
            position={[x, 0.6, 0]}
            rotation={Math.PI / 2}
            scale={0.9}
          />
        ))}
        <Prop name={MODEL.barrel} position={[reach - 2.4, 1.5, 1.1]} rotation={0.6} scale={0.8} />
      </AssetBoundary>
    </group>
  );
}
