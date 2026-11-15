import { Quaternion, Vector3 } from 'three';
import { BOAT_FRAME } from '@/components/boat/BoatModel';
import { boatState } from '@/lib/boat-state';
import { SOLIDS } from '@/lib/navigation';
import { clamp, hash, shortestAngle, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { bumpSound, impact, jolt, splashDown, type SoundKind } from './effects';
import { CRATE, RAFT } from './models';

/**
 * Petite physique maison des jouets flottants (aucun moteur) : flottabilité-ressort sur la
 * houle partagée (`waveHeight`), assiette alignée sur la pente des vagues, vague d'étrave et
 * sillage du bateau, chocs avec la coque (capsule), rebonds sur les côtes, retour lent au
 * mouillage. Coût O(n) : seuls les objets « réveillés » testent leurs voisins, et seuls ceux
 * proches du bateau sont simulés (les autres se contentent de danser sur la houle).
 */

export type Shape = 'crate' | 'barrel' | 'pot' | 'buoy' | 'ball' | 'lifebuoy' | 'duck' | 'marker' | 'raft';
/** Axe que l'objet garde vers le ciel : un seul (`up`), n'importe quelle face (`box`), flanc (`roll`). */
type Stable = 'up' | 'box' | 'roll' | 'free';

interface Spec {
  /** Rayon de collision (mètres, à l'échelle par défaut). */
  radius: number;
  mass: number;
  /** Traînée horizontale dans l'eau (1/s). */
  drag: number;
  /** Hauteur du centre au-dessus de la surface, au repos. */
  float: number;
  /** Raideur du ressort de flottaison. */
  bob: number;
  /** Raideur du redressement sur la pente de la vague. */
  right: number;
  stable: Stable;
  /** Bond vertical quand le bateau le percute. */
  hop: number;
  /** Culbute (rad/s) et toupie au choc. */
  spin: number;
  twirl: number;
  tiltDrag: number;
  yawDrag: number;
  /** Raideur du corps-mort (0 : objet libre). */
  moored: number;
  /** Petit tangage permanent (jouet qui vit). */
  idle: number;
  /** Pas d'échantillonnage de la pente (grands objets : houle lissée). */
  span: number;
  sound: SoundKind;
  scale: number;
  /** Écrasement élastique au choc. */
  squash: number;
  collides: boolean;
}

const SPECS: Record<Shape, Spec> = {
  crate: { radius: 0.68, mass: 1.2, drag: 0.9, float: 0.06, bob: 40, right: 10, stable: 'box', hop: 2.4, spin: 6, twirl: 4, tiltDrag: 2.2, yawDrag: 0.9, moored: 0, idle: 0.25, span: 0.7, sound: 'wood', scale: 1, squash: 0.1, collides: true },
  barrel: { radius: 0.56, mass: 1.6, drag: 0.8, float: 0.07, bob: 34, right: 7, stable: 'roll', hop: 1.6, spin: 4, twirl: 3, tiltDrag: 1.8, yawDrag: 0.7, moored: 0, idle: 0.2, span: 0.8, sound: 'wood', scale: 1, squash: 0.08, collides: true },
  pot: { radius: 0.62, mass: 1.4, drag: 1.6, float: -0.08, bob: 30, right: 11, stable: 'up', hop: 1.3, spin: 3, twirl: 2.5, tiltDrag: 2.6, yawDrag: 1.2, moored: 0, idle: 0.3, span: 0.8, sound: 'wood', scale: 1, squash: 0.1, collides: true },
  buoy: { radius: 0.6, mass: 1.2, drag: 1.4, float: 0.2, bob: 46, right: 8, stable: 'up', hop: 2.6, spin: 3.5, twirl: 2, tiltDrag: 1.7, yawDrag: 1.1, moored: 1.1, idle: 0.35, span: 0.7, sound: 'soft', scale: 1, squash: 0.18, collides: true },
  ball: { radius: 0.72, mass: 0.3, drag: 0.5, float: 0.46, bob: 52, right: 0, stable: 'free', hop: 4.8, spin: 0, twirl: 3, tiltDrag: 0.8, yawDrag: 0.6, moored: 0, idle: 0, span: 0.7, sound: 'soft', scale: 0.72, squash: 0.28, collides: true },
  lifebuoy: { radius: 0.82, mass: 0.45, drag: 1, float: 0.07, bob: 46, right: 14, stable: 'up', hop: 3.6, spin: 4, twirl: 9, tiltDrag: 2.4, yawDrag: 0.45, moored: 0, idle: 0.25, span: 0.8, sound: 'soft', scale: 1, squash: 0.16, collides: true },
  duck: { radius: 2.5, mass: 3.2, drag: 0.8, float: -0.15, bob: 26, right: 4.5, stable: 'up', hop: 1.1, spin: 2.6, twirl: 2.4, tiltDrag: 1.3, yawDrag: 1.4, moored: 0, idle: 0.5, span: 2, sound: 'duck', scale: 1.65, squash: 0.12, collides: true },
  marker: { radius: 0.82, mass: 2.6, drag: 1.6, float: -0.25, bob: 30, right: 8.5, stable: 'up', hop: 0.9, spin: 1.8, twirl: 1, tiltDrag: 1.6, yawDrag: 1.4, moored: 1.6, idle: 0.3, span: 0.9, sound: 'soft', scale: 1, squash: 0.06, collides: true },
  raft: { radius: 2.5, mass: 22, drag: 1.7, float: 0, bob: 24, right: 9, stable: 'up', hop: 0.35, spin: 1.6, twirl: 0.5, tiltDrag: 2.2, yawDrag: 1.6, moored: 0.65, idle: 0.12, span: 2.2, sound: 'wood', scale: 1, squash: 0, collides: false },
};

type Mode = 'free' | 'stacked' | 'flying';

export interface Toy extends Spec {
  shape: Shape;
  /** Indice d'instance dans le maillage de sa forme. */
  slot: number;
  /** Qualité minimale : 0 low, 1 medium, 2 high. */
  minQuality: number;
  p: Vector3;
  v: Vector3;
  q: Quaternion;
  /** Vitesse angulaire (repère monde, rad/s). */
  w: Vector3;
  /** Mouillage (coin où l'objet revient). */
  ax: number;
  az: number;
  phase: number;
  cooldown: number;
  lastHit: number;
  inWater: boolean;
  enabled: boolean;
  awake: boolean;
  mode: Mode;
  /** 0 simulé, 1 simple bercement, 2 figé (loin du bateau). */
  lod: number;
  /** Caneton : suit ce canard à `gap` mètres. */
  leader: Toy | null;
  gap: number;
  /** Cap de repos (radeau) ; NaN : aucun. */
  yawHome: number;
  /** Choc reçu cette image (force 0..1,25 et direction), lu par le chamboule-tout. */
  hit: number;
  hitX: number;
  hitZ: number;
  squashAt: number;
  squashAmp: number;
  /** Teinte (indice de palette) pour la peinture des caisses. */
  tint: number;
  stackSlot: number;
  flightAt: number;
  flightDur: number;
  flightSpin: number;
  flightArc: number;
  from: Vector3;
  fromQ: Quaternion;
}

/* ------------------------------------------------------------------- monde */

const UP = new Vector3(0, 1, 0);
export const toys: Toy[] = [];
export const counts: Record<Shape, number> = { crate: 0, barrel: 0, pot: 0, buoy: 0, ball: 0, lifebuoy: 0, duck: 0, marker: 0, raft: 0 };
/** Horloge de la dernière image (outils de développement). */
export const frame = { time: 0 };

function spawn(shape: Shape, x: number, z: number, minQuality = 0, scale?: number): Toy {
  const spec = SPECS[shape];
  const k = scale === undefined ? 1 : scale / spec.scale;
  const seed = hash(x * 12.9898 + z * 78.233);
  const toy: Toy = {
    ...spec,
    scale: spec.scale * k,
    radius: spec.radius * k,
    float: spec.float * k,
    mass: spec.mass * k * k,
    span: spec.span * Math.max(k, 0.5),
    shape,
    slot: counts[shape]++,
    minQuality,
    p: new Vector3(x, spec.float * k, z),
    v: new Vector3(),
    q: new Quaternion().setFromAxisAngle(UP, seed * Math.PI * 2),
    w: new Vector3(),
    ax: x,
    az: z,
    phase: seed * 40,
    cooldown: 0,
    lastHit: -100,
    inWater: true,
    enabled: true,
    awake: false,
    mode: 'free',
    lod: 0,
    leader: null,
    gap: 0,
    yawHome: Number.NaN,
    hit: 0,
    hitX: 0,
    hitZ: 0,
    squashAt: -100,
    squashAmp: spec.squash,
    tint: 0,
    stackSlot: -1,
    flightAt: 0,
    flightDur: 1,
    flightSpin: 0,
    flightArc: 1,
    from: new Vector3(),
    fromQ: new Quaternion(),
  };
  toys.push(toy);
  return toy;
}

/** Le chamboule-tout, au cœur du terrain de jeu devant l'îlot de départ. */
export const RAFT_AT: [number, number] = [25, -8];
export const raft = spawn('raft', RAFT_AT[0], RAFT_AT[1]);
// Pyramide vue de trois quarts depuis le départ ; le mât et ses fanions au fond.
raft.yawHome = 0.115;
raft.q.setFromAxisAngle(UP, raft.yawHome);

export const PYRAMID_MAX = 14;
/** Les caisses du chamboule-tout (posées et animées par chamboule.ts). */
export const pyramidCrates = Array.from({ length: PYRAMID_MAX }, (_, index) => {
  const crate = spawn('crate', RAFT_AT[0], RAFT_AT[1]);
  crate.tint = index;
  crate.mode = 'stacked';
  return crate;
});

// Anneau de bouées autour du radeau : une petite arène à slalomer.
for (let k = 0; k < 6; k++) {
  const angle = ((20 + k * 60) * Math.PI) / 180;
  spawn('buoy', RAFT_AT[0] + Math.cos(angle) * 9.5, RAFT_AT[1] + Math.sin(angle) * 9.5);
}

// La cane (sur la route des Projets, comme toujours) et ses canetons en file indienne.
const mama = spawn('duck', 27.5, 8);
mama.q.setFromAxisAngle(UP, 2.47);
let leader = mama;
const DUCKLINGS: [number, number, number][] = [[30, 9.6, 1], [31.3, 10.5, 1], [32.5, 11.4, 2]];
DUCKLINGS.forEach(([x, z, quality], index) => {
  const duckling = spawn('duck', x, z, quality, 0.6);
  duckling.leader = leader;
  duckling.gap = index === 0 ? 3.2 : 1.5;
  duckling.q.copy(mama.q);
  duckling.idle = 0.9;
  duckling.hop = 2.2;
  leader = duckling;
});

const PLACES: [Shape, number, number, number?][] = [
  // Terrain de jeu devant le port de départ.
  ['ball', 22, -3],
  ['ball', 13.5, -1.5],
  ['ball', 33, -22, 1],
  ['lifebuoy', 17, -14.5],
  ['lifebuoy', 39, -9, 1],
  ['lifebuoy', 9, 9, 2],
  ['barrel', 36.5, -0.5],
  ['barrel', 38, 1.2, 1],
  ['barrel', 17, -26, 2],
  ['crate', 30, -19.5],
  ['pot', -5, 11],
  ['pot', 3, 12.5, 1],
  // Le long des routes : balises lumineuses et épaves de pont.
  ['marker', 40, -20],
  ['marker', 36, 11],
  ['marker', -26, -19],
  ['marker', -12, 34],
  ['marker', -36, 19, 1],
  ['marker', 9, -45, 1],
  ['crate', 52, 8],
  ['crate', 55, 12, 1],
  ['crate', -44, -48],
  ['barrel', -36, -6],
  ['lifebuoy', -36, 36, 1],
  ['ball', -10, 45],
  ['pot', 45, -22, 1],
  ['barrel', 10, -52, 1],
  ['buoy', -20, 18],
  ['buoy', 24, 34, 1],
];
PLACES.forEach(([shape, x, z, quality], index) => {
  const toy = spawn(shape, x, z, quality ?? 0);
  toy.tint = 100 + index;
});

/* ------------------------------------------------------------------ bateau */

export const boat = { x: 0, z: 0, fx: 1, fz: 0, sx: 0, sz: 1, speed: 0, vx: 0, vz: 0, tailX: 0, tailZ: 0 };
const HULL = BOAT_FRAME.bow + BOAT_FRAME.stern;
const BOAT_MASS = 9;

export function readBoat() {
  boat.x = boatState.position.x;
  boat.z = boatState.position.z;
  boat.fx = Math.cos(boatState.heading);
  boat.fz = Math.sin(boatState.heading);
  boat.sx = -boat.fz;
  boat.sz = boat.fx;
  boat.speed = boatState.speed;
  boat.vx = boat.fx * boat.speed;
  boat.vz = boat.fz * boat.speed;
  boat.tailX = boat.x - boat.fx * BOAT_FRAME.stern;
  boat.tailZ = boat.z - boat.fz * BOAT_FRAME.stern;
}

/* -------------------------------------------------------------- intégration */

const GRAVITY = 13;
const SLOPE_PUSH = 1.8;
/** Pente exagérée : les objets tanguent franchement, comme des jouets. */
const TILT_GAIN = 2.2;
const FULL_RANGE2 = 52 * 52;
const LIGHT_RANGE2 = 115 * 115;
const MAX_SPEED = 15;
const MAX_SPIN = 18;

const normal = new Vector3();
const contact = new Vector3();
const axis = new Vector3();
const torque = new Vector3();
const local = new Vector3();
const forward = new Vector3();
const rolling = new Vector3();
const raftUp = new Vector3();
const before = new Vector3();
const ex = new Vector3();
const ey = new Vector3();
const ez = new Vector3();
const inverse = new Quaternion();
const turn = new Quaternion();

export function stepToys(dt: number, time: number) {
  for (let index = 0; index < toys.length; index++) {
    const toy = toys[index];
    toy.cooldown = Math.max(0, toy.cooldown - dt);
    if (!toy.enabled || toy.mode !== 'free') continue;
    const dx = toy.p.x - boat.x;
    const dz = toy.p.z - boat.z;
    const d2 = dx * dx + dz * dz;
    toy.lod = d2 < FULL_RANGE2 ? 0 : d2 < LIGHT_RANGE2 ? 1 : 2;
    if (toy.lod === 0) stepFree(toy, dt, time);
    else if (toy.lod === 1) stepLight(toy, dt, time);
  }
}

function stepFree(toy: Toy, dt: number, time: number) {
  const { p, v } = toy;
  const h = waveHeight(p.x, p.z, time);
  const gx = (waveHeight(p.x + toy.span, p.z, time) - h) / toy.span;
  const gz = (waveHeight(p.x, p.z + toy.span, time) - h) / toy.span;
  normal.set(-gx * TILT_GAIN, 1, -gz * TILT_GAIN).normalize();

  const lift = boat.speed > 0.4 ? boatWaves(toy, dt, time) : 0;
  const depth = h + toy.float + lift - p.y;
  const wasInWater = toy.inWater;
  toy.inWater = depth > -0.06;
  if (toy.inWater) {
    if (!wasInWater && v.y < -2.4) splashDown(p.x, p.z, -v.y, Math.max(toy.radius, 0.5), time);
    v.y += (depth * toy.bob - v.y * Math.sqrt(toy.bob) * 0.7) * dt;
    const drag = Math.exp(-toy.drag * dt);
    v.x = v.x * drag - gx * SLOPE_PUSH * dt;
    v.z = v.z * drag - gz * SLOPE_PUSH * dt;
  } else {
    v.y -= GRAVITY * dt;
    const air = Math.exp(-0.2 * dt);
    v.x *= air;
    v.z *= air;
  }
  steer(toy, dt, time);
  const speed = v.length();
  if (speed > MAX_SPEED) v.multiplyScalar(MAX_SPEED / speed);
  p.addScaledVector(v, dt);
  collideBoat(toy, time);
  coasts(toy);
  const grounded = toy !== raft && deck(toy, dt);
  rotate(toy, dt, time, grounded ? raftUp : normal, grounded);
}

/** Loin du bateau : bercé par la houle, ramené tout doucement à son coin. */
function stepLight(toy: Toy, dt: number, time: number) {
  const k = 1 - Math.exp(-0.06 * dt);
  if (toy.leader) {
    forward.set(1, 0, 0).applyQuaternion(toy.leader.q);
    const length = Math.hypot(forward.x, forward.z) || 1;
    toy.p.x += (toy.leader.p.x - (forward.x / length) * toy.gap - toy.p.x) * k * 20;
    toy.p.z += (toy.leader.p.z - (forward.z / length) * toy.gap - toy.p.z) * k * 20;
  } else {
    const pull = toy.moored > 0 ? k * 30 : k;
    toy.p.x += (toy.ax - toy.p.x) * pull;
    toy.p.z += (toy.az - toy.p.z) * pull;
  }
  toy.p.y = waveHeight(toy.p.x, toy.p.z, time) + toy.float;
  toy.v.set(0, 0, 0);
  toy.w.set(0, 0, 0);
  toy.inWater = true;
}

/** Mouillage, retour au coin, promenade de la cane et file des canetons. */
function steer(toy: Toy, dt: number, time: number) {
  const { p, v } = toy;
  if (toy.leader) {
    const leader = toy.leader;
    forward.set(1, 0, 0).applyQuaternion(leader.q);
    const length = Math.hypot(forward.x, forward.z) || 1;
    const dx = leader.p.x - (forward.x / length) * toy.gap - p.x;
    const dz = leader.p.z - (forward.z / length) * toy.gap - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.15) {
      const pull = Math.min(distance, 4) * 1.1;
      v.x += (dx / distance) * pull * dt;
      v.z += (dz / distance) * pull * dt;
    }
    return;
  }
  let tx = toy.ax;
  let tz = toy.az;
  if (toy.shape === 'duck') {
    // La cane fait des ronds paresseux autour de son coin, ses petits derrière elle.
    const angle = time * 0.05 + toy.phase;
    tx += Math.cos(angle) * 2.5;
    tz += Math.sin(angle) * 2.5;
  }
  const dx = tx - p.x;
  const dz = tz - p.z;
  if (toy.moored > 0) {
    v.x += dx * toy.moored * dt;
    v.z += dz * toy.moored * dt;
    return;
  }
  const distance = Math.hypot(dx, dz);
  const wander = toy.shape === 'duck' ? 0.3 : 2.5;
  if (distance <= wander) return;
  const calm = smoothstep(3, 8, time - toy.lastHit);
  const pull = Math.min((distance - wander) * 0.1, toy.shape === 'duck' ? 0.35 : 0.25) * calm;
  v.x += (dx / distance) * pull * dt;
  v.z += (dz / distance) * pull * dt;
}

