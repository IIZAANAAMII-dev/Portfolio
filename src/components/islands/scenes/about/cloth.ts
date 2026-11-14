import { DoubleSide, MeshStandardMaterial, type ColorRepresentation, type Texture } from 'three';
import { clothClock } from '@/lib/substance-models';

/**
 * Tissus au vent du village : voiles, filets qui sèchent, linge, drapeau. Une onde court
 * dans le sens du vent (le même que l'herbe et les arbres), calculée sur le GPU à partir
 * de l'horloge partagée des tissus (avancée une fois par image par NightGlow).
 *
 * Le poids du mouvement vient des UV :
 *  - `flag` : libre au bout (u = 1), tenu à la hampe (u = 0) ;
 *  - `belly` : bords tenus, milieu libre (voile, filet tendu entre deux perches) ;
 *  - `hang` : tenu en haut (v = 1), libre en bas (linge sur un fil).
 */
export type ClothMode = 'flag' | 'belly' | 'hang';

export function clothMaterial({
  color = '#ffffff',
  map,
  mode,
  amplitude,
  speed = 1,
  alphaTest = 0,
  roughness = 0.92,
}: {
  color?: ColorRepresentation;
  map?: Texture;
  mode: ClothMode;
  amplitude: number;
  speed?: number;
  alphaTest?: number;
  roughness?: number;
}) {
  const material = new MeshStandardMaterial({ color, map: map ?? null, side: DoubleSide, roughness, alphaTest });
  const weight = mode === 'flag'
    ? 'uv.x * (0.6 + 0.4 * uv.x)'
    : mode === 'belly'
      ? 'sin(uv.x * 3.14159) * sin(uv.y * 3.14159)'
      : '(1.0 - uv.y) * (1.0 - uv.y)';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          vec4 clothAt = modelMatrix * vec4(position, 1.0);
          float clothPhase = dot(clothAt.xz, vec2(0.84, 0.54)) * 1.7 - uClothTime * ${(4.2 * speed).toFixed(2)};
          float clothWave = sin(clothPhase + uv.x * 4.0) * 0.65 + sin(clothPhase * 1.7 + uv.y * 5.0 + 1.3) * 0.35;
          float clothGust = 0.75 + 0.25 * sin(uClothTime * 0.6 + clothAt.x * 0.1);
          transformed += normal * clothWave * clothGust * ${amplitude.toFixed(3)} * (${weight});
        }`,
      );
  };
  material.customProgramCacheKey = () => `about-cloth-${mode}-${amplitude}-${speed}`;
  return material;
}
