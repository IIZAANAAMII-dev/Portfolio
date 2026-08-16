'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { Dock } from '@/components/islands/Dock';
import { Boulders, Bushes, Palms, Prop, Shoreline } from '@/components/islands/decor';
import { Terrain } from '@/components/islands/Terrain';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { homeIsland } from '@/data/islands';
import { MODEL } from '@/lib/models';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/**
 * L'îlot de départ. C'est le seul décor visible pendant l'intro : il doit être dense en
 * détails à courte distance, mais rester minuscule à l'échelle du monde.
 */
export function HomeIsland() {
  const { radius, elevation } = homeIsland;
  const group = useRef<Group>(null);
  const quality = useWorld((state) => state.quality);

  useFrame((_, delta) => {
    if (!group.current) return;
    const { introRadius } = useWorld.getState();
    // L'îlot de départ est visible dès le départ dans le cercle d'intro.
    const target = smoothstep(0.0, 1.0, introRadius);
    const scale = damp(group.current.scale.x, target, 6, Math.min(delta, 1 / 30));
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.006;
  });

  return (
    <group ref={group} position={[homeIsland.position[0], 0, homeIsland.position[1]]} scale={1}>
      <Terrain radius={radius} elevation={elevation} ground="#5f8a55" seed={1} />
      <Shoreline radius={radius} seed={3} count={4} />
      <Dock angle={homeIsland.dockAngle} reach={radius} />

      <AssetBoundary>
        {/* Le palmier central est le point de repère de la toute première image. */}
        <Prop name={MODEL.palm} position={[-2.2, 2.3, 1.5]} rotation={0.7} scale={1.05} />
        <Palms radius={radius} seed={21} count={3} />
        <Bushes radius={radius} seed={21} count={7} />
        <Boulders radius={radius} seed={64} count={3} />
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
          {quality !== 'low' && (
            <pointLight position={[0, 0.85, 0]} color="#ffcf8a" intensity={9} distance={16} decay={2} />
          )}
        </group>
      </group>
    </group>
  );
}