/** Vague d'étrave (écarte, soulève, fait gîter) et sillage en V (berce, entraîne). */
function boatWaves(toy: Toy, dt: number, time: number) {
  const rx = toy.p.x - boat.x;
  const rz = toy.p.z - boat.z;
  if (rx * rx + rz * rz > 576) return 0;
  const along = rx * boat.fx + rz * boat.fz;
  const lateral = rx * boat.sx + rz * boat.sz;
  const side = lateral >= 0 ? 1 : -1;
  const pace = clamp(boat.speed / 10, 0, 1.3);
  const nimble = 1 / Math.sqrt(Math.max(toy.mass, 0.3));
  let lift = 0;
  if (along > -BOAT_FRAME.stern * 0.4 && along < BOAT_FRAME.bow + 3.5) {
    const outside = Math.abs(lateral) - BOAT_FRAME.halfBeam - toy.radius;
    if (outside < 3) {
      const f = (1 - clamp(outside, 0, 3) / 3) * smoothstep(BOAT_FRAME.bow + 3.5, BOAT_FRAME.bow - 0.5, along) * pace;
      const push = 5.5 * nimble * f;
      toy.v.x += (boat.sx * side + boat.fx * 0.35) * push * dt;
      toy.v.z += (boat.sz * side + boat.fz * 0.35) * push * dt;
      toy.w.x += boat.sz * side * f * 5 * nimble * dt;
      toy.w.z -= boat.sx * side * f * 5 * nimble * dt;
      lift += 0.24 * f;
    }
  }
  const behind = -along - BOAT_FRAME.stern;
  if (behind > 0 && behind < 18) {
    const half = BOAT_FRAME.halfBeam + behind * 0.45 + 0.6;
    const away = Math.abs(lateral);
    if (away < half + 1.5) {
      const fade = (1 - behind / 18) * pace;
      const edge = smoothstep(half + 1.5, half - 1, away);
      lift += Math.sin(behind * 1.15 - time * 7.5 + away * 0.6) * 0.17 * fade;
      toy.v.x += (boat.fx * 1.2 * edge + boat.sx * side * 0.9) * fade * nimble * dt;
      toy.v.z += (boat.fz * 1.2 * edge + boat.sz * side * 0.9) * fade * nimble * dt;
    }
  }
  return lift;
}

