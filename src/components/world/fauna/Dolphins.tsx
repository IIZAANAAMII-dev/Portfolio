'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { SOLIDS } from '@/lib/navigation';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, shortestAngle } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { loft, MeshBuilder, tone, type Section, type Vec3 } from './geometry';
import { creatureMaterial, crossed, distanceToLand, faunaClock, faunaDemo } from './shared';
import { spout, splash } from './Splashes';

/**
 * DAUPHINS — une rencontre, pas un décor. De temps en temps, pendant la navigation, un pod
 * surgit devant le bateau en marsouinant, vient jouer dans la vague d'étrave (sauts en arc,
 * vrilles, plat-ventre, sauts synchronisés, un petit qui imite sa mère), puis repart au large.
 * Modèle procédural (≈ 270 triangles), nage dorso-ventrale et cambrure calculées dans le vertex
 * shader : un seul draw call pour tout le pod, et rien du tout entre deux rencontres.
 */

/* ------------------------------------------------------------------------- modèle */

const BACK = '#3d5872';
const FLANK = '#7896ad';
const BELLY = '#e8eef0';
const FIN = '#38526b';

function dolphinGeometry() {
  const builder = new MeshBuilder();
  // Avant = +X. Le pli marqué entre rostre et melon fait la silhouette du grand dauphin.
  const sections: Section[] = [
    { x: 1.3, w: 0.022, h: 0.02, y: -0.07 },
    { x: 1.17, w: 0.055, h: 0.048, y: -0.075 },
    { x: 1.03, w: 0.1, h: 0.085, y: -0.06 },
    { x: 0.95, w: 0.15, h: 0.175, y: -0.01, belly: 0.9 },
    { x: 0.78, w: 0.21, h: 0.245, y: 0.02, belly: 0.88 },
    { x: 0.52, w: 0.27, h: 0.3, y: 0.03, belly: 0.86 },
    { x: 0.16, w: 0.3, h: 0.33, y: 0.03, belly: 0.86 },
    { x: -0.2, w: 0.265, h: 0.3, y: 0.035, belly: 0.88 },
    { x: -0.54, w: 0.185, h: 0.23, y: 0.035 },
    { x: -0.84, w: 0.095, h: 0.15, y: 0.035 },
    { x: -1.05, w: 0.052, h: 0.09, y: 0.03 },
    { x: -1.17, w: 0.034, h: 0.05, y: 0.03 },
  ];
  loft(builder, sections, 10, ({ up, x }) => {
    if (x > 1.0) return up > -0.2 ? tone('#6f8ba2') : tone(BELLY);
    if (up > 0.5) return tone(BACK);
    // Flanc clair qui remonte en vague vers l'arrière (motif « cape » du grand dauphin).
    if (up > -0.3 + Math.max(0, -x - 0.2) * 0.35) return tone(FLANK);
    return tone(BELLY);
  });
  // Yeux : petits losanges sombres à fleur de peau.
  const eye = tone('#141c27');
  for (const side of [1, -1]) {
    const cx = 0.86;
    const cy = 0.09;
    const cz = 0.168 * side;
    builder.sheet([cx + 0.028, cy, cz], [cx, cy + 0.02, cz + 0.004 * side], [cx - 0.024, cy, cz], eye);
    builder.sheet([cx + 0.028, cy, cz], [cx - 0.024, cy, cz], [cx, cy - 0.016, cz + 0.004 * side], eye);
  }
  const fin = tone(FIN);
  // Dorsale falciforme, avec un peu d'épaisseur pour rester lisible vue de haut.
  for (const side of [1, -1]) {
    const front: Vec3 = [0.14, 0.33, 0];
    const back: Vec3 = [-0.32, 0.31, 0];
    const base: Vec3 = [-0.08, 0.34, 0.04 * side];
    const lead: Vec3 = [-0.13, 0.54, 0];
    const tip: Vec3 = [-0.45, 0.68, 0];
    builder.sheet(front, base, lead, fin);
    builder.sheet(base, back, tip, fin);
    builder.sheet(base, tip, lead, fin);
  }
  // Pectorales en flèche.
  for (const side of [1, -1]) {
    builder.sheet([0.62, -0.13, 0.19 * side], [0.42, -0.16, 0.2 * side], [0.2, -0.33, 0.52 * side], fin);
  }
  // Caudale : deux lobes et l'encoche centrale.
  for (const side of [1, -1]) {
    const root: Vec3 = [-1.1, 0.03, 0];
    const lead: Vec3 = [-1.2, 0.035, 0.2 * side];
    const tip: Vec3 = [-1.43, 0.03, 0.47 * side];
    const trail: Vec3 = [-1.37, 0.03, 0.14 * side];
    const notch: Vec3 = [-1.33, 0.03, 0];
    builder.sheet(root, lead, tip, fin);
    builder.sheet(root, tip, trail, fin);
    builder.sheet(root, trail, notch, fin);
  }
  return builder.build();
}

