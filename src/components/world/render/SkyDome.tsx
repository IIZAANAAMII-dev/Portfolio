'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, ShaderMaterial, type Mesh } from 'three';
import { SKY_FRAGMENT, SKY_VERTEX, skyUniforms } from './sky-shader';

/**
 * Dôme du ciel, centré sur la caméra (voir sky-shader.ts). Dessiné en dernier parmi les
 * opaques : le test de profondeur évite de calculer le ciel derrière la mer et les îles.
 *
 * Le matériau est construit ici (et non via la prop `uniforms`) : R3F recopie chaque
 * uniforme dans un nouvel objet, les valeurs numériques resteraient figées.
 */
export function SkyDome() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: skyUniforms,
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    mesh.current?.position.copy(state.camera.position);
  });
  return (
    <mesh
      ref={mesh}
      material={material}
      scale={420}
      renderOrder={900}
      frustumCulled={false}
      raycast={() => null}
    >
      <sphereGeometry args={[1, 48, 32]} />
    </mesh>
  );
}
