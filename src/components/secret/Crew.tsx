'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { skyState } from '@/lib/sky';
import { smoothstep } from '@/lib/utils/math';
import { merge, part } from './geo';
import { GLOW, setGlow } from './Glows';
import { CONSOLE, RIFT, groundSite } from './layout';

/**
 * L'équipe : quatre scientifiques en combinaison jaune et masque à gaz, comme des jouets.
 *  - le caméraman filme la faille, caméscope à l'épaule, diode REC qui clignote ;
 *  - l'opérateur, à sa console, tape et surveille ses trois écrans ;
 *  - deux scientifiques de terrain : l'un balaie le sol au détecteur, l'autre fait sa
 *    ronde le long de la maison, lampe torche braquée sur les fenêtres.
 *
 * Quatre InstancedMesh (bustes, jambes, têtes, bras) pour les quatre corps : les poses sont
 * recalculées à chaque image (16 matrices), les accessoires suivent les mains.
 */

const SUIT = '#e2bd2c';
const SUIT_DARK = '#b8961f';
const RUBBER = '#25282b';
const GLASS = '#3b5a60';
const STEEL = '#9a9fa1';
const STRIPE = '#d8dbcf';
const TANK = '#d2d4cd';

/* ---------------------------------------------------------------- géométries */

function bodyGeometry() {
  return merge([
    part(new SphereGeometry(0.2, 10, 8), SUIT, { at: [0, 0.9, 0], scale: [1, 0.62, 0.78] }),
    part(new CylinderGeometry(0.205, 0.18, 0.58, 10), SUIT, { at: [0, 1.16, 0], scale: [1, 1, 0.76] }),
    part(new SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), SUIT, { at: [0, 1.44, 0], scale: [1, 0.5, 0.76] }),
    part(new CylinderGeometry(0.194, 0.194, 0.07, 10), RUBBER, { at: [0, 0.95, 0], scale: [1, 1, 0.8] }),
    part(new CylinderGeometry(0.203, 0.203, 0.05, 10), STRIPE, { at: [0, 1.26, 0], scale: [1, 1, 0.78] }),
    part(new CylinderGeometry(0.085, 0.085, 0.5, 8), TANK, { at: [0, 1.16, -0.2] }),
    part(new CylinderGeometry(0.03, 0.03, 0.09, 6), RUBBER, { at: [0, 1.45, -0.2] }),
    part(new BoxGeometry(0.05, 0.42, 0.03), RUBBER, { at: [-0.1, 1.2, -0.13] }),
    part(new BoxGeometry(0.05, 0.42, 0.03), RUBBER, { at: [0.1, 1.2, -0.13] }),
    part(new CylinderGeometry(0.1, 0.12, 0.08, 8), RUBBER, { at: [0, 1.5, 0] }),
  ]);
}

/** Jambe : pivot à la hanche, pend vers -Y, botte en caoutchouc. */
function legGeometry() {
  return merge([
    part(new CylinderGeometry(0.09, 0.078, 0.72, 8), SUIT, { at: [0, -0.36, 0] }),
    part(new CylinderGeometry(0.084, 0.084, 0.045, 8), STRIPE, { at: [0, -0.5, 0] }),
    part(new CylinderGeometry(0.083, 0.083, 0.2, 8), RUBBER, { at: [0, -0.7, 0] }),
    part(new BoxGeometry(0.15, 0.12, 0.27), RUBBER, { at: [0, -0.8, 0.045] }),
  ]);
}

/** Tête : capuche, masque à gaz noir, deux oculaires, cartouche filtrante. Pivot au cou. */
function headGeometry() {
  return merge([
    part(new SphereGeometry(0.172, 12, 10), SUIT, { at: [0, 0.17, -0.015], scale: [1, 1.1, 1] }),
    part(new SphereGeometry(0.128, 12, 8), RUBBER, { at: [0, 0.14, 0.085], scale: [1.02, 1.05, 0.72] }),
    part(new CylinderGeometry(0.046, 0.046, 0.03, 12), GLASS, { at: [-0.056, 0.185, 0.168], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.046, 0.046, 0.03, 12), GLASS, { at: [0.056, 0.185, 0.168], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.06, 0.052, 0.1, 10), STEEL, { at: [0, 0.07, 0.19], rot: [Math.PI / 2 - 0.35, 0, 0] }),
    part(new CylinderGeometry(0.062, 0.062, 0.022, 10), SUIT_DARK, { at: [0, 0.052, 0.24], rot: [Math.PI / 2 - 0.35, 0, 0] }),
  ]);
}

