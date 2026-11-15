'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { buildTerrainGeometry, type HeightSampler, type TerrainShape } from '@/components/islands/terrain-shape';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { riseSchedule } from './rise';

/**
 * Nappe d'eau qui ruisselle sur une île qui vient de crever la surface : une pellicule
 * turquoise et des filets d'écume qui dévalent les falaises, une nappe qui glisse sur les
 * replats, et une lisière blanche qui descend du sommet vers la mer à mesure que l'île sèche.
 * Une copie basse définition du relief, décollée de quelques centimètres ; montée seulement
 * pendant la cinématique d'ouverture (aucune géométrie pour un lien direct `?section=`).
 */
const vertexShader = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vLocal;
varying vec3 vNormalLocal;
varying float vWorldY;
void main() {
  vLocal = position;
  vNormalLocal = normal;
  vec4 world = modelMatrix * vec4(position + normal * 0.09, 1.0);
  vWorldY = world.y;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTau;
uniform float uTop;
varying vec3 vLocal;
varying vec3 vNormalLocal;
varying float vWorldY;

float skinHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float skinNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skinHash(i), skinHash(i + vec2(1.0, 0.0)), f.x), mix(skinHash(i + vec2(0.0, 1.0)), skinHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float h = vLocal.y;
  float angle = atan(vLocal.z, vLocal.x);
  float radius = length(vLocal.xz);
  // La nappe se retire du sommet vers la mer.
  float drain = uTop + 0.8 - smoothstep(0.18, 1.75, uTau) * (uTop + 2.2);
  float wet = 1.0 - smoothstep(drain - 0.45, drain + 0.25, h);
  // Filets qui dévalent les pentes, nappe qui glisse vers le rivage sur les replats.
  float steep = smoothstep(0.25, 0.65, 1.0 - clamp(normalize(vNormalLocal).y, 0.0, 1.0));
  float rills = skinNoise(vec2(angle * 26.0, h * 1.3 + uTau * 7.5));
  rills = max(rills, skinNoise(vec2(angle * 61.0 + 4.0, h * 2.2 + uTau * 9.0)) * 0.9);
  float sheet = skinNoise(vec2(radius * 0.8 - uTau * 4.2, angle * 7.0));
  float flow = mix(sheet, rills, steep);
  float foam = smoothstep(0.58, 0.86, flow);
  // Lisière d'écume sur la ligne de retrait.
  float edge = exp(-pow((h - drain) / 0.32, 2.0));
  vec3 color = mix(vec3(0.36, 0.82, 0.8), vec3(0.94, 1.0, 0.98), max(foam, edge * 0.9));
  // Un reflet doux sur les replats tournés vers le ciel.
  color += vec3(0.12, 0.16, 0.16) * smoothstep(0.75, 1.0, normalize(vNormalLocal).y) * (1.0 - foam);
  float alpha = wet * (0.26 + foam * 0.5 * (0.45 + steep * 0.55)) + edge * 0.45 * wet;
  alpha *= 1.0 - smoothstep(1.55, 2.0, uTau);
  // Sous la mer, l'eau de l'île se fond dans l'océan.
  alpha *= smoothstep(-0.25, 0.3, vWorldY);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Fin de la nappe (s après le début de la montée). */
const SKIN_LIFE = 2.0;

function Skin({ id, shape, sampler }: { id: string; shape: TerrainShape; sampler: HeightSampler }) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => buildTerrainGeometry(shape, sampler, { rings: 40, sectors: 72 }), [sampler, shape]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTau: { value: -1 }, uTop: { value: shape.elevation + 1.2 } }]),
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      }),
    [shape.elevation],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    const { phase, gameTransition, introCenter } = useWorld.getState();
    const slot = riseSchedule(introCenter[0], introCenter[1], boatState.heading).byId.get(id);
    const tau = phase === 'transitioning' && slot ? gameTransition * INTRO_DURATION - slot.start : -1;
    target.visible = tau >= 0 && tau < SKIN_LIFE;
    if (target.visible) (target.material as ShaderMaterial).uniforms.uTau.value = tau;
  });

  return (
    <mesh ref={mesh} geometry={geometry} material={material} visible={false} renderOrder={4} raycast={() => null} />
  );
}

/** La nappe n'existe que le temps de l'ouverture : aucune géométrie ensuite. */
export function WaterSkin(props: { id: string; shape: TerrainShape; sampler: HeightSampler }) {
  const live = useWorld((state) => state.phase === 'loading' || state.phase === 'intro' || state.phase === 'transitioning');
  const reducedMotion = useWorld((state) => state.reducedMotion);
  return live && !reducedMotion ? <Skin {...props} /> : null;
}
