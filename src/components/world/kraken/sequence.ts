import { boatState, resetBoat } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, smoothstep } from '@/lib/utils/math';
import { krakenDemo, type KrakenPose } from './demo';
import { arms, type ArmPose } from './rig';
import { ARMS, BURSTS, burstParams, burstPosition, krakenState } from './state';

/**
 * Séquence de la mer interdite. Mêmes étapes et mêmes sorties que l'ancien monstre
 * (idle → shadow → hush → approach → stalk → coil → attack → impact → respawn → cooldown),
 * désormais un kraken :
 *  - à l'approche de la limite, des pointes de tentacules crèvent la surface au loin ;
 *  - une ombre immense passe sous le bateau, l'orage se lève, tout se tait ;
 *  - les bras se dressent en cercle autour du bateau, la tête émerge, l'œil s'ouvre et fixe ;
 *  - deux bras s'enroulent autour de la coque, soulèvent le bateau et le lancent vers
 *    l'archipel ; le kraken replonge dans un nuage d'encre qui couvre le retour au port.
 * Toute l'animation dérive de l'horloge de séquence T : un moment peut être figé (démo).
 */
export type Stage = 'idle' | 'shadow' | 'hush' | 'approach' | 'stalk' | 'coil' | 'attack' | 'impact' | 'respawn' | 'cooldown';
type Active = Exclude<Stage, 'idle'>;

const DURATION: Record<Active, number> = {
  shadow: 3.8,
  hush: 1.15,
  approach: 2.8,
  stalk: 2.4,
  coil: 2.0,
  attack: 2.2,
  impact: 1.4,
  respawn: 1.65,
  cooldown: 1.1,
};
const ORDER: Active[] = ['shadow', 'hush', 'approach', 'stalk', 'coil', 'attack', 'impact', 'respawn', 'cooldown'];
const START = {} as Record<Active, number>;
{
  let cursor = 0;
  for (const stage of ORDER) {
    START[stage] = cursor;
    cursor += DURATION[stage];
  }
}
const T_APPROACH = START.approach;
const T_STALK = START.stalk;
const T_COIL = START.coil;
const T_ATTACK = START.attack;
const T_IMPACT = START.impact;
const T_RESPAWN = START.respawn;
/** Le bras lâche le bateau. */
const T_RELEASE = T_IMPACT + 0.55;
/** Le second bras lâche la coque et fouette l'eau. */
const T_SLAP = T_ATTACK + 1.1;

/** Bras du cercle (angle autour du bateau depuis la direction de la tête, en radians). */
const RING = [
  { angle: 0.98, radius: 16, length: 42, thickness: 2.2, order: 2, lean: 0.95, curl: 3.6, tilt: -0.32, twist: 0.35 },
  { angle: -1.0, radius: 16.5, length: 44, thickness: 2.3, order: 0, lean: 0.85, curl: 3.9, tilt: -0.28, twist: -0.35 },
  { angle: 1.5, radius: 15.5, length: 38, thickness: 2.0, order: 4, lean: 1.05, curl: 3.4, tilt: -0.36, twist: 0.45 },
  { angle: -1.52, radius: 16, length: 40, thickness: 2.05, order: 1, lean: 0.95, curl: 3.7, tilt: -0.3, twist: -0.45 },
  // Les deux bras qui saisissent la coque : avant (4) et arrière (5).
  { angle: 2.0, radius: 12.5, length: 34, thickness: 1.7, order: 5, lean: 1.1, curl: 3.0, tilt: -0.25, twist: 0 },
  { angle: -1.95, radius: 13, length: 34, thickness: 1.7, order: 3, lean: 1.1, curl: 3.2, tilt: -0.25, twist: 0 },
  { angle: 2.7, radius: 16.5, length: 36, thickness: 1.85, order: 6, lean: 1.0, curl: 3.5, tilt: -0.34, twist: 0.25 },
  { angle: -2.72, radius: 17, length: 37, thickness: 1.9, order: 7, lean: 0.98, curl: 3.6, tilt: -0.32, twist: -0.25 },
] as const;
const GRAB_FRONT = 4;
const GRAB_BACK = 5;
/** Bras utilisés pour les pointes d'avertissement (hors séquence). */
const TEASE_A = 6;
const TEASE_B = 7;

const seq = {
  stage: 'idle' as Stage,
  timer: 0,
  cooldown: 0,
  side: 1,
  approachX: 0,
  approachZ: 0,
  resetDone: false,
  // Ancrage (bateau à l'arrêt au début de l'approche) et repère : dehors, latéral.
  anchorX: 0,
  anchorZ: 0,
  anchorHeading: 0,
  outX: 1,
  outZ: 0,
  latX: 0,
  latZ: 1,
  headX: 0,
  headZ: 0,
  landX: 0,
  landZ: 0,
  // Pointes d'avertissement.
  teaseClock: 0,
  teaseActive: false,
  teaseNext: 3.5,
  teaseX: 0,
  teaseZ: 0,
  teaseDirX: 1,
  teaseDirZ: 0,
  teaseSeed: 0,
  // Démo.
  demoSeen: 0,
  demoPending: false,
  demoPose: null as KrakenPose | null,
  demoLoop: 0,
  frozen: false,
  lastT: 0,
};