/** Bras : pivot à l'épaule, pend vers -Y, gant noir. */
function armGeometry() {
  return merge([
    part(new SphereGeometry(0.078, 8, 6), SUIT, { at: [0, -0.02, 0] }),
    part(new CylinderGeometry(0.07, 0.058, 0.48, 8), SUIT, { at: [0, -0.26, 0] }),
    part(new CylinderGeometry(0.063, 0.063, 0.05, 8), RUBBER, { at: [0, -0.49, 0] }),
    part(new SphereGeometry(0.064, 8, 6), RUBBER, { at: [0, -0.56, 0.005], scale: [0.9, 1.1, 0.8] }),
  ]);
}

/** Caméscope : objectif vers +Z, poignée sur le dessus. Origine dans la main. */
function camcorderGeometry() {
  return merge([
    part(new BoxGeometry(0.13, 0.14, 0.32), '#2f3134', { at: [0, 0.07, 0.06] }),
    part(new CylinderGeometry(0.058, 0.062, 0.11, 12), '#18191b', { at: [0, 0.08, 0.27], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.046, 0.046, 0.012, 12), '#6c8f96', { at: [0, 0.08, 0.33], rot: [Math.PI / 2, 0, 0] }),
    part(new BoxGeometry(0.05, 0.05, 0.1), '#18191b', { at: [-0.075, 0.12, -0.08] }),
    part(new BoxGeometry(0.03, 0.03, 0.2), '#3a3c40', { at: [0, 0.165, 0.05] }),
    part(new BoxGeometry(0.035, 0.08, 0.1), '#43464a', { at: [0.085, 0.07, 0.02] }),
  ]);
}

/** Détecteur de terrain : boîtier, écran, canne de mesure vers +Z. */
function scannerGeometry() {
  return merge([
    part(new BoxGeometry(0.1, 0.07, 0.18), '#34393c', { at: [0, 0.02, 0.02] }),
    part(new BoxGeometry(0.075, 0.012, 0.09), '#7fd0a0', { at: [0, 0.058, 0.04] }, 0.7),
    part(new CylinderGeometry(0.012, 0.012, 0.36, 6), STEEL, { at: [0, 0.0, 0.28], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.045, 0.03, 0.05, 10), SUIT, { at: [0, 0.0, 0.47], rot: [Math.PI / 2, 0, 0] }),
  ]);
}

/** Lampe torche : faisceau vers +Z. */
function flashlightGeometry() {
  return merge([
    part(new CylinderGeometry(0.034, 0.034, 0.22, 10), '#2b2e30', { at: [0, 0, 0.04], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.055, 0.04, 0.07, 12), '#3a3d40', { at: [0, 0, 0.18], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.048, 0.048, 0.01, 12), '#fff6d8', { at: [0, 0, 0.217], rot: [Math.PI / 2, 0, 0] }),
  ]);
}

/** Faisceau : cône ouvert, pointe à l'origine, il s'évase vers +Z. */
function beamGeometry() {
  const cone = new ConeGeometry(0.85, 3.6, 18, 1, true);
  cone.translate(0, -1.8, 0);
  cone.rotateX(-Math.PI / 2);
  return cone;
}

