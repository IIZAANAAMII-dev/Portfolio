'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Group } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { focusItem } from '@/lib/focus';
import { Pieces, pose, type Vec3 } from '../../docks/parts';
import { PAINTED } from '../../docks/planks';
import { Hotspot } from '../../kit';

/**
 * Boîte aux lettres (générique, sans marque) : elle ouvre le formulaire « bouteille à la
 * mer » du panneau Contact. Son petit drapeau se lève de temps en temps (« du courrier à
 * envoyer ? ») ; au clic, la porte s'ouvre et une lettre pointe le bout de son nez.
 *
 * Repère : origine au pied du poteau, porte vers +Z, drapeau sur le flanc -X.
 */

const RED = '#d9533e';
const TRIM = '#b8402f';

function mailboxGeometries() {
  const body = new Pieces();
  body.add(new BoxGeometry(0.36, 0.26, 0.6), RED, pose([0, 0.13, 0]), 0.1);
  body.add(new CylinderGeometry(0.18, 0.18, 0.6, 14, 1, false, Math.PI / 2, Math.PI), RED, pose([0, 0.26, 0], [Math.PI / 2, 0, 0]), 0.06);
  // Fond et ourlets plus sombres, petit socle de bois.
  body.add(new BoxGeometry(0.38, 0.04, 0.62), TRIM, pose([0, 0.01, 0]));
  body.add(new BoxGeometry(0.39, 0.03, 0.03), TRIM, pose([0, 0.26, -0.28]));
  body.add(new BoxGeometry(0.03, 0.06, 0.06), '#e8e2d6', pose([-0.195, 0.14, -0.12]));

  const door = new Pieces();
  door.add(new BoxGeometry(0.37, 0.27, 0.025), TRIM, pose([0, 0.135, 0.012]));
  door.add(new CylinderGeometry(0.185, 0.185, 0.025, 14, 1, false, Math.PI / 2, Math.PI), TRIM, pose([0, 0.27, 0.012], [Math.PI / 2, 0, 0]));
  door.add(new BoxGeometry(0.1, 0.03, 0.04), '#e8e2d6', pose([0, 0.36, 0.035]));

  const flag = new Pieces();
  flag.add(new BoxGeometry(0.022, 0.34, 0.022), '#f6c544', pose([0, 0.17, 0]));
  flag.add(new BoxGeometry(0.018, 0.12, 0.17), '#f6c544', pose([0, 0.28, 0.085]), 0.05);

  const letter = new Pieces();
  letter.add(new BoxGeometry(0.24, 0.012, 0.17), '#fbf6ea', pose([0, 0, 0]));
  letter.add(new BoxGeometry(0.035, 0.015, 0.035), '#d9533e', pose([0, 0.004, 0.02], [0, Math.PI / 4, 0]));

  return { body: body.build()!, door: door.build()!, flag: flag.build()!, letter: letter.build()! };
}

/** Ressort amorti : rebond « dessin animé » du drapeau et de la porte. */
function spring(state: { value: number; velocity: number }, target: number, stiffness: number, damping: number, dt: number) {
  state.velocity += ((target - state.value) * stiffness - state.velocity * damping) * dt;
  state.value += state.velocity * dt;
  return state.value;
}

export function Mailbox({ position, yaw }: { position: Vec3; yaw: number }) {
  const geometries = useMemo(() => mailboxGeometries(), []);
  const flag = useRef<Group>(null);
  const door = useRef<Group>(null);
  const letter = useRef<Group>(null);
  const box = useRef<Group>(null);
  const motion = useRef({
    flag: { value: Math.PI / 2, velocity: 0 },
    door: { value: 0, velocity: 0 },
    hop: { value: 0, velocity: 0 },
    openedAt: -100,
  });
  const clock = useThree((state) => state.clock);

  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const m = motion.current;
    const since = time - m.openedAt;
    // De temps en temps, le drapeau se lève tout seul : il y a du courrier à envoyer.
    const idle = time % 9.5;
    const flagUp = since < 6 || (idle > 6.4 && idle < 8.6);
    const flagAngle = spring(m.flag, flagUp ? 0 : Math.PI / 2, 140, 7.5, dt);
    const doorAngle = spring(m.door, since < 4.2 ? 1.05 : 0, 90, 9, dt);
    const hop = spring(m.hop, 0, 160, 10, dt);
    if (flag.current) flag.current.rotation.x = flagAngle;
    if (door.current) door.current.rotation.x = doorAngle;
    if (box.current) {
      box.current.position.y = Math.max(0, hop) * 0.12;
      box.current.rotation.z = hop * 0.08;
    }
    if (letter.current) {
      const out = Math.min(1, Math.max(0, doorAngle / 1.05));
      letter.current.position.z = 0.12 + out * 0.24;
      letter.current.position.y = 0.1 + out * 0.03 + Math.sin(time * 6) * 0.004 * out;
      letter.current.rotation.x = out * 0.25;
      letter.current.visible = out > 0.05;
    }
  });

  const open = () => {
    const m = motion.current;
    m.openedAt = clock.elapsedTime;
    m.hop.velocity = 3.2;
    m.flag.velocity = -6;
    ambience.bump('wood', 0.55);
    ambience.chime([988, 1319, 1568], 0.08);
    focusItem('contact', null);
  };

  return (
    <group position={position} rotation-y={yaw}>
      <Hotspot onActivate={open} hoverScale={1.1} position={[0, 1.06, 0]}>
        <group ref={box}>
          <mesh geometry={geometries.body} material={PAINTED} castShadow />
          <group ref={door} position={[0, 0, 0.3]}>
            <mesh geometry={geometries.door} material={PAINTED} castShadow />
          </group>
          <group ref={flag} position={[-0.205, 0.12, -0.12]} rotation-x={Math.PI / 2}>
            <mesh geometry={geometries.flag} material={PAINTED} castShadow />
          </group>
          <group ref={letter} visible={false}>
            <mesh geometry={geometries.letter} material={PAINTED} />
          </group>
        </group>
      </Hotspot>
    </group>
  );
}
