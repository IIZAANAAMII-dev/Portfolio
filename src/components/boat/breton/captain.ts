import {
  Bone,
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { PaintShop, seeded, type Vec3 } from './build';

/**
 * Le patron : un vieux loup de mer en ciré jaune, casquette marine, barbe blanche et pipe.
 * Un seul maillage articulé (SkinnedMesh, liaison rigide : chaque pièce suit un os), la barre
 * à roue comprise : un appel de dessin pour le personnage entier.
 *
 * Repère du personnage : pieds à l'origine, il regarde +X, sa main droite est côté +Z.
 */
const SKIN = '#f1c4a1';
const JACKET = '#f2c230';
const JACKET_DARK = '#d9a51f';
const TROUSERS = '#2c3f5e';
const BOOTS = '#27342f';
const CAP = '#243650';
const BEARD = '#eeeae2';

export const BONE = { base: 0, pelvis: 1, spine: 2, head: 3, shoulderR: 4, elbowR: 5, shoulderL: 6, elbowL: 7, wheel: 8 } as const;

/** Hauteur de l'os de la tête au repos (bassin 0,5 + buste 0,06 + cou 0,55). */
const HEAD_Y = 1.11;
/** Fourneau de la pipe dans le repère de l'os de la tête. */
const PIPE_BOWL = new Vector3(0.262, 1.245 - HEAD_Y, 0.072);

/** [parent, x, y, z] : position de repos de chaque os, relative à son parent. */
function restPose(wheel: Vec3): [number, number, number, number][] {
  return [
    [-1, 0, 0, 0],
    [0, 0, 0.5, 0],
    [1, 0, 0.06, 0],
    [2, 0, 0.55, 0],
    [2, 0, 0.44, 0.215],
    [4, 0, -0.25, 0],
    [2, 0, 0.44, -0.215],
    [6, 0, -0.25, 0],
    [0, wheel[0], wheel[1], wheel[2]],
  ];
}

const UPPER = 0.25;
const LOWER = 0.25;
/** Du coude au creux de la main (la main est une sphère sous l'avant-bras). */
const LOWER_REACH = 0.26;
const RIM = 0.22;

export type CaptainRig = ReturnType<typeof buildCaptain>;

export function buildCaptain(material: Material, wheel: Vec3) {
  const shop = new PaintShop();
  const B = BONE;

  /* Jambes et bottes (suivent le bassin, qui pivote quand il se retourne). */
  for (const side of [1, -1]) {
    shop.add(new CylinderGeometry(0.072, 0.08, 0.22, 10), BOOTS, { at: [0, 0.11, side * 0.09] }, B.pelvis);
    shop.add(new SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), BOOTS, { at: [0.06, 0.0, side * 0.09], scale: [1.35, 0.9, 1] }, B.pelvis);
    shop.add(new CylinderGeometry(0.078, 0.072, 0.36, 10), TROUSERS, { at: [0, 0.38, side * 0.088] }, B.pelvis);
  }

  /* Torse : ciré jaune bien ventru, patte de boutonnage, col de marinière rayé. */
  const profile = [[0, 0], [0.165, 0], [0.205, 0.08], [0.222, 0.2], [0.212, 0.34], [0.188, 0.45], [0.14, 0.53], [0, 0.56]]
    .map(([r, y]) => new Vector2(r, y));
  shop.add(new LatheGeometry(profile, 14), JACKET, { at: [0, 0.5, 0] }, B.spine);
  shop.add(new BoxGeometry(0.02, 0.4, 0.035), JACKET_DARK, { at: [0.214, 0.76, 0], rot: [0, 0, 0.04], flat: true }, B.spine);
  for (const y of [0.66, 0.8, 0.94]) {
    shop.add(new SphereGeometry(0.016, 6, 4), '#6b4a2b', { at: [0.222, y, 0.03] }, B.spine);
  }
  shop.add(new CylinderGeometry(0.1, 0.12, 0.08, 12), (_x, y) => (Math.floor((y + 0.04) / 0.02) % 2 === 0 ? '#f7f3ea' : '#24375a'), { at: [0, 1.07, 0] }, B.spine);

  /* Tête : nez rond, joues roses, yeux, sourcils et grosse barbe blanche, casquette, pipe. */
  shop.add(new SphereGeometry(0.165, 16, 12), SKIN, { at: [0, 1.27, 0] }, B.head);
  shop.add(new SphereGeometry(0.046, 10, 8), '#e9a184', { at: [0.168, 1.255, 0] }, B.head);
  for (const side of [1, -1]) {
    shop.add(new SphereGeometry(0.036, 8, 6), '#efa49a', { at: [0.13, 1.225, side * 0.085] }, B.head);
    shop.add(new SphereGeometry(0.022, 8, 6), '#1d1f24', { at: [0.148, 1.3, side * 0.058] }, B.head);
    shop.add(new BoxGeometry(0.03, 0.022, 0.07), BEARD, { at: [0.15, 1.342, side * 0.062], rot: [side * -0.15, 0, 0], flat: true }, B.head);
    shop.add(new SphereGeometry(0.04, 8, 6), SKIN, { at: [0, 1.26, side * 0.163] }, B.head);
    shop.add(new SphereGeometry(1, 8, 6), BEARD, { at: [0.168, 1.214, side * 0.04], scale: [0.03, 0.022, 0.052] }, B.head);
  }
  shop.add(new SphereGeometry(1, 14, 10), BEARD, { at: [0.06, 1.16, 0], scale: [0.14, 0.125, 0.165] }, B.head);
  // Couronne de cheveux blancs sous la casquette, de la nuque aux favoris (le plan d'intro le
  // montre de dos : plus de crâne nu sous la visière).
  shop.add(new SphereGeometry(0.172, 16, 8, -Math.PI / 2 - 0.42, Math.PI + 0.84, 0.9, 1.04), BEARD, { at: [0, 1.27, 0] }, B.head);
  shop.add(new CylinderGeometry(0.172, 0.168, 0.08, 16), CAP, { at: [0, 1.405, 0] }, B.head);
  shop.add(new CylinderGeometry(0.185, 0.175, 0.035, 16), CAP, { at: [-0.01, 1.455, 0], rot: [0, 0, 0.08] }, B.head);
  shop.add(new CylinderGeometry(0.12, 0.12, 0.016, 12, 1, false, 0, Math.PI), '#1c2026', { at: [0.11, 1.372, 0], rot: [0, 0, -0.18] }, B.head);
  shop.add(new SphereGeometry(0.018, 6, 4), '#d8b45a', { at: [0.174, 1.41, 0] }, B.head);
  shop.add(new CylinderGeometry(0.009, 0.009, 0.1, 5), '#4a2c19', { at: [0.215, 1.2, 0.055], rot: [0, 0.35, Math.PI / 2] }, B.head);
  shop.add(new CylinderGeometry(0.028, 0.022, 0.055, 8), '#6e3f22', { at: [0.262, 1.215, 0.072] }, B.head);

  /* Bras : manches jaunes, poignets plus foncés, mains. Au repos, ils pendent le long du corps. */
  for (const [side, shoulder, elbow] of [[1, B.shoulderR, B.elbowR], [-1, B.shoulderL, B.elbowL]] as const) {
    const z = side * 0.215;
    shop.add(new SphereGeometry(0.07, 10, 8), JACKET, { at: [0, 0.99, z] }, shoulder);
    shop.add(new CylinderGeometry(0.062, 0.057, UPPER, 10), JACKET, { at: [0, 1 - UPPER / 2, z] }, shoulder);
    shop.add(new SphereGeometry(0.058, 8, 6), JACKET, { at: [0, 0.75, z] }, elbow);
    shop.add(new CylinderGeometry(0.057, 0.052, 0.2, 10), JACKET, { at: [0, 0.65, z] }, elbow);
    shop.add(new CylinderGeometry(0.06, 0.06, 0.035, 10), JACKET_DARK, { at: [0, 0.545, z] }, elbow);
    shop.add(new SphereGeometry(0.055, 10, 8), SKIN, { at: [0, 0.5, z], scale: [1, 1.1, 0.9] }, elbow);
  }

  /* Barre à roue en bois : jante, huit rayons à poignées, moyeu de laiton. */
  const helm = new PaintShop()
    .add(new TorusGeometry(RIM, 0.02, 6, 28), '#8f5a2e', { rot: [0, Math.PI / 2, 0] })
    .add(new CylinderGeometry(0.05, 0.05, 0.08, 10), '#c9a35c', { rot: [0, 0, Math.PI / 2] });
  for (let spoke = 0; spoke < 8; spoke++) {
    const angle = (spoke / 8) * Math.PI * 2;
    const dir = new Vector3(0, Math.cos(angle), Math.sin(angle));
    helm.add(new CylinderGeometry(0.011, 0.011, 0.3, 5), '#a8703c', { at: [0, dir.y * 0.15, dir.z * 0.15], rot: [angle, 0, 0] });
    helm.add(new SphereGeometry(0.022, 6, 5), '#a8703c', { at: [0, dir.y * 0.3, dir.z * 0.3] });
  }
  shop.add(helm.build(), null, { at: wheel }, B.wheel);

  const geometry = shop.build();
  const rest = restPose(wheel);
  const bones = rest.map(([, x, y, z]) => {
    const bone = new Bone();
    bone.position.set(x, y, z);
    return bone;
  });
  rest.forEach(([parent], index) => {
    if (parent >= 0) bones[parent].add(bones[index]);
  });
  const mesh = new SkinnedMesh(geometry, material);
  mesh.add(bones[0]);
  mesh.bind(new Skeleton(bones));
  mesh.frustumCulled = false;
  mesh.name = 'patron';
  return {
    mesh,
    bones,
    wheel,
    state: { wave: 0, whoa: 0, fall: 0, yaw: 0, lean: 0, headYaw: 0, headPitch: 0, lookYaw: 0, lookPitch: 0, nextLook: 0, wheelAngle: 0, throwW: 0 },
  };
}

