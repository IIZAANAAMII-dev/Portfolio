'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { waveHeight } from '@/lib/waves';
import { DROP_GEOMETRY, DROP_MATERIAL, RING_GEOMETRY, RING_MATERIAL } from './models';

/**
 * Éclaboussures du gameplay : ronds dans l'eau (écume qui s'élargit) et gouttelettes
 * projetées. Deux réserves fixes d'instances, recyclées : la scène appelle
 * `seaFx.splash(...)` sans rien allouer, un seul composant les anime.
 */

const RINGS = 28;
const DROPS = 72;
const GRAVITY = 9.8;

interface Ring {
  start: number;
  x: number;
  z: number;
  size: number;
  life: number;
  strength: number;
}

interface Drop {
  start: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

const rings: Ring[] = Array.from({ length: RINGS }, () => ({ start: -99, x: 0, z: 0, size: 1, life: 1, strength: 0 }));
const drops: Drop[] = Array.from({ length: DROPS }, () => ({ start: -99, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1 }));
let ringCursor = 0;
let dropCursor = 0;
/** Horloge de la scène (secondes), recopiée à chaque image : les appels n'ont pas à la fournir. */
let clock = 0;
let busyUntil = -1;

export const seaFx = {
  /** Un rond d'écume qui s'élargit jusqu'à `size` mètres en `life` secondes. */
  ring(x: number, z: number, size = 1.6, life = 1.1, strength = 1) {
    const ring = rings[ringCursor];
    ringCursor = (ringCursor + 1) % RINGS;
    ring.start = clock;
    ring.x = x;
    ring.z = z;
    ring.size = size;
    ring.life = life;
    ring.strength = strength;
    busyUntil = Math.max(busyUntil, clock + life);
  },
  /** Éclaboussure : un ou deux ronds et une gerbe de gouttelettes. */
  splash(x: number, z: number, strength = 1, y?: number) {
    const surface = y ?? waveHeight(x, z, clock);
    seaFx.ring(x, z, 0.9 + strength * 1.6, 0.9 + strength * 0.5, 0.6 + strength * 0.5);
    if (strength > 0.45) seaFx.ring(x, z, 0.5 + strength * 0.9, 0.6 + strength * 0.4, 0.5);
    const count = Math.round(4 + strength * 10);
    for (let index = 0; index < count; index++) {
      const drop = drops[dropCursor];
      dropCursor = (dropCursor + 1) % DROPS;
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.6;
      const spread = (0.6 + Math.random() * 1.1) * (0.6 + strength * 0.5);
      drop.start = clock;
      drop.x = x;
      drop.y = surface + 0.05;
      drop.z = z;
      drop.vx = Math.cos(angle) * spread;
      drop.vz = Math.sin(angle) * spread;
      drop.vy = (2.4 + Math.random() * 2.2) * (0.55 + strength * 0.55);
      drop.size = 0.05 + Math.random() * 0.06 + strength * 0.03;
    }
    busyUntil = Math.max(busyUntil, clock + 2.2);
  },
};

const dummy = new Object3D();
const fade = new Color();

export function SeaFx() {
  const ringMesh = useRef<InstancedMesh>(null);
  const dropMesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ringMesh.current;
    if (!mesh) return;
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    fade.setRGB(0, 0, 0);
    for (let index = 0; index < RINGS; index++) {
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, fade);
    }
    const drop = dropMesh.current;
    if (drop) for (let index = 0; index < DROPS; index++) drop.setMatrixAt(index, dummy.matrix);
  }, []);

  useFrame((state) => {
    clock = state.clock.elapsedTime;
    const ringsMesh = ringMesh.current;
    const dropsMesh = dropMesh.current;
    if (!ringsMesh || !dropsMesh) return;
    // Rien en cours : on laisse les instances éteintes sans les réécrire.
    if (clock > busyUntil + 0.1) {
      ringsMesh.visible = false;
      dropsMesh.visible = false;
      return;
    }
    ringsMesh.visible = true;
    dropsMesh.visible = true;

    for (let index = 0; index < RINGS; index++) {
      const ring = rings[index];
      const age = (clock - ring.start) / ring.life;
      if (age < 0 || age >= 1) {
        dummy.scale.setScalar(0);
        fade.setRGB(0, 0, 0);
      } else {
        const grow = 1 - (1 - age) * (1 - age);
        dummy.position.set(ring.x, waveHeight(ring.x, ring.z, clock) + 0.14, ring.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(ring.size * (0.22 + grow * 0.78), 1, ring.size * (0.22 + grow * 0.78));
        const light = ring.strength * (1 - age) * (1 - age) * Math.min(1, age * 10);
        fade.setRGB(light, light, light);
      }
      dummy.updateMatrix();
      ringsMesh.setMatrixAt(index, dummy.matrix);
      ringsMesh.setColorAt(index, fade);
    }
    ringsMesh.instanceMatrix.needsUpdate = true;
    if (ringsMesh.instanceColor) ringsMesh.instanceColor.needsUpdate = true;

    for (let index = 0; index < DROPS; index++) {
      const drop = drops[index];
      const age = clock - drop.start;
      const y = drop.y + drop.vy * age - 0.5 * GRAVITY * age * age;
      if (age < 0 || age > 1.6 || (age > 0.1 && y < drop.y - 0.2)) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(drop.x + drop.vx * age, y, drop.z + drop.vz * age);
        dummy.scale.setScalar(drop.size * (1 - age * 0.35));
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dropsMesh.setMatrixAt(index, dummy.matrix);
    }
    dropsMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={ringMesh}
        args={[RING_GEOMETRY, RING_MATERIAL, RINGS]}
        frustumCulled={false}
        renderOrder={6}
        raycast={() => null}
      />
      <instancedMesh
        ref={dropMesh}
        args={[DROP_GEOMETRY, DROP_MATERIAL, DROPS]}
        frustumCulled={false}
        renderOrder={7}
        raycast={() => null}
      />
    </>
  );
}
