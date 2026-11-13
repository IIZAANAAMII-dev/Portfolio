/**
 * Ombres de nuages : de grandes taches douces qui glissent avec le vent sur la mer, le
 * relief et l'herbe. Le même motif (mêmes fonctions, même horloge) est inclus dans chaque
 * shader concerné, pour que les ombres passent de l'eau aux îles sans raccord.
 */
export const cloudClock = { value: 0 };

export const CLOUD_SHADOW_GLSL = /* glsl */ `
float cloudHash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float cloudNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), f.x),
             mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + 1.0), f.x), f.y);
}
// 1 sous un nuage, 0 au soleil ; bords doux, taches d'environ 60 m qui dérivent.
float cloudShadow(vec2 p, float t) {
  vec2 q = p * 0.012 + vec2(t * 0.011, t * 0.0045);
  float n = cloudNoise(q) * 0.62 + cloudNoise(q * 2.3 + 4.1) * 0.38;
  return smoothstep(0.54, 0.66, n);
}
`;
