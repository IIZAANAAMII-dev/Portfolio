/** Interpolation indépendante du framerate. `lambda` élevé = rattrapage rapide. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Ramène un angle dans ]-PI, PI] : évite qu'un bateau fasse un tour complet. */
export function shortestAngle(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Bruit déterministe très bon marché, utilisé pour disperser la végétation. */
export function hash(n: number) {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}
