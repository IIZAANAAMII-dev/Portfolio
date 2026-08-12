'use client';

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, DoubleSide, ShaderMaterial, Vector4 } from 'three';
import { homeIsland, islands } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { WAVE_GLSL } from '@/lib/waves';

const OCEAN_SIZE = 420;
/** 6 îles + l'îlot de départ. Fixe pour éviter une boucle dynamique dans le shader. */
const SHOAL_COUNT = 7;

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vHeight;
${WAVE_GLSL}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float h = waveHeight(world.xz, uTime);
  world.y += h;
  vWorld = world.xyz;
  vHeight = h;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec4 uShoals[${SHOAL_COUNT}];
varying vec3 vWorld;
varying float vHeight;

void main() {
  // Distance au bord de l'île la plus proche : sert aux hauts-fonds et à l'écume.
  float edge = 1e4;
  for (int i = 0; i < ${SHOAL_COUNT}; i++) {
    edge = min(edge, distance(vWorld.xz, uShoals[i].xy) - uShoals[i].z);
  }

  float shallow = 1.0 - smoothstep(0.0, 16.0, max(edge, 0.0));
  vec3 color = mix(uDeep, uShallow, shallow * 0.85);

  // Crêtes : un léger éclaircissement sur les hauts de vague.
  color = mix(color, uFoam, smoothstep(0.22, 0.42, vHeight) * 0.16);

  // Ressac : une bande d'écume qui respire au contact des terres.
  float surf = smoothstep(3.4, 0.0, max(edge, 0.0));
  surf *= 0.55 + 0.45 * sin(edge * 2.2 - uTime * 1.6);
  color = mix(color, uFoam, clamp(surf, 0.0, 1.0) * 0.7);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

export function Ocean() {
  const material = useRef<ShaderMaterial>(null);
  const sailToPoint = useWorld((s) => s.sailToPoint);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new Color('#0b1a2b') },
      uShallow: { value: new Color('#1d5f74') },
      uFoam: { value: new Color('#dff3f5') },
      uShoals: {
        value: [
          new Vector4(homeIsland.position[0], homeIsland.position[1], homeIsland.radius, 0),
          ...islands.map((i) => new Vector4(i.position[0], i.position[1], i.radius, 0)),
        ],
      },
    }),
    [],
  );

  useFrame((_, dt) => {
    if (material.current) material.current.uniforms.uTime.value += dt;
  });

  const onOceanClick = (event: ThreeEvent<MouseEvent>) => {
    // Un clic sur une île est intercepté avant d'arriver ici (stopPropagation).
    event.stopPropagation();
    sailToPoint([event.point.x, event.point.z]);
  };

  return (
    <mesh rotation-x={-Math.PI / 2} onClick={onOceanClick} receiveShadow={false}>
      <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 180, 180]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={DoubleSide}
      />
    </mesh>
  );
}
