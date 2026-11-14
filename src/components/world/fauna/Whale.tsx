'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Group, Vector3 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { clamp, hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { loft, MeshBuilder, tone, type Section, type Vec3 } from './geometry';
import { creatureMaterial, crossed, distanceToLand, faunaClock, faunaDemo, keyframes } from './shared';
import { drips, emitRing, splash, spout } from './Splashes';

/**
 * BALEINE À BOSSE — rare et mémorable. Pendant la navigation, de loin en loin, elle surgit
 * devant l'étrave : souffle et dos qui roule, saut complet (elle bascule sur le flanc et
 * retombe dans une gerbe immense), sonde queue levée (la caudale ruisselle), ou frappe la
 * surface de sa queue. Modèle procédural (≈ 420 triangles) : tête plate à tubercules, sillons
 * ventraux, très longues pectorales blanches, caudale dentelée au revers clair.
 * Colonne vertébrale animée dans le vertex shader (battement, cambrure, queue relevée).
 */

/* ------------------------------------------------------------------------- modèle */

const BACK = '#2b3b52';
const FLANK = '#3f536c';
const GROOVE_LIGHT = '#d7dfe2';
const GROOVE_DARK = '#9fadb5';
const BELLY = '#c9d3d7';
const WHITE_FIN = '#e3e9ea';

function orientedTri(builder: MeshBuilder, a: Vec3, b: Vec3, c: Vec3, color: ReturnType<typeof tone>, up: number) {
  // Garde la normale du côté demandé (+y ou -y) : dessus sombre, revers clair.
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny * up >= 0) builder.tri(a, b, c, color);
  else builder.tri(a, c, b, color);
}

