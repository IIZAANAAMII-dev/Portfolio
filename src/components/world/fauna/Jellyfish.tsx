'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector2,
} from 'three';
import { JELLYFISH_ZONES } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { MeshBuilder, type Vec3 } from './geometry';
import { demoHas, faunaClock } from './shared';

/**
 * MÉDUSES BIOLUMINESCENTES — invisibles le jour, elles s'allument au crépuscule dans
 * quelques criques : cloche qui se contracte, filaments qui suivent avec retard, et à chaque
 * contraction une onde de lumière qui descend de l'apex jusqu'au bout des tentacules. Quand le
 * bateau passe au milieu d'elles, elles s'écartent et flashent. Tout est calculé sur le GPU
 * (deux draw calls : les corps, puis des halos additifs qui donnent la lueur même sans bloom).
 */

/** Parties : 0 cloche, 1 bras oraux, 2 tentacules. `aAlong` : 0 apex → 1 bout des filaments. */
function jellyGeometry() {
  const builder = new MeshBuilder(['aPart', 'aAlong', 'aAngle']);
  const segments = 12;
  const rings = [0, 0.3, 0.58, 0.82, 1.0];
  const shade = (value: number) => new Color(value, value, value);
  const bell = (rho: number, angle: number): Vec3 => [
    Math.cos(angle) * rho * 0.5,
    0.42 * (1 - rho ** 2.4),
    Math.sin(angle) * rho * 0.5,
  ];
  builder.set('aPart', 0);
  for (let ring = 0; ring < rings.length; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a0 = (segment / segments) * Math.PI * 2;
      const a1 = ((segment + 1) / segments) * Math.PI * 2;
      builder.set('aAngle', a0);
      if (ring < rings.length - 1) {
        builder.set('aAlong', rings[ring] * 0.25);
        const r0 = rings[ring];
        const r1 = rings[ring + 1];
        const p00 = bell(r0, a0);
        const p01 = bell(r0, a1);
        const p10 = bell(r1, a0);
        const p11 = bell(r1, a1);
        builder.set('aAlong', ((r0 + r1) / 2) * 0.25);
        builder.tri(p00, p11, p10, shade(1 - ring * 0.06)).tri(p00, p01, p11, shade(1 - ring * 0.06));
      } else {
        // Voile : petite lèvre festonnée qui rentre sous la cloche.
        builder.set('aAlong', 0.26);
        const mid = (a0 + a1) / 2;
        builder.tri(
          bell(1, a0),
          [Math.cos(mid) * 0.44, -0.07, Math.sin(mid) * 0.44],
          bell(1, a1),
          shade(0.92),
        );
      }
    }
  }
  // Bras oraux : quatre rubans qui spiralent sous la cloche.
  builder.set('aPart', 1);
  for (let arm = 0; arm < 4; arm++) {
    const base = (arm / 4) * Math.PI * 2 + Math.PI / 4;
    builder.set('aAngle', base);
    const steps = 6;
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const ribbon = (t: number, edge: number): Vec3 => {
        const twist = base + t * 1.6;
        const radius = 0.07 + Math.sin(t * Math.PI) * 0.05;
        const width = (0.11 - t * 0.07) * edge;
        return [
          Math.cos(twist) * radius - Math.sin(twist) * width,
          0.02 - t * 0.95,
          Math.sin(twist) * radius + Math.cos(twist) * width,
        ];
      };
      builder.set('aAlong', 0.25 + t0 * 0.5);
      builder.tri(ribbon(t0, -1), ribbon(t0, 1), ribbon(t1, 1), shade(0.85));
      builder.tri(ribbon(t0, -1), ribbon(t1, 1), ribbon(t1, -1), shade(0.85));
    }
  }
  // Tentacules : huit filaments fins depuis le bord de la cloche.
  builder.set('aPart', 2);
  for (let strand = 0; strand < 8; strand++) {
    const angle = (strand / 8) * Math.PI * 2;
    builder.set('aAngle', angle);
    const steps = 7;
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const point = (t: number, edge: number): Vec3 => {
        const radius = 0.47 - t * 0.12;
        const width = 0.016 * (1 - t * 0.6) * edge;
        return [
          Math.cos(angle) * radius - Math.sin(angle) * width,
          -0.03 - t * 1.45,
          Math.sin(angle) * radius + Math.cos(angle) * width,
        ];
      };
      builder.set('aAlong', 0.26 + t0 * 0.74);
      builder.tri(point(t0, -1), point(t0, 1), point(t1, 1), shade(0.72));
      builder.tri(point(t0, -1), point(t1, 1), point(t1, -1), shade(0.72));
    }
  }
  return builder.build();
}

