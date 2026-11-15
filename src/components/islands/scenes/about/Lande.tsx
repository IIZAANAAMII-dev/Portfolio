'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, IcosahedronGeometry, OctahedronGeometry, Vector3 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { hash } from '@/lib/utils/math';
import { ClearingAt, Hotspot, on } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { Glass } from './Glass';
import { buildHouse, WALL, type HouseParts } from './houses';
import {
  CHAPEL,
  CHAPEL_AT,
  CHAPEL_FACING,
  FIELD_WALLS,
  HARBOR_STAIR,
  HAYFIELD,
  HILL_PATH,
  LIGHTHOUSE,
  facing,
  polar,
  rampHeight,
  type Ramp,
} from './layout';
import { villageMaterials } from './materials';
import { Mesher, pebble, pose, type Vec3 } from './mesher';

/**
 * La lande bretonne qui couvre la butte et l'arrière du plateau : murets de pierre sèche
 * découpant de petits champs (le pré des moutons, un pré de foin et ses meules), massifs
 * d'ajoncs dorés et de bruyère mauve, chaos de granit, pins tordus par le vent d'ouest,
 * armérie rose au bord des falaises. Une chapelle de granit au sommet, son clocher-mur et
 * sa cloche (un clic la fait sonner). Deux escaliers de pierre relient le port, l'atelier
 * et la lande. Tout le décor fixe tient en un seul maillage (pierres et plantes à facettes).
 */

const GORSE_GREEN = ['#3f6b2f', '#4a7a34', '#365f2b'];
const GORSE_GOLD = ['#f2c230', '#f7d54a', '#e9b526'];
const HEATHER = ['#9b5fb8', '#b87acb', '#8a4fa6', '#c48ad6'];
const STONE = ['#a49c90', '#b2aa9b', '#958d82', '#bdb3a3', '#aeb08a'];
const PINE = ['#355f36', '#43703f', '#2f5531'];
const THRIFT = ['#ec8fbf', '#e477ad', '#f4f0ea', '#f2c94e', '#ef9cc8'];
/** Le vent d'ouest dominant (même direction que l'herbe et les tissus). */
const WIND = new Vector3(0.84, 0, 0.54);

