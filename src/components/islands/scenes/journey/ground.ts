import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial } from 'three';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { hash } from '@/lib/utils/math';
import type { HeightSampler } from '../../terrain-shape';
import { channelCenter, PORT, portDistance, smooth, toFrame } from './terrain';

/**
 * Sol provençal : une « peau » posée sur la moitié Marseille du relief. Elle reprend
 * exactement la grille polaire du terrain (mêmes sommets, mêmes triangles), soulevée de
 * quelques centimètres : calcaire blanc sur les falaises, garrigue dorée sur les
 * plateaux, sable pâle sur les plages, dalles claires sur les quais. La moitié bretonne
 * garde le relief peint commun (herbe verte, roche moussue).
 */

const RINGS = 72;
const SECTORS = 112;

/** Bruit de valeur 2D bon marché (déterministe). */
function noise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const n = (a: number, b: number) => hash(a * 127.1 + b * 311.7);
  const top = n(ix, iz) + (n(ix + 1, iz) - n(ix, iz)) * sx;
  const bottom = n(ix, iz + 1) + (n(ix + 1, iz + 1) - n(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}

const C = (hex: string) => new Color(hex);
const SAND_DEEP = C('#c69c6d');
const SAND_WET = C('#d8b987');
const SAND_DRY = C('#f1dcae');
const LIMESTONE = [C('#f1ece2'), C('#e3dbcb'), C('#d6ccb8'), C('#ebe2d0')];
const LIME_WARM = C('#e9c9a0');
const LIME_FOOT = C('#c9bcaa');
const GARRIGUE = C('#c49d58');
const GARRIGUE_DRY = C('#b4854a');
const TERRA = C('#c0764a');
const SCRUB = C('#7c8743');
const SCRUB_DARK = C('#5f6d38');
const BARE_ROCK = C('#d9ccb2');
const PAVING = C('#e0cba6');
const TOWN_EARTH = C('#cfae7f');

function provenceColor(x: number, y: number, z: number, normalY: number, out: Color) {
  const [u, v] = toFrame(x, z);
  const large = noise(x * 0.28 + 3.1, z * 0.28 - 1.7);
  const small = noise(x * 1.3, z * 1.3);

  // Plateau : garrigue en grandes taches (herbe sèche dorée, terre rouge, maquis olive,
  // dalles de calcaire).
  out.copy(GARRIGUE).lerp(GARRIGUE_DRY, smooth(0.35, 0.72, large));
  out.lerp(TERRA, smooth(0.66, 0.82, noise(x * 0.42 + 40.0, z * 0.42 - 13.0)) * 0.55);
  const scrub = smooth(0.5, 0.68, noise(x * 0.55 - 9.0, z * 0.55 + 4.0));
  out.lerp(SCRUB, scrub * 0.85);
  out.lerp(SCRUB_DARK, scrub * smooth(0.55, 0.85, small) * 0.6);
  out.lerp(BARE_ROCK, smooth(0.74, 0.86, noise(x * 0.8 + 21.0, z * 0.8)) * 0.75);
  // Ville et quais : terre battue claire, puis dallage autour du bassin.
  const dPort = portDistance(u, v);
  out.lerp(TOWN_EARTH, (1 - smooth(PORT.quayWidth + 3, PORT.quayWidth + 6.5, dPort)) * 0.75);
  if (dPort > -0.1 && dPort < PORT.quayWidth + 0.15 && y > 0.6) out.copy(PAVING).multiplyScalar(0.94 + small * 0.1);

  // Falaise calcaire : strates blanches, taches chaudes, pied plus gris.
  const cliff = 1 - smooth(0.6, 0.8, normalY);
  if (cliff > 0) {
    const layer = y * 1.9 + large * 0.9;
    const stone = LIMESTONE[((Math.floor(layer) % 4) + 4) % 4];
    const rock = stone.clone().lerp(LIME_WARM, smooth(0.62, 0.8, noise(x * 0.9, y * 1.4 + z * 0.9)) * 0.55);
    rock.lerp(LIME_FOOT, (1 - smooth(-0.2, 0.9, y)) * 0.6);
    out.lerp(rock, cliff);
  }

  // Plage et fonds : sable pâle, plus sombre et plus chaud sous l'eau.
  const beach = 1 - smooth(0.78, 1.0, y + (large - 0.5) * 0.2);
  if (beach > 0 && cliff < 0.6) {
    const sand = SAND_DRY.clone().lerp(SAND_WET, 1 - smooth(0.1, 0.45, y)).lerp(SAND_DEEP, 1 - smooth(-0.7, 0.05, y));
    out.lerp(sand, beach * (1 - cliff));
  } else if (y < 0.05) {
    out.lerp(SAND_DEEP, smooth(0.05, -0.6, y));
  }
  out.multiplyScalar(0.95 + small * 0.08);
}

export function buildProvenceGround(sampler: HeightSampler, radius: number) {
  const outer = radius * 1.32;
  const count = 1 + RINGS * SECTORS;
  const positions = new Float32Array(count * 3);
  const side = new Uint8Array(count);
  const heights = new Float32Array(count);
  const place = (index: number, x: number, z: number) => {
    const y = sampler(x, z);
    positions[index * 3] = x;
    positions[index * 3 + 1] = y + 0.03;
    positions[index * 3 + 2] = z;
    heights[index] = y;
    const [u, v] = toFrame(x, z);
    side[index] = v - channelCenter(u) > -0.05 ? 1 : 0;
  };
  place(0, 0, 0);
  for (let ring = 1; ring <= RINGS; ring++) {
    const t = ring / RINGS;
    const r = outer * (t * 0.55 + t * t * 0.45);
    for (let sector = 0; sector < SECTORS; sector++) {
      const angle = (sector / SECTORS) * Math.PI * 2;
      place(1 + (ring - 1) * SECTORS + sector, Math.cos(angle) * r, Math.sin(angle) * r);
    }
  }

  // Mêmes triangles que le terrain, côté Marseille seulement, hors grands fonds.
  const indices: number[] = [];
  const keep = (a: number, b: number, c: number) => {
    if (!side[a] || !side[b] || !side[c]) return;
    if (Math.max(heights[a], heights[b], heights[c]) < -1.05) return;
    indices.push(a, b, c);
  };
  for (let sector = 0; sector < SECTORS; sector++) keep(0, 1 + ((sector + 1) % SECTORS), 1 + sector);
  for (let ring = 1; ring < RINGS; ring++) {
    const inner = 1 + (ring - 1) * SECTORS;
    const outerRing = 1 + ring * SECTORS;
    for (let sector = 0; sector < SECTORS; sector++) {
      const next = (sector + 1) % SECTORS;
      const a = inner + sector;
      const b = inner + next;
      const c = outerRing + sector;
      const d = outerRing + next;
      keep(a, b, c);
      keep(b, d, c);
    }
  }

  const colors = new Float32Array(count * 3);
  const cliffs = new Float32Array(count);
  const color = new Color();
  const e = 0.18;
  for (let index = 0; index < count; index++) {
    if (!side[index]) continue;
    const x = positions[index * 3];
    const z = positions[index * 3 + 2];
    const y = heights[index];
    const nx = sampler(x - e, z) - sampler(x + e, z);
    const nz = sampler(x, z - e) - sampler(x, z + e);
    const normalY = (2 * e) / Math.hypot(nx, 2 * e, nz);
    provenceColor(x, y, z, normalY, color);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    cliffs[index] = 1 - smooth(0.6, 0.8, normalY);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('aCliff', new BufferAttribute(cliffs, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Matériau du sol provençal : couleurs par sommet, ombres de nuages, facettes sur la roche. */
export const provenceGroundMaterial = (() => {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.name = 'journey:provence-ground';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCloudTime = cloudClock;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCliff;\nvarying float vCliff;\nvarying vec2 vGroundWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvCliff = aCliff;\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vCliff;\nvarying vec2 vGroundWorld;\nuniform float uCloudTime;\n${CLOUD_SHADOW_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - cloudShadow(vGroundWorld, uCloudTime) * 0.2;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 groundFacet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        normal = normalize(mix(normal, groundFacet, vCliff * 0.8));`,
      );
  };
  material.customProgramCacheKey = () => 'journey-provence-ground-v1';
  return material;
})();
