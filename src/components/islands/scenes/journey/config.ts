import type { IslandSceneConfig } from '../types';
import { journeyHeight } from './terrain';

/**
 * ÎLE PARCOURS — réglages lus avant le décor.
 *
 * Le relief est entièrement redessiné (voir terrain.ts) : deux moitiés séparées par un
 * chenal. L'herbe automatique ne pousse qu'au-dessus de « plateau − 0,35 » : la lande
 * bretonne est au-dessus (herbe grasse, touffes de bruyère), la garrigue marseillaise
 * en dessous (son sol est peint à part, voir ground.ts). Pas d'arbres ni d'habillage
 * automatiques : chaque moitié a ses propres rochers et sa propre végétation.
 */
const config: IslandSceneConfig = {
  trees: 0,
  grass: 0.85,
  grassPalette: ['#5d9a3f', '#3f7b36', '#82ab47', '#9a6aae'],
  dressing: false,
  // Roche moussue un peu plus froide : le granit breton.
  cliffTint: '#e4e4ec',
  sculpt: (x, z) => journeyHeight(x, z),
};

export default config;
