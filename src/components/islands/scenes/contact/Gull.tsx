'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeGeometry, CylinderGeometry, Group, SphereGeometry } from 'three';
import { Pieces, pose, type Vec3 } from '../../docks/parts';
import { PAINTED } from '../../docks/planks';

/**
 * Goéland perché (sur la lanterne du bout de la jetée) : il dodeline, tourne la tête par
 * à-coups, comme un vrai, et ébouriffe parfois ses ailes.
 */

function gullGeometries() {
  const body = new Pieces();
  body.add(new SphereGeometry(0.16, 10, 7), '#f6f4ef', pose([0, 0.2, 0], [0.25, 0, 0], [0.85, 0.8, 1.35]));
  for (const side of [-1, 1]) {
    // Ailes repliées grises à pointes noires.
    body.add(new SphereGeometry(0.12, 8, 5), '#a9b2bd', pose([side * 0.1, 0.24, -0.04], [0.3, side * 0.1, 0], [0.45, 0.6, 1.5]));
    body.add(new ConeGeometry(0.05, 0.16, 4), '#22252b', pose([side * 0.07, 0.25, -0.24], [-Math.PI / 2 + 0.2, 0, 0], [1, 1, 0.5]));
    body.add(new CylinderGeometry(0.012, 0.012, 0.14, 4), '#e8964a', pose([side * 0.05, 0.06, 0.01]));
    body.add(new ConeGeometry(0.035, 0.07, 3), '#e8964a', pose([side * 0.05, 0.005, 0.04], [Math.PI / 2, 0, 0], [1, 1, 0.3]));
  }
  body.add(new ConeGeometry(0.06, 0.16, 4), '#f6f4ef', pose([0, 0.22, -0.24], [-Math.PI / 2 - 0.25, 0, 0], [1, 1, 0.45]));

  const head = new Pieces();
  head.add(new SphereGeometry(0.085, 10, 7), '#f9f8f4', pose([0, 0.05, 0.02]));
  head.add(new ConeGeometry(0.025, 0.11, 5), '#f2c14e', pose([0, 0.035, 0.13], [Math.PI / 2, 0, 0]));
  head.add(new SphereGeometry(0.008, 4, 3), '#e2553f', pose([0, 0.02, 0.15]));
  for (const side of [-1, 1]) head.add(new SphereGeometry(0.013, 5, 4), '#1d1d1d', pose([side * 0.05, 0.07, 0.06]));
  return { body: body.build()!, head: head.build()! };
}

export function Gull({ position, yaw = 0 }: { position: Vec3; yaw?: number }) {
  const geometries = useMemo(() => gullGeometries(), []);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const look = useRef({ target: 0, next: 0 });

  useEffect(() => () => {
    geometries.body.dispose();
    geometries.head.dispose();
  }, [geometries]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const l = look.current;
    // La tête change de direction d'un coup sec, puis s'immobilise.
    if (time > l.next) {
      l.next = time + 0.8 + ((time * 5.37) % 1) * 2.4;
      l.target = (((time * 13.7) % 1) - 0.5) * 2.2;
    }
    if (head.current) {
      head.current.rotation.y += (l.target - head.current.rotation.y) * 0.35;
      head.current.rotation.x = Math.sin(time * 0.9) * 0.08;
    }
    if (body.current) {
      const ruffle = Math.max(0, Math.sin(time * 0.35) - 0.96) * 25;
      body.current.scale.set(1 + ruffle * 0.08, 1 + Math.sin(time * 2.4) * 0.02, 1);
      body.current.rotation.z = Math.sin(time * 0.7) * 0.03;
    }
  });

  return (
    <group position={position} rotation-y={yaw}>
      <group ref={body}>
        <mesh geometry={geometries.body} material={PAINTED} castShadow raycast={() => null} />
        <group ref={head} position={[0, 0.33, 0.12]}>
          <mesh geometry={geometries.head} material={PAINTED} raycast={() => null} />
        </group>
      </group>
    </group>
  );
}