const POD = 5;
const swimData = new Float32Array(POD * 4);

function podGeometry() {
  const geometry = dolphinGeometry();
  geometry.setAttribute('aSwim', new InstancedBufferAttribute(swimData, 4).setUsage(DynamicDrawUsage));
  return geometry;
}

const DOLPHIN_GEOMETRY = podGeometry();
const DOLPHIN_MATERIAL = creatureMaterial(
  'fauna-dolphin-v1',
  {},
  'attribute vec4 aSwim;',
  `vec3 transformed = vec3(position);
// Nage dorso-ventrale : l'onde part du thorax et s'amplifie jusqu'à la caudale.
float podBody = smoothstep(0.45, -1.42, position.x);
float podBeat = sin(aSwim.x - position.x * 2.2);
transformed.y += podBeat * aSwim.y * (0.022 + podBody * podBody * 0.3);
// Cambrure du saut : nez et queue retombent autour du centre.
transformed.y -= aSwim.z * position.x * position.x * 0.3;
// Les pectorales planent et battent un peu.
float podFin = step(0.24, abs(position.z)) * step(0.0, position.x);
transformed.y += podFin * sin(aSwim.x * 0.5) * 0.06 * (abs(position.z) - 0.2);`,
  { roughness: 0.62 },
);

/* --------------------------------------------------------------------- comportement */

type Mode = 'idle' | 'approach' | 'escort' | 'leave';
type LeapKind = 'porpoise' | 'high' | 'spin' | 'flop';

interface Dolphin {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  heading: number;
  pitch: number;
  roll: number;
  arch: number;
  beat: number;
  beatAmp: number;
  size: number;
  /** Place dans le pod (repère du pod) : avant / côté. */
  slotF: number;
  slotS: number;
  seed: number;
  counter: number;
  leapStart: number;
  leapDuration: number;
  leapHeight: number;
  leapKind: LeapKind;
  nextLeap: number;
  nextBreath: number;
  breathStart: number;
  /** Un petit suit sa mère (index dans le pod), -1 pour un adulte. */
  calfOf: number;
}

interface PodState {
  mode: Mode;
  /** Temps de navigation restant avant la prochaine rencontre. */
  wait: number;
  modeTime: number;
  ax: number;
  az: number;
  heading: number;
  speed: number;
  leaveHeading: number;
  slowTime: number;
  lastTime: number;
  whistled: boolean;
}

const DEPTH = -0.6;
const LEAP_FLOOR = -0.75;
const STEP = 1 / 30;
const DEMO = faunaDemo.kind === 'dolphins';

