import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, type Texture } from 'three';
import { clothClock, nightGlow } from '@/lib/substance-models';

/**
 * Matériaux partagés par toute la ville. Peu de matériaux, beaucoup de couleurs : les
 * pièces sont peintes par sommet (voir builder.ts), si bien qu'un bâtiment entier tient
 * en un ou deux draw calls.
 */

/** Peinture mate à facettes (bois, enduit, tôle, pierre…). */
export const paint = new MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, flatShading: true });
paint.name = 'projects:paint';

/** Même peinture, sans facettes (volumes ronds : coques, capsules, dômes). */
export const paintSmooth = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
paintSmooth.name = 'projects:paint-smooth';

/**
 * Lumière peinte par sommet : néons, LED, globes de lampadaires, enseignes lumineuses.
 * La couleur émise est celle du sommet ; l'intensité suit la nuit (NightGlow).
 */
function glowMaterial(name: string, day: number, night: number) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    emissive: '#ffffff',
    emissiveIntensity: day,
    roughness: 0.5,
    toneMapped: true,
  });
  material.name = name;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;',
    );
  };
  material.customProgramCacheKey = () => 'projects-glow-v1';
  nightGlow.set(material, { day, night });
  return material;
}

/** Néons et LED : visibles de jour, éclatants la nuit. */
export const glow = glowMaterial('projects:glow', 0.55, 2.6);
/** Globes des lampadaires : éteints de jour, allumés la nuit. */
export const lampGlow = glowMaterial('projects:lamp', 0.05, 3.2);

/** Verre teinté des verrières et des salles vitrées (on voit l'intérieur). */
export const glass = new MeshStandardMaterial({
  color: '#bfe8f5',
  roughness: 0.08,
  metalness: 0.15,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  side: DoubleSide,
});
glass.name = 'projects:glass';

/* ------------------------------------------------------------- tissus au vent */

const cloths = new Map<string, MeshStandardMaterial>();

/**
 * Tissu qui ondule au vent (bâches de chantier, drapeaux) : une vague court sur le plan,
 * calculée en espace monde, nulle sur le bord tenu (`pin` : le haut d'une bâche, la
 * hampe d'un drapeau) et pleine sur le bord libre. Facettes franches : les plis se
 * lisent même de loin. Horloge commune des tissus (`clothClock`), aucun coût par image.
 * Les plans doivent avoir quelques subdivisions (6 × 4 suffisent).
 */
export function clothMaterial({ color = '#ffffff', map, amplitude = 0.06, pin = 'top' }: { color?: string; map?: Texture; amplitude?: number; pin?: 'top' | 'left' }) {
  const key = `${color}|${map?.uuid ?? ''}|${amplitude}|${pin}`;
  let material = cloths.get(key);
  if (!material) {
    const created = new MeshStandardMaterial({ color, map: map ?? null, roughness: 0.88, side: DoubleSide, flatShading: true });
    created.name = `projects:cloth:${key}`;
    const free = pin === 'top' ? '1.0 - uv.y' : 'uv.x';
    created.onBeforeCompile = (shader) => {
      shader.uniforms.uClothTime = clothClock;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uClothTime;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          vec4 clothWorld = modelMatrix * vec4(position, 1.0);
          float clothPhase = dot(clothWorld.xz, vec2(0.84, 0.54)) * 2.4 - uClothTime * 4.6;
          float clothWave = sin(clothPhase) * 0.65 + sin(clothPhase * 2.1 + clothWorld.y * 3.0) * 0.35;
          float clothFree = clamp(${free}, 0.0, 1.0);
          transformed += objectNormal * clothWave * ${amplitude.toFixed(3)} * clothFree;`,
        );
    };
    created.customProgramCacheKey = () => `projects-cloth-${amplitude}-${pin}`;
    cloths.set(key, created);
    material = created;
  }
  return material;
}

/** Faisceaux et halos d'hologrammes (additifs, sans ombre ni éclairage). */
export function beamMaterial(color: string, opacity: number) {
  return new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}
