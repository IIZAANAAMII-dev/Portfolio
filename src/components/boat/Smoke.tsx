'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { boatMotion } from './motion';

/**
 * Fumée de la cheminée, en coordonnées monde : une bouffée émise reste dans l'air et dérive
 * avec le vent, si bien qu'un panache s'étire derrière le bateau en route. Ralenti paisible
 * au mouillage, cadence serrée en route, bouffées sombres quand le patron remet les gaz.
 * Bouffées opaques à facettes (dessin animé) : aucun tri de transparence.
 */
const PUFFS = 26;
const dummy = new Object3D();
const tip = new Vector3();
const LIGHT = new Color('#f1eee8');
const DARK = new Color('#5d5a57');
const tint = new Color();

type Puff = { born: number; life: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; spin: number };

export function StackSmoke({ anchor }: { anchor: RefObject<Object3D | null> }) {
  const mesh = useRef<InstancedMesh>(null);
  const puffs = useRef<Puff[] | null>(null);
  const cursor = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    for (let index = 0; index < PUFFS; index++) target.setColorAt(index, LIGHT);
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const target = mesh.current;
    const stack = anchor.current;
    if (!target || !stack) return;
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    target.visible = phase !== 'loading' && phase !== 'intro';
    if (!target.visible) return;
    puffs.current ??= Array.from({ length: PUFFS }, () => ({ born: -99, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, spin: 0 }));
    const list = puffs.current;
    const running = phase === 'playing' || phase === 'docked' || (phase === 'transitioning' && boatMotion.splashAt >= 0);
    const throttle = boatMotion.throttle;
    const push = Math.min(Math.max(boatMotion.accel / 6, 0), 1);

    // Cadence sur l'horloge (comme l'âge des bouffées) : même rythme quel que soit le FPS.
    if (running && time >= timer.current) {
      timer.current = time + Math.max(0.09, 0.7 - throttle * 0.4 - push * 0.2) * (0.85 + Math.random() * 0.3);
      stack.getWorldPosition(tip);
      const index = cursor.current;
      cursor.current = (index + 1) % PUFFS;
      const puff = list[index];
      const forwardX = Math.cos(boatState.heading);
      const forwardZ = Math.sin(boatState.heading);
      puff.born = time;
      puff.life = 2.7 - throttle * 0.9 + Math.random() * 0.4;
      puff.x = tip.x;
      puff.y = tip.y + 0.05;
      puff.z = tip.z;
      // Montée, petite brise constante, et une part de l'élan du bateau (la bouffée « traîne »).
      puff.vx = 0.32 + forwardX * boatState.speed * 0.12 + (Math.random() - 0.5) * 0.18;
      puff.vy = 0.85 + push * 0.9 + Math.random() * 0.3;
      puff.vz = -0.18 + forwardZ * boatState.speed * 0.12 + (Math.random() - 0.5) * 0.18;
      puff.size = 0.11 + throttle * 0.05 + push * 0.09;
      puff.spin = Math.random() * 6.28;
      target.setColorAt(index, tint.copy(LIGHT).lerp(DARK, push * 0.8));
      if (target.instanceColor) target.instanceColor.needsUpdate = true;
    }

    for (let index = 0; index < PUFFS; index++) {
      const puff = list[index];
      const age = time - puff.born;
      if (age < 0 || age > puff.life) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -50, 0);
      } else {
        const t = age / puff.life;
        // Elle naît d'un « pop », gonfle, ralentit en montant puis se dissout en rapetissant.
        const pop = Math.min(1, age * 7);
        const fade = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
        dummy.position.set(
          puff.x + puff.vx * age,
          puff.y + puff.vy * age * (1 - t * 0.35),
          puff.z + puff.vz * age,
        );
        dummy.rotation.set(puff.spin, puff.spin * 0.6 + age * 0.5, 0);
        dummy.scale.setScalar(puff.size * (1 + t * 3) * pop * fade);
      }
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS]} frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
    </instancedMesh>
  );
}
