'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
import { homeIsland, islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { cameraProgress, cinematicEase, INTRO_ANTICIPATION } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';

const desiredPosition = new Vector3();
const desiredTarget = new Vector3();
const gameplayPosition = new Vector3();
const gameplayTarget = new Vector3();
const introPosition = new Vector3();
const introTarget = new Vector3();
const boundaryPosition = new Vector3();
const boundaryTarget = new Vector3();
const positionPoints = Array.from({ length: 5 }, () => new Vector3());
const targetPoints = Array.from({ length: 5 }, () => new Vector3());
const positionCurve = new CatmullRomCurve3(positionPoints, false, 'centripetal', 0.45);
const targetCurve = new CatmullRomCurve3(targetPoints, false, 'centripetal', 0.45);

function directions() {
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  return { forwardX, forwardZ, sideX: forwardZ, sideZ: -forwardX };
}

function introPose(mobile: boolean, aspect: number) {
  const portrait = aspect < 0.82;
  // Caméra 3/4 plongeante face à l'avant du bateau, le bateau est le sujet,
  // l'îlot n'est qu'un petit décor derrière / sur le côté.
  const bx = boatState.position.x;
  const bz = boatState.position.z;
  const forward = new Vector3(Math.cos(boatState.heading), 0, Math.sin(boatState.heading)).normalize();
  const side = new Vector3(forward.z, 0, -forward.x);
  const dist = portrait ? 30 : mobile ? 27 : 26;
  const sideShift = portrait ? -5.5 : mobile ? -4.5 : -4.0;
  const height = portrait ? 11 : mobile ? 10 : 9.5;
  introPosition.set(
    bx - forward.x * dist + side.x * sideShift,
    height,
    bz - forward.z * dist + side.z * sideShift,
  );
  introTarget.set(bx, 2.2, bz);
}

function gameplayPose(mobile: boolean) {
  const { forwardX, forwardZ } = directions();
  const distance = mobile ? 36 : 30;
  const height = mobile ? 62 : 54;
  gameplayPosition.set(
    boatState.position.x - forwardX * distance,
    height,
    boatState.position.z - forwardZ * distance,
  );
  gameplayTarget.set(
    boatState.position.x + forwardX * 8,
    0.8,
    boatState.position.z + forwardZ * 8,
  );
}

function boundaryPose(mobile: boolean) {
  let dx = ecologyState.monsterX - boatState.position.x;
  let dz = ecologyState.monsterZ - boatState.position.z;
  const length = Math.max(Math.hypot(dx, dz), 0.001);
  dx /= length;
  dz /= length;
  const sideX = -dz;
  const sideZ = dx;
  const midpointX = (boatState.position.x + ecologyState.monsterX) * 0.5;
  const midpointZ = (boatState.position.z + ecologyState.monsterZ) * 0.5;
  const distance = mobile ? 92 : 78;
  boundaryPosition.set(
    midpointX + sideX * distance - dx * 7,
    mobile ? 22 : 18,
    midpointZ + sideZ * distance - dz * 7,
  );
  boundaryTarget.set(midpointX, 12, midpointZ);
}

function updateCinematicCurves() {
  const [cx, cz] = homeIsland.position;
  const bx = boatState.position.x;
  const bz = boatState.position.z;
  const forward = new Vector3(Math.cos(boatState.heading), 0, Math.sin(boatState.heading)).normalize();
  const side = new Vector3(forward.z, 0, -forward.x);

  positionPoints[0].copy(introPosition);
  // Le bateau reste visible longtemps : orbit autour, puis recul en hauteur.
  positionPoints[1].set(
    bx - forward.x * 24 - side.x * 7,
    11,
    bz - forward.z * 24 - side.z * 7,
  );
  positionPoints[2].set(
    bx - forward.x * 29 + side.x * 9,
    14,
    bz - forward.z * 29 + side.z * 9,
  );
  positionPoints[3].set(
    bx - forward.x * 38,
    22,
    bz - forward.z * 38,
  );
  positionPoints[4].copy(gameplayPosition);

  // Target reste d'abord sur le bateau, puis s'élargit vers l'archipel.
  targetPoints[0].set(bx, 2.2, bz);
  targetPoints[1].set(bx + forward.x * 3, 2.0, bz + forward.z * 3);
  targetPoints[2].set((cx + bx) * 0.5, 1.5, (cz + bz) * 0.5);
  targetPoints[3].set(cx * 0.35, 2.0, cz * 0.35);
  targetPoints[4].copy(gameplayTarget);
}

export function CameraRig({ mobile }: { mobile: boolean }) {
  const pointer = useThree((state) => state.pointer);
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1));
  const position = useRef(new Vector3());
  const target = useRef(new Vector3());
  const initialized = useRef(false);

  useFrame((state, delta) => {
    const camera = state.camera;
    const dt = Math.min(delta, 1 / 30);
    const { phase, gameTransition, activeIsland, reducedMotion } = useWorld.getState();
    introPose(mobile, aspect);
    gameplayPose(mobile);
    let lambda = 2.4;

    if (!initialized.current) {
      position.current.copy(introPosition);
      target.current.copy(introTarget);
      initialized.current = true;
    }

    if (phase === 'loading' || phase === 'intro') {
      desiredPosition.copy(introPosition);
      desiredTarget.copy(introTarget);
      // Idle statique : la caméra attend le clic START, aucun mouvement.
      lambda = 1.2;
      if (camera instanceof PerspectiveCamera) {
        const introFov = aspect < 0.82 ? 36 : mobile ? 33 : 30;
        const nextFov = damp(camera.fov, introFov, 4, dt);
        if (Math.abs(nextFov - camera.fov) > 0.001) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }
    } else if (phase === 'transitioning') {
      updateCinematicCurves();
      const t = cameraProgress(gameTransition);
      positionCurve.getPoint(t, desiredPosition);
      targetCurve.getPoint(t, desiredTarget);

      // Petite poussée presque imperceptible pendant l'anticipation.
      if (gameTransition < INTRO_ANTICIPATION) {
        const anticipation = Math.sin(
          smoothstep(0, INTRO_ANTICIPATION, gameTransition) * Math.PI,
        );
        desiredPosition.y += anticipation * 0.13;
      }

      position.current.copy(desiredPosition);
      target.current.copy(desiredTarget);
      camera.position.copy(position.current);
      camera.lookAt(target.current);
      if (camera instanceof PerspectiveCamera) {
        const introFov = aspect < 0.82 ? 36 : mobile ? 33 : 30;
        const fovT = cinematicEase((gameTransition - 0.14) / 0.78);
        const nextFov = introFov + (42 - introFov) * fovT;
        if (Math.abs(camera.fov - nextFov) > 0.001) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }
      return;
    } else if (phase === 'docked' && activeIsland) {
      const island = islandById[activeIsland];
      const zoomOut = mobile ? 1.35 : 1;
      const distance = (island.radius + 26) * zoomOut;
      const dockX = Math.cos(island.dockAngle);
      const dockZ = Math.sin(island.dockAngle);
      desiredPosition.set(
        island.position[0] - dockX * distance * 0.7,
        32 * zoomOut,
        island.position[1] - dockZ * distance * 0.7,
      );
      desiredTarget.set(island.position[0], 2.2, island.position[1]);
      lambda = 1.6;
    } else {
      gameplayPose(mobile);
      desiredPosition.copy(gameplayPosition);
      desiredTarget.copy(gameplayTarget);
      lambda = 2.2 + Math.min(boatState.speed / MAX_SPEED, 1) * 1.2;

      const boundaryBlend = ecologyState.boundaryCinematic;
      if (boundaryBlend > 0.001) {
        boundaryPose(mobile);
        desiredPosition.lerp(boundaryPosition, boundaryBlend);
        desiredTarget.lerp(boundaryTarget, boundaryBlend);
        lambda = 1.35 + boundaryBlend * 0.75;
        const shake = ecologyState.impact * (reducedMotion ? 0.08 : 0.42);
        desiredPosition.x += Math.sin(state.clock.elapsedTime * 31) * shake;
        desiredPosition.y += Math.sin(state.clock.elapsedTime * 37 + 1.7) * shake * 0.7;
      }

      if (!reducedMotion && !mobile && boundaryBlend < 0.05 && (phase === 'playing' || phase === 'docked')) {
        desiredPosition.x += pointer.x * 1.8;
        desiredPosition.y += pointer.y * 0.8;
      }
    }

    position.current.x = damp(position.current.x, desiredPosition.x, lambda, dt);
    position.current.y = damp(position.current.y, desiredPosition.y, lambda, dt);
    position.current.z = damp(position.current.z, desiredPosition.z, lambda, dt);
    target.current.x = damp(target.current.x, desiredTarget.x, lambda, dt);
    target.current.y = damp(target.current.y, desiredTarget.y, lambda, dt);
    target.current.z = damp(target.current.z, desiredTarget.z, lambda, dt);
    camera.position.copy(position.current);
    camera.lookAt(target.current);

    if (camera instanceof PerspectiveCamera) {
      const speedZoom = phase === 'playing' ? Math.min(boatState.speed / MAX_SPEED, 1) * 2.8 : 0;
      const gameplayFov = 42 + speedZoom;
      const boundaryBlend = ecologyState.boundaryCinematic;
      const nextFov = damp(camera.fov, gameplayFov + boundaryBlend * (48 - gameplayFov), 3, dt);
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
