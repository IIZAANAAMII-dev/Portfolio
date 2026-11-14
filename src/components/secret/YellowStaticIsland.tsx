'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Group } from 'three';
import { ClearingAt } from '@/components/islands/kit';
import { CLEARING_ROOT, ClearingContext, ClearingStore } from '@/components/islands/clearings';
import { Grass } from '@/components/islands/Grass';
import { buildTerrainGeometry } from '@/components/islands/terrain-shape';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { damp, hash, smoothstep } from '@/lib/utils/math';
import { Cameras } from './Cameras';
import { Crew } from './Crew';
import { Equipment, Rocks } from './Equipment';
import { Glows } from './Glows';
import { House, HOUSE_BASE } from './House';
import {
  CENTER_X,
  CENTER_Z,
  DOCK_POINT,
  FACE,
  FEATURES,
  HOUSE,
  ISLAND,
  RIFT,
  RIFT_WORLD,
  SHAPE,
  sampler,
  siteToIsland,
} from './layout';
import { Mist } from './Mist';
import { Rift } from './Rift';
import { flicker, staticSignal, tube } from './signal';
import { useStaticDossier } from './static-store';
import { GRASS_PALETTE, staticTerrainMaterial } from './terrain-material';

/**
 * YELLOW STATIC — l'île secrète (racine 3D, coordonnées monde).
 *
 * Une île à l'écart, dans la brume : une vieille maison à deux étages dont la porte a été
 * arrachée par une faille ; derrière, le couloir jaune des Backrooms. Quatre scientifiques
 * en combinaison jaune filment, mesurent et surveillent. Aucun menu ne la mentionne : on la
 * trouve en suivant les traces jaunes au large de l'île PROJETS.
 */

/** Clairières (pas d'herbe) : maison, cour piétinée, rampe, matériel. Repère du site. */
const CLEARINGS: [number, number, number][] = [
  [HOUSE.x, HOUSE.z, 3.15],
  [RIFT.x, RIFT.z + 1.6, 1.9],
  [0, 6.0, 1.2],
  [2.35, 3.3, 1.1],
  [-3.3, -0.15, 0.8],
].map(([x, z, radius]) => {
  const [ix, iz] = siteToIsland(x, z);
  return [ix, iz, radius] as [number, number, number];
});

/** Hauteur du plancher de la maison : la faille s'ouvre à ce niveau. */
const FLOOR_Y = HOUSE_BASE + HOUSE.plinth;

export default function YellowStaticIsland() {
  const island = useRef<Group>(null);
  const clearings = useMemo(() => new ClearingStore(), []);
  const terrain = useMemo(() => buildTerrainGeometry(SHAPE, sampler), []);
  const terrainMaterial = useMemo(() => staticTerrainMaterial(), []);
  const near = useRef(false);

  useEffect(() => () => terrain.dispose(), [terrain]);

  // Une fois par image, avant les décors : apparition, néons, proximité, révélation.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const world = useWorld.getState();
    const group = island.current;
    if (group) {
      const dx = CENTER_X - world.introCenter[0];
      const dz = CENTER_Z - world.introCenter[1];
      const distance = Math.hypot(dx, dz);
      const raw = smoothstep(distance - 4.5, distance, world.introRadius);
      const scale = damp(group.scale.x, raw * (1 + 0.09 * Math.sin(raw * Math.PI) * (1 - raw)), 7.5, dt);
      group.scale.setScalar(scale);
      group.visible = scale > 0.006;
    }

    // Néons et faille : chacun son grésillement, la faille fait tout vaciller.
    const motion = world.reducedMotion ? 0 : 1;
    flicker.motion = motion;
    if (motion) {
      const surge = tube(time, 9.1, 0.12);
      flicker.rift = 0.75 + 0.25 * surge + Math.sin(time * 2.3) * 0.04;
      flicker.standA = tube(time, 1.7) * (0.6 + 0.4 * surge);
      flicker.standB = tube(time, 4.3, 0.1) * (0.6 + 0.4 * surge);
      flicker.window = tube(time * 1.3, 6.6, 0.5);
      flicker.lamp = tube(time, 2.9, 0.3);
      // Bouffées de parasites : quelques dixièmes de seconde, toutes les 4 à 9 s.
      const slot = Math.floor(time / 6.5);
      const phase = time - slot * 6.5 - hash(slot * 3.3) * 3;
      flicker.glitch = phase > 0 && phase < 0.45 ? 1 : surge < 0.5 ? 0.6 : 0;
      // La silhouette : rarement, une seconde, pendant que la lumière baisse.
      const figureSlot = Math.floor(time / 23);
      const figurePhase = time - figureSlot * 23 - 8 - hash(figureSlot * 1.7) * 8;
      const figure = hash(figureSlot * 5.1 + 0.3) > 0.35 && figurePhase > 0 && figurePhase < 1.6 ? 1 : 0;
      flicker.figure = figure * (0.55 + 0.45 * tube(time * 3, 3.3, 0.6));
      if (figure) flicker.rift *= 0.55 + 0.25 * Math.sin(time * 40);
    } else {
      flicker.rift = 0.92;
      flicker.standA = flicker.standB = flicker.window = flicker.lamp = 1;
      flicker.glitch = 0;
      flicker.figure = 0;
    }

    // Proximité du bateau : brume sonore et voile VHS (0 au large → 1 au ponton).
    const boatDistance = Math.hypot(boatState.position.x - CENTER_X, boatState.position.z - CENTER_Z);
    staticSignal.proximity = 1 - smoothstep(ISLAND.radius + 5, ISLAND.influence, boatDistance);

    // L'easter egg : le bateau à moins de ~12 m de la façade ouvre le dossier (une fois par
    // approche ; il faut repartir au large pour qu'il se rouvre tout seul).
    const riftDistance = Math.hypot(boatState.position.x - RIFT_WORLD[0], boatState.position.z - RIFT_WORLD[1]);
    const playing = world.phase === 'playing' || world.phase === 'docked';
    if (playing && riftDistance < 13.8 && !near.current) {
      near.current = true;
      useStaticDossier.getState().reveal('approach');
    } else if (riftDistance > 24) {
      near.current = false;
    }
  }, -1);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    useWorld.getState().sailToPoint(DOCK_POINT);
  };

  return (
    <group
      ref={island}
      position={[CENTER_X, 0, CENTER_Z]}
      scale={0}
      userData={CLEARING_ROOT}
      onClick={onClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <ClearingContext.Provider value={clearings}>
        <mesh geometry={terrain} material={terrainMaterial} castShadow receiveShadow />
        <Grass
          sampler={sampler}
          radius={ISLAND.radius}
          plateau={FEATURES.plateau}
          avoidAngle={ISLAND.dockAngle}
          seed={97 * 41 + 7}
          amount={0.9}
          palette={GRASS_PALETTE}
        />
        {CLEARINGS.map(([x, z, radius], index) => (
          <ClearingAt key={index} x={x} z={z} radius={radius} />
        ))}
        <Rocks />
        <group rotation-y={FACE}>
          <House position={[HOUSE.x, HOUSE_BASE, HOUSE.z]} rotation={0} />
          <Rift position={[RIFT.x, FLOOR_Y, RIFT.z]} />
          <Equipment />
          <Crew />
          <Cameras />
          <Glows />
        </group>
      </ClearingContext.Provider>
      {/* Pas de volume de sélection englobant : il masquerait les caméras cliquables. Le
          relief (jusqu'au haut-fond) et le décor suffisent comme cible. */}
    </group>
  );
}
