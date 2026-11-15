import { Quaternion, Vector3 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { clamp, hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { bumpSound, ripple, sparkle, splashBurst } from './effects';
import { CRATE, RAFT } from './models';
import { boat, pyramidCrates, raft, type Toy } from './physics';

/**
 * « Le chamboule-tout » : une pyramide de caisses à poissons sur un radeau ancré devant le
 * port. Un coup d'étrave et tout dégringole (les caisses du haut d'abord privées d'appui),
 * les caisses flottent et dérivent… puis, quand le bateau s'est éloigné, elles bondissent
 * hors de l'eau une à une et se ré-empilent par magie, chacune sur sa note.
 */

interface Slot {
  x: number;
  y: number;
  z: number;
  q: Quaternion;
  level: number;
  /** Caisses de l'étage du dessous qui la portent. */
  supports: number[];
}

const UP = new Vector3(0, 1, 0);
const SPACING = CRATE.w + 0.05;

function buildSlots(levels: number[]) {
  const slots: Slot[] = [];
  const grid: number[][][] = [];
  levels.forEach((side, level) => {
    grid[level] = [];
    for (let i = 0; i < side; i++) {
      grid[level][i] = [];
      for (let j = 0; j < side; j++) {
        const seed = slots.length * 7.31 + level * 3.7 + 1;
        grid[level][i][j] = slots.length;
        slots.push({
          x: (i - (side - 1) / 2) * SPACING + (hash(seed) - 0.5) * 0.05,
          y: RAFT.deck + CRATE.h / 2 + level * (CRATE.h + 0.004),
          z: (j - (side - 1) / 2) * SPACING + (hash(seed + 1.7) - 0.5) * 0.05,
          q: new Quaternion().setFromAxisAngle(UP, (hash(seed + 4.1) - 0.5) * 0.12),
          level,
          supports: level === 0
            ? []
            : [grid[level - 1][i][j], grid[level - 1][i + 1][j], grid[level - 1][i][j + 1], grid[level - 1][i + 1][j + 1]],
        });
      }
    }
  });
  return slots;
}

/** 9 + 4 + 1 caisses ; 4 + 1 en qualité basse. */
const FULL = buildSlots([3, 2, 1]);
const SMALL = buildSlots([2, 1]);

/** Gamme pentatonique qui monte, caisse après caisse, pendant la remise en place. */
const NOTES = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349.3, 2637, 3136];
const TADA = [1046.5, 1318.5, 1568, 2093];
const RESTACK_DELAY = 9;
const LAUNCH_GAP = 0.17;

export const pyramid = {
  slots: FULL,
  lastDisturb: -100,
  restacking: false,
  /** Remise en place demandée (outils de développement) : n'attend pas le départ du bateau. */
  force: false,
  nextLaunch: 0,
  landed: 0,
  /** Vacillement d'ensemble (cisaillement de gelée) et son axe. */
  wobble: 0,
  wobbleV: 0,
  axisX: 1,
  axisZ: 0,
  /** Direction du dernier coup (sens de l'éboulement). */
  pushX: 1,
  pushZ: 0,
};

const target = new Vector3();
const control = new Vector3();
const targetQ = new Quaternion();
const wobbleQ = new Quaternion();
const twirl = new Quaternion();
const axis = new Vector3();

export function setupPyramid(small: boolean) {
  pyramid.slots = small ? SMALL : FULL;
  pyramid.restacking = false;
  pyramid.force = false;
  pyramid.lastDisturb = -100;
  pyramid.wobble = 0;
  pyramid.wobbleV = 0;
  for (let index = 0; index < pyramidCrates.length; index++) {
    const crate = pyramidCrates[index];
    crate.enabled = index < pyramid.slots.length;
    crate.stackSlot = index;
    crate.mode = 'stacked';
    crate.hit = 0;
    if (crate.enabled) placeStacked(crate);
  }
}

function slotPose(slot: Slot, position: Vector3, quaternion: Quaternion) {
  position.set(slot.x, slot.y, slot.z).applyQuaternion(raft.q).add(raft.p);
  quaternion.copy(raft.q).multiply(slot.q);
}

/** Caisse empilée : suit le radeau, et la pile entière ondule comme une gelée quand on la secoue. */
function placeStacked(crate: Toy) {
  const slot = pyramid.slots[crate.stackSlot];
  slotPose(slot, crate.p, crate.q);
  const sway = clamp(pyramid.wobble, -0.35, 0.35) * 0.6;
  if (sway !== 0) {
    const height = slot.y - RAFT.deck;
    axis.set(pyramid.axisX, 0, pyramid.axisZ);
    wobbleQ.setFromAxisAngle(axis, sway);
    crate.q.premultiply(wobbleQ);
    crate.p.x -= pyramid.axisZ * sway * height;
    crate.p.z += pyramid.axisX * sway * height;
  }
  crate.v.copy(raft.v);
  crate.w.set(0, 0, 0);
  crate.inWater = false;
}

function release(crate: Toy, strength: number, nx: number, nz: number, direct: boolean, time: number) {
  const level = pyramid.slots[crate.stackSlot].level;
  crate.mode = 'free';
  crate.lastHit = time;
  crate.cooldown = 0.3;
  crate.inWater = false;
  crate.lod = 0;
  crate.v.copy(raft.v);
  if (direct) {
    const thrown = (1.4 + 3.4 * strength) * (0.7 + Math.random() * 0.6);
    crate.v.x += boat.vx * (0.3 + Math.random() * 0.3) + nx * thrown + (Math.random() - 0.5) * 2.4;
    crate.v.z += boat.vz * (0.3 + Math.random() * 0.3) + nz * thrown + (Math.random() - 0.5) * 2.4;
    crate.v.y += 1.5 + 2.4 * strength * (0.6 + Math.random() * 0.7) + level * 0.6;
    crate.w.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.7, Math.random() - 0.5).normalize().multiplyScalar(3 + 7 * strength);
  } else {
    // Privée d'appui : elle bascule du côté où penche l'éboulement.
    crate.v.x += nx * (0.6 + Math.random()) + (Math.random() - 0.5);
    crate.v.z += nz * (0.6 + Math.random()) + (Math.random() - 0.5);
    crate.v.y += 0.3 + Math.random() * 0.6;
    crate.w.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 2.5);
  }
}