/* ------------------------------------------------------------------ Outils */

const carryAxis = { x: 0, y: 0, z: 0 };

/** Rotation de la doublure du bateau (groupe Ry(lacet) puis Rx(roulis)·Rz(tangage)). */
function rotateCarry(x: number, y: number, z: number, yaw: number, pitch: number, roll: number) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = x * cp - y * sp;
  const y1 = x * sp + y * cp;
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const y2 = y1 * cr - z * sr;
  const z2 = y1 * sr + z * cr;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  carryAxis.x = x1 * cy + z2 * sy;
  carryAxis.y = y2;
  carryAxis.z = -x1 * sy + z2 * cy;
  return carryAxis;
}

function crossed(previous: number, current: number, mark: number) {
  return previous < mark && current >= mark;
}

/** Impulsion qui monte en 50 ms puis s'éteint. */
function pulse(x: number, decay: number) {
  if (x < 0) return 0;
  return Math.min(1, x / 0.05) * Math.exp(-x * decay);
}

/** Repère du bateau tenu : vrai bateau avant la saisie, doublure ensuite. */
const hold = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };

function hideArm(arm: ArmPose) {
  arm.visible = 0;
  arm.rise = 0;
  arm.wrap = 0;
  arm.coil = 0;
}

let burstCursor = 0;
function clearBursts() {
  burstCursor = 0;
  for (let i = 0; i < BURSTS; i++) {
    burstPosition[i * 4 + 3] = 99;
    burstParams[i * 4] = 0;
  }
}

function addBurst(x: number, y: number, z: number, age: number, strength: number, radius: number, lift: number) {
  if (age < 0 || age > 2.2 || burstCursor >= BURSTS) return;
  const i = burstCursor++;
  burstPosition[i * 4] = x;
  burstPosition[i * 4 + 1] = y;
  burstPosition[i * 4 + 2] = z;
  burstPosition[i * 4 + 3] = age;
  burstParams[i * 4] = strength;
  burstParams[i * 4 + 1] = radius;
  burstParams[i * 4 + 2] = lift;
}

/* ------------------------------------------------------------------ Pointes d'avertissement */

function poseTease(arm: ArmPose, clock: number, big: boolean, x: number, z: number, dirX: number, dirZ: number, seed: number) {
  const duration = 4.2;
  const u = clock / duration;
  const up = smoothstep(0, 0.3, u) * (1 - smoothstep(0.68, 1, u));
  if (up <= 0.001) {
    hideArm(arm);
    return;
  }
  arm.visible = 1;
  arm.rootX = x;
  arm.rootZ = z;
  arm.dirX = dirX;
  arm.dirZ = dirZ;
  arm.length = big ? 30 : 23;
  arm.thickness = big ? 2.0 : 1.5;
  arm.rise = 0.22 + up * 0.42;
  arm.tilt = 0.18;
  arm.lean = 0.45;
  arm.curl = 2.9 - up * 0.9 + Math.sin(clock * 1.3 + seed) * 0.25;
  arm.sway = 1.5;
  arm.phase = seed * 6.28;
  arm.twist = big ? 0.5 : -0.4;
  arm.wet = 1;
  arm.wrap = 0;
  arm.coil = 0;
}

function updateTeases(dt: number, allowed: boolean) {
  if (!seq.teaseActive) {
    seq.teaseNext -= dt;
    if (allowed && seq.teaseNext <= 0) {
      // Devant le bateau, vers le large, à 34–46 m : on les voit depuis la caméra de jeu.
      const heading = boatState.heading;
      const fx = Math.cos(heading);
      const fz = Math.sin(heading);
      const side = Math.random() > 0.5 ? 1 : -1;
      const distance = 30 + Math.random() * 10;
      const offset = (6 + Math.random() * 10) * side;
      seq.teaseX = boatState.position.x + fx * distance - fz * offset;
      seq.teaseZ = boatState.position.z + fz * distance + fx * offset;
      // Les crosses se penchent vers le bateau.
      const toBoatX = boatState.position.x - seq.teaseX;
      const toBoatZ = boatState.position.z - seq.teaseZ;
      const length = Math.hypot(toBoatX, toBoatZ) || 1;
      seq.teaseDirX = toBoatX / length;
      seq.teaseDirZ = toBoatZ / length;
      seq.teaseSeed = Math.random();
      seq.teaseClock = 0;
      seq.teaseActive = true;
    }
  } else {
    seq.teaseClock += dt;
    if (seq.teaseClock > 4.4) {
      seq.teaseActive = false;
      seq.teaseNext = 5 + Math.random() * 5;
    }
  }
  applyTeases();
}

