import { Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { SPLASH_SECONDS } from '@/lib/cinematic';

/**
 * Trajectoire de la caméra pendant l'ouverture : une grue lourde qui part de la plongée
 * d'intro, encaisse l'impact du bateau (recul), s'élève en panotant de gauche à droite au
 * rythme des îles qui surgissent, puis plonge vers le bateau et se pose sur le cadrage de
 * navigation (vitesse nulle à l'arrivée : aucun à-coup au passage de relais).
 *
 * Clés en repère du bateau : [vers l'avant, vers la droite de la caméra, hauteur] (m).
 * Interpolation d'Hermite aux instants imposés (tangentes de Catmull-Rom non uniformes).
 */
type Local = readonly [number, number, number];

interface Key {
  t: number;
  position: Local | null;
  target: Local | null;
  /** Ouverture : 0 = champ d'intro, 1 = grand angle du sommet ; null = départ / arrivée. */
  wide: number | null;
}

const KEYS: readonly Key[] = [
  { t: 0, position: null, target: null, wide: null },
  // Le bateau tombe : la caméra s'avance à peine, tendue.
  { t: 0.62, position: [-24.6, 4, 9], target: [0.6, 0, 1.9], wide: 0 },
  // Après l'impact : recul et léger lever, le regard part déjà sur la gauche.
  { t: 1.5, position: [-33, 7.5, 13.5], target: [3.5, -3, 1.4], wide: 0.2 },
  // La grue s'élève en regardant à gauche (Compétences, Contact).
  { t: 2.5, position: [-47, 17, 27], target: [34, -36, 0], wide: 0.62 },
  // Plein axe : Projets surgit au centre.
  { t: 3.35, position: [-62, 3, 40], target: [58, 2, 0], wide: 0.86 },
  // Le regard file à droite : Expériences, puis l'île secrète au loin.
  { t: 4.25, position: [-70, -15, 49], target: [58, 44, 0], wide: 1 },
  // Piqué vers le bateau, un peu plus haut que l'arrivée : la grue se pose ensuite.
  { t: 5.75, position: [-37, -4, 56.5], target: [11, 5, 0.8], wide: 0.55 },
  { t: 7.2, position: null, target: null, wide: null },
];

export interface CameraPoseInput {
  position: Vector3;
  target: Vector3;
  fov: number;
}

const COUNT = KEYS.length;
const positions = Array.from({ length: COUNT }, () => new Vector3());
const targets = Array.from({ length: COUNT }, () => new Vector3());
const fovs = new Float32Array(COUNT);
const tangentA = new Vector3();
const tangentB = new Vector3();
const slopeA = new Vector3();
const slopeB = new Vector3();

/** Échelle des clés : recul et hauteur de la grue, portée du regard (un écran étroit plonge plus). */
export interface CraneScale {
  along: number;
  height: number;
  reach: number;
}

function toWorld(local: Local, scale: CraneScale, out: Vector3, target = false) {
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  // Droite de la caméra quand elle regarde selon le cap : (−sin, cos).
  const factor = target ? scale.reach : scale.along;
  const along = local[0] * factor;
  const side = local[1] * factor;
  return out.set(
    boatState.position.x + forwardX * along - forwardZ * side,
    local[2] * scale.height,
    boatState.position.z + forwardZ * along + forwardX * side,
  );
}

/** Tangente (unités / s) d'une suite de clés au point `index` (nulle aux extrémités). */
function tangent(values: Vector3[], index: number, out: Vector3) {
  if (index === 0 || index === COUNT - 1) return out.set(0, 0, 0);
  const before = KEYS[index].t - KEYS[index - 1].t;
  const after = KEYS[index + 1].t - KEYS[index].t;
  slopeA.subVectors(values[index], values[index - 1]).divideScalar(before);
  slopeB.subVectors(values[index + 1], values[index]).divideScalar(after);
  return out.copy(slopeA).multiplyScalar(after).addScaledVector(slopeB, before).divideScalar(before + after);
}

function hermite(values: Vector3[], segment: number, u: number, span: number, out: Vector3) {
  const u2 = u * u;
  const u3 = u2 * u;
  tangent(values, segment, tangentA);
  tangent(values, segment + 1, tangentB);
  return out
    .copy(values[segment])
    .multiplyScalar(2 * u3 - 3 * u2 + 1)
    .addScaledVector(tangentA, (u3 - 2 * u2 + u) * span)
    .addScaledVector(values[segment + 1], -2 * u3 + 3 * u2)
    .addScaledVector(tangentB, (u3 - u2) * span);
}

/**
 * Pose de la caméra `seconds` après le clic. `start` est la pose d'intro, `end` la pose de
 * navigation ; `wideFov` le champ du sommet (plus ouvert en portrait). Renvoie le champ.
 */
export function introCameraAt(
  seconds: number,
  start: CameraPoseInput,
  end: CameraPoseInput,
  wideFov: number,
  scale: CraneScale,
  outPosition: Vector3,
  outTarget: Vector3,
) {
  for (let index = 0; index < COUNT; index++) {
    const key = KEYS[index];
    if (index === 0) {
      positions[index].copy(start.position);
      targets[index].copy(start.target);
      fovs[index] = start.fov;
    } else if (index === COUNT - 1) {
      positions[index].copy(end.position);
      targets[index].copy(end.target);
      fovs[index] = end.fov;
    } else {
      toWorld(key.position!, scale, positions[index]);
      toWorld(key.target!, scale, targets[index], true);
      const wide = key.wide ?? 0;
      fovs[index] = index < 6 ? start.fov + (wideFov - start.fov) * wide : end.fov + (wideFov - end.fov) * wide;
    }
  }
  const time = Math.min(Math.max(seconds, 0), KEYS[COUNT - 1].t);
  let segment = 0;
  while (segment < COUNT - 2 && time > KEYS[segment + 1].t) segment += 1;
  const span = KEYS[segment + 1].t - KEYS[segment].t;
  const u = span > 0 ? (time - KEYS[segment].t) / span : 0;
  hermite(positions, segment, u, span, outPosition);
  hermite(targets, segment, u, span, outTarget);
  // Champ : interpolation douce (pas de dépassement) entre deux clés.
  const smooth = u * u * (3 - 2 * u);
  return fovs[segment] + (fovs[segment + 1] - fovs[segment]) * smooth;
}

/** Recul encaissé à l'impact du bateau (m) : vif, puis absorbé par la grue. */
export function impactRecoil(seconds: number) {
  const since = seconds - SPLASH_SECONDS;
  if (since <= 0) return 0;
  return 2.3 * (1 - Math.exp(-13 * since)) * Math.exp(-2.1 * since);
}