/** Coup d'étrave dans le radeau : la pile vacille, et au-delà d'un seuil, dégringole. */
function knock(strength: number, nx: number, nz: number, time: number) {
  pyramid.lastDisturb = time;
  pyramid.restacking = false;
  pyramid.pushX = nx;
  pyramid.pushZ = nz;
  pyramid.axisX = nz;
  pyramid.axisZ = -nx;
  pyramid.wobbleV += strength * 2.6;
  let fallen = 0;
  for (let index = 0; index < pyramid.slots.length; index++) {
    const crate = pyramidCrates[index];
    if (crate.mode !== 'stacked') continue;
    const slot = pyramid.slots[index];
    const rx = crate.p.x - raft.p.x;
    const rz = crate.p.z - raft.p.z;
    const reach = Math.hypot(rx, rz) || 1;
    // Exposées : les caisses côté bateau, et celles du haut (les plus instables).
    const facing = (-(rx * nx + rz * nz) / reach) * Math.min(reach, 1);
    const exposure = 0.55 + 0.35 * facing + 0.22 * slot.level;
    if (strength * exposure > 0.3) {
      release(crate, strength, nx, nz, true, time);
      fallen++;
    }
  }
  if (fallen > 0) {
    bumpSound('wood', 1, time, 0);
    for (let k = 0; k < Math.min(fallen, 6); k++) logbook.bump('crate');
  }
}

export function stepPyramid(dt: number, time: number) {
  const slots = pyramid.slots;
  if (raft.hit > 0) {
    knock(raft.hit, raft.hitX, raft.hitZ, time);
    raft.hit = 0;
  }
  for (let index = 0; index < slots.length; index++) {
    const crate = pyramidCrates[index];
    if (crate.mode === 'stacked' && crate.hit > 0) {
      pyramid.lastDisturb = time;
      pyramid.restacking = false;
      release(crate, crate.hit, crate.hitX, crate.hitZ, true, time);
      bumpSound('wood', crate.hit, time);
      logbook.bump('crate');
    }
    crate.hit = 0;
  }
  // Effondrement : une caisse privée d'un de ses appuis tombe à son tour (étages croissants).
  for (let index = 0; index < slots.length; index++) {
    const crate = pyramidCrates[index];
    if (crate.mode !== 'stacked') continue;
    const supports = slots[index].supports;
    for (let k = 0; k < supports.length; k++) {
      if (pyramidCrates[supports[k]].mode !== 'stacked') {
        release(crate, 0.4, pyramid.pushX, pyramid.pushZ, false, time);
        break;
      }
    }
  }
  pyramid.wobbleV += (-pyramid.wobble * 48 - pyramid.wobbleV * 3) * dt;
  pyramid.wobble += pyramid.wobbleV * dt;
  for (let index = 0; index < slots.length; index++) {
    const crate = pyramidCrates[index];
    if (crate.mode === 'stacked') placeStacked(crate);
    else if (crate.mode === 'flying') fly(crate, time);
  }
  restack(time);
}

