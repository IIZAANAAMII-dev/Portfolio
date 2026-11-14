'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Group, MeshStandardMaterial } from 'three';
import { waveHeight } from '@/lib/waves';
import { clothMaterial } from './cloth';
import { hullGeometry, hullProfile, type HullOptions } from './hull';
import { Mesher, type Vec3 } from './mesher';

/**
 * Les bateaux du port :
 *  - un sinagot, le voilier de pêche du golfe du Morbihan : coque noire, deux mâts
 *    inclinés vers l'arrière, voiles au tiers tannées (ocre rouge) mises à sécher ;
 *  - une petite plate, tirée sur la cale, avirons rangés.
 * Ils roulent et tanguent doucement sur la houle du bassin.
 */

const SINAGOT: HullOptions = {
  length: 4.5,
  beam: 1.6,
  freeboard: 0.42,
  draft: 0.5,
  transom: 0.55,
  sheer: 0.2,
  bottom: '#6e2f25',
  topside: '#1e2026',
  strake: '#e9e4d8',
  inside: '#9b7653',
};

const PLATE: HullOptions = {
  length: 2.5,
  beam: 1.12,
  freeboard: 0.34,
  draft: 0.16,
  transom: 0.78,
  sheer: 0.1,
  bottom: '#a8433a',
  topside: '#5a8fc2',
  strake: '#f2efe6',
  inside: '#c9b28e',
};

/** Voile au tiers : quadrilatère (amure, écoute, empointure, pic) maillé pour onduler. */
function sailGeometry(tack: Vec3, clew: Vec3, throat: Vec3, peak: Vec3, belly: number) {
  const columns = 8;
  const rows = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= columns; i++) {
      const u = i / columns;
      const point = [0, 1, 2].map((k) => {
        const bottom = tack[k] + (clew[k] - tack[k]) * u;
        const top = throat[k] + (peak[k] - throat[k]) * u;
        return bottom + (top - bottom) * v;
      });
      // Creux de la voile : gonflée au milieu, sous le vent (côté -Z).
      point[2] -= Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.1) * belly;
      positions.push(...point);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Espar (mât, vergue, beaupré) : cylindre entre deux points. */
function spar(mesher: Mesher, from: Vec3, to: Vec3, radius: number, color: string) {
  mesher.rod(from, to, radius, color, 6);
}

const SPAR = '#6b4a32';
const SAIL = '#bf5f36';

function sinagotParts() {
  const rig = new Mesher(true, false);
  const deck = hullProfile(SINAGOT, 0.5).top - 0.1;
  // Pont avant (tillac) et bancs.
  rig.box([1.0, 0.06, 0.95], [1.35, hullProfile(SINAGOT, 0.78).top - 0.06, 0], [0, 0, 0], '#b38a5e');
  rig.box([0.22, 0.06, 1.3], [-0.2, deck - 0.1, 0], [0, 0, 0], '#b38a5e');
  rig.box([0.22, 0.06, 1.25], [-1.25, deck - 0.08, 0], [0, 0, 0], '#b38a5e');
  // Mâts inclinés vers l'arrière, beaupré, gouvernail et barre.
  const foreFoot: Vec3 = [1.65, deck, 0];
  const foreTop: Vec3 = [1.35, deck + 3.2, 0];
  const mainFoot: Vec3 = [0.15, deck - 0.1, 0];
  const mainTop: Vec3 = [-0.25, deck + 3.9, 0];
  spar(rig, foreFoot, foreTop, 0.055, SPAR);
  spar(rig, mainFoot, mainTop, 0.065, SPAR);
  spar(rig, [2.1, deck + 0.1, 0], [2.85, deck + 0.3, 0], 0.04, SPAR);
  rig.box([0.08, 0.75, 0.42], [-2.3, 0.05, 0], [0, 0, 0.12], '#2b2b2f');
  spar(rig, [-2.2, deck + 0.25, 0], [-1.45, deck + 0.38, 0], 0.03, SPAR);
  // Vergues des deux voiles au tiers.
  const fore = { tack: [1.85, deck + 0.25, 0.02] as Vec3, clew: [0.35, deck + 0.3, -0.05] as Vec3, throat: [1.52, deck + 2.25, 0] as Vec3, peak: [0.2, deck + 3.0, -0.05] as Vec3 };
  const main = { tack: [0.32, deck + 0.3, 0.02] as Vec3, clew: [-1.85, deck + 0.35, -0.08] as Vec3, throat: [-0.05, deck + 2.75, 0] as Vec3, peak: [-1.7, deck + 3.7, -0.08] as Vec3 };
  spar(rig, fore.throat, fore.peak, 0.035, SPAR);
  spar(rig, main.throat, main.peak, 0.04, SPAR);
  // Girouette rouge en tête du grand mât.
  rig.box([0.32, 0.12, 0.02], [mainTop[0] - 0.12, mainTop[1] + 0.06, 0], [0, 0, 0], '#d8433b');
  return {
    rig: rig.build()!,
    sails: [
      sailGeometry(fore.tack, fore.clew, fore.throat, fore.peak, 0.18),
      sailGeometry(main.tack, main.clew, main.throat, main.peak, 0.24),
    ],
    mastTop: [mainTop[0], mainTop[1] + 0.12, 0] as Vec3,
  };
}

