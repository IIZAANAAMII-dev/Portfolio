import { DoubleSide, MeshStandardMaterial, type Texture } from 'three';
import { clothClock } from '@/lib/substance-models';

/**
 * Matériaux partagés de l'île Parcours (créés une fois, au niveau du module).
 * Couleurs par sommet : toute une construction tient dans un seul matériau.
 */

/** Peinture à facettes : pierre, bois, toits, rochers. */
export const flatPaint = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
flatPaint.name = 'journey:flat-paint';

/** Peinture lisse : feuillages arrondis, coques, nuage. */
export const smoothPaint = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
smoothPaint.name = 'journey:smooth-paint';

/** Peinture double face (voiles, filets). */
export const sheetPaint = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide });
sheetPaint.name = 'journey:sheet-paint';

/**
 * Tissu au vent (drapeaux, linge, voiles) : la vague part de l'attache (x = 0 ou y = 0
 * selon `hang`) et s'amplifie vers le bord libre. Horloge partagée (avancée par NightGlow).
 */
export function clothMaterial({
  map,
  color = '#ffffff',
  length,
  amplitude = 0.14,
  hang = false,
  speed = 4.6,
  alphaTest = 0,
}: {
  map?: Texture;
  color?: string;
  /** Longueur du tissu dans le sens de la vague (largeur d'un drapeau, hauteur d'un linge). */
  length: number;
  amplitude?: number;
  /** Linge suspendu : attache en haut (y = 0), bord libre vers le bas. */
  hang?: boolean;
  speed?: number;
  /** Découpe des parties transparentes de la texture (filet). */
  alphaTest?: number;
}) {
  const material = new MeshStandardMaterial({
    map,
    color,
    side: DoubleSide,
    roughness: 0.92,
    vertexColors: !map,
    alphaTest,
  });
  const free = hang ? `clamp(-position.y / ${length.toFixed(3)}, 0.0, 1.0)` : `clamp(position.x / ${length.toFixed(3)}, 0.0, 1.0)`;
  const along = hang ? '-position.y' : 'position.x';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float clothFree = ${free};
        vec4 clothWorld = modelMatrix * vec4(position, 1.0);
        float clothPhase = ${along} * 3.6 - uClothTime * ${speed.toFixed(2)} + clothWorld.x * 0.7 + clothWorld.z * 0.5;
        float clothWave = sin(clothPhase) * 0.75 + sin(clothPhase * 1.9 + position.y * 2.3) * 0.25;
        transformed.z += clothWave * clothFree * ${amplitude.toFixed(3)};
        ${hang ? 'transformed.x += sin(uClothTime * 1.7 + clothWorld.x) * clothFree * 0.05;' : 'transformed.y -= clothFree * clothFree * 0.06;'}`,
      );
  };
  material.customProgramCacheKey = () => `journey-cloth-${hang ? 'hang' : 'flag'}-${length}-${amplitude}-${speed}-${map ? 'map' : 'vc'}`;
  return material;
}

/**
 * Balancement au vent d'une géométrie fusionnée (linge, guirlandes) : l'attribut
 * `aFree` (0 à l'attache, 1 au bord libre) règle l'ampleur. Couleurs par sommet.
 */
export function swayMaterial(amplitude: number) {
  const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uClothTime = clothClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uClothTime;\nattribute float aFree;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float swayPhase = uClothTime * 3.1 + position.x * 1.7 + position.z * 1.3;
        transformed.x += sin(swayPhase) * aFree * ${amplitude.toFixed(3)};
        transformed.z += cos(swayPhase * 0.83 + 1.2) * aFree * ${amplitude.toFixed(3)};`,
      );
  };
  material.customProgramCacheKey = () => `journey-sway-${amplitude}`;
  return material;
}
