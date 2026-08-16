'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Mesh, ShaderMaterial } from 'three';
import { boatState } from '@/lib/boat-state';
import { introLightStrength } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, 1.18);
  float radius = length(p);
  float core = exp(-radius * radius * 19.0);
  float glow = exp(-radius * radius * 5.2);
  float alpha = (core * 0.18 + glow * 0.2) * uStrength;
  vec3 color = mix(vec3(1.0, 0.52, 0.25), vec3(1.0, 0.88, 0.66), core);
  gl_FragColor = vec4(color * (0.8 + core * 1.8), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Halo analytique sans texture ni passe de rendu supplémentaire. */
export function IntroHalo() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uStrength: { value: 1 } }), []);

  useFrame((state) => {
    if (!mesh.current || !material.current) return;
    const { phase, gameTransition } = useWorld.getState();
    const strength = phase === 'loading' || phase === 'intro'
      ? 1
      : phase === 'transitioning'
        ? introLightStrength(gameTransition)
        : 0;
    material.current.uniforms.uStrength.value = strength;
    mesh.current.visible = strength > 0.01;
    if (!mesh.current.visible) return;

    const sideX = Math.sin(boatState.heading);
    const sideZ = -Math.cos(boatState.heading);
    mesh.current.position.set(
      boatState.position.x - sideX * 5.8,
      5.4,
      boatState.position.z - sideZ * 5.8,
    );
    mesh.current.quaternion.copy(state.camera.quaternion);
  });

  return (
    <mesh ref={mesh} renderOrder={1} frustumCulled>
      <planeGeometry args={[22, 18, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
