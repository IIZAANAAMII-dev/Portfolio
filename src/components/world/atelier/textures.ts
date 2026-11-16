import { CanvasTexture, SRGBColorSpace } from 'three';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { FLAGS, paintFlag } from '@/lib/livery';
import { STAMPS, type StampId } from '@/lib/logbook';

/**
 * Textures peintes de l'atelier : l'atlas des quatre pavillons du râtelier (2 × 2 cases de
 * 192 × 128) et l'atlas des écriteaux (enseigne « Atelier » en haut, étiquettes des objets
 * sous cadenas en dessous, 256 × 80 chacune, sur deux colonnes).
 */

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Atlas des pavillons ; ceux sous cadenas sont délavés, gris (on devine le motif). */
export function flagAtlas(locked: ReadonlySet<string>) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  FLAGS.forEach((flag, index) => {
    const x = (index % 2) * 192;
    const y = Math.floor(index / 2) * 128;
    if (flag.id === 'gwenn') {
      const source = gwennHaDu();
      ctx.drawImage(source.image as HTMLCanvasElement, x, y, 192, 128);
      source.dispose();
    } else {
      paintFlag(ctx, flag.id, x, y, 192, 128);
    }
    if (locked.has(flag.id)) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(x, y, 192, 128);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(120, 124, 130, 0.45)';
      ctx.fillRect(x, y, 192, 128);
      ctx.restore();
    }
  });
  return canvasTexture(canvas);
}

/** Retour à la ligne simple dans une largeur donnée. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Atlas des écriteaux. `tags` : tampons qui débloquent les objets sous cadenas, dans l'ordre
 * des emplacements ; chaque étiquette porte le symbole du tampon et son indice réel.
 */
export function signAtlas(family: string, tags: readonly StampId[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Enseigne : planche crème, cadre brun, lettres marine tracées au pinceau.
  ctx.fillStyle = '#efe2c4';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#7a4e33';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 88);
  ctx.fillStyle = '#c45b40';
  for (const x of [26, 486]) {
    ctx.beginPath();
    ctx.arc(x, 48, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f3348';
  ctx.font = `700 58px ${family}`;
  ctx.fillText('Atelier', 220, 46, 300);
  ctx.font = `600 26px ${family}`;
  ctx.fillStyle = '#7a4e33';
  ctx.fillText('peinture', 420, 34, 140);
  ctx.fillText('& pavillons', 420, 64, 150);

  tags.forEach((stamp, slot) => {
    const x = (slot % 2) * 256;
    const y = 96 + Math.floor(slot / 2) * 80;
    const info = STAMPS.find((entry) => entry.id === stamp);
    // Étiquette de kraft à coin coupé, œillet, symbole du tampon et son indice.
    ctx.fillStyle = '#dcc597';
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 4);
    ctx.lineTo(x + 252, y + 4);
    ctx.lineTo(x + 252, y + 76);
    ctx.lineTo(x + 22, y + 76);
    ctx.lineTo(x + 4, y + 58);
    ctx.lineTo(x + 4, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9c7a4a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#8a6a3c';
    ctx.beginPath();
    ctx.arc(x + 20, y + 40, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c45b40';
    ctx.font = `700 34px ${family}`;
    ctx.textAlign = 'center';
    ctx.fillText(info?.glyph ?? '?', x + 50, y + 42);
    ctx.fillStyle = '#2b2118';
    ctx.font = `600 24px ${family}`;
    ctx.textAlign = 'left';
    const lines = wrap(ctx, info?.hint ?? '', 178).slice(0, 2);
    lines.forEach((text, line) => ctx.fillText(text, x + 72, y + 40 + (line - (lines.length - 1) / 2) * 25, 178));
  });
  return canvasTexture(canvas);
}