function whaleGeometry() {
  const builder = new MeshBuilder(['aPart']);
  const sections: Section[] = [
    { x: 6.0, w: 0.34, h: 0.2, y: -0.06 },
    { x: 5.5, w: 0.85, h: 0.46, y: -0.13, belly: 1.2 },
    { x: 4.6, w: 1.3, h: 0.84, y: -0.16, belly: 1.22 },
    { x: 3.3, w: 1.62, h: 1.14, y: -0.1, belly: 1.14 },
    { x: 1.6, w: 1.78, h: 1.32, y: 0, belly: 1.04 },
    { x: -0.2, w: 1.66, h: 1.3, y: 0.05 },
    { x: -1.9, w: 1.3, h: 1.12, y: 0.1 },
    { x: -3.3, w: 0.85, h: 0.88, y: 0.14 },
    { x: -4.4, w: 0.42, h: 0.6, y: 0.15 },
    { x: -5.1, w: 0.22, h: 0.36, y: 0.12 },
    { x: -5.45, w: 0.13, h: 0.18, y: 0.1 },
  ];
  builder.set('aPart', 0);
  loft(builder, sections, 12, ({ up, x, segment }) => {
    if (up > 0.3) return tone(BACK);
    // Commissure de la bouche : un trait sombre de la pointe du rostre jusqu'à l'œil.
    if (x > 3.7 && up < 0 && up > -0.5) return tone('#1c2737');
    if (up > -0.35) return tone(FLANK);
    // Sillons ventraux de la gorge jusqu'au nombril, en bandes alternées.
    if (x > 0.2) return tone(segment % 2 === 0 ? GROOVE_LIGHT : GROOVE_DARK);
    return tone(x > -3 ? BELLY : FLANK);
  });

  // Tubercules sur la tête : petites bosses (le détail qui récompense un regard proche).
  const knob = tone('#22303f');
  const knobs: [number, number][] = [[5.7, 0], [5.35, 0.28], [5.35, -0.28], [5.0, 0], [4.75, 0.45], [4.75, -0.45], [4.45, 0.18], [4.45, -0.18]];
  for (const [x, z] of knobs) {
    const top = -0.13 + 0.62 * (1 - (x - 4.6) / 1.4) * 0.9 + 0.28;
    const y = Math.min(top, 0.62) - Math.abs(z) * 0.25;
    builder.tri([x + 0.12, y, z], [x, y + 0.09, z], [x - 0.08, y, z + 0.1], knob);
    builder.tri([x + 0.12, y, z], [x - 0.08, y, z - 0.1], [x, y + 0.09, z], knob);
    builder.tri([x - 0.08, y, z + 0.1], [x, y + 0.09, z], [x - 0.08, y, z - 0.1], knob);
  }
  // Yeux, juste au-dessus de la commissure.
  const eye = tone('#0d141d');
  for (const side of [1, -1]) {
    const cz = 1.36 * side;
    builder.sheet([3.98, -0.18, cz], [3.86, -0.08, cz + 0.02 * side], [3.74, -0.18, cz], eye);
    builder.sheet([3.98, -0.18, cz], [3.74, -0.18, cz], [3.86, -0.27, cz + 0.02 * side], eye);
  }

  // Dorsale : petite nageoire sur sa bosse (la « bosse » de la baleine à bosse).
  builder.set('aPart', 3);
  const dorsal = tone(BACK);
  for (const side of [1, -1]) {
    const front: Vec3 = [-1.7, 1.15, 0];
    const back: Vec3 = [-3.0, 0.98, 0];
    const base: Vec3 = [-2.3, 1.12, 0.14 * side];
    const tip: Vec3 = [-2.85, 1.62, 0];
    builder.sheet(front, base, tip, dorsal);
    builder.sheet(base, back, tip, dorsal);
  }

  // Pectorales : immenses, blanches, bord d'attaque festonné.
  builder.set('aPart', 1);
  const fin = tone(WHITE_FIN);
  const finEdge = tone('#b9c4c9');
  for (const side of [1, -1]) {
    const rf: Vec3 = [3.3, -0.62, 1.32 * side];
    const rb: Vec3 = [2.35, -0.74, 1.4 * side];
    const m1f: Vec3 = [2.78, -0.92, 2.6 * side];
    const m1b: Vec3 = [1.95, -1.0, 2.48 * side];
    const m2f: Vec3 = [2.08, -1.18, 3.82 * side];
    const m2b: Vec3 = [1.48, -1.2, 3.6 * side];
    const tip: Vec3 = [0.95, -1.38, 5.05 * side];
    builder.sheet(rf, rb, m1b, fin);
    builder.sheet(rf, m1b, m1f, fin);
    builder.sheet(m1f, m1b, m2b, fin);
    builder.sheet(m1f, m2b, m2f, fin);
    builder.sheet(m2f, m2b, tip, fin);
    // Festons du bord d'attaque.
    builder.sheet(rf, m1f, [3.18, -0.78, 2.0 * side], finEdge);
    builder.sheet(m1f, m2f, [2.56, -1.06, 3.25 * side], finEdge);
    builder.sheet(m2f, tip, [1.68, -1.3, 4.5 * side], finEdge);
  }

  // Caudale : deux couches (dessus sombre, revers blanc tacheté), bord de fuite dentelé.
  builder.set('aPart', 2);
  const y = 0.1;
  for (const side of [1, -1]) {
    const outline: Vec3[] = [
      [-5.35, y, 0],
      [-5.6, y, 0.8 * side],
      [-6.1, y, 1.72 * side],
      [-6.78, y, 2.48 * side],
      [-6.56, y, 1.95 * side],
      [-6.74, y, 1.5 * side],
      [-6.46, y, 1.02 * side],
      [-6.62, y, 0.56 * side],
      [-6.36, y, 0.2 * side],
      [-6.24, y, 0],
    ];
    const center: Vec3 = [-6.0, y, 1.05 * side];
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index];
      const b = outline[(index + 1) % outline.length];
      orientedTri(builder, center, a, b, tone(BACK), 1);
      const spot = index === 2 || index === 5 || index === 7;
      orientedTri(
        builder,
        [center[0], y - 0.03, center[2]],
        [a[0], y - 0.03, a[2]],
        [b[0], y - 0.03, b[2]],
        tone(spot ? '#2d394a' : WHITE_FIN),
        -1,
      );
    }
  }
  return builder.build();
}

const uniforms = {
  uBeat: { value: 0 },
  uBeatAmp: { value: 0.6 },
  uFlex: { value: 0 },
  uTail: { value: 0 },
  uFin: { value: 0 },
};