/** Position monde du fourneau de la pipe (matrices de l'image précédente : un retard invisible). */
export function pipeBowl(rig: CaptainRig, out: Vector3) {
  return rig.bones[BONE.head].localToWorld(out.copy(PIPE_BOWL));
}

const HAND = new Vector3(0, -LOWER_REACH, 0);

/** Position monde de la main droite (+1) ou gauche (−1) : l'amarre en part au lancer. */
export function handPosition(rig: CaptainRig, side: number, out: Vector3) {
  return rig.bones[side > 0 ? BONE.elbowR : BONE.elbowL].localToWorld(out.copy(HAND));
}

/** Bosse douce : monte de a à b, reste à 1, redescend de c à d. */
function hump(x: number, a: number, b: number, c: number, d: number) {
  const up = Math.max(0, Math.min(1, (x - a) / (b - a)));
  const down = Math.max(0, Math.min(1, (x - c) / (d - c)));
  return up * up * (3 - 2 * up) * (1 - down * down * (3 - 2 * down));
}

/* ------------------------------------------------------------------ Animation */

const DOWN = new Vector3(0, -1, 0);
const spineMatrix = new Matrix4();
const inverse = new Matrix4();
const shoulderAt = new Vector3();
const target = new Vector3();
const reach = new Vector3();
const pole = new Vector3();
const elbowAt = new Vector3();
const hand = new Vector3();
const upperDir = new Vector3();
const lowerDir = new Vector3();
const poseUpper = new Vector3();
const poseLower = new Vector3();
const local = new Vector3();
const shoulderQ = new Quaternion();
const undo = new Quaternion();

