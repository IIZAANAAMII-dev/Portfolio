'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { homeIsland } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { HintBuoys } from './Buoys';
import { HarborCat } from './Cat';
import { Fisherman } from './Fisherman';

/**
 * Vie du port et de la mer (coordonnées du monde) : au port de départ, un vieux pêcheur
 * assis au bord du ponton et son chat roux qui surveille le bouchon ; au large, cinq
 * bouées bavardes qui soufflent des indices.
 */

const { position: home, radius, dockAngle } = homeIsland;
/** Bout du ponton du port de départ (même valeur que HomeIsland). */
const DOCK_END = radius + 4.35;
const COS = Math.cos(dockAngle);
const SIN = Math.sin(dockAngle);

/** Repère du ponton (x le long du ponton, z en travers) → monde. */
function onDock(x: number, z: number, y = 0): [number, number, number] {
  return [home[0] + x * COS - z * SIN, y, home[1] + x * SIN + z * COS];
}

/** Lacet d'un personnage qui regarde dans la direction (dx, dz) du repère du ponton. */
function facing(dx: number, dz: number) {
  return Math.atan2(dx * COS - dz * SIN, dx * SIN + dz * COS);
}

const DECK_TOP = 0.79;
const FISHERMAN = onDock(DOCK_END - 3.6, -1.0, DECK_TOP);
const FLOAT = onDock(DOCK_END - 3.3, -4.7);
const CAT = onDock(DOCK_END - 2.25, -0.55, DECK_TOP);

/** Le port de départ surgit avec l'îlot au passage de l'onde d'intro (même rythme). */
function HomeHarbor() {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const target = group.current;
    if (!target) return;
    const { introCenter, introRadius } = useWorld.getState();
    const d = Math.hypot(home[0] - introCenter[0], home[1] - introCenter[1]);
    const raw = smoothstep(d - 4.5, d, introRadius);
    const goal = raw * (1 + 0.09 * Math.sin(raw * Math.PI) * (1 - raw));
    const scale = damp(target.scale.x, goal, 7.5, Math.min(delta, 1 / 30));
    target.scale.setScalar(scale);
    target.visible = scale > 0.006;
  });
  return (
    <group ref={group} position={[home[0], 0, home[1]]} scale={0} visible={false}>
      <group position={[-home[0], 0, -home[1]]}>
        <Fisherman position={FISHERMAN} yaw={facing(0, -1)} water={[FLOAT[0], FLOAT[2]]} />
        <HarborCat position={CAT} yaw={facing(0.45, -0.9)} />
      </group>
    </group>
  );
}

export default function HarborLife() {
  return (
    <>
      <HomeHarbor />
      <HintBuoys />
    </>
  );
}
