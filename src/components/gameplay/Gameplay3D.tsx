'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { probe } from './bridge';
import { APPROACH_RANGE, FISHING_RANGE, STOP_SPEED, clockNow, nearestSpot } from './fishing-data';
import { FishingGear } from './FishingGear';
import { FishingSpots } from './FishingSpots';
import { GameplayCamera } from './GameplayCamera';
import { MARKS, START_RANGE, useRegatta } from './regatta';
import { Regatta } from './Regatta';
import { SeaFx } from './SeaFx';
import { useGameplay } from './store';

/**
 * Boucle du gameplay : avance la partie de pêche (horodatages) et dit à l'interface si le
 * bateau est arrêté sur un coin de pêche (avec hystérésis : un bateau qui dérive à peine ne
 * fait pas clignoter le bouton), ou s'il en passe à proximité.
 */
function GameplayLoop() {
  useFrame(() => {
    const game = useGameplay.getState();
    game.tick(clockNow());
    const world = useWorld.getState();
    const { index, distance } = nearestSpot(boatState.position.x, boatState.position.z);
    const playing = world.phase === 'playing';
    const sailing = world.destination !== null || world.freeTarget !== null;
    const slow = boatState.speed < (game.near >= 0 ? 1.6 : STOP_SPEED);
    game.setNear(playing && !sailing && slow && distance < FISHING_RANGE ? index : -1);
    game.setApproach(playing && distance < APPROACH_RANGE ? index : -1);
    // Le viseur se range si le bateau accoste (la page de l'île s'ouvre).
    if (world.phase === 'docked' && game.photo === 'aim') game.closePhoto();

    // Régate : passages de marques, proposition au départ, abandon si l'on accoste.
    const race = useRegatta.getState();
    race.tick(clockNow());
    if (world.phase === 'docked' && (race.phase === 'armed' || race.phase === 'racing')) race.abort();
    const [sx, sz] = MARKS[0];
    race.setNearStart(
      playing && race.phase === 'off' && Math.hypot(boatState.position.x - sx, boatState.position.z - sz) < START_RANGE,
    );
  });
  return null;
}

/** Gameplay dans la scène : coins de pêche, matériel, éclaboussures, regard et chambre noire. */
export default function Gameplay3D() {
  useEffect(() => {
    probe.live = true;
    useGameplay.getState().set3D(true);
    // Tests et captures (développement seulement), comme `__world` et `__boat`.
    if (process.env.NODE_ENV !== 'production') (window as unknown as Record<string, unknown>).__gameplay = useGameplay;
    return () => {
      probe.live = false;
      useGameplay.getState().set3D(false);
    };
  }, []);

  return (
    <>
      <FishingSpots />
      <SeaFx />
      <GameplayLoop />
      <FishingGear />
      <Regatta />
      <GameplayCamera />
    </>
  );
}