const damp = (current: number, goal: number, lambda: number, dt: number) => current + (goal - current) * (1 - Math.exp(-lambda * dt));

/** Bras à deux os : direction épaule→coude et coude→main pour atteindre `goal` (repère du buste). */
function solveArm(shoulder: Vector3, goal: Vector3, bend: Vector3) {
  reach.subVectors(goal, shoulder);
  const distance = Math.min(Math.max(reach.length(), 0.08), UPPER + LOWER - 0.004);
  reach.normalize();
  const cos = (UPPER * UPPER + distance * distance - LOWER * LOWER) / (2 * UPPER * distance);
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  pole.copy(bend).addScaledVector(reach, -bend.dot(reach)).normalize();
  upperDir.copy(reach).multiplyScalar(cos).addScaledVector(pole, sin).normalize();
  elbowAt.copy(shoulder).addScaledVector(upperDir, UPPER);
  hand.copy(shoulder).addScaledVector(reach, distance);
  lowerDir.subVectors(hand, elbowAt).normalize();
}

function blend(into: Vector3, toward: Vector3, weight: number) {
  if (weight <= 0.001) return;
  into.lerp(toward, Math.min(weight, 1)).normalize();
}

function applyArm(rig: CaptainRig, shoulder: number, elbow: number) {
  shoulderQ.setFromUnitVectors(DOWN, upperDir);
  rig.bones[shoulder].quaternion.copy(shoulderQ);
  local.copy(lowerDir).applyQuaternion(undo.copy(shoulderQ).invert());
  rig.bones[elbow].quaternion.setFromUnitVectors(DOWN, local);
}