/** Coque = capsule poupe → étrave (effilée à l'avant). Le bateau ne s'arrête jamais : il pousse. */
function collideBoat(toy: Toy, time: number) {
  const { p, v } = toy;
  if (p.y > 2.6) return;
  const along = clamp((p.x - boat.tailX) * boat.fx + (p.z - boat.tailZ) * boat.fz, 0, HULL);
  const dx = p.x - (boat.tailX + boat.fx * along);
  const dz = p.z - (boat.tailZ + boat.fz * along);
  const distance = Math.hypot(dx, dz);
  const taper = along > HULL * 0.62 ? 1 - ((along - HULL * 0.62) / (HULL * 0.38)) * 0.6 : 1;
  const reach = BOAT_FRAME.halfBeam * taper + toy.radius;
  if (distance >= reach) return;
  const nx = distance > 1e-4 ? dx / distance : boat.sx;
  const nz = distance > 1e-4 ? dz / distance : boat.sz;
  p.x += nx * (reach - distance);
  p.z += nz * (reach - distance);
  const closing = -((v.x - boat.vx) * nx + (v.z - boat.vz) * nz);
  if (closing <= 0) return;
  const share = BOAT_MASS / (toy.mass + BOAT_MASS);
  const impulse = 1.55 * closing * share + 0.5;
  v.x += nx * impulse + (boat.vx - v.x) * 0.12 * share;
  v.z += nz * impulse + (boat.vz - v.z) * 0.12 * share;
  if (closing < 0.9 || toy.cooldown > 0) return;
  const strength = clamp(closing / 9, 0.12, 1.25);
  toy.cooldown = 0.45;
  toy.lastHit = time;
  toy.squashAt = time;
  toy.squashAmp = toy.squash * (0.6 + Math.min(strength, 1));
  v.y += toy.hop * strength * (0.75 + Math.random() * 0.5);
  // Culbute : le haut part à l'opposé de la coque ; toupie selon le frottement.
  toy.w.x += nz * toy.spin * strength;
  toy.w.z -= nx * toy.spin * strength;
  const slide = (boat.vx - v.x) * -nz + (boat.vz - v.z) * nx;
  toy.w.y += clamp(slide, -6, 6) * toy.twirl * 0.12 + (Math.random() - 0.5) * toy.twirl * strength;
  toy.hit = strength;
  toy.hitX = nx;
  toy.hitZ = nz;
  impact(toy.shape, toy.sound, strength, p.x - nx * toy.radius, p.z - nz * toy.radius, time);
  if (toy.mass >= 3) {
    // Les gros (cane, radeau) freinent un peu le bateau et le font cabrer.
    boatState.speed *= 1 - (toy.mass >= 10 ? 0.6 : 0.35) * Math.min(strength, 1) * (1 - share);
    jolt(0.16 + 0.32 * Math.min(strength, 1));
  }
}

