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
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
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
 * Les cinq étapes du voyage, lisibles depuis le bateau : sur chaque poteau, un grand
 * badge rond numéroté (couleur de l'étape), un gros pictogramme au sommet (ancre, code,
 * soleil, écran, fusée), un mot peint sur la planche et une lanterne au bout d'une
 * potence. Survol ou étape ouverte dans le carnet : le badge s'illumine et un halo
 * respire derrière lui. Clic : ouverture de l'étape dans le carnet, la lanterne
 * s'embrase, le pictogramme bondit en tournant, des étincelles jaillissent, un fanion
 * monte le long du mât et une note sonne (de plus en plus aiguë vers Marseille).
 */

const ACCENTS = ['#3f7fd0', '#3e9e68', '#e09a1c', '#e8713a', '#d4507f'];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880];

const POST = 1.05;
const SIGN_W = 2.0;
const BOARD_TOP = POST + SIGN_W / 2 - 0.04;
// Badge large et basculé vers la caméra à quai (vue plongeante) : le chiffre se lit de loin.
const BADGE_R = 0.78;
const BADGE_Y = BOARD_TOP + 1.1;
const BADGE_TILT = -0.38;
const ICON_Y = BADGE_Y + BADGE_R + 0.66;
const ICON_SCALE = 1.95;
const LANTERN_X = 1.27;
const PENNANT_X = -0.95;

/* ------------------------------------------------------------- pictogrammes */

function anchorIcon() {
  const kit = new Kit();
  const brass = '#e2ad3c';
  kit.add(BOX, brass, { position: [0, 0, 0], scale: [0.07, 0.5, 0.07] });
  kit.add(RING, brass, { position: [0, 0.3, 0], scale: [0.08, 0.08, 0.35] });
  kit.add(BOX, brass, { position: [0, 0.16, 0], scale: [0.32, 0.06, 0.06] });
  // Bras en arc et pattes.
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    kit.add(BOX, brass, { position: [Math.cos(a) * 0.2, -0.1 + Math.sin(a) * 0.2, 0], rotation: [0, 0, a + Math.PI / 2], scale: [0.1, 0.06, 0.06] });
  }
  for (const side of [-1, 1]) kit.add(CONE4, brass, { position: [side * 0.21, -0.04, 0], rotation: [0, 0, side * 0.5], scale: [0.1, 0.15, 0.06] });
  return kit.build();
}

function codeIcon() {
  const kit = new Kit();
  const green = '#3fc07f';
  // « </> » en bâtons : les deux chevrons pointent vers l'extérieur.
  for (const side of [-1, 1]) {
    kit.add(BOX, green, { position: [side * 0.21, 0.065, 0], rotation: [0, 0, side * 0.75], scale: [0.07, 0.21, 0.07] });
    kit.add(BOX, green, { position: [side * 0.21, -0.065, 0], rotation: [0, 0, side * -0.75], scale: [0.07, 0.21, 0.07] });
  }
  kit.add(BOX, '#f6f8f4', { position: [0, 0, 0], rotation: [0, 0, -0.42], scale: [0.065, 0.38, 0.07] });
  return kit.build();
}

