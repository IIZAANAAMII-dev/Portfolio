import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Petites textures peintes à la main (canvas), créées une seule fois à la demande.
 */

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return { element, ctx: element.getContext('2d')! };
}

function finish(element: HTMLCanvasElement, repeat = false) {
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

let granite: CanvasTexture | null = null;

/** Mur de pierres de granit (moellons arrondis, joints sombres) : chaumière bretonne. */
export function graniteWall() {
  if (granite) return granite;
  const { element, ctx } = canvas(256, 256);
  ctx.fillStyle = '#6f6a66';
  ctx.fillRect(0, 0, 256, 256);
  const tones = ['#b9b2aa', '#a8a39f', '#c4bcb1', '#9d9893', '#b7aa9c', '#cfc7bb'];
  let y = 0;
  let row = 0;
  while (y < 256) {
    const height = 26 + hash(row * 3.7) * 18;
    let x = -hash(row * 1.3) * 40;
    let column = 0;
    while (x < 256) {
      const width = 34 + hash(row * 11.1 + column * 2.3) * 40;
      ctx.fillStyle = tones[Math.floor(hash(row * 5.3 + column * 7.9) * tones.length)];
      const r = Math.min(width, height) * 0.38;
      ctx.beginPath();
      ctx.roundRect(x + 2.5, y + 2.5, width - 5, height - 5, r);
      ctx.fill();
      // Reflet clair sur le haut de chaque moellon.
      ctx.fillStyle = 'rgba(255, 250, 240, 0.12)';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 4, width - 14, (height - 8) * 0.4, r * 0.6);
      ctx.fill();
      // Lichen.
      if (hash(row * 2.1 + column * 4.4) > 0.8) {
        ctx.fillStyle = 'rgba(214, 196, 92, 0.45)';
        ctx.beginPath();
        ctx.arc(x + width * 0.3, y + height * 0.6, 5 + hash(column) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      x += width;
      column += 1;
    }
    y += height;
    row += 1;
  }
  granite = finish(element, true);
  return granite;
}

let screen: CanvasTexture | null = null;

/** Écran de code stylisé (aucun texte réel : des lignes colorées et une accolade). */
export function codeScreen() {
  if (screen) return screen;
  const { element, ctx } = canvas(256, 160);
  ctx.fillStyle = '#132131';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#1c2f45';
  ctx.fillRect(0, 0, 256, 18);
  ['#ff6b6b', '#ffd166', '#06d6a0'].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(12 + index * 13, 9, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  const colors = ['#ff9ad5', '#7fe3ff', '#ffe28a', '#9cf29a', '#c9b6ff'];
  for (let line = 0; line < 9; line++) {
    let x = 14 + (line % 3 === 1 ? 16 : line % 3 === 2 ? 30 : 0);
    const y = 30 + line * 14;
    const words = 2 + Math.floor(hash(line * 4.1) * 3);
    for (let word = 0; word < words; word++) {
      const width = 14 + hash(line * 7.3 + word * 3.1) * 40;
      ctx.fillStyle = colors[Math.floor(hash(line * 2.9 + word * 5.7) * colors.length)];
      ctx.fillRect(x, y, width, 6);
      x += width + 8;
    }
  }
  screen = finish(element);
  return screen;
}

let net: CanvasTexture | null = null;

/** Filet de pêche (mailles en losange, transparent entre les fils). */
export function fishingNet() {
  if (net) return net;
  const { element, ctx } = canvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(52, 74, 70, 0.95)';
  ctx.lineWidth = 3;
  for (let k = -128; k <= 256; k += 16) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + 128, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k, 128);
    ctx.lineTo(k + 128, 0);
    ctx.stroke();
  }
  net = finish(element, true);
  return net;
}

let digits: CanvasTexture | null = null;

/** Planche des chiffres 1 à 5 pour les médaillons des étapes (une case par chiffre). */
export function stepDigits(family: string) {
  if (digits) return digits;
  const { element, ctx } = canvas(640, 128);
  for (let index = 0; index < 5; index++) {
    const cx = index * 128 + 64;
    ctx.fillStyle = '#fbf3df';
    ctx.beginPath();
    ctx.arc(cx, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2f25';
    ctx.font = `700 92px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), cx, 70);
  }
  digits = finish(element);
  return digits;
}
