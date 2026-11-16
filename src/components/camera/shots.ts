import { Vector3 } from 'three';
import { DOCK_END_OFFSET } from '@/components/islands/docks/layout';
import { homeBerth, type Berth } from '@/components/boat/mooring';
import { ATELIER } from '@/components/world/atelier/layout';
import { homeIsland, islandById } from '@/data/islands';

/**
 * Plans de caméra du port (accostage, atelier de peinture) et intégrateur à ressort.
 *
 * Toutes les glissades de la caméra passent par un ressort amorti : la vitesse est continue
 * (aucun départ en flèche, aucun arrêt sec), et un amortissement un peu sous-critique laisse
 * un tout petit dépassement — la caméra « se pose ».
 */

/** Ressort amorti (Euler semi-implicite, sous-pas si raide) : `value` rejoint `goal`. */
export function springTo(value: Vector3, velocity: Vector3, goal: Vector3, omega: number, zeta: number, dt: number) {
  const steps = Math.max(1, Math.ceil((omega * dt) / 0.12));
  const h = dt / steps;
  const stiffness = omega * omega;
  const damping = 2 * zeta * omega;
  for (let step = 0; step < steps; step++) {
    velocity.x += (stiffness * (goal.x - value.x) - damping * velocity.x) * h;
    velocity.y += (stiffness * (goal.y - value.y) - damping * velocity.y) * h;
    velocity.z += (stiffness * (goal.z - value.z) - damping * velocity.z) * h;
    value.x += velocity.x * h;
    value.y += velocity.y * h;
    value.z += velocity.z * h;
  }
}

const focus = new Vector3();
const direction = new Vector3();

/**
 * Plan rapproché de l'accostage : trois quarts arrière du bateau, le bout du ponton à côté.
 * Vu de la poupe, tout se lit de profil : l'amarre qui part du pont arrière vers la bitte,
 * le passavant qui bascule par-dessus sa charnière, le patron qui salue. `view` est la
 * direction (horizontale) du cadrage de l'île, dont le plan garde un peu la lumière.
 * `shift` (0 → 0,4) décale le sujet vers la droite de l'écran (page ouverte à gauche).
 */
export function arrivalPose(
  berth: Berth,
  view: { x: number; z: number },
  mobile: boolean,
  shift: number,
  outPosition: Vector3,
  outTarget: Vector3,
) {
  const island = berth.key === 'home' ? null : islandById[berth.key];
  const center = island ? island.position : homeIsland.position;
  const radius = island ? island.radius : homeIsland.radius;
  const dx = Math.cos(berth.dockAngle);
  const dz = Math.sin(berth.dockAngle);
  const end = radius + DOCK_END_OFFSET;
  // Visée entre le bateau et le bout du ponton.
  focus.set(
    berth.x + (center[0] + dx * end - berth.x) * 0.36,
    0.9,
    berth.z + (center[1] + dz * end - berth.z) * 0.36,
  );
  // De l'arrière du bateau, un peu du large (on voit son flanc extérieur, le pont de travail
  // et le nom au tableau), en gardant une part de la direction du cadrage de l'île.
  const fx = Math.cos(berth.heading);
  const fz = Math.sin(berth.heading);
  direction.set(-fx + dx * 0.5 + view.x * 0.25, 0, -fz + dz * 0.5 + view.z * 0.25).normalize();
  const distance = mobile ? 21 : 16;
  const height = mobile ? 11 : 8;
  outPosition.set(focus.x + direction.x * distance, height, focus.z + direction.z * distance);
  outTarget.copy(focus);
  if (shift > 0) {
    // Droite de l'écran = avant × haut ; viser à gauche décale le sujet vers la droite.
    const rightX = direction.z;
    const rightZ = -direction.x;
    const reach = distance * 0.62 * shift;
    outTarget.x -= rightX * reach;
    outTarget.z -= rightZ * reach;
  }
}

const HOME_BERTH_CENTER = homeBerth();

/**
 * Plans de l'atelier de peinture.
 *  - `browse` : l'appentis de face, de près (les pots et les pavillons se choisissent au doigt) ;
 *  - sinon : le bateau amarré, de trois quarts par son flanc extérieur (le pinceau court sur
 *    la coque de ce côté-là), l'îlot et l'atelier en fond. `berth` : poste occupé (son cap
 *    décide de quel côté est l'arrière).
 */
export function atelierPose(
  mobile: boolean,
  portrait: boolean,
  browse: boolean,
  berth: Berth | null,
  outPosition: Vector3,
  outTarget: Vector3,
) {
  if (browse) {
    const fx = Math.cos(ATELIER.facing);
    const fz = Math.sin(ATELIER.facing);
    // Un peu vers la droite de la façade (le râtelier à pavillons entre dans le cadre).
    const rx = Math.cos(ATELIER.facing - Math.PI / 2);
    const rz = Math.sin(ATELIER.facing - Math.PI / 2);
    focus.set(ATELIER.x + fx * 0.3 + rx * 0.45, ATELIER.ground + 0.85, ATELIER.z + fz * 0.3 + rz * 0.45);
    // Portrait : l'appentis et le râtelier (4,5 m de large) doivent tenir dans un cadre étroit.
    const distance = portrait ? 12.5 : mobile ? 7.2 : 5.8;
    outPosition.set(focus.x + fx * distance + rx * 0.9, focus.y + (portrait ? 5 : 2.5), focus.z + fz * distance + rz * 0.9);
    outTarget.copy(focus);
    return;
  }
  const post = berth ?? HOME_BERTH_CENTER;
  const fx = Math.cos(post.heading);
  const fz = Math.sin(post.heading);
  const dx = Math.cos(post.dockAngle);
  const dz = Math.sin(post.dockAngle);
  // Visée : le milieu de la coque, un peu vers l'arrière ; un soupçon vers l'atelier.
  focus.set(post.x - fx * 0.3 + (ATELIER.x - post.x) * 0.12, 1.0, post.z - fz * 0.3 + (ATELIER.z - post.z) * 0.12);
  direction.set(dx - fx * 0.38, 0, dz - fz * 0.38).normalize();
  const distance = portrait ? 19 : mobile ? 15 : 11.5;
  const height = portrait ? 9 : mobile ? 6.5 : 4.8;
  outPosition.set(focus.x + direction.x * distance, height, focus.z + direction.z * distance);
  outTarget.copy(focus);
}