function coasts(toy: Toy) {
  for (let index = 0; index < SOLIDS.length; index++) {
    const solid = SOLIDS[index];
    const dx = toy.p.x - solid.x;
    const dz = toy.p.z - solid.z;
    const limit = solid.r + toy.radius + 0.6;
    const d2 = dx * dx + dz * dz;
    if (d2 >= limit * limit) continue;
    const distance = Math.sqrt(d2) || 0.001;
    const nx = dx / distance;
    const nz = dz / distance;
    toy.p.x = solid.x + nx * limit;
    toy.p.z = solid.z + nz * limit;
    const into = toy.v.x * nx + toy.v.z * nz;
    if (into < 0) {
      toy.v.x -= nx * into * 1.6;
      toy.v.z -= nz * into * 1.6;
    }
  }
}

/** Demi-épaisseur d'une caisse dans une direction (support exact d'une boîte). */
function boxExtent(toy: Toy, direction: Vector3) {
  ex.set(1, 0, 0).applyQuaternion(toy.q);
  ey.set(0, 1, 0).applyQuaternion(toy.q);
  ez.set(0, 0, 1).applyQuaternion(toy.q);
  return (
    (CRATE.w / 2) * Math.abs(ex.dot(direction)) +
    (CRATE.h / 2) * Math.abs(ey.dot(direction)) +
    (CRATE.d / 2) * Math.abs(ez.dot(direction))
  ) * toy.scale;
}

