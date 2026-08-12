'use client';

import { Dock } from '@/components/islands/Dock';
import { Boulders, Bushes, Palms, Prop } from '@/components/islands/decor';
import { Terrain } from '@/components/islands/Terrain';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { homeIsland } from '@/data/islands';
import { MODEL } from '@/lib/models';

/**
 * L'îlot de départ. C'est le seul décor visible pendant l'intro : il doit être dense en
 * détails à courte distance, mais rester minuscule à l'échelle du monde.
 */
export function HomeIsland() {
  const { radius, elevation } = homeIsland;

  return (
    <group position={[homeIsland.position[0], 0, homeIsland.position[1]]}>
      <Terrain radius={radius} elevation={elevation} ground="#5f8a55" seed={1} />
      <Dock angle={homeIsland.dockAngle} reach={radius} />

      <AssetBoundary>
        {/* Le palmier central est le point de repère de la toute première image. */}
        <Prop name={MODEL.palm} position={[-1.5, 2.3, 1.1]} rotation={0.7} scale={1.25} />
        <Palms radius={radius} seed={21} count={4} />
        <Bushes radius={radius} seed={21} count={9} />
        <Boulders radius={radius} seed={64} count={4} />
        <Prop name={MODEL.crate} position={[2.1, 2.1, -1.4]} rotation={-0.4} />
        <Prop name={MODEL.barrel} position={[2.9, 2.05, -0.3]} rotation={0.9} scale={0.9} />
      </AssetBoundary>

      {/* Petite lanterne au bout du ponton : c'est elle qui accroche l'œil dans le noir. */}
      <group rotation-y={-homeIsland.dockAngle}>
        <group position={[radius + 1.4, 2.1, 0.85]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 1.4, 5]} />
            <meshStandardMaterial color="#4a3b2c" roughness={1} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#ffe6b8" emissive="#ffcf8a" emissiveIntensity={2.4} />
          </mesh>
          <pointLight position={[0, 0.85, 0]} color="#ffcf8a" intensity={9} distance={16} decay={2} />
        </group>
      </group>
    </group>
  );
}