const WHALE_GEOMETRY = whaleGeometry();
const WHALE_MATERIAL = creatureMaterial(
  'fauna-whale-v1',
  uniforms,
  `attribute float aPart;
uniform float uBeat;
uniform float uBeatAmp;
uniform float uFlex;
uniform float uTail;
uniform float uFin;`,
  `vec3 transformed = vec3(position);
float whaleX = position.x;
// Pectorales : rotation autour de leur racine (elles battent pendant le saut).
float whaleFin = step(0.5, aPart) * step(aPart, 1.5);
transformed.y += whaleFin * uFin * (abs(position.z) - 1.35);
// Cambrure : les extrémités descendent quand uFlex > 0 (dos rond qui roule en surface).
transformed.y -= uFlex * whaleX * whaleX * 0.055;
// Battement vertical de la caudale, amplifié vers l'arrière.
float whaleBody = smoothstep(0.5, -6.6, whaleX);
transformed.y += sin(uBeat - whaleX * 0.32) * uBeatAmp * whaleBody * whaleBody * 0.75;
// Queue relevée : rotation progressive autour d'un pivot au milieu du dos.
float whaleTail = uTail * smoothstep(-1.2, -5.0, whaleX);
vec2 whaleRel = vec2(transformed.x + 1.2, transformed.y);
float whaleC = cos(whaleTail);
float whaleS = sin(whaleTail);
transformed.xy = vec2(-1.2, 0.0) + vec2(whaleRel.x * whaleC + whaleRel.y * whaleS, -whaleRel.x * whaleS + whaleRel.y * whaleC);`,
  { roughness: 0.7 },
);

/* ------------------------------------------------------------------ comportements */

type Act = 'roll' | 'breach' | 'fluke' | 'slap';

interface Pose {
  y: number;
  pitch: number;
  roll: number;
  flex: number;
  tail: number;
  beat: number;
  fin: number;
  /** Vitesse d'avance le long du cap. */
  speed: number;
}

const pose: Pose = { y: -8, pitch: 0, roll: 0, flex: 0, tail: 0, beat: 0.6, fin: 0, speed: 2 };

/** Durée de chaque numéro (s). */
const ACT_LENGTH: Record<Act, number> = { roll: 6.2, breach: 4.6, fluke: 8.2, slap: 10.4 };

/** Instant fort de chaque numéro : on le fait coïncider avec un bon cadrage. */
const ACT_CLIMAX: Record<Act, number> = { roll: 1.5, breach: 1.4, fluke: 4.2, slap: 2.6 };

function rollPose(t: number) {
  pose.y = keyframes([[0, -3.6], [1.3, -0.92], [2.0, -0.82], [3.4, -1.22], [4.6, -2.5], [6.2, -3.8]], t);
  pose.pitch = keyframes([[0, 0.17], [1.3, 0.04], [2.2, -0.08], [3.4, -0.28], [4.6, -0.36], [6.2, -0.3]], t);
  pose.roll = Math.sin(t * 0.7) * 0.06;
  pose.flex = keyframes([[0, 0], [1.6, 0.05], [3.0, 0.32], [4.4, 0.4], [6.2, 0.1]], t);
  // Les pointes de la caudale affleurent en fin de roulé.
  pose.tail = keyframes([[0, 0], [4.0, 0], [5.0, 0.32], [6.0, 0]], t);
  pose.beat = 0.55;
  pose.fin = Math.sin(t * 0.9) * 0.08;
  pose.speed = 2.6;
}

function breachPose(t: number) {
  pose.y = keyframes([[0, -7], [1.2, 0.6], [1.6, 0.9], [2.4, -0.3], [3.2, -2.6], [4.6, -5]], t);
  pose.pitch = keyframes([[0, 1.2], [1.2, 1.1], [1.75, 0.8], [2.35, 0.25], [3.2, -0.15], [4.6, -0.3]], t);
  pose.roll = keyframes([[0, 0], [0.9, 0.15], [2.3, 1.75], [3.2, 2.2], [4.6, 2.3]], t);
  pose.flex = keyframes([[0, -0.1], [1.1, 0.25], [1.9, 0.35], [2.5, -0.05], [3.2, 0]], t);
  pose.tail = keyframes([[0, 0], [1.4, -0.12], [2.3, 0.1], [3, 0]], t);
  pose.beat = keyframes([[0, 2.2], [1.0, 1.4], [1.3, 0.3], [2.4, 0.2], [3.2, 0.6]], t);
  // Les pectorales s'ouvrent en grand au sommet du saut.
  pose.fin = keyframes([[0, 0], [1.0, 0.35], [1.7, -0.45], [2.4, 0.25], [3.2, 0]], t);
  pose.speed = keyframes([[0, 4.5], [1.6, 3.5], [3, 1.2]], t);
}