/** Buisson à facettes, chaque face peinte d'une couleur de la palette (fleurs mêlées au feuillage). */
function bush(seed: number, blossom: string[], foliage: string[], share: number, squash: number) {
  const geometry = pebble(seed, 1, squash);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const color = new Color();
  for (let face = 0; face < count / 3; face++) {
    const flower = hash(seed * 13.1 + face * 1.37) < share;
    const palette = flower ? blossom : foliage;
    color.set(palette[Math.floor(hash(seed + face * 2.71) * palette.length)]);
    for (let corner = 0; corner < 3; corner++) color.toArray(colors, (face * 3 + corner) * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

function slopeAt(sampler: HeightSampler, x: number, z: number) {
  return Math.hypot(sampler(x + 0.4, z) - sampler(x - 0.4, z), sampler(x, z + 0.4) - sampler(x, z - 0.4)) / 0.8;
}

/** Porte de la chapelle (pignon du clocher-mur), au pied de laquelle arrive le sentier. */
const CHAPEL_DOOR: [number, number] = (() => {
  const yaw = facing(CHAPEL_FACING);
  const reach = CHAPEL.width / 2 + 0.45;
  return [CHAPEL_AT[0] + Math.cos(yaw) * reach, CHAPEL_AT[1] - Math.sin(yaw) * reach];
})();

function distanceToSegment(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

/** Point de la rampe à la fraction u (sol taillé). */
function rampPoint(path: Ramp, u: number): Vec3 {
  return [
    path.from[0] + (path.to[0] - path.from[0]) * u,
    rampHeight(path, u),
    path.from[1] + (path.to[1] - path.from[1]) * u,
  ];
}

interface Cluster {
  at: [number, number];
  spread: number;
  count: number;
  kind: 'gorse' | 'heather';
}

function polarCluster(angle: number, radius: number, spread: number, count: number, kind: Cluster['kind']): Cluster {
  return { at: polar(angle, radius), spread, count, kind };
}

const CLUSTERS: Cluster[] = [
  // Arrière du plateau : la lande rase, face au large.
  polarCluster(2.55, 9.6, 1.4, 7, 'heather'),
  polarCluster(3.05, 10.2, 1.3, 6, 'heather'),
  polarCluster(3.6, 9.9, 1.5, 7, 'heather'),
  polarCluster(-2.15, 9.7, 1.4, 6, 'heather'),
  polarCluster(-1.45, 9.5, 0.9, 4, 'heather'),
  polarCluster(2.8, 9.3, 1.2, 5, 'gorse'),
  polarCluster(3.35, 10.5, 1.1, 4, 'gorse'),
  polarCluster(-2.45, 10.3, 1.2, 5, 'gorse'),
  polarCluster(-1.75, 10.6, 0.9, 4, 'gorse'),
  polarCluster(2.25, 10.4, 0.9, 3, 'gorse'),
  // Le champ sauvage de la butte, autour de la chapelle.
  { at: [1.1, -3.3], spread: 0.9, count: 5, kind: 'heather' },
  { at: [-2.1, -3.0], spread: 0.8, count: 4, kind: 'heather' },
  { at: [2.1, -2.0], spread: 0.8, count: 4, kind: 'gorse' },
  { at: [-2.9, -1.7], spread: 0.7, count: 3, kind: 'gorse' },
];

function buildLande(sampler: HeightSampler, plateau: number) {
  const mesh = new Mesher(true, false);
  const tone = new Color();
  const pick = (palette: string[], key: number) => palette[Math.floor(hash(key) * palette.length)];
  const ground = (x: number, z: number) => sampler(x, z);

  // --- Murets de pierre sèche : deux assises de moellons, des ajoncs qui les longent.
  const stone = pebble(4.2, 0, 0.7);
  FIELD_WALLS.forEach((wall, wallIndex) => {
    for (let segment = 0; segment < wall.length - 1; segment++) {
      const [ax, az] = wall[segment];
      const [bx, bz] = wall[segment + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      const count = Math.ceil(length / 0.36);
      for (let index = 0; index < count; index++) {
        const t = (index + 0.5) / count;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        // Passage du sentier de la chapelle : le muret s'ouvre.
        if (distanceToSegment(x, z, HILL_PATH.to, CHAPEL_DOOR) < 0.55) continue;
        const key = wallIndex * 100 + segment * 17 + index;
        const y = ground(x, z);
        mesh.add(stone, pose([x, y + 0.12, z], [0, yaw + hash(key) * 0.4, 0], [0.24, 0.2 + hash(key + 1) * 0.06, 0.2]), tone.set(pick(STONE, key + 2)));
        if (index % 2 === 0 || hash(key + 3) > 0.4) {
          mesh.add(stone, pose([x + (hash(key + 4) - 0.5) * 0.1, y + 0.33, z], [0.2, yaw + 1, 0], [0.18, 0.15, 0.16]), tone.set(pick(STONE, key + 5)));
        }
      }
      // Ajoncs le long du muret, côté champ sauvage.
      for (let along = 0.7; along < length; along += 1.35) {
        const key = wallIndex * 50 + segment * 7 + along;
        if (hash(key) < 0.35) continue;
        const t = along / length;
        const x = ax + (bx - ax) * t + Math.cos(yaw) * 0.45;
        const z = az + (bz - az) * t - Math.sin(yaw) * 0.45;
        if (distanceToSegment(x, z, HILL_PATH.to, CHAPEL_DOOR) < 0.9) continue;
        const size = 0.42 + hash(key + 1) * 0.2;
        const gorse = bush(key, GORSE_GOLD, GORSE_GREEN, 0.38, 0.8);
        mesh.add(gorse, pose([x, ground(x, z) + size * 0.45, z], [0, key, 0], [size, size, size]));
        gorse.dispose();
      }
    }
  });

  // --- Massifs d'ajoncs et de bruyère.
  CLUSTERS.forEach((cluster, clusterIndex) => {
    for (let index = 0; index < cluster.count; index++) {
      const key = clusterIndex * 31 + index * 3.7;
      const angle = hash(key) * Math.PI * 2;
      const distance = cluster.spread * Math.sqrt(hash(key + 1.1));
      const x = cluster.at[0] + Math.cos(angle) * distance;
      const z = cluster.at[1] + Math.sin(angle) * distance;
      const y = ground(x, z);
      if (y < plateau - 0.35 || slopeAt(sampler, x, z) > 0.45) continue;
      if (cluster.kind === 'gorse') {
        const size = 0.45 + hash(key + 2) * 0.35;
        const gorse = bush(key, GORSE_GOLD, GORSE_GREEN, 0.4, 0.82);
        mesh.add(gorse, pose([x, y + size * 0.42, z], [0, key, 0], [size * 1.1, size, size]));
        gorse.dispose();
      } else {
        const size = 0.4 + hash(key + 2) * 0.3;
        const heather = bush(key + 0.5, HEATHER, ['#5b7a45', '#6b8a4c'], 0.72, 0.45);
        mesh.add(heather, pose([x, y + size * 0.15, z], [0, key, 0], [size * 1.4, size, size * 1.2]));
        heather.dispose();
      }
    }
  });

  // --- Chaos de granit : sur l'arrière de la butte, au bord du plateau et sur la grève.
  const boulders: [number, number, number][] = [
    [...polar(3.2, 11.0), 0.95], [...polar(2.4, 11.2), 0.8], [...polar(-2.6, 11.0), 1.1], [...polar(-1.9, 11.4), 0.75],
    [...polar(3.7, 11.2), 0.9], [-4.1, -1.9, 0.85], [-3.6, -3.0, 0.65], [1.6, -4.1, 0.7], [-1.0, -4.3, 0.6],
    [...polar(2.0, 14.3), 0.9], [...polar(2.9, 14.8), 1.1], [...polar(3.5, 14.6), 0.8], [...polar(-2.4, 14.6), 1.2],
    [...polar(-1.8, 14.9), 0.85], [...polar(-0.3, 13.9), 0.8], [...polar(1.3, 14.4), 0.9], [...polar(-2.95, 14.2), 0.7],
    [...polar(1.75, 14.9), 0.6], [...polar(-0.6, 14.4), 0.65],
  ];
  boulders.forEach(([x, z, size], index) => {
    const rock = pebble(index * 2.9 + 0.7, 1, 0.66);
    tone.set('#b5a79c').multiplyScalar(0.84 + hash(index * 3.3) * 0.26);
    mesh.add(rock, pose([x, Math.max(ground(x, z), -0.8) + size * 0.22, z], [hash(index) * 0.5, index * 1.7, 0], [size * 1.25, size, size * 1.05]), tone);
    rock.dispose();
  });

  // --- Pins tordus par le vent : tronc qui se couche sous le vent, houppiers en drapeau.
  const pines: [number, number, number][] = [[2.45, 9.3, 5.2], [-2.3, 9.8, 4.6], [3.3, 10.3, 5.6], [-2.85, 9.2, 4.2]];
  const crown = new IcosahedronGeometry(1, 1);
  pines.forEach(([angle, radius, height], index) => {
    const [x, z] = polar(angle, radius);
    const base = ground(x, z) - 0.1;
    let previous: Vec3 = [x, base, z];
    for (let segment = 1; segment <= 4; segment++) {
      const t = segment / 4;
      const lean = t * t * height * 0.32;
      const point: Vec3 = [x + WIND.x * lean, base + t * height * 0.92, z + WIND.z * lean];
      mesh.rod(previous, point, 0.16 - t * 0.08, '#6b4a32', 6);
      previous = point;
    }
    for (let blob = 0; blob < 4; blob++) {
      const t = 0.62 + blob * 0.12;
      const lean = t * t * height * 0.32 + blob * 0.35;
      const size = 1.05 - blob * 0.12 + hash(index * 5 + blob) * 0.2;
      mesh.add(
        crown,
        pose([x + WIND.x * lean, base + t * height * 0.95, z + WIND.z * lean], [0, Math.atan2(WIND.x, WIND.z), 0], [size * 1.25, size * 0.45, size * 1.6]),
        tone.set(PINE[(index + blob) % PINE.length]),
      );
    }
  });
  crown.dispose();

  // --- Armérie rose et fleurs sauvages au bord des falaises.
  const flower = new OctahedronGeometry(1, 0);
  for (let step = 0; step < 64; step++) {
    const angle = (step / 64) * Math.PI * 2 + hash(step) * 0.05;
    if (angle > 0.22 && angle < 0.86) continue;
    if (Math.abs(angle - (LIGHTHOUSE.angle + Math.PI * 2)) < 0.1) continue;
    // On cherche le bord du plateau en marchant vers le large.
    let radius = 8.5;
    while (radius < 13 && ground(...polar(angle, radius + 0.3)) > plateau - 0.25) radius += 0.3;
    for (let bud = 0; bud < 3; bud++) {
      const key = step * 7 + bud;
      const [x, z] = polar(angle + (hash(key) - 0.5) * 0.05, radius - 0.15 - hash(key + 1) * 0.5);
      const size = 0.06 + hash(key + 2) * 0.04;
      mesh.add(flower, pose([x, ground(x, z) + size * 1.4, z], [0, key, 0], size), tone.set(pick(THRIFT, key + 3)));
    }
  }
  // Pâquerettes dans le pré.
  for (let index = 0; index < 26; index++) {
    const [x, z] = [0.9 + (hash(index * 1.3) - 0.5) * 4.2, 3.0 + (hash(index * 2.9) - 0.5) * 3.2];
    mesh.add(flower, pose([x, ground(x, z) + 0.05, z], [0, index, 0], 0.05), tone.set(index % 5 === 0 ? '#f2c94e' : '#f8f5ee'));
  }

  // --- Pré de foin : andains dorés et trois meules.
  const disc = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const rings = 7;
  const sectors = 20;
  const point = (ring: number, sector: number): Vec3 => {
    const r = (ring / rings) * HAYFIELD.radius;
    const a = (sector / sectors) * Math.PI * 2;
    const x = HAYFIELD.center[0] + Math.cos(a) * r * 1.15;
    const z = HAYFIELD.center[1] + Math.sin(a) * r * 0.9;
    return [x, ground(x, z) + 0.035, z];
  };
  for (let ring = 0; ring < rings; ring++) {
    for (let sector = 0; sector < sectors; sector++) {
      const a = point(ring, sector);
      const b = point(ring + 1, sector);
      const c = point(ring + 1, sector + 1);
      const d = point(ring, sector + 1);
      const stripe = Math.floor((a[0] - HAYFIELD.center[0] + a[2] - HAYFIELD.center[1]) * 1.6 + 10) % 2;
      tone.set(stripe ? '#d9b75c' : '#c79f45');
      for (const corner of [a, c, b, a, d, c]) {
        positions.push(...corner);
        colors.push(tone.r, tone.g, tone.b);
      }
    }
  }
  disc.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  disc.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  disc.computeVertexNormals();
  mesh.add(disc);
  disc.dispose();
  const stackBody = new CylinderGeometry(0.5, 0.56, 0.55, 10);
  const stackTop = new IcosahedronGeometry(0.58, 1);
  for (const [dx, dz, size] of [[-0.6, -0.4, 1], [0.7, 0.35, 0.85], [-0.1, 0.75, 0.75]]) {
    const x = HAYFIELD.center[0] + dx;
    const z = HAYFIELD.center[1] + dz;
    const y = ground(x, z);
    mesh.add(stackBody, pose([x, y + 0.27 * size, z], [0, dx, 0], size), tone.set('#d4ad52'));
    mesh.add(stackTop, pose([x, y + 0.6 * size, z], [0, dz, 0], [size, size * 0.85, size]), tone.set('#e2bf62'));
  }

  // --- Escaliers de granit : marches, et un parapet côté vide pour celui du port.
  const tread = new CylinderGeometry(1, 1, 1, 4);
  for (const path of [HARBOR_STAIR, HILL_PATH]) {
    const dx = path.to[0] - path.from[0];
    const dz = path.to[1] - path.from[1];
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const [start, end] = path.climb;
    for (let index = 0; index < path.steps; index++) {
      const u = start + ((index + 0.5) / path.steps) * (end - start);
      const [x, y, z] = rampPoint(path, u);
      const run = ((end - start) * length) / path.steps;
      mesh.box([path.half * 2 - 0.1, 0.16, run + 0.04], [x, y + 0.04, z], [0, yaw, 0], tone.set(index % 2 ? '#c9c1b2' : '#bdb5a6'));
    }
    // Dalles sur les parties plates du chemin.
    for (const [from, to] of [[0, start], [end, 1]]) {
      const count = Math.floor(((to - from) * length) / 0.6);
      for (let index = 0; index < count; index++) {
        const u = from + ((index + 0.5) / count) * (to - from);
        const [x, y, z] = rampPoint(path, u);
        mesh.add(tread, pose([x, y + 0.02, z], [0, yaw + index, 0], [0.32, 0.08, 0.28]), tone.set('#cfc6b6'));
      }
    }
    if (path === HARBOR_STAIR) {
      // Parapet de pierre côté mer (la normale qui s'éloigne du centre de l'île).
      const side = (-dz * (path.from[0] + path.to[0]) + dx * (path.from[1] + path.to[1])) > 0 ? 1 : -1;
      const nx = (-dz / length) * side;
      const nz = (dx / length) * side;
      for (let index = 0; index < 12; index++) {
        const u = (index + 0.5) / 12;
        const [x, y, z] = rampPoint(path, u);
        mesh.add(stone, pose([x + nx * (path.half + 0.1), y + 0.22, z + nz * (path.half + 0.1)], [0, yaw + index, 0], [0.3, 0.28, 0.24]), tone.set(pick(STONE, index + 40)));
      }
    }
  }
  // Sentier de dalles à travers le pré, jusqu'à la porte de la chapelle.
  const trail = Math.hypot(CHAPEL_DOOR[0] - HILL_PATH.to[0], CHAPEL_DOOR[1] - HILL_PATH.to[1]);
  const trailStones = Math.floor(trail / 0.62);
  for (let index = 1; index < trailStones; index++) {
    const u = index / trailStones;
    const x = HILL_PATH.to[0] + (CHAPEL_DOOR[0] - HILL_PATH.to[0]) * u + (hash(index * 4.3) - 0.5) * 0.18;
    const z = HILL_PATH.to[1] + (CHAPEL_DOOR[1] - HILL_PATH.to[1]) * u + (hash(index * 6.1) - 0.5) * 0.18;
    mesh.add(tread, pose([x, ground(x, z) + 0.02, z], [0, index * 1.3, 0], [0.3, 0.08, 0.26]), tone.set('#cfc6b6'));
  }
  tread.dispose();

  // --- Calvaire de granit au départ du chemin de la lande.
  const [cx, cz] = [HILL_PATH.from[0] + 0.55, HILL_PATH.from[1] + 1.05];
  const cy = ground(cx, cz);
  const cyaw = facing(1.0);
  mesh.box([1.0, 0.25, 1.0], [cx, cy + 0.1, cz], [0, cyaw, 0], tone.set('#b9b0a2'));
  mesh.box([0.62, 0.3, 0.62], [cx, cy + 0.38, cz], [0, cyaw, 0], tone.set('#c4bbad'));
  mesh.box([0.18, 1.7, 0.18], [cx, cy + 1.35, cz], [0, cyaw, 0], tone.set('#c9c0b1'));
  mesh.box([0.8, 0.17, 0.17], [cx, cy + 1.85, cz], [0, cyaw, 0], tone.set('#c9c0b1'));
  mesh.add(new CylinderGeometry(0.22, 0.22, 0.05, 12), pose([cx, cy + 1.85, cz], [Math.PI / 2, cyaw, 0]), tone.set('#bdb39f'));
  stone.dispose();
  flower.dispose();
  stackBody.dispose();
  stackTop.dispose();

  return mesh.build();
}

/* ------------------------------------------------------------- la chapelle */

const BELL_SWING = 0.55;

function Chapel({ sampler }: { sampler: HeightSampler }) {
  const placement = useMemo(() => {
    const position = on(sampler, CHAPEL_AT[0], CHAPEL_AT[1], 1.4, 0.12);
    return { position, yaw: facing(CHAPEL_FACING) };
  }, [sampler]);
  const built = useMemo(() => {
    const parts: HouseParts = { walls: new Mesher(false, true), roof: new Mesher(false, true), details: new Mesher(true, false), glass: [] };
    const info = buildHouse(CHAPEL, () => parts);
    // Clocher-mur sur le pignon de l'entrée : deux piliers, un fronton, une croix.
    const x = CHAPEL.width / 2 - WALL / 2;
    const top = info.ridge - 0.08;
    for (const dz of [-0.42, 0.42]) parts.details.box([WALL + 0.06, 1.15, 0.26], [x, top + 0.55, dz], [0, 0, 0], '#cfc7b8');
    parts.details.box([WALL + 0.14, 0.16, 1.18], [x, top + 1.18, 0], [0, 0, 0], '#d8d1c3');
    parts.details.box([WALL + 0.1, 0.42, 0.42], [x, top + 1.42, 0], [Math.PI / 4, 0, 0], '#cfc7b8');
    parts.details.box([0.09, 0.62, 0.09], [x, top + 1.95, 0], [0, 0, 0], '#cfc7b8');
    parts.details.box([0.09, 0.09, 0.36], [x, top + 2.02, 0], [0, 0, 0], '#cfc7b8');
    return {
      walls: parts.walls.build(),
      roof: parts.roof.build(),
      details: parts.details.build(),
      glass: parts.glass,
      bell: [x, top + 0.98, 0] as Vec3,
    };
  }, []);
  const materials = villageMaterials();
  const bell = useRef<Group>(null);
  const rungAt = useRef(-100);
  const clock = useThree((state) => state.clock);
  useEffect(() => () => {
    built.walls?.dispose();
    built.roof?.dispose();
    built.details?.dispose();
  }, [built]);
  useFrame((state) => {
    const target = bell.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    // La cloche se balance quand on la sonne, et d'elle-même de loin en loin (l'angélus).
    const since = time - rungAt.current;
    const ringing = since < 6 ? Math.exp(-since * 0.55) : 0;
    const cycle = time % 46;
    const angelus = cycle < 5 ? Math.sin((cycle / 5) * Math.PI) * 0.6 : 0;
    const amplitude = Math.max(ringing, angelus);
    // L'axe de la cloche court entre les piliers : elle bat à travers le mur.
    target.rotation.z = Math.sin(time * 3.2) * BELL_SWING * amplitude;
  });
  return (
    <>
      <ClearingAt x={CHAPEL_AT[0]} z={CHAPEL_AT[1]} radius={2.9} />
      <group position={placement.position} rotation-y={placement.yaw}>
        <Hotspot
          hoverScale={1.03}
          onActivate={() => {
            rungAt.current = clock.elapsedTime;
            ambience.bell(0.7);
          }}
        >
          {built.walls && <mesh geometry={built.walls} material={materials.granite} castShadow receiveShadow />}
          {built.roof && <mesh geometry={built.roof} material={materials.slate} castShadow receiveShadow />}
          {built.details && <mesh geometry={built.details} material={materials.paint} castShadow receiveShadow />}
          <Glass specs={built.glass} />
          <group ref={bell} position={built.bell}>
            <mesh position-y={-0.2} castShadow raycast={() => null}>
              <cylinderGeometry args={[0.13, 0.25, 0.34, 12]} />
              <meshStandardMaterial color="#c9963e" roughness={0.35} metalness={0.7} />
            </mesh>
            <mesh position-y={-0.38} raycast={() => null}>
              <cylinderGeometry args={[0.27, 0.27, 0.05, 12]} />
              <meshStandardMaterial color="#b5843a" roughness={0.35} metalness={0.7} />
            </mesh>
          </group>
        </Hotspot>
      </group>
    </>
  );
}

export function Lande({ sampler, plateau }: { sampler: HeightSampler; plateau: number }) {
  const geometry = useMemo(() => buildLande(sampler, plateau), [plateau, sampler]);
  const materials = villageMaterials();
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <>
      <ClearingAt x={HAYFIELD.center[0]} z={HAYFIELD.center[1]} radius={HAYFIELD.radius * 1.1} />
      {geometry && <mesh geometry={geometry} material={materials.rock} castShadow receiveShadow />}
      <Chapel sampler={sampler} />
    </>
  );
}