function applyTeases() {
  if (!seq.teaseActive) {
    hideArm(arms[TEASE_A]);
    hideArm(arms[TEASE_B]);
    return;
  }
  const clock = seq.teaseClock;
  const sideX = -seq.teaseDirZ;
  const sideZ = seq.teaseDirX;
  poseTease(arms[TEASE_A], clock, true, seq.teaseX, seq.teaseZ, seq.teaseDirX, seq.teaseDirZ, seq.teaseSeed);
  poseTease(
    arms[TEASE_B],
    clock - 0.7,
    false,
    seq.teaseX + sideX * 9 + seq.teaseDirX * 5,
    seq.teaseZ + sideZ * 9 + seq.teaseDirZ * 5,
    seq.teaseDirX,
    seq.teaseDirZ,
    seq.teaseSeed + 0.4,
  );
  addBurst(seq.teaseX, 0.1, seq.teaseZ, clock - 0.7, 0.6, 1.2, 0.7);
  addBurst(seq.teaseX + sideX * 9 + seq.teaseDirX * 5, 0.1, seq.teaseZ + sideZ * 9 + seq.teaseDirZ * 5, clock - 1.4, 0.45, 1, 0.6);
}

/* ------------------------------------------------------------------ Mise en place */

function captureAnchor() {
  seq.anchorX = boatState.position.x;
  seq.anchorZ = boatState.position.z;
  seq.anchorHeading = boatState.heading;
  // Le kraken garde le large : sa tête émerge du côté de la haute mer.
  const distance = Math.hypot(seq.anchorX, seq.anchorZ);
  if (distance > 1) {
    seq.outX = seq.anchorX / distance;
    seq.outZ = seq.anchorZ / distance;
  } else {
    seq.outX = Math.cos(seq.anchorHeading);
    seq.outZ = Math.sin(seq.anchorHeading);
  }
  seq.latX = -seq.outZ * seq.side;
  seq.latZ = seq.outX * seq.side;
  seq.headX = seq.anchorX + seq.outX * 22 + seq.latX * 3;
  seq.headZ = seq.anchorZ + seq.outZ * 22 + seq.latZ * 3;
}

function startSequence() {
  seq.stage = 'shadow';
  seq.timer = 0;
  seq.side = Math.sin(boatState.position.x * 0.17 + boatState.position.z) > 0 ? 1 : -1;
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  const sideX = -forwardZ * seq.side;
  const sideZ = forwardX * seq.side;
  seq.approachX = boatState.position.x + forwardX * 31 + sideX * 20;
  seq.approachZ = boatState.position.z + forwardZ * 31 + sideZ * 20;
  seq.teaseActive = false;
  seq.lastT = 0;
  captureAnchor();
  useWorld.setState({ destination: null, freeTarget: null, activeIsland: null });
}

/* ------------------------------------------------------------------ Démo (développement) */

const DEMO_POSES: Record<KrakenPose, { stage: Stage; timer: number }> = {
  tips: { stage: 'idle', timer: 0 },
  shadow: { stage: 'shadow', timer: 2.3 },
  ring: { stage: 'stalk', timer: 1.7 },
  eye: { stage: 'coil', timer: 0.55 },
  wrap: { stage: 'coil', timer: 1.92 },
  lift: { stage: 'attack', timer: 1.75 },
  toss: { stage: 'impact', timer: 0.8 },
  ink: { stage: 'impact', timer: 1.18 },
};

function placeDemoBoat() {
  const angle = 2.55;
  boatState.position.set(Math.cos(angle) * 171, 0, Math.sin(angle) * 171);
  boatState.heading = angle;
  boatState.speed = 0;
  boatState.collision = 0;
}

function startDemo() {
  const world = useWorld.getState();
  if (world.phase === 'loading') return false;
  if (world.phase === 'intro' || world.phase === 'transitioning') world.revealComplete();
  placeDemoBoat();
  useWorld.setState({ phase: 'playing', destination: null, freeTarget: null, activeIsland: null });
  seq.demoPose = krakenDemo.pose;
  seq.cooldown = 0;
  seq.resetDone = false;
  clearBursts();
  if (seq.demoPose) {
    const pose = DEMO_POSES[seq.demoPose];
    startSequence();
    seq.stage = pose.stage;
    seq.timer = pose.timer;
    seq.frozen = true;
    if (seq.demoPose === 'tips') {
      seq.teaseActive = true;
      seq.teaseClock = 1.75;
      const fx = Math.cos(boatState.heading);
      const fz = Math.sin(boatState.heading);
      seq.teaseX = boatState.position.x + fx * 33 - fz * 7;
      seq.teaseZ = boatState.position.z + fz * 33 + fx * 7;
      const length = Math.hypot(boatState.position.x - seq.teaseX, boatState.position.z - seq.teaseZ) || 1;
      seq.teaseDirX = (boatState.position.x - seq.teaseX) / length;
      seq.teaseDirZ = (boatState.position.z - seq.teaseZ) / length;
      seq.teaseSeed = 0.3;
    }
  } else {
    seq.frozen = false;
    startSequence();
  }
  return true;
}

