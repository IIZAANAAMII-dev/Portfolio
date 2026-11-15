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
 * Bouffées opaques à facettes (dessin animé) : aucun tri de transparence. Les dernières
 * instances servent aux volutes de la pipe du patron (même maillage, aucun appel de plus).
 */
const PUFFS = 26;
/** Volutes de pipe : minuscules et lentes, au mouillage ou à petite allure seulement. */
const PIPE = 6;
const PIPE_TINT = new Color('#e9e5de');
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
  const pipe = useRef<Puff[] | null>(null);
  const pipeCursor = useRef(0);
  const pipeTimer = useRef(0);

  useEffect(() => {
    const target = mesh.current;
    if (!target) return;
    for (let index = 0; index < PUFFS + PIPE; index++) target.setColorAt(index, index < PUFFS ? LIGHT : PIPE_TINT);
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
      // Ralenti : une bouffée toutes les 0,6 s ; en route, un panache continu (bouffées jointives).
      timer.current = time + Math.max(0.08, 0.6 - throttle * 0.48 - push * 0.15) * (0.85 + Math.random() * 0.3);
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

    // Pipe : une volute toutes les 1 à 2 s, tant que le patron n'a pas le vent de la course.
    pipe.current ??= Array.from({ length: PIPE }, () => ({ born: -99, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, spin: 0 }));
    const wisps = pipe.current;
    const lit = boatMotion.pipeAt >= 0 && time - boatMotion.pipeAt < 0.5;
    if (running && lit && boatState.speed < 3 && time >= pipeTimer.current) {
      pipeTimer.current = time + 1.1 + Math.random() * 0.9;
      const wisp = wisps[pipeCursor.current];
      pipeCursor.current = (pipeCursor.current + 1) % PIPE;
      wisp.born = time;
      wisp.life = 1.7 + Math.random() * 0.5;
      wisp.x = boatMotion.pipe.x;
      wisp.y = boatMotion.pipe.y + 0.015;
      wisp.z = boatMotion.pipe.z;
      wisp.vx = 0.06 + (Math.random() - 0.5) * 0.06 - Math.cos(boatState.heading) * boatState.speed * 0.1;
      wisp.vy = 0.2 + Math.random() * 0.08;
      wisp.vz = -0.03 + (Math.random() - 0.5) * 0.06 - Math.sin(boatState.heading) * boatState.speed * 0.1;
      wisp.size = 0.02 + Math.random() * 0.01;
      wisp.spin = Math.random() * 6.28;
    }
    for (let index = 0; index < PIPE; index++) {
      const wisp = wisps[index];
      const age = time - wisp.born;
      if (age < 0 || age > wisp.life) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -50, 0);
      } else {
        const t = age / wisp.life;
        const curl = Math.sin(age * 2.6 + wisp.spin) * 0.035 * t;
        dummy.position.set(wisp.x + wisp.vx * age + curl, wisp.y + wisp.vy * age, wisp.z + wisp.vz * age - curl * 0.6);
        dummy.rotation.set(wisp.spin, age * 0.8, 0);
        dummy.scale.setScalar(wisp.size * (1 + t * 2.4) * Math.min(1, age * 6) * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1));
      }
      dummy.updateMatrix();
      target.setMatrixAt(PUFFS + index, dummy.matrix);
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
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS + PIPE]} frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
    </instancedMesh>
  );
}
