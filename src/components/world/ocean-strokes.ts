import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat } from 'three';
import { createHeightSampler, terrainFeatures, type HeightSampler } from '@/components/islands/terrain-shape';
import { sceneConfigs } from '@/components/islands/scenes/registry';
import { sampler as yellowStaticHeight } from '@/components/secret/layout';
import { homeIsland, islands } from '@/data/islands';
import { islets } from '@/data/islets';
import { yellowStaticIsland } from '@/data/yellow-static';
import { preview } from '@/lib/preview';

/**
 * Écriture de la mer, façon dessin animé : traits de crête tracés à la main, traînée de
 * soleil en tirets et éclats, écume du rivage. Aucun bruit fin, aucune texture peinte : des
 * formes nettes, rares et lisibles, qui naissent, ondulent, dérivent puis s'effacent.
 *
 * Les fonctions GLSL ci-dessous attendent `hash21(vec2)` (et `valueNoise(vec2)` pour
 * l'écume du rivage) définis avant leur inclusion.
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

/**
 * Écume du rivage, posée sur la vraie ligne d'eau. `coast` : distance signée au rivage (m,
 * > 0 en mer), qui respire avec la houle. Un liseré plein colle au sable, au bord net et
 * dentelé ; des anneaux fins naissent juste au large, s'éloignent du rivage en s'affinant,
 * se rompent en arcs comme un trait de plume, puis s'effacent.
 * `px` : taille d'un pixel mesurée sur `coast` (anticrénelage). Retour : (liseré, anneaux).
 */
export const SHORE_FOAM_GLSL = /* glsl */ `
vec2 shoreFoam(float coast, vec2 p, float t, float px) {
  float lip = 0.3 + 0.24 * valueNoise(p * 0.75 + vec2(t * 0.19, -t * 0.11));
  float lace = 1.0 - smoothstep(lip - px, lip + px, coast);

  const float SPACING = 1.8;
  float s = (coast - t * 0.36) / SPACING;
  float id = floor(s + 0.5);
  float d = abs(s - id) * SPACING;
  float reach = smoothstep(0.5, 1.2, coast) * (1.0 - smoothstep(2.6, 5.6, coast));
  float halfWidth = mix(0.16, 0.05, smoothstep(0.7, 5.2, coast));
  float ring = smoothstep(-px, px, halfWidth - d) * clamp(halfWidth / px, 0.0, 1.0);
  // Décalage borné (l'indice d'anneau grandit sans fin avec le temps).
  float arcs = smoothstep(0.26, 0.42, valueNoise(p * 0.42 + fract(id * 0.1371) * 61.7));
  return vec2(lace, ring * reach * arcs);
}
`;

/* ------------------------------------------------------------------ carte du rivage */

/** Résolution de la carte du rivage (texels par côté) et distance maximale stockée (m). */
const COAST_TEXELS = 512;
const COAST_MAX = 24;

interface CoastSource {
  x: number;
  z: number;
  /** Rayon au-delà duquel le relief n'est plus que le fond marin. */
  reach: number;
  height: HeightSampler;
}

/**
 * Les mêmes fonctions de hauteur que les îles (relief de base + `sculpt` de chaque scène) :
 * l'écume suit exactement les plages, les criques, les quais et les chenaux. En aperçu
 * `?solo=`, seules les îles montées comptent.
 */
