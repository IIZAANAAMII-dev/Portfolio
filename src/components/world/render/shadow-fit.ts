import { Vector3, type Camera, type DirectionalLight } from 'three';

/**
 * Cadrage de l'ombre du soleil sur ce que la caméra voit.
 *
 * Avant : une boîte fixe de ±58 m centrée sur le bateau (des îles entières sans ombre dans
 * les vues larges, et une résolution gâchée derrière la caméra ou quand le soleil est bas).
 * Ici : l'empreinte au sol du champ de vue (au niveau de la mer et à hauteur des reliefs)
 * est enveloppée d'un cercle ; la boîte orthographique de la lumière l'entoure au plus
 * juste, sa hauteur suit l'inclinaison du soleil (un soleil rasant écrase le sol dans
 * l'espace lumière : la boîte se resserre et les longues ombres du couchant restent nettes).
 *
 * Stabilité : dimensions quantifiées et centre aligné sur la grille des texels, une ombre
 * immobile ne « nage » pas quand la caméra se déplace.
 */

/** Hauteur des reliefs et objets les plus hauts à couvrir (m). */
const RELIEF = 16;
/** Portée maximale d'un rayon de vue prise en compte (vues rasantes, horizon). */
const MAX_REACH = 165;
const MIN_HALF = 30;
const MAX_HALF = 150;
/** Quantification des dimensions (m). */
const STEP = 4;
/** Marge vers le soleil pour les objets hauts hors champ qui projettent dans le champ. */
const CASTER_MARGIN = 45;

const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]];
const footprint = Array.from({ length: CORNERS.length * 2 }, () => new Vector3());
const ray = new Vector3();
const point = new Vector3();
const center = new Vector3();
const lightDir = new Vector3(0.6, 0.7, 0.4).normalize();
const right = new Vector3();
const up = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

const fitted = { halfX: 0, halfY: 0, near: 0, far: 0 };

/** Direction du soleil (et de la lune, la nuit) — la même que l'océan et le ciel. */
export function sunDirection(angle: number, elevation: number) {
  lightDir.set(Math.cos(angle) * 80, Math.max(elevation * 70, 10), 40).normalize();
  return lightDir;
}

export function fitSunShadow(light: DirectionalLight, camera: Camera, mapSize: number) {
  camera.updateMatrixWorld();
  // 1. Empreinte du champ de vue au niveau de la mer et au sommet des reliefs.
  let count = 0;
  for (const [x, y] of CORNERS) {
    point.set(x, y, 0.5).unproject(camera);
    ray.copy(point).sub(camera.position).normalize();
    for (const height of [0, RELIEF]) {
      let t = MAX_REACH;
      if (ray.y < -1e-3) {
        const hit = (height - camera.position.y) / ray.y;
        t = hit > 0 ? Math.min(hit, MAX_REACH) : 0;
      }
      footprint[count++].copy(camera.position).addScaledVector(ray, t).setY(height);
    }
  }
  // 2. Cercle englobant (plan horizontal).
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of footprint) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  center.set((minX + maxX) * 0.5, RELIEF * 0.5, (minZ + maxZ) * 0.5);
  let radius = 0;
  for (const p of footprint) radius = Math.max(radius, Math.hypot(p.x - center.x, p.z - center.z));

  // 3. Repère de la lumière (celui que three.js construit avec lookAt).
  right.crossVectors(WORLD_UP, lightDir).normalize();
  up.crossVectors(lightDir, right);
  const sinE = lightDir.y;
  const cosE = Math.sqrt(Math.max(1 - sinE * sinE, 0));

  const halfX = Math.min(Math.max(Math.ceil((radius + 3) / STEP) * STEP, MIN_HALF), MAX_HALF);
  const halfY = Math.min(
    Math.max(Math.ceil((halfX * sinE + RELIEF * 0.5 * cosE + 3) / STEP) * STEP, STEP * 3),
    MAX_HALF,
  );
  const depth = halfX * cosE + RELIEF * 0.5 * sinE;

  // 4. Centre aligné sur les texels de la carte d'ombre.
  const texelX = (halfX * 2) / mapSize;
  const texelY = (halfY * 2) / mapSize;
  const cx = Math.round(center.dot(right) / texelX) * texelX;
  const cy = Math.round(center.dot(up) / texelY) * texelY;
  const cz = center.dot(lightDir);
  center.copy(right).multiplyScalar(cx).addScaledVector(up, cy).addScaledVector(lightDir, cz);

  const distance = depth + CASTER_MARGIN + 10;
  light.position.copy(center).addScaledVector(lightDir, distance);
  light.target.position.copy(center);
  light.target.updateMatrixWorld();

  const near = Math.max(distance - depth - CASTER_MARGIN - 5, 0.5);
  const far = Math.ceil((distance + depth + 10) / STEP) * STEP;
  if (fitted.halfX !== halfX || fitted.halfY !== halfY || fitted.near !== near || fitted.far !== far) {
    const shadowCamera = light.shadow.camera;
    shadowCamera.left = -halfX;
    shadowCamera.right = halfX;
    shadowCamera.top = halfY;
    shadowCamera.bottom = -halfY;
    shadowCamera.near = near;
    shadowCamera.far = far;
    shadowCamera.updateProjectionMatrix();
    fitted.halfX = halfX;
    fitted.halfY = halfY;
    fitted.near = near;
    fitted.far = far;
  }
}
