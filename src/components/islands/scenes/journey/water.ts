import { BufferAttribute, BufferGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import type { HeightSampler } from '../../terrain-shape';
import { calanqueDistance, channelCenter, channelHalfWidth, portDistance, smooth, toFrame } from './terrain';

/**
 * Eau calme du chenal, du Vieux-Port et de la calanque. L'océan commun dessine des
 * anneaux d'écume concentriques autour de chaque île : dans un chenal qui traverse
 * l'île, ils se rejoindraient en étoile. Cette nappe (dessinée après l'océan, qui
 * n'écrit pas la profondeur) la recouvre : turquoise clair sur les hauts-fonds, risées
 * qui glissent, liseré d'écume au pied des berges, et elle se fond dans le large aux
 * embouchures.
 */

const RINGS = 72;
const SECTORS = 112;
export const WATER_LEVEL = 0.06;

export function buildCalmWater(sampler: HeightSampler, radius: number) {
  const outer = radius * 1.32;
  const count = 1 + RINGS * SECTORS;
  const positions = new Float32Array(count * 3);
  const depth = new Float32Array(count);
  const fade = new Float32Array(count);
  const inside = new Uint8Array(count);
  const place = (index: number, x: number, z: number) => {
    const ground = sampler(x, z);
    positions[index * 3] = x;
    positions[index * 3 + 1] = WATER_LEVEL;
    positions[index * 3 + 2] = z;
    depth[index] = WATER_LEVEL - ground;
    const [u, v] = toFrame(x, z);
    const dv = v - channelCenter(u);
    const inChannel = Math.abs(dv) < channelHalfWidth(u) + 1.2;
    const inPort = dv > 0 && portDistance(u, v) < 0.8;
    const inCalanque = calanqueDistance(u, v) < 0.9;
    inside[index] = inChannel || inPort || inCalanque ? 1 : 0;
    // Fondu vers le large aux embouchures (au-delà, l'océan reprend la main).
    const r = Math.hypot(x, z);
    fade[index] = 1 - smooth(radius * 0.93, radius * 1.16, r);
  };
  place(0, 0, 0);
  for (let ring = 1; ring <= RINGS; ring++) {
    const t = ring / RINGS;
    const r = outer * (t * 0.55 + t * t * 0.45);
    for (let sector = 0; sector < SECTORS; sector++) {
      const angle = (sector / SECTORS) * Math.PI * 2;
      place(1 + (ring - 1) * SECTORS + sector, Math.cos(angle) * r, Math.sin(angle) * r);
    }
  }
  const indices: number[] = [];
  const keep = (a: number, b: number, c: number) => {
    if (!inside[a] && !inside[b] && !inside[c]) return;
    if (Math.max(depth[a], depth[b], depth[c]) < 0) return;
    if (Math.max(fade[a], fade[b], fade[c]) <= 0) return;
    indices.push(a, b, c);
  };
  for (let sector = 0; sector < SECTORS; sector++) keep(0, 1 + ((sector + 1) % SECTORS), 1 + sector);
  for (let ring = 1; ring < RINGS; ring++) {
    const inner = 1 + (ring - 1) * SECTORS;
    const outerRing = 1 + ring * SECTORS;
    for (let sector = 0; sector < SECTORS; sector++) {
      const next = (sector + 1) % SECTORS;
      keep(inner + sector, inner + next, outerRing + sector);
      keep(inner + next, outerRing + next, outerRing + sector);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aDepth', new BufferAttribute(depth, 1));
  geometry.setAttribute('aFade', new BufferAttribute(fade, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

const vertexShader = /* glsl */ `
attribute float aDepth;
attribute float aFade;
varying float vDepth;
varying float vFade;
varying vec3 vWorld;
#include <common>
#include <fog_pars_vertex>
void main() {
  vDepth = aDepth;
  vFade = aFade;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uGolden;
varying float vDepth;
varying float vFade;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
void main() {
  float shallow = 1.0 - smoothstep(0.08, 1.05, vDepth);
  vec3 deep = vec3(0.09, 0.56, 0.66);
  vec3 lagoon = vec3(0.42, 0.86, 0.80);
  vec3 color = mix(deep, lagoon, shallow);
  // Risées : de fines bandes claires qui glissent et se croisent.
  vec2 p = vWorld.xz;
  float a = sin(p.x * 1.6 + p.y * 0.7 + uTime * 0.9 + sin(p.y * 0.8 + uTime * 0.3) * 1.4);
  float b = sin(p.x * -0.6 + p.y * 1.9 - uTime * 0.7 + sin(p.x * 0.9) * 1.2);
  float ripple = smoothstep(0.82, 0.96, a * 0.55 + b * 0.45);
  color = mix(color, vec3(0.86, 0.99, 0.96), ripple * 0.32);
  // Liseré d'écume au pied des berges, qui respire.
  float edge = 0.12 + 0.07 * sin(uTime * 1.4 + p.x * 1.7 + p.y * 1.3);
  float foam = 1.0 - smoothstep(edge * 0.4, edge, vDepth);
  color = mix(color, vec3(0.97, 0.99, 0.95), foam * 0.85);
  // Heure dorée et nuit.
  color = mix(color, color * vec3(1.18, 0.92, 0.72) + vec3(0.06, 0.03, 0.0), uGolden * 0.45);
  color *= mix(vec3(1.0), vec3(0.16, 0.22, 0.32), uNight);
  float alpha = mix(0.88, 0.62, shallow);
  alpha = max(alpha, foam * 0.9) * vFade;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createCalmWaterMaterial() {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 }, uGolden: { value: 0 } }]),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}
