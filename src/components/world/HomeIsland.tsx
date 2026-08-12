'use client';

import { Dock } from '@/components/islands/Dock';
import { Scatter } from '@/components/islands/Scatter';
import { Terrain } from '@/components/islands/Terrain';
import { homeIsland } from '@/data/islands';

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

      {/* Arbre principal : le point de repère de la première image. */}
      <group position={[-1.6, 2.4, 1.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.26, 2.2, 6]} />
          <meshStandardMaterial color="#7a5a3c" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 2.3, 0]} castShadow>
          <coneGeometry args={[1.5, 3.4, 7]} />
          <meshStandardMaterial color="#3f6b45" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.1, 4.1, 0]} castShadow>
          <coneGeometry args={[1.05, 2.2, 7]} />
          <meshStandardMaterial color="#4a7a4e" roughness={1} flatShading />
        </mesh>
      </group>

      <Scatter count={7} radius={radius * 0.7} innerRadius={1.5} seed={21} y={1.8} sway={0.05}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#4f7a4c" roughness={1} flatShading />
      </Scatter>

      <Scatter count={6} radius={radius * 0.95} innerRadius={radius * 0.5} seed={64} y={0.7}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#6b6f76" roughness={1} flatShading />
      </Scatter>

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