/** Météo imposée pendant la démo (sinon elle dépend de la distance au centre). */
function demoWeather() {
  const tips = seq.demoPose === 'tips';
  ecologyState.stormCover = tips ? 0.5 : 0.93;
  ecologyState.stormWaves = tips ? 0.32 : 0.7;
  ecologyState.stormWind = tips ? 0.45 : 0.82;
  ecologyState.stormRain = tips ? 0.1 : 0.36;
  ecologyState.boundaryDanger = tips ? 0.2 : 0.8;
}

/* ------------------------------------------------------------------ Image par image */

/** Avance la séquence, écrit ecologyState / krakenState et la pose des bras. */
export function stepKraken(delta: number, time: number) {
  const dt = Math.min(delta, 1 / 15);
  const world = useWorld.getState();
  const calm = world.reducedMotion ? 0.35 : 1;
  krakenState.calm = calm;
  krakenState.time = time;
  krakenState.night = skyState.dayNight;
  krakenState.flash = ecologyState.stormFlash;
  burstCursor = 0;
  for (let i = 0; i < BURSTS; i++) burstParams[i * 4] = 0;

  if (process.env.NODE_ENV !== 'production') {
    if (krakenDemo.request !== seq.demoSeen) {
      seq.demoSeen = krakenDemo.request;
      seq.demoPending = true;
    }
    if (seq.demoPending && startDemo()) seq.demoPending = false;
    const demoActive = krakenDemo.enabled && (seq.frozen || (seq.stage !== 'idle' && seq.stage !== 'respawn' && seq.stage !== 'cooldown'));
    if (demoActive) demoWeather();
    // Boucle de démo : quelques secondes au port, puis retour au bord du monde.
    if (krakenDemo.enabled && !seq.frozen && seq.stage === 'idle' && !seq.demoPending) {
      seq.demoLoop += dt;
      if (seq.demoLoop > 3.5) {
        seq.demoLoop = 0;
        seq.demoPending = true;
      }
    } else {
      seq.demoLoop = 0;
    }
  }

  const timelineDt = seq.frozen ? 0 : Math.min(delta, 0.25);
  seq.cooldown = Math.max(0, seq.cooldown - dt);
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  const sideX = -forwardZ * seq.side;
  const sideZ = forwardX * seq.side;

  ecologyState.sequenceActive = seq.stage === 'idle' || seq.stage === 'cooldown' ? 0 : 1;
  ecologyState.boundaryStage = seq.stage;
  ecologyState.monsterEffectTime = seq.timer;

  if (seq.stage === 'idle') {
    ecologyState.boundaryHush = damp(ecologyState.boundaryHush, 0, 3, dt);
    ecologyState.boundaryCinematic = damp(ecologyState.boundaryCinematic, 0, 2.2, dt);
    ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, 0, 4, dt);
    ecologyState.monsterShadow = 0;
    ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 3, dt);
    ecologyState.monsterSurface = damp(ecologyState.monsterSurface, 0, 3, dt);
    ecologyState.impact = 0;
    ecologyState.respawnFade = 0;
    ecologyState.leviathanAttack = 0;
    krakenState.shadow.strength = 0;
    for (let i = 0; i < ARMS; i++) if (i !== TEASE_A && i !== TEASE_B) hideArm(arms[i]);
    hideHead();
    krakenState.carry.visible = false;
    krakenState.veil = 0;
    krakenState.ink.fade = damp(krakenState.ink.fade, 0, 0.6, dt);
    const sailing = world.phase === 'playing';
    // Pointes au loin dès l'avertissement (avant même la tempête), pas pendant la recharge.
    const teaseAllowed = sailing && seq.cooldown <= 0 && ecologyState.boundaryWarning > 0.3;
    if (seq.frozen) applyTeases();
    else updateTeases(dt, teaseAllowed);
    if (!seq.frozen && sailing && seq.cooldown <= 0 && ecologyState.leviathan > 0.56) startSequence();
    finish();
    return;
  }

  seq.timer += timelineDt;
  const stage = seq.stage;
  const lockTarget = stage === 'shadow' ? 0.16 : stage === 'hush' ? 0.38 : 1;
  ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, lockTarget, 2.4, dt);
  boatState.speed = damp(boatState.speed, 0, stage === 'shadow' ? 0.42 : 2.8, dt);
  ecologyState.boundaryHush = damp(ecologyState.boundaryHush, stage === 'hush' ? 1 : 0, 3.2, dt);
  const cameraTarget = stage === 'shadow' ? 0.12 : stage === 'hush' ? 0.28 : stage === 'respawn' || stage === 'cooldown' ? 0 : 1;
  ecologyState.boundaryCinematic = seq.frozen
    ? cameraTarget
    : damp(ecologyState.boundaryCinematic, cameraTarget, 1.45, dt);

  const T = START[stage] + seq.timer;
  const shadow = krakenState.shadow;

  if (stage === 'shadow') {
    const progress = clamp(seq.timer / DURATION.shadow, 0, 1);
    const eased = smoothstep(0, 1, progress);
    const fromX = boatState.position.x - forwardX * 30 - sideX * 24;
    const fromZ = boatState.position.z - forwardZ * 30 - sideZ * 24;
    const toX = boatState.position.x + forwardX * 35 + sideX * 16;
    const toZ = boatState.position.z + forwardZ * 35 + sideZ * 16;
    const x = fromX + (toX - fromX) * eased;
    const z = fromZ + (toZ - fromZ) * eased;
    const strength = Math.sin(progress * Math.PI) * 0.94;
    setShadow(x, z, strength, boatState.heading - seq.side * 0.22, 52, 25);
    ecologyState.monsterWake = strength * 0.82;
    ecologyState.monsterSurface = strength * 0.06;
    ecologyState.monsterFromX = fromX;
    ecologyState.monsterFromZ = fromZ;
    ecologyState.monsterToX = x;
    ecologyState.monsterToZ = z;
  } else if (stage === 'hush') {
    shadow.strength = damp(shadow.strength, 0, 4, dt);
    ecologyState.monsterShadow = shadow.strength;
    ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 2.6, dt);
    ecologyState.monsterSurface = 0;
  } else if (stage === 'approach') {
    // L'ombre file vers l'endroit où la tête va émerger, et s'efface quand elle perce.
    const progress = clamp(seq.timer / DURATION.approach, 0, 1);
    const eased = smoothstep(0, 1, progress);
    const curve = Math.sin(progress * Math.PI) * seq.side * 4.2;
    const x = seq.approachX + (seq.headX - seq.approachX) * eased - seq.outZ * curve;
    const z = seq.approachZ + (seq.headZ - seq.approachZ) * eased + seq.outX * curve;
    const heading = Math.atan2(seq.anchorZ - z, seq.anchorX - x);
    setShadow(x, z, (0.3 + Math.sin(progress * Math.PI) * 0.46) * (1 - smoothstep(0.6, 1, progress)), heading, 50, 24);
    ecologyState.monsterWake = 0.32 + eased * 0.3;
    ecologyState.monsterSurface = 0.04 + Math.sin(progress * Math.PI) * 0.1;
    ecologyState.monsterFromX = seq.approachX;
    ecologyState.monsterFromZ = seq.approachZ;
    ecologyState.monsterToX = x;
    ecologyState.monsterToZ = z;
  } else if (stage === 'stalk' || stage === 'coil' || stage === 'attack' || stage === 'impact') {
    shadow.strength = damp(shadow.strength, 0, 3, dt);
    ecologyState.monsterShadow = shadow.strength;
    ecologyState.monsterX = seq.headX;
    ecologyState.monsterZ = seq.headZ;
    // Écume autour du dôme : segment le long de la tête (lu par l'océan et le plancton).
    ecologyState.monsterFromX = seq.headX + seq.outX * 6;
    ecologyState.monsterFromZ = seq.headZ + seq.outZ * 6;
    ecologyState.monsterToX = seq.headX - seq.outX * 4;
    ecologyState.monsterToZ = seq.headZ - seq.outZ * 4;
    const rise = krakenState.head.rise;
    // L'écume de l'océan reste une frange : les collerettes du rig dessinent le reste.
    ecologyState.monsterWake = stage === 'impact' ? 0.5 : 0.12 + rise * 0.1;
    ecologyState.monsterSurface = stage === 'impact' ? 1 : 0.1 + rise * 0.4;
    ecologyState.leviathanAttack = stage === 'attack' || stage === 'impact' ? smoothstep(T_ATTACK, T_ATTACK + 0.22, T) : 0;
    ecologyState.impact = Math.max(pulse(T - T_SLAP, 4.5) * 0.45, pulse(T - T_RELEASE, 3.6) * 0.95);
    ecologyState.respawnFade = stage === 'impact' ? smoothstep(T_IMPACT + 0.78, T_IMPACT + 1.38, T) : 0;
  } else if (stage === 'respawn') {
    ecologyState.respawnFade = seq.timer < 0.58 ? 1 : 1 - smoothstep(0.58, 1.65, seq.timer);
    ecologyState.impact = damp(ecologyState.impact, 0, 5, dt);
    ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 3, dt);
    ecologyState.monsterSurface = damp(ecologyState.monsterSurface, 0, 4, dt);
    ecologyState.monsterShadow = 0;
    shadow.strength = 0;
    if (!seq.resetDone && seq.timer >= 0.28) {
      seq.resetDone = true;
      resetBoat();
      seq.landX = boatState.position.x;
      seq.landZ = boatState.position.z;
      ecologyState.boundaryWarning = 0;
      ecologyState.boundaryDanger = 0;
      ecologyState.leviathan = 0;
      ecologyState.stormCover = 0;
      ecologyState.stormWaves = 0;
      ecologyState.stormWind = 0;
      ecologyState.stormRain = 0;
      ecologyState.leviathanAttack = 0;
      useWorld.setState({ phase: 'playing', destination: null, freeTarget: null, activeIsland: null });
    }
  } else {
    // cooldown
    shadow.strength = 0;
    ecologyState.respawnFade = 0;
    ecologyState.leviathanAttack = 0;
    ecologyState.monsterShadow = 0;
    ecologyState.boundaryCinematic = damp(ecologyState.boundaryCinematic, 0, 3, dt);
    ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, 0, 4, dt);
  }

  poseSequence(T, time, calm);
  krakenState.veil = ecologyState.respawnFade;
  // Un éclair révèle le cercle de bras, un autre accompagne le lancer.
  if (!seq.frozen && (crossed(seq.lastT, T, T_STALK + 0.3) || crossed(seq.lastT, T, T_RELEASE + 0.05))) {
    krakenState.strike += 1;
    krakenState.strikeX = seq.headX + seq.outX * 14 + seq.latX * 10;
    krakenState.strikeZ = seq.headZ + seq.outZ * 14 + seq.latZ * 10;
  }
  seq.lastT = T;

  if (seq.timer >= DURATION[stage] && !seq.frozen) {
    const index = ORDER.indexOf(stage);
    const next = index < ORDER.length - 1 ? ORDER[index + 1] : 'idle';
    if (next === 'respawn') seq.resetDone = false;
    if (next === 'idle') seq.cooldown = 28;
    if (next === 'approach') captureAnchor();
    seq.stage = next;
    seq.timer = 0;
  }
  finish();
}

