import { CanvasTexture, LinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Textures peintes de l'île secrète : de petits canevas dessinés une seule fois (bardage
 * écaillé, bardeaux, papier peint des Backrooms, ruban de chantier, brume…). Aucune
 * photo : des motifs simples, lisibles de loin, dans le style « jouet » du monde.
 */

const cache = new Map<string, CanvasTexture>();

function cached(key: string, make: () => CanvasTexture) {
  let texture = cache.get(key);
  if (!texture) {
    texture = make();
    cache.set(key, texture);
  }
  return texture;
}

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  return { canvas, ctx };
}

function painted(canvas: HTMLCanvasElement, repeat = true) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Dessine `draw` aux neuf positions d'un motif qui se répète (raccords invisibles). */
function wrapped(size: number, x: number, y: number, reach: number, draw: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const px = x + dx;
      const py = y + dy;
      if (px + reach < 0 || px - reach > size || py + reach < 0 || py - reach > size) continue;
      draw(px, py);
    }
  }
}

function blobPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  ctx.beginPath();
  const points = 14;
  for (let k = 0; k <= points; k++) {
    const angle = (k / points) * Math.PI * 2;
    const jitter = 0.62 + hash(seed * 13.1 + (k % points) * 1.7) * 0.55;
    const px = x + Math.cos(angle) * w * 0.5 * jitter;
    const py = y + Math.sin(angle) * h * 0.5 * jitter;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Bardage à clin, peinture vert-de-gris pâle qui s'écaille par lambeaux le long des
 * planches (le bois gris apparaît), coulures sombres. Une tuile = 4 m × 4 m.
 */
export function sidingTexture() {
  return cached('siding', () => {
    const size = 512;
    const { canvas, ctx } = surface(size, size);
    const rows = 20;
    const rowHeight = size / rows;
    for (let row = 0; row < rows; row++) {
      const tone = 0.9 + hash(row * 3.7 + 1) * 0.1;
      ctx.fillStyle = `rgb(${Math.round(186 * tone)}, ${Math.round(192 * tone)}, ${Math.round(166 * tone)})`;
      ctx.fillRect(0, row * rowHeight, size, rowHeight);
    }
    // Lambeaux : allongés le long des planches, bord de peinture retroussé plus clair.
    for (let index = 0; index < 38; index++) {
      const cx = hash(index * 7.31) * size;
      const cy = (Math.floor(hash(index * 3.17 + 2) * rows) + 0.5) * rowHeight;
      const w = 16 + hash(index * 1.93) * 70;
      const h = rowHeight * (0.55 + hash(index * 5.11) * 1.3);
      wrapped(size, cx, cy, w, (x, y) => {
        blobPath(ctx, x, y, w, h, index);
        ctx.fillStyle = hash(index * 9.7) > 0.5 ? '#7c7668' : '#8a8273';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(58, 52, 42, 0.45)';
        ctx.lineWidth = 1;
        for (let grain = 0; grain < 5; grain++) {
          const gy = y - h / 2 + ((grain + 0.5) / 5) * h;
          ctx.beginPath();
          ctx.moveTo(x - w, gy);
          ctx.lineTo(x + w, gy + (hash(index + grain * 2.3) - 0.5) * 3);
          ctx.stroke();
        }
        ctx.restore();
        blobPath(ctx, x, y, w, h, index);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(236, 240, 224, 0.8)';
        ctx.stroke();
      });
    }
    // Recouvrement des planches : ombre sous chaque clin, arête claire au-dessus.
    for (let row = 0; row < rows; row++) {
      const y = row * rowHeight;
      const shade = ctx.createLinearGradient(0, y, 0, y + 6);
      shade.addColorStop(0, 'rgba(28, 32, 26, 0.6)');
      shade.addColorStop(1, 'rgba(28, 32, 26, 0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, y, size, 6);
      ctx.fillStyle = 'rgba(255, 255, 238, 0.15)';
      ctx.fillRect(0, y + rowHeight - 2, size, 1.5);
    }
    // Coulures de rouille et de crasse.
    for (let index = 0; index < 16; index++) {
      const x = hash(index * 4.13 + 0.5) * size;
      const y = hash(index * 6.71 + 0.2) * size;
      const length = 50 + hash(index * 2.9) * 130;
      const width = 2 + hash(index * 8.3) * 5;
      const streak = ctx.createLinearGradient(0, y, 0, y + length);
      streak.addColorStop(0, `rgba(${hash(index) > 0.5 ? '96, 70, 40' : '50, 54, 44'}, 0.28)`);
      streak.addColorStop(1, 'rgba(50, 54, 44, 0)');
      ctx.fillStyle = streak;
      wrapped(size, x, y + length / 2, length, (px, py) => ctx.fillRect(px - width / 2, py - length / 2, width, length));
    }
    return painted(canvas);
  });
}

/** Bardeaux d'ardoise vert-gris, quelques manquants, de la mousse terne. Tuile = 2 m. */
export function shingleTexture() {
  return cached('shingles', () => {
    const size = 256;
    const { canvas, ctx } = surface(size, size);
    ctx.fillStyle = '#2c302e';
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const rowHeight = size / rows;
    const tabs = 6;
    const tabWidth = size / tabs;
    const palette = ['#56605b', '#4c5551', '#5f6762', '#474f4b', '#646a5f'];
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : tabWidth / 2;
      for (let tab = -1; tab <= tabs; tab++) {
        const key = row * 17.3 + tab * 3.1;
        if (hash(key + 0.7) > 0.95) continue;
        const x = tab * tabWidth + offset + 1;
        const drop = hash(key) * 3;
        ctx.fillStyle = palette[Math.floor(hash(key + 2.2) * palette.length)];
        ctx.fillRect(x, row * rowHeight + drop, tabWidth - 2, rowHeight - 2);
        ctx.fillStyle = 'rgba(20, 22, 20, 0.55)';
        ctx.fillRect(x, row * rowHeight + rowHeight - 4 + drop, tabWidth - 2, 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(x, row * rowHeight + drop, tabWidth - 2, 2);
      }
    }
    for (let index = 0; index < 9; index++) {
      const x = hash(index * 5.7) * size;
      const y = hash(index * 9.1) * size;
      const w = 18 + hash(index * 3.3) * 40;
      wrapped(size, x, y, w, (px, py) => {
        blobPath(ctx, px, py, w, w * 0.6, index + 40);
        ctx.fillStyle = 'rgba(112, 121, 76, 0.45)';
        ctx.fill();
      });
    }
    return painted(canvas);
  });
}

/**
 * Le papier peint jaune des Backrooms : fond moutarde, fines rayures verticales et une
 * colonne de petits losanges entre chaque paire, en jaune à peine plus sombre. Tuile = 0,8 m.
 */
export function wallpaperTexture() {
  return cached('wallpaper', () => {
    const size = 256;
    const { canvas, ctx } = surface(size, size);
    ctx.fillStyle = '#cdb862';
    ctx.fillRect(0, 0, size, size);
    // Marbrure très légère (papier ancien, humidité).
    for (let index = 0; index < 30; index++) {
      const x = hash(index * 3.3) * size;
      const y = hash(index * 7.7) * size;
      const r = 20 + hash(index * 1.1) * 50;
      wrapped(size, x, y, r, (px, py) => {
        const spot = ctx.createRadialGradient(px, py, 0, px, py, r);
        spot.addColorStop(0, hash(index * 2.2) > 0.5 ? 'rgba(120, 100, 30, 0.07)' : 'rgba(255, 245, 190, 0.07)');
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spot;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      });
    }
    const columns = 4;
    const step = size / columns;
    ctx.fillStyle = '#b39d47';
    for (let column = 0; column < columns; column++) {
      const x = column * step;
      ctx.fillRect(x + 2, 0, 2, size);
      ctx.fillRect(x + 8, 0, 1.5, size);
      // Losanges en chaîne, décalés d'une colonne à l'autre.
      const cx = x + step / 2 + 3;
      for (let k = 0; k < 8; k++) {
        const cy = k * (size / 8) + (column % 2 === 0 ? 0 : size / 16) + 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx + 6, cy);
        ctx.lineTo(cx, cy + 9);
        ctx.lineTo(cx - 6, cy);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx - 1, cy + 13, 2, 2);
      }
    }
    return painted(canvas);
  });
}

