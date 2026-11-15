/**
 * Écriture de la mer, façon dessin animé : traits de crête tracés à la main, traînée de
 * soleil en tirets et éclats. Aucun bruit fin, aucune texture : des formes nettes, rares
 * et lisibles, qui naissent, ondulent, dérivent puis s'effacent.
 *
 * Les fonctions GLSL ci-dessous attendent `hash21(vec2)` défini avant leur inclusion.
 */

/**
 * Un trait au plus par cellule. Les cellules sont rangées le long des crêtes (x) et
 * empilées dans le sens de propagation de la houle (y) ; chaque rangée est décalée au
 * hasard, et chaque trait tient entièrement dans sa cellule : une seule cellule à évaluer
 * par pixel, sans couture.
 *
 * Un trait est une ligne souple d'épaisseur régulière, aux bouts ronds, qui ondule
 * doucement. Vie (période propre de 7 à 12 s) : il se dessine d'un bout à l'autre, reste
 * un instant, puis s'efface par la queue en s'affinant, comme un trait de plume.
 *
 * `px` : taille d'un pixel (m) mesurée en travers des traits, pour l'anticrénelage.
 */
export const CREST_STROKES_GLSL = /* glsl */ `
float crestStroke(vec2 p, vec2 dir, vec2 cell, float drift, float t, float seed,
                  float density, float halfWidth, float px) {
  vec2 q = vec2(dot(p, vec2(-dir.y, dir.x)), dot(p, dir) - t * drift);
  float row = floor(q.y / cell.y);
  q.x += hash21(vec2(row, seed)) * cell.x * 5.0;
  vec2 id = vec2(floor(q.x / cell.x), row);
  if (hash21(id + seed) > density) return 0.0;
  float hA = hash21(id + seed + 1.37);
  float hB = hash21(id + seed + 2.71);
  float hC = hash21(id + seed + 4.13);
  float hD = hash21(id + seed + 5.93);

  float phase = fract(t / mix(7.0, 12.0, hA) + hB);
  float drawOn = smoothstep(0.0, 0.42, phase);
  float drawOff = smoothstep(0.55, 0.97, phase);

  float fullHalf = mix(0.24, 0.36, hC) * cell.x;
  float room = max(cell.x * 0.5 - fullHalf - halfWidth - 0.2, 0.0);
  vec2 local = q - (id + 0.5) * cell;
  local.x -= (hD * 2.0 - 1.0) * room;
  local.y -= (hA - 0.5) * cell.y * 0.25 + phase * 0.5;
  // Chaque trait a sa propre obliquité : un tracé à la main n'est jamais parallèle.
  float tilt = (hC - 0.5) * 0.2;
  local = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * local;
  // La moitié des traits se dessinent dans l'autre sens.
  float x = hB > 0.5 ? local.x : -local.x;

  // Partie visible : la tête avance, puis la queue la rattrape.
  float head = mix(-fullHalf, fullHalf, drawOn);
  float tail = mix(-fullHalf, fullHalf, drawOff);
  float e = min(x - tail, head - x);
  if (e <= 0.0) return 0.0;

  // Ondulation douce : un peu plus d'une demi-vague à une vague et demie par trait.
  float frequency = mix(0.9, 1.7, hD) * 3.14159 / fullHalf;
  float amplitude = mix(0.08, 0.16, hB) * (0.7 + 0.5 * drawOn);
  float arg = x * frequency + hA * 6.28318;
  float curve = amplitude * sin(arg);
  float dcurve = amplitude * frequency * cos(arg);
  float d = abs(local.y - curve) * inversesqrt(1.0 + dcurve * dcurve);

  // Épaisseur régulière, un peu plus forte au milieu ; bouts parfaitement ronds.
  float s = x / fullHalf;
  float w = halfWidth * (0.8 + 0.2 * (1.0 - s * s)) * mix(1.0, 0.55, drawOff);
  float cap = min(e / w, 1.0);
  w *= sqrt(cap * (2.0 - cap));
  return smoothstep(-px, px, w - d) * clamp(w / px, 0.0, 1.0);
}
`;

