'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { journey } from '@/data/journey';
import { ambience } from '@/lib/audio/ambience';
import { focusItem, useFocusedItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import type { JourneyStep } from '@/types';
import { ClearingAt, Hotspot, on, PaintedSign, useHandFont } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { BOX, CONE4, CONE8, CYL6, CYL12, Kit, OCTA, RING } from './geometry';
import { flatPaint } from './materials';
import { faceCamera } from './place';
import { deckHeight } from './route';
import { fromFrame, STEP_SPOTS } from './terrain';
import { stepDigits } from './textures';
import { walkerState } from './Walker';

/**
 * Les cinq étapes du voyage : une lanterne sur un poteau indicateur peint (repère et
 * titre tirés de data/journey.ts), un médaillon numéroté et un petit emblème au sommet.
 * Un clic ouvre l'étape dans le carnet : la lanterne s'embrase, l'emblème bondit en
 * tournant, des étincelles jaillissent, un fanion monte le long du mât et une petite
 * note sonne (de plus en plus aiguë du Morbihan à Marseille).
 */

const ACCENTS = ['#4f8bd6', '#4fa774', '#e2a82e', '#ec8445', '#d8628e'];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880];

const POST = 1.0;
const SIGN_W = 2.3;
const BOARD_TOP = POST + SIGN_W / 2 - 0.04;
const LANTERN_Y = BOARD_TOP + 0.95;
const ICON_Y = LANTERN_Y + 0.9;

/* ------------------------------------------------------------- emblèmes */

function anchorIcon() {
  const kit = new Kit();
  const brass = '#d9a83f';
  kit.add(BOX, brass, { position: [0, 0, 0], scale: [0.06, 0.5, 0.06] });
  kit.add(RING, brass, { position: [0, 0.3, 0], scale: [0.07, 0.07, 0.3] });
  kit.add(BOX, brass, { position: [0, 0.17, 0], scale: [0.3, 0.05, 0.05] });
  // Bras en arc et pattes.
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    kit.add(BOX, brass, { position: [Math.cos(a) * 0.19, -0.1 + Math.sin(a) * 0.19, 0], rotation: [0, 0, a + Math.PI / 2], scale: [0.09, 0.05, 0.05] });
  }
  for (const side of [-1, 1]) kit.add(CONE4, brass, { position: [side * 0.2, -0.04, 0], rotation: [0, 0, side * 0.5], scale: [0.09, 0.14, 0.05] });
  return kit.build();
}

function codeIcon() {
  const kit = new Kit();
  const green = '#46b37a';
  // « </> » en bâtons.
  for (const side of [-1, 1]) {
    kit.add(BOX, green, { position: [side * 0.2, 0.06, 0], rotation: [0, 0, side * -0.75], scale: [0.06, 0.2, 0.06] });
    kit.add(BOX, green, { position: [side * 0.2, -0.06, 0], rotation: [0, 0, side * 0.75], scale: [0.06, 0.2, 0.06] });
  }
  kit.add(BOX, '#f2f5f2', { position: [0, 0, 0], rotation: [0, 0, -0.42], scale: [0.055, 0.36, 0.06] });
  return kit.build();
}

