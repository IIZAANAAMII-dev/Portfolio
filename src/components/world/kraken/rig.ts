import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three';
import { ARMS, SPINE, SPINE_ROWS } from './state';

/**
 * Squelette des bras, calculé sur le CPU (8 × 48 points par image, aucune allocation) puis
 * envoyé dans une petite texture flottante : le GPU y accroche le tube, les ventouses et les
 * gouttes (spline de Catmull-Rom + ondulation fine dans le vertex shader).
 *
 * Un bras « libre » vit dans un plan vertical : son angle à la verticale croît le long du
 * bras (inclinaison, cambrure, crosse enroulée au bout, qui se déroule quand il émerge).
 * Un bras « saisissant » glisse le long d'un chemin : sortie de l'eau, arche par-dessus le
 * bateau, puis hélice autour de la coque. Les deux poses se mélangent.
 */
export interface ArmPose {
  /** 0 → rayon nul (bras absent, aucun pixel). */
  visible: number;
  rootX: number;
  rootZ: number;
  /** Direction (unitaire, horizontale) vers laquelle le bras se penche ; ses ventouses y font face. */
  dirX: number;
  dirZ: number;
  length: number;
  thickness: number;
  /** 0 immergé → 1 dressé hors de l'eau. */
  rise: number;
  tilt: number;
  lean: number;
  curl: number;
  sway: number;
  phase: number;
  /** Rotation de la face ventrale autour du bras (montre plus ou moins les ventouses). */
  twist: number;
  /** Eau qui ruisselle encore (gouttes). */
  wet: number;
  /** Mélange vers le chemin de saisie, et avancement de l'enroulement. */
  wrap: number;
  coil: number;
  /** Repère de l'hélice : origine, axe (avant du bateau), haut, côté, dimensions. */
  hx: number;
  hy: number;
  hz: number;
  ax: number;
  ay: number;
  az: number;
  ux: number;
  uy: number;
  uz: number;
  vx: number;
  vy: number;
  vz: number;
  hLength: number;
  hRadiusUp: number;
  hRadiusSide: number;
  hTurns: number;
  /** Sens d'enroulement (±1) : le bras passe d'abord par-dessus, côté opposé à sa racine. */
  hand: number;
}

function createArm(): ArmPose {
  return {
    visible: 0, rootX: 0, rootZ: 0, dirX: 1, dirZ: 0, length: 30, thickness: 1.4,
    rise: 0, tilt: 0, lean: 0, curl: 0, sway: 1, phase: 0, twist: 0, wet: 0, wrap: 0, coil: 0,
    hx: 0, hy: 0, hz: 0, ax: 1, ay: 0, az: 0, ux: 0, uy: 1, uz: 0, vx: 0, vy: 0, vz: 1,
    hLength: 2.6, hRadiusUp: 1.8, hRadiusSide: 1.4, hTurns: 1.4, hand: 1,
  };
}

export const arms: ArmPose[] = Array.from({ length: ARMS }, createArm);

const TEXELS = SPINE * ARMS * SPINE_ROWS;
export const spineData = new Float32Array(TEXELS * 4);
export const spineTexture = new DataTexture(spineData, SPINE, ARMS * SPINE_ROWS, RGBAFormat, FloatType);
spineTexture.magFilter = NearestFilter;
spineTexture.minFilter = NearestFilter;
spineTexture.generateMipmaps = false;
spineTexture.needsUpdate = true;

// Tampons réutilisés (positions, indices ventraux, rayons) : zéro allocation par image.
const P = new Float32Array(SPINE * 3);
const V = new Float32Array(SPINE * 3);
const R = new Float32Array(SPINE);
const W = new Float32Array(3);
const WV = new Float32Array(3);

/** Part du chemin de saisie occupée par l'arche (le reste est l'hélice). */
const ARCH = 0.56;

/** Angle à la verticale (vers `dir`) le long du bras : la crosse se resserre vers la pointe. */
function armAngle(arm: ArmPose, s: number, curl: number, time: number, calm: number) {
  const hook = s > 0.4 ? Math.pow((s - 0.4) / 0.6, 2.1) : 0;
  return arm.tilt + arm.lean * s + curl * hook
    + arm.sway * calm * 0.2 * Math.sin(time * 0.78 + arm.phase + s * 2.3) * s;
}

function radiusAt(arm: ArmPose, s: number) {
  const taper = Math.pow(1 - s, 0.85);
  return arm.thickness * Math.max(0.024, taper) * arm.visible;
}

/**
 * Point du chemin de saisie pour un paramètre u ∈ [-1, 1] : sous l'eau (u < 0), arche de
 * Bézier jusqu'au sommet de l'hélice, puis hélice autour de la coque. Écrit W (position) et
 * WV (direction des ventouses : vers le bateau, puis vers l'axe de l'hélice).
 */
