'use client';

import { useEffect, useState } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { hash } from '@/lib/utils/math';

/**
 * Textures peintes (canvas) de l'île Expériences : enseigne de l'atelier, lettres du
 * portique, écrans, drapeau provençal, tableau noir. Aucune donnée inventée : les seuls
 * textes viennent de `data/*.ts` (nom de l'entreprise, lieu), le reste est du dessin.
 */

let sansFamily: Promise<string> | null = null;

/** Police sans empattement du site (Inter, next/font), chargée une seule fois. */
function loadSansFont() {
  sansFamily ??= (async () => {
    const family = getComputedStyle(document.body).getPropertyValue('--font-inter').trim() || 'system-ui, sans-serif';
    await document.fonts.load(`700 64px ${family}`).catch(() => undefined);
    return family;
  })();
  return sansFamily;
}

export function useSansFont() {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSansFont().then((name) => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return family;
}

function finish(canvas: HTMLCanvasElement, anisotropy = 4) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/** Enseigne en façade : lettres claires sur bandeau anthracite, filet de couleur. */
export function companySignTexture(company: string, family: string, accent: string) {
  const { canvas, ctx } = canvas2d(1024, 112);
  ctx.fillStyle = '#262c35';
  ctx.fillRect(0, 0, 1024, 112);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 100, 1024, 12);
  ctx.fillStyle = '#f6f3ec';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 58px ${family}`;
  ctx.fillText(company, 512, 52, 960);
  return finish(canvas, 8);
}

/** Lettres peintes sur la poutre du portique (le lieu, tiré des données). */
export function girderLettersTexture(text: string, family: string) {
  const { canvas, ctx } = canvas2d(1024, 128);
  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#1f3d73';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 96px ${family}`;
  ctx.fillText(text.toUpperCase(), 512, 68, 980);
  return finish(canvas, 8);
}

/**
 * Atlas des écrans de l'atelier (2 × 2 cases de 256 × 128) : code, maquette de design,
 * grille de boutique, scène 3D en fil de fer. Du dessin abstrait, sans texte ni chiffre.
 */
export function screensAtlasTexture() {
  const { canvas, ctx } = canvas2d(512, 256);
  // Code.
  ctx.fillStyle = '#17202b';
  ctx.fillRect(0, 0, 256, 128);
  const code = ['#ff9ad5', '#bff6ff', '#ffe28a', '#9be7a4', '#bff6ff', '#7fa7b8'];
  for (let line = 0; line < 9; line++) {
    const indent = [0, 1, 2, 2, 1, 2, 3, 1, 0][line] * 14;
    let x = 12 + indent;
    for (let word = 0; word < 3; word++) {
      const width = 14 + hash(line * 7.1 + word * 3.3) * 40;
      ctx.fillStyle = code[(line + word) % code.length];
      ctx.fillRect(x, 10 + line * 12.5, width, 6);
      x += width + 7;
      if (x > 220) break;
    }
  }
  // Maquette de design : plan de travail, formes et palette.
  ctx.fillStyle = '#2b2f3a';
  ctx.fillRect(256, 0, 256, 128);
  ctx.fillStyle = '#f7f3ec';
  ctx.fillRect(296, 14, 120, 100);
  ctx.fillStyle = '#c9a7f0';
  ctx.fillRect(306, 24, 100, 34);
  ctx.fillStyle = '#e2553f';
  ctx.beginPath();
  ctx.arc(330, 86, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f6fc0';
  ctx.fillRect(354, 74, 46, 8);
  ctx.fillRect(354, 90, 34, 8);
  ['#c9a7f0', '#e2553f', '#f2c14e', '#3fb5a8', '#2f4f8f'].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(432, 18 + index * 20, 18, 14);
  });
  // Boutique : vignettes de produits (écrans) et boutons.
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 128, 256, 128);
  ctx.fillStyle = '#262c35';
  ctx.fillRect(0, 128, 256, 16);
  for (let column = 0; column < 3; column++) {
    const x = 16 + column * 80;
    ctx.fillStyle = '#dfe6ee';
    ctx.fillRect(x, 154, 66, 52);
    ctx.fillStyle = '#2a3442';
    ctx.fillRect(x + 9, 162, 48, 32);
    ctx.fillStyle = ['#7fd7e8', '#c9a7f0', '#f2c14e'][column];
    ctx.fillRect(x + 12, 165, 42, 26);
    ctx.fillStyle = '#e2553f';
    ctx.fillRect(x, 214, 40, 12);
    ctx.fillStyle = '#b9c0c8';
    ctx.fillRect(x, 232, 58, 6);
  }
  // Scène 3D : un icosaèdre en fil de fer sur fond nuit.
  ctx.fillStyle = '#101826';
  ctx.fillRect(256, 128, 256, 128);
  ctx.strokeStyle = '#7ff4e8';
  ctx.lineWidth = 2;
  const cx = 384;
  const cy = 192;
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2 + 0.3;
    return [cx + Math.cos(angle) * 44, cy + Math.sin(angle) * 44];
  });
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length];
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.moveTo(x, y);
    ctx.lineTo(cx + (index % 2 ? 10 : -12), cy + (index % 3 ? -8 : 12));
  });
  ctx.stroke();
  ctx.fillStyle = '#c9a7f0';
  points.forEach(([x, y]) => ctx.fillRect(x - 3, y - 3, 6, 6));
  return finish(canvas);
}

