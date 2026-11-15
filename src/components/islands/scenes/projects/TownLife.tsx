'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type InstancedMesh } from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { Maquette } from './builder';
import { DAIS, ROAD, WALK } from './layout';
import { paint } from './materials';
import { TOP } from './Town';

/**
 * Les habitants : des petits passants font le tour de la place et du trottoir (pas
 * sautillants, demi-tour de temps en temps), d'autres restent plantés devant la bulle
 * d'espace à la regarder tourner. Deux draw calls pour toute la foule.
 */

interface Walker {
  radius: number;
  speed: number;
  phase: number;
  /** 0 : passant ; 1 : spectateur immobile (il se balance un peu). */
  still: number;
}

const PLAZA_RINGS = [DAIS.radius + 0.75, 5.35, 6.05];

function crowd(count: number): Walker[] {
  const list: Walker[] = [];
  for (let index = 0; index < count; index++) {
    const spectator = index < 3;
    const onWalk = !spectator && index % 4 === 3;
    const ring = onWalk ? (ROAD.outer + WALK.outer) / 2 + 0.02 : PLAZA_RINGS[index % PLAZA_RINGS.length];
    list.push({
      radius: spectator ? DAIS.radius + 0.62 : ring,
      speed: spectator ? 0 : (0.16 + hash(index * 2.7) * 0.1) * (index % 2 ? 1 : -1) * (onWalk ? 0.75 : 1),
      phase: spectator ? 2.4 + index * 0.55 : hash(index * 5.3) * Math.PI * 2,
      still: spectator ? 1 : 0,
    });
  }
  return list;
}

const CLOTHES = ['#e2553f', '#2f6fc0', '#ffc83d', '#3fa58b', '#8b6bff', '#f08fb0', '#ffffff', '#ff8a3d', '#5ac8e8', '#7a5236', '#d9483f', '#46a35a'];
const SKIN = ['#f2c9a0', '#d9a77a', '#a8754f', '#f5d6b8', '#7d5233'];

function bodyGeometry() {
  const m = new Maquette();
  m.cylinder(0.12, 0.16, 0.44, [0, 0.42, 0], '#ffffff', 8);
  m.cylinder(0.055, 0.06, 0.22, [-0.06, 0.11, 0], '#3d4350', 6);
  m.cylinder(0.055, 0.06, 0.22, [0.06, 0.11, 0], '#3d4350', 6);
  return m.build();
}

function headGeometry() {
  const m = new Maquette();
  m.sphere(0.135, [0, 0.8, 0], '#ffffff', 1);
  return m.build();
}

export function TownLife() {
  const quality = useWorld((state) => state.quality);
  const count = quality === 'low' ? 8 : 14;
  const walkers = useMemo(() => crowd(count), [count]);
  const bodies = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const geometries = useMemo(() => ({ body: bodyGeometry(), head: headGeometry() }), []);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const body = bodies.current;
    const head = heads.current;
    if (!body || !head) return;
    const color = new Color();
    walkers.forEach((_, index) => {
      body.setColorAt(index, color.set(CLOTHES[(index * 5) % CLOTHES.length]));
      head.setColorAt(index, color.set(SKIN[(index * 3) % SKIN.length]));
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  }, [walkers]);

  useFrame((state) => {
    const body = bodies.current;
    const head = heads.current;
    if (!body || !head) return;
    const t = state.clock.elapsedTime;
    walkers.forEach((walker, index) => {
      let angle = walker.phase;
      let yaw: number;
      let hop = 0;
      if (walker.still) {
        // Spectateur : tourné vers la bulle, se balance d'un pied sur l'autre.
        yaw = Math.atan2(-Math.cos(angle), -Math.sin(angle));
        yaw += Math.sin(t * 0.9 + index) * 0.15;
      } else {
        // Passant : tour de la place, avec une pause et un demi-tour de temps en temps.
        const lap = Math.sin(t * 0.07 + walker.phase) > 0.85 ? 0 : 1;
        angle = walker.phase + t * walker.speed * lap;
        const dir = Math.sign(walker.speed);
        yaw = Math.atan2(-Math.sin(angle) * dir, Math.cos(angle) * dir);
        hop = lap ? Math.abs(Math.sin(t * 7 + index)) * 0.05 : 0;
      }
      const x = Math.cos(angle) * walker.radius;
      const z = Math.sin(angle) * walker.radius;
      dummy.position.set(x, TOP + hop, z);
      dummy.rotation.set(0, yaw, walker.still ? Math.sin(t * 1.3 + index) * 0.04 : Math.sin(t * 7 + index) * 0.05);
      dummy.scale.setScalar(0.92 + hash(index * 1.7) * 0.2);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      head.setMatrixAt(index, dummy.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh key={`b${count}`} ref={bodies} args={[geometries.body, paint, count]} castShadow frustumCulled={false} raycast={() => null} />
      <instancedMesh key={`h${count}`} ref={heads} args={[geometries.head, paint, count]} frustumCulled={false} raycast={() => null} />
    </group>
  );
}
