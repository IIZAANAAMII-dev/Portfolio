'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SECRET_MAP_SPOTS, SECRET_IDS, type SecretId } from '@/components/world/secrets/layout';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { STAR_SPOTS } from '@/data/stars';
import { yellowStatic, yellowStaticIsland } from '@/data/yellow-static';
import { boatState } from '@/lib/boat-state';
import { STAMPS, useLogbook, type StampId } from '@/lib/logbook';
import { BREAK, voyage } from '@/lib/voyage';
import { hash } from '@/lib/utils/math';

/**
 * Carte de voyage : l'archipel dessiné à la main sur papier, la route réellement suivie par
 * le visiteur à l'encre rouge, ses tampons et ses étoiles d'or. Elle se complète en
 * explorant : une brume de parchemin hachurée couvre les mers jamais parcourues et ne se
 * lève que le long de la route et autour des îles visitées ; les terres encore inconnues
 * n'y sont que des silhouettes pointillées. L'île secrète n'apparaît qu'une fois trouvée,
 * et les secrets découverts (coffre, épave, sous-marin, poisson, serpent) y sont dessinés
 * à l'encre. Téléchargeable en carte postale : un souvenir unique de chaque traversée.
 */

const WIDTH = 960;
const HEIGHT = 640;
const WORLD = 128;
const INK = '#4a3b2e';
/** Ce que l'on voit autour du bateau (m) : la brume se lève dans ce rayon le long de la route. */
const SIGHT = 26;
/** Une terre est « découverte » si la route est passée à cette distance de son rivage (m). */
const SPOTTED = 30;

function handFamily() {
  return getComputedStyle(document.body).getPropertyValue('--font-caveat').trim() || 'cursive';
}

