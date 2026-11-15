'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type Group, type InstancedMesh, type Mesh } from 'three';
import { hash } from '@/lib/utils/math';
import { ClearingAt } from '../../kit';
import { Maquette, type V3 } from './builder';
import { TOWN, facing, polar } from './layout';
import { paint } from './materials';

/**
 * Le jardin du sud-ouest, au premier plan des caméras d'accostage : tout y reste bas pour
 * ne rien cacher de la ville. Des rangs de lavande, une fontaine qui gargouille et un
 * terrain de pétanque où une boule part toutes les quelques secondes vers le cochonnet.
 */

const Y = TOWN.level;
const COURT = { angle: 2.72, radius: 10.75 };
const FOUNTAIN = { angle: 3.12, radius: 11.7 };
const DROPS = 18;

function local(at: [number, number], ry: number) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return (x: number, y: number, z: number): V3 => [at[0] + x * c + z * s, Y + y, at[1] - x * s + z * c];
}

function buildPark() {
  const m = new Maquette();
  // Terrain de pétanque : sable clair, bordure de bois, boules et cochonnet.
  const court = polar(COURT.angle, COURT.radius);
  const ry = facing(court[0], court[1], 0) + Math.PI / 2;
  const p = local(court, ry);
  m.box([3.6, 0.05, 1.7], p(0, 0.03, 0), '#ead3a2', [0, ry, 0], 0.03);
  for (const z of [-0.88, 0.88]) m.box([3.76, 0.12, 0.08], p(0, 0.06, z), '#9b6b45', [0, ry, 0]);
  for (const x of [-1.84, 1.84]) m.box([0.08, 0.12, 1.84], p(x, 0.06, 0), '#9b6b45', [0, ry, 0]);
  m.sphere(0.045, p(1.15, 0.1, 0.15), '#f08a2e', 1);
  for (const [x, z] of [[0.95, 0.35], [1.32, -0.12], [0.8, -0.25]]) m.sphere(0.075, p(x, 0.13, z), '#c9ced6', 1);
  // Les deux joueurs : l'un lance (son bras est animé à part), l'autre attend.
  const players: [number, number, string][] = [[-1.45, 0.25, '#2f6fc0'], [-1.2, -0.55, '#e2553f']];
  for (const [x, z, shirt] of players) {
    m.cylinder(0.13, 0.16, 0.44, p(x, 0.47, z), shirt, 8);
    m.cylinder(0.055, 0.06, 0.22, p(x - 0.05, 0.16, z), '#3d4350', 6);
    m.cylinder(0.055, 0.06, 0.22, p(x + 0.05, 0.16, z), '#3d4350', 6);
    m.sphere(0.135, p(x, 0.85, z), '#d9a77a', 1);
    m.dome(0.14, p(x, 0.9, z), '#f4ead2', 10);
  }
  // Banc des spectateurs.
  m.box([1.2, 0.06, 0.32], p(-0.3, 0.42, 1.25), '#b07a4f', [0, ry, 0]);
  for (const x of [-0.8, 0.2]) m.box([0.06, 0.4, 0.3], p(x, 0.2, 1.25), '#36403f', [0, ry, 0]);

  // Rangs de lavande (on est en Provence), entre le terrain et le centre médical.
  for (let row = 0; row < 5; row++) {
    const r = 11.2 + row * 0.5;
    for (let bush = 0; bush < 9; bush++) {
      const angle = 2.27 + bush * 0.036;
      const [x, z] = polar(angle, r);
      const size = 0.17 + hash(row * 7 + bush) * 0.04;
      m.sphere(size, [x, Y + 0.1, z], '#5f8a4a', 0, [1.3, 0.55, 1.3]);
      m.sphere(size * 0.85, [x, Y + 0.27, z], hash(row + bush * 3.1) > 0.5 ? '#9a74d8' : '#8664c9', 1, [1.1, 0.9, 1.1]);
      m.cone(size * 0.45, 0.22, [x, Y + 0.45, z], '#b597ec', 5);
    }
  }

  // Pelouse du sud : oliviers en bac, massifs fleuris, un banc face à la mer.
  for (const [angle, r] of [[1.18, 12.3], [1.62, 12.75], [0.92, 11.4]] as const) {
    const [x, z] = polar(angle, r);
    m.cylinder(0.32, 0.38, 0.34, [x, Y + 0.17, z], '#cdb48d', 10);
    m.rod([x, Y + 0.3, z], [x + 0.1, Y + 1.25, z - 0.06], 0.07, '#6f5a45', 5);
    m.sphere(0.55, [x + 0.1, Y + 1.5, z - 0.06], '#8fae6a', 1, [1.1, 0.75, 1.1]);
    m.sphere(0.36, [x - 0.2, Y + 1.32, z + 0.18], '#9cb977', 0);
  }
  for (const [angle, r, color] of [[1.4, 11.7, '#f2a6c8'], [1.02, 12.6, '#ffd35c'], [1.78, 12.0, '#e8668c']] as const) {
    const [x, z] = polar(angle, r);
    m.cylinder(0.75, 0.8, 0.16, [x, Y + 0.08, z], '#7a5a3c', 14);
    for (let flower = 0; flower < 9; flower++) {
      const a = flower * 2.4;
      const d = 0.2 + (flower % 3) * 0.17;
      m.sphere(0.12, [x + Math.cos(a) * d, Y + 0.24, z + Math.sin(a) * d], flower % 4 === 0 ? '#ffffff' : color, 0);
    }
  }
  {
    const [x, z] = polar(1.3, 13.2);
    const ry = Math.atan2(x, z) + Math.PI;
    m.box([1.2, 0.06, 0.34], [x, Y + 0.42, z], '#b07a4f', [0, ry, 0]);
    m.box([1.2, 0.3, 0.05], [x + Math.sin(ry) * -0.16, Y + 0.62, z + Math.cos(ry) * -0.16], '#b07a4f', [0, ry, 0]);
    m.box([0.06, 0.4, 0.3], [x, Y + 0.2, z], '#36403f', [0, ry, 0]);
  }

  // Fontaine : vasque en pierre, colonne, coupe, eau.
  const [fx, fz] = polar(FOUNTAIN.angle, FOUNTAIN.radius);
  m.cylinder(0.95, 1.02, 0.42, [fx, Y + 0.21, fz], '#d8c4a0', 18);
  m.torus(0.95, 0.07, [fx, Y + 0.42, fz], '#e8d6b4', [Math.PI / 2, 0, 0], 24);
  m.cylinder(0.84, 0.84, 0.04, [fx, Y + 0.36, fz], '#5ec4d6', 18, [0, 0, 0], 0.2);
  m.cylinder(0.12, 0.16, 0.85, [fx, Y + 0.8, fz], '#d8c4a0', 10);
  m.cylinder(0.36, 0.14, 0.16, [fx, Y + 1.22, fz], '#e8d6b4', 14);
  m.cylinder(0.3, 0.3, 0.03, [fx, Y + 1.29, fz], '#7fd6e3', 14, [0, 0, 0], 0.2);
  return { geometry: m.build(), court, ry, fountain: [fx, fz] as [number, number] };
}