// Mère + petit, trois adultes : formation en flèche devant l'étrave. Un seul pod au monde,
// donc un état de module (comme les objets flottants).
const pod: Dolphin[] = ([
  [6.4, 2.6, 1.05, -1],
  [6.2, -2.5, 1, -1],
  [3.6, 4.6, 1.08, -1],
  [8.8, -0.4, 0.98, -1],
  [6.4, 4.0, 0.62, 0],
] as const).map(([slotF, slotS, size, calfOf], index) => ({
  x: 0, z: 0, y: DEPTH, vx: 0, vz: 0, heading: 0, pitch: 0, roll: 0, arch: 0,
  beat: hash(index * 3.3) * 6.28, beatAmp: 1, size, slotF, slotS,
  seed: 17.3 + index * 7.77, counter: 0,
  leapStart: -100, leapDuration: 1, leapHeight: 1, leapKind: 'porpoise' as LeapKind,
  nextLeap: 0, nextBreath: 0, breathStart: -100, calfOf,
}));

const podState: PodState = {
  mode: 'idle',
  wait: DEMO ? 0 : 32 + hash(55.3) * 40,
  modeTime: 0,
  ax: 0,
  az: 0,
  heading: 0,
  speed: 0,
  leaveHeading: 0,
  slowTime: 0,
  lastTime: -1,
  whistled: false,
};

/** Aléa propre à chaque dauphin : une suite déterministe (captures reproductibles). */
function draw(dolphin: Dolphin) {
  dolphin.counter += 1;
  return hash(dolphin.seed * 3.17 + dolphin.counter * 11.13);
}

function chooseLeap(dolphin: Dolphin, time: number, playful: boolean) {
  const r = draw(dolphin);
  const calf = dolphin.calfOf >= 0;
  let kind: LeapKind = 'porpoise';
  if (playful && !calf) {
    if (r > 0.9) kind = 'flop';
    else if (r > 0.76) kind = 'spin';
    else if (r > 0.5) kind = 'high';
  } else if (calf && r > 0.7) kind = 'high';
  dolphin.leapKind = kind;
  dolphin.leapStart = time;
  const height = kind === 'porpoise' ? 0.75 + draw(dolphin) * 0.5
    : kind === 'flop' ? 1.5 + draw(dolphin) * 0.4
      : 1.9 + draw(dolphin) * 0.7;
  dolphin.leapHeight = height * (calf ? 0.7 : 1);
  dolphin.leapDuration = kind === 'porpoise' ? 0.95 + draw(dolphin) * 0.25 : 1.35 + draw(dolphin) * 0.3;
  const calm = playful ? 2.6 + draw(dolphin) * 4.2 : 0.7 + draw(dolphin) * 1.4;
  dolphin.nextLeap = time + dolphin.leapDuration + calm;
  // Saut synchronisé : un voisin adulte s'élance avec lui.
  if (kind === 'high' && draw(dolphin) > 0.6) {
    const partner = pod.find((other) => other !== dolphin && other.calfOf < 0
      && time - other.leapStart > other.leapDuration + 0.4);
    if (partner) {
      partner.leapKind = 'high';
      partner.leapStart = time + 0.06;
      partner.leapHeight = dolphin.leapHeight * 0.96;
      partner.leapDuration = dolphin.leapDuration;
      partner.nextLeap = time + dolphin.leapDuration + 2 + draw(partner) * 3;
    }
  }
  // Le petit imite sa mère, avec un temps de retard.
  for (const other of pod) {
    if (other.calfOf >= 0 && pod[other.calfOf] === dolphin && kind !== 'flop' && draw(dolphin) > 0.35) {
      other.leapKind = 'porpoise';
      other.leapStart = time + 0.35;
      other.leapHeight = 0.8;
      other.leapDuration = 0.9;
      other.nextLeap = time + 2.4 + draw(other) * 2;
    }
  }
}

function leapWindow(dolphin: Dolphin) {
  const c = -LEAP_FLOOR / (dolphin.leapHeight - LEAP_FLOOR);
  const root = Math.sqrt(Math.max(0, 1 - c));
  return { exit: (1 - root) * 0.5, entry: (1 + root) * 0.5 };
}