/**
 * Page web abstraite qui défile sur le grand écran du parvis : bandeau, visuel, cartes
 * produits, boutons. La texture se répète verticalement (défilement par offset, gratuit).
 */
export function scrollingPageTexture() {
  const { canvas, ctx } = canvas2d(256, 512);
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#262c35';
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillStyle = '#c9a7f0';
  ctx.fillRect(12, 8, 30, 6);
  // Visuel d'accroche : dégradé mer / soleil.
  const hero = ctx.createLinearGradient(0, 30, 0, 150);
  hero.addColorStop(0, '#7fd7e8');
  hero.addColorStop(1, '#2f6fc0');
  ctx.fillStyle = hero;
  ctx.fillRect(10, 30, 236, 120);
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(190, 70, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(24, 100, 110, 10);
  ctx.fillRect(24, 116, 70, 8);
  ctx.fillStyle = '#e2553f';
  ctx.fillRect(24, 132, 54, 12);
  // Cartes produits.
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 2; column++) {
      const x = 12 + column * 120;
      const y = 166 + row * 108;
      ctx.fillStyle = '#e4e9ef';
      ctx.fillRect(x, y, 112, 74);
      ctx.fillStyle = '#2a3442';
      ctx.fillRect(x + 18, y + 10, 76, 50);
      ctx.fillStyle = ['#7fd7e8', '#c9a7f0', '#f2c14e', '#9be7a4', '#ff9ad5', '#7fa7b8'][(row * 2 + column) % 6];
      ctx.fillRect(x + 22, y + 14, 68, 42);
      ctx.fillStyle = '#b9c0c8';
      ctx.fillRect(x, y + 80, 80, 6);
      ctx.fillStyle = '#262c35';
      ctx.fillRect(x, y + 90, 46, 8);
    }
  }
  const texture = finish(canvas);
  texture.wrapT = RepeatWrapping;
  return texture;
}

/** Drapeau « Sang et Or » de Provence : quatre pals rouges sur fond or. */
export function provenceFlagTexture() {
  const { canvas, ctx } = canvas2d(288, 192);
  const stripe = 288 / 9;
  for (let index = 0; index < 9; index++) {
    ctx.fillStyle = index % 2 === 0 ? '#f5c63a' : '#d23a2c';
    ctx.fillRect(index * stripe, 0, stripe + 1, 192);
  }
  return finish(canvas);
}

/** Tableau noir de l'école : croquis de maquette d'interface à la craie. */
export function chalkboardTexture() {
  const { canvas, ctx } = canvas2d(256, 160);
  ctx.fillStyle = '#2f4a3c';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = 'rgba(240, 240, 228, 0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Écran de téléphone, en-tête, image, lignes de texte, bouton.
  ctx.strokeRect(26, 18, 74, 124);
  ctx.strokeRect(34, 30, 58, 12);
  ctx.beginPath();
  ctx.moveTo(34, 52);
  ctx.lineTo(92, 92);
  ctx.moveTo(92, 52);
  ctx.lineTo(34, 92);
  ctx.stroke();
  ctx.strokeRect(34, 52, 58, 40);
  for (let line = 0; line < 3; line++) {
    ctx.beginPath();
    ctx.moveTo(34, 102 + line * 9);
    ctx.lineTo(34 + 52 - line * 12, 102 + line * 9);
    ctx.stroke();
  }
  // Flèche et seconde vue.
  ctx.beginPath();
  ctx.moveTo(112, 80);
  ctx.quadraticCurveTo(128, 60, 146, 80);
  ctx.lineTo(140, 72);
  ctx.moveTo(146, 80);
  ctx.lineTo(136, 82);
  ctx.stroke();
  ctx.strokeRect(156, 30, 80, 100);
  ctx.beginPath();
  ctx.arc(196, 62, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(170, 92, 52, 14);
  ctx.strokeStyle = 'rgba(242, 193, 78, 0.9)';
  ctx.beginPath();
  ctx.moveTo(166, 116);
  ctx.lineTo(226, 116);
  ctx.stroke();
  return finish(canvas);
}