function sunIcon() {
  const kit = new Kit();
  kit.add(CYL12, '#f2b632', { rotation: [Math.PI / 2, 0, 0], scale: [0.15, 0.06, 0.15] });
  kit.add(CYL12, '#ffd56a', { position: [0, 0, 0.032], rotation: [Math.PI / 2, 0, 0], scale: [0.1, 0.01, 0.1] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    kit.add(CONE4, '#f2a52c', { position: [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0], rotation: [0, 0, a - Math.PI / 2], scale: [0.07, 0.12, 0.04] });
  }
  return kit.build();
}

function monitorIcon() {
  const kit = new Kit();
  kit.add(BOX, '#2c3038', { position: [0, 0.06, 0], scale: [0.44, 0.3, 0.04] });
  kit.add(BOX, '#5fd0f2', { position: [0, 0.065, 0.022], scale: [0.39, 0.25, 0.01] });
  kit.add(BOX, '#f2f5f8', { position: [-0.08, 0.1, 0.03], scale: [0.16, 0.025, 0.005] });
  kit.add(BOX, '#ffd56a', { position: [0.03, 0.04, 0.03], scale: [0.2, 0.025, 0.005] });
  kit.add(BOX, '#2c3038', { position: [0, -0.15, 0], scale: [0.05, 0.14, 0.04] });
  kit.add(BOX, '#2c3038', { position: [0, -0.22, 0], scale: [0.2, 0.025, 0.12] });
  return kit.build();
}

function rocketIcon() {
  const kit = new Kit();
  kit.add(CYL12, '#f4f2ee', { position: [0, 0, 0], scale: [0.08, 0.3, 0.08] });
  kit.add(CONE8, '#e0484a', { position: [0, 0.22, 0], scale: [0.08, 0.15, 0.08] });
  kit.add(CYL12, '#5fb6e8', { position: [0, 0.05, 0.06], rotation: [Math.PI / 2, 0, 0], scale: [0.035, 0.04, 0.035] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    kit.add(BOX, '#e0484a', { position: [Math.cos(a) * 0.09, -0.12, Math.sin(a) * 0.09], rotation: [0, -a, 0], scale: [0.09, 0.1, 0.02] });
  }
  kit.add(CONE8, '#ffb23c', { position: [0, -0.22, 0], rotation: [Math.PI, 0, 0], scale: [0.055, 0.12, 0.055] });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    kit.add(OCTA, '#ffe08a', { position: [Math.cos(a) * 0.28, 0.12 + k * 0.08, Math.sin(a) * 0.12], scale: 0.035 });
  }
  return kit.build();
}

const ICONS = [anchorIcon, codeIcon, sunIcon, monitorIcon, rocketIcon];

/* ------------------------------------------------------------- poteau */

function markerFrame(accent: string) {
  const kit = new Kit();
  const iron = '#2b2d33';
  // Prolongement du poteau au-dessus du panneau, médaillon cerclé à la couleur de l'étape.
  kit.add(CYL6, '#6e4a33', { position: [0, (BOARD_TOP + LANTERN_Y) / 2, 0], scale: [0.075, LANTERN_Y - BOARD_TOP + 0.1, 0.075] });
  kit.add(CYL12, accent, { position: [0, BOARD_TOP + 0.38, 0.06], rotation: [Math.PI / 2, 0, 0], scale: [0.3, 0.06, 0.3] });
  // Lanterne : socle, montants, toit pyramidal, anneau.
  kit.add(BOX, iron, { position: [0, LANTERN_Y - 0.02, 0], scale: [0.34, 0.05, 0.34] });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    kit.add(BOX, iron, { position: [x * 0.13, LANTERN_Y + 0.2, z * 0.13], scale: [0.03, 0.4, 0.03] });
  }
  kit.add(CONE4, iron, { position: [0, LANTERN_Y + 0.5, 0], scale: [0.42, 0.24, 0.42] });
  kit.add(RING, iron, { position: [0, LANTERN_Y + 0.66, 0], scale: [0.06, 0.06, 0.3] });
  // Hampe du fanion.
  kit.add(CYL6, '#d8d2c6', { position: [0.13, BOARD_TOP + 0.45, -0.02], scale: [0.018, 0.85, 0.018] });
  return kit.build();
}

/** Médaillon : la case du chiffre dans la planche des cinq chiffres. */
function medallionGeometry(index: number) {
  const disc = new CircleGeometry(0.25, 24);
  const uv = disc.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (index + uv.getX(k)) / 5);
  return disc;
}

