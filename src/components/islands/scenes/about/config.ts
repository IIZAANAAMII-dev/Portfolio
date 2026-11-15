import { clamp, lerp, smoothstep } from '@/lib/utils/math';
import type { IslandSceneConfig } from '../types';
import {
  BASIN_FLOOR,
  HARBOR,
  HARBOR_STAIR,
  HILL_PATH,
  LIGHTHOUSE,
  QUAY_Y,
  VILLAGE_Y,
  WORKSHOP,
  facing,
  polar,
  rampHeight,
  toDock,
  type Ramp,
} from './layout';

/**
 * Relief de l'île À propos : un hameau de pêcheurs breton.
 *  - la terrasse du village est aplanie sur le plateau, face au port ;
 *  - la butte centrale (la lande) recule un peu côté village pour lui faire de la place ;
 *  - une crique abritée est creusée dans la plage autour du ponton, avec son quai ;
 *  - une pointe rocheuse mène au phare.
 */

const LX = Math.cos(LIGHTHOUSE.angle);
const LZ = Math.sin(LIGHTHOUSE.angle);

/** L'atelier : centre et orientation de son plancher (repère de la maison, façade vers +Z). */
const [WORKSHOP_X, WORKSHOP_Z] = polar(WORKSHOP.angle, WORKSHOP.radius);
const WORKSHOP_YAW = facing(WORKSHOP.angle + WORKSHOP.turn);
const WORKSHOP_COS = Math.cos(WORKSHOP_YAW);
const WORKSHOP_SIN = Math.sin(WORKSHOP_YAW);

/**
 * Sol parfaitement plat sous l'atelier : une fois le toit levé et la façade abattue, on
 * voit son plancher de bois — pas l'herbe d'un terrain qui remonterait au travers. Appliqué
 * après les rampes : l'escalier du port, qui passe juste devant la façade, reste taillé
 * (côté façade, le replat s'arrête net au pied du mur ; ailleurs il se fond en 0,8 m).
 */
function workshopFloor(x: number, z: number, h: number) {
  const dx = x - WORKSHOP_X;
  const dz = z - WORKSHOP_Z;
  const across = Math.abs(dx * WORKSHOP_COS - dz * WORKSHOP_SIN) - (WORKSHOP.width / 2 + 0.3);
  const lz = dx * WORKSHOP_SIN + dz * WORKSHOP_COS;
  const along = lz > 0 ? (lz - WORKSHOP.depth / 2) * (0.8 / 0.35) : -lz - (WORKSHOP.depth / 2 + 0.3);
  const outside = Math.max(across, along);
  if (outside > 0.8) return h;
  return lerp(h, VILLAGE_Y, 1 - smoothstep(0, 0.8, outside));
}

/** Secteur angulaire du village (du phare jusqu'au penty), fondu sur les bords. */
function villageSector(angle: number) {
  return smoothstep(-1.6, -1.0, angle) * (1 - smoothstep(1.95, 2.55, angle));
}

/** Rampe taillée en écharpe : le sol suit la pente du chemin, bords fondus. */
function ramp(x: number, z: number, h: number, path: Ramp) {
  const dx = path.to[0] - path.from[0];
  const dz = path.to[1] - path.from[1];
  const u = ((x - path.from[0]) * dx + (z - path.from[1]) * dz) / (dx * dx + dz * dz);
  if (u < -0.2 || u > 1.2) return h;
  const along = clamp(u, 0, 1);
  const distance = Math.hypot(x - (path.from[0] + dx * along), z - (path.from[1] + dz * along));
  if (distance > path.half + 1) return h;
  const across = 1 - smoothstep(path.half, path.half + 1, distance);
  const ends = smoothstep(-0.2, 0.02, u) * (1 - smoothstep(0.98, 1.2, u));
  return lerp(h, rampHeight(path, along), across * ends);
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

  // 3. L'escalier du port (vers l'atelier) et le chemin creux qui monte à la lande.
  h = ramp(x, z, h, HARBOR_STAIR);
  h = ramp(x, z, h, HILL_PATH);
  h = workshopFloor(x, z, h);

  // 4. La pointe du phare : une langue de terre étroite qui descend vers son rocher.
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
  camera: { zoom: 1.55 },
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
