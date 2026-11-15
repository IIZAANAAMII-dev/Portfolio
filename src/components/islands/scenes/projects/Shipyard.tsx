'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, ExtrudeGeometry, MeshStandardMaterial, Shape, Vector2, type Group, type InstancedMesh } from 'three';
import { Object3D } from 'three';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { focusItem } from '@/lib/focus';
import { hash } from '@/lib/utils/math';
import type { Project } from '@/types';
import { Hotspot } from '../../kit';
import { Maquette, pose, type V3 } from './builder';
import { SHIPYARD, VIEWPOINT, faceToward, sitePosition } from './layout';
import { glow, paint } from './materials';
import { Plaque, SignText, signFrame } from './signs';

/**
 * 06 — PORTFOLIO 3D, le chantier naval : en contrebas de la ville, sur la plage élargie,
 * une réplique du bateau de l'archipel (coque rouge, timonerie blanche, Gwenn-ha-Du en
 * tête de mât) est en construction sur sa cale. Un charpentier tape du marteau, une
 * soudure crépite à l'arrière, la potence balance une charge de planches. Toujours en
 * chantier — comme le portfolio.
 */

const RED = '#e2553f';
const WOOD = '#b98d5e';
const DARK_WOOD = '#7a5236';

const [SX, SZ] = sitePosition('shipyard');
/** Repère du chantier : +X vers le large (axe de la cale), +Z vers le ponton (caméras). */
const RY = -SHIPYARD.angle;
/** Pente de la cale. */
const SLOPE = 0.19;
const BOAT_X = 2.55;

function slipY(x: number) {
  return 0.12 - (x - 0.3) * SLOPE;
}

