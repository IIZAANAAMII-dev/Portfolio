'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { homeIsland, islands } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { dockPosition, useWorld } from '@/lib/store';
import { clamp, damp, shortestAngle } from '@/lib/utils/math';
import type { Vec2 } from '@/types';

const MAX_SPEED = 9.5;
const ACCELERATION = 3.2;
const TURN_RATE = 1.15; // rad/s
const ARRIVAL_RADIUS = 1.4;
/** Rayon dans lequel le bateau ralentit pour accoster proprement. */
const BRAKING_DISTANCE = 12;

const SOLIDS = [
  { position: homeIsland.position, radius: homeIsland.radius },
  ...islands.map((i) => ({ position: i.position, radius: i.radius })),
];

/** Empêche de cliquer « dans » une île : la cible est repoussée sur le rivage. */
function pushOutOfLand(point: Vec2): Vec2 {
  let [x, z] = point;
  for (const solid of SOLIDS) {
    const dx = x - solid.position[0];
    const dz = z - solid.position[1];
    const distance = Math.hypot(dx, dz);
    const min = solid.radius + 3;
    if (distance < min && distance > 0.001) {
      x = solid.position[0] + (dx / distance) * min;
      z = solid.position[1] + (dz / distance) * min;
    }
  }
  return [clamp(x, -150, 150), clamp(z, -150, 150)];
}

/**
 * Navigation volontairement simple : direction -> rotation limitée -> avance.
 * La courbe naturelle du trajet naît de la limite de rotation, pas d'un pathfinding.
 */
export function useBoatNavigation() {
  const target = useRef<Vec2 | null>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { destination, freeTarget, arrive, reducedMotion } = useWorld.getState();

    target.current = destination
      ? dockPosition(destination)
      : freeTarget
        ? pushOutOfLand(freeTarget)
        : null;

    if (!target.current) {
      boatState.speed = damp(boatState.speed, 0, 2.5, dt);
    } else {
      const dx = target.current[0] - boatState.position.x;
      const dz = target.current[1] - boatState.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance < ARRIVAL_RADIUS) {
        boatState.speed = damp(boatState.speed, 0, 6, dt);
        arrive();
      } else {
        const desiredHeading = Math.atan2(dz, dx);
        const turn = shortestAngle(boatState.heading, desiredHeading);
        const maxTurn = TURN_RATE * dt * (reducedMotion ? 2.5 : 1);
        boatState.heading += clamp(turn, -maxTurn, maxTurn);

        // On n'accélère à fond que si le cap est à peu près bon : le bateau pivote
        // d'abord, puis part. C'est ce qui rend le départ lisible.
        const alignment = clamp(1 - Math.abs(turn) / Math.PI, 0.15, 1);
        const approach = clamp(distance / BRAKING_DISTANCE, 0.12, 1);
        const wanted = MAX_SPEED * alignment * approach * (reducedMotion ? 1.8 : 1);
        boatState.speed = damp(boatState.speed, wanted, ACCELERATION, dt);
      }
    }

    boatState.position.x += Math.cos(boatState.heading) * boatState.speed * dt;
    boatState.position.z += Math.sin(boatState.heading) * boatState.speed * dt;
  });
}
