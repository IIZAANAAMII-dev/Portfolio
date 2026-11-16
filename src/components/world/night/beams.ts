import { smoothstep } from '@/lib/utils/math';

/**
 * Faisceaux des phares, partagés hors React. Chaque phare (voir SweepBeam) publie à chaque
 * image la position de sa lanterne et l'orientation de ses faisceaux ; le bateau « pris dans
 * le faisceau » et les mots de lumière peints en mer lisent ici s'ils sont éclairés.
 * Angles en repère monde : cap = atan2(z, x).
 */
export interface BeamSource {
  /** Lanterne (monde). */
  x: number;
  y: number;
  z: number;
  /** Cap d'un des faisceaux ; les `count` faisceaux sont répartis en étoile. */
  bearing: number;
  count: number;
  /** Vitesse de rotation du cap (rad/s, signée). */
  spin: number;
  /** Demi-ouverture (rad) et portée (m) au ras de l'eau. */
  spread: number;
  reach: number;
  /** Intensité 0..1 (nuit, ou clic sur le phare). */
  strength: number;
}

export const beams = new Map<string, BeamSource>();

/** Écart angulaire (rad, 0..secteur/2) entre un cap et le faisceau le plus proche. */
export function beamOffset(beam: BeamSource, bearing: number) {
  const sector = (Math.PI * 2) / beam.count;
  const turn = (((bearing - beam.bearing) % sector) + sector) % sector;
  return Math.min(turn, sector - turn);
}

/**
 * Éclairage (0..1) d'un objet au ras de l'eau en (x, z), de demi-taille `size` (m) : il est
 * dans le faisceau quand son cap, vu de la lanterne, tombe dans l'ouverture du cône.
 */
export function beamLight(x: number, z: number, size = 0) {
  let best = 0;
  beams.forEach((beam) => {
    if (beam.strength < 0.01) return;
    const dx = x - beam.x;
    const dz = z - beam.z;
    const distance = Math.hypot(dx, dz);
    if (distance > beam.reach || distance < 0.5) return;
    const width = beam.spread + Math.atan2(size, distance);
    const off = beamOffset(beam, Math.atan2(dz, dx));
    const lit = (1 - smoothstep(width * 0.55, width, off))
      * (1 - smoothstep(beam.reach * 0.8, beam.reach, distance))
      * beam.strength;
    if (lit > best) best = lit;
  });
  return best;
}
