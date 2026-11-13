'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { STAR_SPOTS } from '@/data/stars';
import { boatState } from '@/lib/boat-state';
import { STAMPS, useLogbook, type StampId } from '@/lib/logbook';
import { BREAK, voyage } from '@/lib/voyage';
import { hash } from '@/lib/utils/math';

/**
 * Carte de voyage : l'archipel dessiné à la main sur papier, la route réellement suivie par
 * le visiteur à l'encre rouge, ses tampons et ses étoiles d'or. Téléchargeable en carte
 * postale : un souvenir unique de chaque traversée.
 */

const WIDTH = 960;
const HEIGHT = 640;
const WORLD = 128;
const INK = '#4a3b2e';

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

  // Serpent de mer griffonné au large, et sa légende.
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

  // Îles et îlots.
  const lands = [
    { label: 'départ', x: homeIsland.position[0], z: homeIsland.position[1], radius: homeIsland.radius, seed: 1, id: null as StampId | null },
    ...islands.map((island, index) => ({
      label: island.label,
      x: island.position[0],
      z: island.position[1],
      radius: island.radius,
      seed: index * 17 + 3,
      id: `island:${island.id}` as StampId,
    })),
    ...islets.map((islet) => ({
      label: islet.label,
      x: islet.position[0],
      z: islet.position[1],
      radius: islet.radius,
      seed: islet.seed,
      id: `islet:${islet.id}` as StampId,
    })),
  ];
  for (const land of lands) {
    const [x, y] = at(land.x, land.z);
    const r = land.radius * scale;
    // Ombre portée hachurée, sable, herbe, contour à l'encre.
    coastPath(ctx, x + 2.5, y + 3, r, land.seed);
    ctx.fillStyle = 'rgba(74, 59, 46, 0.14)';
    ctx.fill();
    coastPath(ctx, x, y, r, land.seed);
    ctx.fillStyle = '#e8cf9f';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    coastPath(ctx, x, y, r * 0.7, land.seed + 2);
    ctx.fillStyle = '#9dbd6c';
    ctx.fill();
    ctx.font = `500 ${land.radius > 10 ? 24 : 19}px ${family}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(land.label, x, y + r + 20);
    // Tampon posé sur les terres visitées.
    if (land.id && stamps.includes(land.id)) {
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

  // Route suivie : pointillés à l'encre rouge, ancre au départ, bateau à la fin.
  const route = voyage.points();
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
  ctx.fillText(`${stamps.length} tampons · ${stars.length} étoiles d’or`, WIDTH - 30, HEIGHT - 24);
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
      <canvas ref={canvas} className="voyage-map__canvas" aria-label="Carte de voyage : la route suivie dans l’archipel" />
      <button type="button" className="stamp-toast__cta voyage-map__download" onClick={download}>
        Télécharger ma carte
      </button>
    </div>
  );
}
