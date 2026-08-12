/**
 * Modèle de houle partagé entre le GPU et le CPU. Les mêmes quatre vagues
 * directionnelles pilotent l'océan et l'assiette du bateau ; les micro-vagues restent
 * purement visuelles afin de ne pas faire trembler la coque.
 */
export const WAVE_GLSL = /* glsl */ `
float waveTerm(vec2 p, vec2 direction, float frequency, float amplitude, float speed, float t) {
  return sin(dot(p, normalize(direction)) * frequency + t * speed) * amplitude;
}

float waveHeight(vec2 p, float t) {
  return waveTerm(p, vec2(1.0, 0.18), 0.105, 0.23, 0.58, t)
       + waveTerm(p, vec2(-0.28, 1.0), 0.168, 0.13, -0.46, t)
       + waveTerm(p, vec2(0.72, 0.69), 0.285, 0.07, 0.82, t)
       + waveTerm(p, vec2(-0.82, 0.42), 0.445, 0.04, -1.05, t);
}

vec2 waveSlope(vec2 p, float t) {
  vec2 d0 = normalize(vec2(1.0, 0.18));
  vec2 d1 = normalize(vec2(-0.28, 1.0));
  vec2 d2 = normalize(vec2(0.72, 0.69));
  vec2 d3 = normalize(vec2(-0.82, 0.42));
  return d0 * cos(dot(p, d0) * 0.105 + t * 0.58) * 0.23 * 0.105
       + d1 * cos(dot(p, d1) * 0.168 - t * 0.46) * 0.13 * 0.168
       + d2 * cos(dot(p, d2) * 0.285 + t * 0.82) * 0.07 * 0.285
       + d3 * cos(dot(p, d3) * 0.445 - t * 1.05) * 0.04 * 0.445;
}
`;

const WAVES = [
  { x: 1, z: 0.18, frequency: 0.105, amplitude: 0.23, speed: 0.58 },
  { x: -0.28, z: 1, frequency: 0.168, amplitude: 0.13, speed: -0.46 },
  { x: 0.72, z: 0.69, frequency: 0.285, amplitude: 0.07, speed: 0.82 },
  { x: -0.82, z: 0.42, frequency: 0.445, amplitude: 0.04, speed: -1.05 },
] as const;

export function waveHeight(x: number, z: number, t: number) {
  let height = 0;
  for (const wave of WAVES) {
    const length = Math.hypot(wave.x, wave.z);
    const dx = wave.x / length;
    const dz = wave.z / length;
    height += Math.sin((x * dx + z * dz) * wave.frequency + t * wave.speed) * wave.amplitude;
  }
  return height;
}
