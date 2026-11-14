'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CircleGeometry,
  Color,
  InstancedBufferAttribute,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
} from 'three';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { CENTER_X, CENTER_Z, RIFT_WORLD } from './layout';
import { flicker } from './signal';
import { noiseTexture } from './textures';

/**
 * La brume de l'île : une couronne épaisse qui colle à la côte et s'efface au large.
 *  - trois nappes horizontales superposées (bruit qui dérive, parallaxe entre elles) ;
 *  - des bouffées verticales qui tournent lentement autour de l'île.
 * Le bateau écarte la brume autour de lui ; la faille la teinte de jaune la nuit.
 * Rien de tout cela n'intercepte les clics.
 */

const SHEET_VERTEX = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const SHEET_FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec2 uCenter;
uniform vec2 uRift;
uniform vec2 uBoat;
uniform float uDensity;
uniform float uInner;
uniform float uLayer;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 p = vWorld.xz;
  float r = distance(p, uCenter);
  // Couronne : vide sur l'île, dense le long de la côte, s'efface vers 46 m.
  float ring = smoothstep(uInner, uInner + 3.5, r) * (1.0 - smoothstep(13.0, 46.0, r));
  vec2 drift = vec2(uTime * 0.011, uTime * 0.006);
  vec2 q = p * 0.034 + drift + uLayer * 0.37;
  float n = texture2D(uNoise, q).r * 0.62 + texture2D(uNoise, q * 2.3 - drift * 1.7 + 0.5).r * 0.38;
  float density = smoothstep(0.32, 0.78, n) * ring * uDensity;
  // Le bateau écarte la brume.
  density *= smoothstep(2.2, 7.5, distance(p, uBoat));
  vec3 color = uColor + uGlow * exp(-distance(p, uRift) * 0.16);
  gl_FragColor = vec4(color, density);
  #include <fog_fragment>
}
`;

const PUFF_VERTEX = /* glsl */ `
attribute vec4 aPuff;
attribute vec2 aDrift;
uniform float uTime;
uniform vec2 uCenter;
varying vec2 vUv;
varying float vFade;
varying vec2 vWorldXZ;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  float angle = aPuff.x + uTime * aDrift.x;
  vec3 center = vec3(uCenter.x + cos(angle) * aPuff.y, aPuff.z + sin(uTime * 0.21 + aDrift.y) * 0.35, uCenter.y + sin(angle) * aPuff.y);
  vec3 toCamera = cameraPosition - center;
  vec3 right = normalize(vec3(toCamera.z, 0.0, -toCamera.x));
  float size = aPuff.w * (0.9 + 0.1 * sin(uTime * 0.3 + aDrift.y * 2.0));
  vec3 world = center + right * position.x * size + vec3(0.0, 1.0, 0.0) * position.y * size * 0.55;
  vFade = smoothstep(5.0, 16.0, length(toCamera));
  vWorldXZ = world.xz;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const PUFF_FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec2 uRift;
