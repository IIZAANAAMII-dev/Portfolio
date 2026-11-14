import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { projects } from '@/data/projects';

/**
 * Textures peintes à la main (canvas) du village : granit, ardoise, pavés, filet, écrans
 * de code et tableau de liège. Aucune photo : des aplats, des joints, quelques grains.
 * Les textures « matière » sont partagées (créées une fois, côté client seulement) et
 * répétées en mètres (UV en mètres, voir `meterBox`).
 */

/** Générateur pseudo-aléatoire déterministe (mêmes pierres à chaque visite). */
function random(seed: number) {
  let state = Math.floor(seed * 2654435761) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')!] as const;
}

function finish(element: HTMLCanvasElement, metersX: number, metersY: number, wrap = true) {
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (wrap) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1 / metersX, 1 / metersY);
  }
  return texture;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Appareil de granit : assises irrégulières de moellons beige-gris (un peu rosés), joints
 * de chaux clairs. Tuile de 2 × 2 m, raccord parfait dans les deux sens.
 */
function makeGranite() {
  const size = 256;
  const [element, ctx] = canvas(size, size);
  const next = random(7.3);
  const stones = ['#a99d8b', '#9c917f', '#b7ab98', '#a1988a', '#b09d8c', '#bcac97', '#a5a091', '#958a7b'];
  ctx.fillStyle = '#d3cabb';
  ctx.fillRect(0, 0, size, size);
  let y = 0;
  while (y < size - 1) {
    let rowHeight = Math.round(34 + next() * 24);
    if (size - (y + rowHeight) < 30) rowHeight = size - y;
    let x = -next() * 60;
    while (x < size) {
      const width = 46 + next() * 64;
      const tone = stones[Math.floor(next() * stones.length)];
      for (const shift of [0, size]) {
        const left = x - shift;
        if (left + width < 0 || left > size) continue;
        ctx.fillStyle = tone;
        roundedRect(ctx, left + 2.5, y + 2.5, width - 5, rowHeight - 5, 9);
        ctx.fill();
        // Arête haute éclairée, base dans l'ombre : la pierre bombe légèrement.
        ctx.fillStyle = 'rgba(255, 252, 244, 0.22)';
        roundedRect(ctx, left + 5, y + 4, width - 12, 5, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(70, 60, 70, 0.12)';
        roundedRect(ctx, left + 4, y + rowHeight - 9, width - 9, 5, 3);
        ctx.fill();
      }
      x += width;
    }
    y += rowHeight;
  }
  // Grain du granit : quartz clair, mica sombre, feldspath rosé.
  for (let index = 0; index < 900; index++) {
    const kind = next();
    ctx.fillStyle = kind < 0.45 ? 'rgba(60, 54, 58, 0.22)' : kind < 0.8 ? 'rgba(255, 255, 250, 0.35)' : 'rgba(205, 140, 130, 0.3)';
    ctx.fillRect(next() * size, next() * size, 1.6, 1.6);
  }
  return finish(element, 2, 2);
}

/** Ardoises : rangs décalés, bleu-gris profond, bord inférieur éclairé. Tuile de 1 × 1 m. */
function makeSlate() {
  const size = 128;
  const [element, ctx] = canvas(size, size);
  const next = random(3.1);
  const tones = ['#4f586d', '#576177', '#4a5265', '#5d667b', '#525b70', '#616a80'];
  ctx.fillStyle = '#30364a';
  ctx.fillRect(0, 0, size, size);
  const rows = 6;
  const rowHeight = size / rows;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : 16;
    for (let column = -1; column < 5; column++) {
      const x = column * 32 + offset;
      const y = row * rowHeight;
      ctx.fillStyle = tones[Math.floor(next() * tones.length)];
      ctx.fillRect(x + 1, y + 1, 30, rowHeight - 1.5);
      ctx.fillStyle = 'rgba(200, 210, 230, 0.16)';
      ctx.fillRect(x + 1, y + rowHeight - 4, 30, 2.5);
    }
  }
  return finish(element, 1, 1);
}