function sunIcon() {
  const kit = new Kit();
  kit.add(CYL12, '#f5b52c', { rotation: [Math.PI / 2, 0, 0], scale: [0.16, 0.07, 0.16] });
  kit.add(CYL12, '#ffd970', { position: [0, 0, 0.037], rotation: [Math.PI / 2, 0, 0], scale: [0.11, 0.01, 0.11] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    kit.add(CONE4, '#f29a22', { position: [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0], rotation: [0, 0, a - Math.PI / 2], scale: [0.08, 0.13, 0.05] });
  }
  return kit.build();
}

function monitorIcon() {
  const kit = new Kit();
  kit.add(BOX, '#2c3038', { position: [0, 0.06, 0], scale: [0.46, 0.32, 0.05] });
  kit.add(BOX, '#57d2f5', { position: [0, 0.065, 0.027], scale: [0.4, 0.26, 0.01] });
  kit.add(BOX, '#f2f5f8', { position: [-0.08, 0.11, 0.035], scale: [0.17, 0.03, 0.005] });
  kit.add(BOX, '#ffd56a', { position: [0.04, 0.04, 0.035], scale: [0.22, 0.03, 0.005] });
  kit.add(BOX, '#2c3038', { position: [0, -0.16, 0], scale: [0.06, 0.14, 0.05] });
  kit.add(BOX, '#2c3038', { position: [0, -0.23, 0], scale: [0.22, 0.03, 0.13] });
  return kit.build();
}

function rocketIcon() {
  const kit = new Kit();
  kit.add(CYL12, '#f6f4f0', { position: [0, 0, 0], scale: [0.085, 0.3, 0.085] });
  kit.add(CONE8, '#e3454a', { position: [0, 0.22, 0], scale: [0.085, 0.15, 0.085] });
  kit.add(CYL12, '#5fb6e8', { position: [0, 0.05, 0.065], rotation: [Math.PI / 2, 0, 0], scale: [0.038, 0.04, 0.038] });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    kit.add(BOX, '#e3454a', { position: [Math.cos(a) * 0.095, -0.12, Math.sin(a) * 0.095], rotation: [0, -a, 0], scale: [0.1, 0.11, 0.022] });
  }
  kit.add(CONE8, '#ffb23c', { position: [0, -0.23, 0], rotation: [Math.PI, 0, 0], scale: [0.06, 0.13, 0.06] });
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    kit.add(OCTA, '#ffe08a', { position: [Math.cos(a) * 0.3, 0.12 + k * 0.08, Math.sin(a) * 0.13], scale: 0.04 });
  }
  return kit.build();
}

const ICONS = [anchorIcon, codeIcon, sunIcon, monitorIcon, rocketIcon];

/* ------------------------------------------------------------- poteau */

/** Prolongement du poteau, dos et cerclage du badge, potence et cage de la lanterne. */
function markerFrame(accent: string) {
  const kit = new Kit();
  const iron = '#24302b';
  // Le poteau monte derrière le badge (en retrait : il ne doit jamais masquer le chiffre).
  const postTop = BADGE_Y - 0.2;
  kit.add(CYL6, '#6e4a33', { position: [0, (BOARD_TOP - 0.05 + postTop) / 2, -0.13], scale: [0.075, postTop - BOARD_TOP + 0.05, 0.075] });
  const badge = { position: [0, BADGE_Y, -0.03] as [number, number, number], rotation: [Math.PI / 2 + BADGE_TILT, 0, 0] as [number, number, number] };
  kit.add(CYL12, '#3b2a1e', { ...badge, scale: [BADGE_R + 0.06, 0.07, BADGE_R + 0.06] });
  kit.add(RING, accent, { position: [0, BADGE_Y, 0.0], rotation: [BADGE_TILT, 0, 0], scale: [BADGE_R + 0.03, BADGE_R + 0.03, 0.5] });
  // Potence en fonte (vert sombre, comme les réverbères de l'archipel) et cage de la
  // lanterne, suspendue à droite du panneau.
  const arm = BOARD_TOP + 0.38;
  kit.add(BOX, iron, { position: [LANTERN_X / 2, arm, 0], scale: [LANTERN_X + 0.04, 0.045, 0.045] });
  kit.add(BOX, iron, { position: [0.32, arm - 0.13, 0], rotation: [0, 0, 0.44], scale: [0.62, 0.03, 0.03] });
  kit.add(BOX, iron, { position: [LANTERN_X, arm - 0.07, 0], scale: [0.02, 0.14, 0.02] });
  kit.add(CONE4, iron, { position: [LANTERN_X, arm - 0.2, 0], scale: [0.27, 0.13, 0.27] });
  kit.add(BOX, iron, { position: [LANTERN_X, arm - 0.56, 0], scale: [0.2, 0.03, 0.2] });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    kit.add(BOX, iron, { position: [LANTERN_X + x * 0.075, arm - 0.4, z * 0.075], scale: [0.02, 0.32, 0.02] });
  }
  // Hampe du fanion, à gauche du badge.
  kit.add(CYL6, '#d8d2c6', { position: [PENNANT_X + 0.01, BOARD_TOP + 0.42, 0], scale: [0.018, 0.8, 0.018] });
  return kit.build();
}

