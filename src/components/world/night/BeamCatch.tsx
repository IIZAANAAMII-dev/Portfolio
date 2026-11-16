'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { BOAT_FRAME } from '@/components/boat/BoatModel';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { beamLight } from './beams';

/**
 * « Pris dans le faisceau » : quand le faisceau d'un phare balaie le bateau, la nuit, la coque
 * et la timonerie s'illuminent un instant (une nappe de lumière chaude posée sur le bateau,
 * sans lumière réelle) et un éclat en étoile file sur les vitres. Le premier passage vaut un
 * tampon au carnet de bord. Un seul appel de dessin, et seulement pendant l'éclairage.
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uLit;
uniform float uFlash;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  // Nappe de lumière sur le bateau : cœur doux, large frange.
  float wash = exp(-r2 * 3.2) * 0.75 + exp(-r2 * 9.0) * 0.45;
  // Éclat en croix sur les vitres de la timonerie (un peu au-dessus du centre).
  vec2 q = p - vec2(0.0, 0.16);
  float star = max(exp(-abs(q.x) * 70.0) * exp(-q.y * q.y * 9.0), exp(-abs(q.y) * 70.0) * exp(-q.x * q.x * 9.0));
  star += exp(-dot(q, q) * 160.0);
  float alpha = wash * uLit * 0.5 + star * uFlash;
  if (alpha < 0.004) discard;
  vec3 color = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.98, 0.92), clamp(star * uFlash, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

export default function BeamCatch() {
  const mesh = useRef<Mesh>(null);
  const lit = useRef(0);
  const flash = useRef(0);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uLit: { value: 0 }, uFlash: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    const dt = Math.min(delta, 1 / 30);
    const { phase } = useWorld.getState();
    const sailing = phase === 'playing' || phase === 'docked';
    const night = skyState.dayNight;
    const raw = sailing ? beamLight(boatState.position.x, boatState.position.z, BOAT_FRAME.bow * 0.8) * Math.min(1, night * 1.6) : 0;
    // Attaque vive, extinction plus douce : le faisceau passe, la lumière s'attarde un peu.
    lit.current = raw > lit.current ? damp(lit.current, raw, 16, dt) : damp(lit.current, raw, 3.2, dt);
    // L'éclat des vitres ne brille qu'au cœur du faisceau.
    const goal = Math.max(0, (raw - 0.75) / 0.25);
    flash.current = goal > flash.current ? damp(flash.current, goal, 22, dt) : damp(flash.current, goal, 5, dt);
    const value = lit.current;
    target.visible = value > 0.01;
    if (!target.visible) return;
    const uniforms = (target.material as ShaderMaterial).uniforms;
    uniforms.uLit.value = value;
    uniforms.uFlash.value = flash.current;
    const { x, z } = boatState.position;
    target.position.set(x, waveHeight(x, z, state.clock.elapsedTime) + 1.5, z);
    target.quaternion.copy(state.camera.quaternion);
    target.scale.setScalar(8.5);
    if (value > 0.6 && night > 0.5) logbook.stamp('beam');
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={9} visible={false} frustumCulled={false} raycast={() => null} />;
}