/** Fanion triangulaire. */
function pennantGeometry() {
  const geometry = new BufferGeometry();
  geometry.setFromPoints([new Vector3(0, 0.13, 0), new Vector3(0, -0.13, 0), new Vector3(0.42, 0, 0)]);
  geometry.computeVertexNormals();
  return geometry;
}
const PENNANT = pennantGeometry();

/* ------------------------------------------------------------- étincelles */

const SPARKS = 18;
const sparkState = { x: 0, y: -100, z: 0, at: -10, color: '#ffd56a' };
const SPARK_MATERIAL = new MeshBasicMaterial({ color: '#ffe39a', transparent: true, blending: AdditiveBlending, depthWrite: false });
const WHITE = new Color('#ffffff');
const SPARK_DIRS = Array.from({ length: SPARKS }, (_, index) => {
  const a = hash(index * 3.17) * Math.PI * 2;
  const up = 0.35 + hash(index * 5.71) * 0.65;
  const r = Math.sqrt(1 - up * up);
  return new Vector3(Math.cos(a) * r, up, Math.sin(a) * r).multiplyScalar(1.4 + hash(index * 7.3) * 1.4);
});

function Sparks() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const age = state.clock.elapsedTime - sparkState.at;
    target.visible = age >= 0 && age < 1.5;
    if (!target.visible) return;
    const life = age / 1.5;
    SPARK_MATERIAL.color.set(sparkState.color).lerp(WHITE, 0.35);
    SPARK_MATERIAL.opacity = 1 - life * life;
    for (let index = 0; index < SPARKS; index++) {
      const dir = SPARK_DIRS[index];
      dummy.position.set(
        sparkState.x + dir.x * age,
        sparkState.y + dir.y * age - age * age * 1.6,
        sparkState.z + dir.z * age,
      );
      dummy.rotation.set(age * 6 + index, age * 4, 0);
      dummy.scale.setScalar((0.06 + hash(index) * 0.05) * (1 - life * 0.7));
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, SPARK_MATERIAL, SPARKS]} frustumCulled={false} visible={false} raycast={() => null}>
      <octahedronGeometry args={[1, 0]} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------- un repère */

