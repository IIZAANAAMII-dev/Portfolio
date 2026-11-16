'use client';

import { create } from 'zustand';
import { logbook, STAMPS, type StampId } from '@/lib/logbook';
import type { Vec2 } from '@/types';

/**
 * Atelier de peinture du port de départ : la livrée du bateau (couleurs de coque) et son
 * pavillon, choisis dans le monde 3D (pots de peinture, râtelier à pavillons) et gardés
 * dans le navigateur du visiteur (localStorage, facultatif). Certains se méritent : ils
 * restent sous cadenas tant que le tampon du carnet n'est pas gagné.
 *
 * Ce module ne dépend pas de three.js : couleurs, textes et dessins de pavillons (canvas 2D).
 */

export type LiveryId = 'breton' | 'marine' | 'emeraude' | 'sardinier' | 'phare' | 'nuit';
export type FlagId = 'gwenn' | 'marseille' | 'dev' | 'pirate';
export type PaintKind = 'livery' | 'flag';

/** Couleurs d'une livrée : coque, carène, liserés, préceinte, boiseries peintes de la timonerie. */
export interface LiveryColors {
  hull: string;
  seam: string;
  antifouling: string;
  bootTop: string;
  pinstripe: string;
  strake: string;
  /** Encadrements, bandeau et chant du toit de la timonerie. */
  trim: string;
}

export interface Livery {
  id: LiveryId;
  name: string;
  colors: LiveryColors;
  /** Tampon du carnet qui débloque la livrée. */
  lock?: StampId;
}

export interface Pennant {
  id: FlagId;
  name: string;
  lock?: StampId;
  /** Découpe en queue d'aronde (le reste est rectangulaire). */
  swallowtail?: boolean;
}

export const LIVERIES: Livery[] = [
  {
    id: 'breton',
    name: 'Rouge breton',
    colors: { hull: '#c33e2c', seam: '#ad3324', antifouling: '#23384c', bootTop: '#f3ead6', pinstripe: '#1f3348', strake: '#f5efe2', trim: '#2c4862' },
  },
  {
    id: 'marine',
    name: 'Bleu marine',
    colors: { hull: '#21518f', seam: '#1c477e', antifouling: '#b23f30', bootTop: '#f3ead6', pinstripe: '#f1e6cd', strake: '#f5efe2', trim: '#1f3a5c' },
  },
  {
    id: 'emeraude',
    name: 'Vert d’eau',
    colors: { hull: '#2b8a78', seam: '#257a6a', antifouling: '#23384c', bootTop: '#f3ead6', pinstripe: '#1b3b3c', strake: '#f5efe2', trim: '#1f4d4c' },
  },
  {
    id: 'sardinier',
    name: 'Jaune sardinier',
    colors: { hull: '#e8b53a', seam: '#d4a02f', antifouling: '#2a3a4e', bootTop: '#f7f0e0', pinstripe: '#24364f', strake: '#f7f0e0', trim: '#24486a' },
  },
  {
    id: 'phare',
    name: 'Blanc phare',
    lock: 'lighthouse',
    colors: { hull: '#f1ece1', seam: '#e0d9cb', antifouling: '#b8382c', bootTop: '#1f3348', pinstripe: '#c33e2c', strake: '#c33e2c', trim: '#b8382c' },
  },
  {
    id: 'nuit',
    name: 'Nuit et or',
    lock: 'stars',
    colors: { hull: '#1d2129', seam: '#171b22', antifouling: '#6b2a22', bootTop: '#d9b45a', pinstripe: '#d9b45a', strake: '#2a2f3b', trim: '#c9a24a' },
  },
];

export const FLAGS: Pennant[] = [
  { id: 'gwenn', name: 'Gwenn-ha-Du' },
  { id: 'marseille', name: 'Croix de Marseille' },
  { id: 'dev', name: 'Pavillon « </> »', swallowtail: true },
  { id: 'pirate', name: 'Pavillon noir', lock: 'edge' },
];

export const DEFAULT_LIVERY: LiveryId = 'breton';
export const DEFAULT_FLAG: FlagId = 'gwenn';

export function liveryById(id: LiveryId) {
  return LIVERIES.find((livery) => livery.id === id) ?? LIVERIES[0];
}

export function flagById(id: FlagId) {
  return FLAGS.find((flag) => flag.id === id) ?? FLAGS[0];
}

/** Libellé du tampon qui débloque un objet (texte réel du carnet). */
export function lockHint(lock: StampId) {
  return STAMPS.find((stamp) => stamp.id === lock)?.hint ?? '';
}

export function isUnlocked(item: { lock?: StampId }) {
  return !item.lock || logbook.has(item.lock);
}

/* ------------------------------------------------------------------ choix enregistré */

const STORAGE_KEY = 'kyliann-livery-v1';

function load(): { livery: LiveryId; flag: FlagId } {
  const fallback = { livery: DEFAULT_LIVERY, flag: DEFAULT_FLAG };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { livery?: string; flag?: string };
    return {
      livery: LIVERIES.some((entry) => entry.id === parsed.livery) ? (parsed.livery as LiveryId) : DEFAULT_LIVERY,
      flag: FLAGS.some((entry) => entry.id === parsed.flag) ? (parsed.flag as FlagId) : DEFAULT_FLAG,
    };
  } catch {
    return fallback;
  }
}

