'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { Dock } from './Dock';
import { Silhouette } from './Silhouette';
import { Terrain } from './Terrain';
import { Shoreline } from './decor';
import { NightLights } from './NightLights';
import { IslandLife } from './IslandLife';
import type { IslandConfig } from '@/types';

function DeferredDecor({ island, index }: { island: IslandConfig; index: number }) {
  const sceneReady = useWorld((state) => state.sceneReady);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!sceneReady) return;
    const id = setTimeout(() => setEnabled(true), 450 + index * 180);
    return () => clearTimeout(id);
  }, [index, sceneReady]);

  return enabled ? (
    <Suspense fallback={null}>
      <Silhouette island={island} />
    </Suspense>
  ) : null;
}

export function Island({ island, index }: { island: IslandConfig; index: number }) {
  const group = useRef<Group>(null);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);
  const isHovered = useWorld((s) => s.hovered === island.id);
  const isActive = useWorld((s) => s.activeIsland === island.id);
  const reveal = useWorld((s) => s.reveal);

  // Les îles n'apparaissent pas toutes en même temps pendant la révélation :
  // elles émergent une à une (voir useWorldReveal).
  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const { introCenter, introRadius } = useWorld.getState();
    const dx = island.position[0] - introCenter[0];
    const dz = island.position[1] - introCenter[1];
    const d = Math.hypot(dx, dz);
    const edge = 4.5;
    const raw = smoothstep(d - edge, d, introRadius);
    // Petit bounce à l'arrivée du cercle lumineux (un seul overshoot).
    const bounce = 1.0 + 0.09 * Math.sin(raw * Math.PI) * (1.0 - raw);
    const target = raw * bounce;
    const scale = damp(group.current.scale.x, target, 7.5, dt);
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.006;
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
      <DeferredDecor island={island} index={index} />
      <Dock angle={island.dockAngle} reach={island.radius} />
      <NightLights island={island} />
      <IslandLife island={island} index={index} />

      {/* Volume de sélection : garantit une cible cliquable généreuse et stable. */}
      <mesh position={[0, island.elevation * 0.5, 0]} visible={false}>
        <cylinderGeometry args={[island.radius * 1.05, island.radius * 1.05, island.elevation + 6, 8]} />
      </mesh>

      {reveal > 0.72 && (
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
      )}
    </group>
  );
}
