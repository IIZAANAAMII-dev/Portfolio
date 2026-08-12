'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';

/** Cadrage d'ouverture : proche, bas, presque intime. */
const INTRO_POSITION = new Vector3(12.4, 4.2, -15.6);
const INTRO_TARGET = new Vector3(3.4, 2.2, -4.6);

/** Plan large final de la révélation. */
const OVERVIEW_POSITION = new Vector3(6, 112, 138);
const OVERVIEW_TARGET = new Vector3(0, 0, -4);

/** Suivi en navigation, exprimé en décalage monde (pas relatif au cap : moins nauséeux). */
const FOLLOW_OFFSET = new Vector3(2, 27, 36);

// Vecteurs de travail réutilisés à chaque frame : il n'existe qu'un seul rig,
// et allouer deux Vector3 soixante fois par seconde n'a aucun intérêt.
const desiredPosition = new Vector3();
const desiredTarget = new Vector3();

export function CameraRig({ mobile }: { mobile: boolean }) {
  const camera = useThree((state) => state.camera);
  const pointer = useThree((state) => state.pointer);

  const position = useRef(INTRO_POSITION.clone());
  const target = useRef(INTRO_TARGET.clone());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { phase, reveal, activeIsland, reducedMotion } = useWorld.getState();
    const zoomOut = mobile ? 1.35 : 1;

    let lambda = 2.2;

    if (phase === 'loading' || phase === 'intro') {
      desiredPosition.copy(INTRO_POSITION);
      desiredTarget.copy(INTRO_TARGET);
      lambda = 1.2;
    } else if (phase === 'reveal') {
      // La caméra atteint le plan large avant la fin de la timeline : le dernier
      // instant sert à laisser respirer l'image.
      const t = smoothstep(0, 0.86, reveal);
      desiredPosition.copy(INTRO_POSITION).lerp(OVERVIEW_POSITION, t);
      desiredTarget.copy(INTRO_TARGET).lerp(OVERVIEW_TARGET, t);
      lambda = 3.5;
    } else if (phase === 'docked' && activeIsland) {
      const island = islandById[activeIsland];
      const distance = (island.radius + 26) * zoomOut;
      desiredPosition.set(
        island.position[0] + Math.cos(island.cameraAngle) * distance,
        island.elevation + 18 * zoomOut,
        island.position[1] + Math.sin(island.cameraAngle) * distance,
      );
      desiredTarget.set(island.position[0], island.elevation * 0.5, island.position[1]);
      lambda = 1.8;
    } else {
      desiredPosition.copy(boatState.position).addScaledVector(FOLLOW_OFFSET, zoomOut);
      desiredTarget.copy(boatState.position).setY(1.8);
      // On se recale plus vite quand le bateau accélère, sinon il sort du cadre.
      lambda = 1.5 + Math.min(boatState.speed / 9.5, 1) * 1.2;
    }

    // Parallaxe : quelques degrés seulement, jamais pendant une transition.
    if (!reducedMotion && !mobile && (phase === 'sailing' || phase === 'docked')) {
      desiredPosition.x += pointer.x * 4;
      desiredPosition.y += pointer.y * 2;
    }

    position.current.x = damp(position.current.x, desiredPosition.x, lambda, dt);
    position.current.y = damp(position.current.y, desiredPosition.y, lambda, dt);
    position.current.z = damp(position.current.z, desiredPosition.z, lambda, dt);
    target.current.x = damp(target.current.x, desiredTarget.x, lambda * 1.2, dt);
    target.current.y = damp(target.current.y, desiredTarget.y, lambda * 1.2, dt);
    target.current.z = damp(target.current.z, desiredTarget.z, lambda * 1.2, dt);

    camera.position.copy(position.current);
    camera.lookAt(target.current);
  });

  return null;
}
