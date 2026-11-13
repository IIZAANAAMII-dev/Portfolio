import { BufferAttribute, BufferGeometry } from 'three';
import { hash, lerp, smoothstep } from '@/lib/utils/math';

/**
 * Relief d'une île : une fonction de hauteur unique, qui sert à la fois à construire le
 * maillage et à poser les objets exactement sur le sol (pontons, maisons, rochers…).
 *
 * Profil radial en terrasses, à la manière des îles Bell Island :
 *   large haut-fond → plage en pente douce → falaise → plateau → seconde falaise → sommet
 * Les rayons ondulent avec l'angle (côte découpée) et le sommet est décentré.
 */
export interface TerrainShape {
  radius: number;
  elevation: number;
  seed: number;
}

export type HeightSampler = (x: number, z: number) => number;

/** Rayon relatif de la côte selon l'angle. */
function coast(angle: number, seed: number) {
  return 1
    + Math.sin(angle * 3 + seed * 1.7) * 0.07
    + Math.sin(angle * 7 - seed * 0.9) * 0.04
    + Math.sin(angle * 13 + seed * 0.31) * 0.015;
}

/** Ondulations douces des plateaux (somme de sinus, déterministe par île). */
function swell(x: number, z: number, seed: number) {
  return Math.sin(x * 0.31 + seed) * Math.cos(z * 0.27 - seed * 0.7) * 0.5
    + Math.sin((x + z) * 0.53 + seed * 2.1) * 0.25;
}

export const WATERLINE_HEIGHT = 0.15;
/** Altitude sous laquelle le sol devient plage (utilisée par le matériau du relief). */
export const BEACH_HEIGHT = 0.95;

/** Repères du relief : utiles pour poser le monument d'une île sur son sommet. */
export function terrainFeatures({ radius, elevation, seed }: TerrainShape) {
  const plateau = 0.8 + elevation * 0.42;
  return {
    plateau,
    summit: plateau + elevation * 0.4,
    hillX: (hash(seed * 5.3) - 0.5) * radius * 0.22,
    hillZ: (hash(seed * 7.9) - 0.5) * radius * 0.22,
    hillRadius: radius * (0.32 + hash(seed * 3.3) * 0.08),
    cliffWidth: Math.max(0.55, radius * 0.045),
  };
}

export function createHeightSampler(shape: TerrainShape): HeightSampler {
  const { radius, seed } = shape;
  const { plateau, summit, hillX, hillZ, hillRadius, cliffWidth } = terrainFeatures(shape);

  return (x, z) => {
    const r = Math.hypot(x, z);
    const edge = radius * coast(Math.atan2(z, x), seed);
    if (r >= edge) {
      // Haut-fond : la pente plonge vers le fond marin (-2.25).
      return Math.max(-2.2, WATERLINE_HEIGHT - (r - edge) * 0.42 - ((r - edge) / radius) ** 2 * 3);
    }
    const cliffFoot = edge * 0.8;
    // Plage : de la ligne d'eau au pied de la falaise.
    const beach = WATERLINE_HEIGHT + smoothstep(edge, cliffFoot, r) * (BEACH_HEIGHT - WATERLINE_HEIGHT) * 0.8;
    // Première falaise puis plateau légèrement ondulé.
    const firstCliff = smoothstep(cliffFoot, cliffFoot - cliffWidth, r);
    let height = lerp(beach, plateau + swell(x, z, seed) * 0.22, firstCliff);
    // Sommet décentré, en léger dôme.
    const dx = x - hillX;
    const dz = z - hillZ;
    const hillEdge = hillRadius * coast(Math.atan2(dz, dx), seed + 4.2);
    const r2 = Math.hypot(dx, dz);
    const secondCliff = smoothstep(hillEdge, hillEdge - cliffWidth * 0.9, r2);
    const dome = (1 - Math.min(r2 / hillEdge, 1)) ** 2 * 0.55;
    height = lerp(height, summit + dome + swell(x, z, seed + 3) * 0.12, secondCliff);
    return height;
  };
}

/**
 * Grille polaire dense (anneaux × secteurs) qui suit la fonction de hauteur. Les falaises
 * sont des transitions raides du profil : la projection triplanaire du matériau les
 * texture sans étirement, quelles que soient leurs pentes.
 */
export function buildTerrainGeometry(shape: TerrainShape, sampler: HeightSampler, { rings = 72, sectors = 112 } = {}) {
  const outer = shape.radius * 1.32;
  const vertexCount = 1 + rings * sectors;
  const positions = new Float32Array(vertexCount * 3);
  positions.set([0, sampler(0, 0), 0], 0);
  for (let ring = 1; ring <= rings; ring++) {
    // Anneaux un peu plus serrés vers la côte, où se trouvent plage et falaises.
    const t = ring / rings;
    const radius = outer * (t * 0.55 + t * t * 0.45);
    for (let sector = 0; sector < sectors; sector++) {
      const angle = (sector / sectors) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const index = 1 + (ring - 1) * sectors + sector;
      positions.set([x, sampler(x, z), z], index * 3);
    }
  }
  const indices: number[] = [];
  for (let sector = 0; sector < sectors; sector++) {
    const next = (sector + 1) % sectors;
    indices.push(0, 1 + next, 1 + sector);
  }
  for (let ring = 1; ring < rings; ring++) {
    const inner = 1 + (ring - 1) * sectors;
    const outerRing = 1 + ring * sectors;
    for (let sector = 0; sector < sectors; sector++) {
      const next = (sector + 1) % sectors;
      const a = inner + sector;
      const b = inner + next;
      const c = outerRing + sector;
      const d = outerRing + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Point du sol le plus haut dans un petit voisinage : pose un objet sans qu'il flotte. */
export function groundAt(sampler: HeightSampler, x: number, z: number, footprint = 0.6) {
  return Math.min(
    sampler(x, z),
    sampler(x + footprint, z),
    sampler(x - footprint, z),
    sampler(x, z + footprint),
    sampler(x, z - footprint),
  );
}
