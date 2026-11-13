/**
 * Où se cachent les secrets du monde (coordonnées monde x, z). Partagé par la scène 3D et
 * la carte de voyage du carnet (qui dessine les secrets trouvés) : aucune dépendance 3D ici.
 *
 * Placements choisis loin des cercles de collision des îles, des étoiles d'or et des routes
 * directes, pour récompenser la curiosité :
 *  - le coffre sur un banc de sable au large, à l'est (derrière l'île Projets) ;
 *  - le vieux chalutier échoué au sud-ouest de l'île Parcours (les origines bretonnes) ;
 *  - le mini sous-marin qui tourne entre l'îlot de départ, Projets et Expériences ;
 *  - le poisson à remontoir dans une piscine de rochers contre l'îlot High-tech ;
 *  - le serpent de mer au bout du monde, là où la pancarte prévient « ici vivent des monstres ».
 */

export type SecretId = 'chest' | 'wreck' | 'submarine' | 'mechafish' | 'serpent';

export interface SecretSpot {
  x: number;
  z: number;
}

export const CHEST_SPOT: SecretSpot = { x: 88, z: -6 };

/** Le chalutier repose sur des rochers : un petit cercle de collision l'entoure. */
export const WRECK_SPOT: SecretSpot = { x: -92, z: 54 };
export const WRECK_SOLID_RADIUS = 5.6;

/** Centre de l'ellipse parcourue par le périscope (demi-axes en mètres). */
export const SUBMARINE_LOOP = { x: 28, z: 44, rx: 13, rz: 9 };

/** Piscine de rochers adossée à l'îlot High-tech (-27, -47.8). */
export const LAGOON_SPOT: SecretSpot = { x: -32.6, z: -57.6 };
export const LAGOON_SOLID_RADIUS = 4.4;

/** Le serpent nage sur un arc du bout du monde (angles en radians, sens trigonométrique x → z). */
export const SERPENT_ARC = {
  radius: 112,
  from: (196 / 180) * Math.PI,
  to: (234 / 180) * Math.PI,
};

const serpentMiddle = (SERPENT_ARC.from + SERPENT_ARC.to) / 2;

/** Repère de chaque secret sur la carte de voyage. */
export const SECRET_MAP_SPOTS: Record<SecretId, SecretSpot> = {
  chest: CHEST_SPOT,
  wreck: WRECK_SPOT,
  submarine: { x: SUBMARINE_LOOP.x, z: SUBMARINE_LOOP.z },
  mechafish: LAGOON_SPOT,
  serpent: {
    x: Math.cos(serpentMiddle) * SERPENT_ARC.radius,
    z: Math.sin(serpentMiddle) * SERPENT_ARC.radius,
  },
};

export const SECRET_IDS: SecretId[] = ['chest', 'wreck', 'submarine', 'mechafish', 'serpent'];
