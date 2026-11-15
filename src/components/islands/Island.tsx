'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';
import { useWorld } from '@/lib/store';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION } from '@/lib/cinematic';
import { damp } from '@/lib/utils/math';
import { risePose, riseSchedule, type RisePose } from '@/components/intro/rise';
import { WaterSkin } from '@/components/intro/WaterSkin';
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
  // Les étiquettes arrivent avec le HUD, quand la caméra se pose.
  const labelVisible = useWorld((s) => s.reveal > 0.97);
  const pose = useRef<RisePose>({ visible: false, y: 0, sy: 1, sxz: 1, tiltX: 0, tiltZ: 0 });
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

  // Pendant l'ouverture, les îles surgissent de la mer l'une après l'autre (intro/rise.ts) :
  // ressort, étirement, roulis de bouchon. Avant le clic, elles attendent invisibles mais à
  // leur place exacte (les repères calculés une fois sur les matrices restent justes).
  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const { phase, gameTransition, introCenter, quality, reducedMotion, activeIsland, destination } = useWorld.getState();
    const node = group.current;
    if (phase === 'transitioning' && !reducedMotion) {
      const slot = riseSchedule(introCenter[0], introCenter[1], boatState.heading).byId.get(island.id);
      const current = risePose(gameTransition * INTRO_DURATION - (slot?.start ?? 0), island.elevation + 3.5, index * 1.7, pose.current);
      node.visible = current.visible;
      node.position.y = current.y;
      node.scale.set(current.sxz, current.sy, current.sxz);
      node.rotation.set(current.tiltX, 0, current.tiltZ);
    } else if (phase === 'loading' || phase === 'intro') {
      node.visible = false;
      node.position.y = 0;
      node.scale.setScalar(1);
      node.rotation.set(0, 0, 0);
    } else {
      // Ouverture passée en cours de route : l'île finit de monter, vite et sans à-coup.
      node.visible = true;
      const rate = reducedMotion ? 1000 : 9;
      node.position.y = damp(node.position.y, 0, rate, dt);
      node.scale.setScalar(damp(node.scale.x, 1, rate, dt));
      node.rotation.set(damp(node.rotation.x, 0, rate, dt), 0, damp(node.rotation.z, 0, rate, dt));
    }

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
      visible={false}
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
        {/* Nappes d'eau qui ruissellent quand l'île crève la surface (ouverture seulement). */}
        <WaterSkin id={island.id} shape={shape} sampler={sampler} />
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
