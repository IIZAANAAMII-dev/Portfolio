import { Color, DoubleSide, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { spineTexture } from './rig';
import { krakenSkin } from './skin';
import { SPINE, SPINE_ROWS } from './state';

/**
 * Matériaux du kraken : des MeshStandardMaterial (donc le cel-shading global et les ombres
 * violettes de lib/toon.ts) dont le vertex shader accroche la géométrie au squelette
 * (texture `uSpine`), et dont le fragment ajoute ventre crème, reflet mouillé franc, liseré
 * froid d'orage, irisation et flash d'éclair.
 */
export const krakenUniforms = {
  uSpine: { value: spineTexture },
  uTime: { value: 0 },
  uWiggle: { value: 1 },
  uFlash: { value: 0 },
  uNight: { value: 0 },
  uRim: { value: new Color('#86a4b8') },
  uWet: { value: 0 },
  uLid: { value: 1 },
  uPupil: { value: 0.3 },
  uEyeGlow: { value: 0 },
};

/* ------------------------------------------------------------------ GLSL partagé */

const SPINE_PARS = /* glsl */ `
uniform sampler2D uSpine;
uniform float uTime;
uniform float uWiggle;
varying float vVentral;
varying float vS;
varying float vWet;

vec4 krTexel(int k, int row) {
  return texelFetch(uSpine, ivec2(k, row), 0);
}

// Repère du bras « arm » à l'abscisse s : centre (Catmull-Rom), rayon, face ventrale, tangente.
void krFrame(float arm, float s, out vec3 C, out float R, out vec3 N, out vec3 T, out float wet) {
  float fi = clamp(s, 0.0, 1.0) * ${(SPINE - 1).toFixed(1)};
  int k1 = int(min(floor(fi), ${(SPINE - 2).toFixed(1)}));
  float f = fi - float(k1);
  int k0 = max(k1 - 1, 0);
  int k2 = k1 + 1;
  int k3 = min(k1 + 2, ${SPINE - 1});
  int row = int(arm + 0.5) * ${SPINE_ROWS};
  vec4 a0 = krTexel(k0, row);
  vec4 a1 = krTexel(k1, row);
  vec4 a2 = krTexel(k2, row);
  vec4 a3 = krTexel(k3, row);
  float f2 = f * f;
  float f3 = f2 * f;
  C = 0.5 * (2.0 * a1.xyz + (a2.xyz - a0.xyz) * f
    + (2.0 * a0.xyz - 5.0 * a1.xyz + 4.0 * a2.xyz - a3.xyz) * f2
    + (3.0 * a1.xyz - a0.xyz - 3.0 * a2.xyz + a3.xyz) * f3);
  R = mix(a1.w, a2.w, f);
  vec4 t1 = krTexel(k1, row + 2);
  vec4 t2 = krTexel(k2, row + 2);
  T = normalize(mix(t1.xyz, t2.xyz, f) + vec3(0.0, 1e-5, 0.0));
  vec3 n = mix(krTexel(k1, row + 1).xyz, krTexel(k2, row + 1).xyz, f);
  N = normalize(n - T * dot(n, T) + vec3(1e-5, 0.0, 0.0));
  wet = mix(t1.w, t2.w, f);
  // Ondulation fine calculée ici : une vague court le long du bras, plus ample vers la pointe.
  vec3 B = cross(T, N);
  float ripple = sin(s * 17.0 - uTime * 2.4 + arm * 1.9) * 0.6
    + sin(s * 31.0 - uTime * 3.7 + arm * 0.7) * 0.25;
  C += B * ripple * s * s * 0.35 * uWiggle;
}
`;

const ARM_NORMAL = /* glsl */ `
vec3 krC; float krR; vec3 krN; vec3 krT; float krWet;
krFrame(position.x, position.y, krC, krR, krN, krT, krWet);
vec3 krB = cross(krT, krN);
float krCos = cos(position.z);
vec3 krDir = krCos * krN + sin(position.z) * krB;
vec3 objectNormal = normalize(krDir);
vVentral = krCos;
vS = position.y;
vWet = krWet;
#ifdef USE_TANGENT
  vec3 objectTangent = krT;
#endif
`;

const ARM_POSITION = /* glsl */ `
// Ventre un peu aplati, plis annulaires très légers.
float krFlat = 1.0 - 0.16 * pow(max(krCos, 0.0), 2.0);
float krRings = 1.0 + 0.03 * sin(position.y * 230.0);
vec3 transformed = krC + krDir * krR * krFlat * krRings;
`;

const SUCKER_NORMAL = /* glsl */ `
vec3 krC; float krR; vec3 krN; vec3 krT; float krWet;
krFrame(aSucker.x, aSucker.y, krC, krR, krN, krT, krWet);
vec3 krB = cross(krT, krN);
float krAng = aSucker.z * 0.44;
vec3 krUp = normalize(cos(krAng) * krN + sin(krAng) * krB);
vec3 krX = normalize(krT - krUp * dot(krT, krUp));
vec3 krZ = cross(krX, krUp);
vec3 objectNormal = normalize(krX * normal.x + krUp * normal.y + krZ * normal.z);
vVentral = 1.0;
vS = aSucker.y;
vWet = krWet;
`;

const SUCKER_POSITION = /* glsl */ `
float krFlat = 1.0 - 0.16 * pow(max(cos(krAng), 0.0), 2.0);
float krSize = krR * 0.34 * aSucker.w;
// Les ventouses palpitent, chacune à son rythme.
float krPulse = 1.0 + 0.12 * sin(uTime * 2.6 + aSucker.y * 47.0 + aSucker.x * 3.0);
vec3 transformed = krC + krUp * krR * krFlat * 0.97
  + (krX * position.x + krUp * position.y * krPulse + krZ * position.z) * krSize;
`;

/** Varyings et uniforms du fragment de peau. */
const SKIN_FRAGMENT_PARS = /* glsl */ `
uniform float uTime;
uniform float uFlash;
uniform float uNight;
uniform vec3 uRim;
uniform float uWet;
uniform float uLid;
#if defined(KR_ARM) || defined(KR_SUCKER)
  varying float vVentral;
  varying float vS;
  varying float vWet;
#else
  varying vec3 vKrLocal;
#endif
`;

const SKIN_COLOR = /* glsl */ `
#include <map_fragment>
float krWetness = 0.0;
float krBelly = 0.0;
float krAlong = 0.5;
#ifdef KR_ARM
{
  // Dos cramoisi qui vire au pourpre vers la pointe, ventre crème côté ventouses.
  krAlong = smoothstep(0.1, 0.95, vS);
  diffuseColor.rgb *= mix(vec3(1.06, 0.9, 0.94), vec3(0.7, 0.56, 1.12), krAlong);
  krBelly = smoothstep(0.18, 0.72, vVentral);
  float krLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  vec3 krCream = vec3(0.86, 0.6, 0.5) * (0.72 + krLum * 1.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, krCream, krBelly * 0.9);
  krWetness = vWet;
}
#endif
#ifdef KR_SUCKER
  krBelly = 1.0;
  krWetness = vWet;
  krAlong = vS;
#endif
#if !defined(KR_ARM) && !defined(KR_SUCKER)
{
  krWetness = uWet;
  // Eau qui ruisselle en nappes sur la tête qui vient de crever la surface.
  float krAz = atan(vKrLocal.z, vKrLocal.x);
  float krLaneId = floor(krAz * 9.0);
  float krRand = fract(sin(krLaneId * 91.7 + 3.1) * 43758.5);
  float krLane = fract(krAz * 9.0);
  float krLine = 1.0 - smoothstep(0.0, 0.04 + krRand * 0.06, abs(krLane - 0.5));
  float krFlow = fract(vKrLocal.y * 0.32 + uTime * (0.7 + krRand * 0.8) + krRand * 5.0);
  float krDrop = smoothstep(0.0, 0.12, krFlow) * (1.0 - smoothstep(0.45, 1.0, krFlow));
  float krSheet = krLine * krDrop * step(0.3, krRand) * uWet;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.72, 0.78), krSheet * 0.3);
  krWetness = max(krWetness * 0.6, krSheet);
}
#endif
#ifdef KR_LID
{
  // Paupière : sphère ouverte en amande devant l'œil ; uLid = 0 ferme.
  vec3 krD = normalize(vKrLocal);
  float krAzL = atan(krD.x, krD.z);
  float krEl = asin(clamp(krD.y, -1.0, 1.0));
  float krW = 0.8;
  float krHalf = uLid * 0.62 * pow(max(0.0, 1.0 - (krAzL * krAzL) / (krW * krW)), 0.6);
  float krFront = step(0.0, krD.z) * step(abs(krAzL), krW);
  if (krFront > 0.5 && abs(krEl) < krHalf) discard;
  float krEdge = 1.0 - smoothstep(0.0, 0.08, abs(krEl) - krHalf);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.015, 0.04), krEdge * krFront);
}
#endif
`;

const SKIN_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, clamp(krWetness, 0.0, 1.0));
`;

const SKIN_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
// Photophores : seulement sur le dos.
totalEmissiveRadiance *= 1.0 - krBelly;
`;