/** Pavés de granit du quai, en rangs. Tuile de 1 × 1 m. */
function makeCobbles() {
  const size = 128;
  const [element, ctx] = canvas(size, size);
  const next = random(5.9);
  const tones = ['#bdb6a9', '#c8c1b4', '#b1aa9e', '#c3b6aa', '#b8b3a8'];
  ctx.fillStyle = '#8e887e';
  ctx.fillRect(0, 0, size, size);
  const rowHeight = size / 5;
  for (let row = 0; row < 5; row++) {
    let x = -next() * 20;
    while (x < size) {
      const width = 22 + next() * 16;
      for (const shift of [0, size]) {
        ctx.fillStyle = tones[Math.floor(next() * tones.length)];
        roundedRect(ctx, x - shift + 1.5, row * rowHeight + 1.5, width - 3, rowHeight - 3, 5);
        ctx.fill();
      }
      x += width;
    }
  }
  return finish(element, 1, 1);
}

/** Filet de pêche : mailles en losange sur fond transparent (alphaTest). Tuile de 0,4 m. */
function makeNet() {
  const size = 64;
  const [element, ctx] = canvas(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2;
  for (const shift of [-size, 0, size]) {
    ctx.beginPath();
    ctx.moveTo(shift, 0);
    ctx.lineTo(shift + size, size);
    ctx.moveTo(shift + size, 0);
    ctx.lineTo(shift, size);
    ctx.stroke();
  }
  return finish(element, 0.4, 0.4);
}

const cache = new Map<string, CanvasTexture>();

function shared(key: string, make: () => CanvasTexture) {
  let texture = cache.get(key);
  if (!texture) {
    texture = make();
    cache.set(key, texture);
  }
  return texture;
}

export const graniteTexture = () => shared('granite', makeGranite);
export const slateTexture = () => shared('slate', makeSlate);
export const cobbleTexture = () => shared('cobbles', makeCobbles);
export const netTexture = () => shared('net', makeNet);

/* ------------------------------------------------------------- l'atelier */

type CodeLine = [indent: number, ...tokens: [string, string][]];

const KEYWORD = '#ff8fb8';
const NAME = '#9fe3ff';
const TAG = '#ffd479';
const TEXT = '#e9eef5';
const NOTE = '#7f93a6';
const NUMBER = '#b9f28b';

/** Écran principal : le composant de l'archipel (décor, pas de données). */
const ARCHIPEL: CodeLine[] = [
  [0, [KEYWORD, 'export function '], [NAME, 'Archipel'], [TEXT, '() {']],
  [1, [KEYWORD, 'const '], [TEXT, 'mer = '], [NAME, 'useOcean'], [TEXT, '();']],
  [1, [KEYWORD, 'return '], [TEXT, '(']],
  [2, [TAG, '<Canvas '], [NAME, 'shadows'], [TAG, '>']],
  [3, [TAG, '<Ocean '], [NAME, 'houle'], [TEXT, '={mer} '], [TAG, '/>']],
  [3, [TAG, '<Ile '], [NAME, 'nom'], [TEXT, '="À propos" '], [TAG, '/>']],
  [3, [TAG, '<Phare '], [NAME, 'feu'], [TEXT, '="2 éclats" '], [TAG, '/>']],
  [3, [TAG, '<Bateau '], [NAME, 'cap'], [TEXT, '={'], [NUMBER, '0.5'], [TEXT, '} '], [TAG, '/>']],
  [2, [TAG, '</Canvas>']],
  [1, [TEXT, ');']],
  [0, [TEXT, '}']],
  [0, [NOTE, '// fait main, avec soin']],
];

/** Second écran : un shader de vagues. */
const VAGUES: CodeLine[] = [
  [0, [NOTE, '// houle.glsl']],
  [0, [KEYWORD, 'float '], [NAME, 'vague'], [TEXT, '(vec2 p, float t) {']],
  [1, [KEYWORD, 'float '], [TEXT, 'h = '], [NAME, 'sin'], [TEXT, '(p.x * '], [NUMBER, '0.3'], [TEXT, ' + t);']],
  [1, [TEXT, 'h += '], [NAME, 'sin'], [TEXT, '(p.y * '], [NUMBER, '0.7'], [TEXT, ' - t) * '], [NUMBER, '0.4'], [TEXT, ';']],
  [1, [KEYWORD, 'return '], [TEXT, 'h * '], [NAME, 'uHoule'], [TEXT, ';']],
  [0, [TEXT, '}']],
  [0, [TEXT, '']],
  [0, [KEYWORD, 'void '], [NAME, 'main'], [TEXT, '() {']],
  [1, [KEYWORD, 'vec3 '], [TEXT, 'eau = '], [NAME, 'mix'], [TEXT, '(fond, lagon, d);']],
  [1, [NAME, 'gl_FragColor'], [TEXT, ' = '], [NAME, 'vec4'], [TEXT, '(eau, '], [NUMBER, '1.0'], [TEXT, ');']],
  [0, [TEXT, '}']],
];

function codeScreen(lines: CodeLine[], { width, height, accent }: { width: number; height: number; accent: string }) {
  const [element, ctx] = canvas(width, height);
  ctx.fillStyle = '#141c28';
  ctx.fillRect(0, 0, width, height);
  // Barre d'onglets et gouttière des numéros de ligne.
  ctx.fillStyle = '#1d2736';
  ctx.fillRect(0, 0, width, 22);
  ctx.fillStyle = accent;
  ctx.fillRect(10, 6, 74, 12);
  ctx.fillStyle = '#2a3547';
  ctx.fillRect(92, 6, 60, 12);
  ctx.fillStyle = '#18212e';
  ctx.fillRect(0, 22, 30, height - 22);
  const lineHeight = (height - 34) / lines.length;
  ctx.font = `600 ${Math.round(lineHeight * 0.72)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'middle';
  lines.forEach(([indent, ...tokens], row) => {
    const y = 30 + lineHeight * (row + 0.5);
    ctx.fillStyle = '#4b5a6e';
    ctx.fillText(String(row + 1), 6, y);
    let x = 38 + indent * lineHeight * 1.1;
    for (const [color, text] of tokens) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
  });
  // Ligne courante surlignée et curseur.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fillRect(30, 30 + lineHeight * 4, width - 30, lineHeight);
  const texture = finish(element, 1, 1, false);
  texture.anisotropy = 8;
  return texture;
}

export function mainScreenTexture() {
  return codeScreen(ARCHIPEL, { width: 512, height: 300, accent: '#f0b27a' });
}

export function sideScreenTexture() {
  return codeScreen(VAGUES, { width: 384, height: 256, accent: '#7fd7e8' });
}

/**
 * Tableau de liège : une fiche épinglée par projet (numéro et titre, depuis les données),
 * écrite à la main, bandeau à la couleur du projet.
 */
export function corkTexture(family: string) {
  const width = 640;
  const height = 400;
  const [element, ctx] = canvas(width, height);
  const next = random(11.7);
  ctx.fillStyle = '#b8875a';
  ctx.fillRect(0, 0, width, height);
  for (let index = 0; index < 2600; index++) {
    ctx.fillStyle = next() < 0.5 ? 'rgba(120, 78, 44, 0.35)' : 'rgba(226, 182, 132, 0.35)';
    ctx.fillRect(next() * width, next() * height, 2, 2);
  }
  const columns = 3;
  const rows = Math.ceil(projects.length / columns);
  const cardWidth = (width - 60) / columns - 18;
  const cardHeight = (height - 50) / rows - 22;
  projects.forEach((project, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 30 + column * (cardWidth + 18) + (next() - 0.5) * 8;
    const y = 28 + row * (cardHeight + 22) + (next() - 0.5) * 8;
    ctx.save();
    ctx.translate(x + cardWidth / 2, y + cardHeight / 2);
    ctx.rotate((next() - 0.5) * 0.08);
    ctx.fillStyle = 'rgba(40, 24, 10, 0.28)';
    ctx.fillRect(-cardWidth / 2 + 4, -cardHeight / 2 + 5, cardWidth, cardHeight);
    ctx.fillStyle = '#fbf6ea';
    ctx.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
    ctx.fillStyle = project.accent;
    ctx.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, 16);
    ctx.fillStyle = '#3b2f25';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 46px ${family}`;
    ctx.fillText(project.index, 0, -cardHeight * 0.1, cardWidth - 16);
    ctx.font = `500 30px ${family}`;
    ctx.fillText(project.title, 0, cardHeight * 0.27, cardWidth - 14);
    // Punaise.
    ctx.fillStyle = project.accent;
    ctx.beginPath();
    ctx.arc(0, -cardHeight / 2 + 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(-2, -cardHeight / 2 + 6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  // Cadre en bois.
  ctx.strokeStyle = '#7a5034';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  const texture = finish(element, 1, 1, false);
  texture.anisotropy = 8;
  return texture;
}