function setShadow(x: number, z: number, strength: number, heading: number, length: number, width: number) {
  const shadow = krakenState.shadow;
  shadow.x = x;
  shadow.z = z;
  shadow.strength = strength;
  shadow.heading = heading;
  shadow.length = length;
  shadow.width = width;
  ecologyState.monsterX = x;
  ecologyState.monsterZ = z;
  ecologyState.monsterShadow = strength;
}

function hideHead() {
  const head = krakenState.head;
  head.rise = 0;
  head.y = -30;
  krakenState.eye.open = 0;
}

/** Visibilité globale : quelque chose du kraken est-il à l'écran ? */
function finish() {
  let any = krakenState.carry.visible || krakenState.head.rise > 0.001 || krakenState.ink.fade > 0.01
    || krakenState.shadow.strength > 0.01 || krakenState.veil > 0.001;
  for (let i = 0; i < ARMS && !any; i++) any = arms[i].visible > 0;
  krakenState.visible = any;
}

/* ------------------------------------------------------------------ Chorégraphie */

function poseSequence(T: number, time: number, calm: number) {
  const night = krakenState.night;
  const boatX = boatState.position.x;
  const boatZ = boatState.position.z;

  // Pendant l'ombre, deux pointes percent encore au loin devant le bateau.
  if (T < START.hush + 0.6) {
    if (!seq.teaseActive) {
      seq.teaseActive = true;
      const fx = Math.cos(boatState.heading);
      const fz = Math.sin(boatState.heading);
      seq.teaseX = boatX + fx * 38 + fz * 8 * seq.side;
      seq.teaseZ = boatZ + fz * 38 - fx * 8 * seq.side;
      const length = Math.hypot(boatX - seq.teaseX, boatZ - seq.teaseZ) || 1;
      seq.teaseDirX = (boatX - seq.teaseX) / length;
      seq.teaseDirZ = (boatZ - seq.teaseZ) / length;
      seq.teaseSeed = 0.7;
    }
    seq.teaseClock = Math.max(0, T - 0.3);
    applyTeases();
  } else {
    seq.teaseActive = false;
  }

  /* --- Bateau tenu : vrai bateau jusqu'à la saisie, doublure soulevée puis lancée --- */
  const carry = krakenState.carry;
  const towardHeadX = seq.headX - seq.anchorX;
  const towardHeadZ = seq.headZ - seq.anchorZ;
  const headDistance = Math.hypot(towardHeadX, towardHeadZ) || 1;
  const thx = towardHeadX / headDistance;
  const thz = towardHeadZ / headDistance;
  hold.x = boatX;
  hold.y = 0.05;
  hold.z = boatZ;
  hold.yaw = -boatState.heading;
  hold.pitch = 0;
  hold.roll = 0;
  const carried = T >= T_ATTACK && T < T_RESPAWN + 0.3;
  if (carried) {
    const lift = smoothstep(T_ATTACK + 0.18, T_ATTACK + 2.0, T);
    // Le bateau pend, se balance, puis est armé en arrière avant d'être lancé.
    hold.x = seq.anchorX + thx * lift * 3.5;
    hold.z = seq.anchorZ + thz * lift * 3.5;
    hold.y = 0.05 + lift * 12.5 + Math.sin(T * 9) * 0.25 * (1 - lift) * calm;
    hold.pitch = lift * 0.32 + Math.sin(time * 1.7) * 0.1 * lift * calm;
    hold.roll = Math.sin(time * 2.2 + 0.6) * 0.22 * lift * calm;
    hold.yaw = -seq.anchorHeading + lift * 0.5 * seq.side;
    if (T >= T_IMPACT) {
      const windUp = smoothstep(T_IMPACT, T_RELEASE, T);
      hold.x += thx * windUp * 4;
      hold.z += thz * windUp * 4;
      hold.y += windUp * 3.5;
      hold.pitch -= windUp * 0.6;
    }
    if (T >= T_RELEASE) {
      // Lancé balistique vers l'archipel, en culbutant.
      const t = T - T_RELEASE;
      const speed = calm < 1 ? 20 : 34;
      const releaseX = seq.anchorX + thx * 7.5;
      const releaseZ = seq.anchorZ + thz * 7.5;
      hold.x = releaseX - seq.outX * speed * t;
      hold.z = releaseZ - seq.outZ * speed * t;
      hold.y = 16.05 + 13 * t - 8 * t * t;
      hold.pitch = 0.32 - 0.6 + t * 7.5 * calm;
      hold.roll = t * 2.6 * calm;
      hold.yaw = -seq.anchorHeading + 0.5 * seq.side + t * 1.2 * calm;
    }
    carry.x = hold.x;
    carry.y = hold.y;
    carry.z = hold.z;
    carry.yaw = hold.yaw;
    carry.pitch = hold.pitch;
    carry.roll = hold.roll;
  }
  carry.visible = carried;

  /* --- Bras --- */
  const anchorX = seq.anchorX;
  const anchorZ = seq.anchorZ;
  for (let i = 0; i < ARMS; i++) {
    if (T < START.hush + 0.6 && (i === TEASE_A || i === TEASE_B)) continue;
    const arm = arms[i];
    const spec = RING[i];
    if (T < T_APPROACH) {
      hideArm(arm);
      continue;
    }
    const start = T_APPROACH + spec.order * 0.32;
    const up = smoothstep(start, start + 2.0, T);
    const down = smoothstep(T_IMPACT + 0.3 + spec.order * 0.07, T_RESPAWN + 0.3, T);
    const rise = up * (1 - down);
    if (rise <= 0.001) {
      hideArm(arm);
      continue;
    }
    const angle = Math.atan2(seq.outZ, seq.outX) + spec.angle * seq.side;
    arm.visible = 1;
    arm.rootX = anchorX + Math.cos(angle) * spec.radius;
    arm.rootZ = anchorZ + Math.sin(angle) * spec.radius;
    const toX = anchorX - arm.rootX;
    const toZ = anchorZ - arm.rootZ;
    const toLength = Math.hypot(toX, toZ) || 1;
    arm.dirX = toX / toLength;
    arm.dirZ = toZ / toLength;
    arm.length = spec.length;
    arm.thickness = spec.thickness;
    arm.rise = rise;
    arm.tilt = spec.tilt;
    // Dressés, puis penchés en cage au-dessus du bateau, cabrés pendant l'assaut, puis
    // abattus dans l'eau quand le kraken replonge.
    arm.lean = spec.lean
      + 0.32 * smoothstep(T_COIL, T_COIL + 1.2, T)
      - 0.28 * smoothstep(T_ATTACK + 0.2, T_ATTACK + 1.1, T)
      + 0.7 * smoothstep(T_IMPACT + 0.1, T_IMPACT + 0.7, T);
    arm.curl = spec.curl + 0.35 * Math.sin(time * 0.4 + i * 1.7) * calm;
    arm.sway = 1;
    arm.phase = i * 1.37;
    arm.twist = spec.twist;
    arm.wet = Math.max(0.35, 1 - smoothstep(start + 2, start + 7, T));
    arm.wrap = 0;
    arm.coil = 0;
    const shove = pulse(T - (start + 0.35), 2.2);
    if (shove > 0.01) arm.lean -= shove * 0.25;
    // Gerbe là où le bras perce.
    addBurst(arm.rootX + arm.dirX * 1.5, 0.1, arm.rootZ + arm.dirZ * 1.5, T - (start + 0.25), 0.85, 1.6, 1);
  }

  /* --- Saisie de la coque --- */
  for (let grab = 0; grab < 2; grab++) {
    const front = grab === 0;
    const arm = arms[front ? GRAB_FRONT : GRAB_BACK];
    if (arm.visible <= 0) continue;
    let wrap = smoothstep(T_COIL + 0.1, T_COIL + 0.95, T);
    let coil = smoothstep(T_COIL + 0.55, T_COIL + 1.85, T);
    if (front) {
      const release = smoothstep(T_RELEASE - 0.05, T_RELEASE + 0.3, T);
      wrap *= 1 - release;
      coil *= 1 - release * 0.7;
    } else {
      const release = smoothstep(T_SLAP - 0.35, T_SLAP + 0.05, T);
      wrap *= 1 - release;
      coil *= 1 - release;
    }
    arm.wrap = wrap;
    arm.coil = coil;
    if (wrap <= 0.001) continue;
    // Repère de l'hélice dans celui du bateau tenu : axe vers l'arrière, centre au-dessus
    // de la flottaison, une moitié de coque chacun.
    const along = front ? 2.7 : -0.45;
    const origin = rotateCarry(along, 1.0, 0, hold.yaw, hold.pitch, hold.roll);
    arm.hx = hold.x + origin.x;
    arm.hy = hold.y + origin.y;
    arm.hz = hold.z + origin.z;
    const axis = rotateCarry(-1, 0, 0, hold.yaw, hold.pitch, hold.roll);
    arm.ax = axis.x;
    arm.ay = axis.y;
    arm.az = axis.z;
    const upAxis = rotateCarry(0, 1, 0, hold.yaw, hold.pitch, hold.roll);
    arm.ux = upAxis.x;
    arm.uy = upAxis.y;
    arm.uz = upAxis.z;
    arm.vx = arm.ay * arm.uz - arm.az * arm.uy;
    arm.vy = arm.az * arm.ux - arm.ax * arm.uz;
    arm.vz = arm.ax * arm.uy - arm.ay * arm.ux;
    arm.hLength = 2.4;
    arm.hRadiusUp = 2.05;
    arm.hRadiusSide = 1.5;
    arm.hTurns = 1.35;
    const rootSide = (arm.rootX - hold.x) * arm.vx + (arm.rootZ - hold.z) * arm.vz;
    arm.hand = rootSide > 0 ? -1 : 1;
    arm.wet = 1;
  }

  /* --- Gerbes clés --- */
  addBurst(boatX, 0.2, boatZ, T - T_ATTACK, 1, 2.6, 1.3);
  addBurst(boatX - seq.latX * 6, 0.1, boatZ - seq.latZ * 6, T - T_SLAP, 0.95, 3, 1.2);
  if (carried) addBurst(carry.x, carry.y - 0.4, carry.z, T - T_RELEASE, 0.6, 1.3, 0.35);
  addBurst(seq.headX, 0.2, seq.headZ, T - (T_APPROACH + 2.5), 1, 6, 1.1);
  addBurst(seq.headX, 0.2, seq.headZ, T - (T_IMPACT + 0.65), 0.85, 7.5, 0.8);
  if (seq.resetDone) addBurst(seq.landX, 0.2, seq.landZ, T - (T_RESPAWN + 0.5), 0.9, 2.4, 1.1);

  /* --- Tête, œil, encre --- */
  const head = krakenState.head;
  const rise = smoothstep(T_APPROACH + 1.6, T_STALK + 1.1, T) * (1 - smoothstep(T_IMPACT + 0.2, T_RESPAWN + 0.15, T));
  head.rise = rise;
  head.x = seq.headX;
  head.z = seq.headZ;
  head.y = -13 + rise * 13.8 + Math.sin(time * 0.7) * 0.35 * rise * calm;
  // +X local de la tête vers le bateau (rotation.y = −cap, comme le bateau).
  head.yaw = -Math.atan2(seq.anchorZ - head.z, seq.anchorX - head.x) + Math.sin(time * 0.3) * 0.04 * calm;
  head.roll = Math.sin(time * 0.5) * 0.03 * calm;
  head.pitch = Math.sin(time * 0.37 + 1) * 0.025 * calm - smoothstep(T_ATTACK, T_ATTACK + 1.5, T) * 0.06;
  head.wet = Math.max(0.15, smoothstep(0.15, 0.7, rise) * (1 - smoothstep(T_STALK + 1.5, T_STALK + 8, T)));

  const eye = krakenState.eye;
  const blink = 1 - Math.exp(-Math.pow((T - (T_COIL + 1.05)) / 0.09, 2));
  eye.open = smoothstep(T_STALK + 0.55, T_STALK + 1.05, T) * blink * (1 - smoothstep(T_IMPACT + 0.55, T_IMPACT + 0.95, T));
  eye.pupil = 0.44 - 0.3 * smoothstep(T_STALK + 1.1, T_COIL + 0.6, T) + 0.3 * smoothstep(T_ATTACK + 1.4, T_RELEASE, T);
  eye.glow = (0.5 + night * 0.8) * (0.75 + 0.6 * smoothstep(T_COIL, T_COIL + 0.6, T));
  eye.target.set(carried ? carry.x : boatX, carried ? carry.y + 1 : 1.4, carried ? carry.z : boatZ);

  const ink = krakenState.ink;
  ink.x = seq.headX - seq.outX * 3;
  ink.z = seq.headZ - seq.outZ * 3;
  // L'encre jaillit quand le kraken replonge, avant que le voile ne couvre l'écran.
  ink.amount = smoothstep(T_IMPACT + 0.2, T_IMPACT + 1.4, T);
  ink.fade = smoothstep(T_IMPACT + 0.2, T_IMPACT + 0.5, T) * (1 - smoothstep(T_RESPAWN + 0.4, T_RESPAWN + 1.6, T));
  ink.seed = hash(seq.anchorX * 0.1) * 10;
}
