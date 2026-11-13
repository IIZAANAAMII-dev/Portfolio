import { clamp01, fbm, fbm01, hashInt, lerp, mod, rand, smoothstep, worley } from './noise.mjs';
import { blur, curvature, field, hexToRgb, mixRgb, normalize, putRgb, ramp, rgbImage, scaleRgb, slopeUp } from './image.mjs';

/**
 * Générateurs de matériaux stylisés « façon Bell Island ».
 *
 * Chaque générateur construit d'abord un champ de hauteur (la forme : planches, blocs,
 * mottes), puis en déduit la couleur, la rugosité et l'occlusion à partir de la courbure
 * (creux sombres, arêtes éclaircies), comme le ferait un graphe Substance Designer.
 * Tout est périodique : les textures se répètent sans couture.
 *
 * Retour commun : { height, color (RGB 8 bits), roughness, ao, metallic?, normalStrength }
 */

function palette(def) {
  return { shade: hexToRgb(def.shade), base: hexToRgb(def.base), light: hexToRgb(def.light) };
}

function finish(size, height, colorAt, roughnessAt, { aoRadius = 6, aoStrength = 2.2, curveRadius = 3, metallicAt } = {}) {
  const curve = curvature(height, size, curveRadius);
  const wide = curvature(height, size, aoRadius);
  const slope = slopeUp(height, size);
  const color = rgbImage(size);
  const roughness = field(size);
  const ao = field(size);
  const metallic = metallicAt ? field(size) : null;
  for (let i = 0; i < size * size; i++) {
    const context = { i, x: i % size, y: Math.floor(i / size), curve: curve[i], wide: wide[i], slope: slope[i], height: height[i] };
    putRgb(color, i, colorAt(context));
    roughness[i] = clamp01(roughnessAt(context));
    ao[i] = clamp01(1 + Math.min(0, wide[i]) * aoStrength * 4 + Math.min(0, curve[i]) * aoStrength * 2);
    if (metallic) metallic[i] = clamp01(metallicAt(context));
  }
  return { height, color, roughness, ao, metallic };
}

/* ------------------------------------------------------------------------------------ */
/* Bois                                                                                 */
/* ------------------------------------------------------------------------------------ */

/**
 * Planches (ou bois massif si `seams: false`) : lames décalées, chanfreins, fibres
 * sculptées en lignes nettes, nœuds, fentes, peinture délavée sur certaines lames.
 */