/** Ruban de chantier : bandes noires obliques sur jaune vif. Tuile = 0,5 m de ruban. */
export function tapeTexture() {
  return cached('tape', () => {
    const { canvas, ctx } = surface(128, 32);
    ctx.fillStyle = '#f2cb22';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#17181a';
    for (let k = -1; k < 5; k++) {
      const x = k * 32;
      ctx.beginPath();
      ctx.moveTo(x, 32);
      ctx.lineTo(x + 14, 32);
      ctx.lineTo(x + 46, 0);
      ctx.lineTo(x + 32, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 30, 128, 2);
    return painted(canvas);
  });
}

/** Étiquette de cassette VHS, titre écrit au feutre (police manuscrite du site). */
export function labelTexture(title: string, family: string) {
  return cached(`label:${title}:${family}`, () => {
    const { canvas, ctx } = surface(512, 160);
    ctx.fillStyle = '#efe8d4';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#e4b51f';
    ctx.fillRect(0, 0, 30, 160);
    ctx.strokeStyle = 'rgba(80, 110, 160, 0.35)';
    ctx.lineWidth = 2;
    for (const y of [54, 98, 142]) {
      ctx.beginPath();
      ctx.moveTo(44, y);
      ctx.lineTo(496, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#1e1d24';
    ctx.font = `500 76px ${family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 52, 92, 430);
    ctx.font = `500 34px ${family}`;
    ctx.fillStyle = '#b8352c';
    ctx.fillText('▶ ne pas effacer', 300, 136, 190);
    return painted(canvas, false);
  });
}

/**
 * Bruit de valeur périodique (fbm), en niveaux de gris : sert à la brume. Les mailles
 * bouclent sur la tuile, la texture se répète donc sans couture.
 */
export function noiseTexture() {
  return cached('noise', () => {
    const size = 128;
    const { canvas, ctx } = surface(size, size);
    const image = ctx.createImageData(size, size);
    const octaves = [
      { period: 4, weight: 0.5 },
      { period: 8, weight: 0.28 },
      { period: 16, weight: 0.14 },
      { period: 32, weight: 0.08 },
    ];
    const lattice = (period: number, i: number, j: number) => hash(((i % period) + period) % period * 57.13 + (((j % period) + period) % period) * 13.77 + period * 3.31);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        for (const { period, weight } of octaves) {
          const fx = (x / size) * period;
          const fy = (y / size) * period;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          let tx = fx - ix;
          let ty = fy - iy;
          tx = tx * tx * (3 - 2 * tx);
          ty = ty * ty * (3 - 2 * ty);
          const a = lattice(period, ix, iy);
          const b = lattice(period, ix + 1, iy);
          const c = lattice(period, ix, iy + 1);
          const d = lattice(period, ix + 1, iy + 1);
          value += ((a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty) * weight;
        }
        const offset = (y * size + x) * 4;
        const byte = Math.round(Math.min(1, Math.max(0, value)) * 255);
        image.data[offset] = byte;
        image.data[offset + 1] = byte;
        image.data[offset + 2] = byte;
        image.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  });
}

/** Tache de lumière douce (sol éclairé par un néon, par la faille). */
export function poolTexture() {
  return cached('pool', () => {
    const { canvas, ctx } = surface(64, 64);
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = NoColorSpace;
    return texture;
  });
}
