'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp, hash } from '@/lib/utils/math';
import { bump, easeInOut, mix } from '../anim';
import { erlenmeyerGeometry, liquidGeometry, Merger, pose, type Vec3 } from '../geometry';
import { glassMaterial, glowMaterial, labNight, labState, labTime, paintMaterial } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * STATION IA — trois petits robots se passent des cubes lumineux en boucle : l'un
 * réfléchit, lance, l'autre attrape, le cube change de couleur à chaque étape (le
 * travail avance). Une bulle « … » flotte au-dessus d'eux, l'antenne émet des ondes et
 * sa lampe pulse lentement, comme une pensée. Sur une caisse, une fiole bouillonne :
 * les agents restent un terrain d'expérimentation.
 */

const CENTER: Vec3 = [0.15, 0, 0.05];
const RING = 0.78;
const ROBOTS = [0, 1, 2].map((index) => {
  const angle = Math.PI / 2 + (index * Math.PI * 2) / 3;
  return { x: CENTER[0] + Math.cos(angle) * RING, z: CENTER[2] + Math.sin(angle) * RING };
});
const ROBOT_COLORS = ['#ff6fa8', '#5ec8ff', '#ffd23f'];
const CUBE_COLORS = ['#ff6fa8', '#b48cff', '#5ec8ff'];
const HOP = 1.5;
const HOLD = 0.6;
const CUBES = 2;
const MAST: Vec3 = [-1.2, 0, -0.85];
const MAST_TOP = 2.15;
const CRATE: Vec3 = [1.3, 0, 0.72];
const BUBBLE_Y = 1.55;

/** Corps d'un robot (sans bras, yeux ni pièces colorées), face vers +Z. */
function robotGeometry() {
  const merger = new Merger();
  merger.cylinder(0.17, 0.17, 0.08, 14, '#3b4154', [0, 0.06, 0]);
  merger.cylinder(0.16, 0.19, 0.3, 14, '#f4efe6', [0, 0.25, 0], undefined, 0.08);
  merger.cylinder(0.05, 0.05, 0.06, 8, '#8a93a6', [0, 0.43, 0]);
  merger.sphere(0.17, '#f4efe6', [0, 0.57, 0], [1.2, 0.86, 1], [14, 10], 0.08);
  merger.box([0.27, 0.11, 0.06], '#1f2433', [0, 0.58, 0.125], undefined, 0);
  merger.rod([0, 0.7, 0], [0, 0.8, 0], 0.012, '#8a93a6', 4);
  return merger.build();
}

/** Pièces peintes à la couleur du robot (blanches, teintées par instance). */
function accentGeometry() {
  const merger = new Merger();
  merger.box([0.1, 0.08, 0.03], '#ffffff', [0, 0.27, 0.18], undefined, 0);
  merger.sphere(0.032, '#ffffff', [0, 0.83, 0], 1, [8, 6], 0);
  for (const side of [-0.205, 0.205]) merger.cylinder(0.045, 0.045, 0.04, 10, '#ffffff', [side, 0.57, 0], [0, 0, Math.PI / 2], 0);
  return merger.build();
}

function eyesGeometry() {
  const merger = new Merger();
  for (const side of [-0.055, 0.055]) merger.sphere(0.028, '#ffffff', [side, 0, 0.16], [1, 1.25, 0.6], [8, 6], 0);
  return merger.build();
}

/** Bras : pivot à l'épaule (origine), pend vers le bas. */
function armGeometry() {
  return new Merger().box([0.05, 0.2, 0.05], '#d9d3c8', [0, -0.09, 0], undefined, 0.05).sphere(0.034, '#8a93a6', [0, -0.2, 0], 1, [6, 4], 0).build();
}

function cubeGeometry() {
  return new Merger().box([0.15, 0.15, 0.15], '#ffffff', [0, 0, 0], undefined, 0).build();
}