function extent(toy: Toy, direction: Vector3) {
  return toy.shape === 'crate' ? boxExtent(toy, direction) : toy.radius;
}

/**
 * Le pont du radeau : on peut y retomber, y glisser, en tomber. Sur les flancs, les
 * rondins repoussent ce qui flotte contre eux. Renvoie vrai si l'objet est posé dessus.
 */
function deck(toy: Toy, dt: number) {
  const dx = toy.p.x - raft.p.x;
  const dz = toy.p.z - raft.p.z;
  const reach = RAFT.half * 1.42 + toy.radius;
  if (dx * dx + dz * dz > reach * reach) return false;
  inverse.copy(raft.q).invert();
  local.set(dx, toy.p.y - raft.p.y, dz).applyQuaternion(inverse);
  raftUp.set(0, 1, 0).applyQuaternion(raft.q);
  const support = toy.shape === 'crate' ? boxExtent(toy, raftUp) : toy.radius * 0.85;
  if (local.y - support >= RAFT.deck) return false;
  const half = RAFT.half;
  const inside = Math.abs(local.x) <= half && Math.abs(local.z) <= half;
  if (inside && local.y > RAFT.deck - 0.2) {
    toy.p.addScaledVector(raftUp, RAFT.deck + support - local.y);
    const vn = (toy.v.x - raft.v.x) * raftUp.x + (toy.v.y - raft.v.y) * raftUp.y + (toy.v.z - raft.v.z) * raftUp.z;
    if (vn < 0) toy.v.addScaledVector(raftUp, -vn * 1.3);
    const grip = Math.exp(-4 * dt);
    toy.v.x = raft.v.x + (toy.v.x - raft.v.x) * grip;
    toy.v.z = raft.v.z + (toy.v.z - raft.v.z) * grip;
    return true;
  }
  if (local.y + support < -0.32) return false;
  const radius = toy.shape === 'crate' ? (CRATE.w / 2) * toy.scale : toy.radius * 0.9;
  before.copy(toy.p);
  if (inside) {
    // Coincé sous le bord : ressort par le côté le plus proche.
    if (half - Math.abs(local.x) < half - Math.abs(local.z)) local.x = Math.sign(local.x) * (half + radius);
    else local.z = Math.sign(local.z) * (half + radius);
  } else {
    const ox = local.x - clamp(local.x, -half, half);
    const oz = local.z - clamp(local.z, -half, half);
    const distance = Math.hypot(ox, oz);
    if (distance >= radius || distance < 1e-5) return false;
    const k = (radius - distance) / distance;
    local.x += ox * k;
    local.z += oz * k;
  }
  contact.copy(local).applyQuaternion(raft.q).add(raft.p);
  toy.p.x = contact.x;
  toy.p.z = contact.z;
  const nx = toy.p.x - before.x;
  const nz = toy.p.z - before.z;
  const length = Math.hypot(nx, nz);
  if (length > 1e-5) {
    const vn = ((toy.v.x - raft.v.x) * nx + (toy.v.z - raft.v.z) * nz) / length;
    if (vn < 0) {
      toy.v.x -= (nx / length) * vn * 1.4;
      toy.v.z -= (nz / length) * vn * 1.4;
    }
  }
  return false;
}

