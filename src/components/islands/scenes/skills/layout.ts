import { islandById } from '@/data/islands';
import { lerp, smoothstep } from '@/lib/utils/math';
import type { SkillZoneId } from '@/types';

/**
 * Plan du laboratoire de l'île Compétences, partagé par le relief (`config.ts`, chargé
 * avant le décor) et le décor lui-même. Coordonnées locales à l'île.
 *
 * Six zones en couronne autour d'un noyau central ; l'escalier du ponton arrive entre
 * l'Atelier Front-end et le Quai E-commerce. Le plateau monte doucement vers l'arrière
 * (à l'opposé de la caméra) : les zones du fond restent lisibles derrière celles du
 * premier plan.
 */

const DEG = Math.PI / 180;

export const DOCK_ANGLE = islandById.skills.dockAngle;

/** Direction moyenne d'où la caméra cadre l'île une fois à quai (de midi à l'heure dorée). */
export const VIEW_ANGLE = 120 * DEG;
const VIEW_X = Math.cos(VIEW_ANGLE) * 40;
const VIEW_Z = Math.sin(VIEW_ANGLE) * 40;
const BACK_X = -Math.cos(VIEW_ANGLE);
const BACK_Z = -Math.sin(VIEW_ANGLE);

/** Niveau moyen du plateau aplani, et sa montée vers l'arrière. */
const GROUND = 2.72;
const RISE = 0.75;

/** Hauteur des dalles des zones au-dessus du sol aplani. */
export const PAD_TOP = 0.2;
/** Échelle des dioramas (une zone est dessinée pour une dalle de rayon `pad`). */
export const ZONE_SCALE = 1.35;
/** Hauteur de la place centrale au-dessus du sol. */
export const PLAZA_TOP = 0.16;

/** Relief de base du laboratoire (avant les replats des zones). */
function slope(x: number, z: number) {
  const back = x * BACK_X + z * BACK_Z;
  return GROUND + RISE * smoothstep(-7, 8, back) + Math.sin(x * 0.45 + 1.3) * Math.cos(z * 0.38 - 0.4) * 0.07;
}

export interface ZoneSpot {
  id: SkillZoneId;
  x: number;
  z: number;
  /** Rayon de la dalle (octogone), dans le repère de la zone. */
  pad: number;
  /** Rayon réel de la dalle sur l'île (échelle de la zone comprise). */
  reach: number;
  /** Rotation Y : la face avant de la zone (+Z local) regarde la caméra. */
  facing: number;
  /** Altitude du sol aplani sous la dalle. */
  level: number;
  /** Direction (rotation Y locale) vers le noyau central, pour les câbles et allées. */
  toHub: number;
}

const SPOTS: { id: SkillZoneId; angle: number; distance: number; pad: number }[] = [
  { id: 'front', angle: 95 * DEG, distance: 7.3, pad: 2.0 },
  { id: 'lab3d', angle: 40 * DEG, distance: 6.6, pad: 1.95 },
  { id: 'ai', angle: 345 * DEG, distance: 7.2, pad: 1.95 },
  { id: 'tower', angle: 290 * DEG, distance: 6.55, pad: 2.0 },
  { id: 'back', angle: 236 * DEG, distance: 7.05, pad: 2.0 },
  { id: 'commerce', angle: 181 * DEG, distance: 6.75, pad: 2.05 },
];

export const HUB = { x: 0, z: 0, radius: 2.15, level: slope(0, 0) };

export const ZONE_SPOTS: ZoneSpot[] = SPOTS.map(({ id, angle, distance, pad }) => {
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  const facing = Math.atan2(VIEW_X - x, VIEW_Z - z);
  return { id, x, z, pad, reach: pad * ZONE_SCALE, facing, level: slope(x, z), toHub: Math.atan2(HUB.x - x, HUB.z - z) - facing };
});

export const zoneSpot = Object.fromEntries(ZONE_SPOTS.map((spot) => [spot.id, spot])) as Record<SkillZoneId, ZoneSpot>;

/** Sol du laboratoire : pente douce, replats sous la place et sous chaque dalle. */
export function labGround(x: number, z: number) {
  let height = slope(x, z);
  const hub = Math.hypot(x - HUB.x, z - HUB.z);
  height = lerp(height, HUB.level, 1 - smoothstep(HUB.radius + 0.25, HUB.radius + 1.3, hub));
  for (const spot of ZONE_SPOTS) {
    const distance = Math.hypot(x - spot.x, z - spot.z);
    if (distance > spot.reach + 1.3) continue;
    height = lerp(height, spot.level, 1 - smoothstep(spot.reach + 0.25, spot.reach + 1.3, distance));
  }
  return height;
}

/** Haut de la plage, au pied des falaises (profil d'origine du relief). */
const BEACH_TOP = 0.79;

/**
 * Retouche du relief : la plage reste intacte, la falaise est étirée jusqu'au nouveau
 * plateau, et le plateau (sommet d'origine compris) est remplacé par le sol du labo.
 */
export function sculptLab(x: number, z: number, height: number, plateau: number) {
  if (height <= BEACH_TOP) return height;
  const cliff = Math.min(1, (height - BEACH_TOP) / (plateau - 0.2 - BEACH_TOP));
  return BEACH_TOP + (labGround(x, z) - BEACH_TOP) * cliff;
}

/** Point d'arrivée de l'escalier du ponton sur le plateau, et départ de l'allée. */
export const STAIR_TOP = { distance: 9.55, angle: DOCK_ANGLE };

/** Allées : de l'escalier et de chaque zone vers le noyau (les impulsions y convergent). */
export interface PathSpec {
  /** Points (x, z) de l'allée. */
  points: [number, number][];
  width: number;
  /** Couleur de la ligne lumineuse. */
  color: string;
}

export function pathSpecs(accents: Record<SkillZoneId, string>, islandAccent: string): PathSpec[] {
  const entryCos = Math.cos(DOCK_ANGLE);
  const entrySin = Math.sin(DOCK_ANGLE);
  const entry: PathSpec = {
    points: [
      [entryCos * STAIR_TOP.distance, entrySin * STAIR_TOP.distance],
      [entryCos * 6.2 + entrySin * 0.35, entrySin * 6.2 - entryCos * 0.35],
      [entryCos * (HUB.radius - 0.05), entrySin * (HUB.radius - 0.05)],
    ],
    width: 1.15,
    color: islandAccent,
  };
  const spokes = ZONE_SPOTS.map<PathSpec>((spot) => {
    const angle = Math.atan2(spot.z, spot.x);
    const distance = Math.hypot(spot.x, spot.z);
    const start = HUB.radius - 0.05;
    const end = distance - spot.reach * 0.9;
    return {
      points: [
        [Math.cos(angle) * end, Math.sin(angle) * end],
        [Math.cos(angle) * start, Math.sin(angle) * start],
      ],
      width: 0.85,
      color: accents[spot.id],
    };
  });
  return [entry, ...spokes];
}
