'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, PointsMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { updateWindows } from '@/lib/windows';
import { ChimneySmoke } from '../../ChimneySmoke';
import { glowTexture, type Vec3 } from '../../docks/parts';
import {
  LANTERN_GLASS,
  LANTERN_GLASS_GEOMETRY,
  LIGHT_POOL,
  LIGHT_POOL_GEOMETRY,
  PAINTED,
  updateHarborLights,
} from '../../docks/planks';
import { ClearingAt, WindowPane, type SceneProps } from '../../kit';
import { groundAt } from '../../terrain-shape';
import { BeachBottles, DriftingBottle } from './Bottles';
import { Bunting } from './Bunting';
import {
  bellPivot,
  buildIsland,
  buildPier,
  CHIMNEYS,
  COTTAGE_WINDOWS,
  cottageMatrix,
  DOOR_LAMP,
  fromCottage,
  glowSpots,
  gullPerch,
  HOUSE,
  mailboxFrame,
  PIER_DECK,
  pierLanterns,
  towerWindows,
} from './build';
import { BELL, COTTAGE, DOCK_SIDE, hillStairs, MAILBOX, onDockAxis, PIER, polar } from './layout';
import { Gull } from './Gull';
import { LighthouseLamp } from './LighthouseLamp';
import { Mailbox } from './Mailbox';
import { ShipBell } from './ShipBell';

/**
 * ÎLE CONTACT — « on se parle ? ». Un phare rouge et blanc au sommet de la butte, la maison
 * du gardien et ses hortensias, un escalier qui monte du ponton, une longue jetée bordée de
 * lanternes jusqu'à un banc tourné vers le couchant. La boîte aux lettres et la bouteille du
 * large ouvrent le formulaire « bouteille à la mer » ; la cloche de bord sonne au clic.
 *
 * Draw calls : décor fusionné (1) + jetée (1) + lanterne du phare (≈5) + vitres (7) +
 * lanternes de la jetée (3) + interactifs (≈10) + guirlande et fumée (2).
 */

const GLOWS = new PointsMaterial({
  map: glowTexture(),
  color: '#ffc27a',
  size: 1.9,
  sizeAttenuation: true,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  opacity: 0,
});
const DOOR_LAMP_GEOMETRY = new BoxGeometry(0.15, 0.21, 0.15);

