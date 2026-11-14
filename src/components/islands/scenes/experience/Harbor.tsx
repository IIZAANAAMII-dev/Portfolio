'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import type { IslandConfig } from '@/types';
import { addHull, Builder, flatMaterial, paintMaterial, type V3 } from './build';
import { HARBOR } from './layout';
import { Lanterns, Merged } from './parts';

/**
 * Le petit port de La Ciotat, au pied du Bec de l'Aigle : quai de pierre claire, bittes
 * d'amarrage, réverbères, digue d'enrochement et son feu vert, et trois pointus (barques
 * provençales pointues des deux bouts) qui se balancent, dont un avec sa voile latine
 * ferlée sur l'antenne et un pêcheur à la ligne.
 *
 * Repère du port : x = u (vers le large), z = v (le long du quai), y depuis la mer.
 */

const STONE = '#ddcdb0';
const COPING = '#efe5cf';
const IRON = '#30353b';
const POST = '#27302c';

const QUAY_TO = HARBOR.quay.to;
const WALL_LEFT = HARBOR.quay.left;
const WALL_RIGHT = 3.8;
const BOAT_U = QUAY_TO + 1.92;
const LAMPS: [number, number][] = [[12.25, -2.9], [12.55, 3.95]];

function quayGeometry() {
  const b = new Builder();
  const { quay } = HARBOR;
  b.box([quay.to - quay.from + 0.05, 0.08, quay.right - quay.left], '#e3d4b8', [(quay.from + quay.to) / 2 + 0.02, quay.y + 0.02, (quay.left + quay.right) / 2], [0, 0, 0], 0.03);
  // Mur de quai : trois assises de blocs décalés, du fond du bassin au dallage.
  const courses = [-0.84, -0.12, 0.6];
  courses.forEach((y, course) => {
    const offset = course % 2 === 0 ? 0 : 0.5;
    for (let v = WALL_LEFT - offset; v < WALL_RIGHT; v += 1) {
      const from = Math.max(v, WALL_LEFT);
      const to = Math.min(v + 1, WALL_RIGHT);
      if (to - from < 0.1) continue;
      b.box([0.24, 0.7, to - from - 0.03], STONE, [QUAY_TO + 0.11, y, (from + to) / 2], [0, 0, 0], 0.06);
    }
  });
  for (let v = WALL_LEFT; v < WALL_RIGHT; v += 0.9) {
    const to = Math.min(v + 0.9, WALL_RIGHT);
    b.box([0.4, 0.12, to - v - 0.03], COPING, [QUAY_TO + 0.02, quay.y + 0.1, (v + to) / 2], [0, 0, 0], 0.04);
  }
  // Bittes d'amarrage derrière chaque barque, et l'amarre qui file vers la poupe.
  for (const v of HARBOR.moorings) {
    b.cylinder(0.1, 0.12, 0.3, 8, IRON, [QUAY_TO - 0.15, quay.y + 0.3, v]);
    b.cylinder(0.15, 0.15, 0.06, 8, IRON, [QUAY_TO - 0.15, quay.y + 0.47, v]);
    b.rod([QUAY_TO - 0.12, quay.y + 0.36, v], [QUAY_TO + 0.42, 0.62, v + 0.02], 0.02, '#c9b58a', 4);
  }
  // Réverbères (les globes sont dessinés à part, pour s'allumer la nuit).
  for (const [u, v] of LAMPS) {
    b.cylinder(0.13, 0.16, 0.26, 8, POST, [u, quay.y + 0.13, v]);
    b.cylinder(0.045, 0.06, 2.3, 6, POST, [u, quay.y + 1.4, v]);
    b.cylinder(0.11, 0.07, 0.12, 8, POST, [u, quay.y + 2.6, v]);
    b.cone(0.2, 0.16, 8, POST, [u, quay.y + 3.03, v]);
  }
  // Caisses de poisson, filet, glène de cordage, banc face au large.
  b.box([0.55, 0.24, 0.38], '#2f6fc0', [12.55, quay.y + 0.14, -0.7], [0, 0.1, 0]);
  b.box([0.55, 0.24, 0.38], '#f4f1ea', [12.52, quay.y + 0.38, -0.72], [0, -0.15, 0]);
  b.box([0.55, 0.24, 0.38], '#2f6fc0', [12.25, quay.y + 0.14, -0.35], [0, 0.4, 0]);
  b.sphere(0.36, '#7d8a52', [12.3, quay.y + 0.1, -1.25], [1.2, 0.42, 1], [9, 6]);
  b.add(new IcosahedronGeometry(0.1, 0), '#e25a3c', [12.38, quay.y + 0.22, -1.32]);
  b.cylinder(0.24, 0.26, 0.12, 12, '#c9a46a', [12.75, quay.y + 0.07, 2.15]);
  b.cylinder(0.16, 0.2, 0.1, 12, '#b9935c', [12.75, quay.y + 0.17, 2.15]);
  b.box([0.42, 0.06, 1.2], '#9b6b45', [12.2, quay.y + 0.45, -3.05]);
  for (const dv of [-0.5, 0.5]) b.box([0.36, 0.42, 0.07], POST, [12.2, quay.y + 0.21, -3.05 + dv]);
  b.box([0.06, 0.4, 1.2], '#9b6b45', [12.0, quay.y + 0.72, -3.05], [0, 0, 0.18]);
  // Feu vert au bout de la digue.
  const [lu, lv] = [17.05, 4.05];
  b.cylinder(0.45, 0.55, 0.5, 10, '#c9c2b3', [lu, 0.55, lv]);
  b.cylinder(0.22, 0.28, 1.5, 10, '#f4f1ea', [lu, 1.55, lv]);
  b.cylinder(0.235, 0.235, 0.36, 10, '#2f9a5e', [lu, 1.95, lv]);
  b.cylinder(0.3, 0.3, 0.06, 10, IRON, [lu, 2.33, lv]);
  b.cone(0.22, 0.24, 10, '#2f9a5e', [lu, 2.78, lv]);
  return b.build();
}