export function wood(size, def, options = {}) {
  const {
    rows = 6,
    splits = 2,
    seams = true,
    gap = 2.5,
    bevel = 7,
    lines = 5,
    carve = 0.11,
    knots = 3,
    cracks = 0.35,
    weathering = 0,
    secondary = null,
    seed = 1,
  } = options;
  const p = palette(def);
  const secondaryColor = secondary ? hexToRgb(secondary.color) : null;
  const boardH = size / rows;
  const height = field(size);
  const meta = new Float32Array(size * size * 3); // tone, carve, paint

  const knotList = Array.from({ length: knots }, (_, k) => ({
    u: rand(k, 3, seed),
    v: rand(k, 7, seed),
    r: 0.018 + rand(k, 11, seed) * 0.02,
  }));

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const vr = rowF - row;
    const rowOffset = rand(row, 1, seed);
    const pieces = seams ? 1 + (hashInt(row, 2, seed) % splits) : 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const along = mod(u - rowOffset, 1) * pieces;
      const board = Math.floor(along);
      const us = along - board;
      const id = rand(row * 13 + board, 5, seed);
      const boardLength = size / pieces;

      let profile = 1;
      if (seams) {
        const dx = Math.min(us, 1 - us) * boardLength;
        const dy = Math.min(vr, 1 - vr) * boardH;
        const d = Math.min(dx, dy);
        profile = d < gap ? 0 : smoothstep(gap, gap + bevel, d) * 0.9 + 0.1;
      }

      const grain = fbm(u, v + id * 0.37, { scale: 2, aspectX: 1, aspectY: 6, octaves: 4, seed: seed + 17 });
      const fine = fbm(u, v + id * 0.71, { scale: 8, aspectX: 1, aspectY: 10, octaves: 3, seed: seed + 29 });
      // Lignes de fibres sculptées : franches, légèrement ondulées.
      const t = (seams ? vr : v * rows) * lines + grain * 1.4 + id * 3.1;
      const lineDistance = Math.abs((t - Math.floor(t)) - 0.5);
      let carveMask = 1 - smoothstep(0.035, 0.085, lineDistance);

      // Nœuds : anneaux elliptiques.
      for (const knot of knotList) {
        let du = u - knot.u;
        let dv = v - knot.v;
        du -= Math.round(du);
        dv -= Math.round(dv);
        const e = Math.sqrt((du * 0.45) ** 2 + dv * dv) / knot.r;
        if (e < 2.4) {
          const rings = Math.abs((e * 2.2 - Math.floor(e * 2.2)) - 0.5);
          carveMask = Math.max(carveMask, (1 - smoothstep(0.06, 0.14, rings)) * (1 - smoothstep(1.4, 2.4, e)));
        }
      }

      // Fentes en bout de lame et fissures longitudinales.
      const crackField = worley(u, v, { cellsX: 3, cellsY: Math.max(4, rows * 2), jitter: 0.8, seed: seed + 41 });
      const crack = (1 - smoothstep(0.0, 0.05, crackField.f2 - crackField.f1)) * smoothstep(0.55, 0.8, fbm01(u, v, { scale: 3, seed: seed + 53 }));
      const crackDepth = crack * cracks;

      const boardHeight = 0.72 + id * 0.16 + (us - 0.5) * (rand(row, board, seed + 3) - 0.5) * 0.08;
      const h = profile * (boardHeight + grain * 0.05 + fine * 0.02 - carveMask * carve - crackDepth * 0.25);
      height[y * size + x] = h;
      const index = (y * size + x) * 3;
      meta[index] = id;
      meta[index + 1] = Math.max(carveMask * 0.8, crack);
      meta[index + 2] = secondary && rand(row * 7 + board, 9, seed) < secondary.chance
        ? secondary.amount * smoothstep(0.35, 0.65, fbm01(u, v, { scale: 6, seed: seed + 61 }))
        : 0;
    }
  }

  return {
    ...finish(
      size,
      height,
      ({ i, curve, slope, height: h }) => {
        const tone = meta[i * 3];
        const carved = meta[i * 3 + 1];
        const paint = meta[i * 3 + 2];
        let color = ramp(p.shade, p.base, p.light, clamp01(0.42 + (tone - 0.5) * 0.5 + slope * 2.5));
        if (weathering > 0) {
          const grey = (color[0] + color[1] + color[2]) / 3;
          color = mixRgb(color, [grey * 1.05, grey * 1.05, grey * 1.08], weathering * 0.5);
        }
        if (paint > 0) color = mixRgb(color, scaleRgb(secondaryColor, 0.75 + tone * 0.4), paint);
        color = mixRgb(color, p.shade, carved * 0.55);
        color = mixRgb(color, p.light, clamp01(curve * 9) * 0.55);
        color = mixRgb(color, scaleRgb(p.shade, 0.6), clamp01(-curve * 12) * 0.6 + (h < 0.05 ? 0.7 : 0));
        return color;
      },
      ({ i }) => 0.78 + meta[i * 3 + 1] * 0.12 + weathering * 0.06,
      { aoRadius: 5, aoStrength: 2.4 },
    ),
    normalStrength: 7,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Roche                                                                                */
/* ------------------------------------------------------------------------------------ */

/**
 * Falaises en blocs : cellules de Voronoï étirées en strates, chanfreins, éclats,
 * dessus des pierres éclaircis (« top color »), mousse et balanes optionnelles.
 */
export function stone(size, def, options = {}) {
  const {
    cellsX = 5,
    cellsY = 8,
    bevel = 0.16,
    chips = 0.07,
    top = null,
    topAmount = 0.6,
    moss = null,
    mossAmount = 0,
    barnacles = 0,
    seed = 3,
  } = options;
  const p = palette(def);
  const topColor = top ? hexToRgb(top) : p.light;
  const mossColor = moss ? hexToRgb(moss) : null;
  const height = field(size);
  const tones = new Float32Array(size * size);
  const barnacleMask = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warpU = u + fbm(u, v, { scale: 3, octaves: 2, seed: seed + 5 }) * 0.025;
      const warpV = v + fbm(u, v, { scale: 3, octaves: 2, seed: seed + 9 }) * 0.025;
      const cell = worley(mod(warpU, 1), mod(warpV, 1), { cellsX, cellsY, jitter: 0.85, seed });
      const edge = cell.f2 - cell.f1;
      const profile = smoothstep(0.0, bevel, edge);
      const lean = (cell.py - warpV * cellsY) * (rand(Math.floor(cell.id * 1e6), 2, seed) - 0.5) * 0.3;
      const chip = worley(u, v, { cellsX: cellsX * 6, cellsY: cellsY * 4, jitter: 1, seed: seed + 13 });
      const detail = fbm(u, v, { scale: 6, octaves: 4, seed: seed + 21 });
      let h = profile * (0.62 + cell.id * 0.28 + lean + detail * 0.06 - chip.f1 * chips);
      if (barnacles > 0) {
        const dots = worley(u, v, { cellsX: 64, cellsY: 64, jitter: 1, seed: seed + 31 });
        const mask = smoothstep(0.45, 0.62, fbm01(u, v, { scale: 4, seed: seed + 37 }));
        const bump = (1 - smoothstep(0.12, 0.3, dots.f1)) * mask * barnacles;
        h += bump * 0.08 * profile;
        barnacleMask[y * size + x] = bump;
      }
      height[y * size + x] = h;
      tones[y * size + x] = cell.id;
    }
  }

  const mossNoise = mossColor
    ? Float32Array.from({ length: size * size }, (_, i) => fbm01((i % size) / size, Math.floor(i / size) / size, { scale: 5, octaves: 4, seed: seed + 47 }))
    : null;

  return {
    ...finish(
      size,
      height,
      ({ i, curve, wide, slope, height: h }) => {
        const tone = tones[i];
        let color = ramp(p.shade, p.base, p.light, clamp01(0.38 + (tone - 0.5) * 0.45));
        // Dessus des blocs (pente tournée vers le haut de la texture) : couleur de sommet.
        color = mixRgb(color, topColor, clamp01(slope * 14) * topAmount);
        color = mixRgb(color, p.light, clamp01(curve * 10) * 0.5);
        color = mixRgb(color, scaleRgb(p.shade, 0.55), clamp01(-wide * 7) * 0.7 + (h < 0.04 ? 0.6 : 0));
        if (mossNoise) {
          const m = smoothstep(0.52, 0.62, mossNoise[i] + clamp01(slope * 6) * 0.25 - clamp01(curve * 8) * 0.2) * mossAmount;
          color = mixRgb(color, scaleRgb(mossColor, 0.8 + mossNoise[i] * 0.5), m);
        }
        if (barnacleMask[i] > 0) color = mixRgb(color, [214, 206, 196], clamp01(barnacleMask[i] * 1.4));
        return color;
      },
      ({ i, curve }) => 0.84 + clamp01(-curve * 6) * 0.1 - barnacleMask[i] * 0.1,
      { aoRadius: 9, aoStrength: 2.2, curveRadius: 3 },
    ),
    normalStrength: 9,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Sols                                                                                 */
/* ------------------------------------------------------------------------------------ */

/** Herbe stylisée : mottes douces, mouchetures, touffes plus claires. */
export function grass(size, def, options = {}) {
  const { dirt = null, dirtAmount = 0, pebbles = 0, seed = 5 } = options;
  const p = palette(def);
  const dirtColor = dirt ? hexToRgb(dirt) : null;
  const height = field(size);
  const meta = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const clumps = fbm01(u, v, { scale: 6, octaves: 4, seed });
      const tufts = worley(u, v, { cellsX: 22, cellsY: 22, jitter: 1, seed: seed + 3 });
      const tuft = 1 - smoothstep(0.0, 0.55, tufts.f1);
      const blades = fbm(u, v, { scale: 48, aspectX: 0.5, aspectY: 1.5, octaves: 2, seed: seed + 7 });
      let dirtMask = 0;
      if (dirtColor) dirtMask = smoothstep(0.58, 0.66, fbm01(u, v, { scale: 3, octaves: 4, seed: seed + 11 })) * dirtAmount;
      let pebble = 0;
      if (pebbles > 0) {
        const cell = worley(u, v, { cellsX: 36, cellsY: 36, jitter: 1, seed: seed + 19 });
        pebble = (1 - smoothstep(0.18, 0.32, cell.f1)) * (cell.id < pebbles ? 1 : 0) * (dirtColor ? dirtMask : 1);
      }
      const h = (0.55 + clumps * 0.25 + tuft * 0.14 * (1 - dirtMask) + blades * 0.04 + pebble * 0.18) * (1 - dirtMask * 0.25);
      height[y * size + x] = h;
      const index = (y * size + x) * 3;
      meta[index] = clumps;
      meta[index + 1] = dirtMask;
      meta[index + 2] = pebble;
    }
  }
  return {
    ...finish(
      size,
      height,
      ({ i, curve, slope }) => {
        const clumps = meta[i * 3];
        const dirtMask = meta[i * 3 + 1];
        const pebble = meta[i * 3 + 2];
        let color = ramp(p.shade, p.base, p.light, clamp01(0.3 + clumps * 0.55 + slope * 3 + curve * 6));
        if (dirtColor) {
          const dirtShade = ramp(scaleRgb(dirtColor, 0.6), dirtColor, scaleRgb(dirtColor, 1.3), clamp01(0.45 + curve * 8));
          color = mixRgb(color, dirtShade, dirtMask);
        }
        if (pebble > 0) color = mixRgb(color, [176, 160, 136], pebble * 0.85);
        return color;
      },
      ({ i }) => 0.9 + meta[i * 3 + 1] * 0.05 - meta[i * 3 + 2] * 0.15,
      { aoRadius: 6, aoStrength: 1.6 },
    ),
    normalStrength: 6,
  };
}