function flukePose(t: number) {
  pose.y = keyframes([[0, -1.7], [1.0, -0.88], [2.4, -1.3], [3.6, -2.0], [5.4, -2.3], [6.8, -3.6], [8.2, -6]], t);
  pose.pitch = keyframes([[0, 0.05], [1.0, -0.05], [2.4, -0.45], [3.6, -1.0], [4.6, -1.22], [5.8, -1.3], [6.8, -1.36], [8.2, -1.4]], t);
  pose.roll = 0;
  pose.flex = keyframes([[0, 0], [1.4, 0.25], [2.6, 0.45], [3.6, 0.2], [4.6, 0]], t);
  pose.tail = keyframes([[0, 0], [2.6, 0.1], [3.6, 0.3], [4.6, 0.12], [5.8, 0], [6.6, -0.15], [8.2, 0]], t);
  pose.beat = keyframes([[0, 0.6], [2.4, 0.3], [3.4, 0.04], [6, 0.04], [7, 0.5]], t);
  pose.fin = -0.12;
  pose.speed = keyframes([[0, 2.2], [3, 1.4], [6, 0.4]], t);
}

/** Frappes de queue : remontée lente, retombée sèche. */
const SLAPS = [2.6, 4.5, 6.4, 8.3];
function slapPose(t: number) {
  pose.y = keyframes([[0, -2.6], [1.2, -1.45], [9.2, -1.45], [10.4, -3.6]], t);
  pose.pitch = keyframes([[0, -0.1], [1.2, -0.42], [9.2, -0.42], [10.4, -0.6]], t);
  pose.roll = 0.12;
  pose.flex = 0.1;
  let tail = keyframes([[0, 0], [1.2, 0.1]], t);
  for (const slam of SLAPS) {
    // Levée sur 1,3 s, puis retombée en 0,3 s.
    const raise = clamp((t - (slam - 1.6)) / 1.3, 0, 1);
    const fall = clamp((t - (slam - 0.3)) / 0.3, 0, 1);
    if (t > slam - 1.6 && t < slam + 0.25) tail = 0.1 + 0.62 * raise * raise * (3 - 2 * raise) * (1 - fall * fall) - fall * 0.3;
  }
  pose.tail = tail;
  pose.beat = 0.12;
  pose.fin = Math.sin(t * 1.3) * 0.15;
  pose.speed = 0.6;
}

function poseAt(act: Act, t: number) {
  if (act === 'roll') rollPose(t);
  else if (act === 'breach') breachPose(t);
  else if (act === 'fluke') flukePose(t);
  else slapPose(t);
}

/** Avance cumulée (intégrale de la vitesse), à pas fixes : déterministe. */
function travelled(act: Act, t: number) {
  let distance = 0;
  const step = 0.1;
  for (let u = 0; u < t; u += step) {
    poseAt(act, u);
    distance += pose.speed * Math.min(step, t - u);
  }
  return distance;
}

interface Visit {
  act: Act;
  start: number;
  x: number;
  z: number;
  heading: number;
  stamped: boolean;
}

const visit: Visit = { act: 'roll', start: -1e5, x: 0, z: 0, heading: 0, stamped: false };
const DEMO_ACTS: Record<string, Act> = { whale: 'roll', breach: 'breach', fluke: 'fluke', slap: 'slap' };
const DEMO = faunaDemo.kind !== null && faunaDemo.kind in DEMO_ACTS;

const local = new Vector3();
const world = new Vector3();
const euler = new Euler(0, 0, 0, 'YZX');

