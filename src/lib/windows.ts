import { Color, MeshStandardMaterial } from 'three';
import { hash, smoothstep } from '@/lib/utils/math';

/**
 * Fenêtres qui s'allument une à une au crépuscule.
 *
 * Chaque fenêtre tombe dans un des BUCKETS « heures d'allumage » selon sa graine : au
 * coucher du soleil, les maisons s'éclairent progressivement au lieu de toutes à la fois.
 * Les matériaux sont partagés par (couleur, bucket) et mis à jour une seule fois par
 * image (NightGlow appelle `updateWindows`).
 */

const BUCKETS = 7;

interface WindowEntry {
  material: MeshStandardMaterial;
  /** Seuil du facteur nuit (0 → 1) où la fenêtre s'allume. */
  on: number;
  intensity: number;
}

const entries = new Map<string, WindowEntry>();

/**
 * Matériau de vitre partagé. `seed` choisit l'heure d'allumage ; `lit` la couleur de
 * la lumière intérieure ; `glass` la couleur de la vitre de jour.
 */
export function windowMaterial(seed: number, lit = '#ffc46b', glass = '#36506b', intensity = 2.2) {
  const bucket = Math.floor(hash(seed * 7.13 + 0.5) * BUCKETS);
  const key = `${lit}|${glass}|${bucket}|${intensity}`;
  const existing = entries.get(key);
  if (existing) return existing.material;
  const material = new MeshStandardMaterial({
    color: glass,
    emissive: new Color(lit),
    emissiveIntensity: 0,
    roughness: 0.35,
    metalness: 0.1,
  });
  material.name = `window:${key}`;
  // Premières fenêtres au coucher (nuit ≈ 0.12), dernières en pleine nuit (≈ 0.62).
  entries.set(key, { material, on: 0.12 + (bucket / (BUCKETS - 1)) * 0.5, intensity });
  return material;
}

export function updateWindows(dayNight: number) {
  entries.forEach((entry) => {
    entry.material.emissiveIntensity = smoothstep(entry.on, entry.on + 0.1, dayNight) * entry.intensity;
  });
}
