'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, LatheGeometry, Vector2 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { waveHeight } from '@/lib/waves';
import { ripple } from './Flotsam';

/**
 * Bouteille à la mer : lancée depuis le bateau quand le visiteur écrit à Kyliann. Elle
 * décrit un arc en tournoyant, plonge avec un « plouf », puis s'éloigne au gré des vagues.
 */

/** Demande de lancer, posée par l'interface (hors React), lue par la scène. */
export const bottleThrow = { requested: false };

const FLIGHT = 1.15;
const DRIFT = 26;

function bottleProfile() {
  // Profil tourné : fond, panse, épaule, goulot.
  const points = [
    [0.0, 0.0], [0.26, 0.0], [0.3, 0.06], [0.31, 0.62], [0.27, 0.78], [0.14, 0.9],
    [0.1, 0.98], [0.1, 1.16], [0.12, 1.2], [0.12, 1.24], [0.0, 1.24],
  ];
  return new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), 20);
}

export function MessageBottle() {
  const group = useRef<Group>(null);
  const flight = useRef({ start: -100, fromX: 0, fromZ: 0, toX: 0, toZ: 0, dirX: 1, dirZ: 0, splashed: false });
  const glass = useMemo(() => bottleProfile(), []);

  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    const f = flight.current;
    if (bottleThrow.requested) {
      bottleThrow.requested = false;
      // Lancer vers le large, sur le flanc du bateau.
      const side = boatState.heading - Math.PI / 2;
      f.start = time;
      f.fromX = boatState.position.x;
      f.fromZ = boatState.position.z;
      f.dirX = Math.cos(side);
      f.dirZ = Math.sin(side);
      f.toX = f.fromX + f.dirX * 10;
      f.toZ = f.fromZ + f.dirZ * 10;
      f.splashed = false;
    }
    const age = time - f.start;
    target.visible = age >= 0 && age < FLIGHT + DRIFT;
    if (!target.visible) return;

    if (age < FLIGHT) {
      // Vol : parabole, la bouteille tournoie.
      const k = age / FLIGHT;
      const x = f.fromX + (f.toX - f.fromX) * k;
      const z = f.fromZ + (f.toZ - f.fromZ) * k;
      target.position.set(x, 2.4 + Math.sin(k * Math.PI) * 4.2 - k * 2.2, z);
      target.rotation.set(age * 7, age * 2, age * 4);
      target.scale.setScalar(1.2);
      return;
    }
    if (!f.splashed) {
      f.splashed = true;
      ripple(f.toX, f.toZ, time, 1.4);
      ambience.bump('soft', 0.8);
    }
    // Dérive : elle flotte couchée, ballottée, et s'éloigne vers l'horizon.
    const drift = age - FLIGHT;
    const x = f.toX + f.dirX * drift * 1.3;
    const z = f.toZ + f.dirZ * drift * 1.3;
    const wave = waveHeight(x, z, time);
    target.position.set(x, wave + 0.05 + Math.sin(time * 2.1) * 0.06, z);
    target.rotation.set(Math.PI / 2 - 0.25 + Math.sin(time * 1.7) * 0.12, Math.atan2(f.dirX, f.dirZ), Math.sin(time * 1.3) * 0.2);
    target.scale.setScalar(1.2 * Math.min(1, (DRIFT - drift) / 4));
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={glass} castShadow>
        <meshStandardMaterial color="#7ec9ad" transparent opacity={0.62} roughness={0.12} metalness={0.1} emissive="#2d6b58" emissiveIntensity={0.25} />
      </mesh>
      {/* Parchemin roulé, visible à travers le verre, et bouchon de liège. */}
      <mesh position-y={0.4}>
        <cylinderGeometry args={[0.13, 0.13, 0.55, 10]} />
        <meshStandardMaterial color="#f3e6c4" roughness={0.9} />
      </mesh>
      <mesh position-y={1.3}>
        <cylinderGeometry args={[0.11, 0.095, 0.16, 10]} />
        <meshStandardMaterial color="#a57a4c" roughness={0.95} />
      </mesh>
    </group>
  );
}
