import {
  Color,
  DoubleSide,
  FrontSide,
  Matrix4,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector4,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { SUBSTANCE_TEXTURES } from './generated-textures';
import { SUBSTANCES, type SubstanceId, type SubstanceKind } from './substances';

/**
 * Matériau Substance pour three.js.
 *
 * Un `MeshStandardMaterial` dont le shader est complété (onBeforeCompile) pour :
 *  - projeter les textures Substance soit par les UV du modèle (`uv`), avec une répétition
 *    calculée depuis la densité UV mesurée par le pipeline, soit sans UV (`triplanar`),
 *    ce qui évite toute couture sur les rochers et le relief procédural des îles ;
 *  - poser un second matériau sur les faces tournées vers le ciel (`top` : herbe sur
 *    falaise, mousse sur roche) ;
 *  - peindre une bande et un liseré en hauteur (ligne de flottaison d'une coque) ;
 *  - recolorer une texture en conservant sa luminance (bois peint, enduit) ;
 *  - tant que les cartes n'existent pas, rendre un repli procédural (bruit + palette du
 *    .sbsar) : la scène est juste dès la première image, les textures l'enrichissent.
 *
 * Les textures sont chargées en arrière-plan : le matériau est utilisable immédiatement
 * et se recompile une seule fois quand ses cartes arrivent.
 */

export interface SubstanceOptions {
  /** `uv` (défaut) : UV du modèle ; `triplanar` : projection sans UV. */
  projection?: 'uv' | 'triplanar';
  /** Espace de la projection et des masques : `world` pour le décor fixe, `object` pour ce qui bouge. */
  space?: 'world' | 'object';
  /** Densité UV du modèle (unités UV par mètre), écrite par le pipeline dans material.userData. */
  uvDensity?: number;
  /** Facteur sur la taille physique du motif (2 = motif deux fois plus grand). */
  scale?: number;
  /** Teinte multiplicative. */
  tint?: string;
  /** Recoloration qui conserve le détail (luminance) de la texture. */
  recolor?: string;
  recolorAmount?: number;
  /** Matériau posé sur les faces orientées vers le haut. */
  top?: SubstanceId;
  /** Seuil sur la composante verticale de la normale (0 = vertical, 1 = horizontal). */
  topThreshold?: number;
  topSoftness?: number;
  topAmount?: number;
  /** Matériau posé sous une altitude (sable de plage sous la falaise), projection verticale. */
  low?: SubstanceId;
  /** Altitude (dans l'espace de projection) sous laquelle `low` apparaît. */
  lowBelow?: number;
  lowSoftness?: number;
  lowAmount?: number;
  /** Peinture sous une hauteur, en espace objet (avant mise à l'échelle). */
  band?: { color: string; below: number; softness?: number };
  /** Liseré horizontal, en espace objet. */
  stripe?: { color: string; at: number; width: number };
  roughness?: number;
  metalness?: number;
  normalStrength?: number;
  side?: 'front' | 'double';
  transparent?: boolean;
  alphaTest?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

const NOISE_FREQUENCY: Record<SubstanceKind, number> = {
  wood: 2.4,
  rock: 0.9,
  ground: 0.7,
  wall: 1.6,
  metal: 1.8,
  organic: 2.2,
  water: 0.4,
  fx: 1,
};

const VERTEX_PARS = /* glsl */ `
varying vec3 vSubPos;
varying vec3 vSubNormal;
varying float vSubObjY;
#if defined( SUB_BAND ) || defined( SUB_STRIPE )
  uniform mat4 uSubRoot;
#endif
`;

const VERTEX_MAIN = /* glsl */ `
{
  vec4 subPosition = vec4( transformed, 1.0 );
  vec3 subNormalIn = objectNormal;
  #ifdef USE_INSTANCING
    subPosition = instanceMatrix * subPosition;
    subNormalIn = mat3( instanceMatrix ) * subNormalIn;
  #endif
  #ifdef SUB_WORLD
    subPosition = modelMatrix * subPosition;
    subNormalIn = mat3( modelMatrix ) * subNormalIn;
  #endif
  vSubPos = subPosition.xyz;
  vSubNormal = subNormalIn;
  // Hauteur dans le repère du modèle (mètres, avant mise à l'échelle) : les fichiers sont
  // quantifiés, \`transformed\` n'est donc pas en mètres. uSubRoot = inverse du monde de la racine.
  #if defined( SUB_BAND ) || defined( SUB_STRIPE )
    vSubObjY = ( uSubRoot * modelMatrix * vec4( transformed, 1.0 ) ).y;
  #else
    vSubObjY = 0.0;
  #endif
}
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vSubPos;
varying vec3 vSubNormal;
varying float vSubObjY;
#if defined( TRI_NORMAL ) && ! defined( SUB_WORLD )
  // Uniforme du vertex shader, redéclarée ici : three.js la renseigne pour tout le programme.
  uniform mat3 normalMatrix;
#endif
uniform vec3 uSubShade;
uniform vec3 uSubBase;
uniform vec3 uSubLight;
uniform float uSubScale;
uniform float uSubNoise;
uniform float uSubNormalScale;
uniform float uSubAo;
#ifdef TRI_MAP
  uniform sampler2D uTriMap;
#endif
#ifdef TRI_NORMAL
  uniform sampler2D uTriNormal;
#endif
#ifdef TRI_ORM
  uniform sampler2D uTriOrm;
#endif
#ifdef SUB_TOP
  uniform vec3 uTopShade;
  uniform vec3 uTopBase;
  uniform vec3 uTopLight;
  uniform vec4 uTopParams;
  #ifdef TOP_MAP
    uniform sampler2D uTopMap;
  #endif
#endif
#ifdef SUB_LOW
  uniform vec3 uLowShade;
  uniform vec3 uLowBase;
  uniform vec3 uLowLight;
  uniform vec4 uLowParams;
  #ifdef LOW_MAP
    uniform sampler2D uLowMap;
  #endif
#endif
#ifdef SUB_RECOLOR
  uniform vec4 uRecolor;
#endif
#ifdef SUB_BAND
  uniform vec4 uBand;
  uniform float uBandSoft;
#endif
#ifdef SUB_STRIPE
  uniform vec4 uStripe;
  uniform float uStripeWidth;
#endif

float subHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}

float subNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( subHash( i ), subHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ),
         mix( subHash( i + vec3( 0.0, 1.0, 0.0 ) ), subHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
    mix( mix( subHash( i + vec3( 0.0, 0.0, 1.0 ) ), subHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ),
         mix( subHash( i + vec3( 0.0, 1.0, 1.0 ) ), subHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ),
    f.z );
}

float subFbm( vec3 p ) {
  return subNoise( p ) * 0.6 + subNoise( p * 2.13 + 3.1 ) * 0.28 + subNoise( p * 4.7 + 7.7 ) * 0.12;
}

vec3 subWeights( vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 4.0 ) );
  return w / max( w.x + w.y + w.z, 1e-4 );
}

vec4 subTri( sampler2D tex, vec3 p, vec3 w ) {
  return texture2D( tex, p.zy ) * w.x + texture2D( tex, p.xz ) * w.y + texture2D( tex, p.xy ) * w.z;
}

vec3 subPalette( vec3 shade, vec3 base, vec3 light, float n ) {
  return n < 0.5
    ? mix( shade, base, smoothstep( 0.0, 0.5, n ) )
    : mix( base, light, smoothstep( 0.5, 1.0, n ) );
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec3 subN = normalize( vSubNormal );
vec3 subW = subWeights( subN );
vec3 subP = vSubPos * uSubScale;
float subVar = subFbm( vSubPos * uSubNoise );
#ifdef TRI_MAP
  diffuseColor *= subTri( uTriMap, subP, subW );
#elif defined( USE_MAP )
  #include <map_fragment>
#else
  float subTone = clamp( subVar * 1.25 - 0.12, 0.0, 1.0 );
  #ifdef SUB_KIND_WOOD
    float subGrain = subNoise( vSubPos * vec3( uSubNoise * 0.35, uSubNoise * 5.0, uSubNoise * 0.35 ) );
    subTone = clamp( mix( subTone, subGrain, 0.4 ), 0.0, 1.0 );
  #endif
  vec3 subColor = subPalette( uSubShade, uSubBase, uSubLight, subTone );
  #ifdef SUB_KIND_ROCK
    // Arêtes supérieures éclaircies, comme les « top colors » des falaises Substance.
    subColor = mix( subColor, uSubLight, smoothstep( 0.55, 0.95, subN.y ) * 0.32 );
  #endif
  diffuseColor.rgb *= subColor;
#endif
// Part de la surface couverte par un matériau « plat » (herbe, sable) : le relief de la
// roche y est atténué plus bas, dans les normales et la rugosité.
float subFlat = 0.0;
#ifdef SUB_TOP
  float subTopMask = smoothstep(
    uTopParams.x - uTopParams.y,
    uTopParams.x + uTopParams.y,
    subN.y + ( subVar - 0.5 ) * 0.45
  ) * uTopParams.z;
  #ifdef TOP_MAP
    vec3 subTopColor = texture2D( uTopMap, vSubPos.xz * uTopParams.w ).rgb;
  #else
    vec3 subTopColor = subPalette( uTopShade, uTopBase, uTopLight, subFbm( vSubPos * uSubNoise * 1.6 + 11.0 ) );
  #endif
  diffuseColor.rgb = mix( diffuseColor.rgb, subTopColor, subTopMask );
  subFlat = subTopMask;
#endif
#ifdef SUB_LOW
  float subLowMask = ( 1.0 - smoothstep(
    uLowParams.x - uLowParams.y,
    uLowParams.x + uLowParams.y,
    vSubPos.y + ( subVar - 0.5 ) * 0.35
  ) ) * uLowParams.z;
  #ifdef LOW_MAP
    vec3 subLowColor = texture2D( uLowMap, vSubPos.xz * uLowParams.w ).rgb;
  #else
    vec3 subLowColor = subPalette( uLowShade, uLowBase, uLowLight, subFbm( vSubPos * uSubNoise * 2.1 + 23.0 ) );
  #endif
  diffuseColor.rgb = mix( diffuseColor.rgb, subLowColor, subLowMask );
  subFlat = max( subFlat, subLowMask );
#endif
#ifdef SUB_RECOLOR
  float subLuma = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uRecolor.rgb * clamp( subLuma * 3.4, 0.0, 1.6 ), uRecolor.a );
#endif
#ifdef SUB_BAND
  float subBandMask = 1.0 - smoothstep( uBand.a - uBandSoft, uBand.a + uBandSoft, vSubObjY );
  float subBandLuma = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uBand.rgb * ( 0.62 + subBandLuma * 1.6 ), subBandMask );
#endif
#ifdef SUB_STRIPE
  float subStripeMask = 1.0 - smoothstep(
    uStripeWidth * 0.5,
    uStripeWidth * 0.5 + 0.012,
    abs( vSubObjY - uStripe.a )
  );
  diffuseColor.rgb = mix( diffuseColor.rgb, uStripe.rgb, subStripeMask );
#endif
`;

const FRAGMENT_ROUGHNESS = /* glsl */ `
#ifdef TRI_ORM
  vec3 subOrm = subTri( uTriOrm, subP, subW ).rgb;
  float roughnessFactor = roughness * subOrm.g;
#else
  #include <roughnessmap_fragment>
#endif
roughnessFactor = mix( roughnessFactor, 0.95, subFlat );
`;

const FRAGMENT_METALNESS = /* glsl */ `
#ifdef TRI_ORM
  float metalnessFactor = metalness * subOrm.b;
#else
  #include <metalnessmap_fragment>
#endif
`;

const FRAGMENT_NORMAL = /* glsl */ `
#ifdef TRI_NORMAL
  // Mélange « whiteout » (B. Golus) des trois normales tangentes, réorientées en espace
  // de projection, puis ramenées en espace vue pour l'éclairage.
  vec3 subTnX = texture2D( uTriNormal, subP.zy ).xyz * 2.0 - 1.0;
  vec3 subTnY = texture2D( uTriNormal, subP.xz ).xyz * 2.0 - 1.0;
  vec3 subTnZ = texture2D( uTriNormal, subP.xy ).xyz * 2.0 - 1.0;
  float subRelief = uSubNormalScale * ( 1.0 - subFlat * 0.8 );
  subTnX.xy *= subRelief;
  subTnY.xy *= subRelief;
  subTnZ.xy *= subRelief;
  subTnX = vec3( subTnX.xy + subN.zy, abs( subTnX.z ) * subN.x );
  subTnY = vec3( subTnY.xy + subN.xz, abs( subTnY.z ) * subN.y );
  subTnZ = vec3( subTnZ.xy + subN.xy, abs( subTnZ.z ) * subN.z );
  vec3 subMapped = normalize( subTnX.zyx * subW.x + subTnY.xzy * subW.y + subTnZ.xyz * subW.z );
  #ifdef SUB_WORLD
    normal = normalize( ( viewMatrix * vec4( subMapped, 0.0 ) ).xyz );
  #else
    normal = normalize( normalMatrix * subMapped );
  #endif
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
#else
  #include <normal_fragment_maps>
#endif
`;

const FRAGMENT_AO = /* glsl */ `
#ifdef TRI_ORM
  float subAmbient = ( subOrm.r - 1.0 ) * uSubAo + 1.0;
  reflectedLight.indirectDiffuse *= subAmbient;
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float subDotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( subDotNV, subAmbient, material.roughness );
  #endif
#else
  #include <aomap_fragment>
#endif
`;

function patch(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERTEX_MAIN}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
    .replace('#include <map_fragment>', FRAGMENT_COLOR)
    .replace('#include <roughnessmap_fragment>', FRAGMENT_ROUGHNESS)
    .replace('#include <metalnessmap_fragment>', FRAGMENT_METALNESS)
    .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL)
    .replace('#include <aomap_fragment>', FRAGMENT_AO);
}