/** Axe du corps qui doit regarder le ciel, exprimé dans le monde. */
function stableAxis(toy: Toy, up: Vector3, out: Vector3) {
  if (toy.stable === 'up') return out.set(0, 1, 0).applyQuaternion(toy.q);
  inverse.copy(toy.q).invert();
  local.copy(up).applyQuaternion(inverse);
  if (toy.stable === 'box') {
    const ax = Math.abs(local.x);
    const ay = Math.abs(local.y);
    const az = Math.abs(local.z);
    if (ay >= ax && ay >= az) out.set(0, Math.sign(local.y) || 1, 0);
    else if (ax >= az) out.set(Math.sign(local.x) || 1, 0, 0);
    else out.set(0, 0, Math.sign(local.z) || 1);
  } else {
    out.set(0, local.y, local.z);
    if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
    else out.normalize();
  }
  return out.applyQuaternion(toy.q);
}

function rotate(toy: Toy, dt: number, time: number, up: Vector3, grounded: boolean) {
  const { w, q, v } = toy;
  if (toy.inWater || grounded) {
    if (toy.stable === 'free') {
      // Le ballon roule sur l'eau.
      rolling.set(v.z, 0, -v.x).multiplyScalar(1 / toy.radius);
      w.lerp(rolling, 1 - Math.exp(-3 * dt));
    } else {
      stableAxis(toy, up, axis);
      torque.crossVectors(axis, up).multiplyScalar(toy.right * (grounded ? 1.6 : 1));
      w.addScaledVector(torque, dt);
      if (toy.stable === 'roll') {
        // Le tonneau roule sur son flanc quand on le pousse de travers.
        forward.set(1, 0, 0).applyQuaternion(q);
        rolling.set(v.z, 0, -v.x).multiplyScalar(1 / toy.radius);
        w.addScaledVector(forward, (rolling.dot(forward) - w.dot(forward)) * (1 - Math.exp(-2.5 * dt)));
      }
    }
    if (toy.idle) {
      w.x += Math.sin(time * 1.9 + toy.phase) * toy.idle * dt;
      w.z += Math.cos(time * 1.4 + toy.phase * 1.3) * toy.idle * dt;
    }
    steerYaw(toy, dt);
    const yaw = w.dot(up);
    w.addScaledVector(up, -yaw);
    w.multiplyScalar(Math.exp(-toy.tiltDrag * dt * (grounded ? 2.5 : 1)));
    w.addScaledVector(up, yaw * Math.exp(-toy.yawDrag * dt * (grounded ? 3 : 1)));
  } else {
    w.multiplyScalar(Math.exp(-0.3 * dt));
  }
  const spin = w.length();
  if (spin > MAX_SPIN) w.multiplyScalar(MAX_SPIN / spin);
  if (spin > 1e-5) {
    axis.copy(w).divideScalar(w.length());
    turn.setFromAxisAngle(axis, w.length() * dt);
    q.premultiply(turn).normalize();
  }
}

