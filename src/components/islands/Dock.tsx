'use client';

import { AssetBoundary } from '@/components/world/AssetBoundary';
import { SubstanceProp } from './bell-island';

/** Repli procédural : quelques planches et deux pilotis. */
function PlankDock({ reach }: { reach: number }) {
  const planks = 6;
  return (
    <>
      {Array.from({ length: planks }, (_, i) => {
        const x = reach - 3.6 + (i / (planks - 1)) * 5.2;
        return (
          <mesh key={i} position={[x, 0.75, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.14, 2.1]} />
            <meshStandardMaterial color="#8a6b4d" roughness={1} flatShading />
          </mesh>
        );
      })}
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[reach + 1.4, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 2.4, 5]} />
          <meshStandardMaterial color="#6b5238" roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** Longueur utile d'un segment de « Stylized Old Sea Dock » (4,56 m), avec recouvrement. */
const SEGMENT = 4.3;
/** Le plancher du modèle est à 0,81 m au-dessus du pied des pilotis. */
const DECK_TOP = 0.81;
const DECK_HEIGHT = 0.78;

/**
 * Ponton : segments du vieux ponton Bell Island alignés de la plage jusqu'au point
 * d'accostage (rayon + 4,5 m, voir dockPosition). Le groupe est tourné pour que le ponton
 * parte dans la direction `angle`, dans la même convention que le cap du bateau.
 */
export function Dock({ angle, reach }: { angle: number; reach: number }) {
  const start = reach * 0.74;
  const end = reach + 5.6;
  const count = Math.ceil((end - start) / SEGMENT);
  const segments = Array.from({ length: count }, (_, index) => start + SEGMENT * (index + 0.5));

  return (
    <group rotation-y={-angle}>
      <AssetBoundary fallback={<PlankDock reach={reach} />}>
        {segments.map((x, index) => (
          <SubstanceProp
            key={x}
            name="sea-dock"
            position={[x, DECK_HEIGHT - DECK_TOP, (index % 2) * 0.04]}
            rotation={Math.PI / 2 + (index % 2 === 0 ? 0 : Math.PI)}
          />
        ))}
      </AssetBoundary>
    </group>
  );
}
