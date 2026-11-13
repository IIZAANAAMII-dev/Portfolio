'use client';

/**
 * Journal de route : le tracé réel du bateau, un point tous les quelques mètres. Il sert à
 * dessiner la carte de voyage du carnet de bord. Gardé dans le navigateur du visiteur
 * (facultatif), jamais envoyé ailleurs.
 */

const STORAGE_KEY = 'kyliann-voyage-v1';
const STEP = 3;
const MAX_POINTS = 1600;

let points: number[] = [];
let loaded = false;
let dirty = false;
let lastSave = 0;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) points = (JSON.parse(raw) as number[]).filter((value) => Number.isFinite(value));
  } catch {
    points = [];
  }
}

function save(now: number) {
  if (!dirty || now - lastSave < 4000) return;
  lastSave = now;
  dirty = false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  } catch {
    // Stockage indisponible : le tracé vit le temps de la visite.
  }
}

export const voyage = {
  /** Ajoute la position du bateau si elle s'est assez éloignée du dernier point. */
  record(x: number, z: number) {
    load();
    const count = points.length / 2;
    if (count > 0) {
      const lx = points[points.length - 2];
      const lz = points[points.length - 1];
      if (Math.hypot(x - lx, z - lz) < STEP) {
        save(Date.now());
        return;
      }
    }
    points.push(Math.round(x * 2) / 2, Math.round(z * 2) / 2);
    // Trop long : on garde un point sur deux de la première moitié (le début se simplifie).
    if (points.length / 2 > MAX_POINTS) {
      const half = Math.floor(points.length / 4) * 2;
      const head: number[] = [];
      for (let index = 0; index < half; index += 4) head.push(points[index], points[index + 1]);
      points = head.concat(points.slice(half));
    }
    dirty = true;
    save(Date.now());
  },
  points(): [number, number][] {
    load();
    const result: [number, number][] = [];
    for (let index = 0; index < points.length; index += 2) result.push([points[index], points[index + 1]]);
    return result;
  },
  reset() {
    points = [];
    dirty = true;
    lastSave = 0;
    save(Date.now());
  },
};
