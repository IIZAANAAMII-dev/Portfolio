import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { nightGlow } from '@/lib/substance-models';

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
