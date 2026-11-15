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
import { BeachTreasures } from '@/components/islands/props/Beach';
import { Butterflies } from '@/components/islands/props/Butterflies';
import { Bunting } from '@/components/islands/props/Bunting';
import { FlagPole } from '@/components/islands/props/FlagPole';
import { FlowerScatter } from '@/components/islands/props/Flowers';
import { Kiosk } from '@/components/islands/props/Kiosk';
import { legacyProps } from '@/components/islands/props/legacy';
import { RockScatter, type RockGroup } from '@/components/islands/props/Rocks';
import { StonePath } from '@/components/islands/props/StonePath';
import { WIND_DIRECTION } from '@/components/islands/props/wind';
import { createHeightSampler, groundAt, terrainFeatures, type HeightSampler, type TerrainShape } from '@/components/islands/terrain-shape';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { homeIsland } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/**
 * L'îlot de départ : le petit port d'où part le bateau. C'est le seul décor visible
 * pendant l'intro : dense en détails à courte distance, minuscule à l'échelle du monde.
 *
 * Tout est procédural (aucun modèle sous licence) : la capitainerie au pignon « Départ »,
 * l'escalier de bois qui monte du ponton, le sentier de dalles, le mât au Gwenn-ha-Du et
 * ses guirlandes de fanions, les rochers, fleurs, étoiles de mer et coquillages. Le ponton
 * reste libre (un chat viendra s'y installer).
 */

const { radius: RADIUS, elevation: ELEVATION, dockAngle: DOCK_ANGLE } = homeIsland;
const DOCK_X = Math.cos(DOCK_ANGLE);
const DOCK_Z = Math.sin(DOCK_ANGLE);
/** Le drapeau flotte sous le vent (son axe +x local suit la direction du vent). */
const FLAG_YAW = Math.atan2(-WIND_DIRECTION.z, WIND_DIRECTION.x);

/** Plan du port, en coordonnées de l'îlot (calculé une fois à partir du relief). */
function harborPlan(sampler: HeightSampler) {
  // Escalier : du bout du ponton (plancher à 0,78 m) jusqu'au plateau.
  const stairFrom: [number, number] = [DOCK_X * (RADIUS * 0.74 - 0.05), DOCK_Z * (RADIUS * 0.74 - 0.05)];
  const stairTo: [number, number] = [DOCK_X * (RADIUS * 0.74 - 0.75), DOCK_Z * (RADIUS * 0.74 - 0.75)];
  const stairTop = sampler(stairTo[0], stairTo[1]);
  // La capitainerie, un peu à droite du ponton, façade tournée vers l'escalier.
  const kioskX = 3.05;
  const kioskZ = -1.0;
  const kioskY = groundAt(sampler, kioskX, kioskZ, 1.1) - 0.04;
  const kioskYaw = Math.atan2(stairTo[0] - kioskX, stairTo[1] - kioskZ);
  const porch: [number, number] = [kioskX + Math.sin(kioskYaw) * 1.7, kioskZ + Math.cos(kioskYaw) * 1.7];
  // Pignon avant (point d'attache des fanions), dans le repère de l'îlot.
  const gable: [number, number, number] = [kioskX + Math.sin(kioskYaw) * 1.02, kioskY + 2.78, kioskZ + Math.cos(kioskYaw) * 1.02];
  // Le mât, à gauche en haut de l'escalier ; un piquet à droite.
  const mastX = 0.62;
  const mastZ = -4.1;
  const mastY = groundAt(sampler, mastX, mastZ, 0.3) - 0.05;
  const postX = stairTo[0] + 0.85;
  const postZ = stairTo[1] + 0.55;
  const postY = groundAt(sampler, postX, postZ, 0.2) - 0.05;
  return { stairFrom, stairTo, stairTop, kioskX, kioskY, kioskZ, kioskYaw, porch, gable, mast: [mastX, mastY, mastZ] as [number, number, number], post: [postX, postY, postZ] as [number, number, number] };
}