/** Sable : grain fin, rides de vent, coquillages et galets clairsemés. */
export function sand(size, def, options = {}) {
  const { ripples = 0.6, pebbles = 0.08, seed = 7 } = options;
  const p = palette(def);
  const height = field(size);
  const meta = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbm(u, v, { scale: 2, octaves: 3, seed: seed + 3 });
      const ripple = Math.sin((v * 14 + warp * 1.6 + u * 2) * Math.PI * 2) * 0.5 + 0.5;
      const grain = fbm(u, v, { scale: 64, octaves: 2, seed: seed + 5 });
      const dunes = fbm01(u, v, { scale: 3, octaves: 3, seed: seed + 9 });
      const cell = worley(u, v, { cellsX: 28, cellsY: 28, jitter: 1, seed: seed + 13 });
      const pebble = (1 - smoothstep(0.2, 0.34, cell.f1)) * (cell.id < pebbles ? 1 : 0);
      height[y * size + x] = 0.5 + ripple * 0.06 * ripples + grain * 0.03 + dunes * 0.12 + pebble * 0.2;
      meta[(y * size + x) * 2] = dunes + grain * 0.2;
      meta[(y * size + x) * 2 + 1] = pebble * (0.6 + cell.id * 4);
    }
  }
  return {
    ...finish(
      size,
      height,
      ({ i, curve, slope }) => {
        let color = ramp(p.shade, p.base, p.light, clamp01(0.45 + (meta[i * 2] - 0.5) * 0.5 + slope * 6 + curve * 4));
        const pebble = meta[i * 2 + 1];
        if (pebble > 0) color = mixRgb(color, pebble > 0.85 ? [238, 226, 208] : [150, 128, 104], clamp01(pebble));
        return color;
      },
      () => 0.93,
      { aoRadius: 5, aoStrength: 1.2 },
    ),
    normalStrength: 5,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Mur enduit sur briques                                                               */
/* ------------------------------------------------------------------------------------ */

export function plaster(size, def, options = {}) {
  const { brick = '#bf5f44', mortar = '#8a8072', moss = '#6d7a3c', coverage = 0.62, rows = 9, seed = 9 } = options;
  const p = palette(def);
  const brickColor = hexToRgb(brick);
  const mortarColor = hexToRgb(mortar);
  const mossColor = hexToRgb(moss);
  const height = field(size);
  const meta = new Float32Array(size * size * 3);
  const brickH = size / rows;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const vr = v * rows - row;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cols = Math.round(rows / 2);
      const along = mod(u * cols + (row % 2) * 0.5, cols);
      const bx = Math.floor(along);
      const ub = along - bx;
      const d = Math.min(Math.min(ub, 1 - ub) * (size / cols), Math.min(vr, 1 - vr) * brickH);
      const brickProfile = smoothstep(1.5, 5, d);
      const id = rand(bx, row, seed);
      const cover = fbm01(u, v, { scale: 3, octaves: 5, seed: seed + 3 });
      const plasterMask = smoothstep(1 - coverage - 0.03, 1 - coverage + 0.03, cover);
      const lumps = fbm(u, v, { scale: 10, octaves: 3, seed: seed + 7 });
      const brickH01 = 0.35 + brickProfile * (0.3 + id * 0.08);
      const plasterH = 0.82 + lumps * 0.04;
      height[y * size + x] = lerp(brickH01, plasterH, plasterMask);
      const index = (y * size + x) * 3;
      meta[index] = plasterMask;
      meta[index + 1] = id + (1 - brickProfile) * 2;
      meta[index + 2] = cover;
    }
  }
  return {
    ...finish(
      size,
      height,
      ({ i, curve, wide }) => {
        const plasterMask = meta[i * 3];
        const brickInfo = meta[i * 3 + 1];
        const cover = meta[i * 3 + 2];
        const isMortar = brickInfo > 1.5;
        const brickTone = ramp(scaleRgb(brickColor, 0.65), brickColor, scaleRgb(brickColor, 1.2), clamp01((brickInfo % 1) * 0.8 + 0.1));
        const under = isMortar ? mortarColor : brickTone;
        let color = ramp(p.shade, p.base, p.light, clamp01(0.62 + (cover - 0.5) * 0.5 + curve * 6));
        color = mixRgb(under, color, plasterMask);
        const moss = smoothstep(0.35, 0.2, cover) * clamp01(-wide * 10 + 0.4);
        color = mixRgb(color, mossColor, clamp01(moss));
        color = mixRgb(color, scaleRgb(p.shade, 0.7), clamp01(-wide * 6) * 0.5);
        return color;
      },
      ({ i }) => 0.86 + (1 - meta[i * 3]) * 0.06,
      { aoRadius: 7, aoStrength: 2 },
    ),
    normalStrength: 7,
  };
}

