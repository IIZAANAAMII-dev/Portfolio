import { MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';
import { animalRevealScale } from '@/lib/cinematic';
import { SOLIDS } from '@/lib/navigation';
import { useWorld } from '@/lib/store';
import { clamp, shortestAngle } from '@/lib/utils/math';

/**
 * Outils communs de la faune marine.
 *
 * Démonstration (captures, réglages) : `?demo=dolphins|whale|breach|fluke|slap|shark|jumps|rays`
 * force la rencontre correspondante autour du bateau, même à quai ; `&freeze=<s>` fige l'horloge
 * de la faune à cet instant : poses, éclaboussures et gerbes sont alors identiques d'une capture
 * à l'autre (la houle, elle, continue de vivre).
 */
function readDemo() {
  if (typeof window === 'undefined') return { kind: null as string | null, freeze: null as number | null };
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('freeze');
  const freeze = raw !== null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return { kind: params.get('demo'), freeze };
}

export const faunaDemo = readDemo();

/** Horloge de la faune : celle du rendu, sauf capture figée. */
export function faunaClock(elapsed: number) {
  return faunaDemo.freeze ?? elapsed;
}

/** Vrai si l'instant `at` a été franchi entre deux images (bornes : ]prev, now]). */
export function crossed(prev: number, now: number, at: number) {
  return prev < at && at <= now;
}

/** Apparition locale pendant l'intro (même cercle que les îles), immédiate en mouvement réduit. */
export function revealScaleAt(x: number, z: number, stagger = 0) {
  const world = useWorld.getState();
  if (world.reducedMotion) return world.reveal > 0.01 ? 1 : 0;
  return animalRevealScale(
    Math.hypot(x - world.introCenter[0], z - world.introCenter[1]),
    world.introRadius,
    stagger,
  );
}

/** Correction de cap qui éloigne des côtes (cercles de collision de l'archipel). */
export function steerAwayFromIslands(x: number, z: number, heading: number, margin: number) {
  let steer = 0;
  for (const solid of SOLIDS) {
    const dx = x - solid.x;
    const dz = z - solid.z;
    const distance = Math.hypot(dx, dz) - solid.r;
    if (distance > margin) continue;
    const away = Math.atan2(dz, dx);
    const urgency = clamp(1 - distance / margin, 0, 1);
    steer += shortestAngle(heading, away) * urgency * 0.9;
  }
  return steer;
}

/** Distance (bord compris) à la côte la plus proche. */
export function distanceToLand(x: number, z: number) {
  let best = Number.POSITIVE_INFINITY;
  for (const solid of SOLIDS) best = Math.min(best, Math.hypot(x - solid.x, z - solid.z) - solid.r);
  return best;
}

/**
 * Bancs de poissons actifs (tenu à jour par MarineLife) : les petits sauts de surface
 * partent de là, pour que les gerbes trahissent un vrai banc sous l'eau.
 */
export interface SchoolMarker {
  x: number;
  z: number;
  radius: number;
  /** 0 = banc caché ou trop loin, 1 = bien vivant. */
  presence: number;
}
export const schoolMarkers = new Set<SchoolMarker>();

/** Interpolation par clés, avec tangentes nulles (entrées et sorties adoucies). */
export function keyframes(keys: readonly (readonly [number, number])[], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    const [t1, v1] = keys[index];
    if (t <= t1) {
      const [t0, v0] = keys[index - 1];
      const k = (t - t0) / Math.max(t1 - t0, 1e-5);
      return v0 + (v1 - v0) * k * k * (3 - 2 * k);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Matériau de créature : standard (cel-shading global, brouillard), facettes nettes, couleurs
 * par sommet. `pars` est inséré après les déclarations, `deform` remplace `begin_vertex` et doit
 * définir `vec3 transformed` (espace objet, avant la matrice d'instance). Avec `flatShading`,
 * les normales viennent des dérivées écran : elles suivent la déformation sans calcul.
 */
export function creatureMaterial(
  key: string,
  uniforms: Record<string, { value: unknown }>,
  pars: string,
  deform: string,
  parameters: MeshStandardMaterialParameters = {},
) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
    ...parameters,
  });
  material.name = key;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${pars}`)
      .replace('#include <begin_vertex>', deform);
  };
  material.customProgramCacheKey = () => key;
  return material;
}