export function Sinagot({ position, rotation, world }: { position: Vec3; rotation: number; world: [number, number] }) {
  const hull = useMemo(() => hullGeometry(SINAGOT), []);
  const parts = useMemo(() => sinagotParts(), []);
  const sail = useMemo(() => clothMaterial({ color: SAIL, mode: 'belly', amplitude: 0.07, speed: 0.6, roughness: 0.95 }), []);
  const paint = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), []);
  const bob = useRef<Group>(null);
  // Le bateau suit la houle (amortie dans le bassin), roule et tangue un peu.
  useFrame((state) => {
    const target = bob.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    target.position.y = waveHeight(world[0], world[1], time) * 0.45;
    target.rotation.x = Math.sin(time * 0.9 + 0.4) * 0.035;
    target.rotation.z = Math.sin(time * 0.63 + 0.7) * 0.018;
  });
  useEffect(() => () => {
    hull.dispose();
    parts.rig.dispose();
    parts.sails.forEach((geometry) => geometry.dispose());
    sail.dispose();
    paint.dispose();
  }, [hull, paint, parts, sail]);
  return (
    <group position={position} rotation-y={rotation}>
      <group ref={bob}>
        <mesh geometry={hull} material={paint} castShadow receiveShadow />
        <mesh geometry={parts.rig} material={paint} castShadow />
        {parts.sails.map((geometry, index) => (
          <mesh key={index} geometry={geometry} material={sail} castShadow />
        ))}
      </group>
    </group>
  );
}

/** Position de la tête du grand mât du sinagot (repère du bateau), perchoir d'un goéland. */
export const SINAGOT_MAST_TOP: Vec3 = [-0.37, hullProfile(SINAGOT, 0.5).top - 0.1 + 4.02, 0];

export function Rowboat({ position, rotation, tilt }: { position: Vec3; rotation: number; tilt: number }) {
  const geometry = useMemo(() => {
    const hull = hullGeometry(PLATE);
    const extra = new Mesher(true, false);
    const seat = hullProfile(PLATE, 0.5).top - 0.12;
    extra.add(hull, undefined, '#ffffff');
    extra.box([0.2, 0.05, 1.0], [0.1, seat, 0], [0, 0, 0], '#c79a63');
    extra.box([0.2, 0.05, 0.85], [-0.75, seat, 0], [0, 0, 0], '#c79a63');
    // Deux avirons rangés le long des bancs.
    for (const side of [-1, 1]) {
      extra.box([2.0, 0.04, 0.07], [0.05, seat + 0.06, side * 0.24], [0, side * 0.04, 0], '#d6b27a');
      extra.box([0.42, 0.03, 0.13], [0.95, seat + 0.06, side * 0.27], [0, side * 0.04, 0], '#e7dcc4');
    }
    hull.dispose();
    return extra.build()!;
  }, []);
  const paint = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), []);
  useEffect(() => () => {
    geometry.dispose();
    paint.dispose();
  }, [geometry, paint]);
  return (
    <group position={position} rotation={[0, rotation, tilt]}>
      <mesh geometry={geometry} material={paint} castShadow receiveShadow />
    </group>
  );
}