const SKIN_LIGHT = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 krV = geometryViewDir;
  float krFres = 1.0 - saturate(dot(normal, krV));
  // Liseré froid du ciel d'orage : la silhouette se lit même de nuit.
  totalEmissiveRadiance += uRim * smoothstep(0.6, 0.95, krFres) * (0.14 + 0.6 * uNight) * (0.3 + diffuseColor.rgb * 1.8);
  // Chair translucide : la couleur reste saturée dans la pénombre de l'orage.
  totalEmissiveRadiance += diffuseColor.rgb * (0.13 + uNight * 0.06) * (1.0 - krBelly * 0.4);
  // Irisation discrète (film d'eau et de mucus), surtout sur le dos.
  vec3 krIrid = 0.5 + 0.5 * cos(6.2832 * (krFres * 1.4 + krAlong * 0.8 + vec3(0.0, 0.33, 0.67)));
  totalEmissiveRadiance += krIrid * pow(krFres, 2.6) * 0.17 * (1.0 - krBelly * 0.6);
  #if NUM_DIR_LIGHTS > 0
    // Reflet mouillé, net comme un aplat de dessin animé.
    vec3 krH = normalize(directionalLights[0].direction + krV);
    float krSpec = smoothstep(0.93, 0.95, dot(normal, krH));
    totalEmissiveRadiance += directionalLights[0].color * krSpec * (0.22 + krWetness * 0.6);
  #endif
  // Reflet de ciel sur la peau mouillée, visible même sans soleil.
  float krSky = smoothstep(0.86, 0.9, dot(normal, normalize(vec3(-0.3, 0.75, 0.6))));
  totalEmissiveRadiance += uRim * krSky * krWetness * 0.5;
  // Eclair : le kraken surgit, blanc bleuté, le temps d'un flash.
  totalEmissiveRadiance += vec3(0.7, 0.85, 1.0) * uFlash * (0.1 + krFres * 0.9);
}
`;

const LOCAL_VARYING_VERTEX = /* glsl */ `
#include <begin_vertex>
vKrLocal = position;
`;

type Kind = 'arm' | 'sucker' | 'head' | 'lid';

function patchSkin(shader: WebGLProgramParametersWithUniforms, kind: Kind) {
  Object.assign(shader.uniforms, krakenUniforms);
  const define = kind === 'arm' ? '#define KR_ARM\n' : kind === 'sucker' ? '#define KR_SUCKER\n' : kind === 'lid' ? '#define KR_LID\n' : '';
  if (kind === 'arm' || kind === 'sucker') {
    const pars = kind === 'sucker' ? `${SPINE_PARS}\nattribute vec4 aSucker;` : SPINE_PARS;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${pars}`)
      .replace('#include <beginnormal_vertex>', kind === 'arm' ? ARM_NORMAL : SUCKER_NORMAL)
      .replace('#include <begin_vertex>', kind === 'arm' ? ARM_POSITION : SUCKER_POSITION);
  } else {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKrLocal;')
      .replace('#include <begin_vertex>', LOCAL_VARYING_VERTEX);
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `${define}#include <common>\n${SKIN_FRAGMENT_PARS}`)
    .replace('#include <map_fragment>', SKIN_COLOR)
    .replace('#include <roughnessmap_fragment>', SKIN_ROUGHNESS)
    .replace('#include <emissivemap_fragment>', SKIN_EMISSIVE)
    .replace('#include <lights_fragment_end>', SKIN_LIGHT);
}

