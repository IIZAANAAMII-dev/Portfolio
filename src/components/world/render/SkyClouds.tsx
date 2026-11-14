'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  PlaneGeometry,
  type InstancedMesh,
} from 'three';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { skyUniforms } from './sky-shader';

/**
 * Grands cumulus « dessin animé » qui dérivent au-dessus de l'archipel : silhouette
 * festonnée (union de bouffées rondes), base plate, faces éclairées par le soleil (ou la
 * lune), dessous violacés, liseré lumineux à contre-jour, bords peints adoucis.
 *
 * Un seul appel de dessin : des quads instanciés, orientés vers la caméra (axe vertical
 * fixe) et déplacés par le vent dans le shader. Ils flottent au-dessus de la caméra de
 * navigation (invisibles en vue plongeante, donc jamais devant une île) et se révèlent
 * dans les plans bas : intro, cinématiques, couchers de soleil.
 */
const CLOUDS = [
  { x: -150, z: -120, y: 84, width: 92, seed: 1.3, speed: 0.55 },
  { x: 40, z: -205, y: 98, width: 118, seed: 2.9, speed: 0.4 },
  { x: 175, z: -60, y: 76, width: 80, seed: 4.1, speed: 0.6 },
  { x: -230, z: 70, y: 92, width: 104, seed: 5.7, speed: 0.45 },
  { x: -80, z: 190, y: 104, width: 126, seed: 7.2, speed: 0.36 },
  { x: 130, z: 175, y: 86, width: 88, seed: 8.8, speed: 0.5 },
  { x: 235, z: 40, y: 110, width: 112, seed: 10.4, speed: 0.42 },
  { x: -215, z: -20, y: 70, width: 72, seed: 12.6, speed: 0.62 },
];
const SPAN = 560;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uWind;
attribute vec4 aCloud;   // graine, largeur, vitesse, -
varying vec2 vUv;
varying float vSeed;
varying vec3 vRight;
varying vec3 vToCamera;
varying float vDistance;
varying float vFade;

void main() {
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float span = ${SPAN.toFixed(1)};
  center.x = mod(center.x + uTime * aCloud.z * uWind + span * 0.5, span) - span * 0.5;
  vFade = 1.0 - smoothstep(span * 0.38, span * 0.5, abs(center.x));
  vec3 toCamera = cameraPosition - center;
  toCamera.y = 0.0;
  toCamera = normalize(toCamera + vec3(1e-4, 0.0, 0.0));
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCamera));
  float width = aCloud.y;
  vec3 world = center + right * position.x * width + vec3(0.0, position.y * width * 0.62, 0.0);
  vUv = vec2(position.x, position.y * 0.62);
  vSeed = aCloud.x;
  vRight = right;
  vToCamera = toCamera;
  vDistance = length(cameraPosition - center);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uCloudRim;
uniform vec3 uHorizon;
uniform float uCloudAmount;
varying vec2 vUv;
varying float vSeed;
varying vec3 vRight;
varying vec3 vToCamera;
varying float vDistance;
varying float vFade;

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

void main() {
  // Coordonnées du nuage : x ∈ [-0.5, 0.5], y ∈ [-0.11, 0.51], base plate à y = -0.07.
  vec2 p = vUv;
  float base = -0.07;
  float best = -1.0;
  vec2 normal2 = vec2(0.0, 1.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h1 = hash11(vSeed * 3.1 + fi * 1.7);
    float h2 = hash11(vSeed * 5.3 + fi * 2.9);
    vec2 c;
    float r;
    if (i < 4) {
      // Rangée de base : bouffées moyennes alignées.
      c = vec2(-0.3 + fi * 0.2 + (h1 - 0.5) * 0.05, 0.0);
      r = 0.12 + h2 * 0.05;
      c.y = base + r * 0.62;
    } else if (i < 6) {
      // Étage : deux grosses bouffées.
      c = vec2(-0.12 + (fi - 4.0) * 0.24 + (h1 - 0.5) * 0.08, base + 0.16 + h2 * 0.04);
      r = 0.15 + h1 * 0.05;
    } else {
      // Couronne.
      c = vec2((h1 - 0.5) * 0.16, base + 0.29 + h2 * 0.05);
      r = 0.11 + h2 * 0.04;
    }
    vec2 d = (p - c) / r;
    float inside = 1.0 - length(d);
    if (inside > best) {
      best = inside;
      normal2 = d;
    }
  }
  float edge = best + (valueNoise(p * 26.0 + vSeed * 7.0) - 0.5) * 0.08;
  float cover = smoothstep(0.0, 0.09, edge) * smoothstep(base - 0.005, base + 0.03, p.y);
  float alpha = cover * uCloudAmount * vFade;
  if (alpha < 0.004) discard;

  float nz = sqrt(max(1.0 - dot(normal2, normal2), 0.0));
  vec3 n = normalize(vRight * normal2.x + vec3(0.0, normal2.y, 0.0) + vToCamera * nz);
  float lambert = dot(n, uLightDir);
  float lit = smoothstep(-0.12, -0.02, lambert) * 0.5 + smoothstep(0.28, 0.38, lambert) * 0.5;
  vec3 color = mix(uCloudShade, uCloudLit, lit);
  float under = 1.0 - smoothstep(-0.35, 0.25, normal2.y);
  color = mix(color, uCloudShade * 0.92, under * 0.45);
  float backlight = smoothstep(0.2, 0.9, dot(-vToCamera, uLightDir));
  float fringe = pow(1.0 - nz, 2.5);
  color += uCloudRim * fringe * (backlight * 1.1 + max(lambert, 0.0) * 0.3);
  // Perspective aérienne : les nuages lointains se fondent dans la brume de l'horizon.
  color = mix(color, uHorizon, smoothstep(140.0, 420.0, vDistance) * 0.45);

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const uniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uLightDir: skyUniforms.uLightDir,
  uCloudLit: skyUniforms.uCloudLit,
  uCloudShade: skyUniforms.uCloudShade,
  uCloudRim: skyUniforms.uCloudRim,
  uHorizon: skyUniforms.uHorizon,
  uCloudAmount: { value: 0 },
};

export function SkyClouds() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1);
    plane.translate(0, 0.32, 0);
    const data = new Float32Array(CLOUDS.length * 4);
    CLOUDS.forEach((cloud, index) => {
      data.set([cloud.seed, cloud.width, cloud.speed, 0], index * 4);
    });
    plane.setAttribute('aCloud', new InstancedBufferAttribute(data, 4));
    return plane;
  }, []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    CLOUDS.forEach((cloud, index) => {
      matrix.makeTranslation(cloud.x, cloud.y, cloud.z);
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const reveal = useWorld.getState().reveal;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uWind.value = 1 + ecologyState.stormWind * 4.5;
    // Les cumulus de beau temps s'effacent sous l'orage (la couverture d'orage est au ciel).
    uniforms.uCloudAmount.value = skyUniforms.uCloudAmount.value * (reveal > 0.22 ? 1 : 0);
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, CLOUDS.length]}
      frustumCulled={false}
      renderOrder={-1}
      raycast={() => null}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={DoubleSide}
        fog={false}
      />
    </instancedMesh>
  );
}
