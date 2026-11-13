'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { Dock } from '@/components/islands/docks';
import { SubstanceProp, SubstanceScatter } from '@/components/islands/bell-island';
import { CLEARING_ROOT, ClearingContext, ClearingStore } from '@/components/islands/clearings';
import { Grass } from '@/components/islands/Grass';
import { Trees } from '@/components/islands/Trees';
import { Terrain } from '@/components/islands/Terrain';
import { createHeightSampler, groundAt, terrainFeatures, type TerrainShape } from '@/components/islands/terrain-shape';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { homeIsland } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/**
 * L'îlot de départ : le petit port d'où part le bateau. C'est le seul décor visible
 * pendant l'intro : dense en détails à courte distance, minuscule à l'échelle du monde.
 * Son habillage bloque la première image pour que l'intro soit complète d'emblée.
 */
export function HomeIsland() {
  const { radius, elevation, dockAngle } = homeIsland;
  const group = useRef<Group>(null);
  const quality = useWorld((state) => state.quality);
  const shape = useMemo<TerrainShape>(() => ({ radius, elevation, seed: 1 }), [radius, elevation]);
  const sampler = useMemo(() => createHeightSampler(shape), [shape]);
  const features = useMemo(() => terrainFeatures(shape), [shape]);
  const clearings = useMemo(() => new ClearingStore(), []);

  // Le kiosque du port attend le visiteur à la racine du ponton.
  const kioskAngle = dockAngle + 0.62;
  const kioskX = Math.cos(kioskAngle) * radius * 0.5;
  const kioskZ = Math.sin(kioskAngle) * radius * 0.5;
  const flagsAngle = dockAngle - 0.55;
  const flagsX = Math.cos(flagsAngle) * radius * 0.66;
  const flagsZ = Math.sin(flagsAngle) * radius * 0.66;

  useFrame((_, delta) => {
    if (!group.current) return;
    const { introCenter, introRadius } = useWorld.getState();
    // L'îlot de départ surgit au passage de l'onde, juste après l'éclaboussure.
    const d = Math.hypot(homeIsland.position[0] - introCenter[0], homeIsland.position[1] - introCenter[1]);
    const raw = smoothstep(d - 4.5, d, introRadius);
    const target = raw * (1 + 0.09 * Math.sin(raw * Math.PI) * (1 - raw));
    const scale = damp(group.current.scale.x, target, 7.5, Math.min(delta, 1 / 30));
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.006;
  });

  const avoid = { avoidAngle: dockAngle, avoidWidth: 0.55 };

  return (
    <group
      ref={group}
      position={[homeIsland.position[0], 0, homeIsland.position[1]]}
      scale={0}
      visible={false}
      userData={CLEARING_ROOT}
    >
      <ClearingContext.Provider value={clearings}>
      <Terrain shape={shape} sampler={sampler} cliff={homeIsland.terrain.cliff} top={homeIsland.terrain.top} />
      <Grass sampler={sampler} radius={radius} plateau={features.plateau} avoidAngle={dockAngle} seed={3} />
      <Trees sampler={sampler} radius={radius} plateau={features.plateau} avoidAngle={dockAngle} seed={5} flame="#e2553f" count={2} />
      <AssetBoundary blocking>
        {/* Au départ, le bateau est amarré de flanc (rayon + 5,8 m) : le ponton s'arrête contre sa coque. */}
        <Dock angle={dockAngle} reach={radius} end={radius + 4.35} />
        <SubstanceProp
          name="kiosk"
          position={[kioskX, groundAt(sampler, kioskX, kioskZ, 1.1) - 0.05, kioskZ]}
          rotation={Math.atan2(-kioskX, -kioskZ) + Math.PI}
          scale={1.1}
        />
        <SubstanceProp
          name="flags-multi"
          position={[flagsX, groundAt(sampler, flagsX, flagsZ, 0.3) - 0.04, flagsZ]}
          rotation={-flagsAngle}
          scale={1.2}
        />
        <SubstanceScatter
          name="rocks-small"
          sampler={sampler}
          zone={{ inner: radius * 0.85, outer: radius * 1.12, minHeight: -0.6, maxHeight: 0.55, ...avoid }}
          count={9}
          seed={3}
          scale={[0.7, 1.25]}
          variety={4}
          sink={0.25}
        />
        <SubstanceScatter
          name="flower-clump"
          sampler={sampler}
          mode="together"
          zone={{ inner: 0, outer: radius * 0.74, minHeight: features.plateau - 0.3, maxSlope: 0.25, ...avoid }}
          count={10}
          seed={5}
          scale={[1.5, 2.4]}
          sink={0.02}
          shadows={false}
        />
        <SubstanceScatter
          name="starfish"
          sampler={sampler}
          mode="together"
          zone={{ inner: radius * 0.8, outer: radius * 1.0, minHeight: 0.1, maxHeight: 0.85, ...avoid }}
          count={3}
          seed={9}
          scale={[1.8, 2.3]}
          sink={0}
          shadows={false}
        />
      </AssetBoundary>

      {/* Petite lanterne au bout du ponton : c'est elle qui accroche l'œil dans le noir. */}
      <group rotation-y={-dockAngle}>
        <group position={[radius + 4.05, 0.78, 0.62]}>
          <mesh castShadow position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.4, 6]} />
            <meshStandardMaterial color="#4a3b2c" roughness={1} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#ffe6b8" emissive="#ffcf8a" emissiveIntensity={2.4} />
          </mesh>
          {quality !== 'low' && (
            <pointLight position={[0, 1.55, 0]} color="#ffcf8a" intensity={9} distance={16} decay={2} />
          )}
        </group>
      </group>
      </ClearingContext.Provider>
    </group>
  );
}
