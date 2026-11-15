import { Vector2, Vector3, type Camera } from 'three';

/**
 * Couches du ciel nocturne (constellations, étoiles filantes) : une direction du ciel devient
 * soit un point de la voûte (centrée sur la caméra, comme le dôme), soit son REFLET sur la
 * mer — un miroir horizontal posé juste au-dessus de la houle.
 *
 * Pourquoi le reflet : la caméra de navigation et celle des escales regardent la mer en
 * plongée (le haut de l'image reste sous l'horizon) ; le ciel n'est vu que dans les plans
 * bas. La nuit, c'est donc dans l'eau que le visiteur lit les étoiles. L'océan n'est pas
 * modifié : la couche est dessinée par-dessus (il est transparent et n'écrit pas la
 * profondeur), seules les terres et le bateau la masquent.
 */
export const SKY_RADIUS = 300;
/** Hauteur du miroir : au-dessus des creux, au ras des crêtes (houle calme ±0,47 m). */
export const SEA_MIRROR = 0.38;

/** Uniformes partagés par toutes les couches (un seul exemplaire, muté une fois par image). */
export const skyLayerUniforms = {
  uViewport: { value: new Vector2(1280, 800) },
  uSkyRadius: { value: SKY_RADIUS },
  uMirror: { value: SEA_MIRROR },
  uTime: { value: 0 },
  /** 0 = mouvements réduits (ni scintillement ni ondulation). */
  uMotion: { value: 1 },
  /** Éclat d'un vœu exaucé (étoile filante attrapée) : 1 → 0. */
  uWish: { value: 0 },
};

/**
 * `skyPlace(dir, fade)` : point monde de la direction `dir` pour la passe courante
 * (`uPass` 0 = voûte, 1 = reflet) et son fondu (horizon, lointain).
 * `skyClipOffset(clip, px)` : décale un sommet de `px` pixels CSS à l'écran.
 */
export const SKY_LAYER_GLSL = /* glsl */ `
uniform float uPass;
uniform float uSkyRadius;
uniform float uMirror;
uniform vec2 uViewport;

vec3 skyPlace(vec3 dir, out float fade) {
  if (uPass < 0.5) {
    fade = smoothstep(0.03, 0.15, dir.y);
    return cameraPosition + dir * uSkyRadius;
  }
  vec3 r = vec3(dir.x, -dir.y, dir.z);
  float down = max(-r.y, 0.04);
  float dist = max(cameraPosition.y - uMirror, 0.5) / down;
  fade = smoothstep(0.08, 0.24, -r.y) * (1.0 - smoothstep(150.0, 280.0, dist));
  return cameraPosition + r * dist;
}

vec4 skyClip(vec3 world) {
  return projectionMatrix * viewMatrix * vec4(world, 1.0);
}

void skyClipOffset(inout vec4 clip, vec2 px) {
  clip.xy += px * (2.0 / uViewport) * clip.w;
}
`;

/** Même projection côté processeur (zones cliquables des étoiles filantes). */
export function skyPlaceCPU(dir: Vector3, pass: 0 | 1, camera: Camera, out: Vector3) {
  if (pass === 0) return out.copy(camera.position).addScaledVector(dir, SKY_RADIUS);
  const down = Math.max(dir.y, 0.04);
  const dist = Math.max(camera.position.y - SEA_MIRROR, 0.5) / down;
  out.set(dir.x, -dir.y, dir.z).multiplyScalar(dist).add(camera.position);
  return out;
}

const forward = new Vector3();

/**
 * Point de la mer visé par la caméra (son axe coupe le plan y = 0), ou 60 m devant elle si
 * elle regarde l'horizon : le centre des moments de météo.
 */
export function cameraFocus(camera: Camera, out: Vector3) {
  camera.getWorldDirection(forward);
  if (forward.y < -0.08) {
    out.copy(camera.position).addScaledVector(forward, camera.position.y / -forward.y);
  } else {
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0);
    out.copy(camera.position).addScaledVector(forward.normalize(), 60);
  }
  out.y = 0;
  return out;
}

/** Paramètres de capture lus une fois : `?sky=drawn|meteor`, `?weather=squall|rainbow|both`. */
function readParams() {
  if (typeof window === 'undefined') return { sky: null as string | null, weather: null as string | null };
  const params = new URLSearchParams(window.location.search);
  return { sky: params.get('sky'), weather: params.get('weather') };
}
export const skyParams = readParams();

/** Bruit déterministe 0..1 (mêmes figures à chaque visite). */
export function seeded(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
