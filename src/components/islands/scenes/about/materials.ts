import { DoubleSide, MeshStandardMaterial } from 'three';
import { cobbleTexture, graniteTexture, netTexture, slateTexture } from './textures';

/**
 * Matériaux partagés du village (créés au premier usage, côté client : les textures sont
 * peintes dans des canvas). Tous des MeshStandardMaterial : le cel-shading global et les
 * ombres violettes s'appliquent d'office.
 */
function make() {
  const net = new MeshStandardMaterial({
    map: netTexture(),
    color: '#3f6f73',
    alphaTest: 0.5,
    side: DoubleSide,
    roughness: 1,
  });
  return {
    granite: new MeshStandardMaterial({ map: graniteTexture(), roughness: 0.95 }),
    slate: new MeshStandardMaterial({ map: slateTexture(), roughness: 0.72 }),
    cobbles: new MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.95 }),
    /** Pièces peintes par sommet (pierres d'angle, volets, fleurs, bois…). */
    paint: new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    /** Rochers, à facettes. */
    rock: new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    net,
  };
}

let materials: ReturnType<typeof make> | null = null;

export function villageMaterials() {
  materials ??= make();
  return materials;
}