/* ------------------------------------------------------------------------------------ */
/* Textures                                                                             */
/* ------------------------------------------------------------------------------------ */

type MapName = 'basecolor' | 'normal' | 'orm';

const loader = new TextureLoader();
const textureCache = new Map<string, Promise<Texture | null>>();

export function substanceTextureUrl(id: SubstanceId, map: MapName) {
  const set = SUBSTANCE_TEXTURES[id];
  return `/textures/substance/${id}/${map}.webp${set ? `?v=${set.version}` : ''}`;
}

function loadMap(id: SubstanceId, map: MapName): Promise<Texture | null> {
  const set = SUBSTANCE_TEXTURES[id];
  if (!set || !set[map]) return Promise.resolve(null);
  const key = `${id}/${map}`;
  let pending = textureCache.get(key);
  if (!pending) {
    pending = loader
      .loadAsync(substanceTextureUrl(id, map))
      .then((texture) => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.colorSpace = map === 'basecolor' ? SRGBColorSpace : NoColorSpace;
        texture.anisotropy = 4;
        texture.name = `${id}/${map}`;
        texture.needsUpdate = true;
        return texture;
      })
      .catch((error: unknown) => {
        console.warn(`[substance] ${id}/${map} indisponible :`, error);
        return null;
      });
    textureCache.set(key, pending);
  }
  return pending;
}