export function Whale() {
  const group = useRef<Group>(null);
  const timer = useRef({ sailing: 0, next: 70 + hash(91.7) * 40, prevLocal: -1e9, lastAct: -1 });

  useFrame((state, delta) => {
    const target = group.current;
    if (!target) return;
    const time = faunaClock(state.clock.elapsedTime);
    const waveTime = state.clock.elapsedTime;
    const memo = timer.current;
    const worldState = useWorld.getState();

    if (DEMO) {
      // Démonstration : le numéro se répète au point visé par la caméra, en travers du champ.
      const act = DEMO_ACTS[faunaDemo.kind as string];
      const period = act === 'roll' ? 9 : ACT_LENGTH[act] + 3;
      const index = Math.floor(time / period);
      if (index !== memo.lastAct) {
        memo.lastAct = index;
        const camera = state.camera;
        camera.getWorldDirection(local);
        const reach = -camera.position.y / Math.min(local.y, -0.08);
        const flat = Math.hypot(local.x, local.z) || 1;
        const hitX = camera.position.x + local.x * reach;
        const hitZ = camera.position.z + local.z * reach;
        visit.act = act;
        visit.start = index * period;
        visit.heading = Math.atan2(local.x / flat, -local.z / flat);
        const travel = travelled(act, ACT_CLIMAX[act]);
        visit.x = hitX - Math.cos(visit.heading) * travel;
        visit.z = hitZ - Math.sin(visit.heading) * travel;
        visit.stamped = true;
        memo.prevLocal = -1e9;
      }
    } else if (worldState.phase === 'playing' && boatState.speed > 2 && time - visit.start > ACT_LENGTH[visit.act] + 2) {
      // Le compteur n'avance qu'en navigation, et seulement de jour ou au crépuscule.
      memo.sailing += Math.min(delta, 1 / 20);
      if (memo.sailing > memo.next && ecologyState.dayLarge > 0.25 && ecologyState.worldLife > 0.6) {
        const acts: Act[] = ['breach', 'roll', 'fluke', 'breach', 'slap', 'roll'];
        const act = acts[Math.floor(hash(time * 0.917) * acts.length)];
        // Instant fort à ~26 m devant l'étrave, décalé sur un côté : bien dans le cadre.
        const climax = ACT_CLIMAX[act];
        const ahead = 24 + boatState.speed * climax;
        const side = (hash(time * 1.71) > 0.5 ? 1 : -1) * (11 + hash(time * 2.3) * 6);
        const fx = Math.cos(boatState.heading);
        const fz = Math.sin(boatState.heading);
        const cx = boatState.position.x + fx * ahead - fz * side;
        const cz = boatState.position.z + fz * ahead + fx * side;
        if (distanceToLand(cx, cz) > 13 && Math.hypot(cx, cz) < 112) {
          visit.act = act;
          visit.start = time;
          // Elle nage en travers de la route, vers le bateau.
          visit.heading = boatState.heading + (side > 0 ? 1 : -1) * Math.PI * 0.5 + (hash(time * 3.3) - 0.5) * 0.6;
          const travel = travelled(act, climax);
          visit.x = cx - Math.cos(visit.heading) * travel;
          visit.z = cz - Math.sin(visit.heading) * travel;
          visit.stamped = false;
          memo.prevLocal = -1e9;
          memo.sailing = 0;
          memo.next = 120 + hash(time * 0.31) * 120;
        } else {
          memo.next = memo.sailing + 5;
        }
      }
    }

    const u = time - visit.start;
    const length = ACT_LENGTH[visit.act];
    const active = u >= 0 && u <= length && worldState.reveal > 0.75;
    target.visible = active;
    if (!active) {
      memo.prevLocal = -1e9;
      return;
    }
    const prev = memo.prevLocal;
    memo.prevLocal = u;

    poseAt(visit.act, u);
    const distance = travelled(visit.act, u);
    poseAt(visit.act, u);
    const fx = Math.cos(visit.heading);
    const fz = Math.sin(visit.heading);
    const x = visit.x + fx * distance;
    const z = visit.z + fz * distance;
    const surface = waveHeight(x, z, waveTime);
    target.position.set(x, surface + pose.y, z);
    euler.set(pose.roll, -visit.heading, pose.pitch, 'YZX');
    target.rotation.copy(euler);
    target.updateMatrixWorld();
    uniforms.uBeat.value = time * 1.6;
    uniforms.uBeatAmp.value = pose.beat;
    uniforms.uFlex.value = pose.flex;
    uniforms.uTail.value = pose.tail;
    uniforms.uFin.value = pose.fin;

    /** Point du modèle en coordonnées monde (pose courante, hors déformations fines). */
    const at = (lx: number, ly: number, lz: number) => target.localToWorld(world.set(lx, ly, lz));

    if (!visit.stamped && u > 0.6) {
      visit.stamped = true;
      logbook.stamp('whale');
      ambience.whale();
    }

    const start = visit.start;
    if (visit.act === 'roll') {
      if (crossed(prev, u, 1.45)) {
        const hole = at(3.0, 1.2, 0);
        spout(hole.x, surface + 0.4, hole.z, start + 1.45, 1);
        emitRing(hole.x, hole.z, start + 1.4, 3.2, 1.8, 0.3, 0.8);
      }
      if (crossed(prev, u, 4.9)) {
        const flukes = at(-6.2, 0, 0);
        splash(flukes.x, flukes.z, start + 4.9, 0.7);
      }
    } else if (visit.act === 'breach') {
      if (crossed(prev, u, 0.35)) {
        const head = at(5.2, 0, 0);
        splash(head.x, head.z, start + 0.35, 1.6, fx, fz);
        emitRing(head.x, head.z, start + 0.35, 6, 2.2, 0.2, 0.9);
      }
      if (crossed(prev, u, 2.35)) {
        // Retombée : gerbes tout le long du corps, anneaux concentriques, nappe d'écume.
        for (const along of [-4, -1.5, 1, 3.5]) {
          const point = at(along, 0, 0);
          splash(point.x, point.z, start + 2.35 + Math.abs(along) * 0.02, 2.4, 0, 0, false);
        }
        const center = at(0, 0, 0);
        emitRing(center.x, center.z, start + 2.35, 5.5, 3.6, 1, 0.75);
        emitRing(center.x, center.z, start + 2.4, 8, 2.6, 0.16, 0.9);
        emitRing(center.x, center.z, start + 2.75, 12, 3.2, 0.12, 0.65);
        ambience.splash(1.6);
      }
    } else if (visit.act === 'fluke') {
      if (crossed(prev, u, 0.6)) {
        const hole = at(3.0, 1.2, 0);
        spout(hole.x, surface + 0.4, hole.z, start + 0.6, 0.9);
      }
      if (crossed(prev, u, 3.1)) {
        const stock = at(-4.6, 0, 0);
        emitRing(stock.x, stock.z, start + 3.1, 3.4, 2, 0.24, 0.85);
        splash(stock.x, stock.z, start + 3.1, 0.6);
      }
      // L'eau ruisselle du bord de fuite tant que la caudale est levée.
      for (let drip = 3.4; drip < 6.0; drip += 0.35) {
        if (crossed(prev, u, drip)) {
          for (const side of [1, -1]) {
            const edge = at(-6.55, 0.1, 1.5 * side);
            drips(edge.x, edge.y, edge.z, start + drip, 4, 0.8);
          }
          const notch = at(-6.25, 0.1, 0);
          drips(notch.x, notch.y, notch.z, start + drip, 2, 0.4);
        }
      }
      if (crossed(prev, u, 6.5)) {
        const flukes = at(-6.0, 0, 0);
        splash(flukes.x, flukes.z, start + 6.5, 0.8);
      }
    } else {
      for (const slam of SLAPS) {
        if (crossed(prev, u, slam)) {
          const flukes = at(-6.0, 0, 0);
          splash(flukes.x, flukes.z, start + slam, 1.8);
          emitRing(flukes.x, flukes.z, start + slam + 0.1, 6.5, 2.4, 0.18, 0.8);
          ambience.splash(0.55);
        }
        if (crossed(prev, u, slam - 0.9)) {
          // La caudale qui monte arrache un rideau de gouttes.
          const edge = at(-6.4, 0.1, 0);
          drips(edge.x, edge.y, edge.z, start + slam - 0.9, 8, 2.6);
        }
      }
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={WHALE_GEOMETRY} material={WHALE_MATERIAL} castShadow={false} raycast={() => null} />
    </group>
  );
}
