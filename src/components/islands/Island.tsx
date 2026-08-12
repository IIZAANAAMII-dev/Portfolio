'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import { Dock } from './Dock';
import { Silhouette } from './Silhouette';
import { Terrain } from './Terrain';
import { Shoreline } from './decor';
import type { IslandConfig } from '@/types';

export function Island({ island, index }: { island: IslandConfig; index: number }) {
  const group = useRef<Group>(null);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);
  const isHovered = useWorld((s) => s.hovered === island.id);
  const isActive = useWorld((s) => s.activeIsland === island.id);
  const revealed = useWorld((s) => s.reveal > (index + 1) / 8);

  // Les îles n'apparaissent pas toutes en même temps pendant la révélation :
  // elles émergent une à une (voir useWorldReveal).
  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const target = revealed ? 1 : 0;
    const scale = damp(group.current.scale.x, target, 2.4, dt);
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.02;
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    sailTo(island.id);
  };

  const onOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hover(island.id);
    document.body.style.cursor = 'pointer';
  };

  const onOut = () => {
    hover(null);
    document.body.style.cursor = '';
  };

  return (
    <group
      ref={group}
      position={[island.position[0], 0, island.position[1]]}
      scale={0}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      <Terrain
        radius={island.radius}
        elevation={island.elevation}
        ground={island.ground}
        seed={index * 17 + 3}
      />
      <Shoreline radius={island.radius} seed={index * 29 + 11} count={island.radius > 17 ? 10 : 7} />
      <Silhouette island={island} />
      <Dock angle={island.dockAngle} reach={island.radius} />

      {/* Volume de sélection : garantit une cible cliquable généreuse et stable. */}
      <mesh position={[0, island.elevation * 0.5, 0]} visible={false}>
        <cylinderGeometry args={[island.radius * 1.05, island.radius * 1.05, island.elevation + 6, 8]} />
      </mesh>

      <Html
        position={[0, island.elevation + 7, 0]}
        center
        distanceFactor={44}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className={`island-label ${isHovered || isActive ? 'is-active' : ''}`}>
          <span className="island-label__name">{island.label}</span>
          <span className="island-label__tagline">{island.tagline}</span>
        </div>
      </Html>
    </group>
  );
}