/* ------------------------------------------------------------------ digue */

const BREAKWATER = Array.from({ length: 9 }, (_, index) => {
  const t = index / 8;
  return {
    u: 13.5 + t * 3.3 + (hash(index * 3.7) - 0.5) * 0.3,
    v: 4.15 + (hash(index * 5.1) - 0.5) * 0.5,
    y: 0.35 - t * 0.55,
    size: 0.62 + hash(index * 2.3) * 0.35,
  };
});

function Breakwater() {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    BREAKWATER.forEach((rock, index) => {
      dummy.position.set(rock.u, rock.y, rock.v);
      dummy.rotation.set(hash(index * 1.3) * 3, hash(index * 2.1) * 3, hash(index * 4.4) * 3);
      dummy.scale.set(rock.size * 1.15, rock.size * 0.8, rock.size);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BREAKWATER.length]} castShadow receiveShadow raycast={() => null}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#b9a58a" roughness={1} flatShading />
    </instancedMesh>
  );
}

function HarborLight() {
  const lamp = useRef<MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!lamp.current) return;
    // Feu à éclats : deux éclats verts toutes les quatre secondes.
    const phase = state.clock.elapsedTime % 4;
    const flash = phase < 0.35 || (phase > 0.7 && phase < 1.05) ? 1 : 0.08;
    lamp.current.emissiveIntensity = 0.3 + skyState.dayNight * 3.6 * flash;
  });
  return (
    <mesh position={[17.05, 2.52, 4.05]} raycast={() => null}>
      <cylinderGeometry args={[0.17, 0.17, 0.32, 10]} />
      <meshStandardMaterial ref={lamp} color="#bff5d2" emissive="#2dff8a" emissiveIntensity={0.3} roughness={0.25} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ pointus */

interface PointuDesign {
  hull: string;
  band: string;
  sail?: boolean;
  fisher?: boolean;
  motor?: boolean;
}

const POINTUS: PointuDesign[] = [
  { hull: '#f4f1ea', band: '#2f6fc0', sail: true },
  { hull: '#3f8f6a', band: '#f4f1ea', motor: true },
  { hull: '#f4f1ea', band: '#d8473a', fisher: true },
];

function pointuGeometry({ hull, band, sail, fisher, motor }: PointuDesign) {
  const b = new Builder();
  const keel = -0.2;
  addHull(b, {
    length: 3.2,
    beam: 1.25,
    depth: 0.62,
    sheer: 0.24,
    transom: 0,
    bands: [[0.32, '#8f3b2b'], [0.84, hull], [3, band]],
    deck: '#b98552',
    deckDrop: 0.34,
    open: true,
  }, [0, keel, 0]);
  const top = keel + 0.62 + 0.24;
  // Capian (étrave haute) et étambot, barre franche.
  b.beam([1.57, top - 0.12, 0], [1.66, top + 0.22, 0], 0.08, band, 0.1);
  b.beam([1.66, top + 0.2, 0], [1.6, top + 0.48, 0], 0.07, band, 0.09);
  b.beam([-1.57, top - 0.12, 0], [-1.62, top + 0.1, 0], 0.07, '#8a5d3b', 0.09);
  b.beam([-1.6, top + 0.06, 0], [-1.0, top + 0.22, 0], 0.05, '#8a5d3b');
  // Bancs, plage avant, défenses.
  for (const x of [-0.45, 0.45]) b.box([0.2, 0.05, 1.02], '#a77245', [x, keel + 0.5, 0]);
  b.box([0.55, 0.05, 0.5], '#a77245', [1.1, top - 0.12, 0]);
  for (const x of [-0.6, 0.5]) b.cylinder(0.06, 0.06, 0.26, 6, '#f4f1ea', [x, keel + 0.5, 0.66]);
  if (sail) {
    // Mât court et antenne de la voile latine, voile ferlée le long de l'antenne.
    b.rod([0.55, keel + 0.3, 0], [0.62, keel + 2.25, 0], 0.035, '#8a5d3b');
    b.rod([1.75, keel + 1.12, 0.06], [-1.45, keel + 2.95, 0.06], 0.03, '#7a5034');
    b.rod([1.5, keel + 1.2, 0.1], [-1.15, keel + 2.72, 0.1], 0.075, '#f3ece0', 7);
  }
  if (motor) {
    b.box([0.28, 0.32, 0.26], '#2b2f36', [-1.3, top - 0.02, 0]);
    b.box([0.3, 0.08, 0.28], '#d8473a', [-1.3, top + 0.15, 0]);
  }
  if (fisher) {
    // Pêcheur assis, béret, canne tendue vers le large.
    b.box([0.34, 0.24, 0.34], '#2b3f6b', [-0.45, keel + 0.66, 0]);
    b.box([0.3, 0.4, 0.36], '#e9dfc7', [-0.5, keel + 0.95, 0]);
    b.sphere(0.12, '#e8b48a', [-0.5, keel + 1.25, 0]);
    b.cylinder(0.13, 0.13, 0.05, 10, '#2b3f6b', [-0.5, keel + 1.35, 0]);
    b.rod([-0.38, keel + 1.0, 0.05], [1.7, keel + 2.05, 0.55], 0.018, '#5c4330', 4);
    b.rod([1.7, keel + 2.05, 0.55], [1.95, keel - 0.1, 0.62], 0.004, '#eae6dc', 3);
  }
  return b.build();
}

function Pointu({ design, v, index, world }: { design: PointuDesign; v: number; index: number; world: [number, number] }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => pointuGeometry(design), [design]);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const t = state.clock.elapsedTime;
    const calm = reducedMotion ? 0.3 : 1;
    // Le bassin est abrité : la houle n'y arrive qu'à moitié.
    target.position.y = waveHeight(world[0], world[1], t) * 0.45 + Math.sin(t * 1.6 + index * 2.1) * 0.025;
    target.rotation.x = Math.sin(t * 1.15 + index * 1.7) * 0.05 * calm;
    target.rotation.z = Math.sin(t * 0.8 + index * 2.6) * 0.025 * calm;
    target.rotation.y = Math.sin(t * 0.35 + index) * 0.03 * calm;
  });
  return (
    <group position={[BOAT_U, 0, v]}>
      <group ref={group}>
        <Merged geometry={geometry} material={flatMaterial()} />
      </group>
    </group>
  );
}

export function Harbor({ island }: { island: IslandConfig }) {
  const quay = useMemo(() => quayGeometry(), []);
  const angle = Math.atan2(HARBOR.frame.az, HARBOR.frame.ax);
  const lanterns = useMemo<V3[]>(() => LAMPS.map(([u, v]) => [u, HARBOR.quay.y + 2.82, v]), []);
  const worlds = useMemo(
    () => HARBOR.moorings.map((v) => {
      const x = BOAT_U * HARBOR.frame.ax + v * HARBOR.frame.tx;
      const z = BOAT_U * HARBOR.frame.az + v * HARBOR.frame.tz;
      return [island.position[0] + x, island.position[1] + z] as [number, number];
    }),
    [island.position],
  );
  return (
    <group rotation-y={-angle}>
      <Merged geometry={quay} material={paintMaterial()} />
      <Breakwater />
      <HarborLight />
      <Lanterns points={lanterns} />
      {POINTUS.map((design, index) => (
        <Pointu key={index} design={design} v={HARBOR.moorings[index]} index={index} world={worlds[index]} />
      ))}
    </group>
  );
}
