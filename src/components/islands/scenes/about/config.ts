import { lerp, smoothstep } from '@/lib/utils/math';
import type { IslandSceneConfig } from '../types';
import { BASIN_FLOOR, HARBOR, LIGHTHOUSE, QUAY_Y, VILLAGE_Y, toDock } from './layout';

/**
 * Relief de l'île À propos : un hameau de pêcheurs breton.
 *  - la terrasse du village est aplanie sur le plateau, face au port ;
 *  - la butte centrale (la lande) recule un peu côté village pour lui faire de la place ;
 *  - une crique abritée est creusée dans la plage autour du ponton, avec son quai ;
 *  - une pointe rocheuse mène au phare.
 */

const LX = Math.cos(LIGHTHOUSE.angle);
const LZ = Math.sin(LIGHTHOUSE.angle);

/** Secteur angulaire du village (du phare jusqu'au penty), fondu sur les bords. */
function villageSector(angle: number) {
  return smoothstep(-1.6, -1.0, angle) * (1 - smoothstep(1.95, 2.55, angle));
}

function sculpt(x: number, z: number, height: number) {
  let h = height;
  const angle = Math.atan2(z, x);
  const sector = villageSector(angle);

  // 1. Terrasse du village : le plateau devient parfaitement plat (fini les bosses), la
  //    butte de lande garde sa falaise.
  const band = smoothstep(2.4, 3.05, h) * (1 - smoothstep(3.9, 4.4, h));
  h = lerp(h, VILLAGE_Y, sector * band);

  // 2. Le port, dans le repère du ponton.
  const [s, t] = toDock(x, z);
  const side = Math.abs(t);
  if (s > HARBOR.cliffTop - 1 && side < HARBOR.quayHalf + 2) {
    // La falaise recule : une esplanade au niveau des quais.
    const lateral = 1 - smoothstep(HARBOR.quayHalf - 0.5, HARBOR.quayHalf + 0.7, side);
    const cut = smoothstep(HARBOR.cliffTop, HARBOR.quayBack, s) * lateral;
    h = lerp(h, Math.min(h, QUAY_Y - 0.22), cut);
    // Le bassin, creusé sous l'eau entre le quai et la jetée.
    const inside = 1 - smoothstep(HARBOR.basinHalf - 0.3, HARBOR.basinHalf + 0.45, side);
    const basin = smoothstep(HARBOR.quayFront - 0.25, HARBOR.quayFront + 0.35, s) * inside;
    h = Math.min(h, lerp(h, BASIN_FLOOR, basin));
  }

  // 3. La pointe du phare : une langue de terre étroite qui descend vers son rocher.
  const along = x * LX + z * LZ;
  if (along > LIGHTHOUSE.spurFrom - 1 && along < LIGHTHOUSE.radius + 3) {
    const across = Math.abs(-x * LZ + z * LX);
    const width = 1 - smoothstep(LIGHTHOUSE.spurHalf, LIGHTHOUSE.spurHalf + 1.3, across);
    const reach = smoothstep(LIGHTHOUSE.spurFrom - 0.8, LIGHTHOUSE.spurFrom, along)
      * (1 - smoothstep(LIGHTHOUSE.radius + 0.6, LIGHTHOUSE.radius + 2.4, along));
    const top = lerp(VILLAGE_Y, LIGHTHOUSE.spurY, smoothstep(LIGHTHOUSE.spurFrom, LIGHTHOUSE.spurFrom + 2.6, along));
    h = Math.max(h, lerp(h, top, width * reach));
  }

  return h;
}

const config: IslandSceneConfig = {
  // Pas de flamboyants : des pins tordus par le vent et la lande sont posés par le décor.
  trees: 0,
  grass: 0.85,
  // Herbe de lande atlantique : verts plus frais, quelques touffes dorées.
  grassPalette: ['#6c9a45', '#4f7f3a', '#8ea94c', '#bba556'],
  // Rochers et fleurs sont procéduraux (granit, ajoncs, bruyère) : pas d'habillage commun.
  dressing: false,
  sculpt,
};

export default config;
