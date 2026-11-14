import { Color, Vector3 } from 'three';

/**
 * Dôme du ciel peint : dégradé à quatre tons, disque solaire net et son halo, lune en
 * croissant, rémanence du couchant, bancs de cumulus « dessin animé » posés sur l'horizon,
 * étoiles qui scintillent et nappes d'orage.
 *
 * Le dôme suit la caméra : la position locale d'un sommet EST la direction de vue, donc le
 * soleil, la lune et l'horizon sont toujours au bon endroit, d'où que l'on regarde (le
 * reflet du soleil sur l'océan tombe pile sous le disque).
 *
 * Coût : le dôme est dessiné après les objets opaques (renderOrder), le test de profondeur
 * élimine donc tous les pixels cachés par la mer ou les îles ; en vue plongeante, presque
 * aucun pixel du ciel n'est calculé.
 */

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHigh;
uniform vec3 uLow;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uLightDir;
uniform vec3 uSunDisk;
uniform vec3 uSunGlow;
uniform float uSunVisible;
uniform float uHorizonGlow;
uniform vec3 uAfterglow;
uniform float uAfterglowAmount;
uniform vec3 uBelt;
uniform float uBeltAmount;
uniform vec3 uMoonDir;
uniform vec3 uMoonGlow;
uniform float uMoonVisible;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uCloudRim;
uniform float uCloudAmount;
uniform float uNight;
uniform float uTime;
uniform float uStorm;
uniform float uBrightness;

varying vec3 vDir;

#define SKY_TAU 6.28318530718
#define SUN_RADIUS 0.026
#define MOON_RADIUS 0.036

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

/*
 * Banc de cumulus sur l'horizon. Espace (azimut, élévation) exprimé en « cellules » : un
 * nuage par cellule au plus, fait d'un dôme central et de trois bouffées (union de
 * disques : la silhouette festonnée des nuages de dessin animé), base plate.
 * Retourne (couleur, couverture). L'éclairage suit le soleil (ou la lune) : faces éclairées
 * chaudes, dessous violacés, liseré lumineux quand on regarde vers l'astre.
 */
vec4 cumulusBank(vec3 dir, float azimuth, float cells, float drift, float base, float size,
                 float presence, float seed, vec3 tangent, float haze) {
  float scale = cells / SKY_TAU;
  vec2 p = vec2(azimuth * scale + drift, dir.y * scale);
  float baseCells = base * scale;
  if (p.y < baseCells - 0.05 || p.y > baseCells + size * 3.2) return vec4(0.0);

  float idx = floor(p.x);
  float best = -1.0;
  vec2 normal2 = vec2(0.0, 1.0);
  for (int k = -2; k <= 2; k++) {
    float id = idx + float(k);
    float wrapped = mod(id, cells);
    if (hash21(vec2(wrapped, seed)) > presence) continue;
    float h1 = hash21(vec2(wrapped, seed + 7.13));
    float h2 = hash21(vec2(wrapped, seed + 13.7));
    float h3 = hash21(vec2(wrapped, seed + 21.3));
    float r = size * mix(0.55, 1.0, h1);
    vec2 c = vec2(id + 0.5 + (h2 - 0.5) * 0.5, baseCells + r * 0.42);
    // Dôme central + bouffées latérales + petite bouffée sommitale.
    for (int j = 0; j < 4; j++) {
      vec2 o = j == 0 ? vec2(0.0)
             : j == 1 ? vec2(-0.95, -0.22)
             : j == 2 ? vec2(0.9, -0.28)
             : vec2(0.22 + (h3 - 0.5) * 0.4, 0.55);
      float pr = r * (j == 0 ? 1.0 : j == 3 ? 0.58 : mix(0.55, 0.72, fract(h3 * float(j + 3))));
      vec2 pc = c + o * r;
      pc.y = max(pc.y, baseCells + pr * 0.25);
      vec2 d = (p - pc) / pr;
      float inside = 1.0 - length(d);
      if (inside > best) {
        best = inside;
        normal2 = d;
      }
    }
  }
  // Base plate un peu adoucie, bords peints (léger flou + grain de pinceau).
  float edge = best + (valueNoise(p * 6.0 + seed) - 0.5) * 0.06;
  float cover = smoothstep(0.0, 0.07, edge) * smoothstep(baseCells - 0.02, baseCells + 0.05, p.y);
  if (cover <= 0.0) return vec4(0.0);

  float nz = sqrt(max(1.0 - dot(normal2, normal2), 0.0));
  vec3 bitangent = normalize(cross(tangent, dir));
  vec3 n = normalize(tangent * normal2.x + bitangent * normal2.y - dir * nz);
  float lambert = dot(n, uLightDir);
  // Trois tons francs : ombre, demi-teinte, lumière.
  float lit = smoothstep(-0.12, -0.02, lambert) * 0.5 + smoothstep(0.28, 0.38, lambert) * 0.5;
  vec3 color = mix(uCloudShade, uCloudLit, lit);
  // Dessous violacés.
  float under = 1.0 - smoothstep(-0.35, 0.25, normal2.y);
  color = mix(color, uCloudShade * 0.92, under * 0.45);
  // Liseré d'argent : contre-jour et bord tourné vers l'astre.
  float towardSun = smoothstep(0.55, 0.98, dot(dir, uLightDir));
  float fringe = pow(1.0 - nz, 2.5);
  color += uCloudRim * fringe * (towardSun * 1.1 + max(lambert, 0.0) * 0.35);
  // Perspective aérienne : les bancs lointains se fondent dans l'horizon.
  color = mix(color, uHorizon, haze);
  return vec4(color, cover);
}