export type CaptainCue = {
  time: number;
  dt: number;
  /** Caméra dans le repère du personnage (pour se tourner vers le visiteur et lui faire signe). */
  camera: Vector3;
  /** Poids visés : salut, surprise (choc), chute (intro, avant l'impact). */
  wave: number;
  whoa: number;
  fall: number;
  /** Angle de la roue (rad) et gîte du bateau à compenser. */
  steer: number;
  roll: number;
  /** Accélération (m/s²) et vitesse de lacet (rad/s) du bateau : inertie du buste, regard. */
  accel: number;
  turn: number;
  /** 1 = mouvements réduits (préférence système) : gestes deux fois plus lents et moins amples. */
  calm: number;
  /**
   * Lancer d'amarre : avancement du geste (0 → 1), ou -1 hors lancer. `throwSide` : bord du
   * quai (+1 tribord, −1 bâbord) ; le patron lance avec le bras de ce côté, face au ponton.
   */
  throw: number;
  throwSide: number;
};

/* Lancer : poses clés du bras qui lance (repère du buste, côté droit ; z inversé à gauche). */
const THROW_KEYS: { at: number; upper: [number, number, number]; lower: [number, number, number] }[] = [
  // Prise d'élan : le bras part en arrière, bas et dehors (la glène dans la main).
  { at: 0.0, upper: [-0.1, -1, 0.25], lower: [0.3, -1, 0.1] },
  { at: 0.3, upper: [-0.6, -0.55, 0.6], lower: [-0.45, -0.7, 0.45] },
  // Balancé par en dessous : lâcher bras tendu, vers l'avant et le haut.
  { at: 0.44, upper: [0.8, 0.25, 0.4], lower: [0.85, 0.5, 0.15] },
  // Accompagnement, puis le bras retombe.
  { at: 0.62, upper: [0.45, 0.8, 0.3], lower: [0.35, 0.95, 0.1] },
  { at: 1.0, upper: [0.15, -1, 0.25], lower: [0.3, -1, 0.1] },
];
const throwUpper = new Vector3();
const throwLower = new Vector3();
const keyA = new Vector3();
const keyB = new Vector3();

/** Pose du bras qui lance à l'avancement `p` (interpolation douce entre les poses clés). */
function throwPose(p: number, mirror: number) {
  let index = 0;
  while (index < THROW_KEYS.length - 2 && p > THROW_KEYS[index + 1].at) index += 1;
  const a = THROW_KEYS[index];
  const b = THROW_KEYS[index + 1];
  const t = Math.max(0, Math.min(1, (p - a.at) / (b.at - a.at)));
  const k = t * t * (3 - 2 * t);
  throwUpper.lerpVectors(keyA.set(a.upper[0], a.upper[1], a.upper[2] * mirror), keyB.set(b.upper[0], b.upper[1], b.upper[2] * mirror), k).normalize();
  throwLower.lerpVectors(keyA.set(a.lower[0], a.lower[1], a.lower[2] * mirror), keyB.set(b.lower[0], b.lower[1], b.lower[2] * mirror), k).normalize();
}

