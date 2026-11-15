'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderGeometry, Group, SphereGeometry } from 'three';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import { Pieces, pose } from '../../docks/parts';
import { PAINTED } from '../../docks/planks';
import type { LighthouseFrame } from './build';

/**
 * La gardienne du phare : caban bleu marine, bonnet rouge à pompon. Elle fait le tour de
 * la galerie à petits pas, s'arrête pour scruter la mer à la longue-vue… et salue de la
 * main quand le bateau du visiteur est à quai.
 *
 * Repère : origine aux pieds, elle regarde vers +Z.
 */

const NAVY = '#26395c';
const SKIN = '#f1c6a0';

function keeperGeometries() {
  const body = new Pieces();
  body.add(new CylinderGeometry(0.15, 0.2, 0.5, 9), NAVY, pose([0, 0.62, 0]), 0.1);
  body.add(new SphereGeometry(0.15, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), NAVY, pose([0, 0.86, 0]), 0.1);
  for (const y of [0.5, 0.62, 0.74]) {
    for (const side of [-1, 1]) body.add(new SphereGeometry(0.016, 5, 4), '#e2b04a', pose([side * 0.06, y, 0.17 - (y - 0.5) * 0.08]));
  }
  body.add(new SphereGeometry(0.13, 12, 9), SKIN, pose([0, 1.03, 0]));
  body.add(new SphereGeometry(0.026, 6, 4), '#e8907a', pose([0, 1.02, 0.125]));
  for (const side of [-1, 1]) {
    body.add(new SphereGeometry(0.017, 5, 4), '#2a221d', pose([side * 0.045, 1.06, 0.11]));
    body.add(new SphereGeometry(0.026, 5, 4), '#f0a49a', pose([side * 0.078, 1.0, 0.09], [0, 0, 0], [1, 0.7, 0.5]));
  }
  // Bonnet rouge côtelé et son pompon, écharpe jaune.
  body.add(new SphereGeometry(0.14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c8453a', pose([0, 1.07, -0.005], [-0.1, 0, 0], [1, 1.05, 1]), 0.1);
  body.add(new CylinderGeometry(0.142, 0.142, 0.05, 12), '#a8382f', pose([0, 1.075, 0], [-0.1, 0, 0]));
  body.add(new SphereGeometry(0.05, 7, 5), '#f4efe6', pose([0, 1.23, -0.03]));
  body.add(new CylinderGeometry(0.13, 0.15, 0.07, 10), '#f2c14e', pose([0, 0.9, 0]), 0.1);

  const leg = new Pieces();
  leg.add(new CylinderGeometry(0.055, 0.06, 0.36, 6), '#3a3f47', pose([0, -0.18, 0]));
  leg.add(new SphereGeometry(0.065, 7, 4), '#2b2523', pose([0, -0.37, 0.04], [0, 0, 0], [1, 0.6, 1.5]));

  const arm = new Pieces();
  arm.add(new CylinderGeometry(0.05, 0.045, 0.36, 6), NAVY, pose([0, -0.18, 0]), 0.08);
  arm.add(new SphereGeometry(0.048, 7, 5), SKIN, pose([0, -0.38, 0]));

  // Bras droit avec la longue-vue en laiton.
  const scope = new Pieces();
  scope.add(new CylinderGeometry(0.05, 0.045, 0.36, 6), NAVY, pose([0, -0.18, 0]), 0.08);
  scope.add(new SphereGeometry(0.048, 7, 5), SKIN, pose([0, -0.38, 0]));
  scope.add(new CylinderGeometry(0.03, 0.04, 0.34, 8), '#d9a441', pose([0, -0.55, 0.03]));
  scope.add(new CylinderGeometry(0.046, 0.046, 0.04, 8), '#8a6a2a', pose([0, -0.71, 0.03]));

  return { body: body.build()!, leg: leg.build()!, arm: arm.build()!, scope: scope.build()! };
}

/** Cycle : marche, pause (longue-vue ou salut), marche… (secondes). */
const WALK = 7;
const PAUSE = 3.6;

export function Keeper({ frame, islandX, islandZ }: { frame: LighthouseFrame; islandX: number; islandZ: number }) {
  const geometries = useMemo(() => keeperGeometries(), []);
  const root = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const state = useRef({ angle: 0.6, facing: 0 });

  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame((three, delta) => {
    const target = root.current;
    if (!target) return;
    const dt = Math.min(delta, 1 / 30);
    const time = three.clock.elapsedTime;
    const s = state.current;
    const phase = time % (WALK + PAUSE);
    const walking = phase < WALK;
    const radius = 0.96;
    if (walking) s.angle += dt * 0.26;
    const x = frame.x + Math.cos(s.angle) * radius;
    const z = frame.z + Math.sin(s.angle) * radius;
    // En marchant : face à la tangente. À l'arrêt : vers le bateau s'il est à quai ici,
    // sinon vers le large.
    const docked = useWorld.getState().activeIsland === 'contact';
    let facing = Math.atan2(-Math.sin(s.angle), Math.cos(s.angle));
    if (!walking) {
      facing = docked
        ? Math.atan2(boatState.position.x - islandX - x, boatState.position.z - islandZ - z)
        : Math.atan2(Math.cos(s.angle), Math.sin(s.angle));
    }
    let delta2 = facing - s.facing;
    delta2 = Math.atan2(Math.sin(delta2), Math.cos(delta2));
    s.facing = damp(s.facing, s.facing + delta2, 5, dt);
    const step = walking ? Math.sin(time * 6.5) : 0;
    target.position.set(x, frame.galleryTop + Math.abs(step) * 0.025, z);
    target.rotation.set(0, s.facing, walking ? step * 0.04 : 0);
    legs.current.forEach((leg, index) => {
      if (leg) leg.rotation.x = step * 0.45 * (index === 0 ? 1 : -1);
    });
    const pause = walking ? 0 : Math.min(1, (phase - WALK) / 0.5) * Math.min(1, (WALK + PAUSE - phase) / 0.5);
    if (left.current) {
      // Salut de la main (à quai) : bras levé qui s'agite.
      const waving = docked ? pause : 0;
      left.current.rotation.set(-step * 0.35 - waving * 2.6, 0, 0.12 + waving * (0.5 + Math.sin(time * 9) * 0.35));
    }
    if (right.current) {
      // Longue-vue à l'œil (au large), sinon bras qui balance.
      const looking = docked ? 0 : pause;
      right.current.rotation.set(step * 0.35 - looking * 1.45, 0, -0.12 - looking * 0.2);
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={geometries.body} material={PAINTED} castShadow raycast={() => null} />
      {[-1, 1].map((side, index) => (
        <group
          key={side}
          ref={(element) => {
            legs.current[index] = element;
          }}
          position={[side * 0.08, 0.4, 0]}
        >
          <mesh geometry={geometries.leg} material={PAINTED} raycast={() => null} />
        </group>
      ))}
      <group ref={left} position={[0.2, 0.84, 0]}>
        <mesh geometry={geometries.arm} material={PAINTED} raycast={() => null} />
      </group>
      <group ref={right} position={[-0.2, 0.84, 0]}>
        <mesh geometry={geometries.scope} material={PAINTED} raycast={() => null} />
      </group>
    </group>
  );
}