function save(state: { livery: LiveryId; flag: FlagId }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Navigation privée ou stockage bloqué : le choix vit le temps de la visite.
  }
}

interface LiveryState {
  livery: LiveryId;
  flag: FlagId;
  /** Applique (et garde) un choix. */
  apply: (kind: PaintKind, id: string) => void;
}

/** Lu dès le chargement du module : le bateau de l'intro porte déjà la livrée choisie. */
export const useLivery = create<LiveryState>((set, get) => ({
  ...load(),
  apply: (kind, id) => {
    const next = kind === 'livery'
      ? { livery: id as LiveryId, flag: get().flag }
      : { livery: get().livery, flag: id as FlagId };
    set(next);
    save(next);
  },
}));

/* ------------------------------------------------------------------ commandes en cours */

/**
 * État de l'atelier, hors React (lu à chaque image par le bateau, la caméra et le décor).
 * Horloge : celle de three (secondes).
 */
export const atelier = {
  /**
   * Commandes en attente (une livrée, un pavillon au plus) : exécutées dans l'ordre dès que le
   * bateau est amarré au port de départ.
   */
  queue: [] as { kind: PaintKind; id: string }[],
  /** Travail en cours sur le bateau (coup de pinceau, pavillon hissé). */
  job: null as null | { kind: PaintKind; id: string; from: string; startedAt: number; duration: number },
  /** Dernier travail terminé (le décor fait briller l'objet choisi). */
  doneAt: -1,
  /** Plan rapproché de l'atelier demandé (clic sur l'appentis ou sur un pot). */
  focus: false,
  /** Instant (horloge three) de la dernière demande de plan rapproché. */
  focusAt: -1,
  /** Objet sous cadenas qu'on vient d'essayer (il secoue la tête). */
  denied: { id: '', at: -1 },
  /** Point où le bateau a été envoyé pour rentrer au port (une autre cible annule la commande). */
  approach: null as Vec2 | null,
};

/* ------------------------------------------------------------------ pavillons (canvas 2D) */

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Dessine un pavillon (hors Gwenn-ha-Du, dessiné par l'îlot breton) dans le rectangle donné.
 * Rendu « peint à la main » : aplats francs, un liseré d'ourlet côté drisse.
 */
export function paintFlag(ctx: CanvasRenderingContext2D, id: FlagId, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (flagById(id).swallowtail) {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width * 0.74, height / 2);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
  } else {
    ctx.rect(0, 0, width, height);
  }
  ctx.closePath();
  ctx.clip();
  if (id === 'marseille') {
    // D'argent à la croix d'azur.
    ctx.fillStyle = '#f6f2ea';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#2f6db5';
    const bar = height * 0.2;
    ctx.fillRect(0, (height - bar) / 2, width, bar);
    ctx.fillRect(width * 0.5 - bar / 2, 0, bar, height);
  } else if (id === 'dev') {
    // Pavillon du développeur : marine, chevrons « </> » crème, liseré corail.
    ctx.fillStyle = '#1f3348';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e8724d';
    ctx.fillRect(0, height * 0.82, width, height * 0.1);
    ctx.strokeStyle = '#f3ead6';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = height * 0.085;
    const cy = height * 0.43;
    const s = height * 0.2;
    const cx = width * 0.38;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.9, cy - s);
    ctx.lineTo(cx - s * 1.9, cy);
    ctx.lineTo(cx - s * 0.9, cy + s);
    ctx.moveTo(cx + s * 0.9, cy - s);
    ctx.lineTo(cx + s * 1.9, cy);
    ctx.lineTo(cx + s * 0.9, cy + s);
    ctx.moveTo(cx + s * 0.35, cy - s * 1.25);
    ctx.lineTo(cx - s * 0.35, cy + s * 1.25);
    ctx.stroke();
  } else if (id === 'pirate') {
    // Pavillon noir : tête de mort et tibias croisés.
    ctx.fillStyle = '#16171b';
    ctx.fillRect(0, 0, width, height);
    const cx = width * 0.5;
    const cy = height * 0.44;
    const r = height * 0.2;
    ctx.strokeStyle = '#efe9dc';
    ctx.lineCap = 'round';
    ctx.lineWidth = height * 0.075;
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.7, cy + r * 1.75);
    ctx.lineTo(cx + r * 1.7, cy + r * 0.45);
    ctx.moveTo(cx + r * 1.7, cy + r * 1.75);
    ctx.lineTo(cx - r * 1.7, cy + r * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#efe9dc';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - r * 0.55, cy + r * 0.5, r * 1.1, r * 0.7);
    ctx.fillStyle = '#16171b';
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy - r * 0.05, r * 0.26, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.38, cy - r * 0.05, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - r * 0.06, cy + r * 0.35, r * 0.12, r * 0.25);
  } else {
    // Repli : pavillon d'atelier (étoile d'or sur fond marine).
    ctx.fillStyle = '#1f3348';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e0a93f';
    star(ctx, width / 2, height / 2, height * 0.3);
  }
  // Ourlet côté drisse.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(0, 0, width * 0.035, height);
  ctx.restore();
}