/** Piquet de bois qui tient la guirlande en haut de l'escalier. */
function Post({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position-y={0.85} raycast={() => null}>
        <cylinderGeometry args={[0.06, 0.08, 1.7, 6]} />
        <meshStandardMaterial color="#6e4a33" roughness={1} flatShading />
      </mesh>
      <mesh position-y={1.72} raycast={() => null}>
        <coneGeometry args={[0.09, 0.12, 6]} />
        <meshStandardMaterial color="#c8553d" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

/** Habillage procédural de l'îlot (version de production). */
function HarborDressing({ sampler, plateau }: { sampler: HeightSampler; plateau: number }) {
  const plan = useMemo(() => harborPlan(sampler), [sampler]);
  const avoid = { avoidAngle: DOCK_ANGLE, avoidWidth: 0.55 };
  const rocks = useMemo<RockGroup[]>(() => {
    const away = { avoidAngle: DOCK_ANGLE, avoidWidth: 0.55 };
    return [
      // Galets et rochers de la grève, en petits groupes.
      { kind: 'pebble', zone: { inner: RADIUS * 0.84, outer: RADIUS * 1.1, minHeight: -0.5, maxHeight: 0.6, ...away }, groups: 5, seed: 3, size: [0.55, 1.05], satellites: [1, 3] },
      // Blocs éboulés au pied de la falaise, un peu de mousse.
      { kind: 'boulder', zone: { inner: RADIUS * 0.7, outer: RADIUS * 0.86, minHeight: 0.4, maxHeight: plateau - 0.25, ...away }, groups: 3, seed: 7, size: [0.95, 1.5], satellites: [1, 2], moss: 0.55 },
      // Deux pierres moussues dans l'herbe du plateau.
      { kind: 'stone', zone: { inner: RADIUS * 0.3, outer: RADIUS * 0.62, minHeight: plateau - 0.3, maxSlope: 0.25, ...away }, groups: 2, seed: 13, size: [0.5, 0.8], satellites: [0, 1], moss: 0.9 },
    ];
  }, [plateau]);
  // Papillons : autour des hortensias de la capitainerie et au-dessus de deux massifs.
  const butterflies = useMemo<[number, number, number][]>(() => [
    [plan.porch[0] - 0.6, plan.kioskY, plan.porch[1] + 0.4],
    [plan.porch[0] + 0.9, plan.kioskY, plan.porch[1] - 0.6],
    [-1.6, sampler(-1.6, 2.6), 2.6],
    [-3.2, sampler(-3.2, -0.6), -0.6],
  ], [plan, sampler]);
  const { stairFrom, stairTo, stairTop, kioskX, kioskY, kioskZ, kioskYaw, porch, gable, mast, post } = plan;
  const mastTop: [number, number, number] = [mast[0], mast[1] + 4.35, mast[2]];
  return (
    <>
      <Kiosk position={[kioskX, kioskY, kioskZ]} rotation={kioskYaw} ground={sampler} />
      <StonePath
        sampler={sampler}
        points={[stairTo, [(stairTo[0] + porch[0]) / 2 + 0.15, (stairTo[1] + porch[1]) / 2], porch]}
        spacing={0.6}
        seed={5}
        stair={{ from: stairFrom, to: stairTo, bottom: 0.78, top: stairTop, width: 0.95 }}
      />
      <FlagPole position={mast} rotation={FLAG_YAW} height={4.6} texture={gwennHaDu} width={1.35} />
      <Post position={post} />
      <Bunting from={[mastTop[0], mastTop[1] - 0.6, mastTop[2]]} to={gable} sag={0.55} seed={3} />
      <Bunting from={[mastTop[0], mastTop[1] - 0.75, mastTop[2]]} to={[post[0], post[1] + 1.68, post[2]]} sag={0.4} seed={11} />
      <RockScatter sampler={sampler} groups={rocks} />
      <FlowerScatter
        sampler={sampler}
        zone={{ inner: 0, outer: RADIUS * 0.72, minHeight: plateau - 0.3, maxSlope: 0.25, ...avoid }}
        count={13}
        seed={5}
        colors={['#ec8f86', '#f4ead2', '#9f8fe4']}
      />
      <BeachTreasures
        sampler={sampler}
        zone={{ inner: RADIUS * 0.8, outer: RADIUS * 1.0, minHeight: 0.12, maxHeight: 0.8, ...avoid }}
        starfish={4}
        shells={6}
        seed={9}
      />
      <Butterflies spots={butterflies} seed={4} />
    </>
  );
}

/** Anciens accessoires Bell Island (`?props=old`, développement seulement). */
function LegacyDressing({ sampler, plateau }: { sampler: HeightSampler; plateau: number }) {
  const kioskAngle = DOCK_ANGLE + 0.62;
  const kioskX = Math.cos(kioskAngle) * RADIUS * 0.5;
  const kioskZ = Math.sin(kioskAngle) * RADIUS * 0.5;
  const flagsAngle = DOCK_ANGLE - 0.55;
  const flagsX = Math.cos(flagsAngle) * RADIUS * 0.66;
  const flagsZ = Math.sin(flagsAngle) * RADIUS * 0.66;
  const avoid = { avoidAngle: DOCK_ANGLE, avoidWidth: 0.55 };
  return (
    <>
      <SubstanceProp name="kiosk" position={[kioskX, groundAt(sampler, kioskX, kioskZ, 1.1) - 0.05, kioskZ]} rotation={Math.atan2(-kioskX, -kioskZ) + Math.PI} scale={1.1} />
      <SubstanceProp name="flags-multi" position={[flagsX, groundAt(sampler, flagsX, flagsZ, 0.3) - 0.04, flagsZ]} rotation={-flagsAngle} scale={1.2} />
      <SubstanceScatter name="rocks-small" sampler={sampler} zone={{ inner: RADIUS * 0.85, outer: RADIUS * 1.12, minHeight: -0.6, maxHeight: 0.55, ...avoid }} count={9} seed={3} scale={[0.7, 1.25]} variety={4} sink={0.25} />
      <SubstanceScatter name="flower-clump" sampler={sampler} mode="together" zone={{ inner: 0, outer: RADIUS * 0.74, minHeight: plateau - 0.3, maxSlope: 0.25, ...avoid }} count={10} seed={5} scale={[1.5, 2.4]} sink={0.02} shadows={false} />
      <SubstanceScatter name="starfish" sampler={sampler} mode="together" zone={{ inner: RADIUS * 0.8, outer: RADIUS * 1.0, minHeight: 0.1, maxHeight: 0.85, ...avoid }} count={3} seed={9} scale={[1.8, 2.3]} sink={0} shadows={false} />
      <group rotation-y={-DOCK_ANGLE}>
        <group position={[RADIUS + 4.05, 0.78, 0.62]}>
          <mesh castShadow position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.4, 6]} />
            <meshStandardMaterial color="#4a3b2c" roughness={1} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#ffe6b8" emissive="#ffcf8a" emissiveIntensity={2.4} />
          </mesh>
          <pointLight position={[0, 1.55, 0]} color="#ffcf8a" intensity={9} distance={16} decay={2} />
        </group>
      </group>
    </>
  );
}

