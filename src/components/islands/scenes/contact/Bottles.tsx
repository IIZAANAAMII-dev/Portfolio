'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderGeometry, Group, Matrix4, MeshStandardMaterial } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { focusItem } from '@/lib/focus';
import { waveHeight } from '@/lib/waves';
import { Pieces } from '../../docks/parts';
import { Hotspot } from '../../kit';
import { bottleProfile } from './build';

/**
 * Bouteilles à la mer : trois échouées sur la plage (verre vert, ambre, bleu, parchemin
 * roulé à l'intérieur) et une qui dérive au large en dansant sur la houle. Cliquer celle du
 * large ouvre le formulaire « bouteille à la mer » du panneau Contact.
 */

const GLASS = new MeshStandardMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.68,
  roughness: 0.12,
  metalness: 0.1,
  emissive: '#1f4a40',
  emissiveIntensity: 0.18,
  depthWrite: false,
});
const SEA_GLASS = new MeshStandardMaterial({ color: '#7ec9ad', transparent: true, opacity: 0.7, roughness: 0.12, metalness: 0.1, emissive: '#2d6b58', emissiveIntensity: 0.28 });
const PAPER = new MeshStandardMaterial({ color: '#f3e6c4', roughness: 0.9 });
const CORK = new MeshStandardMaterial({ color: '#a57a4c', roughness: 0.95 });

/** Verre des bouteilles de la plage (fusionné : un draw call). */
export function BeachBottles({ bottles }: { bottles: { matrix: Matrix4; glass: string }[] }) {
  const geometry = useMemo(() => {
    const glass = new Pieces();
    const profile = bottleProfile();
    for (const bottle of bottles) glass.add(profile, bottle.glass, bottle.matrix);
    profile.dispose();
    return glass.build();
  }, [bottles]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={GLASS} renderOrder={5} raycast={() => null} />;
}

/** La bouteille du large : elle tangue, roule et tourne lentement sur elle-même. */
export function DriftingBottle({ origin, at }: { origin: [number, number]; at: [number, number] }) {
  const group = useRef<Group>(null);
  const glass = useMemo(() => bottleProfile(), []);
  const scroll = useMemo(() => new CylinderGeometry(0.13, 0.13, 0.55, 8), []);
  const cork = useMemo(() => new CylinderGeometry(0.11, 0.095, 0.16, 8), []);

  useEffect(() => () => [glass, scroll, cork].forEach((item) => item.dispose()), [cork, glass, scroll]);

  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    // Petite dérive en boucle autour de son point (elle ne part jamais loin).
    const x = at[0] + Math.sin(time * 0.13) * 0.7;
    const z = at[1] + Math.cos(time * 0.11) * 0.5;
    const wave = waveHeight(origin[0] + x, origin[1] + z, time);
    target.position.set(x, wave + 0.08 + Math.sin(time * 2.1) * 0.05, z);
    target.rotation.set(Math.PI / 2 - 0.3 + Math.sin(time * 1.7) * 0.14, time * 0.12, Math.sin(time * 1.3) * 0.22);
  });

  const open = () => {
    ambience.bump('soft', 0.7);
    focusItem('contact', null);
  };

  return (
    <group ref={group}>
      <Hotspot onActivate={open} hoverScale={1.18}>
        <group scale={0.95} position={[0, -0.55, 0]}>
          <mesh geometry={glass} material={SEA_GLASS} castShadow renderOrder={5} />
          <mesh geometry={scroll} material={PAPER} position-y={0.42} />
          <mesh geometry={cork} material={CORK} position-y={1.3} />
        </group>
        <mesh visible={false}>
          <sphereGeometry args={[0.85, 8, 6]} />
        </mesh>
      </Hotspot>
    </group>
  );
}