/* ------------------------------------------------------------------ Œil */

const EYE_COLOR = /* glsl */ `
float krIrisGlow = 0.0;
{
  // Regard vers +Z local. Coordonnées polaires autour de l'axe du regard.
  vec3 krD = normalize(vKrLocal);
  float krR = acos(clamp(krD.z, -1.0, 1.0));
  float krAz = atan(krD.y, krD.x);
  vec2 krQ = vec2(cos(krAz), sin(krAz)) * krR;
  float krIrisR = 0.58;
  // Sclère jaune crème, assombrie vers l'arrière, veinée de rouge autour de l'iris.
  vec3 krSclera = mix(vec3(0.8, 0.66, 0.34), vec3(0.36, 0.15, 0.08), smoothstep(0.85, 1.9, krR));
  float krVein = sin(krAz * 23.0 + sin(krR * 9.0 + krAz * 3.0) * 2.2) * sin(krAz * 11.0 - krR * 6.0);
  float krVeins = smoothstep(0.84, 0.98, abs(krVein)) * (1.0 - smoothstep(krIrisR, krIrisR + 0.8, krR));
  krSclera = mix(krSclera, vec3(0.52, 0.04, 0.05), krVeins * 0.8);
  krSclera = mix(krSclera, vec3(0.62, 0.18, 0.12), (1.0 - smoothstep(krIrisR, krIrisR + 0.12, krR)) * 0.6);
  // Iris doré à stries radiales, anneau limbique sombre.
  float krStria = 0.5 + 0.5 * sin(krAz * 46.0 + sin(krAz * 7.0) * 3.0 + krR * 18.0);
  vec3 krIris = mix(vec3(0.98, 0.7, 0.16), vec3(0.66, 0.2, 0.03), smoothstep(0.05, krIrisR, krR));
  krIris *= 0.72 + krStria * 0.42;
  krIris = mix(krIris, vec3(0.16, 0.05, 0.02), smoothstep(krIrisR - 0.12, krIrisR, krR));
  float krInIris = 1.0 - smoothstep(krIrisR - 0.01, krIrisR + 0.02, krR);
  vec3 krEye = mix(krSclera, krIris, krInIris);
  // Pupille fendue horizontale, pincée au centre (haltère), qui se dilate.
  float krPx = krQ.x / (krIrisR * 0.9);
  float krPy = krQ.y / max(0.02, krIrisR * uPupil);
  float krShape = length(vec2(krPx, krPy * (1.0 + 0.6 * (1.0 - krPx * krPx))));
  float krPupil = 1.0 - smoothstep(0.88, 1.0, krShape);
  krEye = mix(krEye, vec3(0.008, 0.003, 0.012), krPupil);
  diffuseColor.rgb = krEye;
  krIrisGlow = krInIris * (1.0 - krPupil) * (0.55 + krStria * 0.45);
}
`;

