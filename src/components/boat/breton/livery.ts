import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
  type Texture,
} from 'three';
import { flagById, liveryById, type FlagId, type LiveryColors, type LiveryId } from '@/lib/livery';
import { PaintShop } from './build';
import { BOAT_COLORS as C } from './parts';
import { flagTexture, hullTexture } from './textures';

/**
 * Livrées du bateau (atelier de peinture du port de départ), côté rendu.
 *
 * La coque lit sa peinture dans une texture : une seconde texture (la nouvelle livrée) est
 * révélée par un front de pinceau qui court de l'étrave à la poupe (bord en dents de poils,
 * peinture fraîche un peu plus brillante juste derrière). Le reste du bateau est peint par
 * sommet : quelques couleurs « clés » d'origine (rouge de coque, liserés, boiseries marine,
 * carène) y sont remplacées dans le shader par celles de la livrée, avec le même front.
 * Aucun maillage reconstruit, aucun programme de plus.
 */

/** Couleurs d'origine cuites dans les sommets → champ de la livrée qui les remplace. */
const KEYS: { color: string; field: keyof LiveryColors }[] = [
  { color: C.hull, field: 'hull' },
  { color: C.hullSeam, field: 'seam' },
  { color: C.pinstripe, field: 'pinstripe' },
  { color: C.navy, field: 'trim' },
  { color: C.antifouling, field: 'antifouling' },
];

export const liveryUniforms = {
  /** Inverse de la matrice monde du bateau : chaque pièce connaît sa place le long de la coque. */
  uBoatInverse: { value: new Matrix4() },
  /** Abscisse (repère du bateau) du front de pinceau ; la peinture neuve est du côté de l'étrave. */
  uWipe: { value: 10 },
  uWipeOn: { value: 0 },
  uNextMap: { value: null as Texture | null },
  uKeys: { value: KEYS.map((key) => new Color(key.color)) },
  uFrom: { value: KEYS.map((key) => new Color(key.color)) },
  uTo: { value: KEYS.map((key) => new Color(key.color)) },
};

export function setPalette(target: Color[], colors: LiveryColors) {
  KEYS.forEach((key, index) => target[index].set(colors[key.field]));
}

const VERTEX_PARS = /* glsl */ `
uniform mat4 uBoatInverse;
varying vec3 vBoatPos;
`;
const VERTEX_POSITION = /* glsl */ `#include <begin_vertex>
vBoatPos = ( uBoatInverse * modelMatrix * vec4( transformed, 1.0 ) ).xyz;`;

const FRAGMENT_PARS = /* glsl */ `
uniform float uWipe;
uniform float uWipeOn;
varying vec3 vBoatPos;
// Front du coup de pinceau : penché (le haut d'abord) et dentelé comme des poils.
float liveryPainted() {
  float bristles = sin( vBoatPos.y * 37.0 + vBoatPos.z * 5.0 ) * 0.5 + sin( vBoatPos.y * 91.0 + 1.7 ) * 0.25;
  float edge = uWipe + bristles * 0.07 - vBoatPos.y * 0.3;
  return smoothstep( edge - 0.015, edge + 0.015, vBoatPos.x ) * uWipeOn;
}
// Peinture fraîche : un peu plus brillante juste derrière le pinceau.
float liveryWet( float painted ) {
  return painted * ( 1.0 - smoothstep( 0.0, 0.55, vBoatPos.x - uWipe + vBoatPos.y * 0.3 ) );
}
`;

const HULL_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( uWipeOn > 0.5 ) {
    float painted = liveryPainted();
    vec4 nextColor = texture2D( uNextMap, vMapUv );
    sampledDiffuseColor = mix( sampledDiffuseColor, nextColor * ( 1.0 + 0.24 * liveryWet( painted ) ), painted );
  }
  diffuseColor *= sampledDiffuseColor;