/** Position, contraction et teinte : communes au corps et au halo (mêmes formules). */
const JELLY_COMMON = /* glsl */ `
attribute vec4 aJelly;
attribute vec4 aJelly2;
uniform float uTime;
uniform vec2 uBoat;
uniform float uNight;
varying vec3 vJellyTint;
varying float vJellyGlow;

float jellyPulse() {
  return fract(uTime * aJelly2.z + aJelly.w);
}
float jellySqueeze(float p) {
  return smoothstep(0.0, 0.16, p) * (1.0 - smoothstep(0.22, 0.8, p));
}
vec3 jellyCenter(float p, out float near) {
  vec2 drift = vec2(sin(uTime * 0.05 + aJelly.w * 6.283), cos(uTime * 0.043 + aJelly.w * 4.0)) * aJelly2.w;
  vec2 pos = aJelly.xy + drift;
  vec2 away = pos - uBoat;
  near = 1.0 - smoothstep(2.5, 9.0, length(away));
  pos += normalize(away + 1e-4) * near * 1.3;
  // Propulsion : elle monte pendant la contraction puis redescend lentement (bilan nul).
  float rise = 0.32 * (smoothstep(0.03, 0.42, p) - p);
  return vec3(pos.x, aJelly.z + rise + sin(uTime * 0.2 + aJelly.w * 12.0) * 0.18, pos.y);
}
vec3 jellyTint(float hue) {
  vec3 cyan = vec3(0.25, 0.95, 1.0);
  vec3 azure = vec3(0.32, 0.55, 1.0);
  vec3 orchid = vec3(0.95, 0.42, 1.0);
  return hue < 0.5 ? mix(cyan, azure, hue * 2.0) : mix(azure, orchid, (hue - 0.5) * 2.0);
}
`;

const bodyUniforms = {
  uTime: { value: 0 },
  uBoat: { value: new Vector2() },
  uNight: { value: 0 },
};

function bodyMaterial() {
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, bodyUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart;
attribute float aAlong;
attribute float aAngle;
${JELLY_COMMON}`)
      .replace('#include <begin_vertex>', `
float jellyP = jellyPulse();
float jellyS = jellySqueeze(jellyP);
vec3 jellyQ = position;
if (aPart < 0.5) {
  float jellyRim = smoothstep(0.02, 0.25, aAlong);
  jellyQ.xz *= 1.0 - jellyS * 0.24 * jellyRim;
  jellyQ.y *= 1.0 + jellyS * 0.12;
} else {
  float jellyT = (aAlong - 0.25) / 0.75;
  jellyQ.x += sin(uTime * 0.9 + aAngle * 2.0 + jellyT * 3.2 + aJelly.w * 6.283) * jellyT * 0.15;
  jellyQ.z += cos(uTime * 0.7 + aAngle * 1.7 + jellyT * 2.6 + aJelly.w * 6.283) * jellyT * 0.13;
  jellyQ.y += jellyS * jellyT * 0.2;
  jellyQ.xz *= 1.0 - jellyS * 0.16 * (1.0 - jellyT);
}
float jellyNear;
vec3 jellyAt = jellyCenter(jellyP, jellyNear);
float jellyTilt = sin(uTime * 0.3 + aJelly.w * 9.0) * 0.14;
jellyQ.xy = vec2(jellyQ.x * cos(jellyTilt) - jellyQ.y * sin(jellyTilt), jellyQ.x * sin(jellyTilt) + jellyQ.y * cos(jellyTilt));
vec3 transformed = jellyQ * aJelly2.x + jellyAt;
// Onde de lumière : de l'apex jusqu'au bout des filaments à chaque contraction.
float jellyWave = exp(-pow((aAlong - jellyP * 1.35) * 5.0, 2.0));
float jellyRimGlow = aPart < 0.5 ? smoothstep(0.17, 0.25, aAlong) : 0.0;
vJellyGlow = (0.32 + jellyS * 0.55 + jellyWave * 1.5 + jellyRimGlow * 0.75 + jellyNear * 1.3)
  * (1.0 - aAlong * 0.42) * uNight;
vJellyTint = jellyTint(aJelly2.y);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vJellyTint;
varying float vJellyGlow;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = vJellyTint * vJellyGlow * diffuseColor.rgb;`);
  };
  material.customProgramCacheKey = () => 'fauna-jelly-v1';
  return material;
}

function haloMaterial() {
  const material = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, bodyUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${JELLY_COMMON}
varying vec2 vHalo;`)
      .replace('#include <begin_vertex>', `
float jellyP = jellyPulse();
float jellyS = jellySqueeze(jellyP);
float jellyNear;
vec3 jellyAt = jellyCenter(jellyP, jellyNear) + vec3(0.0, 0.05 * aJelly2.x, 0.0);
// Panneau toujours face à la caméra.
vec3 haloRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
vec3 haloUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
float haloSize = aJelly2.x * (2.3 + jellyS * 0.5 + jellyNear * 0.8);
vec3 transformed = jellyAt + (haloRight * position.x + haloUp * position.y) * haloSize;
vHalo = position.xy * 2.0;
vJellyGlow = (0.5 + jellyS * 0.6 + jellyNear * 1.2) * uNight;
vJellyTint = jellyTint(aJelly2.y);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vJellyTint;
varying float vJellyGlow;
varying vec2 vHalo;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float haloFall = pow(max(0.0, 1.0 - length(vHalo)), 2.6);
diffuseColor.rgb = vJellyTint * haloFall * vJellyGlow * 0.42;`);
  };
  material.customProgramCacheKey = () => 'fauna-jelly-halo-v1';
  return material;
}