/** Côte découpée (même famille de formes que le relief des îles). */
function coastPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, seed: number) {
  ctx.beginPath();
  for (let step = 0; step <= 64; step++) {
    const angle = (step / 64) * Math.PI * 2;
    const r = radius * (1 + Math.sin(angle * 3 + seed * 1.7) * 0.07 + Math.sin(angle * 7 - seed * 0.9) * 0.04);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function inkOf(id: StampId) {
  if (id.startsWith('island:')) return '#c8553d';
  if (id.startsWith('islet:')) return '#3f5fb5';
  return '#2f7a5a';
}

/** Pinceau doux (disque dont l'alpha s'éteint vers le bord) qui efface la brume. */
function softBrush() {
  const size = 128;
  const brush = document.createElement('canvas');
  brush.width = size;
  brush.height = size;
  const ctx = brush.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.92)');
  gradient.addColorStop(0.78, 'rgba(0, 0, 0, 0.38)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return brush;
}

interface Clearing {
  x: number;
  y: number;
  r: number;
}

/**
 * Brume de parchemin : papier plus sombre, nuages marbrés, hachures fines à la plume,
 * percée de clairières aux bords nuageux.
 */
function fogLayer(ratio: number, clearings: Clearing[]) {
  const fog = document.createElement('canvas');
  fog.width = WIDTH * ratio;
  fog.height = HEIGHT * ratio;
  const ctx = fog.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#e4d3ae';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let index = 0; index < 80; index++) {
    const x = hash(index * 3.7 + 0.3) * WIDTH;
    const y = hash(index * 5.1 + 0.7) * HEIGHT;
    const r = 30 + hash(index * 7.3) * 95;
    const light = index % 3 !== 0;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, light ? 'rgba(250, 242, 222, 0.55)' : 'rgba(160, 128, 84, 0.16)');
    gradient.addColorStop(1, light ? 'rgba(250, 242, 222, 0)' : 'rgba(160, 128, 84, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Hachures à la plume, légèrement tremblées.
  ctx.strokeStyle = 'rgba(108, 80, 48, 0.14)';
  ctx.lineWidth = 0.8;
  for (let k = -HEIGHT, line = 0; k < WIDTH; k += 7, line++) {
    ctx.beginPath();
    ctx.moveTo(k, HEIGHT);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      ctx.lineTo(k + HEIGHT * t + (hash(line * 9.1 + step) - 0.5) * 1.6, HEIGHT * (1 - t));
    }
    ctx.stroke();
  }
  for (let index = 0; index < 700; index++) {
    ctx.fillStyle = `rgba(90, 66, 40, ${0.04 + hash(index * 2.3) * 0.06})`;
    ctx.fillRect(hash(index * 6.7) * WIDTH, hash(index * 4.9) * HEIGHT, 1.3, 1.3);
  }
  // Clairières : le pinceau doux, et deux bouffées décalées pour un bord nuageux.
  const brush = softBrush();
  ctx.globalCompositeOperation = 'destination-out';
  clearings.forEach((clearing, index) => {
    const r = clearing.r * (0.92 + hash(index * 1.7) * 0.16);
    ctx.drawImage(brush, clearing.x - r, clearing.y - r, r * 2, r * 2);
    for (let puff = 0; puff < 2; puff++) {
      const angle = hash(index * 3.3 + puff * 7.1) * Math.PI * 2;
      const pr = r * (0.42 + hash(index * 5.9 + puff) * 0.18);
      const px = clearing.x + Math.cos(angle) * r * 0.82;
      const py = clearing.y + Math.sin(angle) * r * 0.82;
      ctx.drawImage(brush, px - pr, py - pr, pr * 2, pr * 2);
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  return fog;
}

/* ---------------------------------------------------------- icônes des secrets */

function secretIcon(ctx: CanvasRenderingContext2D, id: SecretId, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (id === 'chest') {
    ctx.fillStyle = '#e0a321';
    ctx.beginPath();
    ctx.rect(-10, -3, 20, 11);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -3);
    ctx.quadraticCurveTo(0, -14, 10, -3);
    ctx.closePath();
    ctx.fillStyle = '#c47f2a';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(-1.5, -1, 3, 4);
    // Éclat doré.
    ctx.strokeStyle = '#d49a1f';
    ctx.lineWidth = 1.2;
    for (const [dx, dy] of [[12, -12], [15, -6], [7, -16]]) {
      ctx.beginPath();
      ctx.moveTo(dx * 0.75, dy * 0.75);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }
  } else if (id === 'wreck') {
    ctx.rotate(-0.35);
    ctx.fillStyle = '#5d97a3';
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(12, -4);
    ctx.quadraticCurveTo(9, 7, -9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -4);
    ctx.lineTo(3, -14);
    ctx.lineTo(5.5, -11);
    ctx.moveTo(-6, -3);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-1, -9);
    ctx.lineTo(-1, -3.5);
    ctx.stroke();
    // Vaguelettes au pied de l'épave.
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.quadraticCurveTo(-10, 7, -6, 10);
    ctx.quadraticCurveTo(-2, 13, 2, 10);
    ctx.stroke();
  } else if (id === 'submarine') {
    ctx.fillStyle = '#ffc02e';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-3, -6, 7, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(2, -13);
    ctx.lineTo(6, -13);
    ctx.stroke();
    ctx.fillStyle = '#9fe0f0';
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.arc(dx, 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (id === 'mechafish') {
    ctx.fillStyle = '#d4a548';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-2, -9, 10, 0);
    ctx.quadraticCurveTo(-2, 9, -12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-17, -5);
    ctx.lineTo(-17, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, -1, 1.6, 0, Math.PI * 2);
    ctx.stroke();
    // Clé de remontage.
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(-2, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-4.6, -12, 2.6, 0, Math.PI * 2);
    ctx.arc(0.6, -12, 2.6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Serpent : tête et trois bosses qui fendent l'eau.
    ctx.fillStyle = '#3fae95';
    ctx.beginPath();
    for (let hump = 0; hump < 3; hump++) {
      const hx = -2 + hump * 9;
      ctx.moveTo(hx - 4, 4);
      ctx.arc(hx, 4, 4, Math.PI, 0);
    }
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.quadraticCurveTo(-8, -10, -14, -8);
    ctx.quadraticCurveTo(-17, -6, -14, -4);
    ctx.quadraticCurveTo(-11, -4, -10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-13.5, -7, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-20, 8);
    ctx.quadraticCurveTo(-4, 5, 24, 8);
    ctx.stroke();
  }
  ctx.restore();
}

const SECRET_LABELS: Record<SecretId, { text: string; dx: number; dy: number; align: CanvasTextAlign }> = {
  chest: { text: 'trésor', dx: 0, dy: 22, align: 'center' },
  wreck: { text: 'vieux chalutier', dx: -16, dy: 4, align: 'right' },
  submarine: { text: 'sous-marin', dx: 0, dy: 22, align: 'center' },
  mechafish: { text: 'poisson à remontoir', dx: 18, dy: -2, align: 'left' },
  serpent: { text: 'serpent de mer', dx: 0, dy: 26, align: 'center' },
};

/** Petit décalage des icônes qui chevaucheraient une étiquette d'île. */
const ICON_NUDGE: Partial<Record<SecretId, [number, number]>> = {
  wreck: [-6, 6],
};

/** Champs de brume encore vierges où l'on écrit « terra incognita ». */
const INCOGNITA: [number, number, number][] = [
  [-92, 96, -0.12],
  [92, -92, 0.08],
  [96, 104, -0.05],
  [-100, -24, 0.1],
];

/* ------------------------------------------------------------------- dessin */

function draw(canvas: HTMLCanvasElement, family: string) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * ratio;
  canvas.height = HEIGHT * ratio;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const { stamps, stars } = useLogbook.getState();
  const scale = (HEIGHT - 70) / (WORLD * 2);
  const cx = WIDTH / 2 + 70;
  const cy = HEIGHT / 2 + 16;
  const at = (x: number, z: number): [number, number] => [cx + x * scale, cy + z * scale];
  const route = voyage.points();
  // Points de route réels (sans coupures), plus la position actuelle du bateau.
  const trail = route.filter(([x]) => x !== BREAK);
  trail.push([boatState.position.x, boatState.position.z]);
  const routeNear = (x: number, z: number, reach: number) =>
    trail.some(([px, pz]) => (px - x) * (px - x) + (pz - z) * (pz - z) < reach * reach);

  // Papier : crème, bords assombris, grain.
  ctx.fillStyle = '#f3ead6';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const edge = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.35, WIDTH / 2, HEIGHT / 2, WIDTH * 0.62);
  edge.addColorStop(0, 'rgba(160, 120, 70, 0)');
  edge.addColorStop(1, 'rgba(150, 105, 55, 0.28)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let index = 0; index < 900; index++) {
    ctx.fillStyle = `rgba(90, 70, 45, ${0.03 + hash(index * 1.3) * 0.05})`;
    ctx.fillRect(hash(index * 7.1) * WIDTH, hash(index * 3.9) * HEIGHT, 1.2, 1.2);
  }

  // Mer navigable : lavis bleu ; au-delà, la mer interdite hachurée.
  const [sx, sy] = at(0, 0);
  const sea = ctx.createRadialGradient(sx, sy, 0, sx, sy, 126 * scale);
  sea.addColorStop(0, 'rgba(120, 190, 200, 0.28)');
  sea.addColorStop(1, 'rgba(120, 190, 200, 0.12)');
  ctx.fillStyle = sea;
  ctx.beginPath();
  ctx.arc(sx, sy, 126 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEIGHT);
  ctx.arc(sx, sy, 126 * scale, 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(74, 59, 46, 0.12)';
  ctx.lineWidth = 1;
  for (let x = -HEIGHT; x < WIDTH; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + HEIGHT, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(74, 59, 46, 0.45)';
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(sx, sy, 126 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Terres : découvertes (visitées, ou longées par la route) ou encore inconnues.
  const staticFound = stamps.includes('static');
  const lands = [
    { label: 'départ', x: homeIsland.position[0], z: homeIsland.position[1], radius: homeIsland.radius, seed: 1, id: null as StampId | null, known: true, secret: false },
    ...islands.map((island, index) => ({
      label: island.label,
      x: island.position[0],
      z: island.position[1],
      radius: island.radius,
      seed: index * 17 + 3,
      id: `island:${island.id}` as StampId,
      known: false,
      secret: false,
    })),
    ...islets.map((islet) => ({
      label: islet.label,
      x: islet.position[0],
      z: islet.position[1],
      radius: islet.radius,
      seed: islet.seed,
      id: `islet:${islet.id}` as StampId,
      known: false,
      secret: false,
    })),
    {
      label: yellowStatic.title,
      x: yellowStaticIsland.position[0],
      z: yellowStaticIsland.position[1],
      radius: yellowStaticIsland.radius,
      seed: 29,
      id: 'static' as StampId,
      known: false,
      secret: true,
    },
  ].map((land) => ({
    ...land,
    visited: land.id !== null && stamps.includes(land.id),
    known: land.known || (land.secret ? staticFound : (land.id !== null && stamps.includes(land.id)) || routeNear(land.x, land.z, land.radius + SPOTTED)),
  }));

  for (const land of lands) {
    if (!land.known) continue;
    const [x, y] = at(land.x, land.z);
    const r = land.radius * scale;
    // Ombre portée hachurée, sable, herbe, contour à l'encre.
    coastPath(ctx, x + 2.5, y + 3, r, land.seed);
    ctx.fillStyle = 'rgba(74, 59, 46, 0.14)';
    ctx.fill();
    coastPath(ctx, x, y, r, land.seed);
    ctx.fillStyle = land.secret ? '#e9d68f' : '#e8cf9f';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    coastPath(ctx, x, y, r * 0.7, land.seed + 2);
    ctx.fillStyle = land.secret ? '#a4a95e' : '#9dbd6c';
    ctx.fill();
    ctx.font = land.secret ? `600 18px ${family}` : `500 ${land.radius > 10 ? 24 : 19}px ${family}`;
    ctx.fillStyle = land.secret ? '#a07a12' : INK;
    ctx.textAlign = 'center';
    ctx.fillText(land.label, x, y + r + 20);
    // Tampon posé sur les terres visitées.
    if (land.id && land.visited && !land.secret) {
      const ink = inkOf(land.id);
      ctx.save();
      ctx.translate(x + r * 0.55, y - r * 0.55);
      ctx.rotate((hash(land.seed) - 0.5) * 0.6);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillText(STAMPS.find((stamp) => stamp.id === land.id)?.glyph ?? '✓', 0, 4);
      ctx.restore();
    }
  }

  // Brume : levée le long de la route, autour des terres visitées ou aperçues, au départ.
  const clearings: Clearing[] = [];
  const [hx, hy] = at(homeIsland.position[0], homeIsland.position[1]);
  clearings.push({ x: hx, y: hy, r: 24 * scale });
  trail.forEach(([x, z], index) => {
    if (index % 2 === 1 && index !== trail.length - 1) return;
    const [px, py] = at(x, z);
    clearings.push({ x: px, y: py, r: SIGHT * scale });
  });
  for (const land of lands) {
    if (!land.known) continue;
    const [x, y] = at(land.x, land.z);
    clearings.push({ x, y: y + 6, r: (land.radius + (land.visited ? 18 : 13)) * scale });
  }
  const fog = fogLayer(ratio, clearings);
  ctx.save();
  // Ombre douce de la brume sur la carte dégagée : un voile posé sur le papier.
  ctx.shadowColor = 'rgba(96, 66, 32, 0.4)';
  ctx.shadowBlur = 12 * ratio;
  ctx.shadowOffsetX = 1.5 * ratio;
  ctx.shadowOffsetY = 2.5 * ratio;
  ctx.drawImage(fog, 0, 0, WIDTH, HEIGHT);
  ctx.restore();

  // Rumeurs dans la brume : silhouettes pointillées des terres inconnues (jamais l'île secrète).
  for (const land of lands) {
    if (land.known || land.secret) continue;
    const [x, y] = at(land.x, land.z);
    const r = land.radius * scale;
    coastPath(ctx, x, y, r, land.seed);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(74, 59, 46, 0.32)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `500 ${land.radius > 10 ? 26 : 20}px ${family}`;
    ctx.fillStyle = 'rgba(74, 59, 46, 0.34)';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y + 8);
  }
  ctx.font = `500 30px ${family}`;
  ctx.fillStyle = 'rgba(96, 72, 44, 0.3)';
  ctx.textAlign = 'center';
  for (const [x, z, tilt] of INCOGNITA) {
    if (routeNear(x, z, 46)) continue;
    const [px, py] = at(x, z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);
    ctx.fillText('terra incognita', 0, 0);
    ctx.restore();
  }

  // Serpent de mer : griffonné en légende tant qu'on ne l'a pas vu, dessiné à sa place ensuite.
  if (!stamps.includes('serpent')) {
    const [mx, my] = at(-106, -98);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let hump = 0; hump < 3; hump++) ctx.arc(mx + hump * 22, my, 9, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx - 14, my - 4, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `500 22px ${family}`;
    ctx.fillStyle = 'rgba(74, 59, 46, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText('ici vivent des monstres', mx + 22, my + 30);
  }

  // Étoiles d'or trouvées (les autres restent secrètes).
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const index of stars) {
    const spot = STAR_SPOTS[index];
    if (!spot) continue;
    const [x, y] = at(spot[0], spot[1]);
    ctx.fillStyle = '#d49a1f';
    ctx.fillText('✦', x, y + 6);
  }

  // Secrets trouvés, à l'encre.
  let secrets = 0;
  for (const id of SECRET_IDS) {
    if (!stamps.includes(id)) continue;
    secrets += 1;
    const spot = SECRET_MAP_SPOTS[id];
    const nudge = ICON_NUDGE[id] ?? [0, 0];
    const [x, y] = at(spot.x, spot.z);
    secretIcon(ctx, id, x + nudge[0], y + nudge[1]);
    const label = SECRET_LABELS[id];
    ctx.font = `500 16px ${family}`;
    ctx.fillStyle = INK;
    ctx.textAlign = label.align;
    ctx.fillText(label.text, x + nudge[0] + label.dx, y + nudge[1] + label.dy);
  }

  // Route suivie : pointillés à l'encre rouge, ancre au départ, bateau à la fin.
  if (route.length > 1) {
    ctx.strokeStyle = 'rgba(200, 85, 61, 0.9)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 6]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    route.forEach(([x, z], index) => {
      if (x === BREAK) return;
      const [px, py] = at(x, z);
      const previous = route[index - 1];
      if (index === 0 || !previous || previous[0] === BREAK) ctx.moveTo(px, py);
      else {
        const [qx, qy] = at(previous[0], previous[1]);
        ctx.quadraticCurveTo(qx, qy, (px + qx) / 2, (py + qy) / 2);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const [bx, by] = at(boatState.position.x, boatState.position.z);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(boatState.heading);
  ctx.fillStyle = '#c8553d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, 5.5);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-7, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Rose des vents.
  const rose = { x: 92, y: HEIGHT - 96 };
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(rose.x, rose.y, 38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(243, 234, 214, 0.75)';
  ctx.fill();
  ctx.stroke();
  for (let point = 0; point < 8; point++) {
    const angle = (point / 8) * Math.PI * 2 - Math.PI / 2;
    const long = point % 2 === 0 ? 34 : 20;
    ctx.beginPath();
    ctx.moveTo(rose.x + Math.cos(angle + 0.18) * 7, rose.y + Math.sin(angle + 0.18) * 7);
    ctx.lineTo(rose.x + Math.cos(angle) * long, rose.y + Math.sin(angle) * long);
    ctx.lineTo(rose.x + Math.cos(angle - 0.18) * 7, rose.y + Math.sin(angle - 0.18) * 7);
    ctx.fillStyle = point === 0 ? '#c8553d' : point % 2 === 0 ? INK : 'rgba(74, 59, 46, 0.4)';
    ctx.fill();
  }
  ctx.font = `500 22px ${family}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText('N', rose.x, rose.y - 46);

  // Titre et cartouche.
  ctx.textAlign = 'left';
  ctx.font = `600 50px ${family}`;
  ctx.fillText('Carte de voyage', 34, 70);
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(74, 59, 46, 0.65)';
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(`ARCHIPEL DE KYLIANN · ${date.toUpperCase()}`, 38, 94);
  let length = 0;
  for (let index = 1; index < route.length; index++) {
    if (route[index][0] === BREAK || route[index - 1][0] === BREAK) continue;
    length += Math.hypot(route[index][0] - route[index - 1][0], route[index][1] - route[index - 1][1]);
  }
  ctx.font = `500 26px ${family}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(`${(length / 120).toFixed(1).replace('.', ',')} milles parcourus`, WIDTH - 30, HEIGHT - 52);
  const found = secrets > 0 ? ` · ${secrets} secret${secrets > 1 ? 's' : ''}` : '';
  ctx.fillText(`${stamps.length} tampons · ${stars.length} étoiles d’or${found}`, WIDTH - 30, HEIGHT - 24);
}

export function VoyageMap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [family, setFamily] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const name = handFamily();
    void document.fonts.load(`500 40px ${name}`).catch(() => undefined).finally(() => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (family && canvas.current) draw(canvas.current, family);
  }, [family]);

  const download = useCallback(() => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'carte-de-voyage-kyliann.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, []);

  return (
    <div className="voyage-map">
      <canvas
        ref={canvas}
        className="voyage-map__canvas"
        aria-label="Carte de voyage : la route suivie dans l’archipel, les mers encore inexplorées sous la brume"
      />
      <button type="button" className="stamp-toast__cta voyage-map__download" onClick={download}>
        Télécharger ma carte
      </button>
    </div>
  );
}