/** Repousse une place hors des côtes (le pod longe une île sans la traverser). */
const placement = { x: 0, z: 0 };
function keepOffshore(x: number, z: number) {
  placement.x = x;
  placement.z = z;
  for (const solid of SOLIDS) {
    const dx = placement.x - solid.x;
    const dz = placement.z - solid.z;
    const distance = Math.hypot(dx, dz);
    const min = solid.r + 3.5;
    if (distance < min && distance > 0.001) {
      placement.x = solid.x + (dx / distance) * min;
      placement.z = solid.z + (dz / distance) * min;
    }
  }
  return placement;
}

/** Petit sifflement modulé, branché sur le bus d'ambiance (rien si le son est coupé). */
function whistle() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime;
  const voice = context.createOscillator();
  const gain = context.createGain();
  voice.type = 'sine';
  voice.frequency.setValueAtTime(1500, now);
  voice.frequency.exponentialRampToValueAtTime(2900, now + 0.16);
  voice.frequency.exponentialRampToValueAtTime(1900, now + 0.34);
  voice.frequency.exponentialRampToValueAtTime(3300, now + 0.5);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
  voice.connect(gain).connect(destination);
  voice.start(now);
  voice.stop(now + 0.6);
  voice.addEventListener('ended', () => {
    voice.disconnect();
    gain.disconnect();
  }, { once: true });
}

function spawn(time: number) {
  const s = podState;
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  let ax: number;
  let az: number;
  if (DEMO) {
    ax = boatState.position.x + forwardX * 18 - forwardZ * 14;
    az = boatState.position.z + forwardZ * 18 + forwardX * 14;
  } else {
    // Ils surgissent devant, sur un côté : déjà dans le cadre de la caméra.
    const side = hash(time * 0.37 + 4.1) > 0.5 ? 1 : -1;
    const bearing = boatState.heading + side * (0.55 + hash(time * 0.71) * 0.35);
    const reach = 30 + hash(time * 1.3) * 8;
    ax = boatState.position.x + Math.cos(bearing) * reach;
    az = boatState.position.z + Math.sin(bearing) * reach;
    if (distanceToLand(ax, az) < 6 || Math.hypot(ax, az) > 118) {
      s.wait = 4; // trop près d'une côte ou du large interdit : on reporte
      return;
    }
  }
  s.mode = 'approach';
  s.modeTime = 0;
  s.ax = ax;
  s.az = az;
  s.heading = Math.atan2(boatState.position.z - az, boatState.position.x - ax);
  s.speed = 9;
  s.whistled = false;
  pod.forEach((dolphin, index) => {
    const lateral = s.heading + Math.PI / 2;
    dolphin.x = ax + Math.cos(lateral) * dolphin.slotS * 0.8 - Math.cos(s.heading) * index * 0.8;
    dolphin.z = az + Math.sin(lateral) * dolphin.slotS * 0.8 - Math.sin(s.heading) * index * 0.8;
    dolphin.heading = s.heading;
    dolphin.vx = Math.cos(s.heading) * s.speed;
    dolphin.vz = Math.sin(s.heading) * s.speed;
    dolphin.y = DEPTH;
    dolphin.leapStart = -100;
    dolphin.nextLeap = time + 0.2 + index * 0.37 + draw(dolphin) * 0.6;
    dolphin.nextBreath = time + 2 + draw(dolphin) * 3;
  });
}