function coastSources(): CoastSource[] {
  const solo = preview.solo;
  const list: CoastSource[] = [];
  const add = (position: readonly [number, number], radius: number, height: HeightSampler) => {
    list.push({ x: position[0], z: position[1], reach: radius * 1.45 + 2, height });
  };
  if (solo === null || solo === 'sea') {
    add(homeIsland.position, homeIsland.radius, createHeightSampler({ radius: homeIsland.radius, elevation: homeIsland.elevation, seed: 1 }));
  }
  islands.forEach((island, index) => {
    if (solo !== null && solo !== island.id) return;
    const shape = { radius: island.radius, elevation: island.elevation, seed: index * 17 + 3 };
    const base = createHeightSampler(shape);
    const sculpt = sceneConfigs[island.id]?.sculpt;
    const features = terrainFeatures(shape);
    add(island.position, island.radius, sculpt ? (x, z) => sculpt(x, z, base(x, z), features) : base);
  });
  if (solo === null) {
    for (const islet of islets) {
      add(islet.position, islet.radius, createHeightSampler({ radius: islet.radius, elevation: islet.elevation, seed: islet.seed }));
    }
  }
  if (solo === null || solo === 'static') add(yellowStaticIsland.position, yellowStaticIsland.radius, yellowStaticHeight);
  return list;
}

export interface CoastMap {
  texture: DataTexture;
  /** Origine (x, z) et côté (m) du carré couvert. */
  rect: [number, number, number];
}

/** Petite carte neutre (pleine mer partout) tant que la vraie n'est pas prête. */
export function emptyCoastMap() {
  const texture = new DataTexture(new Uint16Array([DataUtils.toHalfFloat(COAST_MAX)]), 1, 1, RedFormat, HalfFloatType);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Travail de cuisson, découpé en petites unités (une rangée de texels) : le planificateur
 * en enchaîne autant que le navigateur le permet, sans jamais retenir une image.
 *
 * Distance euclidienne signée à la ligne d'eau (h = 0), à partir des hauteurs du relief :
 * germes sous-texel sur les arêtes de la grille où la hauteur change de signe, puis
 * propagation du plus proche point du rivage en deux balayages (« dead reckoning »),
 * distances au carré (texels²) pour éviter toute racine dans les boucles.
 */
function* coastWork(sources: CoastSource[], done: (map: CoastMap) => void) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const source of sources) {
    minX = Math.min(minX, source.x - source.reach);
    maxX = Math.max(maxX, source.x + source.reach);
    minZ = Math.min(minZ, source.z - source.reach);
    maxZ = Math.max(maxZ, source.z + source.reach);
  }
  const n = COAST_TEXELS;
  const size = Math.max(maxX - minX, maxZ - minZ) + 16;
  const originX = (minX + maxX) / 2 - size / 2;
  const originZ = (minZ + maxZ) / 2 - size / 2;
  const texel = size / n;
  const height = new Float32Array(n * n).fill(-3);
  const dist = new Float32Array(n * n).fill(Infinity);
  const nearX = new Float32Array(n * n);
  const nearZ = new Float32Array(n * n);

  // 1. Hauteurs du relief, île par île, rangée par rangée.
  for (const source of sources) {
    const i0 = Math.max(0, Math.floor((source.x - source.reach - originX) / texel));
    const i1 = Math.min(n - 1, Math.ceil((source.x + source.reach - originX) / texel));
    const j0 = Math.max(0, Math.floor((source.z - source.reach - originZ) / texel));
    const j1 = Math.min(n - 1, Math.ceil((source.z + source.reach - originZ) / texel));
    const reach2 = source.reach * source.reach;
    for (let j = j0; j <= j1; j++) {
      const z = originZ + (j + 0.5) * texel - source.z;
      for (let i = i0; i <= i1; i++) {
        const x = originX + (i + 0.5) * texel - source.x;
        if (x * x + z * z > reach2) continue;
        const k = j * n + i;
        height[k] = Math.max(height[k], source.height(x, z));
      }
      yield;
    }
  }

  // 2. Germes : là où la hauteur change de signe entre deux texels voisins.
  const seed = (k: number, i: number, j: number, cx: number, cz: number) => {
    const d2 = (i - cx) * (i - cx) + (j - cz) * (j - cz);
    if (d2 < dist[k]) {
      dist[k] = d2;
      nearX[k] = cx;
      nearZ[k] = cz;
    }
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const h0 = height[k];
      if (i < n - 1) {
        const h1 = height[k + 1];
        if (h0 > 0 !== h1 > 0) {
          const t = h0 / (h0 - h1);
          seed(k, i, j, i + t, j);
          seed(k + 1, i + 1, j, i + t, j);
        }
      }
      if (j < n - 1) {
        const h1 = height[k + n];
        if (h0 > 0 !== h1 > 0) {
          const t = h0 / (h0 - h1);
          seed(k, i, j, i, j + t);
          seed(k + n, i, j + 1, i, j + t);
        }
      }
    }
    if (j % 16 === 15) yield;
  }

  // 3. Propagation du plus proche point du rivage : un balayage aller, un retour.
  const relax = (k: number, i: number, j: number, q: number) => {
    if (dist[q] === Infinity) return;
    const dx = i - nearX[q];
    const dz = j - nearZ[q];
    const d2 = dx * dx + dz * dz;
    if (d2 < dist[k]) {
      dist[k] = d2;
      nearX[k] = nearX[q];
      nearZ[k] = nearZ[q];
    }
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (i > 0) relax(k, i, j, k - 1);
      if (j > 0) {
        relax(k, i, j, k - n);
        if (i > 0) relax(k, i, j, k - n - 1);
        if (i < n - 1) relax(k, i, j, k - n + 1);
      }
    }
    for (let i = n - 2; i >= 0; i--) relax(j * n + i, i, j, j * n + i + 1);
    if (j % 16 === 15) yield;
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      if (i < n - 1) relax(k, i, j, k + 1);
      if (j < n - 1) {
        relax(k, i, j, k + n);
        if (i < n - 1) relax(k, i, j, k + n + 1);
        if (i > 0) relax(k, i, j, k + n - 1);
      }
    }
    for (let i = 1; i < n; i++) relax(j * n + i, i, j, j * n + i - 1);
    if (j % 16 === 0) yield;
  }

  // 4. Distance signée (m), en demi-flottants.
  const data = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let k = j * n; k < (j + 1) * n; k++) {
      const d = Math.min(Math.sqrt(dist[k]) * texel, COAST_MAX);
      data[k] = DataUtils.toHalfFloat(height[k] > 0 ? -d : d);
    }
    if (j % 32 === 31) yield;
  }
  const texture = new DataTexture(data, n, n, RedFormat, HalfFloatType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  done({ texture, rect: [originX, originZ, size] });
}