function StepMarker({
  step,
  index,
  position,
  yaw,
  digits,
}: {
  step: JourneyStep;
  index: number;
  position: [number, number, number];
  yaw: number;
  digits: MeshStandardMaterial | null;
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  const frame = useMemo(() => markerFrame(accent), [accent]);
  const icon = useMemo(() => ICONS[index % ICONS.length](), [index]);
  const medallion = useMemo(() => medallionGeometry(index), [index]);
  const glass = useRef<MeshStandardMaterial>(null);
  const iconGroup = useRef<Group>(null);
  const pennant = useRef<Group>(null);
  const clickedAt = useRef(-10);
  const visited = useRef(false);
  const focused = useFocusedItem('journey') === step.id;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    const since = t - clickedAt.current;
    const flare = since >= 0 ? Math.max(0, 1 - since / 1.8) : 0;
    const night = skyState.dayNight;
    // Le petit voyageur fait briller la lanterne quand il passe.
    const near = Math.max(0, 1 - Math.hypot(walkerState.x - position[0], walkerState.z - position[2]) / 1.8) * walkerState.presence;
    if (glass.current) {
      glass.current.emissiveIntensity = 0.35 + night * 2.4 + flare * 4.5 + near * 1.6
        + (focused ? 1.2 + Math.sin(t * 3) * 0.4 : 0);
    }
    const target = iconGroup.current;
    if (target) {
      const hop = since >= 0 && since < 1 ? Math.sin(since * Math.PI) * 0.45 : 0;
      target.position.y = ICON_Y + hop + Math.sin(t * 1.6 + index) * 0.04;
      const spin = since >= 0 && since < 1 ? since * Math.PI * 2 : 0;
      target.rotation.y = Math.sin(t * 0.8 + index) * 0.5 + spin + (focused ? t * 1.5 : 0);
    }
    const flag = pennant.current;
    if (flag) {
      const goal = visited.current || focused ? BOARD_TOP + 0.78 : BOARD_TOP + 0.12;
      flag.position.y += (goal - flag.position.y) * (1 - Math.exp(-3 * dt));
      flag.rotation.y = Math.sin(t * 2.2 + index) * 0.25;
      flag.scale.x = 0.9 + Math.sin(t * 5 + index) * 0.1;
    }
  });

  const activate = () => {
    visited.current = true;
    focusItem('journey', step.id);
    const base = NOTES[index % NOTES.length];
    ambience.chime([base, base * 1.25, base * 1.5], 0.08);
    // Les horloges de R3F et du clic diffèrent : on part de l'horloge de la scène.
    clickedAt.current = sceneClock.now;
    const [x, y, z] = position;
    sparkState.x = x;
    sparkState.y = y + LANTERN_Y + 0.2;
    sparkState.z = z;
    sparkState.at = sceneClock.now;
    sparkState.color = accent;
  };

  return (
    <group position={position} rotation-y={yaw}>
      <Hotspot onActivate={activate} hoverScale={1.07}>
        <PaintedSign lines={[step.marker, step.title]} position={[0, 0, 0]} rotation={0} accent={accent} width={SIGN_W} post={POST} />
        <mesh geometry={frame} material={flatPaint} castShadow />
        {digits && <mesh geometry={medallion} material={digits} position={[0, BOARD_TOP + 0.38, 0.095]} />}
        <mesh position={[0, LANTERN_Y + 0.2, 0]}>
          <boxGeometry args={[0.24, 0.36, 0.24]} />
          <meshStandardMaterial ref={glass} color="#fff1c9" emissive="#ffb347" emissiveIntensity={0.4} roughness={0.3} />
        </mesh>
        <group ref={iconGroup} position={[0, ICON_Y, 0]}>
          <mesh geometry={icon} material={flatPaint} castShadow />
        </group>
        <group ref={pennant} position={[0.14, BOARD_TOP + 0.12, -0.02]}>
          <mesh geometry={PENNANT}>
            <meshStandardMaterial color={accent} roughness={0.8} side={DoubleSide} />
          </mesh>
        </group>
        {/* Volume de clic généreux (invisible). */}
        <mesh position={[0, ICON_Y / 2, 0]} visible={false}>
          <boxGeometry args={[SIGN_W + 0.2, ICON_Y + 0.5, 0.8]} />
        </mesh>
      </Hotspot>
    </group>
  );
}

/** Horloge de la scène, lisible depuis un gestionnaire de clic. */
const sceneClock = { now: 0 };

export function Markers({ sampler }: { sampler: HeightSampler }) {
  const family = useHandFont();
  const digits = useMemo(() => (family ? new MeshStandardMaterial({ map: stepDigits(family), roughness: 0.7 }) : null), [family]);
  const spots = journey.map((step, index) => {
    const [u, v] = STEP_SPOTS[step.id] ?? [0, 0];
    const [x, z] = fromFrame(u, v);
    // L'étape du passage se tient sur le dos du pont.
    const position: [number, number, number] = step.id === 'marseille' ? [x, deckHeight(0) - 0.02, z] : on(sampler, x, z, 0.35, 0.04);
    return { step, index, x, z, position, yaw: faceCamera(x, z) };
  });
  useFrame((state) => {
    sceneClock.now = state.clock.elapsedTime;
  });
  return (
    <group>
      {spots.map(({ step, index, x, z, position, yaw }) => (
        <group key={step.id}>
          {position[1] > 2.3 && step.id !== 'marseille' && <ClearingAt x={x} z={z} radius={1.3} />}
          <StepMarker step={step} index={index} position={position} yaw={yaw} digits={digits} />
        </group>
      ))}
      <Sparks />
    </group>
  );
}
