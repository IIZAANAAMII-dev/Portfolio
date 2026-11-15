import type { IslandSceneConfig } from '../types';
import { sculptLab } from './layout';

/**
 * Île Compétences : le laboratoire. Le sommet d'origine est effacé au profit d'un plateau
 * en pente douce vers l'arrière, avec des replats sous la place centrale et sous les six
 * dalles (voir layout.ts). Herbe tondue comme un campus, deux flamboyants au bord du
 * plateau ; pas d'habillage automatique (rochers et fleurs procéduraux posés par le
 * décor, hors des dalles et des allées).
 */
const config: IslandSceneConfig = {
  trees: 2,
  grass: 0.7,
  dressing: false,
  sculpt: (x, z, height, features) => sculptLab(x, z, height, features.plateau),
  // Caméra à quai un peu plus proche : les zones se lisent depuis le ponton.
  camera: { zoom: 0.86, lift: 0.5 },
};

export default config;