/**
 * Cuit la carte du rivage pendant les temps morts du navigateur, par tranches de quelques
 * millisecondes (≈ 0,4 s de calcul au total, réparti sur les premières secondes).
 * Renvoie une fonction d'annulation.
 */
export function bakeCoastMap(done: (map: CoastMap) => void) {
  const sources = coastSources();
  if (!sources.length || typeof window === 'undefined') return () => {};
  const work = coastWork(sources, done);
  let cancelled = false;
  let handle = 0;
  const idle = typeof window.requestIdleCallback === 'function';
  let last = performance.now();
  const run = (deadline?: IdleDeadline) => {
    if (cancelled) return;
    const start = performance.now();
    // Temps libre annoncé par le navigateur (borné), ou 8 ms quand il n'en annonce pas. Sur
    // une machine qui peine (images très espacées), chaque tranche s'allonge un peu : la
    // carte reste prête en quelques images au lieu de s'étirer sur des minutes.
    const slow = Math.min(Math.max((start - last) * 0.12, 0), 60);
    last = start;
    const budget = Math.max(deadline && !deadline.didTimeout ? Math.min(deadline.timeRemaining(), 12) : 8, slow);
    do {
      if (work.next().done) return;
    } while (performance.now() - start < budget);
    schedule();
  };
  const schedule = () => {
    handle = idle ? window.requestIdleCallback(run, { timeout: 400 }) : window.setTimeout(run, 16);
  };
  schedule();
  return () => {
    cancelled = true;
    if (idle) window.cancelIdleCallback(handle);
    else window.clearTimeout(handle);
  };
}
