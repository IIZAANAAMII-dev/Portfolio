import { Vector3 } from 'three';

/**
 * État partagé du kraken de la mer interdite (hors React, lu et écrit à chaque image).
 * Complète `ecologyState` (lib/ecology.ts), dont l'interface reste celle de l'ancien monstre :
 * caméra, bateau, sillage et océan continuent de lire `monsterX/Z`, `leviathanAttack`…
 */

/** Bras dessinés (un seul draw call pour tous) et échantillons du squelette par bras. */
export const ARMS = 8;
export const SPINE = 48;
/** Lignes du squelette par bras : centre + rayon, face ventrale, tangente + humidité. */
export const SPINE_ROWS = 3;

/** Silhouette de la tête (repère local : +X vers le bateau, +Y haut, ±Z les flancs). */
export const HEAD = {
  rx: 7.4,
  ry: 6.2,
  rz: 7.8,
  /** Le manteau s'étire vers l'arrière, comme un calmar. */
  mantle: 1.8,
  eyeRadius: 2.05,
} as const;

export const krakenState = {
  /** Faux : rien à dessiner, tout le rig est masqué (aucun draw call). */
  visible: false,
  /** Horloge réelle (ondulations, gouttes). */
  time: 0,
  /** 1 normal, ~0,35 avec « réduire les animations ». */
  calm: 1,
  night: 0,
  flash: 0,
  head: { x: 0, y: -30, z: 0, yaw: 0, rise: 0, wet: 0, roll: 0, pitch: 0 },
  eye: { open: 0, pupil: 0.3, glow: 0, target: new Vector3() },
  /** Bateau soulevé puis lancé (doublure du vrai bateau, englouti par `leviathanAttack`). */
  carry: { visible: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  ink: { x: 0, z: 0, amount: 0, fade: 0, seed: 0 },
  /** Ombre géante sous le bateau. */
  shadow: { x: 0, z: 0, strength: 0, heading: 0, length: 52, width: 25 },
  /** Voile d'encre plein écran pendant le retour au port (= respawnFade). */
  veil: 0,
  /** Éclair commandé (compteur) : BoundaryStorm frappe près du kraken aux moments clés. */
  strike: 0,
  strikeX: 0,
  strikeZ: 0,
};

/**
 * Gerbes d'eau en cours, calculées à partir de l'horloge de séquence (figeable pour les
 * captures). x, y, z, âge (s) et force, rayon, poussée verticale.
 */
export const BURSTS = 12;
export const burstPosition = new Float32Array(BURSTS * 4);
export const burstParams = new Float32Array(BURSTS * 4);

/* ------------------------------------------------------------------ Hôte unique */

// Le rig peut être monté par deux hôtes (MarineLife à la première alerte, BoundaryStorm dans
// les aperçus `?solo=` et la démo) : un seul possède la séquence, l'autre ne rend rien.
const hosts: string[] = [];
let owner = '';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeOwner(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentOwner() {
  return owner;
}

export function claimHost(id: string) {
  hosts.push(id);
  if (!owner) {
    owner = id;
    notify();
  }
  return () => {
    const index = hosts.indexOf(id);
    if (index >= 0) hosts.splice(index, 1);
    if (owner === id) {
      owner = hosts[0] ?? '';
      notify();
    }
  };
}