/** Face du badge : la case du chiffre dans la planche des cinq badges. */
function badgeGeometry(index: number) {
  const disc = new CircleGeometry(BADGE_R - 0.01, 32);
  const uv = disc.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setX(k, (index + uv.getX(k)) / 5);
  return disc;
}

/** Fanion triangulaire. */
const PENNANT = (() => {
  const geometry = new BufferGeometry();
  geometry.setFromPoints([new Vector3(0, 0.14, 0), new Vector3(0, -0.14, 0), new Vector3(0.46, 0, 0)]);
  geometry.computeVertexNormals();
  return geometry;
})();

const HALO = new RingGeometry(BADGE_R + 0.08, BADGE_R + 0.32, 40);

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
      dummy.position.set(sparkState.x + dir.x * age, sparkState.y + dir.y * age - age * age * 1.6, sparkState.z + dir.z * age);
      dummy.rotation.set(age * 6 + index, age * 4, 0);
      dummy.scale.setScalar((0.07 + hash(index) * 0.05) * (1 - life * 0.7));
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

/** Horloge de la scène, lisible depuis un gestionnaire de clic. */
const sceneClock = { now: 0 };

function StepMarker({
  step,
  index,
  position,
  yaw,
  atlas,
}: {
  step: JourneyStep;
  index: number;
  position: [number, number, number];
  yaw: number;
  atlas: MeshStandardMaterial['map'];
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  const frame = useMemo(() => markerFrame(accent), [accent]);
  const icon = useMemo(() => ICONS[index % ICONS.length](), [index]);
  const face = useMemo(() => badgeGeometry(index), [index]);
  const badge = useRef<MeshStandardMaterial>(null);
  const glass = useRef<MeshStandardMaterial>(null);
  const halo = useRef<Mesh>(null);
  const haloMaterial = useRef<MeshBasicMaterial>(null);
  const iconGroup = useRef<Group>(null);
  const pennant = useRef<Group>(null);
  const clickedAt = useRef(-10);
  const visited = useRef(false);
  const hovered = useRef(false);
  const glow = useRef(0);
  const focused = useFocusedItem('journey') === step.id;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    const since = t - clickedAt.current;
    const flare = since >= 0 ? Math.max(0, 1 - since / 1.8) : 0;
    const night = skyState.dayNight;
    // Le petit voyageur fait briller la lanterne quand il passe.
    const near = Math.max(0, 1 - Math.hypot(walkerState.x - position[0], walkerState.z - position[2]) / 1.8) * walkerState.presence;
    const goal = Math.max(hovered.current ? 1 : 0, focused ? 0.85 + Math.sin(t * 2.6) * 0.15 : 0, flare);
    glow.current += (goal - glow.current) * (1 - Math.exp(-7 * dt));
    if (badge.current) badge.current.emissiveIntensity = 0.16 + night * 0.55 + glow.current * 0.75;
    if (glass.current) glass.current.emissiveIntensity = 0.3 + night * 2.6 + flare * 4 + near * 1.6 + glow.current * 0.8;
    if (halo.current && haloMaterial.current) {
      halo.current.visible = glow.current > 0.02;
      halo.current.scale.setScalar(0.92 + glow.current * 0.1 + Math.sin(t * 3.2) * 0.04 * glow.current);
      haloMaterial.current.opacity = glow.current * 0.55;
    }
    const target = iconGroup.current;
    if (target) {
      const hop = since >= 0 && since < 1 ? Math.sin(since * Math.PI) * 0.5 : 0;
      target.position.y = ICON_Y + hop + Math.sin(t * 1.6 + index) * 0.05;
      const spin = since >= 0 && since < 1 ? since * Math.PI * 2 : 0;
      target.rotation.y = Math.sin(t * 0.8 + index) * 0.45 + spin + (focused ? t * 1.4 : 0);
    }
    const flag = pennant.current;
    if (flag) {
      const top = visited.current || focused ? BOARD_TOP + 0.74 : BOARD_TOP + 0.14;
      flag.position.y += (top - flag.position.y) * (1 - Math.exp(-3 * dt));
      flag.rotation.y = Math.sin(t * 2.2 + index) * 0.25;
      flag.scale.x = 0.9 + Math.sin(t * 5 + index) * 0.1;
    }
  });

  const activate = () => {
    visited.current = true;
    focusItem('journey', step.id);
    const base = NOTES[index % NOTES.length];
    ambience.chime([base, base * 1.25, base * 1.5], 0.08);
    clickedAt.current = sceneClock.now;
    sparkState.x = position[0];
    sparkState.y = position[1] + BADGE_Y + 0.3;
    sparkState.z = position[2];
    sparkState.at = sceneClock.now;
    sparkState.color = accent;
  };

  return (
    <group position={position} rotation-y={yaw}>
      <Hotspot onActivate={activate} hoverScale={1.06}>
        <group
          onPointerOver={() => {
            hovered.current = true;
          }}
          onPointerOut={() => {
            hovered.current = false;
          }}
        >
          <PaintedSign lines={[step.marker]} position={[0, 0, 0]} rotation={0} accent={accent} width={SIGN_W} post={POST} />
          <mesh geometry={frame} material={flatPaint} castShadow />
          {atlas && (
            <mesh geometry={face} position={[0, BADGE_Y, 0.012]} rotation-x={BADGE_TILT}>
              <meshStandardMaterial ref={badge} map={atlas} emissive="#ffffff" emissiveMap={atlas} emissiveIntensity={0.2} roughness={0.6} />
            </mesh>
          )}
          <mesh ref={halo} geometry={HALO} position={[0, BADGE_Y, -0.06]} rotation-x={BADGE_TILT} visible={false} raycast={() => null}>
            <meshBasicMaterial ref={haloMaterial} color={accent} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
          </mesh>
          <mesh position={[LANTERN_X, BOARD_TOP + 0.38 - 0.4, 0]}>
            <boxGeometry args={[0.13, 0.26, 0.13]} />
            <meshStandardMaterial ref={glass} color="#fff1c9" emissive="#ffb347" emissiveIntensity={0.4} roughness={0.3} />
          </mesh>
          <group ref={iconGroup} position={[0, ICON_Y, 0]} scale={ICON_SCALE}>
            <mesh geometry={icon} material={flatPaint} castShadow />
          </group>
          <group ref={pennant} position={[PENNANT_X, BOARD_TOP + 0.14, 0]}>
            <mesh geometry={PENNANT} scale-x={-1}>
              <meshStandardMaterial color={accent} roughness={0.8} side={DoubleSide} />
            </mesh>
          </group>
          {/* Volume de clic généreux (invisible). */}
          <mesh position={[0, (ICON_Y + 0.4) / 2, 0]} visible={false}>
            <boxGeometry args={[SIGN_W + 0.7, ICON_Y + 0.6, 0.9]} />
          </mesh>
        </group>
      </Hotspot>
    </group>
  );
}

export function Markers({ sampler }: { sampler: HeightSampler }) {
  const family = useHandFont();
  const atlas = useMemo(() => (family ? stepDigits(family, ACCENTS) : null), [family]);
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
          <StepMarker step={step} index={index} position={position} yaw={yaw} atlas={atlas} />
        </group>
      ))}
      <Sparks />
    </group>
  );
}