#endif
`;

const PALETTE_COLOR = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
  vec3 liveryColor = vColor.rgb;
  float liveryNew = liveryPainted();
  for ( int i = 0; i < ${KEYS.length}; i ++ ) {
    if ( distance( vColor.rgb, uKeys[ i ] ) < 0.0012 ) {
      liveryColor = mix( uFrom[ i ], uTo[ i ], liveryNew ) * ( 1.0 + 0.2 * liveryWet( liveryNew ) );
    }
  }
  diffuseColor.rgb *= liveryColor;
  diffuseColor.a *= vColor.a;
#endif
`;

/** Coque : peinture lue dans la texture, révélée par le front de pinceau. */
export function patchHull(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBoatInverse = liveryUniforms.uBoatInverse;
    shader.uniforms.uWipe = liveryUniforms.uWipe;
    shader.uniforms.uWipeOn = liveryUniforms.uWipeOn;
    shader.uniforms.uNextMap = liveryUniforms.uNextMap;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', VERTEX_POSITION);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}\nuniform sampler2D uNextMap;`)
      .replace('#include <map_fragment>', HULL_MAP);
  };
  material.customProgramCacheKey = () => 'boat-hull-livery-v1';
}

/** Pièces peintes par sommet : les couleurs clés suivent la livrée. */
export function patchPalette(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBoatInverse = liveryUniforms.uBoatInverse;
    shader.uniforms.uWipe = liveryUniforms.uWipe;
    shader.uniforms.uWipeOn = liveryUniforms.uWipeOn;
    shader.uniforms.uKeys = liveryUniforms.uKeys;
    shader.uniforms.uFrom = liveryUniforms.uFrom;
    shader.uniforms.uTo = liveryUniforms.uTo;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', VERTEX_POSITION);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${FRAGMENT_PARS}\nuniform vec3 uKeys[ ${KEYS.length} ];\nuniform vec3 uFrom[ ${KEYS.length} ];\nuniform vec3 uTo[ ${KEYS.length} ];`,
      )
      .replace('#include <color_fragment>', PALETTE_COLOR);
  };
  material.customProgramCacheKey = () => 'boat-paint-livery-v1';
}

/* ------------------------------------------------------------------ textures (cache) */

const hullMaps = new Map<LiveryId, Texture>();
const flagMaps = new Map<FlagId, Texture>();

export function hullMap(id: LiveryId) {
  let map = hullMaps.get(id);
  if (!map) {
    map = hullTexture(liveryById(id).colors);
    hullMaps.set(id, map);
  }
  return map;
}

export function flagMap(id: FlagId) {
  let map = flagMaps.get(flagById(id).id);
  if (!map) {
    map = flagTexture(flagById(id).id);
    flagMaps.set(flagById(id).id, map);
  }
  return map;
}

/* ------------------------------------------------------------------ pinceau */

/**
 * Le grand pinceau de l'atelier (manche, virole) ; les soies sont un maillage à part, teint
 * de la nouvelle couleur. Origine au bout des soies, manche le long de +Y.
 */
export function brushGeometries() {
  const body = new PaintShop()
    .add(new CylinderGeometry(0.032, 0.04, 0.78, 8), '#9a6a3e', { at: [0, 0.6, 0] })
    .add(new SphereGeometry(0.045, 8, 6), '#9a6a3e', { at: [0, 0.99, 0] })
    .add(new CylinderGeometry(0.075, 0.06, 0.12, 10), '#b9c2c8', { at: [0, 0.17, 0], scale: [1.5, 1, 0.55] })
    .add(new CylinderGeometry(0.08, 0.08, 0.025, 10), '#c33e2c', { at: [0, 0.255, 0], scale: [1.4, 1, 0.5] })
    .build();
  const bristles = new BoxGeometry(0.2, 0.13, 0.06).translate(0, 0.06, 0);
  return { body, bristles };
}

export const BRISTLES = new MeshStandardMaterial({ color: '#c33e2c', roughness: 0.55, metalness: 0 });
BRISTLES.name = 'boat-brush-bristles';
