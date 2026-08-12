'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Mesh, ShaderMaterial } from 'three';
import { boatState } from '@/lib/boat-state';
import { damp } from '@/lib/utils/math';

/**
 * Sillage : un simple quad posé sur l'eau derrière la coque, dont l'alpha est sculpté
 * en V par le shader. Bien plus léger qu'un système de particules, et suffisant à cette
 * échelle de caméra.
 */
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;

void main() {
  // vUv.y : 0 = juste derrière la poupe, 1 = extrémité du sillage.
  float spread = mix(0.10, 0.62, vUv.y);
  float lateral = abs(vUv.x - 0.5) / spread;

  float edge = smoothstep(1.0, 0.55, lateral) - smoothstep(0.55, 0.0, lateral) * 0.65;
  float ripple = 0.65 + 0.35 * sin(vUv.y * 26.0 - uTime * 6.0);
  float fade = (1.0 - vUv.y) * smoothstep(0.0, 0.12, vUv.y);

  float alpha = clamp(edge, 0.0, 1.0) * ripple * fade * uStrength;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(0.87, 0.95, 0.96, alpha);
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export function Wake() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uStrength: { value: 0 } }),
    [],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (!material.current) return;
    material.current.uniforms.uTime.value += dt;
    const wanted = Math.min(boatState.speed / 7, 1);
    material.current.uniforms.uStrength.value = damp(
      material.current.uniforms.uStrength.value,
      wanted,
      3,
      dt,
    );
    if (mesh.current) mesh.current.visible = material.current.uniforms.uStrength.value > 0.01;
  });

  // Le groupe parent porte déjà la rotation du bateau : le sillage part vers -X local.
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-5.6, 0.06, 0]}>
      <planeGeometry args={[5, 8]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