const ringVertex = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vAlpha;
void main() {
  float f = fract(uTime * 0.42 + aPhase);
  vec3 p = position * vec3(0.25 + f * 1.5, 1.0, 0.25 + f * 1.5);
  vAlpha = (1.0 - f) * (1.0 - f) * smoothstep(0.0, 0.08, f);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uNight;
varying float vAlpha;
void main() {
  float a = vAlpha * (0.75 + uNight * 0.5);
  gl_FragColor = vec4(uColor * a * 1.8, a);
  #include <colorspace_fragment>
}
`;

function ringsGeometry() {
  const parts = [0, 1, 2].map((index) => {
    const ring = new TorusGeometry(0.42, 0.016, 4, 36).rotateX(Math.PI / 2);
    const count = ring.attributes.position.count;
    ring.setAttribute('aPhase', new BufferAttribute(new Float32Array(count).fill(index / 3), 1));
    ring.deleteAttribute('uv');
    ring.deleteAttribute('normal');
    return ring;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

function buildStatic(accent: string) {
  const paint = new Merger();
  const glow = new Merger();
  const glass = new Merger();
  addPad(paint, glow, 2.0, accent);
  // Plateau de travail : cercle clair sous les robots.
  paint.cylinder(RING + 0.36, RING + 0.4, 0.04, 28, '#d9d3e6', [CENTER[0], 0.02, CENTER[2]], undefined, 0.04);
  // Antenne en treillis.
  const legs: Vec3[] = [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2;
    return [MAST[0] + Math.cos(angle) * 0.24, 0, MAST[2] + Math.sin(angle) * 0.24];
  });
  const apex: Vec3 = [MAST[0], MAST_TOP, MAST[2]];
  legs.forEach((leg) => paint.rod(leg, apex, 0.022, '#c9d2dc', 5));
  [0.45, 0.95, 1.45].forEach((height) => {
    const shrink = 1 - height / MAST_TOP;
    legs.forEach((leg, index) => {
      const next = legs[(index + 1) % 3];
      const a: Vec3 = [MAST[0] + (leg[0] - MAST[0]) * shrink, height, MAST[2] + (leg[2] - MAST[2]) * shrink];
      const b: Vec3 = [MAST[0] + (next[0] - MAST[0]) * shrink, height, MAST[2] + (next[2] - MAST[2]) * shrink];
      paint.rod(a, b, 0.014, '#aeb8c4', 4);
    });
  });
  paint.cylinder(0.05, 0.05, 0.12, 8, '#5b6472', [MAST[0], MAST_TOP + 0.02, MAST[2]]);
  // Caisse et fiole d'expérience.
  paint.box([0.36, 0.3, 0.36], '#b98a55', [CRATE[0], 0.15, CRATE[2]], [0, 0.3, 0]);
  paint.box([0.38, 0.04, 0.38], '#8c5d36', [CRATE[0], 0.3, CRATE[2]], [0, 0.3, 0]);
  glass.add(erlenmeyerGeometry(1.1), '#ffffff', pose([CRATE[0], 0.32, CRATE[2]]), 0);
  glow.add(liquidGeometry(1.1), '#ff6fa8', pose([CRATE[0], 0.32, CRATE[2]]), 0);
  return { paint: paint.build(), glow: glow.build(), glass: glass.build() };
}

/** Bulle de dialogue blanche (les trois points sont animés à part). */
function bubbleGeometry() {
  const merger = new Merger();
  merger.sphere(1, '#ffffff', [0, 0, 0], [0.36, 0.2, 0.07], [18, 10], 0);
  merger.add(new SphereGeometry(1, 6, 4), '#ffffff', pose([-0.16, -0.19, 0], [0, 0, 0.6], [0.07, 0.1, 0.04]), 0);
  return merger.build();
}

const dummy = new Object3D();
const robotMatrix = new Matrix4();
const partMatrix = new Matrix4();
const tint = new Color();

/** Où sont les mains d'un robot (devant lui, à hauteur de poitrine). */
function handsOf(index: number, heading: number, out: Vec3) {
  out[0] = ROBOTS[index].x + Math.sin(heading) * 0.26;
  out[1] = 0.47;
  out[2] = ROBOTS[index].z + Math.cos(heading) * 0.26;
  return out;
}

const from: Vec3 = [0, 0, 0];
const to: Vec3 = [0, 0, 0];
/** Ce que chaque robot veut faire à cette image (NaN : rien de particulier). */
const wantHeading = new Float32Array(3);
const wantRaise = new Float32Array(3);

export function AIZone({ zone, spot }: ZoneProps) {
  const bodies = useRef<InstancedMesh>(null);
  const accents = useRef<InstancedMesh>(null);
  const eyes = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const cubes = useRef<InstancedMesh>(null);
  const dots = useRef<InstancedMesh>(null);
  const bubble = useRef<Group>(null);
  const bulb = useRef<InstancedMesh>(null);
  /** Caps et levée des bras, amortis d'une image à l'autre. */
  const motion = useRef({ heading: [0, 0, 0], raise: [0, 0, 0] });

  const built = useMemo(() => buildStatic(zone.accent), [zone.accent]);
  const robot = useMemo(() => robotGeometry(), []);
  const accentParts = useMemo(() => accentGeometry(), []);
  const eyePair = useMemo(() => eyesGeometry(), []);
  const arm = useMemo(() => armGeometry(), []);
  const cube = useMemo(() => cubeGeometry(), []);
  const speech = useMemo(() => bubbleGeometry(), []);
  const dot = useMemo(() => new Merger().sphere(0.034, '#ffffff', [0, 0, 0], 1, [8, 6], 0).build(), []);
  const rings = useMemo(() => ringsGeometry(), []);
  const ringMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: labTime, uNight: labNight, uColor: { value: new Color(zone.accent) } },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [zone.accent],
  );
  const bulbShape = useMemo(() => new Merger().sphere(0.09, '#ffffff', [0, 0, 0], 1, [12, 8], 0).build(), []);
  const accentColor = useMemo(() => new Color(zone.accent), [zone.accent]);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      built.glass.dispose();
      [robot, accentParts, eyePair, arm, cube, speech, dot, rings, bulbShape].forEach((geometry) => geometry.dispose());
      ringMaterial.dispose();
    },
    [accentParts, arm, bulbShape, built, cube, dot, eyePair, ringMaterial, rings, robot, speech],
  );

  useLayoutEffect(() => {
    const state = motion.current;
    ROBOTS.forEach((robotSpot, index) => {
      state.heading[index] = Math.atan2(CENTER[0] - robotSpot.x, CENTER[2] - robotSpot.z);
      accents.current?.setColorAt(index, tint.set(ROBOT_COLORS[index]));
      eyes.current?.setColorAt(index, tint.set(index === 1 ? '#7ff4ff' : '#ff9ad5'));
    });
    for (let index = 0; index < CUBES; index++) cubes.current?.setColorAt(index, tint.set(CUBE_COLORS[index]));
    for (let index = 0; index < 3; index++) dots.current?.setColorAt(index, tint.set(zone.accent));
    bulb.current?.setColorAt(0, tint.set(zone.accent));
    for (const mesh of [accents.current, eyes.current, cubes.current, dots.current, bulb.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [zone.accent]);

  useFrame((state, delta) => {
    if (!labState.awake) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    const memory = motion.current;

    // 1. Où en est chaque cube : tenu par un robot, ou en vol vers le suivant.
    wantHeading.fill(Number.NaN);
    wantRaise.fill(0);
    for (let index = 0; index < CUBES; index++) {
      const tau = (t + index * HOP * 1.5) % (HOP * 3);
      const hop = Math.floor(tau / HOP);
      const s = tau - hop * HOP;
      const giver = hop % 3;
      const receiver = (giver + 1) % 3;
      const toward = Math.atan2(ROBOTS[receiver].x - ROBOTS[giver].x, ROBOTS[receiver].z - ROBOTS[giver].z);
      const back = Math.atan2(ROBOTS[giver].x - ROBOTS[receiver].x, ROBOTS[giver].z - ROBOTS[receiver].z);
      if (s < HOLD) {
        wantHeading[giver] = toward;
        wantRaise[giver] = Math.max(wantRaise[giver], s > HOLD - 0.2 ? 1.5 : 1);
      } else {
        const u = (s - HOLD) / (HOP - HOLD);
        wantHeading[receiver] = back;
        wantRaise[receiver] = Math.max(wantRaise[receiver], u > 0.45 ? 1 : 0.3);
      }
      handsOf(giver, memory.heading[giver], from);
      handsOf(receiver, memory.heading[receiver], to);
      const mesh = cubes.current;
      if (mesh) {
        if (s < HOLD) {
          dummy.position.set(from[0], from[1] + 0.05 + Math.sin(t * 6) * 0.015, from[2]);
          dummy.rotation.set(t * 1.5, t * 2.2, 0);
        } else {
          const u = easeInOut((s - HOLD) / (HOP - HOLD));
          dummy.position.set(mix(from[0], to[0], u), mix(from[1], to[1], u) + 0.05 + Math.sin(u * Math.PI) * 0.5, mix(from[2], to[2], u));
          dummy.rotation.set(t * 4, t * 3, u * Math.PI);
        }
        const pop = 1 + bump(s, 0, 0.3) * 0.35;
        dummy.scale.setScalar(pop);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        // Chaque passe fait avancer le travail : le cube change de teinte à la réception.
        tint.set(CUBE_COLORS[(hop + index) % 3]).multiplyScalar(1 + bump(s, 0, 0.35) * 0.8);
        mesh.setColorAt(index, tint);
      }
    }
    if (cubes.current) {
      cubes.current.instanceMatrix.needsUpdate = true;
      if (cubes.current.instanceColor) cubes.current.instanceColor.needsUpdate = true;
    }

    // 2. Robots : se tournent vers leur partenaire, lèvent les bras, clignent des yeux.
    for (let index = 0; index < 3; index++) {
      const robotSpot = ROBOTS[index];
      const rest = Math.atan2(CENTER[0] - robotSpot.x, CENTER[2] - robotSpot.z);
      const goal = Number.isNaN(wantHeading[index]) ? rest : wantHeading[index];
      let current = memory.heading[index];
      let difference = goal - current;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      current += difference * (1 - Math.exp(-7 * dt));
      memory.heading[index] = current;
      memory.raise[index] = damp(memory.raise[index], wantRaise[index], 9, dt);

      dummy.position.set(robotSpot.x, Math.abs(Math.sin(t * 3.2 + index * 2)) * 0.025, robotSpot.z);
      dummy.rotation.set(0, current, Math.sin(t * 1.4 + index) * 0.04);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      robotMatrix.copy(dummy.matrix);
      bodies.current?.setMatrixAt(index, robotMatrix);
      accents.current?.setMatrixAt(index, robotMatrix);

      const blink = (t + hash(index * 3.3) * 4) % 3.8 < 0.13 ? 0.12 : 1;
      partMatrix.makeScale(1, blink, 1).setPosition(0, 0.585, 0);
      eyes.current?.setMatrixAt(index, dummy.matrix.copy(robotMatrix).multiply(partMatrix));

      const lift = memory.raise[index];
      for (const side of [0, 1]) {
        partMatrix.makeRotationX(-lift * 1.05 - (side === 0 ? 0 : Math.sin(t * 5 + index) * 0.08 * lift));
        partMatrix.setPosition(side === 0 ? -0.215 : 0.215, 0.37, 0.01);
        arms.current?.setMatrixAt(index * 2 + side, dummy.matrix.copy(robotMatrix).multiply(partMatrix));
      }
    }
    for (const mesh of [bodies.current, accents.current, eyes.current, arms.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Bulle « … » : les trois points sautent l'un après l'autre.
    if (bubble.current) bubble.current.position.y = BUBBLE_Y + Math.sin(t * 1.3) * 0.05;
    if (dots.current) {
      for (let index = 0; index < 3; index++) {
        const jump = Math.max(0, Math.sin(t * 5 - index * 0.9)) ** 2;
        dummy.position.set((index - 1) * 0.1, jump * 0.05, 0.075);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1 + jump * 0.25);
        dummy.updateMatrix();
        dots.current.setMatrixAt(index, dummy.matrix);
      }
      dots.current.instanceMatrix.needsUpdate = true;
    }
    // 4. Lampe de l'antenne : respiration lente, « en pleine réflexion ».
    if (bulb.current) {
      const think = 0.5 + 0.5 * Math.sin(t * 1.2);
      dummy.position.set(MAST[0], MAST_TOP + 0.13, MAST[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.85 + think * 0.3);
      dummy.updateMatrix();
      bulb.current.setMatrixAt(0, dummy.matrix);
      bulb.current.instanceMatrix.needsUpdate = true;
      tint.copy(accentColor).multiplyScalar(0.7 + think * 0.9);
      bulb.current.setColorAt(0, tint);
      if (bulb.current.instanceColor) bulb.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[-1.05, 1.25]} reach={2.6}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={built.glass} material={glassMaterial} raycast={noRaycast} />
      <instancedMesh ref={bodies} args={[robot, paintMaterial, 3]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={accents} args={[accentParts, paintMaterial, 3]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={eyes} args={[eyePair, glowMaterial, 3]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={arms} args={[arm, paintMaterial, 6]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={cubes} args={[cube, glowMaterial, CUBES]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={bulb} args={[bulbShape, glowMaterial, 1]} frustumCulled={false} raycast={noRaycast} />
      <mesh geometry={rings} material={ringMaterial} position={[MAST[0], MAST_TOP + 0.13, MAST[2]]} frustumCulled={false} raycast={noRaycast} />
      <group ref={bubble} position={[CENTER[0], BUBBLE_Y, CENTER[2]]}>
        <mesh geometry={speech} material={paintMaterial} raycast={noRaycast} />
        <instancedMesh ref={dots} args={[dot, glowMaterial, 3]} frustumCulled={false} raycast={noRaycast} />
      </group>
    </ZoneShell>
  );
}
