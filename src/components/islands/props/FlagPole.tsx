'use client';

import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, MeshStandardMaterial, PlaneGeometry } from 'three';
import { clothClock } from '@/lib/substance-models';
import { WIND_GLSL, windUniforms } from './wind';

/**
 * Mât de pavillon : hampe blanche, pomme dorée, drapeau qui bat au vent. Le drapeau ondule
 * avec la même vague (en espace monde) que les autres tissus, plus fort au passage des
 * rafales, et reste libre au bout.
 */

const FLAG_PARS = /* glsl */ `
uniform float uClothTime;
uniform float uFlagWidth;
${WIND_GLSL}
`;

const FLAG_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  float free = clamp( position.x / uFlagWidth, 0.0, 1.0 );
  vec4 flagWorld = modelMatrix * vec4( position, 1.0 );
  float gust = windGust( flagWorld.xz );
  float phase = position.x * 3.4 - uClothTime * ( 4.6 + gust * 1.6 ) + dot( flagWorld.xz, vec2( 0.84, 0.54 ) ) * 0.4;
  float wave = sin( phase ) * ( 0.12 + gust * 0.06 ) + sin( phase * 1.8 + position.y * 2.0 ) * 0.04;
  transformed.z += wave * free;
  // Sans vent fort, le bout retombe un peu.
  transformed.y -= free * free * ( 0.12 - gust * 0.07 );
}
`;

function createFlagMaterial(map: CanvasTexture, width: number) {
  const material = new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.92 });
  material.name = 'harbor-flag';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.uniforms.uClothTime = clothClock;
    shader.uniforms.uFlagWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLAG_PARS}`)
      .replace('#include <begin_vertex>', FLAG_VERTEX);
  };
  material.customProgramCacheKey = () => 'harbor-flag-v1';
  return material;
}

export function FlagPole({
  position,
  rotation = 0,
  height = 4,
  texture,
  width = 1.5,
}: {
  position: [number, number, number];
  rotation?: number;
  height?: number;
  /** Motif du drapeau (texture peinte). */
  texture: () => CanvasTexture;
  width?: number;
}) {
  const flagHeight = width * (2 / 3);
  const map = useMemo(() => texture(), [texture]);
  const material = useMemo(() => createFlagMaterial(map, width), [map, width]);
  const cloth = useMemo(() => new PlaneGeometry(width, flagHeight, 14, 5).translate(width / 2, 0, 0), [flagHeight, width]);
  useEffect(() => () => {
    map.dispose();
    material.dispose();
    cloth.dispose();
  }, [cloth, map, material]);

  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow position-y={height / 2} raycast={() => null}>
        <cylinderGeometry args={[0.045, 0.065, height, 6]} />
        <meshStandardMaterial color="#ece6da" roughness={0.6} />
      </mesh>
      <mesh position-y={height + 0.05} raycast={() => null}>
        <sphereGeometry args={[0.085, 8, 6]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh geometry={cloth} material={material} castShadow position={[0.05, height - flagHeight / 2 - 0.08, 0]} raycast={() => null} />
    </group>
  );
}
