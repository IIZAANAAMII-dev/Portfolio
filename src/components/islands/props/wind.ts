import { Vector3 } from 'three';

/**
 * Champ de vent partagé par toute la végétation (herbe, fleurs, arbres, fanions).
 *
 * Une seule fonction décrit les rafales, en coordonnées MONDE : un front de vent traverse
 * l'archipel dans le sens du vent (celui des tissus et des nuages), couche l'herbe, puis
 * les fleurs, puis secoue les houppiers, dans cet ordre. Rien n'est calculé sur le CPU :
 * chaque shader évalue `windGust` à la racine de ce qu'il anime.
 */

/** Direction du vent (même que les tissus et les ombres de nuages). */
export const WIND_DIRECTION = new Vector3(0.84, 0, 0.54).normalize();

/** Uniformes partagés : un seul objet pour tous les matériaux (avancé une fois par image). */
export const windUniforms = {
  uWindTime: { value: 0 },
  uWindDir: { value: WIND_DIRECTION.clone() },
};

/** Avance l'horloge du vent (appelable par plusieurs composants dans la même image). */
export function tickWind(elapsed: number) {
  windUniforms.uWindTime.value = elapsed;
}

/**
 * GLSL : `windGust(p)` vaut 0 par temps calme et monte vers 1 au passage d'une rafale
 * (p en mètres, plan xz du monde). Les fronts font une trentaine de mètres d'écart,
 * avancent à ~4,5 m/s et ondulent en travers ; leur force varie lentement.
 * `windFlutter(p, rate)` : frémissement rapide, -1 → 1, propre à chaque point.
 */
export const WIND_GLSL = /* glsl */ `
uniform float uWindTime;
uniform vec3 uWindDir;

float windGust( vec2 p ) {
  vec2 dir = normalize( uWindDir.xz );
  float along = dot( p, dir );
  float across = dot( p, vec2( - dir.y, dir.x ) );
  float front = along * 0.21 - uWindTime * 0.95
    + sin( across * 0.11 + uWindTime * 0.07 ) * 1.3
    + sin( across * 0.031 - uWindTime * 0.05 ) * 1.9;
  float g = smoothstep( 0.25, 1.0, sin( front ) * 0.5 + 0.5 );
  float swell = 0.6 + 0.4 * sin( uWindTime * 0.17 + along * 0.013 + across * 0.021 );
  return g * g * swell;
}

float windFlutter( vec2 p, float rate ) {
  return sin( uWindTime * rate + p.x * 2.31 + p.y * 1.73 ) * 0.6
    + sin( uWindTime * rate * 1.73 + p.x * 0.91 - p.y * 2.07 ) * 0.4;
}
`;
