/**
 * Une seule définition de la houle, partagée entre le GPU (déplacement des sommets de
 * l'océan) et le CPU (oscillation du bateau). Si les deux divergent, le bateau flotte
 * au-dessus ou s'enfonce dans l'eau.
 */
export const WAVE_GLSL = /* glsl */ `
float waveHeight(vec2 p, float t) {
  return 0.34 * sin(p.x * 0.11 + t * 0.85)
       + 0.21 * sin(p.y * 0.17 - t * 0.65)
       + 0.11 * sin((p.x + p.y) * 0.31 + t * 1.5);
}
`;

export function waveHeight(x: number, z: number, t: number) {
  return (
    0.34 * Math.sin(x * 0.11 + t * 0.85) +
    0.21 * Math.sin(z * 0.17 - t * 0.65) +
    0.11 * Math.sin((x + z) * 0.31 + t * 1.5)
  );
}
