'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { Dock } from './docks';
import { Silhouette } from './Silhouette';
import { Terrain } from './Terrain';
import { createHeightSampler, terrainFeatures, type HeightSampler, type TerrainShape } from './terrain-shape';
import { CLEARING_ROOT, ClearingContext, ClearingStore } from './clearings';
import { Grass } from './Grass';
import { Trees } from './Trees';
import { NightLights } from './NightLights';
import { IslandLife } from './IslandLife';
import { createDecorLod, updateDecorLod, type DecorLod } from './lod';
import { sceneConfigs } from './scenes/registry';
import type { IslandConfig } from '@/types';

/** Couleur des flamboyants, une par île : corail, mandarine, rose, vermillon, ambre, fuchsia. */
const FLAMES = ['#e2553f', '#ec7f3a', '#e8668c', '#d9483f', '#efa23c', '#d2609e'];

function DeferredDecor({
  island,
  index,
  sampler,
  shape,
}: {
  island: IslandConfig;
  index: number;
  sampler: HeightSampler;
  shape: TerrainShape;
}) {
  const sceneReady = useWorld((state) => state.sceneReady);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!sceneReady) return;
    const id = setTimeout(() => setEnabled(true), 450 + index * 180);
    return () => clearTimeout(id);
  }, [index, sceneReady]);

  const features = useMemo(() => terrainFeatures(shape), [shape]);
  return enabled ? (
    <Suspense fallback={null}>
      <Silhouette island={island} sampler={sampler} features={features} seed={index * 31 + 5} />
    </Suspense>
  ) : null;
}

export function Island({ island, index }: { island: IslandConfig; index: number }) {
  const group = useRef<Group>(null);
  const decor = useRef<Group>(null);
  const lod = useRef<DecorLod>(createDecorLod());
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);
  const isHovered = useWorld((s) => s.hovered === island.id);
  const isActive = useWorld((s) => s.activeIsland === island.id);
  // Booléen dérivé : l'île ne se re-rend pas à chaque image de la cinématique d'intro.
  const labelVisible = useWorld((s) => s.reveal > 0.72);
  const shape = useMemo<TerrainShape>(
    () => ({ radius: island.radius, elevation: island.elevation, seed: index * 17 + 3 }),
    [index, island.elevation, island.radius],
  );
  const config = sceneConfigs[island.id];
  const features = useMemo(() => terrainFeatures(shape), [shape]);
  const sampler = useMemo<HeightSampler>(() => {
    const base = createHeightSampler(shape);
    const sculpt = config.sculpt;
    if (!sculpt) return base;
    const shapeFeatures = terrainFeatures(shape);
    return (x, z) => sculpt(x, z, base(x, z), shapeFeatures);
  }, [config, shape]);
  const clearings = useMemo(() => new ClearingStore(), []);

  // Les îles n'apparaissent pas toutes en même temps pendant la révélation :
  // elles émergent une à une (voir useWorldReveal).
  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const { introCenter, introRadius, quality, reducedMotion, activeIsland, destination } = useWorld.getState();
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

    // LOD (qualité basse / moyenne) : loin de la caméra, le décor détaillé disparaît.
    if (decor.current) {
      updateDecorLod(
        decor.current,
        lod.current,
        state.camera,
        { x: island.position[0], z: island.position[1], radius: island.radius, depth: island.elevation + 9 },
        quality,
        activeIsland === island.id || destination === island.id,
        activeIsland !== null,
        reducedMotion || !group.current.visible,
        dt,
      );
    }
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
      userData={CLEARING_ROOT}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      <ClearingContext.Provider value={clearings}>
        <Terrain shape={shape} sampler={sampler} cliff={island.terrain.cliff} top={island.terrain.top} cliffTint={config.cliffTint} />
        {/* Décor détaillé, soumis au LOD de distance (qualité basse / moyenne). */}
        <group ref={decor}>
          {config.grass > 0 && (
            <Grass
              sampler={sampler}
              radius={island.radius}
              plateau={features.plateau}
              avoidAngle={island.dockAngle}
              seed={index * 41 + 7}
              amount={config.grass}
              palette={config.grassPalette}
            />
          )}
          <DeferredDecor island={island} index={index} sampler={sampler} shape={shape} />
          <NightLights island={island} />
          <IslandLife island={island} index={index} />
        </group>
        {config.trees > 0 && (
          <Trees
            sampler={sampler}
            radius={island.radius}
            plateau={features.plateau}
            avoidAngle={island.dockAngle}
            seed={index * 29 + 11}
            flame={FLAMES[index % FLAMES.length]}
            count={config.trees}
          />
        )}
        <Dock angle={island.dockAngle} reach={island.radius} />
      </ClearingContext.Provider>

      {/* Volume de sélection : garantit une cible cliquable généreuse et stable. */}
      <mesh position={[0, island.elevation * 0.5, 0]} visible={false}>
        <cylinderGeometry args={[island.radius * 1.05, island.radius * 1.05, island.elevation + 6, 8]} />
      </mesh>

      {labelVisible && (
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