/** Un pas de simulation (pas fixe en capture figée, sinon la durée de l'image). */
function advance(time: number, dt: number) {
  const s = podState;
  const world = useWorld.getState();

  if (s.mode === 'idle') {
    // Le compteur n'avance qu'en navigation : voir des dauphins reste lié au voyage.
    const sailing = world.phase === 'playing' && boatState.speed > 3.5;
    const life = ecologyState.worldLife * (0.45 + ecologyState.dayLarge * 0.55);
    if (sailing && life > 0.3) s.wait -= dt;
    if (s.wait > 0) return;
    spawn(time);
    if (s.mode === 'idle') return;
  }

  s.modeTime += dt;
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  if (DEMO) {
    // Démonstration à quai : le pod tourne autour du bateau immobile.
    const orbit = time * 0.3;
    s.ax = damp(s.ax, boatState.position.x + Math.cos(orbit) * 11, 1.5, dt);
    s.az = damp(s.az, boatState.position.z + Math.sin(orbit) * 11, 1.5, dt);
    s.heading = orbit + Math.PI / 2;
    s.speed = 3.3;
    if (s.mode === 'approach' && s.modeTime > 6) s.mode = 'escort';
  } else if (s.mode === 'approach' || s.mode === 'escort') {
    const bowX = boatState.position.x + forwardX * 3;
    const bowZ = boatState.position.z + forwardZ * 3;
    const boatSpeed = Math.max(boatState.speed, 0);
    if (s.mode === 'approach') {
      const dx = bowX - s.ax;
      const dz = bowZ - s.az;
      const gap = Math.hypot(dx, dz);
      s.heading += clamp(shortestAngle(s.heading, Math.atan2(dz, dx)), -1.2 * dt, 1.2 * dt);
      s.speed = damp(s.speed, clamp(boatSpeed + gap * 0.5, 7, 17), 2, dt);
      s.ax += Math.cos(s.heading) * s.speed * dt;
      s.az += Math.sin(s.heading) * s.speed * dt;
      if (gap < 7 || s.modeTime > 14) {
        s.mode = 'escort';
        s.modeTime = 0;
        if (!s.whistled) {
          s.whistled = true;
          whistle();
        }
      }
    } else {
      s.heading = boatState.heading;
      s.speed = boatSpeed;
      s.ax = damp(s.ax, bowX, 3, dt);
      s.az = damp(s.az, bowZ, 3, dt);
      s.slowTime = boatSpeed < 1.5 ? s.slowTime + dt : 0;
      if (s.modeTime > 22 || s.slowTime > 5 || world.phase !== 'playing') {
        s.mode = 'leave';
        s.modeTime = 0;
        const side = hash(time * 3.1) > 0.5 ? 1 : -1;
        s.leaveHeading = boatState.heading + side * (0.75 + hash(time * 5.3) * 0.4);
        for (const dolphin of pod) dolphin.nextLeap = Math.min(dolphin.nextLeap, time + 0.4 + draw(dolphin) * 1.4);
      }
    }
  } else {
    // Départ : le pod s'écarte du cap du bateau en accélérant, puis disparaît au large.
    s.heading += clamp(shortestAngle(s.heading, s.leaveHeading), -0.9 * dt, 0.9 * dt);
    s.speed = damp(s.speed, 12, 1.2, dt);
    s.ax += Math.cos(s.heading) * s.speed * dt;
    s.az += Math.sin(s.heading) * s.speed * dt;
    const far = Math.hypot(s.ax - boatState.position.x, s.az - boatState.position.z);
    if (far > 62 || s.modeTime > 16) {
      s.mode = 'idle';
      s.wait = 95 + hash(time * 0.13) * 120;
      return;
    }
  }

  const podX = Math.cos(s.heading);
  const podZ = Math.sin(s.heading);
  const escort = s.mode === 'escort' && !DEMO;
  const playful = s.mode === 'escort';

  pod.forEach((dolphin, index) => {
    // Place dans le pod, qui ondule : chacun « tisse » de son côté.
    const weave = Math.sin(time * (0.55 + index * 0.07) + dolphin.seed) * 1.3;
    const surge = Math.sin(time * (0.33 + index * 0.05) + dolphin.seed * 1.7) * 1.6;
    let slotF = escort ? dolphin.slotF : dolphin.slotF * 0.45 - 2.5;
    let slotS = (escort ? dolphin.slotS : dolphin.slotS * 0.7) + weave;
    if (dolphin.calfOf >= 0) {
      // Le petit nage contre le flanc de sa mère.
      const mother = pod[dolphin.calfOf];
      slotF = (escort ? mother.slotF : mother.slotF * 0.45 - 2.5) - 0.9;
      slotS = (escort ? mother.slotS : mother.slotS * 0.7) + Math.sign(mother.slotS || 1) * 1.1 + weave * 0.3;
    }
    const place = keepOffshore(
      s.ax + podX * (slotF + surge) - podZ * slotS,
      s.az + podZ * (slotF + surge) + podX * slotS,
    );

    const leaping = time >= dolphin.leapStart && time - dolphin.leapStart < dolphin.leapDuration;
    // Poursuite : vitesse du pod + rappel vers sa place. En l'air : trajectoire balistique.
    if (!leaping) {
      dolphin.vx = damp(dolphin.vx, podX * s.speed + (place.x - dolphin.x) * 1.4, 2.2, dt);
      dolphin.vz = damp(dolphin.vz, podZ * s.speed + (place.z - dolphin.z) * 1.4, 2.2, dt);
      const current = Math.hypot(dolphin.vx, dolphin.vz);
      if (current > 18) {
        dolphin.vx *= 18 / current;
        dolphin.vz *= 18 / current;
      }
    }
    dolphin.x += dolphin.vx * dt;
    dolphin.z += dolphin.vz * dt;
    const speed = Math.hypot(dolphin.vx, dolphin.vz);
    const course = Math.atan2(dolphin.vz, dolphin.vx);
    const turn = shortestAngle(dolphin.heading, course);
    if (speed > 0.3 && !leaping) dolphin.heading += clamp(turn, -2.4 * dt, 2.4 * dt);

    // Battement de queue : plus vif quand il file.
    dolphin.beat += (5.5 + Math.min(speed, 16) * 0.42) * dt;

    if (time >= dolphin.nextLeap && !leaping && time - dolphin.leapStart > dolphin.leapDuration) {
      const crowded = pod.some((other) => other !== dolphin
        && time >= other.leapStart && time - other.leapStart < 0.45);
      if (!crowded || !playful) chooseLeap(dolphin, time, playful);
      else dolphin.nextLeap = time + 0.5;
    }

    const surface = waveHeight(dolphin.x, dolphin.z, time);
    let y = surface + DEPTH + Math.sin(time * 1.3 + dolphin.seed) * 0.08;
    let pitch = 0;
    // Roulis : penché dans les virages, petit balancement sinon.
    let rollAngle = Math.sin(time * 0.8 + dolphin.seed) * 0.12 - clamp(turn * 2, -0.5, 0.5);
    let arch = 0;
    let beatAmp = 1;

    const u = time - dolphin.leapStart;
    if (u >= 0 && u < dolphin.leapDuration) {
      const k = u / dolphin.leapDuration;
      const span = dolphin.leapHeight - LEAP_FLOOR;
      y = surface + LEAP_FLOOR + span * 4 * k * (1 - k);
      const climb = span * (4 - 8 * k) / dolphin.leapDuration;
      pitch = clamp(Math.atan2(climb, Math.max(speed, 2.6)), -1.25, 1.25);
      const { exit, entry } = leapWindow(dolphin);
      beatAmp = k > exit && k < entry ? 0.12 : 1;
      arch = Math.sin(Math.PI * k) * (dolphin.leapKind === 'porpoise' ? 0.35 : 0.6);
      if (dolphin.leapKind === 'spin') rollAngle = Math.PI * 4 * clamp((k - 0.2) / 0.6, 0, 1) ** 1.2;
      if (dolphin.leapKind === 'flop') {
        rollAngle = clamp((k - 0.35) / 0.5, 0, 1) * 1.45;
        pitch *= 0.55;
      }
      const prevK = (u - dt) / dolphin.leapDuration;
      const dirX = dolphin.vx / Math.max(speed, 0.01);
      const dirZ = dolphin.vz / Math.max(speed, 0.01);
      const small = dolphin.calfOf >= 0 ? 0.6 : 1;
      if (crossed(prevK, k, exit)) {
        splash(dolphin.x, dolphin.z, dolphin.leapStart + exit * dolphin.leapDuration, 0.55 * small, dirX, dirZ);
      }
      if (crossed(prevK, k, entry)) {
        const big = dolphin.leapKind === 'flop' ? 1.75 : dolphin.leapKind === 'porpoise' ? 0.8 : 1.15;
        splash(dolphin.x, dolphin.z, dolphin.leapStart + entry * dolphin.leapDuration, big * small, dirX, dirZ);
        if (dolphin.leapKind !== 'porpoise') ambience.bump('soft', 0.12 * big);
      }
    } else {
      // Respiration : le dos et l'évent affleurent, petit souffle.
      if (time >= dolphin.nextBreath) {
        dolphin.breathStart = time;
        dolphin.nextBreath = time + 3.5 + draw(dolphin) * 4;
      }
      const b = (time - dolphin.breathStart) / 0.9;
      if (b >= 0 && b < 1) {
        y += Math.sin(Math.PI * b) * 0.42;
        pitch = Math.cos(Math.PI * b) * 0.22;
        if (crossed((time - dt - dolphin.breathStart) / 0.9, b, 0.45)) {
          spout(
            dolphin.x + Math.cos(dolphin.heading) * 0.55 * dolphin.size,
            surface + 0.25,
            dolphin.z + Math.sin(dolphin.heading) * 0.55 * dolphin.size,
            dolphin.breathStart + 0.405,
            0.22,
          );
        }
      }
    }

    dolphin.y = y;
    dolphin.pitch = damp(dolphin.pitch, pitch, leaping ? 30 : 6, dt);
    dolphin.roll = leaping ? rollAngle : damp(dolphin.roll, rollAngle, 4, dt);
    dolphin.arch = damp(dolphin.arch, arch, 12, dt);
    dolphin.beatAmp = damp(dolphin.beatAmp, beatAmp, 8, dt);
  });
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler(0, 0, 0, 'YZX');
const position = new Vector3();
const scale = new Vector3();

export function DolphinPod() {
  const mesh = useRef<InstancedMesh>(null);

  useFrame((frame, delta) => {
    const target = mesh.current;
    if (!target) return;
    const s = podState;
    const time = faunaClock(frame.clock.elapsedTime);
    if (faunaDemo.freeze !== null) {
      // Capture figée : la scène est rejouée depuis l'instant 0, à pas fixes.
      if (s.lastTime < 0) s.lastTime = 0;
      while (s.lastTime + STEP <= time) {
        s.lastTime += STEP;
        advance(s.lastTime, STEP);
      }
    } else {
      advance(time, Math.min(delta, 1 / 30));
    }

    const visible = s.mode !== 'idle' && useWorld.getState().reveal > 0.75;
    target.visible = visible;
    if (!visible) return;

    pod.forEach((dolphin, index) => {
      position.set(dolphin.x, dolphin.y, dolphin.z);
      euler.set(dolphin.roll, -dolphin.heading, dolphin.pitch, 'YZX');
      quaternion.setFromEuler(euler);
      scale.setScalar(dolphin.size);
      matrix.compose(position, quaternion, scale);
      target.setMatrixAt(index, matrix);
      swimData[index * 4] = dolphin.beat;
      swimData[index * 4 + 1] = dolphin.beatAmp;
      swimData[index * 4 + 2] = dolphin.arch;
    });
    target.instanceMatrix.needsUpdate = true;
    DOLPHIN_GEOMETRY.getAttribute('aSwim').needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[DOLPHIN_GEOMETRY, DOLPHIN_MATERIAL, POD]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
      visible={false}
    />
  );
}
