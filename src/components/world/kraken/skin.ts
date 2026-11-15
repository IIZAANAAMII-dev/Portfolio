import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Peau du kraken peinte à la main dans un canvas (aucune texture sous licence) :
 * marbrures cramoisi → pourpre, taches sombres cerclées, mouchetures de chromatophores et
 * plis annulaires. Le ventre crème (côté ventouses) est mélangé dans le shader. Une seconde
 * carte porte les photophores qui s'allument la nuit. Tout se raccorde sans couture.
 */
type RGB = readonly [number, number, number];

let cache: { skin: CanvasTexture; glow: CanvasTexture } | null = null;

function random(seed: number) {
  let n = seed;
  return () => hash(n++ * 12.9898 + 78.233);
}

function rgba([r, g, b]: RGB, alpha: number) {
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Dessine une forme et ses copies décalées d'une tuile : la texture se répète sans raccord. */
function tiled(size: number, x: number, y: number, radius: number, draw: (x: number, y: number) => void) {
  for (let ox = -size; ox <= size; ox += size) {
    for (let oy = -size; oy <= size; oy += size) {
      const px = x + ox;
      const py = y + oy;
      if (px + radius < 0 || px - radius > size || py + radius < 0 || py - radius > size) continue;
      draw(px, py);
    }
  }
}

function softDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: RGB, alpha: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.55, rgba(color, alpha * 0.6));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintSkin(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const next = random(11);
  ctx.fillStyle = '#8c1d3d';
  ctx.fillRect(0, 0, size, size);

  // Grandes marbrures : pourpre, lie-de-vin, corail.
  const blotches: RGB[] = [[86, 26, 94], [112, 18, 50], [184, 58, 76], [66, 16, 64], [150, 34, 62]];
  for (let index = 0; index < 86; index++) {
    const x = next() * size;
    const y = next() * size;
    const radius = size * (0.05 + next() * 0.15);
    const color = blotches[index % blotches.length];
    const alpha = 0.3 + next() * 0.35;
    tiled(size, x, y, radius, (px, py) => softDisc(ctx, px, py, radius, color, alpha));
  }

  // Plis annulaires : fines lignes ondulées qui font le tour du bras.
  ctx.lineWidth = Math.max(1, size / 340);
  for (let ring = 0; ring < 9; ring++) {
    const base = (ring + next() * 0.4) * (size / 9);
    ctx.strokeStyle = rgba([48, 8, 30], 0.2 + next() * 0.16);
    ctx.beginPath();
    for (let x = 0; x <= size; x += size / 32) {
      const y = base + Math.sin((x / size) * Math.PI * 2 * 3 + ring) * size * 0.006;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba([214, 110, 120], 0.12);
    ctx.beginPath();
    for (let x = 0; x <= size; x += size / 32) {
      const y = base + size * 0.006 + Math.sin((x / size) * Math.PI * 2 * 3 + ring) * size * 0.006;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Taches sombres cerclées de clair.
  for (let index = 0; index < 96; index++) {
    const x = next() * size;
    const y = next() * size;
    const radius = size * (0.007 + next() * 0.016);
    const stretch = 0.65 + next() * 0.7;
    tiled(size, x, y, radius * 2, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(stretch, 1);
      softDisc(ctx, 0, 0, radius * 1.9, [196, 74, 92], 0.32);
      ctx.fillStyle = rgba([38, 8, 34], 0.82);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Mouchetures de chromatophores.
  const specks: RGB[] = [[226, 98, 104], [58, 12, 40], [246, 150, 120], [120, 20, 70]];
  for (let index = 0; index < 1100; index++) {
    const x = next() * size;
    const y = next() * size;
    const radius = size * (0.0012 + next() * 0.003);
    ctx.fillStyle = rgba(specks[index % specks.length], 0.45 + next() * 0.4);
    tiled(size, x, y, radius, (px, py) => {
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  return canvas;
}

function paintGlow(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const next = random(29);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  // Photophores en chapelets : cyan et violet, halo doux, cœur net.
  const tints: RGB[] = [[110, 236, 255], [190, 120, 255], [90, 255, 214]];
  for (let chain = 0; chain < 16; chain++) {
    let x = next() * size;
    let y = next() * size;
    const color = tints[chain % tints.length];
    const beads = 3 + Math.floor(next() * 4);
    for (let bead = 0; bead < beads; bead++) {
      const radius = size * (0.008 + next() * 0.01);
      tiled(size, x, y, radius * 3, (px, py) => {
        softDisc(ctx, px, py, radius * 3, color, 0.35);
        ctx.fillStyle = rgba(color, 1);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      x = (x + size * (0.03 + next() * 0.03)) % size;
      y = (y + size * (next() - 0.5) * 0.05 + size) % size;
    }
  }
  return canvas;
}

export function krakenSkin() {
  if (cache) return cache;
  const skin = new CanvasTexture(paintSkin(512));
  skin.colorSpace = SRGBColorSpace;
  skin.wrapS = RepeatWrapping;
  skin.wrapT = RepeatWrapping;
  skin.anisotropy = 4;
  const glow = new CanvasTexture(paintGlow(256));
  glow.colorSpace = SRGBColorSpace;
  glow.wrapS = RepeatWrapping;
  glow.wrapT = RepeatWrapping;
  cache = { skin, glow };
  return cache;
}