export default function ContactScene({ island, sampler, features }: SceneProps) {
  const quality = useWorld((state) => state.quality);
  const built = useMemo(() => buildIsland(sampler, features), [features, sampler]);
  const pier = useMemo(() => buildPier(), []);
  const pierLights = useMemo(() => {
    const spots = pierLanterns();
    return {
      glass: mergeGeometries(spots.map(([x, y, z]) => LANTERN_GLASS_GEOMETRY.clone().translate(x, y + 0.005, z)))!,
      pools: mergeGeometries(spots.map(([x, , z]) => LIGHT_POOL_GEOMETRY.clone().translate(x, PIER_DECK + 0.03, z * 0.25)))!,
    };
  }, []);
  const glows = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(glowSpots(sampler).flat()), 3));
    return geometry;
  }, [sampler]);

  useEffect(() => () => built.geometry.dispose(), [built]);
  useEffect(() => () => pier.dispose(), [pier]);
  useEffect(() => () => {
    pierLights.glass.dispose();
    pierLights.pools.dispose();
  }, [pierLights]);
  useEffect(() => () => glows.dispose(), [glows]);

  const { frame, doorAngle, bottles } = built;
  const cottage = useMemo(() => cottageMatrix(sampler), [sampler]);
  const cottageGround = groundAt(sampler, COTTAGE.x, COTTAGE.z, 1.1) - 0.04;
  const windows = useMemo(() => towerWindows(frame, doorAngle), [doorAngle, frame]);

  // Guirlande : du balcon du phare à la cheminée la plus proche ; la fumée sort de l'autre.
  const garland = useMemo(() => {
    const tops = CHIMNEYS.map(([cx]) => fromCottage(cottage, [cx, HOUSE.wall + HOUSE.roof + 0.74, 0]));
    const distance = (point: Vec3) => Math.hypot(point[0] - frame.x, point[2] - frame.z);
    const near = distance(tops[0]) < distance(tops[1]) ? 0 : 1;
    const dirX = tops[near][0] - frame.x;
    const dirZ = tops[near][2] - frame.z;
    const length = Math.hypot(dirX, dirZ) || 1;
    const from: Vec3 = [frame.x + (dirX / length) * 1.16, frame.galleryTop + 0.44, frame.z + (dirZ / length) * 1.16];
    const smoke = fromCottage(cottage, [CHIMNEYS[1 - near][0], HOUSE.wall + HOUSE.roof + 0.82, 0.1]);
    return { from, to: tops[near], smoke };
  }, [cottage, frame]);

  const mailbox = useMemo(() => mailboxFrame(sampler), [sampler]);
  const bell = useMemo(() => bellPivot(sampler), [sampler]);
  const stairs = hillStairs(features.hillX, features.hillZ);
  const sea = polar(1.27, 14.8);
  const perch = gullPerch();

  useFrame((state) => {
    const night = skyState.dayNight;
    // Les vitres partagées s'allument une à une (rien d'autre ne les met à jour pour l'instant).
    updateWindows(night);
    updateHarborLights(state.clock.elapsedTime, night);
    GLOWS.opacity = night * 0.9;
  });

  return (
    <>
      <ClearingAt x={frame.x} z={frame.z} radius={2.3} />
      <ClearingAt x={COTTAGE.x} z={COTTAGE.z} radius={2.45} />
      <ClearingAt x={onDockAxis(8.7).x} z={onDockAxis(8.7).z} radius={1.25} />
      <ClearingAt x={onDockAxis(7.5).x} z={onDockAxis(7.5).z} radius={1.0} />
      <ClearingAt x={frame.x + stairs.dirX * 3.9} z={frame.z + stairs.dirZ * 3.9} radius={1.0} />
      <ClearingAt x={frame.x + stairs.dirX * 5.6} z={frame.z + stairs.dirZ * 5.6} radius={0.8} />
      <ClearingAt x={MAILBOX.x} z={MAILBOX.z} radius={0.55} />
      <ClearingAt x={BELL.x} z={BELL.z} radius={0.6} />
      <ClearingAt x={onDockAxis(7.2, -1.1).x} z={onDockAxis(7.2, -1.1).z} radius={0.7} />

      {/* Tout le statique : phare, maison, escaliers, rochers, canot… (un draw call). */}
      <mesh geometry={built.geometry} material={PAINTED} castShadow receiveShadow raycast={() => null} />

      {/* La longue jetée, ses lanternes et leurs flaques de lumière. */}
      <group rotation-y={-PIER.angle}>
        <mesh geometry={pier} material={PAINTED} castShadow receiveShadow raycast={() => null} />
        <mesh geometry={pierLights.glass} material={LANTERN_GLASS} raycast={() => null} />
        <mesh geometry={pierLights.pools} material={LIGHT_POOL} renderOrder={4} raycast={() => null} />
      </group>
      {quality !== 'low' && <points geometry={glows} material={GLOWS} renderOrder={8} raycast={() => null} />}

      <LighthouseLamp frame={frame} />
      {windows.map((window) => (
        <WindowPane key={window.seed} seed={window.seed} width={0.24} height={0.36} position={window.position} rotation={window.rotation} />
      ))}

      {/* Maison du gardien : vitres, lampe de porte, fumée. */}
      <group position={[COTTAGE.x, cottageGround, COTTAGE.z]} rotation-y={COTTAGE.yaw}>
        {COTTAGE_WINDOWS.map((window) => (
          <WindowPane key={window.seed} seed={window.seed} width={window.width} height={window.height} position={window.position} rotation={window.rotation} />
        ))}
        <mesh geometry={DOOR_LAMP_GEOMETRY} material={LANTERN_GLASS} position={DOOR_LAMP} raycast={() => null} />
      </group>
      <ChimneySmoke position={garland.smoke} />
      {quality !== 'low' && <Bunting from={garland.from} to={garland.to} />}

      <Mailbox position={mailbox.position} yaw={mailbox.yaw} />
      <ShipBell pivot={bell} yaw={Math.atan2(DOCK_SIDE.x, DOCK_SIDE.z)} />
      <BeachBottles bottles={bottles} />
      <DriftingBottle origin={island.position} at={[sea.x, sea.z]} />
      {quality !== 'low' && <Gull position={perch.position} yaw={perch.yaw} />}
    </>
  );
}
