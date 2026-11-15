import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { clamp } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';

/**
 * Retours des chocs, sans rien allouer : réserves fixes recyclées (ronds dans l'eau,
 * gouttes et paillettes, étoiles d'impact), sons limités en cadence, petit sursaut du
 * bateau. Rendu par <ToyFx />.
 */

export type SoundKind = 'soft' | 'wood' | 'duck';

/** Réglages relus à chaque image : mouvement réduit = ni étoiles ni sursaut. */
export const fxSettings = { reduced: false };

/* ------------------------------------------------------------- ronds dans l'eau */

export const RIPPLES = 28;
export const ripples = Array.from({ length: RIPPLES }, () => ({ x: 0, z: 0, start: -10, size: 1 }));
let rippleCursor = 0;

/** Rond dans l'eau à cet endroit (aussi utilisé par la bouteille à la mer, le port…). */
export function ripple(x: number, z: number, time: number, size: number) {
  const slot = ripples[rippleCursor];
  rippleCursor = (rippleCursor + 1) % RIPPLES;
  slot.x = x;
  slot.z = z;
  slot.start = time;
  slot.size = size;
}

/* ----------------------------------------------------------- gouttes, paillettes */

export const DROPS = 160;
export const drops = {
  x: new Float32Array(DROPS),
  y: new Float32Array(DROPS),
  z: new Float32Array(DROPS),
  vx: new Float32Array(DROPS),
  vy: new Float32Array(DROPS),
  vz: new Float32Array(DROPS),
  born: new Float32Array(DROPS).fill(-100),
  life: new Float32Array(DROPS).fill(1),
  size: new Float32Array(DROPS),
  gravity: new Float32Array(DROPS),
  floor: new Float32Array(DROPS),
  color: new Float32Array(DROPS * 3),
  /** 0 goutte (rétrécit), 1 paillette (scintille). */
  kind: new Uint8Array(DROPS),
};
let dropCursor = 0;

function drop(time: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, gravity: number, floor: number, kind: number) {
  const index = dropCursor;
  dropCursor = (dropCursor + 1) % DROPS;
  drops.x[index] = x;
  drops.y[index] = y;
  drops.z[index] = z;
  drops.vx[index] = vx;
  drops.vy[index] = vy;
  drops.vz[index] = vz;
  drops.born[index] = time;
  drops.life[index] = life;
  drops.size[index] = size;
  drops.gravity[index] = gravity;
  drops.floor[index] = floor;
  drops.kind[index] = kind;
  if (kind === 0) {
    drops.color[index * 3] = 0.9;
    drops.color[index * 3 + 1] = 0.98;
    drops.color[index * 3 + 2] = 1;
  } else {
    drops.color[index * 3] = 1;
    drops.color[index * 3 + 1] = 0.82 + Math.random() * 0.12;
    drops.color[index * 3 + 2] = 0.35 + Math.random() * 0.25;
  }
}

/** Gerbe d'eau : une couronne de gouttes qui retombent. */
export function splashBurst(x: number, y: number, z: number, strength: number, time: number) {
  const count = Math.round(5 + clamp(strength, 0, 1.3) * 11);
  for (let k = 0; k < count; k++) {
    const angle = Math.random() * Math.PI * 2;
    const out = (0.6 + Math.random() * 2) * (0.6 + strength);
    drop(
      time,
      x + Math.cos(angle) * 0.3,
      y,
      z + Math.sin(angle) * 0.3,
      Math.cos(angle) * out,
      (2.4 + Math.random() * 3.4) * (0.55 + strength * 0.7),
      Math.sin(angle) * out,
      0.8 + Math.random() * 0.5,
      0.07 + Math.random() * 0.08 * (0.6 + strength),
      9.8,
      y - 0.25,
      0,
    );
  }
}

/** Paillettes dorées (la pyramide qui se reconstruit par magie). */
export function sparkle(x: number, y: number, z: number, time: number, count = 1) {
  for (let k = 0; k < count; k++) {
    drop(
      time,
      x + (Math.random() - 0.5) * 0.7,
      y + (Math.random() - 0.5) * 0.5,
      z + (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 0.9,
      0.3 + Math.random() * 0.9,
      (Math.random() - 0.5) * 0.9,
      0.55 + Math.random() * 0.5,
      0.05 + Math.random() * 0.05,
      -0.5,
      -100,
      1,
    );
  }
}

/* ------------------------------------------------------------ étoiles d'impact */

export const POPS = 8;
export const pops = {
  x: new Float32Array(POPS),
  y: new Float32Array(POPS),
  z: new Float32Array(POPS),
  born: new Float32Array(POPS).fill(-100),
  size: new Float32Array(POPS),
  spin: new Float32Array(POPS),
};
let popCursor = 0;

function pop(x: number, y: number, z: number, size: number, time: number) {
  const index = popCursor;
  popCursor = (popCursor + 1) % POPS;
  pops.x[index] = x;
  pops.y[index] = y;
  pops.z[index] = z;
  pops.born[index] = time;
  pops.size[index] = size;
  pops.spin[index] = Math.random() * Math.PI;
}

/* -------------------------------------------------------------------- sons */

let lastBump = -10;
let lastSplash = -10;

export function bumpSound(kind: SoundKind, strength: number, time: number, gap = 0.07) {
  if (time - lastBump < gap) return;
  lastBump = time;
  ambience.bump(kind, clamp(strength, 0.15, 1));
}

export function splashSound(strength: number, time: number, gap = 0.16) {
  if (time - lastSplash < gap) return;
  lastSplash = time;
  ambience.splash(clamp(strength, 0.06, 0.55));
}

/* ------------------------------------------------------------------ chocs */

/** Le bateau percute un objet : rond, gerbe, étoile, son et une ligne au carnet de bord. */
export function impact(shape: string, kind: SoundKind, strength: number, x: number, z: number, time: number) {
  const water = waveHeight(x, z, time);
  ripple(x, z, time, 0.5 + strength * 0.55);
  splashBurst(x, water + 0.05, z, strength, time);
  if (!fxSettings.reduced) pop(x, water + 1.1 + strength * 0.4, z, 0.5 + strength * 0.75, time);
  bumpSound(kind, 0.3 + strength * 0.7, time, 0.04);
  if (strength > 0.55) splashSound(0.1 + strength * 0.2, time, 0.3);
  logbook.bump(shape);
}

/** Un objet retombe dans l'eau. */
export function splashDown(x: number, z: number, speed: number, size: number, time: number) {
  const strength = clamp(speed / 8, 0.15, 1.1);
  const water = waveHeight(x, z, time);
  ripple(x, z, time, Math.min(size, 1) * (0.5 + strength * 0.6));
  splashBurst(x, water + 0.05, z, strength * 0.85, time);
  splashSound(0.05 + strength * 0.2, time);
}

/** Sursaut du bateau (cabrage + embruns, lus par Boat.tsx) : jamais en mouvement réduit. */
export function jolt(strength: number) {
  if (fxSettings.reduced) return;
  boatState.collision = Math.max(boatState.collision, strength);
}