uniform vec2 uBoat;
uniform float uDensity;
varying vec2 vUv;
varying float vFade;
varying vec2 vWorldXZ;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float blob = 1.0 - smoothstep(0.25, 1.0, length(c));
  float n = texture2D(uNoise, vUv * 0.7 + vec2(uTime * 0.01, 0.0)).r;
  float bottom = smoothstep(0.0, 0.35, vUv.y);
  float density = blob * smoothstep(0.25, 0.7, n * 0.6 + blob * 0.5) * bottom * vFade * uDensity * 0.55;
  density *= smoothstep(2.0, 7.0, distance(vWorldXZ, uBoat));
  vec3 color = uColor + uGlow * exp(-distance(vWorldXZ, uRift) * 0.14);
  gl_FragColor = vec4(color, density);
  #include <fog_fragment>
}
`;

const mistUniforms = {
  uNoise: { value: null as unknown },
  uTime: { value: 0 },
  uColor: { value: new Color('#c8cbb2') },
  uGlow: { value: new Color('#000000') },
  uCenter: { value: new Vector2(CENTER_X, CENTER_Z) },
  uRift: { value: new Vector2(RIFT_WORLD[0], RIFT_WORLD[1]) },
  uBoat: { value: new Vector2(0, 0) },
  uDensity: { value: 1 },
};

/** Les trois nappes : hauteur (au-dessus de la mer), rayon intérieur vide, densité. */
const SHEETS = [
  { y: 0.62, inner: 8.6, density: 0.62 },
  { y: 1.55, inner: 7.3, density: 0.5 },
  { y: 2.75, inner: 6.5, density: 0.38 },
];

let kit: { sheets: ShaderMaterial[]; puffs: ShaderMaterial } | null = null;

function mistKit() {
  if (kit) return kit;
  mistUniforms.uNoise.value = noiseTexture();
  const sheets = SHEETS.map((sheet, index) => new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uInner: { value: sheet.inner }, uLayer: { value: index } }]),
    vertexShader: SHEET_VERTEX,
    fragmentShader: SHEET_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: true,
  }));
  // Les uniformes animés sont partagés (mêmes objets) entre toutes les nappes.
  sheets.forEach((material, index) => {
    Object.assign(material.uniforms, mistUniforms, { uDensity: { value: SHEETS[index].density } });
  });
  const puffs = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog]),
    vertexShader: PUFF_VERTEX,
    fragmentShader: PUFF_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  Object.assign(puffs.uniforms, mistUniforms);
  kit = { sheets, puffs };
  return kit;
}

const DAY = new Color('#c9ccb3');
const GOLDEN = new Color('#d9bc98');
const NIGHT = new Color('#253238');
const GLOW_NIGHT = new Color('#6f5d18');

function puffGeometry(count: number) {
  const geometry = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const puffs = new Float32Array(count * 4);
  const drift = new Float32Array(count * 2);
  for (let index = 0; index < count; index++) {
    const radius = 9.5 + hash(index * 3.7) * 13;
    puffs.set([hash(index * 1.3) * Math.PI * 2, radius, 0.3 + hash(index * 5.1) * 1.2, 7 + hash(index * 2.2) * 7], index * 4);
    drift.set([(0.012 + hash(index * 4.4) * 0.02) * (hash(index * 6.6) > 0.5 ? 1 : -1), hash(index * 8.8) * 6.28], index * 2);
  }
  geometry.setAttribute('aPuff', new InstancedBufferAttribute(puffs, 4));
  geometry.setAttribute('aDrift', new InstancedBufferAttribute(drift, 2));
  return geometry;
}

export function Mist() {
  const quality = useWorld((state) => state.quality);
  const materials = useMemo(() => mistKit(), []);
  const disc = useMemo(() => new CircleGeometry(46, 72).rotateX(-Math.PI / 2), []);
  const puffCount = quality === 'high' ? 18 : quality === 'medium' ? 10 : 0;
  const puffs = useMemo(() => (puffCount > 0 ? puffGeometry(puffCount) : null), [puffCount]);
  const sheets = quality === 'low' ? SHEETS.slice(0, 2) : SHEETS;

  useFrame((state) => {
    mistUniforms.uTime.value = state.clock.elapsedTime * (flicker.motion ? 1 : 0.2);
    const night = skyState.dayNight;
    mistUniforms.uColor.value.copy(DAY).lerp(GOLDEN, skyState.golden * 0.75).lerp(NIGHT, night);
    mistUniforms.uGlow.value.copy(GLOW_NIGHT).multiplyScalar((0.18 + night * 0.95) * flicker.rift);
    mistUniforms.uBoat.value.set(boatState.position.x, boatState.position.z);
  });

  return (
    <group>
      {sheets.map((sheet, index) => (
        <mesh
          key={index}
          geometry={disc}
          material={materials.sheets[index]}
          position={[CENTER_X, sheet.y, CENTER_Z]}
          renderOrder={5 + index}
          raycast={() => null}
          frustumCulled={false}
        />
      ))}
      {puffs && (
        <instancedMesh
          args={[puffs, materials.puffs, puffCount]}
          renderOrder={8}
          frustumCulled={false}
          raycast={() => null}
        />
      )}
    </group>
  );
}
