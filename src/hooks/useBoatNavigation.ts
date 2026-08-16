'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import {
  BOAT_RADIUS,
  computePath,
  nearestSolid,
  pushOutOfLand,
  segmentIsClear,
  SOLIDS,
} from '@/lib/navigation';
import { dockPosition, useWorld } from '@/lib/store';
import { clamp, damp, shortestAngle } from '@/lib/utils/math';
import type { Vec2 } from '@/types';

export const MAX_SPEED = 13.5;
const ACCELERATION = 4.4;
const TURN_RATE = 1.28; // rad/s
const ARRIVAL_RADIUS = 1.4;
/** Rayon dans lequel le bateau ralentit pour accoster proprement. */
const BRAKING_DISTANCE = 16;
/** Un waypoint intermédiaire est « atteint » bien avant : le virage coupe la corde. */
const WAYPOINT_RADIUS = 5.5;
/** Anti-blocage : durée sans progrès réel avant replanification. */
const STUCK_SECONDS = 2.2;

type Plan = {
  key: string;
  waypoints: Vec2[];
  index: number;
};

function targetKey(destination: string | null, freeTarget: Vec2 | null) {
  if (destination) return `island:${destination}`;
  if (freeTarget) return `free:${freeTarget[0].toFixed(1)},${freeTarget[1].toFixed(1)}`;
  return '';
}

/**
 * Navigation maritime en trois couches :
 *  1. planification — waypoints contournant les îles (lib/navigation.ts) ;
 *  2. pilotage — rotation limitée, accélération selon l'alignement, freinage anticipé
 *     avant les virages serrés et à l'approche de la destination ;
 *  3. sécurité — collision cercle/cercle glissante + chien de garde anti-blocage qui
 *     replanifie et écarte le bateau si le trajet ne progresse plus.
 */