const JELLY_GEOMETRY = jellyGeometry();
const JELLY_MATERIAL = bodyMaterial();
const HALO_MATERIAL = haloMaterial();

export function Jellyfish({ mobile }: { mobile: boolean }) {
  const bodies = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const zones = useMemo(
    () => (mobile || quality === 'low' ? JELLYFISH_ZONES.slice(0, 2) : JELLYFISH_ZONES),
    [mobile, quality],
  );
  const { body, halo, count } = useMemo(() => {
    const jelly: number[] = [];
    const jelly2: number[] = [];
    zones.forEach((zone) => {
      const amount = Math.round((zone.count ?? 6) * (mobile ? 0.75 : 1));
      for (let index = 0; index < amount; index++) {
        const seed = zone.seed * 31.7 + index * 7.3;
        const angle = hash(seed) * Math.PI * 2;
        const radius = zone.radius * Math.sqrt(hash(seed + 1.3));
        const size = 0.5 + hash(seed + 2.9) * 0.35;
        jelly.push(
          zone.center[0] + Math.cos(angle) * radius,
          zone.center[1] + Math.sin(angle) * radius,
          -0.42 - hash(seed + 4.1) * 0.5,
          hash(seed + 5.7),
        );
        // Taille, teinte (surtout cyan/azur, quelques orchidées), cadence de pulsation, dérive.
        const hue = hash(seed + 6.6);
        jelly2.push(size, hue < 0.8 ? hue * 0.6 : 0.75 + hue * 0.25, 0.45 + hash(seed + 8.2) * 0.35, 0.8 + hash(seed + 9.4) * 1.2);
      }
    });
    const make = (source: typeof JELLY_GEOMETRY | PlaneGeometry) => {
      const geometry = source.clone();
      geometry.setAttribute('aJelly', new InstancedBufferAttribute(new Float32Array(jelly), 4));
      geometry.setAttribute('aJelly2', new InstancedBufferAttribute(new Float32Array(jelly2), 4));
      return geometry;
    };
    return { body: make(JELLY_GEOMETRY), halo: make(new PlaneGeometry(1, 1)), count: jelly.length / 4 };
  }, [mobile, zones]);

  useFrame((state) => {
    const { reveal } = useWorld.getState();
    const night = demoHas('jelly') ? 1 : ecologyState.jellyfish * ecologyState.worldLife;
    bodyUniforms.uTime.value = faunaClock(state.clock.elapsedTime);
    bodyUniforms.uBoat.value.set(boatState.position.x, boatState.position.z);
    bodyUniforms.uNight.value = night * (reveal > 0.75 ? 1 : 0);
    const visible = bodyUniforms.uNight.value > 0.02;
    if (bodies.current) bodies.current.visible = visible;
    if (halos.current) halos.current.visible = visible;
  });

  return (
    <>
      <instancedMesh
        ref={bodies}
        args={[body, JELLY_MATERIAL, count]}
        frustumCulled={false}
        renderOrder={8}
        raycast={() => null}
        visible={false}
      />
      <instancedMesh
        ref={halos}
        args={[halo, HALO_MATERIAL, count]}
        frustumCulled={false}
        renderOrder={9}
        raycast={() => null}
        visible={false}
      />
    </>
  );
}
