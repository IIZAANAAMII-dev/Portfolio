/** Petites courbes d'animation (sans allocation), partagées par les zones. */

export function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Progression de `start` à `start + duration`, bornée entre 0 et 1. */
export function span(time: number, start: number, duration: number) {
  return clamp01((time - start) / duration);
}

export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

export function easeIn(t: number) {
  return t * t * t;
}

/** Arrivée avec un léger dépassement : la pièce « claque » en place. */
export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Bosse douce : 0 hors de [start, start + duration], 1 au milieu. */
export function bump(time: number, start: number, duration: number) {
  const t = (time - start) / duration;
  return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
}

/** Interpolation linéaire. */
export function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