/* ------------------------------------------------------------------------------------ */
/* Fonte rivetée                                                                        */
/* ------------------------------------------------------------------------------------ */

export function iron(size, def, options = {}) {
  const { rust = '#8a5530', rustAmount = 0.45, rows = 2, seed = 11 } = options;
  const p = palette(def);
  const rustColor = hexToRgb(rust);
  const height = field(size);
  const meta = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const vr = v * rows - row;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cols = 2;
      const along = mod(u * cols + (row % 2) * 0.5, cols);
      const px = Math.floor(along);
      const up = along - px;
      const dSeam = Math.min(Math.min(up, 1 - up) * (size / cols), Math.min(vr, 1 - vr) * (size / rows));
      const seam = smoothstep(1.5, 4, dSeam);
      // Rivets alignés le long des joints.
      const rivetU = mod(u * 24, 1) - 0.5;
      const nearSeamH = Math.min(vr, 1 - vr) * (size / rows);
      const rivet = (1 - smoothstep(0.18, 0.3, Math.hypot(rivetU, (nearSeamH - 9) / (size / 24)))) * (nearSeamH < 16 ? 1 : 0);
      const dents = fbm(u, v, { scale: 6, octaves: 3, seed: seed + 3 });
      const rustNoise = fbm01(u, v, { scale: 5, octaves: 5, seed: seed + 7 });
      const rustMask = smoothstep(1 - rustAmount, 1 - rustAmount + 0.12, rustNoise + (1 - seam) * 0.25);
      height[y * size + x] = 0.45 + seam * 0.25 + dents * 0.03 + rivet * 0.22 + rustMask * 0.03;
      meta[(y * size + x) * 2] = rustMask;
      meta[(y * size + x) * 2 + 1] = rand(px, row, seed);
    }
  }
  return {
    ...finish(
      size,
      height,
      ({ i, curve, wide }) => {
        const rustMask = meta[i * 2];
        let color = ramp(p.shade, p.base, p.light, clamp01(0.42 + (meta[i * 2 + 1] - 0.5) * 0.25 + curve * 10));
        color = mixRgb(color, ramp(scaleRgb(rustColor, 0.6), rustColor, scaleRgb(rustColor, 1.25), clamp01(0.5 + curve * 6)), rustMask);
        color = mixRgb(color, scaleRgb(p.shade, 0.5), clamp01(-wide * 8) * 0.6);
        return color;
      },
      ({ i, curve }) => 0.36 + meta[i * 2] * 0.5 + clamp01(-curve * 8) * 0.1,
      { aoRadius: 6, aoStrength: 2, metallicAt: ({ i }) => 1 - meta[i * 2] },
    ),
    normalStrength: 6,
  };
}

/** Normalisation finale de la hauteur, exportée pour les cartes d'aperçu. */
export function heightPreview(height) {
  return normalize(height);
}

export { blur };