export function Park() {
  const park = useMemo(() => buildPark(), []);
  useEffect(() => () => park.geometry.dispose(), [park]);
  const boule = useRef<Mesh>(null);
  const arm = useRef<Group>(null);
  const drops = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const p = useMemo(() => local(park.court, park.ry), [park]);
  const from = p(-1.3, 0.75, 0.25);
  const to = p(1.05, 0.13, 0.05);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Lancer de boule toutes les 5 s : élan, vol en cloche, roulé.
    const cycle = (t % 5) / 5;
    if (arm.current) arm.current.rotation.x = cycle < 0.25 ? -1.2 + cycle * 4 * 2.2 : 1.0 - Math.min(1, (cycle - 0.25) * 6) * 1.0;
    if (boule.current) {
      const u = Math.min(1, Math.max(0, (cycle - 0.25) / 0.35));
      boule.current.visible = cycle > 0.25 && cycle < 0.95;
      boule.current.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u + Math.sin(u * Math.PI) * 0.9, from[2] + (to[2] - from[2]) * u);
    }
    const target = drops.current;
    if (target) {
      // Jet de la fontaine : gouttes en gerbe qui retombent dans la vasque.
      for (let index = 0; index < DROPS; index++) {
        const life = (t * 0.9 + index / DROPS) % 1;
        const a = (index / DROPS) * Math.PI * 2;
        const reach = life * 0.42;
        dummy.position.set(park.fountain[0] + Math.cos(a) * reach, Y + 1.32 + life * 0.55 - life * life * 0.95, park.fountain[1] + Math.sin(a) * reach);
        dummy.scale.setScalar(0.045 * (1 - life * 0.5));
        dummy.updateMatrix();
        target.setMatrixAt(index, dummy.matrix);
      }
      target.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <ClearingAt x={park.court[0]} z={park.court[1]} radius={2.4} />
      <mesh geometry={park.geometry} material={paint} castShadow receiveShadow raycast={() => null} />
      <group ref={arm} position={p(-1.3, 0.72, 0.25)} rotation-y={park.ry}>
        <mesh position={[0.17, -0.14, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
          <meshStandardMaterial color="#2f6fc0" roughness={0.8} />
        </mesh>
      </group>
      <mesh ref={boule} raycast={() => null}>
        <icosahedronGeometry args={[0.075, 1]} />
        <meshStandardMaterial color="#d6dbe2" roughness={0.3} metalness={0.6} />
      </mesh>
      <instancedMesh ref={drops} args={[undefined, undefined, DROPS]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#bff3ff" emissive="#7fd6e3" emissiveIntensity={0.4} roughness={0.2} transparent opacity={0.85} />
      </instancedMesh>
    </group>
  );
}
