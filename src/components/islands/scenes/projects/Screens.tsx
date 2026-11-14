'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import { nightGlow } from '@/lib/substance-models';
import { hash } from '@/lib/utils/math';

/**
 * Écrans de la ville : les vraies captures des sites (déposées dans /public/projects/<id>/
 * et listées dans data/projects.ts) s'affichent sur les moniteurs 3D, chargées à la demande.
 * Tant qu'une capture n'est pas chargée — ou si un projet n'en a pas — l'écran montre une
 * mise en page abstraite dessinée à la main (blocs, aucun faux texte ni faux chiffre).
 */

/* --------------------------------------------------------------- captures réelles */

const loaded = new Map<string, Promise<Texture>>();

function loadScreenshot(url: string) {
  let promise = loaded.get(url);
  if (!promise) {
    promise = new TextureLoader().loadAsync(url).then((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    });
    // Un échec (fichier absent) laisse simplement la mise en page de repli.
    promise.catch(() => loaded.delete(url));
    loaded.set(url, promise);
  }
  return promise;
}

/** Capture chargée (ou null tant qu'elle arrive / si elle manque). */
export function useScreenshot(url?: string) {
  const [state, setState] = useState<{ url: string; texture: Texture } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadScreenshot(url)
      .then((texture) => {
        if (!cancelled) setState({ url, texture });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state && state.url === url ? state.texture : null;
}

/* ------------------------------------------------------ mises en page de repli */

export type Layout = 'bento' | 'grid' | 'form' | 'space' | 'clinic' | 'console';

const PALETTES: Record<Layout, { bg: string; card: string; ink: string; soft: string; accent: string; accent2: string }> = {
  bento: { bg: '#f6f8fc', card: '#e6ecf6', ink: '#1d2a44', soft: '#c9d4e6', accent: '#2f7bff', accent2: '#9ec2ff' },
  grid: { bg: '#ffffff', card: '#eef2f8', ink: '#22314d', soft: '#d3dbe8', accent: '#1f6fe0', accent2: '#ffb24a' },
  form: { bg: '#f3f6fb', card: '#ffffff', ink: '#1d2a44', soft: '#d4dceb', accent: '#2f7bff', accent2: '#cfe0ff' },
  space: { bg: '#07081a', card: '#121633', ink: '#e8e6ff', soft: '#2a2f5c', accent: '#8b6bff', accent2: '#5ee0ff' },
  clinic: { bg: '#f2f7f6', card: '#ffffff', ink: '#1f3b3a', soft: '#cfe2df', accent: '#2bb79a', accent2: '#7fd6ef' },
  console: { bg: '#0d1424', card: '#16213a', ink: '#bfe6ff', soft: '#24365c', accent: '#ff8a3d', accent2: '#5ee0ff' },
};

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Lignes de « texte » abstraites : de simples barres arrondies. */
function bars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lines: number, color: string, size = 7, seed = 1) {
  ctx.fillStyle = color;
  for (let line = 0; line < lines; line++) {
    const length = w * (0.55 + hash(seed + line * 3.7) * 0.45) * (line === lines - 1 ? 0.6 : 1);
    rounded(ctx, x, y + line * size * 2, length, size, size / 2);
    ctx.fill();
  }
}

function drawLayout(layout: Layout) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const p = PALETTES[layout];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, 512, 320);
  // Barre de navigation commune.
  ctx.fillStyle = layout === 'space' || layout === 'console' ? '#00000055' : p.ink;
  ctx.fillRect(0, 0, 512, 30);
  ctx.fillStyle = p.accent;
  rounded(ctx, 14, 9, 34, 12, 6);
  ctx.fill();
  for (let item = 0; item < 4; item++) {
    ctx.fillStyle = layout === 'space' || layout === 'console' ? p.soft : '#ffffff55';
    rounded(ctx, 200 + item * 58, 12, 40, 6, 3);
    ctx.fill();
  }
  if (layout === 'bento') {
    bars(ctx, 26, 64, 170, 2, p.ink, 16, 3);
    bars(ctx, 26, 132, 150, 3, p.soft, 7, 9);
    ctx.fillStyle = p.accent;
    rounded(ctx, 26, 196, 92, 26, 13);
    ctx.fill();
    const cells: [number, number, number, number, string][] = [
      [236, 46, 136, 128, p.accent2],
      [380, 46, 112, 128, p.card],
      [236, 182, 108, 124, p.card],
      [352, 182, 140, 124, p.accent],
    ];
    cells.forEach(([x, y, w, h, color], index) => {
      ctx.fillStyle = color;
      rounded(ctx, x, y, w, h, 12);
      ctx.fill();
      bars(ctx, x + 12, y + h - 30, w * 0.6, 2, index === 3 ? '#ffffffcc' : p.ink, 6, index * 5);
    });
  } else if (layout === 'grid') {
    bars(ctx, 26, 48, 220, 1, p.ink, 14, 2);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 26 + col * 120;
        const y = 82 + row * 116;
        ctx.fillStyle = p.card;
        rounded(ctx, x, y, 106, 104, 10);
        ctx.fill();
        ctx.fillStyle = (row + col) % 3 === 0 ? p.accent : p.soft;
        rounded(ctx, x + 22, y + 14, 62, 46, 6);
        ctx.fill();
        bars(ctx, x + 10, y + 70, 80, 2, p.ink, 6, row * 4 + col);
      }
    }
  } else if (layout === 'form') {
    bars(ctx, 26, 56, 180, 2, p.ink, 15, 7);
    bars(ctx, 26, 124, 170, 4, p.soft, 7, 11);
    ctx.fillStyle = p.card;
    rounded(ctx, 262, 48, 226, 252, 14);
    ctx.fill();
    for (let field = 0; field < 4; field++) {
      ctx.fillStyle = p.soft;
      rounded(ctx, 282, 70 + field * 48, 186, 30, 8);
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    rounded(ctx, 282, 262, 120, 26, 13);
    ctx.fill();
  } else if (layout === 'space') {
    for (let star = 0; star < 140; star++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + hash(star * 1.3) * 0.6})`;
      ctx.fillRect(hash(star * 7.1) * 512, 30 + hash(star * 3.9) * 290, 1.5, 1.5);
    }
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1.5;
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.ellipse(320, 178, 150 - ring * 34, 70 - ring * 16, -0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(320, 178, 0, 320, 178, 60);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.2, '#c9c2ff');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(250, 110, 140, 140);
    bars(ctx, 26, 110, 150, 1, p.ink, 22, 1);
    bars(ctx, 26, 150, 140, 2, p.soft, 7, 4);
  } else if (layout === 'clinic') {
    ctx.fillStyle = p.card;
    ctx.fillRect(0, 30, 512, 290);
    ctx.fillStyle = '#d8cbb8';
    ctx.fillRect(250, 30, 262, 290);
    ctx.fillStyle = '#20262c';
    rounded(ctx, 318, 90, 130, 86, 4);
    ctx.fill();
    bars(ctx, 26, 150, 190, 2, p.ink, 18, 6);
    bars(ctx, 26, 228, 160, 2, p.soft, 7, 3);
  } else {
    // Console : courbes et barres qui évoquent un tableau de bord, sans aucun chiffre.
    for (let card = 0; card < 3; card++) {
      ctx.fillStyle = p.card;
      rounded(ctx, 20 + card * 162, 46, 150, 118, 10);
      ctx.fill();
      ctx.strokeStyle = card === 1 ? p.accent : p.accent2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let step = 0; step <= 12; step++) {
        const x = 32 + card * 162 + step * 10.5;
        const y = 140 - (Math.sin(step * 0.8 + card) * 0.5 + 0.5) * 60 - step * 2;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = p.card;
    rounded(ctx, 20, 176, 472, 128, 10);
    ctx.fill();
    for (let bar = 0; bar < 18; bar++) {
      ctx.fillStyle = bar % 5 === 0 ? p.accent : p.soft;
      const h = 20 + hash(bar * 2.3) * 80;
      ctx.fillRect(40 + bar * 25, 290 - h, 14, h);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const layouts = new Map<Layout, Texture>();

export function layoutTexture(layout: Layout) {
  let texture = layouts.get(layout);
  if (!texture) {
    texture = drawLayout(layout);
    layouts.set(layout, texture);
  }
  return texture;
}

/* ------------------------------------------------------------------- matériaux */

const screenMaterials = new Map<Texture, MeshStandardMaterial>();

/** Écran allumé : l'image est émise (lisible à l'ombre comme en plein soleil). */
export function screenMaterial(texture: Texture) {
  let material = screenMaterials.get(texture);
  if (!material) {
    material = new MeshStandardMaterial({
      color: '#000000',
      emissive: new Color('#ffffff'),
      emissiveMap: texture,
      emissiveIntensity: 0.92,
      roughness: 0.32,
      metalness: 0,
    });
    material.name = 'projects:screen';
    nightGlow.set(material, { day: 0.92, night: 1.18 });
    screenMaterials.set(texture, material);
  }
  return material;
}

/* ----------------------------------------------------------------------- écran */

/** Recadrage dans l'image : [gauche, haut, droite, bas] (fractions, origine en haut à gauche). */
export type Crop = [number, number, number, number];

const FULL: Crop = [0, 0, 1, 1];

function applyCrop(geometry: PlaneGeometry, crop: Crop) {
  const uv = geometry.attributes.uv;
  // PlaneGeometry : sommets (haut-gauche, haut-droite, bas-gauche, bas-droite).
  const [left, top, right, bottom] = crop;
  uv.setXY(0, left, 1 - top);
  uv.setXY(1, right, 1 - top);
  uv.setXY(2, left, 1 - bottom);
  uv.setXY(3, right, 1 - bottom);
  uv.needsUpdate = true;
}

/**
 * Un écran. `url` : capture réelle (chargée à la demande) ; `fallback` : mise en page
 * dessinée en attendant (ou à défaut). `pan` fait glisser lentement le cadrage d'un
 * recadrage à l'autre (petit travelling sur la page, comme on la parcourt).
 */
export function Screen({
  width,
  height,
  url,
  fallback = 'bento',
  crop = FULL,
  pan,
  panSpeed = 0.09,
  position,
  rotation,
}: {
  width: number;
  height: number;
  url?: string;
  fallback?: Layout;
  crop?: Crop;
  pan?: [Crop, Crop];
  panSpeed?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const shot = useScreenshot(url);
  const texture = shot ?? layoutTexture(fallback);
  const material = screenMaterial(texture);
  const usingShot = Boolean(shot);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, height);
    applyCrop(plane, usingShot ? crop : FULL);
    return plane;
  }, [crop, height, usingShot, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef<Mesh>(null);
  const phase = useMemo(() => hash(width * 13.1 + height * 7.3) * 6.28, [height, width]);

  useFrame((state) => {
    if (!pan || !usingShot || !mesh.current) return;
    // Aller-retour très doux entre les deux cadrages.
    const t = 0.5 - Math.cos(state.clock.elapsedTime * panSpeed * Math.PI * 2 + phase) * 0.5;
    const eased = t * t * (3 - 2 * t);
    const [a, b] = pan;
    const uv = (mesh.current.geometry as PlaneGeometry).attributes.uv;
    const left = a[0] + (b[0] - a[0]) * eased;
    const top = a[1] + (b[1] - a[1]) * eased;
    const right = a[2] + (b[2] - a[2]) * eased;
    const bottom = a[3] + (b[3] - a[3]) * eased;
    uv.setXY(0, left, 1 - top);
    uv.setXY(1, right, 1 - top);
    uv.setXY(2, left, 1 - bottom);
    uv.setXY(3, right, 1 - bottom);
    uv.needsUpdate = true;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} position={position} rotation={rotation} raycast={() => null} />;
}
