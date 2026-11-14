/**
 * Plan de la ville de l'île Projets (repère local de l'île, en mètres).
 *
 * Fichier sans dépendance : il est lu par `config.ts` (relief) avant le chargement du décor.
 *
 *   - au centre, la place et la plateforme du centre cyber (hologramme de galaxie) ;
 *   - autour, une rue circulaire (la camionnette de livraison y tourne) ;
 *   - au-delà, une parcelle par projet, face aux caméras d'accostage (à l'ouest) ;
 *   - à l'ouest, l'escalier taillé dans la falaise qui monte du ponton ;
 *   - au sud, en contrebas, le chantier naval sur une plage élargie.
 */

export const TOWN = {
  /** Altitude du plateau arasé. */
  level: 3.95,
  /** Rayon jusqu'où le plateau est parfaitement plat. */
  radius: 13.9,
  /** Largeur du raccord avec la falaise d'origine. */
  blend: 0.9,
};

/** Escalier du port : de la place jusqu'au ponton (dockAngle de l'île). */
export const STAIRS = {
  angle: -2.8,
  /** Distance au centre du haut de l'escalier. */
  top: 10.7,
  /** Distance au centre du pied de l'escalier (sur le ponton). */
  bottom: 14.7,
  /** Altitude au pied (plancher du ponton ≈ 0,78). */
  foot: 0.84,
  halfWidth: 1.15,
};

/** Terre-plein du chantier naval, en contrebas au sud. */
export const SHIPYARD = {
  angle: 1.3,
  halfAngle: 0.3,
  inner: 14.4,
  outer: 16.4,
  level: 0.82,
};

export const PLAZA = { radius: 6.45 };
export const ROAD = { inner: 6.6, outer: 7.95, center: 7.275 };
export const WALK = { outer: 8.5 };
export const DAIS = { radius: 3.0, height: 0.42 };

/**
 * Point vers lequel les façades sont tournées : entre la caméra de jour (sud-ouest) et
 * celle du soir (ouest). Toutes les enseignes se lisent depuis le ponton.
 */
export const VIEWPOINT: [number, number] = [-30, 14];

export type SiteId = 'tech-center' | 'gallery' | 'medical' | 'cyber' | 'workshops' | 'shipyard';

/**
 * Parcelle de chaque bâtiment : angle et distance au centre, et `toward` : part de la
 * façade tournée vers le centre de la place (0 : face au ponton, 1 : face à la place).
 */
export const SITES: Record<SiteId, { angle: number; radius: number; toward: number }> = {
  'tech-center': { angle: -0.5, radius: 10.95, toward: 0.45 },
  gallery: { angle: 0.7, radius: 10.9, toward: 0.8 },
  medical: { angle: 1.92, radius: 10.9, toward: 0 },
  cyber: { angle: 0, radius: 0, toward: 0 },
  workshops: { angle: -1.62, radius: 11.2, toward: 0.6 },
  shipyard: { angle: SHIPYARD.angle, radius: 15.35, toward: 0 },
};

export function sitePosition(id: SiteId): [number, number] {
  const { angle, radius } = SITES[id];
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** Point d'un cercle de la ville (angle, rayon) : [x, z]. */
export function polar(angle: number, radius: number): [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** Rotation (autour de Y) qui tourne la façade (+Z local) d'un point vers un autre. */
export function faceToward(x: number, z: number, tx: number, tz: number) {
  return Math.atan2(tx - x, tz - z);
}

/** Rotation d'une parcelle : entre le ponton (caméras d'accostage) et le centre de la place. */
export function siteRotation(id: SiteId, towardCenter = SITES[id].toward) {
  const [x, z] = sitePosition(id);
  const toView = faceToward(x, z, VIEWPOINT[0], VIEWPOINT[1]);
  const toCenter = faceToward(x, z, 0, 0);
  let delta = toCenter - toView;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  return toView + delta * towardCenter;
}

/**
 * Lanternes de la place : les globes lumineux communs des îles (NightLights) flottent ici,
 * à ces hauteurs. Les lampadaires de la place sont plantés exactement dessous.
 */
export const PLAZA_LANTERNS: [number, number, number][] = [
  [-6, 0.8, -2.2],
  [-2.2, 0.75, 4.8],
  [3.1, 0.8, 3.7],
  [6.3, 0.72, -1.2],
  [0, 0.82, -5.2],
];
