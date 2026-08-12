'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';

// L'intro isole le bateau : vue plongeante, cadrage serré, îles hors champ.
const INTRO_POSITION = new Vector3(4, 38, -8);
const INTRO_TARGET = new Vector3(boatState.position.x, 0.8, boatState.position.z);
const desiredPosition = new Vector3();
const desiredTarget = new Vector3();
const gameplayPosition = new Vector3();
const gameplayTarget = new Vector3();

function gameplayPose(mobile: boolean) {
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
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

export function CameraRig({ mobile }: { mobile: boolean }) {
  const pointer = useThree((state) => state.pointer);
  const position = useRef(INTRO_POSITION.clone());
  const target = useRef(INTRO_TARGET.clone());

  useFrame((state, delta) => {
    const camera = state.camera;
    const dt = Math.min(delta, 1 / 30);
    const { phase, gameTransition, activeIsland, reducedMotion } = useWorld.getState();
    gameplayPose(mobile);
    let lambda = 2.4;

    if (phase === 'loading' || phase === 'intro') {
      desiredPosition.copy(INTRO_POSITION);
      desiredTarget.copy(INTRO_TARGET);
      lambda = 1.4;
      if (camera instanceof PerspectiveCamera) {
        camera.fov = damp(camera.fov, 34, 4, dt);
        camera.updateProjectionMatrix();
      }
    } else if (phase === 'transitioning') {
      const t = smoothstep(0, 1, gameTransition);
      desiredPosition.copy(INTRO_POSITION).lerp(gameplayPosition, t);
      desiredTarget.copy(INTRO_TARGET).lerp(gameplayTarget, t);
      // Interpolation exacte, sans ressort : à t=1, la pose est strictement celle que
      // le rig calculera à la première frame de gameplay.
      position.current.copy(desiredPosition);
      target.current.copy(desiredTarget);
      camera.position.copy(position.current);
      camera.lookAt(target.current);
      if (camera instanceof PerspectiveCamera) {
        camera.fov = 42;
        camera.updateProjectionMatrix();
      }
      return;
    } else if (phase === 'docked' && activeIsland) {
      const island = islandById[activeIsland];
      const zoomOut = mobile ? 1.35 : 1;
      const distance = (island.radius + 26) * zoomOut;
      desiredPosition.set(
        island.position[0] + Math.cos(island.cameraAngle) * distance,
        island.elevation + 18 * zoomOut,
        island.position[1] + Math.sin(island.cameraAngle) * distance,
      );
      desiredTarget.set(island.position[0], island.elevation * 0.5, island.position[1]);
      lambda = 2;
    } else {
      desiredPosition.copy(gameplayPosition);
      desiredTarget.copy(gameplayTarget);
      lambda = 2.2 + Math.min(boatState.speed / MAX_SPEED, 1) * 1.2;
    }

    if (!reducedMotion && !mobile && (phase === 'playing' || phase === 'docked')) {
      desiredPosition.x += pointer.x * 1.8;
      desiredPosition.y += pointer.y * 0.8;
    }

    position.current.x = damp(position.current.x, desiredPosition.x, lambda, dt);
    position.current.y = damp(position.current.y, desiredPosition.y, lambda, dt);
    position.current.z = damp(position.current.z, desiredPosition.z, lambda, dt);
    target.current.x = damp(target.current.x, desiredTarget.x, lambda * 1.15, dt);
    target.current.y = damp(target.current.y, desiredTarget.y, lambda * 1.15, dt);
    target.current.z = damp(target.current.z, desiredTarget.z, lambda * 1.15, dt);

    camera.position.copy(position.current);
    camera.lookAt(target.current);

    if (camera instanceof PerspectiveCamera) {
      const speedZoom = phase === 'playing' ? Math.min(boatState.speed / MAX_SPEED, 1) * 2.8 : 0;
      camera.fov = damp(camera.fov, 42 + speedZoom, 3, dt);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