/** Copie qui partage l'image (une seule copie GPU) mais porte sa propre répétition. */
function repeated(texture: Texture, repeat: number) {
  if (Math.abs(repeat - 1) < 1e-4) return texture;
  const copy = texture.clone();
  copy.repeat.set(repeat, repeat);
  copy.needsUpdate = true;
  return copy;
}

/* ------------------------------------------------------------------------------------ */
/* Fabrique                                                                             */
/* ------------------------------------------------------------------------------------ */

type Uniforms = Record<string, { value: unknown }>;

/** Chargements de cartes en cours : l'écran de chargement peut les attendre. */
const pendingTextures = new Set<Promise<unknown>>();

function track(promise: Promise<unknown>) {
  pendingTextures.add(promise);
  void promise.finally(() => pendingTextures.delete(promise));
}

/**
 * Résout quand les cartes des matériaux déjà créés sont arrivées (ou après `timeout` ms) :
 * la première image ne montre pas le repli procédural se changer en texture.
 */
export function substanceTexturesSettled(timeout = 2500) {
  return Promise.race([
    Promise.allSettled([...pendingTextures]),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

const materialCache = new Map<string, MeshStandardMaterial>();

/** Matériau partagé : deux appels avec les mêmes options renvoient la même instance. */
export function getSubstanceMaterial(id: SubstanceId, options: SubstanceOptions = {}) {
  const key = `${id}|${JSON.stringify(options)}`;
  let material = materialCache.get(key);
  if (!material) {
    material = createSubstanceMaterial(id, options);
    materialCache.set(key, material);
  }
  return material;
}

export function createSubstanceMaterial(id: SubstanceId, options: SubstanceOptions = {}) {
  const definition = SUBSTANCES[id];
  const projection = options.projection ?? 'uv';
  const space = options.space ?? (projection === 'triplanar' ? 'world' : 'object');
  const scale = options.scale ?? 1;
  const tile = definition.tile * scale;

  const material = new MeshStandardMaterial({
    color: options.tint ?? '#ffffff',
    roughness: options.roughness ?? definition.roughness,
    metalness: options.metalness ?? definition.metalness ?? 0,
    side: options.side === 'double' ? DoubleSide : FrontSide,
    transparent: options.transparent ?? false,
    alphaTest: options.alphaTest ?? 0,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 1,
  });
  material.name = `substance:${id}`;

  const top = options.top ? SUBSTANCES[options.top] : null;
  const low = options.low ? SUBSTANCES[options.low] : null;
  const uniforms: Uniforms = {
    uSubShade: { value: new Color(definition.shade) },
    uSubBase: { value: new Color(definition.base) },
    uSubLight: { value: new Color(definition.light) },
    uSubScale: { value: 1 / tile },
    uSubNoise: { value: NOISE_FREQUENCY[definition.kind] / scale },
    uSubNormalScale: { value: options.normalStrength ?? 1 },
    uSubAo: { value: 1 },
    uTriMap: { value: null },
    uTriNormal: { value: null },
    uTriOrm: { value: null },
    uTopShade: { value: new Color(top?.shade ?? '#000000') },
    uTopBase: { value: new Color(top?.base ?? '#000000') },
    uTopLight: { value: new Color(top?.light ?? '#000000') },
    uTopParams: {
      value: new Vector4(
        options.topThreshold ?? 0.62,
        options.topSoftness ?? 0.14,
        options.topAmount ?? 1,
        top ? 1 / top.tile : 1,
      ),
    },
    uTopMap: { value: null },
    uLowShade: { value: new Color(low?.shade ?? '#000000') },
    uLowBase: { value: new Color(low?.base ?? '#000000') },
    uLowLight: { value: new Color(low?.light ?? '#000000') },
    uLowParams: {
      value: new Vector4(
        options.lowBelow ?? 0.8,
        options.lowSoftness ?? 0.18,
        options.lowAmount ?? 1,
        low ? 1 / low.tile : 1,
      ),
    },
    uLowMap: { value: null },
    uRecolor: {
      value: (() => {
        const color = new Color(options.recolor ?? '#ffffff');
        return new Vector4(color.r, color.g, color.b, options.recolorAmount ?? 0.8);
      })(),
    },
    uBand: {
      value: (() => {
        const color = new Color(options.band?.color ?? '#000000');
        return new Vector4(color.r, color.g, color.b, options.band?.below ?? 0);
      })(),
    },
    uBandSoft: { value: options.band?.softness ?? 0.02 },
    uStripe: {
      value: (() => {
        const color = new Color(options.stripe?.color ?? '#000000');
        return new Vector4(color.r, color.g, color.b, options.stripe?.at ?? 0);
      })(),
    },
    uStripeWidth: { value: options.stripe?.width ?? 0 },
    /** Inverse de la matrice monde de la racine du modèle (bandes peintes, voir bindSubstanceRoot). */
    uSubRoot: { value: new Matrix4() },
  };

  const defines: Record<string, string> = {};
  if (space === 'world') defines.SUB_WORLD = '';
  if (definition.kind === 'wood') defines.SUB_KIND_WOOD = '';
  if (definition.kind === 'rock') defines.SUB_KIND_ROCK = '';
  if (options.top) defines.SUB_TOP = '';
  if (options.low) defines.SUB_LOW = '';
  if (options.recolor) defines.SUB_RECOLOR = '';
  if (options.band) defines.SUB_BAND = '';
  if (options.stripe) defines.SUB_STRIPE = '';
  material.defines = defines;

  material.userData.substance = { id, options, uniforms };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patch(shader);
  };
  material.customProgramCacheKey = () => 'substance-v1';

  track(attachTextures(material, id, options, projection, tile, uniforms));
  if (options.top) track(attachBlendTexture(material, options.top, uniforms.uTopMap, 'TOP_MAP'));
  if (options.low) track(attachBlendTexture(material, options.low, uniforms.uLowMap, 'LOW_MAP'));
  return material;
}

/**
 * Les bandes peintes (ligne de flottaison) sont définies dans le repère du modèle. Le
 * composant qui anime le modèle appelle cette fonction à chaque image avec sa racine.
 */
export function bindSubstanceRoot(material: MeshStandardMaterial, root: { matrixWorld: Matrix4 }) {
  const uniforms = material.userData.substance?.uniforms as Uniforms | undefined;
  const target = uniforms?.uSubRoot.value as Matrix4 | undefined;
  target?.copy(root.matrixWorld).invert();
}

function enable(material: MeshStandardMaterial, define: string) {
  material.defines = { ...(material.defines ?? {}), [define]: '' };
}

async function attachTextures(
  material: MeshStandardMaterial,
  id: SubstanceId,
  options: SubstanceOptions,
  projection: 'uv' | 'triplanar',
  tile: number,
  uniforms: Uniforms,
) {
  const [basecolor, normal, orm] = await Promise.all([
    loadMap(id, 'basecolor'),
    loadMap(id, 'normal'),
    loadMap(id, 'orm'),
  ]);
  if (!basecolor && !normal && !orm) return;

  if (projection === 'triplanar') {
    if (basecolor) {
      uniforms.uTriMap.value = basecolor;
      enable(material, 'TRI_MAP');
    }
    if (normal) {
      uniforms.uTriNormal.value = normal;
      enable(material, 'TRI_NORMAL');
    }
    if (orm) {
      uniforms.uTriOrm.value = orm;
      enable(material, 'TRI_ORM');
    }
  } else {
    // Répétitions par unité UV : le motif mesure `tile` mètres, le modèle porte
    // `uvDensity` unités UV par mètre.
    const repeat = options.uvDensity ? 1 / (options.uvDensity * tile) : 1;
    if (basecolor) material.map = repeated(basecolor, repeat);
    if (normal) {
      material.normalMap = repeated(normal, repeat);
      const strength = options.normalStrength ?? 1;
      material.normalScale.set(strength, strength);
    }
    if (orm) {
      const packed = repeated(orm, repeat);
      material.roughnessMap = packed;
      material.metalnessMap = packed;
      material.aoMap = packed;
    }
  }
  // Les cartes portent déjà le détail : le bruit du repli n'est plus utile, la teinte de
  // base revient au blanc (sauf teinte demandée explicitement).
  if (!options.tint) material.color.set('#ffffff');
  material.needsUpdate = true;
}

async function attachBlendTexture(
  material: MeshStandardMaterial,
  id: SubstanceId,
  uniform: { value: unknown },
  define: string,
) {
  const basecolor = await loadMap(id, 'basecolor');
  if (!basecolor) return;
  uniform.value = basecolor;
  enable(material, define);
  material.needsUpdate = true;
}
