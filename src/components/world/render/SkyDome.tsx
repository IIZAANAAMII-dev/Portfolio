'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, type Mesh } from 'three';
import { SKY_FRAGMENT, SKY_VERTEX, skyUniforms } from './sky-shader';

/**
 * Dôme du ciel, centré sur la caméra (voir sky-shader.ts). Dessiné en dernier parmi les
 * opaques : le test de profondeur évite de calculer le ciel derrière la mer et les îles.
 */
export function SkyDome() {
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    mesh.current?.position.copy(state.camera.position);
  });
  return (
    <mesh ref={mesh} scale={420} renderOrder={900} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        uniforms={skyUniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
        side={BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