function wrapPoint(arm: ArmPose, u: number) {
  const ex = arm.rootX;
  const ey = -0.8;
  const ez = arm.rootZ;
  if (u < 0) {
    W[0] = ex;
    W[1] = ey + u * arm.length;
    W[2] = ez;
    WV[0] = arm.dirX;
    WV[1] = 0;
    WV[2] = arm.dirZ;
    return;
  }
  // Sommet de l'hélice (angle 0 = au-dessus de la coque) et sa tangente.
  const turn = Math.PI * 2 * arm.hTurns * arm.hand;
  const h0x = arm.hx + arm.ux * arm.hRadiusUp;
  const h0y = arm.hy + arm.uy * arm.hRadiusUp;
  const h0z = arm.hz + arm.uz * arm.hRadiusUp;
  if (u <= ARCH) {
    const t = u / ARCH;
    const lift = 6 + arm.hRadiusUp * 2;
    // Tangente d'entrée dans l'hélice (sens de rotation), normalisée grossièrement.
    let tx = arm.ax * arm.hLength + turn * arm.vx * arm.hRadiusSide;
    let ty = arm.ay * arm.hLength + turn * arm.vy * arm.hRadiusSide;
    let tz = arm.az * arm.hLength + turn * arm.vz * arm.hRadiusSide;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const p1x = ex + arm.dirX * 2.5;
    const p1y = ey + lift + 4;
    const p1z = ez + arm.dirZ * 2.5;
    const p2x = h0x - tx * 6 + arm.ux * 3.5;
    const p2y = h0y - ty * 6 + arm.uy * 3.5;
    const p2z = h0z - tz * 6 + arm.uz * 3.5;
    const a = (1 - t) * (1 - t) * (1 - t);
    const b = 3 * (1 - t) * (1 - t) * t;
    const c = 3 * (1 - t) * t * t;
    const d = t * t * t;
    W[0] = a * ex + b * p1x + c * p2x + d * h0x;
    W[1] = a * ey + b * p1y + c * p2y + d * h0y;
    W[2] = a * ez + b * p1z + c * p2z + d * h0z;
    // Ventouses tournées vers le bateau.
    let vx = arm.hx - W[0];
    let vy = arm.hy - W[1];
    let vz = arm.hz - W[2];
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx /= vl;
    vy /= vl;
    vz /= vl;
    WV[0] = vx;
    WV[1] = vy;
    WV[2] = vz;
    return;
  }
  const a = (u - ARCH) / (1 - ARCH);
  const angle = turn * a;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  // Le serrage se resserre un peu vers la pointe.
  const squeeze = 1 - a * 0.12;
  const along = a * arm.hLength;
  W[0] = arm.hx + arm.ax * along + (arm.ux * cosA * arm.hRadiusUp + arm.vx * sinA * arm.hRadiusSide) * squeeze;
  W[1] = arm.hy + arm.ay * along + (arm.uy * cosA * arm.hRadiusUp + arm.vy * sinA * arm.hRadiusSide) * squeeze;
  W[2] = arm.hz + arm.az * along + (arm.uz * cosA * arm.hRadiusUp + arm.vz * sinA * arm.hRadiusSide) * squeeze;
  WV[0] = -(arm.ux * cosA + arm.vx * sinA);
  WV[1] = -(arm.uy * cosA + arm.vy * sinA);
  WV[2] = -(arm.uz * cosA + arm.vz * sinA);
}

