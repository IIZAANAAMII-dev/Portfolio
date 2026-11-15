import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
} from 'three';
import { site } from '@/data/site';
import { hullPaintCanvas, rakeX } from './hull';
import { BOAT_COLORS as C } from './parts';

/** Petites textures peintes à la main (canvas), créées une seule fois côté client. */
function texture(canvas: HTMLCanvasElement, mipmaps = true) {
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = ClampToEdgeWrapping;
  map.wrapT = ClampToEdgeWrapping;
  if (!mipmaps) {
    map.generateMipmaps = false;
    map.minFilter = LinearFilter;
  }
  map.anisotropy = 4;
  return map;
}

/** Peinture de coque (lue par hauteur / profondeur sous le livet, sans mipmaps : bandes nettes). */
export function hullTexture() {
  const map = texture(hullPaintCanvas({
    hull: C.hull,
    seam: C.hullSeam,
    antifouling: C.antifouling,
    bootTop: C.bootTop,
    pinstripe: C.pinstripe,
    strake: C.strake,
  }), false);
  map.flipY = false;
  return map;
}

/** Vitre : bleu profond, deux reflets obliques de ciel (dessin animé, pas de réalisme). */
export function glassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#3b6c80');
  gradient.addColorStop(1, '#1b3343');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(225, 245, 250, 0.42)';
  ctx.beginPath();
  ctx.moveTo(10, 64);
  ctx.lineTo(26, 64);
  ctx.lineTo(50, 0);
  ctx.lineTo(34, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(225, 245, 250, 0.25)';
  ctx.beginPath();
  ctx.moveTo(32, 64);
  ctx.lineTo(37, 64);
  ctx.lineTo(61, 0);
  ctx.lineTo(56, 0);
  ctx.fill();
  return texture(canvas);
}

/** Halo des feux : disque doux, additif. */
export function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return texture(canvas);
}

/**
 * Nom peint sur le tableau arrière, tiré des données du site (prénom, et la terre d'origine
 * en dessous comme le port d'attache d'un bateau de pêche). Lettres crème cernées de marine.
 */
export function nameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const name = site.shortName.toUpperCase();
  const home = site.origin.split(',')[0].trim().toUpperCase();
  ctx.font = '700 84px Georgia, "DejaVu Serif", "Times New Roman", serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = C.navyDark;
  ctx.strokeText(name, 256, 58, 480);
  ctx.fillStyle = C.bootTop;
  ctx.fillText(name, 256, 58, 480);
  ctx.font = '700 34px Georgia, "DejaVu Serif", "Times New Roman", serif';
  ctx.lineWidth = 6;
  ctx.strokeText(home, 256, 128, 300);
  ctx.fillText(home, 256, 128, 300);
  return texture(canvas);
}

/** Support du nom : une grille qui épouse le tableau bombé et incliné, un peu en arrière de lui. */
export function nameDecal() {
  const columns = 12;
  const width = 1.12;
  const y0 = 0.3;
  const y1 = 0.3 + (width * 160) / 512;
  const positions: number[] = [];
  const uvs: number[] = [];
  const point = (c: number, row: number) => {
    const z = (c / columns - 0.5) * width;
    const y = row === 0 ? y0 : y1;
    // Le tableau : x = rakeX(0, y, z) ; on se décolle de 8 mm vers l'arrière.
    positions.push(rakeX(0, y, z) - 0.008, y, z);
    // Vu de l'arrière, tribord (+Z) est à droite : u croît avec z.
    uvs.push(c / columns, row);
  };
  // Ordre (z, puis y) : normale z × y = -X, vers l'arrière.
  for (let c = 0; c < columns; c++) {
    point(c, 0); point(c + 1, 0); point(c + 1, 1);
    point(c, 0); point(c + 1, 1); point(c, 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.computeVertexNormals();
  return geometry;
}