export function useBoatNavigation() {
  const plan = useRef<Plan | null>(null);
  const stuckTime = useRef(0);
  const lastProgressPosition = useRef<Vec2>([boatState.position.x, boatState.position.z]);
  const progressTimer = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { destination, freeTarget, arrive, reducedMotion, phase } = useWorld.getState();

    if (phase !== 'playing') {
      boatState.speed = damp(boatState.speed, 0, 5, dt);
      plan.current = null;
      stuckTime.current = 0;
      return;
    }

    // 1 — Planification : ne recalcule le chemin que si la cible change.
    const key = targetKey(destination, freeTarget);
    const goal: Vec2 | null = destination
      ? dockPosition(destination)
      : freeTarget
        ? pushOutOfLand(freeTarget)
        : null;

    if (!goal) {
      plan.current = null;
      boatState.speed = damp(boatState.speed, 0, 2.5, dt);
    } else {
      if (!plan.current || plan.current.key !== key) {
        plan.current = {
          key,
          waypoints: computePath([boatState.position.x, boatState.position.z], goal),
          index: 0,
        };
        stuckTime.current = 0;
        progressTimer.current = 0;
        lastProgressPosition.current = [boatState.position.x, boatState.position.z];
      }

      const route = plan.current;
      const isFinal = route.index >= route.waypoints.length - 1;
      const waypoint = route.waypoints[Math.min(route.index, route.waypoints.length - 1)];
      const dx = waypoint[0] - boatState.position.x;
      const dz = waypoint[1] - boatState.position.z;
      const waypointDistance = Math.hypot(dx, dz);
      const finalGoal = route.waypoints[route.waypoints.length - 1];
      const goalDistance = Math.hypot(
        finalGoal[0] - boatState.position.x,
        finalGoal[1] - boatState.position.z,
      );

      // Passage au waypoint suivant : large rayon pour couper les virages en courbe.
      if (!isFinal && waypointDistance < WAYPOINT_RADIUS) {
        route.index += 1;
      } else if (isFinal && waypointDistance < ARRIVAL_RADIUS) {
        boatState.speed = damp(boatState.speed, 0, 6, dt);
        plan.current = null;
        arrive();
      } else {
        // 2 — Pilotage.
        const desiredHeading = Math.atan2(dz, dx);
        const turn = shortestAngle(boatState.heading, desiredHeading);
        const maxTurn = TURN_RATE * dt * (reducedMotion ? 2.5 : 1);
        boatState.heading += clamp(turn, -maxTurn, maxTurn);

        // Anticipation : si le prochain segment tourne fort, on arrive moins vite.
        let cornerBrake = 1;
        if (!isFinal) {
          const next = route.waypoints[route.index + 1];
          const upcoming = Math.abs(shortestAngle(
            desiredHeading,
            Math.atan2(next[1] - waypoint[1], next[0] - waypoint[0]),
          ));
          const anticipation = clamp(1 - waypointDistance / 24, 0, 1);
          cornerBrake = 1 - clamp(upcoming / Math.PI, 0, 0.6) * anticipation;
        }

        // On n'accélère à fond que si le cap est à peu près bon : le bateau pivote
        // d'abord, puis part. C'est ce qui rend le départ lisible.
        const alignment = clamp(1 - Math.abs(turn) / Math.PI, 0.15, 1);
        const approach = clamp(goalDistance / BRAKING_DISTANCE, 0.12, 1);
        const weatherLoss = 1 - ecologyState.stormWind * 0.14;
        const gust = 1 + Math.sin(state.clock.elapsedTime * 0.73 + boatState.position.z * 0.03)
          * ecologyState.stormWind * 0.07;
        const wanted = MAX_SPEED * alignment * approach * cornerBrake * weatherLoss * gust
          * (1 - ecologyState.boundaryControlLock)
          * (reducedMotion ? 1.8 : 1);
        boatState.speed = damp(boatState.speed, wanted, ACCELERATION, dt);

        // 3 — Chien de garde anti-blocage : mesure le progrès réel (pas la vitesse
        // instantanée) sur une fenêtre glissante. Un bateau qui glisse le long d'une
        // côte sans avancer vers sa cible finit toujours par déclencher un replan.
        progressTimer.current += dt;
        if (progressTimer.current > 0.8) {
          const moved = Math.hypot(
            boatState.position.x - lastProgressPosition.current[0],
            boatState.position.z - lastProgressPosition.current[1],
          );
          if (moved < 1.6 && goalDistance > ARRIVAL_RADIUS * 2) {
            stuckTime.current += progressTimer.current;
          } else {
            stuckTime.current = 0;
          }
          progressTimer.current = 0;
          lastProgressPosition.current = [boatState.position.x, boatState.position.z];
        }

        if (stuckTime.current >= STUCK_SECONDS) {
          // Replanification : on s'écarte d'abord un peu de l'île la plus proche,
          // puis on recalcule un chemin avec une marge légèrement réduite (utile
          // quand la marge normale ne laisse aucun passage depuis cette position).
          const { circle, distance } = nearestSolid(boatState.position.x, boatState.position.z);
          if (distance < BOAT_RADIUS + 3) {
            const away = Math.atan2(boatState.position.z - circle.z, boatState.position.x - circle.x);
            boatState.position.x += Math.cos(away) * 1.6;
            boatState.position.z += Math.sin(away) * 1.6;
            boatState.heading = away;
          }
          plan.current = {
            key,
            waypoints: computePath([boatState.position.x, boatState.position.z], goal, 0.72),
            index: 0,
          };
          stuckTime.current = 0;
        }
      }
    }

    const previousX = boatState.position.x;
    const previousZ = boatState.position.z;
    const freeWeather = ecologyState.stormWind * (1 - ecologyState.boundaryControlLock);
    boatState.heading += Math.sin(state.clock.elapsedTime * 0.81 + boatState.position.x * 0.025)
      * freeWeather * 0.055 * dt;
    boatState.position.x += Math.cos(boatState.heading) * boatState.speed * dt;
    boatState.position.z += Math.sin(boatState.heading) * boatState.speed * dt;
    // Dérive transversale lente : perceptible dans la tempête, jamais assez forte
    // pour retirer le contrôle au joueur avant la reprise cinématique.
    boatState.position.x += 0.28 * freeWeather * dt;
    boatState.position.z -= 0.17 * freeWeather * dt;

    // Collision cercle/cercle glissante : jamais de mesh détaillé pour la physique.
    boatState.collision = damp(boatState.collision, 0, 5, dt);
    for (const solid of SOLIDS) {
      const dx = boatState.position.x - solid.x;
      const dz = boatState.position.z - solid.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = solid.r + BOAT_RADIUS;
      if (distance >= minDistance) continue;

      const nx = distance > 0.001 ? dx / distance : Math.cos(boatState.heading + Math.PI);
      const nz = distance > 0.001 ? dz / distance : Math.sin(boatState.heading + Math.PI);
      const moveX = boatState.position.x - previousX;
      const moveZ = boatState.position.z - previousZ;
      const intoCoast = Math.min(0, moveX * nx + moveZ * nz);

      // Retire uniquement la composante qui entre dans l'île : le bateau glisse le
      // long du rivage au lieu de se téléporter ou de rester brutalement bloqué.
      boatState.position.x -= intoCoast * nx;
      boatState.position.z -= intoCoast * nz;
      const correctedDx = boatState.position.x - solid.x;
      const correctedDz = boatState.position.z - solid.z;
      const correctedDistance = Math.max(Math.hypot(correctedDx, correctedDz), 0.001);
      if (correctedDistance < minDistance) {
        boatState.position.x = solid.x + (correctedDx / correctedDistance) * minDistance;
        boatState.position.z = solid.z + (correctedDz / correctedDistance) * minDistance;
      }
      boatState.speed *= 0.62;
      boatState.collision = Math.max(boatState.collision, 0.65);

      // Un contact signifie que le chemin actuel était mauvais : on replanifie
      // immédiatement au lieu d'annuler la destination du joueur.
      if (plan.current) {
        const goalPoint = plan.current.waypoints[plan.current.waypoints.length - 1];
        if (!segmentIsClear([boatState.position.x, boatState.position.z], goalPoint)) {
          plan.current = {
            key: plan.current.key,
            waypoints: computePath([boatState.position.x, boatState.position.z], goalPoint),
            index: 0,
          };
        }
      }
    }
  });
}
