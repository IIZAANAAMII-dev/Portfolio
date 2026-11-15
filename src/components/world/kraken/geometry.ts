import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LatheGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { hash } from '@/lib/utils/math';
import { ARMS, HEAD } from './state';

/**
 * Géométries du kraken, construites une fois. Le tube et les ventouses ne contiennent que
 * des coordonnées « squelette » (bras, abscisse, angle) : le vertex shader les place.
 */

/** Tous les bras dans un seul maillage : position = (bras, s, θ), anneaux serrés vers la pointe. */
export function tentacleGeometry(segments = 84, around = 14) {
  const ring = around + 1;
  const perArm = (segments + 1) * ring;
  const position = new Float32Array(ARMS * perArm * 3);
  const uv = new Float32Array(ARMS * perArm * 2);
  const index = new Uint16Array(ARMS * segments * around * 6);
  let v = 0;
  let t = 0;
  for (let arm = 0; arm < ARMS; arm++) {
    const base = arm * perArm;
    for (let i = 0; i <= segments; i++) {
      const s = 1 - Math.pow(1 - i / segments, 1.35);
      for (let j = 0; j <= around; j++) {
        position[v * 3] = arm;
        position[v * 3 + 1] = s;
        position[v * 3 + 2] = (j / around) * Math.PI * 2;
        uv[v * 2] = j / around;
        uv[v * 2 + 1] = s * 7 + arm * 0.37;
        v++;
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < around; j++) {
        const a = base + i * ring + j;
        const b = a + 1;
        const c = a + ring;
        const d = c + 1;
        // Faces extérieures : θ puis s (la normale du parallélogramme pointe vers dehors).
        index[t++] = a;
        index[t++] = b;
        index[t++] = c;
        index[t++] = b;
        index[t++] = d;
        index[t++] = c;
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

/**
 * Ventouses : une coupelle tournée (bourrelet crème, cœur sombre), instanciée en deux rangées
 * par bras, plus grosses à la base. Ordre pair/impair : en qualité basse on n'en dessine
 * qu'une sur deux en réduisant simplement `instanceCount`.
 */
export function suckerGeometry() {
  const profile = [
    new Vector2(0.001, -0.06),
    new Vector2(0.3, -0.08),
    new Vector2(0.52, 0.04),
    new Vector2(0.7, 0.2),
    new Vector2(0.84, 0.24),
    new Vector2(0.98, 0.12),
    new Vector2(1.08, -0.02),
  ];
  const lathe = new LatheGeometry(profile, 8);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', lathe.getAttribute('position'));
  geometry.setAttribute('normal', lathe.getAttribute('normal'));
  if (lathe.index) geometry.setIndex(lathe.index);
  // Couleurs par sommet selon le rayon : cœur lie-de-vin, paroi rose, bourrelet crème.
  const positions = lathe.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const inner = new Color('#3a0a22');
  const wall = new Color('#8a2a48');
  const rim = new Color('#f3d2c0');
  const outer = new Color('#e2b3a0');
  const swatch = new Color();
  for (let i = 0; i < positions.count; i++) {
    const r = Math.hypot(positions.getX(i), positions.getZ(i));
    if (r < 0.4) swatch.copy(inner).lerp(wall, r / 0.4);
    else if (r < 0.75) swatch.copy(wall).lerp(rim, (r - 0.4) / 0.35);
    else swatch.copy(rim).lerp(outer, Math.min(1, (r - 0.75) / 0.3));
    colors[i * 3] = swatch.r;
    colors[i * 3 + 1] = swatch.g;
    colors[i * 3 + 2] = swatch.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  lathe.dispose();

  const items: number[] = [];
  const nominalLength = 32;
  const nominalThickness = 1.5;
  for (let arm = 0; arm < ARMS; arm++) {
    for (let side = -1; side <= 1; side += 2) {
      let s = 0.05 + (side > 0 ? 0.012 : 0);
      let count = 0;
      while (s < 0.94) {
        const radius = nominalThickness * Math.pow(1 - s, 0.85);
        items.push(arm, s, side, 0.85 + hash(arm * 31 + count * 7.7 + side) * 0.3);
        s += (radius * 0.34 * 2 * 1.18) / nominalLength;
        count++;
      }
    }
  }
  // Pairs d'abord, impairs ensuite.
  const total = items.length / 4;
  const ordered = new Float32Array(items.length);
  let cursor = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = pass; i < total; i += 2) {
      ordered.set(items.slice(i * 4, i * 4 + 4), cursor * 4);
      cursor++;
    }
  }
  geometry.setAttribute('aSucker', new InstancedBufferAttribute(ordered, 4));
  geometry.instanceCount = total;
  return { geometry, count: total };
}

/** Bruit de valeur 3D très simple (déterministe), pour bosseler la tête. */
function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number, c: number) => hash(a * 127.1 + b * 311.7 + c * 74.7);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(h(ix, iy, iz), h(ix + 1, iy, iz), ux);
  const x10 = lerp(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux);
  const x01 = lerp(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux);
  const x11 = lerp(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

/** Direction (repère tête) des orbites, symétriques de part et d'autre (z = ±). */
export const EYE_DIRECTION = new Vector3(0.5, 0.44, 0.745).normalize();

/** Centre d'un œil et direction de repos (normale de l'orbite), côté `side` = ±1. */
export function eyeFrame(side: number) {
  const dir = EYE_DIRECTION.clone();
  dir.z *= side;
  const surface = new Vector3(dir.x * HEAD.rx, dir.y * HEAD.ry, dir.z * HEAD.rz);
  const normal = new Vector3(surface.x / (HEAD.rx * HEAD.rx), surface.y / (HEAD.ry * HEAD.ry), surface.z / (HEAD.rz * HEAD.rz))
    .normalize();
  const center = surface.clone().addScaledVector(normal, -HEAD.eyeRadius * 0.42);
  return { center, normal };
}

/**
 * Tête-manteau : ellipsoïde étiré vers l'arrière en cône (calmar), bosselé, deux orbites
 * creusées avec un bourrelet et une arcade sourcilière. UV de sphère répétées (4 × 2).
 */
export function headGeometry() {
  const geometry = new SphereGeometry(1, 96, 64);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const n = new Vector3();
  const eyes = [-1, 1].map((side) => {
    const dir = EYE_DIRECTION.clone();
    dir.z *= side;
    return dir;
  });
  for (let i = 0; i < position.count; i++) {
    n.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
    let x = n.x * HEAD.rx;
    let y = n.y * HEAD.ry;
    let z = n.z * HEAD.rz;
    if (n.x < 0) {
      // Manteau : étiré, effilé, légèrement relevé vers la pointe.
      const back = -n.x;
      x *= 1 + (HEAD.mantle - 1) * back;
      const taper = 1 - back * 0.3 - Math.pow(back, 4) * 0.25;
      y = y * taper + back * back * 0.8;
      z *= taper;
    }
    // Front un peu aplati, menton (bas de la face) creusé.
    if (n.x > 0.55) x -= (n.x - 0.55) * 1.3;
    let radial = (noise3(n.x * 2.6 + 7, n.y * 2.6, n.z * 2.6) - 0.5) * 0.9
      + (noise3(n.x * 7.0, n.y * 7.0 + 3, n.z * 7.0) - 0.5) * 0.22;
    // Verrues éparses.
    radial += Math.pow(noise3(n.x * 15, n.y * 15, n.z * 15 + 11), 6) * 0.7;
    for (const dir of eyes) {
      const angle = Math.acos(Math.max(-1, Math.min(1, n.dot(dir))));
      // Orbite creusée, bourrelet autour, arcade plus marquée au-dessus de l'œil.
      const socket = Math.min(1, angle / 0.38);
      radial -= (1 - socket * socket) * 1.5;
      const brow = n.y > dir.y ? 1 + (n.y - dir.y) * 2.6 : 1;
      radial += Math.exp(-Math.pow((angle - 0.45) / 0.13, 2)) * 0.85 * brow;
      // Pli sous l'œil.
      if (n.y < dir.y) radial += Math.exp(-Math.pow((angle - 0.66) / 0.09, 2)) * 0.28;
    }
    const length = Math.hypot(x, y, z) || 1;
    position.setXYZ(i, x + (x / length) * radial, y + (y / length) * radial, z + (z / length) * radial);
    uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Globe oculaire (rayon 1, regard vers +Z) et paupière (sphère un peu plus grande, ouverte par le shader). */
export function eyeGeometry() {
  return new SphereGeometry(1, 40, 28);
}

export function lidGeometry() {
  return new SphereGeometry(1.08, 40, 28);
}