const EYE_LIGHT = /* glsl */ `
#include <lights_fragment_end>
{
  // Reflets d'œil mouillé, fixes à l'écran comme dans un dessin animé.
  float krCatch = smoothstep(0.972, 0.982, dot(normal, normalize(vec3(-0.45, 0.55, 0.7))))
    + smoothstep(0.994, 0.997, dot(normal, normalize(vec3(0.35, -0.25, 0.9)))) * 0.7;
  totalEmissiveRadiance += vec3(1.0, 0.98, 0.92) * krCatch * 1.5;
  // Iris luminescent la nuit et quand il fixe le bateau.
  totalEmissiveRadiance += vec3(1.0, 0.58, 0.1) * krIrisGlow * uEyeGlow;
  float krFres = 1.0 - saturate(dot(normal, geometryViewDir));
  totalEmissiveRadiance += vec3(0.6, 0.75, 0.82) * pow(krFres, 3.0) * 0.4;
  totalEmissiveRadiance += vec3(0.7, 0.85, 1.0) * uFlash * 0.25;
}
`;

function patchEye(shader: WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, krakenUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vKrLocal;')
    .replace('#include <begin_vertex>', LOCAL_VARYING_VERTEX);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vKrLocal;\nuniform float uPupil;\nuniform float uEyeGlow;\nuniform float uFlash;')
    .replace('#include <map_fragment>', EYE_COLOR)
    .replace('#include <lights_fragment_end>', EYE_LIGHT);
}

/* ------------------------------------------------------------------ Fabrique (une fois) */

type Materials = ReturnType<typeof createMaterials>;
let cache: Materials | null = null;

function skinMaterial(kind: Kind) {
  const { skin, glow } = krakenSkin();
  const material = new MeshStandardMaterial({
    map: skin,
    bumpMap: skin,
    bumpScale: kind === 'head' || kind === 'lid' ? 0.55 : 0.35,
    emissive: new Color('#ffffff'),
    emissiveMap: glow,
    emissiveIntensity: 0,
    roughness: 0.46,
    metalness: 0,
  });
  material.name = `kraken-${kind}`;
  material.onBeforeCompile = (shader) => patchSkin(shader, kind);
  material.customProgramCacheKey = () => `kraken-${kind}-v1`;
  return material;
}

function createMaterials() {
  const arm = skinMaterial('arm');
  const head = skinMaterial('head');
  const lid = skinMaterial('lid');
  const sucker = new MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0, side: DoubleSide });
  sucker.name = 'kraken-sucker';
  sucker.onBeforeCompile = (shader) => patchSkin(shader, 'sucker');
  sucker.customProgramCacheKey = () => 'kraken-sucker-v1';
  const eye = new MeshStandardMaterial({ roughness: 0.14, metalness: 0 });
  eye.name = 'kraken-eye';
  eye.onBeforeCompile = patchEye;
  eye.customProgramCacheKey = () => 'kraken-eye-v1';
  return { arm, head, lid, sucker, eye };
}

export function krakenMaterials() {
  cache ??= createMaterials();
  return cache;
}
