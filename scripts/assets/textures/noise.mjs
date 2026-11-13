/**
 * Bruits procéduraux TILEABLES : toutes les fonctions prennent une période (en cellules)
 * et bouclent exactement sur celle-ci, si bien qu'une texture générée sur [0, période[
 * se répète sans couture.
 */

export function hashInt(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function rand(x, y, seed) {
  return hashInt(x, y, seed) / 4294967296;
}

export function mod(a, n) {
  return ((a % n) + n) % n;
}

const GRADIENTS = new Float32Array(512);
for (let i = 0; i < 256; i++) {
  const angle = (i / 256) * Math.PI * 2;
  GRADIENTS[i * 2] = Math.cos(angle);
  GRADIENTS[i * 2 + 1] = Math.sin(angle);
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Bruit de gradient (Perlin) périodique, résultat ≈ [-1, 1]. */
export function perlin(x, y, periodX, periodY, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ax = mod(x0, periodX);
  const ay = mod(y0, periodY);
  const bx = mod(x0 + 1, periodX);
  const by = mod(y0 + 1, periodY);
  const g00 = (hashInt(ax, ay, seed) & 255) * 2;
  const g10 = (hashInt(bx, ay, seed) & 255) * 2;
  const g01 = (hashInt(ax, by, seed) & 255) * 2;
  const g11 = (hashInt(bx, by, seed) & 255) * 2;
  const n00 = GRADIENTS[g00] * fx + GRADIENTS[g00 + 1] * fy;
  const n10 = GRADIENTS[g10] * (fx - 1) + GRADIENTS[g10 + 1] * fy;
  const n01 = GRADIENTS[g01] * fx + GRADIENTS[g01 + 1] * (fy - 1);
  const n11 = GRADIENTS[g11] * (fx - 1) + GRADIENTS[g11 + 1] * (fy - 1);
  const u = fade(fx);
  const v = fade(fy);
  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);
  return (nx0 + v * (nx1 - nx0)) * 1.4142;
}

/**
 * fBm périodique. `u`, `v` ∈ [0, 1[ couvrent la texture ; `scale` = nombre de cellules
 * sur la largeur (entier), `aspect` étire le bruit (fibres de bois : aspect > 1).
 */
export function fbm(u, v, { scale = 4, aspectX = 1, aspectY = 1, octaves = 4, gain = 0.5, seed = 0 } = {}) {
  let sum = 0;
  let amplitude = 1;
  let norm = 0;
  let periodX = Math.max(1, Math.round(scale * aspectX));
  let periodY = Math.max(1, Math.round(scale * aspectY));
  for (let octave = 0; octave < octaves; octave++) {
    sum += perlin(u * periodX, v * periodY, periodX, periodY, seed + octave * 101) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    periodX *= 2;
    periodY *= 2;
  }
  return sum / norm;
}

/** fBm ramené dans [0, 1]. */
export function fbm01(u, v, options) {
  return Math.min(1, Math.max(0, fbm(u, v, options) * 0.75 + 0.5));
}

/**
 * Voronoï (Worley) périodique : distances au plus proche (f1) et au second (f2) point,
 * identifiant aléatoire de la cellule, et coordonnées du point le plus proche.
 * `stretchX` > 1 allonge les cellules horizontalement (strates de falaise).
 */
export function worley(u, v, { cellsX = 8, cellsY = 8, jitter = 0.9, seed = 0 } = {}) {
  const x = u * cellsX;
  const y = v * cellsY;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = Infinity;
  let f2 = Infinity;
  let id = 0;
  let px = 0;
  let py = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = mod(cx, cellsX);
      const wy = mod(cy, cellsY);
      const h = hashInt(wx, wy, seed);
      const ox = 0.5 + (((h & 0xffff) / 65535) - 0.5) * jitter;
      const oy = 0.5 + ((((h >>> 16) & 0xffff) / 65535) - 0.5) * jitter;
      const fx = cx + ox - x;
      const fy = cy + oy - y;
      const d = Math.sqrt(fx * fx + fy * fy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = h;
        px = cx + ox;
        py = cy + oy;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id: id / 4294967296, px, py };
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