float starField(vec3 dir, float density, float threshold, float size) {
  vec3 cell = floor(dir * density);
  float seed = hash31(cell);
  if (seed < threshold) return 0.0;
  vec3 jitter = vec3(hash31(cell + 1.7), hash31(cell + 3.1), hash31(cell + 5.9)) - 0.5;
  float d = length(fract(dir * density) - 0.5 - jitter * 0.5);
  float dot2 = 1.0 - smoothstep(size * 0.25, size, d);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + seed * 3.4) + seed * 61.0);
  return dot2 * twinkle * (0.55 + 0.45 * fract(seed * 17.0));
}

void main() {
  vec3 dir = normalize(vDir);
  float e = dir.y;

  // Dégradé à quatre tons : horizon lumineux, bas du ciel, haut du ciel, zénith.
  vec3 sky = mix(uHorizon, uLow, smoothstep(-0.01, 0.13, e));
  sky = mix(sky, uHigh, smoothstep(0.08, 0.42, e));
  sky = mix(sky, uZenith, smoothstep(0.32, 0.98, e));
  // Sous l'horizon (au-delà du bord de la mer) : le ton de l'horizon, un peu plus profond.
  sky = mix(sky, uHorizon * 0.94, 1.0 - smoothstep(-0.12, 0.0, e));

  vec3 flatDir = normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5, 0.0, 0.0));
  vec3 flatSun = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-5, 0.0, 0.0));
  float toward = dot(flatDir, flatSun) * 0.5 + 0.5;
  float aboveHorizon = smoothstep(-0.03, 0.01, e);

  // Embrasement côté soleil (heure dorée), ceinture rose côté opposé.
  float lowBand = exp(-max(e, 0.0) * 5.5);
  sky = mix(sky, uSunGlow, pow(toward, 4.0) * lowBand * uHorizonGlow);
  float belt = smoothstep(0.0, 0.05, e) * (1.0 - smoothstep(0.1, 0.3, e));
  sky = mix(sky, uBelt, pow(1.0 - toward, 1.6) * belt * uBeltAmount);
  // Rémanence : le soleil vient de passer sous l'horizon.
  float after = pow(toward, 3.0) * exp(-max(e, 0.0) * 8.0) * aboveHorizon;
  sky = mix(sky, uAfterglow, after * uAfterglowAmount);

  // Étoiles (et voie lactée discrète) : la nuit, et dans le noir de l'intro.
  float starMask = uNight * (1.0 - uStorm) * smoothstep(0.03, 0.25, e);
  if (starMask > 0.001) {
    vec3 bandAxis = normalize(vec3(0.35, 0.42, -0.84));
    float band = exp(-pow(dot(dir, bandAxis) / 0.2, 2.0));
    float milky = band * (0.55 + 0.45 * valueNoise(vec2(dir.x - dir.z, dir.y + dir.x) * 7.0));
    sky += vec3(0.16, 0.17, 0.3) * milky * 0.22 * starMask;
    float stars = starField(dir, 230.0, 0.9955 - band * 0.004, 0.32)
      + starField(dir, 120.0, 0.9988, 0.26) * 1.6;
    // Les étoiles pâlissent près de la lune.
    float moonClear = 1.0 - smoothstep(0.94, 0.985, dot(dir, uMoonDir));
    sky += vec3(0.88, 0.93, 1.0) * stars * starMask * mix(1.0, moonClear, uMoonVisible);
  }

  // Soleil : disque net, couronne serrée et grand halo doux (les nuages passent devant).
  float sunAngle = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
  float sunAa = fwidth(sunAngle) * 1.2 + 1e-4;
  float sunDisk = 1.0 - smoothstep(SUN_RADIUS - sunAa, SUN_RADIUS + sunAa, sunAngle);
  float corona = exp(-sunAngle * 11.0);
  float halo = exp(-sunAngle * 2.8);
  sky += uSunGlow * (corona * 0.6 + halo * 0.24) * uSunVisible * aboveHorizon;
  sky = mix(sky, uSunDisk, sunDisk * uSunVisible * aboveHorizon);

  // Lune : croissant net, lumière cendrée sur la part sombre, halo froid.
  if (uMoonVisible > 0.001) {
    vec3 moonRight = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 moonUp = cross(moonRight, uMoonDir);
    vec2 mp = vec2(dot(dir, moonRight), dot(dir, moonUp)) / MOON_RADIUS;
    float md = length(mp);
    float front = step(0.0, dot(dir, uMoonDir));
    float moonAa = fwidth(md) * 1.2 + 1e-3;
    float disk = (1.0 - smoothstep(1.0 - moonAa, 1.0 + moonAa, md)) * front;
    float litPart = smoothstep(0.86 - moonAa, 0.86 + moonAa, length(mp - vec2(-0.52, 0.34)));
    float maria = smoothstep(0.52, 0.78, valueNoise(mp * 2.4 + 4.0)) * 0.16;
    vec3 moonLit = vec3(0.97, 0.96, 0.9) * (1.0 - maria);
    vec3 moonColor = mix(uMoonGlow * 0.32 + sky * 0.5, moonLit, litPart);
    float moonHalo = exp(-max(md - 1.0, 0.0) * 0.55) * 0.22 + exp(-max(md - 1.0, 0.0) * 0.12) * 0.1;
    sky += uMoonGlow * moonHalo * front * uMoonVisible * aboveHorizon;
    sky = mix(sky, moonColor, disk * uMoonVisible * aboveHorizon);
  }

  // Bancs de cumulus (deux plans : lointain voilé, proche plus contrasté).
  if (uCloudAmount > 0.001 && e > -0.03 && e < 0.4) {
    float azimuth = atan(dir.z, dir.x);
    vec3 tangent = normalize(vec3(-dir.z, 0.0, dir.x) + vec3(0.0, 0.0, 1e-5));
    vec4 far = cumulusBank(dir, azimuth, 64.0, uTime * 0.0035, -0.004, 0.55, 0.78, 3.0, tangent, 0.42);
    sky = mix(sky, far.rgb, far.a * uCloudAmount);
    vec4 near = cumulusBank(dir, azimuth, 30.0, -uTime * 0.0055, 0.006, 0.62, 0.42, 11.0, tangent, 0.12);
    sky = mix(sky, near.rgb, near.a * uCloudAmount);
  }

  // Nappes d'orage (la couverture de la tempête vit ici).
  if (uStorm > 0.001) {
    vec2 cloudUv = dir.xz / max(0.18, e + 0.42);
    float highLayer = valueNoise(cloudUv * 1.15 + vec2(uTime * 0.010, -uTime * 0.004));
    highLayer = highLayer * 0.68
      + valueNoise(cloudUv * 2.35 + vec2(-uTime * 0.007, uTime * 0.009) + 8.7) * 0.32;
    float midLayer = valueNoise(cloudUv * 0.72 + vec2(-uTime * 0.016, uTime * 0.006) - 4.2);
    midLayer = midLayer * 0.58
      + valueNoise(cloudUv * 1.8 + vec2(uTime * 0.012, uTime * 0.005) + 13.1) * 0.42;
    float coverEdge = mix(0.78, 0.43, uStorm);
    float highClouds = smoothstep(coverEdge, 0.9, highLayer) * uStorm;
    float midClouds = smoothstep(coverEdge - 0.06, 0.86, midLayer) * uStorm;
    float altitudeMask = smoothstep(-0.06, 0.26, e);
    vec3 cloudHigh = mix(vec3(0.47, 0.55, 0.59), vec3(0.25, 0.32, 0.37), uStorm);
    vec3 cloudMid = mix(vec3(0.38, 0.46, 0.50), vec3(0.12, 0.19, 0.24), uStorm);
    sky = mix(sky, cloudHigh, highClouds * altitudeMask * 0.6);
    sky = mix(sky, cloudMid, midClouds * altitudeMask * 0.72);
  }

  gl_FragColor = vec4(sky * uBrightness, 1.0);
  #include <colorspace_fragment>
}
`;

/** Uniformes du ciel : un seul exemplaire dans la scène, muté une fois par image. */
export const skyUniforms = {
  uZenith: { value: new Color('#04070a') },
  uHigh: { value: new Color('#04070a') },
  uLow: { value: new Color('#04070a') },
  uHorizon: { value: new Color('#04070a') },
  uSunDir: { value: new Vector3(0.6, 0.7, 0.4).normalize() },
  uLightDir: { value: new Vector3(0.6, 0.7, 0.4).normalize() },
  uSunDisk: { value: new Color('#fff6e4') },
  uSunGlow: { value: new Color('#ffe8c0') },
  uSunVisible: { value: 0 },
  uHorizonGlow: { value: 0 },
  uAfterglow: { value: new Color('#ff9a62') },
  uAfterglowAmount: { value: 0 },
  uBelt: { value: new Color('#e9a3b8') },
  uBeltAmount: { value: 0 },
  uMoonDir: { value: new Vector3(0, 0.25, 1).normalize() },
  uMoonGlow: { value: new Color('#9fb8e8') },
  uMoonVisible: { value: 0 },
  uCloudLit: { value: new Color('#ffffff') },
  uCloudShade: { value: new Color('#b8bfe0') },
  uCloudRim: { value: new Color('#ffffff') },
  uCloudAmount: { value: 0 },
  uNight: { value: 1 },
  uTime: { value: 0 },
  uStorm: { value: 0 },
  uBrightness: { value: 0.9 },
};