/** Coque effilée : profil latéral extrudé, étrave pincée, fond en V. */
function hullPart(points: [number, number][]) {
  const geometry = new ExtrudeGeometry(new Shape(points.map(([x, y]) => new Vector2(x, y))), { depth: 1.3, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -0.65);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const bow = x > 0.5 ? Math.min(1, (x - 0.5) / 1.3) : 0;
    const stern = x < -1.4 ? Math.min(1, (-1.4 - x) / 0.4) * 0.12 : 0;
    const keel = 1 - Math.max(0, 0.7 - y) * 0.6;
    position.setZ(index, z * (1 - bow * bow * 0.95) * (1 - stern) * keel);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildBoat() {
  const m = new Maquette();
  m.add(hullPart([[-1.8, 0.22], [-1.78, 0.6], [1.66, 0.6], [1.58, 0.42], [1.1, 0.04], [-1.3, 0.0]]), RED);
  m.add(hullPart([[-1.78, 0.58], [-1.75, 0.94], [1.5, 1.02], [1.86, 1.12], [1.66, 0.58]]), '#f7f4ec');
  m.box([2.9, 0.05, 0.92], [-0.15, 0.97, 0], WOOD);
  m.box([0.05, 0.05, 1.18], [-1.74, 0.99, 0], RED);
  // Timonerie, toit, vitres ; mât, bôme, petite cheminée.
  m.box([0.95, 0.72, 0.78], [-0.75, 1.36, 0], '#fbf9f3');
  m.box([1.05, 0.08, 0.88], [-0.75, 1.76, 0], RED);
  m.box([0.04, 0.26, 0.6], [-0.27, 1.45, 0], '#2f5f98');
  m.box([0.6, 0.26, 0.04], [-0.8, 1.45, 0.4], '#2f5f98');
  m.cylinder(0.07, 0.08, 0.36, [-1.05, 1.95, 0.2], '#3a3f45', 8);
  m.rod([0.45, 0.98, 0], [0.45, 3.0, 0], 0.045, DARK_WOOD, 6);
  m.rod([0.45, 1.5, 0], [-0.6, 1.62, 0], 0.03, DARK_WOOD, 6);
  m.rod([0.45, 2.95, 0], [1.9, 1.1, 0], 0.012, '#e8e1d0', 3);
  // Bouée et pare-battages.
  m.torus(0.13, 0.04, [-0.75, 1.3, 0.41], '#f15a3a', [0, 0, 0], 12);
  for (const x of [-1.0, 0.1, 0.9]) m.cylinder(0.06, 0.06, 0.22, [x, 0.7, 0.62 - Math.max(0, x - 0.5) * 0.4], '#f2f2ee', 8);
  return m.build();
}

function buildYard() {
  const m = new Maquette();
  const lights = new Maquette();
  // Quai en planches.
  m.block(-1.0, -0.05, -4.25, 1.15, 0.08, 3.6, WOOD, 0.05);
  for (let plank = 0; plank < 16; plank++) m.block(-1.0, 0.08, -4.2 + plank * 0.5, 1.15, 0.085, -4.18 + plank * 0.5, DARK_WOOD, 0);
  // Cale de lancement : rails, traverses, pieux dans l'eau.
  for (const z of [-0.42, 0.42]) {
    m.beam([0.3, slipY(0.3) - 0.04, z], [7.2, slipY(7.2) - 0.04, z], 0.16, DARK_WOOD);
    m.beam([0.3, slipY(0.3) + 0.06, z], [7.2, slipY(7.2) + 0.06, z], 0.07, '#9aa3ad');
  }
  for (let tie = 0; tie < 14; tie++) {
    const x = 0.45 + tie * 0.5;
    m.box([0.16, 0.1, 1.25], [x, slipY(x) - 0.12, 0], DARK_WOOD, [0, 0, -Math.atan(SLOPE)]);
    if (x > 2.2 && tie % 2 === 0) for (const z of [-0.5, 0.5]) m.cylinder(0.08, 0.09, 2.2, [x, slipY(x) - 1.25, z], '#6b4a33', 6);
  }
  // Berceau sous la coque.
  for (const x of [BOAT_X - 1.0, BOAT_X, BOAT_X + 0.9]) m.box([0.18, 0.4, 1.1], [x, slipY(x) + 0.25, 0], '#8a5d3b', [0, 0, -Math.atan(SLOPE)]);
  // Échafaudage côté large de la coque.
  for (const x of [BOAT_X - 1.4, BOAT_X, BOAT_X + 1.3]) m.rod([x, slipY(x) - 0.2, -1.0], [x, slipY(x) + 2.0, -1.0], 0.04, '#d0d4d8');
  for (const level of [0.75, 1.45]) {
    m.beam([BOAT_X - 1.5, slipY(BOAT_X - 1.5) + level, -1.0], [BOAT_X + 1.4, slipY(BOAT_X + 1.4) + level, -1.0], 0.04, '#d0d4d8');
    m.box([3.0, 0.05, 0.35], [BOAT_X, slipY(BOAT_X) + level + 0.04, -0.85], '#a5784c', [0, 0, -Math.atan(SLOPE)]);
  }

  // Atelier du charpentier : bardage bois, toit rouge, porte ouverte.
  const shed = { x0: -0.95, x1: 0.95, z0: -4.15, z1: -2.65 };
  m.block(shed.x0, 0.08, shed.z0, shed.x1, 1.85, shed.z1, '#cf9a62');
  for (let board = 0; board < 9; board++) m.block(shed.x0 + 0.1 + board * 0.21, 0.1, shed.z1, shed.x0 + 0.13 + board * 0.21, 1.83, shed.z1 + 0.025, '#b47f4c', 0);
  m.block(-0.35, 0.08, shed.z1 - 0.02, 0.35, 1.35, shed.z1 + 0.04, '#4a2f20');
  m.gable(2.25, 1.85, 0.75, [0, 1.85, (shed.z0 + shed.z1) / 2], RED, [0, Math.PI / 2, 0]);
  m.extrude(
    [
      [-0.8, 0],
      [0.8, 0],
      [0, 0.68],
    ],
    0.06,
    [0, 1.85, shed.z1 + 0.03],
    '#e8d6b4',
  );
  lights.box([0.28, 0.08, 0.05], [0.62, 1.55, shed.z1 + 0.07], '#ffd38a');
  m.box([0.06, 0.06, 0.25], [0.62, 1.55, shed.z1 + 0.04], '#3a3f45');
  // Établi, planches empilées, barils.
  m.block(-0.8, 0.08, -2.25, 0.4, 0.68, -1.85, '#a5784c');
  for (let plank = 0; plank < 5; plank++) m.box([1.6, 0.06, 0.24], [-0.1, 0.12 + plank * 0.065, 2.7 + (plank % 2) * 0.05], '#d9b48a');
  for (const [bx, bz] of [[0.75, 2.05], [0.45, 2.35]]) {
    m.cylinder(0.2, 0.2, 0.5, [bx, 0.33, bz], '#8a5d3b', 10);
    m.torus(0.2, 0.02, [bx, 0.2, bz], '#3a3f45', [Math.PI / 2, 0, 0], 12);
    m.torus(0.2, 0.02, [bx, 0.46, bz], '#3a3f45', [Math.PI / 2, 0, 0], 12);
  }
  // Potence (le bras pivote, voir plus bas).
  m.cylinder(0.11, 0.14, 3.4, [-0.45, 1.78, -1.75], RED, 8);
  m.box([0.6, 0.12, 0.6], [-0.45, 0.14, -1.75], '#3a3f45');
  return { yard: m.build(), lights: lights.build(), shed };
}

function buildJib() {
  const m = new Maquette();
  m.box([3.0, 0.12, 0.12], [1.35, 0, 0], RED);
  m.rod([-0.05, 0.6, 0], [2.7, 0.0, 0], 0.02, '#3a3f45', 4);
  m.rod([0, -0.1, 0], [0, 0.7, 0], 0.05, RED, 6);
  return m.build();
}

function buildCharge() {
  const m = new Maquette();
  m.rod([0, 0, 0], [0, -1.3, 0], 0.012, '#3a3f45', 4);
  for (let plank = 0; plank < 4; plank++) m.box([1.1, 0.06, 0.2], [0, -1.4 - plank * 0.065, (plank % 2) * 0.04], '#d9b48a');
  return m.build();
}

/** Petit charpentier : corps, tête, bras qui frappe (marteau). */
function buildWorker() {
  const body = new Maquette();
  body.cylinder(0.13, 0.15, 0.42, [0, 0.5, 0], '#2f6fc0', 8);
  body.cylinder(0.07, 0.07, 0.3, [-0.06, 0.15, 0], '#3a3f45', 6);
  body.cylinder(0.07, 0.07, 0.3, [0.06, 0.15, 0], '#3a3f45', 6);
  body.sphere(0.14, [0, 0.86, 0], '#f2c9a0', 1);
  body.dome(0.15, [0, 0.9, 0], '#ffc83d', 10);
  const arm = new Maquette();
  arm.cylinder(0.04, 0.04, 0.32, [0, -0.15, 0], '#2f6fc0', 6);
  arm.rod([0, -0.3, 0], [0, -0.3, 0.26], 0.018, DARK_WOOD, 4);
  arm.box([0.08, 0.08, 0.12], [0, -0.3, 0.28], '#6c737c');
  return { body: body.build(), arm: arm.build() };
}

const SPARKS = 10;

export function Shipyard({ project }: { project: Project }) {
  const boat = useMemo(() => buildBoat(), []);
  const yard = useMemo(() => buildYard(), []);
  const jibGeometry = useMemo(() => buildJib(), []);
  const charge = useMemo(() => buildCharge(), []);
  const worker = useMemo(() => buildWorker(), []);
  const flag = useMemo(() => new MeshStandardMaterial({ map: gwennHaDu(), side: DoubleSide, roughness: 0.9 }), []);
  const signRotation = faceToward(SX, SZ, VIEWPOINT[0], VIEWPOINT[1]) - RY;
  const sign = useMemo(() => {
    const m = new Maquette();
    const text = signFrame(m, [0.75, 0.08, 3.1], signRotation, 1.8, 1.0);
    return { geometry: m.build(), text };
  }, [signRotation]);
  useEffect(
    () => () => {
      boat.dispose();
      yard.yard.dispose();
      yard.lights.dispose();
      jibGeometry.dispose();
      charge.dispose();
      worker.body.dispose();
      worker.arm.dispose();
      flag.map?.dispose();
      flag.dispose();
      sign.geometry.dispose();
    },
    [boat, charge, flag, jibGeometry, sign, worker, yard],
  );

  const jib = useRef<Group>(null);
  const swing = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const flagRef = useRef<Group>(null);
  const sparks = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const boatTilt = -Math.atan(SLOPE);
  const boatY = slipY(BOAT_X) + 0.45;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (jib.current) jib.current.rotation.y = 0.9 + Math.sin(t * 0.25) * 0.55;
    if (swing.current) swing.current.rotation.z = Math.sin(t * 1.2) * 0.08;
    // Coups de marteau : levée lente, frappe sèche.
    if (arm.current) {
      const beat = (t * 1.6) % 1;
      arm.current.rotation.x = beat < 0.7 ? -1.6 * (beat / 0.7) : -1.6 + 1.6 * ((beat - 0.7) / 0.3) ** 0.5;
    }
    if (flagRef.current) flagRef.current.rotation.y = Math.sin(t * 2.3) * 0.25 + 0.15;
    const target = sparks.current;
    if (target) {
      // Étincelles de soudure, par petites salves.
      const burst = (t * 0.8) % 1;
      for (let index = 0; index < SPARKS; index++) {
        const life = Math.min(1, burst * 2.2 + hash(index * 3.1) * 0.15);
        const a = hash(index * 7.3) * Math.PI * 2;
        const speed = 0.35 + hash(index * 1.9) * 0.4;
        dummy.position.set(Math.cos(a) * speed * life, life * 0.35 - life * life * 0.5, Math.sin(a) * speed * life);
        dummy.scale.setScalar(burst < 0.45 ? (1 - life) * 0.05 + 0.005 : 0.0001);
        dummy.updateMatrix();
        target.setMatrixAt(index, dummy.matrix);
      }
      target.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.04} position={[SX, SHIPYARD.level, SZ]} rotation={[0, RY, 0]}>
      <mesh geometry={yard.yard} material={paint} castShadow receiveShadow />
      <mesh geometry={yard.lights} material={glow} />
      {/* La réplique du bateau, sur sa cale (la proue vers le large). */}
      <group position={[BOAT_X, boatY, 0]} rotation={[0, 0, boatTilt]}>
        <mesh geometry={boat} material={paint} castShadow receiveShadow />
        <group ref={flagRef} position={[0.45, 2.95, 0]}>
          <mesh material={flag} position={[-0.32, -0.18, 0]} rotation-y={Math.PI}>
            <planeGeometry args={[0.6, 0.38]} />
          </mesh>
        </group>
        <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} position={[-1.65, 0.45, 0.55]} frustumCulled={false} raycast={() => null}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#fff3b0" emissive="#ffb347" emissiveIntensity={3} toneMapped={false} />
        </instancedMesh>
      </group>
      {/* Potence : le bras pivote, la charge de planches se balance. */}
      <group ref={jib} position={[-0.45, 3.45, -1.75]}>
        <mesh geometry={jibGeometry} material={paint} castShadow />
        <group ref={swing} position={[2.65, -0.02, 0]}>
          <mesh geometry={charge} material={paint} castShadow />
        </group>
      </group>
      {/* Charpentier au marteau, près de la poupe. */}
      <group position={[0.75, 0.08, 0.95]} rotation-y={-0.7}>
        <mesh geometry={worker.body} material={paint} castShadow />
        <group ref={arm} position={[0.16, 0.7, 0]}>
          <mesh geometry={worker.arm} material={paint} />
        </group>
      </group>
      <Plaque index={project.index} accent={project.accent} size={0.62} position={[0, 2.25, yard.shed.z1 + 0.07]} />
      <mesh geometry={sign.geometry} material={paint} castShadow />
      <SignText lines={[project.title]} accent={project.accent} width={1.8} position={sign.text} rotation={[0, signRotation, 0]} />
    </Hotspot>
  );
}

export const SHIPYARD_POSE = pose([SX, SHIPYARD.level, SZ], [0, RY, 0]);