/** Les canards nagent dans le sens de leur route ; le radeau revient face au port. */
function steerYaw(toy: Toy, dt: number) {
  let wanted = toy.yawHome;
  if (toy.shape === 'duck') {
    wanted = toy.v.x * toy.v.x + toy.v.z * toy.v.z > 0.006 ? Math.atan2(-toy.v.z, toy.v.x) : Number.NaN;
  }
  if (Number.isNaN(wanted)) return;
  forward.set(1, 0, 0).applyQuaternion(toy.q);
  const current = Math.atan2(-forward.z, forward.x);
  toy.w.y += shortestAngle(current, wanted) * (toy.shape === 'duck' ? 2.2 : 0.5) * dt;
}

/* --------------------------------------------------------- objets entre eux */

/** Seuls les objets en mouvement testent les autres : O(réveillés × n), presque toujours ~0. */
export function collidePairs(time: number) {
  const n = toys.length;
  for (let index = 0; index < n; index++) {
    const toy = toys[index];
    toy.awake = toy.enabled && toy.collides && toy.lod === 0 && toy.mode === 'free'
      && (toy.v.lengthSq() > 0.09 || time - toy.lastHit < 2);
  }
  for (let i = 0; i < n; i++) {
    const a = toys[i];
    if (!a.awake) continue;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const b = toys[j];
      if (!b.enabled || !b.collides || b.mode === 'flying' || b.lod !== 0) continue;
      if (b.awake && j < i) continue;
      resolvePair(a, b, time);
    }
  }
}