export function HomeIsland() {
  const group = useRef<Group>(null);
  const quality = useWorld((state) => state.quality);
  const shape = useMemo<TerrainShape>(() => ({ radius: RADIUS, elevation: ELEVATION, seed: 1 }), []);
  const sampler = useMemo(() => createHeightSampler(shape), [shape]);
  const features = useMemo(() => terrainFeatures(shape), [shape]);
  const clearings = useMemo(() => new ClearingStore(), []);

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
        <Grass sampler={sampler} radius={RADIUS} plateau={features.plateau} avoidAngle={DOCK_ANGLE} seed={3} />
        <Trees sampler={sampler} radius={RADIUS} plateau={features.plateau} avoidAngle={DOCK_ANGLE} seed={5} flame="#e2553f" count={2} />
        <AssetBoundary blocking>
          {/* Au départ, le bateau est amarré de flanc (rayon + 5,8 m) : le ponton s'arrête contre sa coque. */}
          <Dock angle={DOCK_ANGLE} reach={RADIUS} end={RADIUS + 4.35} />
          {legacyProps && <LegacyDressing sampler={sampler} plateau={features.plateau} />}
        </AssetBoundary>
        {!legacyProps && (
          <AssetBoundary>
            <HarborDressing sampler={sampler} plateau={features.plateau} />
          </AssetBoundary>
        )}

        {/* Lumière chaude de la lanterne du bout du ponton : c'est elle qui accroche l'œil dans le noir. */}
        {quality === 'high' && (
          <group rotation-y={-DOCK_ANGLE}>
            <pointLight position={[RADIUS + 4.18, 2.35, -1.07]} color="#ffcf8a" intensity={9} distance={16} decay={2} />
          </group>
        )}
      </ClearingContext.Provider>
    </group>
  );
}