/** Une image d'animation du patron : barre, regards, salut, surprise, chute. */
export function animateCaptain(rig: CaptainRig, cue: CaptainCue) {
  const { state, bones } = rig;
  const { time, dt } = cue;
  state.wave = damp(state.wave, cue.wave, 5, dt);
  state.whoa = damp(state.whoa, cue.whoa, 9, dt);
  state.fall = damp(state.fall, cue.fall, 7, dt);
  // Lancer d'amarre : poids du geste (entrée et sortie douces) et ses temps forts.
  const p = cue.throw;
  const throwing = p >= 0 && p <= 1;
  state.throwW = damp(state.throwW, throwing ? hump(p, 0, 0.12, 0.82, 1) : 0, 14, dt);
  const windUp = throwing ? hump(p, 0.08, 0.3, 0.32, 0.44) : 0;
  const release = throwing ? hump(p, 0.36, 0.46, 0.5, 0.7) : 0;

  // Le bassin se tourne vers la caméra pour saluer (le reste du temps, face à la barre) ; pour
  // lancer, face au ponton, un peu vers l'arrière (le bras qui lance passe du côté de la poupe).
  const calm = 1 - cue.calm * 0.5;
  const toCamera = Math.max(-2.5, Math.min(2.5, Math.atan2(-cue.camera.z, cue.camera.x)));
  const toDock = -cue.throwSide * (Math.PI / 2 + 0.4);
  state.yaw = damp(state.yaw, toCamera * state.wave + toDock * state.throwW, 4 + state.throwW * 3, dt);
  bones[BONE.pelvis].rotation.set(0, state.yaw, 0);
  bones[BONE.pelvis].position.y = 0.5 + Math.abs(Math.sin(time * 9 * calm)) * 0.025 * calm * state.wave + state.whoa * 0.03
    - release * 0.04 * state.throwW;

  // Le buste compense la gîte, respire, se penche un peu sur la barre ; inertie : il part en
  // arrière quand le moteur pousse, en avant quand on réduit les gaz. Lancer : il arme en
  // se cambrant et en tournant les épaules, puis bascule vers l'avant au lâcher.
  state.lean = damp(state.lean, Math.max(-0.08, Math.min(0.08, cue.accel * 0.007)), 3, dt);
  const spine = bones[BONE.spine];
  const twist = cue.throwSide * (-0.38 * windUp + 0.28 * release) * state.throwW;
  spine.rotation.set(
    -cue.roll * 0.7,
    twist,
    -0.05 * (1 - state.wave) + state.fall * 0.08 + state.lean + (0.12 * windUp - 0.17 * release) * state.throwW,
  );
  spine.scale.set(1, 1 + Math.sin(time * 1.7) * 0.012, 1);

  // Regards : de temps en temps vers le large, ou vers la caméra quand il salue.
  if (time > state.nextLook) {
    const pick = Math.floor(time * 10);
    state.lookYaw = (seeded(pick) - 0.5) * 1.7;
    state.lookPitch = (seeded(pick + 7.3) - 0.35) * 0.3;
    state.nextLook = time + 2.4 + seeded(pick + 3.1) * 3.6;
  }
  const facing = Math.max(-1, Math.min(1, toCamera - state.yaw));
  // En virage, il regarde où va l'étrave (cap positif = vers tribord, à sa droite).
  const turning = Math.min(Math.abs(cue.turn) * 2, 1);
  const intoTurn = Math.max(-0.6, Math.min(0.6, -cue.turn * 0.55));
  const lookYaw = ((state.lookYaw * (1 - turning) + intoTurn) * (1 - state.wave) + facing * state.wave) * (1 - state.throwW);
  const lookPitch = (state.lookPitch * (1 - state.wave) + 0.18 * state.wave + state.fall * 0.35 - state.whoa * 0.1) * (1 - state.throwW)
    - 0.12 * state.throwW;
  state.headYaw = damp(state.headYaw, lookYaw, 4, dt);
  state.headPitch = damp(state.headPitch, lookPitch, 4, dt);
  bones[BONE.head].rotation.set(0, state.headYaw, state.headPitch + Math.sin(time * 1.3) * 0.02);

  // Roue : elle suit le safran.
  state.wheelAngle = damp(state.wheelAngle, Math.max(-1.3, Math.min(1.3, cue.steer * 2.4)), 6, dt);
  bones[BONE.wheel].rotation.set(state.wheelAngle, 0, 0);

  // Repère du buste (bassin × buste) : les prises sur la jante y sont exprimées.
  const pelvis = bones[BONE.pelvis];
  pelvis.updateMatrix();
  spine.updateMatrix();
  spineMatrix.multiplyMatrices(pelvis.matrix, spine.matrix);
  inverse.copy(spineMatrix).invert();

  for (const side of [1, -1] as const) {
    const shoulder = side > 0 ? BONE.shoulderR : BONE.shoulderL;
    const elbow = side > 0 ? BONE.elbowR : BONE.elbowL;
    shoulderAt.copy(bones[shoulder].position);
    // Prise sur la jante à « 10 h 10 », qui tourne avec la roue.
    const grip = side * 0.9 + state.wheelAngle;
    target.set(rig.wheel[0] - 0.045, rig.wheel[1] + Math.cos(grip) * RIM, rig.wheel[2] + Math.sin(grip) * RIM).applyMatrix4(inverse);
    solveArm(shoulderAt, target, pole.set(-0.35, -1, side * 0.7));
    poseUpper.copy(upperDir);
    poseLower.copy(lowerDir);

    // Lancer d'amarre : le bras côté quai lance, l'autre se lève un peu pour l'équilibre.
    if (state.throwW > 0.001) {
      if (side === cue.throwSide) {
        throwPose(Math.max(0, Math.min(1, p)), side);
        blend(poseUpper, throwUpper, state.throwW);
        blend(poseLower, throwLower, state.throwW);
      } else {
        upperDir.set(0.35, -0.65, side * 0.6).normalize();
        lowerDir.set(0.65, -0.2, side * 0.25).normalize();
        blend(poseUpper, upperDir, state.throwW * 0.85);
        blend(poseLower, lowerDir, state.throwW * 0.85);
      }
    }

    // Salut (bras droit levé qui balance), l'autre bras ballant.
    if (side > 0) {
      upperDir.set(0.18, 0.8, 0.58).normalize();
      lowerDir.set(0.05, 1, Math.sin(time * 8.5 * calm) * 0.55 * calm).normalize();
    } else {
      upperDir.set(0.08, -1, -0.22).normalize();
      lowerDir.set(0.35, -1, -0.05).normalize();
    }
    blend(poseUpper, upperDir, state.wave);
    blend(poseLower, lowerDir, state.wave);
    // Surprise : bras écartés.
    upperDir.set(0.25, 0.35, side).normalize();
    lowerDir.set(0.2, 0.9, side * 0.35).normalize();
    blend(poseUpper, upperDir, state.whoa);
    blend(poseLower, lowerDir, state.whoa);
    // Chute de l'intro : bras en l'air qui s'agitent.
    upperDir.set(0.05, 1, side * (0.45 + Math.sin(time * 14 * calm + side) * 0.12 * calm)).normalize();
    lowerDir.set(0, 1, side * 0.15).normalize();
    blend(poseUpper, upperDir, state.fall);
    blend(poseLower, lowerDir, state.fall);

    upperDir.copy(poseUpper);
    lowerDir.copy(poseLower);
    applyArm(rig, shoulder, elbow);
  }
}