function resolvePair(a: Toy, b: Toy, time: number) {
  const dx = b.p.x - a.p.x;
  const dy = b.p.y - a.p.y;
  const dz = b.p.z - a.p.z;
  const bound = (a.shape === 'crate' ? 0.84 : a.radius) + (b.shape === 'crate' ? 0.84 : b.radius);
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= bound * bound) return;
  const distance = Math.sqrt(d2) || 1e-3;
  normal.set(dx / distance, dy / distance, dz / distance);
  const limit = extent(a, normal) + extent(b, normal);
  if (distance >= limit) return;
  const ia = 1 / a.mass;
  const ib = b.mode === 'stacked' ? 0 : 1 / b.mass;
  const total = ia + ib;
  const overlap = limit - distance;
  a.p.addScaledVector(normal, (-overlap * ia) / total);
  b.p.addScaledVector(normal, (overlap * ib) / total);
  const closing = (a.v.x - b.v.x) * normal.x + (a.v.y - b.v.y) * normal.y + (a.v.z - b.v.z) * normal.z;
  if (closing <= 0) return;
  const impulse = (1.45 * closing) / total;
  a.v.addScaledVector(normal, -impulse * ia);
  b.v.addScaledVector(normal, impulse * ib);
  if (closing > 1.2) {
    const kick = Math.min(closing, 6) * 0.6;
    a.w.x += (Math.random() - 0.5) * kick;
    a.w.z += (Math.random() - 0.5) * kick;
    if (ib > 0) {
      b.w.x += (Math.random() - 0.5) * kick;
      b.w.z += (Math.random() - 0.5) * kick;
      b.lastHit = time;
    }
    if (closing > 2.4) {
      const kind: SoundKind = a.sound === 'duck' || b.sound === 'duck' ? 'duck' : a.sound === 'wood' || b.sound === 'wood' ? 'wood' : 'soft';
      bumpSound(kind, closing / 9, time, 0.09);
    }
  }
  // Une caisse de la pyramide heurtée de plein fouet par un objet lancé tombe à son tour.
  if (b.mode === 'stacked' && closing > 3) {
    b.hit = clamp(closing / 9, 0.3, 1);
    b.hitX = normal.x;
    b.hitZ = normal.z;
  }
}
