import type { IslandSceneConfig } from '../types';
import { sculptExperience } from './layout';

/**
 * ÎLE EXPÉRIENCES — La Ciotat. Pas de flamboyants : le décor plante ses propres pins
 * parasols, cyprès et oliviers. Herbe de garrigue (plus sèche, plus dorée), falaises de
 * poudingue (teinte rouille) et relief retouché : port, chantier naval, Bec de l'Aigle.
 */
const config: IslandSceneConfig = {
  trees: 0,
  grass: 0.85,
  grassPalette: ['#7f9a40', '#5f8237', '#a9a34a', '#cdb15c'],
  // Les rochers et fleurs automatiques tomberaient sur les quais : le décor pose les siens.
  dressing: false,
  cliffTint: '#ffd2b8',
  sculpt: (x, z, height) => sculptExperience(x, z, height),
};

export default config;
