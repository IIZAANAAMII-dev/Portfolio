import { site } from '@/data/site';

/**
 * Tirage de la carte postale (canvas 2D, aucune dépendance) : papier crème grainé, photo
 * réchauffée et vignettée, timbre dentelé « Poste maritime » (un petit phare au soleil
 * couchant), oblitération à l'encre bleue — « Archipel de Kyliann », le lieu, la date —
 * et la légende manuscrite. Format paysage, ou portrait si l'écran l'est.
 */

export interface PostcardInfo {
  /** Lieu imprimé sur l'oblitération et la légende (« Île Compétences », « En mer »). */
  place: string;
  date: Date;
  /** Moment de la journée (« à l'heure dorée »…). */
  mood: string;
}

const PAPER = '#f3ead6';
const INK = '#3b2f25';
const POST_INK = 'rgba(36, 40, 96, 0.82)';

function family(variable: string, fallback: string) {
  try {
    const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
    return value ? `${value}, ${fallback}` : fallback;
  } catch {
    return fallback;
  }
}

async function ready(fonts: string[]) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.race([
    Promise.all(fonts.map((font) => document.fonts.load(font).catch(() => []))),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

/** Hasard déterministe : le grain du papier est le même d'une carte à l'autre. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Canvas tenus en mémoire vive (`willReadFrequently`) : un seul tirage, aucune raison de
 * passer par le GPU — et la composition reste rapide même quand le rendu WebGL sature tout.
 */
function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D indisponible');
  return { canvas, context };
}

/** Motif de bruit (grain du papier, manques d'encre) : une tuile de pixels, un seul remplissage. */
function noise(context: CanvasRenderingContext2D, size: number, seed: number, rgb: [number, number, number], density: number, alpha: [number, number], scale: number) {
  const tile = canvas2d(size, size);
  const image = tile.context.createImageData(size, size);
  const random = seeded(seed);
  for (let index = 0; index < size * size; index++) {
    if (random() > density) continue;
    const offset = index * 4;
    image.data[offset] = rgb[0];
    image.data[offset + 1] = rgb[1];
    image.data[offset + 2] = rgb[2];
    image.data[offset + 3] = Math.round((alpha[0] + random() * (alpha[1] - alpha[0])) * 255);
  }
  tile.context.putImageData(image, 0, 0);
  const pattern = context.createPattern(tile.canvas, 'repeat');
  if (pattern && scale !== 1) pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
  return pattern;
}

function spaced(context: CanvasRenderingContext2D, spacing: string) {
  if ('letterSpacing' in context) (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing;
}

/** Texte en arc (haut : lu dans le sens horaire ; bas : lu de gauche à droite, à l'endroit). */
function arcText(context: CanvasRenderingContext2D, text: string, radius: number, top: boolean, gap: number) {
  const chars = [...text];
  const widths = chars.map((char) => context.measureText(char).width + gap);
  const total = widths.reduce((sum, width) => sum + width, 0) / radius;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let angle = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  chars.forEach((char, index) => {
    const half = widths[index] / 2 / radius;
    angle += top ? half : -half;
    context.save();
    context.rotate(top ? angle + Math.PI / 2 : angle - Math.PI / 2);
    context.fillText(char, 0, top ? -radius : radius);
    context.restore();
    angle += top ? half : -half;
  });
}

function drawStamp(display: string, mono: string) {
  const width = 236;
  const height = 290;
  const { canvas, context } = canvas2d(width, height);
  context.fillStyle = '#fbf7ee';
  context.fillRect(0, 0, width, height);
  // Dentelure : demi-disques découpés le long des bords.
  context.globalCompositeOperation = 'destination-out';
  const bite = 8.5;
  const step = 23;
  context.beginPath();
  for (let x = (width % step) / 2 + step / 2; x < width; x += step) {
    context.moveTo(x + bite, 0);
    context.arc(x, 0, bite, 0, Math.PI * 2);
    context.moveTo(x + bite, height);
    context.arc(x, height, bite, 0, Math.PI * 2);
  }
  for (let y = (height % step) / 2 + step / 2; y < height; y += step) {
    context.moveTo(bite, y);
    context.arc(0, y, bite, 0, Math.PI * 2);
    context.moveTo(width + bite, y);
    context.arc(width, y, bite, 0, Math.PI * 2);
  }
  context.fill();
  context.globalCompositeOperation = 'source-over';

  // Vignette : ciel couchant, soleil, mer, phare breton sur son rocher.
  const x0 = 22;
  const y0 = 22;
  const w = width - 44;
  const h = height - 92;
  const sky = context.createLinearGradient(0, y0, 0, y0 + h);
  sky.addColorStop(0, '#ffe2b0');
  sky.addColorStop(0.55, '#f6a37c');
  sky.addColorStop(1, '#d9707a');
  context.fillStyle = sky;
  context.fillRect(x0, y0, w, h);
  const horizon = y0 + h * 0.64;
  context.fillStyle = '#fff3d4';
  context.beginPath();
  context.arc(x0 + w * 0.64, horizon - 4, w * 0.19, Math.PI, 0);
  context.fill();
  context.fillStyle = '#2d8797';
  context.fillRect(x0, horizon, w, y0 + h - horizon);
  context.strokeStyle = 'rgba(190, 240, 238, 0.85)';
  context.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    const y = horizon + 10 + row * 13;
    context.beginPath();
    for (let x = x0 + 6 + row * 9; x < x0 + w - 8; x += 22) {
      context.moveTo(x, y);
      context.quadraticCurveTo(x + 5.5, y - 4, x + 11, y);
    }
    context.stroke();
  }
  // Rocher et phare.
  context.fillStyle = INK;
  context.beginPath();
  context.moveTo(x0, horizon + 18);
  context.lineTo(x0 + w * 0.12, horizon - 6);
  context.lineTo(x0 + w * 0.36, horizon - 10);
  context.lineTo(x0 + w * 0.46, horizon + 20);
  context.lineTo(x0, horizon + 26);
  context.closePath();
  context.fill();
  const lx = x0 + w * 0.25;
  const top = y0 + h * 0.2;
  const bottom = horizon - 8;
  const towerTop = 9;
  const towerBottom = 16;
  const bands = 4;
  for (let band = 0; band < bands; band++) {
    const a = band / bands;
    const b = (band + 1) / bands;
    const ya = top + (bottom - top) * a;
    const yb = top + (bottom - top) * b;
    const wa = towerTop + (towerBottom - towerTop) * a;
    const wb = towerTop + (towerBottom - towerTop) * b;
    context.fillStyle = band % 2 === 0 ? '#fbf7ee' : '#c8553d';
    context.beginPath();
    context.moveTo(lx - wa, ya);
    context.lineTo(lx + wa, ya);
    context.lineTo(lx + wb, yb);
    context.lineTo(lx - wb, yb);
    context.closePath();
    context.fill();
  }
  context.fillStyle = '#ffd36b';
  context.fillRect(lx - 7, top - 13, 14, 13);
  context.fillStyle = INK;
  context.beginPath();
  context.moveTo(lx - 11, top - 13);
  context.lineTo(lx, top - 24);
  context.lineTo(lx + 11, top - 13);
  context.closePath();
  context.fill();
  context.fillStyle = 'rgba(255, 228, 150, 0.55)';
  context.beginPath();
  context.moveTo(lx + 6, top - 9);
  context.lineTo(x0 + w, top - 26);
  context.lineTo(x0 + w, top + 8);
  context.closePath();
  context.fill();
  context.strokeStyle = INK;
  context.lineWidth = 1.5;
  context.strokeRect(x0 + 0.75, y0 + 0.75, w - 1.5, h - 1.5);

  context.fillStyle = INK;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.font = `800 40px ${display}`;
  spaced(context, '2px');
  context.fillText('ARCHIPEL', width / 2, height - 36);
  context.font = `500 13px ${mono}`;
  spaced(context, '3px');
  context.fillText('POSTE MARITIME', width / 2, height - 16);
  return canvas;
}

function drawPostmark(info: PostcardInfo, mono: string, size: number) {
  const radius = size * 0.5;
  const reach = radius * 4.6;
  const { canvas, context } = canvas2d(Math.ceil(reach + radius + 12), Math.ceil(size + 24));
  const cx = reach;
  const cy = radius + 12;
  context.strokeStyle = POST_INK;
  context.fillStyle = POST_INK;
  // Ondulations d'oblitération, à gauche du cachet.
  context.lineWidth = Math.max(3, size * 0.022);
  for (let row = -2; row <= 2; row++) {
    const y = cy + row * radius * 0.27;
    context.beginPath();
    for (let x = cx - radius * 1.12; x > cx - reach + 6; x -= 4) {
      const wave = Math.sin((x / radius) * 5.2) * radius * 0.07;
      if (x === cx - radius * 1.12) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
  context.save();
  context.translate(cx, cy);
  context.lineWidth = Math.max(3.5, size * 0.026);
  context.beginPath();
  context.arc(0, 0, radius - 4, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = Math.max(2, size * 0.014);
  context.beginPath();
  context.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
  context.stroke();
  context.font = `500 ${Math.round(radius * 0.17)}px ${mono}`;
  arcText(context, 'ARCHIPEL DE KYLIANN', radius * 0.8, true, radius * 0.02);
  context.font = `500 ${Math.round(radius * 0.15)}px ${mono}`;
  arcText(context, info.place.toUpperCase(), radius * 0.8, false, radius * 0.02);
  const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(info.date).replace('.', '').toUpperCase();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `500 ${Math.round(radius * 0.21)}px ${mono}`;
  context.fillText(day, 0, -radius * 0.12);
  context.font = `500 ${Math.round(radius * 0.19)}px ${mono}`;
  context.fillText(String(info.date.getFullYear()), 0, radius * 0.17);
  context.restore();
  // Encre inégale : quelques manques, comme un vrai coup de tampon.
  const wear = noise(context, 64, 31, [0, 0, 0], 0.16, [0.3, 0.9], 2);
  if (wear) {
    context.globalCompositeOperation = 'destination-out';
    context.imageSmoothingEnabled = false;
    context.fillStyle = wear;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, cx, cy };
}

export async function composePostcard(snapshot: HTMLCanvasElement, info: PostcardInfo): Promise<Blob> {
  const portrait = snapshot.height > snapshot.width;
  const width = portrait ? 1200 : 1800;
  const height = portrait ? 1720 : 1240;
  const serif = family('--font-fraunces', 'Georgia, serif');
  const mono = family('--font-dm-mono', 'ui-monospace, monospace');
  const display = family('--font-big-shoulders', '"Arial Narrow", sans-serif');
  await ready([`italic 400 64px ${serif}`, `500 24px ${mono}`, `800 40px ${display}`]);

  const { canvas, context } = canvas2d(width, height);
  // Papier.
  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);
  const light = context.createRadialGradient(width * 0.45, height * 0.35, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.8);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  light.addColorStop(1, 'rgba(120, 88, 48, 0.14)');
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);
  const grain = noise(context, 128, 7, [92, 70, 40], 0.22, [0.05, 0.14], 1.5);
  if (grain) {
    context.fillStyle = grain;
    context.fillRect(0, 0, width, height);
  }

  // Photo.
  const margin = Math.round(width * 0.045);
  const caption = Math.round(height * (portrait ? 0.16 : 0.19));
  const px = margin;
  const py = margin;
  const pw = width - margin * 2;
  const ph = height - margin - caption;
  context.save();
  context.shadowColor = 'rgba(70, 46, 22, 0.3)';
  context.shadowBlur = 22;
  context.shadowOffsetY = 8;
  context.fillStyle = '#fffaf0';
  context.fillRect(px, py, pw, ph);
  context.restore();
  context.save();
  context.beginPath();
  context.rect(px, py, pw, ph);
  context.clip();
  const cover = Math.max(pw / snapshot.width, ph / snapshot.height);
  const dw = snapshot.width * cover;
  const dh = snapshot.height * cover;
  context.drawImage(snapshot, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
  // Tirage : chaleur, noirs relevés, vignettage.
  context.globalCompositeOperation = 'soft-light';
  context.fillStyle = 'rgba(255, 190, 130, 0.34)';
  context.fillRect(px, py, pw, ph);
  context.globalCompositeOperation = 'screen';
  context.fillStyle = 'rgba(46, 32, 70, 0.08)';
  context.fillRect(px, py, pw, ph);
  context.globalCompositeOperation = 'multiply';
  const vignette = context.createRadialGradient(px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.35, px + pw / 2, py + ph / 2, Math.hypot(pw, ph) * 0.58);
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(1, 'rgba(92, 62, 84, 0.42)');
  context.fillStyle = vignette;
  context.fillRect(px, py, pw, ph);
  context.restore();
  const edge = Math.max(5, Math.round(width * 0.0045));
  context.strokeStyle = 'rgba(255, 252, 244, 0.92)';
  context.lineWidth = edge;
  context.strokeRect(px + edge / 2, py + edge / 2, pw - edge, ph - edge);

  // Timbre (coin haut droit, à cheval sur la photo) et oblitération.
  const stamp = drawStamp(display, mono);
  const stampScale = (width * (portrait ? 0.17 : 0.118)) / stamp.width;
  const sw = stamp.width * stampScale;
  const sh = stamp.height * stampScale;
  const sx = px + pw - sw - margin * 0.35;
  const sy = py + margin * 0.35;
  context.save();
  context.translate(sx + sw / 2, sy + sh / 2);
  context.rotate(0.05);
  context.shadowColor = 'rgba(40, 24, 10, 0.35)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;
  context.drawImage(stamp, -sw / 2, -sh / 2, sw, sh);
  context.restore();
  const markSize = sw * 1.12;
  const mark = drawPostmark(info, mono, markSize);
  context.save();
  // Le cachet mord le bord gauche du timbre sans masquer ses lettres ni sa propre date.
  context.translate(sx - sw * 0.2, sy + sh * 0.84);
  context.rotate(-0.21);
  context.globalCompositeOperation = 'multiply';
  context.drawImage(mark.canvas, -mark.cx, -mark.cy);
  context.restore();

  // Légende.
  const baseline = py + ph + caption * 0.47;
  const titleSize = Math.round(width * (portrait ? 0.05 : 0.038));
  context.fillStyle = INK;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.font = `italic 400 ${titleSize}px ${serif}`;
  spaced(context, '0px');
  context.fillText('Bons baisers de l’Archipel', px, baseline);
  const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(info.date);
  const line = `${info.place} · ${date} · ${info.mood}`.toUpperCase();
  let monoSize = Math.round(width * (portrait ? 0.017 : 0.0128));
  context.font = `500 ${monoSize}px ${mono}`;
  spaced(context, `${Math.round(monoSize * 0.16)}px`);
  const room = portrait ? pw : pw * 0.72;
  while (context.measureText(line).width > room && monoSize > 12) {
    monoSize -= 1;
    context.font = `500 ${monoSize}px ${mono}`;
    spaced(context, `${Math.round(monoSize * 0.16)}px`);
  }
  context.fillStyle = 'rgba(59, 47, 37, 0.72)';
  const second = baseline + caption * (portrait ? 0.25 : 0.27);
  context.fillText(line, px, second);
  const host = site.url.replace(/^https?:\/\//, '').toUpperCase();
  context.textAlign = portrait ? 'left' : 'right';
  context.fillStyle = 'rgba(200, 85, 61, 0.9)';
  if (portrait) context.fillText(host, px, second + monoSize * 1.9);
  else context.fillText(host, px + pw, second);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Tirage impossible'))), 'image/jpeg', 0.92);
  });
}
