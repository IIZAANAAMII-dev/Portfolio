import type { IslandSceneConfig } from '../types';
import { SHIPYARD, STAIRS, TOWN } from './layout';

/** Courbe douce 0 → 1 (copie locale : ce fichier est lu avant tout le reste de l'île). */
function ease(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Écart angulaire absolu entre deux angles (radians). */
function angleGap(a: number, b: number) {
  return Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

/**
 * ÎLE PROJETS — la ville. Le sommet est arasé en un plateau parfaitement plat (la ville
 * s'y pose sans flotter), un escalier est taillé dans la falaise depuis le ponton et un
 * petit chantier naval occupe une plage élargie au sud.
 */
const config: IslandSceneConfig = {
  trees: 1,
  grass: 0.55,
  grassPalette: ['#79ad4b', '#94c257', '#5d9440', '#b9cf63'],
  dressing: false,
  sculpt: (x, z, height) => {
    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    let h = height;

    // Plateau de la ville : plat jusqu'à TOWN.radius, puis raccord avec la falaise d'origine.
    const town = ease(TOWN.radius + TOWN.blend, TOWN.radius, r);
    if (town > 0) h += (TOWN.level - h) * town;

    // Cale du chantier naval : la plage s'élargit en un terre-plein à fleur de sable.
    const yardSide = ease(SHIPYARD.halfAngle + 0.12, SHIPYARD.halfAngle, angleGap(angle, SHIPYARD.angle));
    if (yardSide > 0) {
      const inYard = ease(SHIPYARD.inner - 0.9, SHIPYARD.inner, r) * ease(SHIPYARD.outer + 1.4, SHIPYARD.outer, r);
      const yard = inYard * yardSide;
      if (yard > 0) h += (SHIPYARD.level - h) * yard;
    }

    // Escalier du port : une saignée en pente douce dans la falaise, dans l'axe du ponton.
    const along = x * Math.cos(STAIRS.angle) + z * Math.sin(STAIRS.angle);
    const across = Math.abs(-x * Math.sin(STAIRS.angle) + z * Math.cos(STAIRS.angle));
    if (along > STAIRS.top - 0.6 && along < STAIRS.bottom + 1.2 && across < STAIRS.halfWidth + 0.7) {
      const t = Math.min(1, Math.max(0, (along - STAIRS.top) / (STAIRS.bottom - STAIRS.top)));
      const ramp = TOWN.level + (STAIRS.foot - TOWN.level) * t;
      const inside = ease(STAIRS.halfWidth + 0.7, STAIRS.halfWidth, across) * ease(STAIRS.top - 0.6, STAIRS.top, along);
      if (ramp < h) h += (ramp - h) * inside;
    }
    return h;
  },
};

export default config;