const BEAM_VERTEX = /* glsl */ `
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vAlong = position.z / 3.6;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const BEAM_FRAGMENT = /* glsl */ `
uniform float uNight;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
  float fade = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.08, vAlong);
  float strength = fade * pow(facing, 1.4) * (0.06 + uNight * 0.42);
  gl_FragColor = vec4(vec3(1.0, 0.94, 0.74) * strength, 1.0);
}
`;

/* ----------------------------------------------------------------- matériaux */

let shared: {
  body: BufferGeometry;
  leg: BufferGeometry;
  head: BufferGeometry;
  arm: BufferGeometry;
  camcorder: BufferGeometry;
  scanner: BufferGeometry;
  flashlight: BufferGeometry;
  beam: BufferGeometry;
  suit: MeshStandardMaterial;
  beamMaterial: ShaderMaterial;
} | null = null;

const beamUniforms = { uNight: { value: 0 } };

function crewKit() {
  shared ??= {
    body: bodyGeometry(),
    leg: legGeometry(),
    head: headGeometry(),
    arm: armGeometry(),
    camcorder: camcorderGeometry(),
    scanner: scannerGeometry(),
    flashlight: flashlightGeometry(),
    beam: beamGeometry(),
    suit: new MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0 }),
    beamMaterial: new ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  };
  return shared;
}

/* --------------------------------------------------------------------- poses */

const SHOULDER_Y = 1.38;
const HIP_Y = 0.88;
const NECK_Y = 1.52;

const euler = new Euler();
const quat = new Quaternion();
const offset = new Vector3();
const unit = new Vector3(1, 1, 1);
const step = new Matrix4();
const rootMatrix = new Matrix4();
const work = new Matrix4();
const armRight = new Matrix4();
const armLeft = new Matrix4();
const point = new Vector3();
const REC_RED = new Color('#ff2a1f');
const SCAN_GREEN = new Color('#7dff9e');
const LAMP_WARM = new Color('#fff1c4');

/** out = parent × T(x, y, z) × R(yaw, pitch, roll) (ordre YXZ). */
function child(out: Matrix4, parent: Matrix4, x: number, y: number, z: number, pitch = 0, yaw = 0, roll = 0) {
  euler.set(pitch, yaw, roll, 'YXZ');
  quat.setFromEuler(euler);
  offset.set(x, y, z);
  step.compose(offset, quat, unit);
  return out.multiplyMatrices(parent, step);
}

interface Pose {
  x: number;
  z: number;
  yaw: number;
  bob: number;
  sway: number;
  stride: number;
  head: [number, number];
  /** Bras droit puis gauche : [tangage, lacet, roulis]. */
  right: [number, number, number];
  left: [number, number, number];
}

const poses: Pose[] = Array.from({ length: 4 }, () => ({
  x: 0,
  z: 0,
  yaw: 0,
  bob: 0,
  sway: 0,
  stride: 0,
  head: [0, 0],
  right: [0, 0, 0],
  left: [0, 0, 0],
}));

const CAMERAMAN = { x: -0.95, z: 3.85 };
const OPERATOR = { x: CONSOLE.x, z: CONSOLE.z + 0.8 };
const SCANNER = { x: -2.85, z: 2.2 };
const WALK_A = { x: 3.2, z: 1.45 };
const WALK_B = { x: 3.2, z: -2.15 };
const WALK = 6.6;
const PAUSE = 3.4;

function facing(fromX: number, fromZ: number, toX: number, toZ: number) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

const CAMERAMAN_YAW = facing(CAMERAMAN.x, CAMERAMAN.z, RIFT.x, RIFT.z);
const SCANNER_YAW = facing(SCANNER.x, SCANNER.z, -1.3, 0.95);
const LOOK_AT_HOUSE = facing(WALK_B.x, WALK_B.z, 2.1, -1.4);
const LOOK_AT_RIFT = facing(WALK_A.x, WALK_A.z, RIFT.x + 0.4, RIFT.z + 0.6);

function shortest(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function Crew() {
  const bodies = useRef<InstancedMesh>(null);
  const legs = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const camcorder = useRef<Mesh>(null);
  const scanner = useRef<Mesh>(null);
  const flashlight = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const walkerYaw = useRef(Math.PI);
  const kit = useMemo(() => crewKit(), []);

  useLayoutEffect(() => {
    for (const mesh of [bodies.current, legs.current, heads.current, arms.current]) {
      if (mesh) mesh.frustumCulled = false;
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    beamUniforms.uNight.value = night;

    // 0 — le caméraman : caméscope à hauteur d'œil, il suit la faille.
    const cameraman = poses[0];
    cameraman.x = CAMERAMAN.x;
    cameraman.z = CAMERAMAN.z;
    cameraman.yaw = CAMERAMAN_YAW + Math.sin(time * 0.45) * 0.07;
    cameraman.bob = Math.sin(time * 1.6) * 0.008;
    cameraman.sway = Math.sin(time * 0.7) * 0.02;
    cameraman.stride = 0;
    cameraman.head = [0.12, -0.12];
    cameraman.right = [-1.86, 0.34, 0];
    cameraman.left = [-1.78, -0.58, 0];

    // 1 — l'opérateur : il tape, jette un œil d'un écran à l'autre.
    const operator = poses[1];
    operator.x = OPERATOR.x;
    operator.z = OPERATOR.z;
    operator.yaw = Math.PI;
    operator.bob = Math.sin(time * 1.4 + 1) * 0.006;
    operator.sway = 0;
    operator.stride = 0;
    const glance = Math.sin(time * 0.55) + Math.sin(time * 1.3) * 0.4;
    operator.head = [0.28, smoothstep(-0.6, 0.6, glance) * 0.7 - 0.35];
    const typing = Math.sin(time * 8) > 0.2 && Math.sin(time * 0.9) > -0.3 ? 1 : 0;
    operator.right = [-0.86 + typing * Math.sin(time * 15) * 0.05, 0.22, 0];
    operator.left = [-0.86 + typing * Math.sin(time * 15 + 2) * 0.05, -0.22, 0];

    // 2 — le détecteur : balayage du sol, le corps accompagne le geste.
    const scan = poses[2];
    const sweep = Math.sin(time * 1.9);
    scan.x = SCANNER.x;
    scan.z = SCANNER.z;
    scan.yaw = SCANNER_YAW + sweep * 0.14;
    scan.bob = Math.sin(time * 1.3) * 0.006;
    scan.sway = 0;
    scan.stride = 0;
    scan.head = [0.42, sweep * 0.2];
    scan.right = [-1.0 + Math.sin(time * 3.8) * 0.04, 0.12 + sweep * 0.38, 0];
    scan.left = [-0.22, 0, 0.1];

    // 3 — la ronde : aller, pause lampe braquée, retour.
    const walker = poses[3];
    const cycle = (WALK + PAUSE) * 2;
    const t = (time + 3) % cycle;
    const outbound = t < WALK + PAUSE;
    const local = outbound ? t : t - (WALK + PAUSE);
    const moving = local < WALK;
    const progress = moving ? local / WALK : 1;
    const eased = progress * progress * (3 - 2 * progress);
    const from = outbound ? WALK_A : WALK_B;
    const to = outbound ? WALK_B : WALK_A;
    walker.x = from.x + (to.x - from.x) * eased;
    walker.z = from.z + (to.z - from.z) * eased;
    const travelYaw = facing(from.x, from.z, to.x, to.z);
    const goalYaw = moving ? travelYaw : outbound ? LOOK_AT_HOUSE : LOOK_AT_RIFT;
    walkerYaw.current += shortest(walkerYaw.current, goalYaw) * (1 - Math.exp(-4 * dt));
    walker.yaw = walkerYaw.current;
    const pace = moving ? Math.sin(progress * Math.PI) : 0;
    const phase = (local / WALK) * Math.PI * 2 * 5.5;
    walker.stride = Math.sin(phase) * 0.42 * Math.min(1, pace * 3);
    walker.bob = Math.abs(Math.cos(phase)) * 0.035 * Math.min(1, pace * 3);
    walker.sway = Math.sin(phase) * 0.025 * Math.min(1, pace * 3);
    const raise = moving ? 0 : smoothstep(0, 0.8, local - WALK) * (1 - smoothstep(PAUSE - 0.7, PAUSE, local - WALK));
    walker.head = [0.1 - raise * 0.25, Math.sin(time * 0.8) * 0.15 * (1 - raise)];
    walker.right = [-1.05 - raise * 0.62 + Math.sin(time * 1.1) * 0.05, 0.12, 0];
    walker.left = [-walker.stride * 0.8, 0, 0.08];

    const bodyMesh = bodies.current;
    const legMesh = legs.current;
    const headMesh = heads.current;
    const armMesh = arms.current;
    if (!bodyMesh || !legMesh || !headMesh || !armMesh) return;

    for (let index = 0; index < 4; index++) {
      const pose = poses[index];
      const ground = groundSite(pose.x, pose.z);
      euler.set(0, pose.yaw, pose.sway, 'YXZ');
      quat.setFromEuler(euler);
      offset.set(pose.x, ground + pose.bob, pose.z);
      rootMatrix.compose(offset, quat, unit);
      bodyMesh.setMatrixAt(index, rootMatrix);
      legMesh.setMatrixAt(index * 2, child(work, rootMatrix, -0.1, HIP_Y, 0, pose.stride));
      legMesh.setMatrixAt(index * 2 + 1, child(work, rootMatrix, 0.1, HIP_Y, 0, -pose.stride));
      headMesh.setMatrixAt(index, child(work, rootMatrix, 0, NECK_Y, 0, pose.head[0], pose.head[1]));
      child(armRight, rootMatrix, -0.265, SHOULDER_Y, 0, pose.right[0], pose.right[1], -0.06 + pose.right[2]);
      child(armLeft, rootMatrix, 0.265, SHOULDER_Y, 0, pose.left[0], pose.left[1], 0.06 - pose.left[2]);
      armMesh.setMatrixAt(index * 2, armRight);
      armMesh.setMatrixAt(index * 2 + 1, armLeft);

      // Accessoires : posés dans la main droite.
      if (index === 0 && camcorder.current) {
        const prop = camcorder.current;
        child(prop.matrix, armRight, 0, -0.6, 0.02, Math.PI / 2 - 0.28, 0, 0);
        prop.matrixWorldNeedsUpdate = true;
        point.set(0.045, 0.16, 0.2).applyMatrix4(prop.matrix);
        const blink = Math.sin(time * Math.PI * 2 * 0.9) > -0.2 ? 1 : 0;
        setGlow(GLOW.rec, point.x, point.y, point.z, 0.32, REC_RED, blink * 1.6, 0.55);
      } else if (index === 2 && scanner.current) {
        const prop = scanner.current;
        child(prop.matrix, armRight, 0, -0.6, 0.03, Math.PI / 2 + 0.25, 0, 0);
        prop.matrixWorldNeedsUpdate = true;
        point.set(0, 0.07, -0.05).applyMatrix4(prop.matrix);
        const beep = Math.sin(time * Math.PI * 2 * (1.2 + Math.max(0, sweep) * 2.5)) > 0.4 ? 1 : 0.15;
        setGlow(GLOW.scanner, point.x, point.y, point.z, 0.26, SCAN_GREEN, beep * 1.2, 0.5);
      } else if (index === 3 && flashlight.current && beam.current) {
        const prop = flashlight.current;
        child(prop.matrix, armRight, 0, -0.6, 0.02, Math.PI / 2, 0, 0);
        prop.matrixWorldNeedsUpdate = true;
        child(beam.current.matrix, prop.matrix, 0, 0, 0.22);
        beam.current.matrixWorldNeedsUpdate = true;
        point.set(0, 0, 0.24).applyMatrix4(prop.matrix);
        setGlow(GLOW.flashlight, point.x, point.y, point.z, 0.55, LAMP_WARM, 1, 0.3);
      }
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    legMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    armMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[kit.body, kit.suit, 4]} castShadow receiveShadow />
      <instancedMesh ref={legs} args={[kit.leg, kit.suit, 8]} castShadow receiveShadow />
      <instancedMesh ref={heads} args={[kit.head, kit.suit, 4]} castShadow receiveShadow />
      <instancedMesh ref={arms} args={[kit.arm, kit.suit, 8]} castShadow receiveShadow />
      <mesh ref={camcorder} geometry={kit.camcorder} material={kit.suit} matrixAutoUpdate={false} castShadow />
      <mesh ref={scanner} geometry={kit.scanner} material={kit.suit} matrixAutoUpdate={false} castShadow />
      <mesh ref={flashlight} geometry={kit.flashlight} material={kit.suit} matrixAutoUpdate={false} castShadow />
      <mesh ref={beam} geometry={kit.beam} material={kit.beamMaterial} matrixAutoUpdate={false} renderOrder={6} raycast={() => null} />
    </group>
  );
}
