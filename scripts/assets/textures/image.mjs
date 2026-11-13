/**
 * Opérations d'image sur des champs Float32Array carrés, toujours en bouclant sur les
 * bords (les textures restent tileables après flou, dérivées, etc.).
 */

export function field(size) {
  return new Float32Array(size * size);
}

/** Remplit un champ en appelant fn(u, v, x, y) pour chaque pixel. */
export function fill(size, fn) {
  const out = field(size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) out[y * size + x] = fn(x / size, v, x, y);
  }
  return out;
}

function boxBlurPass(src, dst, size, radius, horizontal) {
  const width = radius * 2 + 1;
  for (let line = 0; line < size; line++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const i = ((k % size) + size) % size;
      sum += horizontal ? src[line * size + i] : src[i * size + line];
    }
    for (let i = 0; i < size; i++) {
      if (horizontal) dst[line * size + i] = sum / width;
      else dst[i * size + line] = sum / width;
      const add = (i + radius + 1) % size;
      const remove = ((i - radius) % size + size) % size;
      sum += horizontal
        ? src[line * size + add] - src[line * size + remove]
        : src[add * size + line] - src[remove * size + line];
    }
  }
}

/** Flou quasi gaussien (trois boîtes) avec bouclage. */
export function blur(src, size, radius) {
  if (radius < 1) return Float32Array.from(src);
  const a = Float32Array.from(src);
  const b = field(size);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(a, b, size, radius, true);
    boxBlurPass(b, a, size, radius, false);
  }
  return a;
}

export function normalize(src) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of src) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = max - min || 1;
  return src.map((value) => (value - min) / range);
}

/**
 * Carte de normales OpenGL (+Y vers le haut de la texture) depuis une hauteur [0, 1].
 * `strength` : relief en pixels pour une hauteur de 1.
 */
export function normalMap(height, size, strength) {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      // three.js retourne l'image (flipY) : la ligne 0 correspond à v = 1, d'où le signe.
      const dhdu = (height[row + right] - height[row + left]) * 0.5 * strength;
      const dhdv = (height[up + x] - height[down + x]) * 0.5 * strength;
      let nx = -dhdu;
      let ny = -dhdv;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz);
      nx /= length;
      ny /= length;
      nz /= length;
      const i = (row + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

/**
 * Courbure locale : hauteur moins sa version floutée. Négatif dans les creux (joints,
 * fissures), positif sur les arêtes — la base des « edge highlights » stylisés.
 */
export function curvature(height, size, radius) {
  const smooth = blur(height, size, radius);
  return height.map((value, i) => value - smooth[i]);
}

/**
 * Pente verticale signée dans l'espace de la texture : > 0 quand la surface « regarde »
 * vers le haut de l'image (v croissant), utile pour éclaircir le dessus des pierres.
 */
export function slopeUp(height, size) {
  const out = field(size);
  for (let y = 0; y < size; y++) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) out[y * size + x] = height[down + x] - height[up + x];
  }
  return out;
}

export function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scaleRgb(color, k) {
  return [color[0] * k, color[1] * k, color[2] * k];
}

/** Rampe ombre → base → lumière, t ∈ [0, 1]. */
export function ramp(shade, base, light, t) {
  return t < 0.5 ? mixRgb(shade, base, t * 2) : mixRgb(base, light, (t - 0.5) * 2);
}

export function rgbImage(size) {
  return new Uint8Array(size * size * 3);
}

export function putRgb(image, index, color) {
  image[index * 3] = Math.max(0, Math.min(255, Math.round(color[0])));
  image[index * 3 + 1] = Math.max(0, Math.min(255, Math.round(color[1])));
  image[index * 3 + 2] = Math.max(0, Math.min(255, Math.round(color[2])));
}