function restack(time: number) {
  const slots = pyramid.slots;
  let loose = 0;
  let flying = 0;
  for (let index = 0; index < slots.length; index++) {
    const mode = pyramidCrates[index].mode;
    if (mode === 'free') loose++;
    else if (mode === 'flying') flying++;
  }
  const away = Math.hypot(boat.x - raft.p.x, boat.z - raft.p.z);
  if (!pyramid.restacking) {
    if (loose === 0) {
      pyramid.force = false;
      return;
    }
    if (!pyramid.force && (time - pyramid.lastDisturb < RESTACK_DELAY || away < 10)) return;
    pyramid.restacking = true;
    pyramid.nextLaunch = time;
    pyramid.landed = 0;
  }
  if (loose === 0 && flying === 0) {
    finish(time);
    return;
  }
  if (time < pyramid.nextLaunch || (away < 6 && !pyramid.force)) return;
  for (let index = 0; index < slots.length; index++) {
    const crate = pyramidCrates[index];
    if (crate.mode !== 'free') continue;
    const supports = slots[index].supports;
    let ready = true;
    for (let k = 0; k < supports.length; k++) {
      if (pyramidCrates[supports[k]].mode !== 'stacked') {
        ready = false;
        break;
      }
    }
    if (!ready) continue;
    launch(crate, time);
    pyramid.nextLaunch = time + LAUNCH_GAP;
    return;
  }
}

/** Une caisse bondit hors de l'eau vers sa place. */
function launch(crate: Toy, time: number) {
  slotPose(pyramid.slots[crate.stackSlot], target, targetQ);
  crate.mode = 'flying';
  crate.flightAt = time;
  crate.from.copy(crate.p);
  crate.fromQ.copy(crate.q);
  const distance = crate.p.distanceTo(target);
  crate.flightDur = clamp(0.6 + distance * 0.035, 0.6, 1.25);
  crate.flightArc = 1.1 + Math.min(distance, 16) * 0.2;
  crate.flightSpin = (Math.random() < 0.5 ? -1 : 1) * Math.PI * 2;
  const water = waveHeight(crate.p.x, crate.p.z, time);
  if (crate.p.y < water + 0.6) {
    ripple(crate.p.x, crate.p.z, time, 0.9);
    splashBurst(crate.p.x, water + 0.05, crate.p.z, 0.4, time);
  }
}

/** Vol en cloche (Bézier vers la place, qui suit le radeau), pirouette et traînée de paillettes. */
function fly(crate: Toy, time: number) {
  slotPose(pyramid.slots[crate.stackSlot], target, targetQ);
  const t = clamp((time - crate.flightAt) / crate.flightDur, 0, 1);
  const e = t * t * (3 - 2 * t);
  control.copy(crate.from).add(target).multiplyScalar(0.5);
  control.y = Math.max(crate.from.y, target.y) + crate.flightArc;
  const a = (1 - e) * (1 - e);
  const b = 2 * (1 - e) * e;
  const c = e * e;
  crate.p.set(
    crate.from.x * a + control.x * b + target.x * c,
    crate.from.y * a + control.y * b + target.y * c,
    crate.from.z * a + control.z * b + target.z * c,
  );
  crate.q.slerpQuaternions(crate.fromQ, targetQ, e);
  twirl.setFromAxisAngle(UP, (1 - e) * crate.flightSpin);
  crate.q.premultiply(twirl);
  crate.v.set(0, 0, 0);
  crate.w.set(0, 0, 0);
  if (Math.random() < 0.45) sparkle(crate.p.x, crate.p.y, crate.p.z, time);
  if (t < 1) return;
  crate.mode = 'stacked';
  crate.squashAt = time;
  crate.squashAmp = 0.24;
  ambience.cue(NOTES[pyramid.landed % NOTES.length], 0.14);
  pyramid.landed++;
  pyramid.wobbleV += 0.4;
  sparkle(target.x, target.y + 0.2, target.z, time, 4);
  placeStacked(crate);
}

/** Ta-da : la pyramide est entière, le radeau saute de joie. */
function finish(time: number) {
  pyramid.restacking = false;
  pyramid.force = false;
  ambience.chime(TADA, 0.07);
  raft.v.y += 0.9;
  pyramid.axisX = 0.7;
  pyramid.axisZ = 0.7;
  pyramid.wobbleV += 1.6;
  const top = pyramidCrates[pyramid.slots.length - 1];
  sparkle(top.p.x, top.p.y + 0.5, top.p.z, time, 12);
}

/* ------------------------------------------------------------ développement */

/** Coup simulé venant du bateau (`window.__toys.knock()`). */
export function knockNow(strength: number, time: number) {
  const dx = raft.p.x - boat.x;
  const dz = raft.p.z - boat.z;
  const distance = Math.hypot(dx, dz) || 1;
  const nx = dx / distance;
  const nz = dz / distance;
  raft.v.x += nx * 3 * strength;
  raft.v.z += nz * 3 * strength;
  raft.w.x += nz * 1.2 * strength;
  raft.w.z -= nx * 1.2 * strength;
  knock(strength, nx, nz, time);
}

/** Remise en place immédiate (`window.__toys.restack()`). */
export function restackNow() {
  pyramid.lastDisturb = -100;
  pyramid.force = true;
}
