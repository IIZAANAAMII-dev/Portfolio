import { IcosahedronGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash } from '@/lib/utils/math';

/**
 * Dalle de granit à fleur d'eau, au dessus raboté bien plat : on y a peint un mot à la
 * peinture phosphorescente (GlowWord). Une icosphère étirée, bosselée sur les flancs, dont la
 * calotte est aplanie à `top`. Repère : centre de la dalle à l'origine ; le dessus plat mesure
 * environ 0,9 × `length` sur 0,9 × `width`.
 */
export function wordSlab(seed: number, length: number, width: number, top = 0.6, depth = 1.8) {
  const rock = new IcosahedronGeometry(1, 2);
  const positions = rock.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const bump = 1
      + Math.sin(x * 3.1 + seed) * Math.sin(z * 2.7 - seed * 0.7) * 0.07
      + Math.sin(y * 4.3 + seed * 1.3) * 0.05;
    const flat = y >= 0.35;
    const height = flat ? top : top - ((0.35 - y) / 1.35) * (top + depth);
    // Les flancs bombent un peu sous la table (granit usé par la mer).
    const swell = flat ? 1 : bump * (1.04 + (0.35 - y) * 0.06);
    positions.setXYZ(index, x * swell * length * 0.5, height, z * swell * width * 0.5);
  }
  rock.computeVertexNormals();
  return rock;
}

/** Deux galets autour de la dalle (repère de la dalle), pour un petit chaos naturel. */
export function slabCompanions(seed: number, length: number, width: number) {
  const parts: BufferGeometry[] = [];
  for (let index = 0; index < 3; index++) {
    const rock = new IcosahedronGeometry(1, 1);
    const positions = rock.attributes.position;
    const size = 0.45 + hash(seed + index * 3.1) * 0.5;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const z = positions.getZ(vertex);
      const bump = 1 + Math.sin(x * 2.9 + seed + index) * Math.sin(z * 2.3 - seed) * 0.14;
      positions.setXYZ(vertex, x * bump * size * 1.2, Math.max(y, -0.4) * bump * size * 0.8, z * bump * size);
    }
    rock.computeVertexNormals();
    const angle = hash(seed + index * 5.7) * Math.PI * 2;
    const side = index === 0 ? 1 : -1;
    rock.translate(
      side * (length * 0.5 + size * 0.4) * Math.abs(Math.cos(angle)) + (index === 2 ? -length * 0.18 : 0),
      size * 0.15 - 0.05,
      (width * 0.5 + size * 0.3) * Math.sin(angle) * (index === 2 ? 1.1 : 0.6),
    );
    parts.push(rock);
  }
  return parts;
}

/** Dalle et galets fusionnés en une seule géométrie. */
export function wordRockGroup(seed: number, length: number, width: number, top = 0.6) {
  const parts = [wordSlab(seed, length, width, top), ...slabCompanions(seed, length, width)];
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}