function buildArm(index: number, arm: ArmPose, time: number, calm: number) {
  const last = SPINE - 1;
  const step = arm.length / last;
  const dx = arm.dirX;
  const dz = arm.dirZ;
  const ex = -dz;
  const ez = dx;
  // Immergé, le bras est plus bas et plus enroulé : il se déroule en sortant de l'eau.
  const depth = (1 - arm.rise) * arm.length * 0.9 + 0.8;
  const curl = arm.curl + (1 - arm.rise) * 2.4;
  let x = arm.rootX;
  let y = -depth;
  let z = arm.rootZ;
  const uTip = ARCH + arm.coil * (1 - ARCH);
  for (let k = 0; k <= last; k++) {
    const s = k / last;
    if (k > 0) {
      const phiMid = armAngle(arm, (k - 0.5) / last, curl, time, calm);
      const horizontal = Math.sin(phiMid) * step;
      x += horizontal * dx;
      y += Math.cos(phiMid) * step;
      z += horizontal * dz;
    }
    const phi = armAngle(arm, s, curl, time, calm);
    const lateral = arm.sway * calm * arm.length * 0.07 * Math.pow(s, 1.6)
      * (Math.sin(time * 0.62 + arm.phase * 1.3 + s * 3.1) * 0.9
        + Math.sin(time * 1.45 + arm.phase + s * 6.3) * 0.32);
    let px = x + ex * lateral;
    let py = y;
    let pz = z + ez * lateral;
    const cosPhi = Math.cos(phi);
    let vx = cosPhi * dx;
    let vy = -Math.sin(phi);
    let vz = cosPhi * dz;
    if (arm.wrap > 0.001) {
      wrapPoint(arm, s - 1 + uTip);
      const w = arm.wrap;
      px += (W[0] - px) * w;
      py += (W[1] - py) * w;
      pz += (W[2] - pz) * w;
      vx += (WV[0] - vx) * w;
      vy += (WV[1] - vy) * w;
      vz += (WV[2] - vz) * w;
    }
    P[k * 3] = px;
    P[k * 3 + 1] = py;
    P[k * 3 + 2] = pz;
    V[k * 3] = vx;
    V[k * 3 + 1] = vy;
    V[k * 3 + 2] = vz;
    R[k] = radiusAt(arm, s);
  }

  // Repères : tangente par différences finies, face ventrale ré-orthogonalisée (transport
  // de la précédente si l'indice dégénère), puis torsion autour du bras.
  const cosTwist = Math.cos(arm.twist);
  const sinTwist = Math.sin(arm.twist);
  let nx = 1;
  let ny = 0;
  let nz = 0;
  const rowPosition = (index * SPINE_ROWS) * SPINE;
  const rowVentral = rowPosition + SPINE;
  const rowTangent = rowVentral + SPINE;
  for (let k = 0; k <= last; k++) {
    const k0 = k === 0 ? 0 : k - 1;
    const k1 = k === last ? last : k + 1;
    let tx = P[k1 * 3] - P[k0 * 3];
    let ty = P[k1 * 3 + 1] - P[k0 * 3 + 1];
    let tz = P[k1 * 3 + 2] - P[k0 * 3 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    let vx = V[k * 3];
    let vy = V[k * 3 + 1];
    let vz = V[k * 3 + 2];
    let dot = vx * tx + vy * ty + vz * tz;
    vx -= tx * dot;
    vy -= ty * dot;
    vz -= tz * dot;
    let vl = Math.hypot(vx, vy, vz);
    if (vl < 1e-3) {
      dot = nx * tx + ny * ty + nz * tz;
      vx = nx - tx * dot;
      vy = ny - ty * dot;
      vz = nz - tz * dot;
      vl = Math.hypot(vx, vy, vz) || 1;
    }
    nx = vx / vl;
    ny = vy / vl;
    nz = vz / vl;
    // B = T × N
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    const fx = nx * cosTwist + bx * sinTwist;
    const fy = ny * cosTwist + by * sinTwist;
    const fz = nz * cosTwist + bz * sinTwist;

    let offset = (rowPosition + k) * 4;
    spineData[offset] = P[k * 3];
    spineData[offset + 1] = P[k * 3 + 1];
    spineData[offset + 2] = P[k * 3 + 2];
    spineData[offset + 3] = R[k];
    offset = (rowVentral + k) * 4;
    spineData[offset] = fx;
    spineData[offset + 1] = fy;
    spineData[offset + 2] = fz;
    spineData[offset + 3] = 0;
    offset = (rowTangent + k) * 4;
    spineData[offset] = tx;
    spineData[offset + 1] = ty;
    spineData[offset + 2] = tz;
    spineData[offset + 3] = arm.wet;
  }
}

export function buildArms(time: number, calm: number) {
  for (let index = 0; index < ARMS; index++) buildArm(index, arms[index], time, calm);
  spineTexture.needsUpdate = true;
}

/** Point où le bras perce la surface (y ≈ 0) : écume et gerbes. Renvoie false s'il n'émerge pas. */
export function armSurfacePoint(index: number, out: { x: number; z: number; radius: number }) {
  const row = index * SPINE_ROWS * SPINE;
  for (let k = 0; k < SPINE - 1; k++) {
    const a = (row + k) * 4;
    const b = a + 4;
    const ya = spineData[a + 1];
    const yb = spineData[b + 1];
    if (ya <= 0 && yb > 0) {
      const f = ya === yb ? 0 : -ya / (yb - ya);
      out.x = spineData[a] + (spineData[b] - spineData[a]) * f;
      out.z = spineData[a + 2] + (spineData[b + 2] - spineData[a + 2]) * f;
      out.radius = spineData[a + 3] + (spineData[b + 3] - spineData[a + 3]) * f;
      return out.radius > 0.05;
    }
  }
  return false;
}

/** Position (monde) d'un échantillon du squelette, pour les gerbes au bout d'un bras. */
export function spinePoint(index: number, s: number, out: { x: number; y: number; z: number }) {
  const k = Math.round(Math.max(0, Math.min(1, s)) * (SPINE - 1));
  const offset = (index * SPINE_ROWS * SPINE + k) * 4;
  out.x = spineData[offset];
  out.y = spineData[offset + 1];
  out.z = spineData[offset + 2];
  return out;
}