/**
 * Traînée du soleil : de courts tirets couchés face au soleil, qui s'allument et
 * s'éteignent doucement. En travers, la grille suit l'angle sous l'horizon (donc la
 * hauteur à l'écran) : chaque tiret garde deux pixels d'épaisseur de près comme au loin,
 * tandis que sa longueur, en mètres, suit la perspective. Le masque de la traînée (reflet
 * spéculaire) est appliqué par l'appelant.
 *
 * `pixelAngle` : angle vertical d'un pixel (rad) ; `camHeight` : hauteur de la caméra.
 */
export const SUN_GLITTER_GLSL = /* glsl */ `
float sunGlitter(vec2 p, vec2 sunH, float distance, float camHeight, float pixelAngle, float t) {
  const float ROW = 7.0;
  vec2 cell = vec2(2.6, pixelAngle * ROW);
  vec2 g = vec2(dot(p, vec2(-sunH.y, sunH.x)), camHeight / max(distance, 1.0)) / cell;
  vec2 id = floor(g);
  if (hash21(id + 41.3) > 0.45) return 0.0;
  vec2 f = g - id - 0.5 - (vec2(hash21(id + 43.7), hash21(id + 47.1)) - 0.5) * 0.3;
  float phase = fract(t / mix(1.4, 2.6, hash21(id + 49.9)) + hash21(id + 53.3));
  float life = smoothstep(0.0, 0.25, phase) * (1.0 - smoothstep(0.45, 0.85, phase));
  float halfLength = mix(0.18, 0.4, hash21(id + 57.7)) * life;
  float halfThick = 1.15 / ROW * life;
  vec2 d = abs(f);
  // Losange très allongé : distance au bord, en pixels, mesurée en travers.
  float edge = (halfThick * (1.0 - d.x / max(halfLength, 1e-4)) - d.y) * ROW;
  return clamp(edge + 0.5, 0.0, 1.0);
}

/**
 * Éclats isolés, près de la caméra et seulement dans la traînée du soleil : petites étoiles
 * à quatre branches qui s'allument une à une.
 */
float sunGlints(vec2 p, float t, float px) {
  vec2 cell = vec2(3.1, 2.3);
  vec2 id = floor(p / cell);
  if (hash21(id + 21.7) > 0.1) return 0.0;
  vec2 centre = (id + 0.2 + 0.6 * vec2(hash21(id + 23.1), hash21(id + 27.9))) * cell;
  float phase = fract(t / mix(1.8, 3.4, hash21(id + 29.3)) + hash21(id + 31.7));
  float twinkle = smoothstep(0.0, 0.3, phase) * (1.0 - smoothstep(0.38, 0.75, phase));
  vec2 d = abs(p - centre);
  float size = mix(0.12, 0.26, hash21(id + 33.9)) * twinkle;
  float core = smoothstep(-px, px, size - (d.x + d.y));
  float ray = smoothstep(-px, px, size * 2.6 - max(d.x, d.y))
    * smoothstep(-px, px, size * 0.12 - min(d.x, d.y));
  return max(core, ray) * clamp(size / px, 0.0, 1.0);
}
`;

/**
 * Trace récente de la poupe (`uTrail[0]` : la poupe, puis de plus en plus ancien) : distance
 * au plus proche segment (x) et âge le long de la trace (y : 0 à la poupe, 1 au bout).
 */
export function wakeTraceGlsl(points: number) {
  return /* glsl */ `
uniform vec2 uTrail[${points}];
vec2 wakeTrace(vec2 p) {
  float best = 1e4;
  float age = 1.0;
  for (int i = 0; i < ${points - 1}; i++) {
    vec2 a = uTrail[i];
    vec2 ab = uTrail[i + 1] - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = length(p - a - ab * t);
    if (d < best) {
      best = d;
      age = (float(i) + t) / ${(points - 1).toFixed(1)};
    }
  }
  return vec2(best, age);
}
`;
}
