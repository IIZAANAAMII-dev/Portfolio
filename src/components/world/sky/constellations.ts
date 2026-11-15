import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { seeded } from './sky-layer';

/**
 * Constellations de l'archipel : cinq emblèmes du monde de Kyliann tracés en étoiles,
 * reliées par des traits fins qui se dessinent lentement à la tombée de la nuit.
 *
 * Coordonnées locales (x à droite, y vers le zénith, ~[-1, 1]) ; placement sur la voûte en
 * degrés : azimut (même repère que le cap du bateau : 0 = +x, 90 = +z), hauteur, échelle
 * (degrés par unité) et inclinaison. Les cinq figures font le tour de l'horizon (tous les
 * ~72°) à mi-hauteur : quel que soit le cap, l'une d'elles se reflète devant la proue.
 * `mag` : éclat (0..1) ; `warm` : étoile dorée (la lumière du phare, le nord…).
 */
type Star = { x: number; y: number; mag: number; warm?: boolean };
export type Figure = {
  id: string;
  label: string;
  az: number;
  el: number;
  scale: number;
  tilt: number;
  stars: Star[];
  lines: [number, number][];
};

const s = (x: number, y: number, mag: number, warm = false): Star => ({ x, y, mag, warm });

export const FIGURES: Figure[] = [
  {
    // Famille de marins-pêcheurs du Morbihan.
    id: 'anchor',
    label: 'L’Ancre',
    az: 18,
    el: 50,
    scale: 10,
    tilt: -8,
    stars: [
      s(0, 1.0, 0.7), s(-0.15, 0.86, 0.4), s(0.15, 0.86, 0.4), s(0, 0.72, 0.55),
      s(-0.46, 0.55, 0.6), s(0, 0.55, 0.5), s(0.46, 0.55, 0.6),
      s(0, -0.74, 0.9, true), s(-0.4, -0.62, 0.42), s(-0.64, -0.26, 0.7),
      s(0.4, -0.62, 0.42), s(0.64, -0.26, 0.7),
    ],
    lines: [[0, 1], [1, 3], [3, 2], [2, 0], [3, 5], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9], [7, 10], [10, 11]],
  },
  {
    // Phare breton à bandeau : la lumière au sommet est l'étoile la plus chaude.
    id: 'lighthouse',
    label: 'Le Phare',
    az: 90,
    el: 45,
    scale: 10.5,
    tilt: 4,
    stars: [
      s(-0.3, -1.0, 0.55), s(0.3, -1.0, 0.55), s(-0.24, -0.34, 0.4), s(0.24, -0.34, 0.4),
      s(-0.19, 0.32, 0.5), s(0.19, 0.32, 0.5), s(-0.13, 0.55, 0.45), s(0.13, 0.55, 0.45),
      s(0, 0.8, 1.0, true), s(-0.88, 0.74, 0.35, true), s(0.88, 0.44, 0.35, true),
    ],
    lines: [[0, 1], [0, 2], [2, 4], [1, 3], [3, 5], [2, 3], [4, 5], [4, 6], [5, 7], [6, 8], [7, 8], [6, 9], [7, 10]],
  },
  {
    // « </> » : une balise de code — et, en mer, une balise est un repère de navigation.
    id: 'code',
    label: 'La Balise',
    az: 162,
    el: 54,
    scale: 9,
    tilt: 6,
    stars: [
      s(-0.36, 0.42, 0.5), s(-0.86, 0, 0.75), s(-0.36, -0.42, 0.5),
      s(0.16, 0.62, 0.55), s(-0.16, -0.62, 0.55),
      s(0.36, 0.42, 0.5), s(0.86, 0, 0.75, true), s(0.36, -0.42, 0.5),
    ],
    lines: [[0, 1], [1, 2], [3, 4], [5, 6], [6, 7]],
  },
  {
    // Le voilier : coque, mât, grand-voile, étai et flamme.
    id: 'sailboat',
    label: 'Le Voilier',
    az: 236,
    el: 46,
    scale: 10,
    tilt: -5,
    stars: [
      s(-0.86, -0.38, 0.6), s(0.02, -0.38, 0.4), s(0.78, -0.38, 0.55),
      s(-0.55, -0.68, 0.4), s(0.5, -0.68, 0.4), s(0.02, 1.0, 0.85, true),
      s(0.02, -0.2, 0.35), s(0.66, -0.2, 0.6), s(0.3, 0.92, 0.35),
    ],
    lines: [[0, 1], [1, 2], [2, 4], [4, 3], [3, 0], [1, 6], [6, 5], [5, 7], [7, 6], [5, 0], [5, 8]],
  },
  {
    // La rose des vents : le nord est l'étoile dorée.
    id: 'compass',
    label: 'La Rose des vents',
    az: 306,
    el: 56,
    scale: 9,
    tilt: 0,
    stars: [
      s(0, 1.0, 1.0, true), s(0.2, 0.2, 0.32), s(0.86, 0, 0.6), s(0.2, -0.2, 0.32),
      s(0, -0.86, 0.6), s(-0.2, -0.2, 0.32), s(-0.86, 0, 0.6), s(-0.2, 0.2, 0.32), s(0, 0, 0.5),
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 0]],
  },
];

/** Index de la « figure » des étoiles de fond (reflets seulement, toujours tracée). */
export const BACKGROUND = FIGURES.length;

const DEG = Math.PI / 180;
const center = new Vector3();
const tangent = new Vector3();
const bitangent = new Vector3();

/**
 * Direction du ciel d'un point local d'une figure (projection gnomonique autour du centre).
 * `flip` retourne la figure verticalement : son reflet dans la mer se lit alors à l'endroit
 * depuis la caméra (un miroir horizontal renverse le haut et le bas).
 */
export function figureDirection(figure: Figure, x: number, y: number, flip: boolean, out: Vector3) {
  const az = figure.az * DEG;
  const el = figure.el * DEG;
  center.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  tangent.set(-Math.sin(az), 0, Math.cos(az));
  bitangent.crossVectors(tangent, center);
  const tilt = figure.tilt * DEG;
  const u = x * Math.cos(tilt) - y * Math.sin(tilt);
  const v = (x * Math.sin(tilt) + y * Math.cos(tilt)) * (flip ? -1 : 1);
  const k = Math.tan(figure.scale * DEG);
  return out.copy(center).addScaledVector(tangent, u * k).addScaledVector(bitangent, v * k).normalize();
}

/** Le tracé d'une figure : chaque trait à son tour, une étoile s'allume quand la plume l'atteint. */
function timeline(figure: Figure) {
  const count = figure.lines.length;
  const lines = figure.lines.map((_, i) => ({ t0: 0.06 + (0.9 * i) / count, t1: 0.06 + (0.9 * (i + 1)) / count }));
  const reveal = figure.stars.map((_, index) => {
    let first = 0.04;
    let found = false;
    figure.lines.forEach(([a, b], i) => {
      const t = a === index ? lines[i].t0 : b === index ? lines[i].t1 : Infinity;
      if (t < Infinity && (!found || t < first)) {
        first = t;
        found = true;
      }
    });
    return first;
  });
  return { lines, reveal };
}

/**
 * Géométrie unique (étoiles + traits) : chaque élément est un quad ; `position.z` donne sa
 * nature (0 = étoile, 1 = trait). Directions du ciel et du reflet précalculées.
 *  - aDir/aDirB : extrémités sur la voûte (identiques pour une étoile) ;
 *  - aSea/aSeaB : les mêmes pour le reflet (figure retournée) ;
 *  - aInfo : figure, début (apparition), fin du tracé, taille (px) ;
 *  - aSeed : graine, teinte (0 froid → 1 doré).
 */
export function buildConstellationGeometry(backgroundStars: number) {
  const corners: number[] = [];
  const dirA: number[] = [];
  const dirB: number[] = [];
  const seaA: number[] = [];
  const seaB: number[] = [];
  const info: number[] = [];
  const seed: number[] = [];
  const index: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const sa = new Vector3();
  const sb = new Vector3();
  let vertex = 0;

  const pushQuad = (kind: number, quad: [number, number][], values: number[], extra: number[]) => {
    for (const [cx, cy] of quad) {
      corners.push(cx, cy, kind);
      dirA.push(a.x, a.y, a.z);
      dirB.push(b.x, b.y, b.z);
      seaA.push(sa.x, sa.y, sa.z);
      seaB.push(sb.x, sb.y, sb.z);
      info.push(...values);
      seed.push(...extra);
    }
    index.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3);
    vertex += 4;
  };
  const starQuad: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  // Trait : x = extrémité (0 → 1), y = côté (-1 / 1).
  const lineQuad: [number, number][] = [[0, -1], [1, -1], [0, 1], [1, 1]];

  FIGURES.forEach((figure, f) => {
    const { lines, reveal } = timeline(figure);
    figure.lines.forEach(([i, j], l) => {
      const p = figure.stars[i];
      const q = figure.stars[j];
      figureDirection(figure, p.x, p.y, false, a);
      figureDirection(figure, q.x, q.y, false, b);
      figureDirection(figure, p.x, p.y, true, sa);
      figureDirection(figure, q.x, q.y, true, sb);
      pushQuad(1, lineQuad, [f, lines[l].t0, lines[l].t1, 1], [seeded(f * 31 + l), 0]);
    });
    figure.stars.forEach((star, i) => {
      figureDirection(figure, star.x, star.y, false, a);
      b.copy(a);
      figureDirection(figure, star.x, star.y, true, sa);
      sb.copy(sa);
      const size = 2.1 + star.mag * 3.1;
      pushQuad(0, starQuad, [f, reveal[i], reveal[i], size], [seeded(f * 17 + i * 3.7), star.warm ? 1 : 0]);
    });
  });

  // Étoiles de fond du reflet (la voûte a déjà les siennes, procédurales, dans le dôme).
  for (let i = 0; i < backgroundStars; i++) {
    const az = seeded(i * 1.91 + 4.2) * Math.PI * 2;
    const el = (8 + seeded(i * 2.73 + 9.1) * 72) * DEG;
    a.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    b.copy(a);
    sa.copy(a);
    sb.copy(a);
    const size = 0.9 + Math.pow(seeded(i * 3.17 + 1.3), 3) * 2.2;
    pushQuad(0, starQuad, [BACKGROUND, 0, 0, size], [seeded(i * 5.3 + 2.9), seeded(i * 7.1) > 0.9 ? 0.6 : 0]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(corners), 3));
  geometry.setAttribute('aDir', new BufferAttribute(new Float32Array(dirA), 3));
  geometry.setAttribute('aDirB', new BufferAttribute(new Float32Array(dirB), 3));
  geometry.setAttribute('aSea', new BufferAttribute(new Float32Array(seaA), 3));
  geometry.setAttribute('aSeaB', new BufferAttribute(new Float32Array(seaB), 3));
  geometry.setAttribute('aInfo', new BufferAttribute(new Float32Array(info), 4));
  geometry.setAttribute('aSeed', new BufferAttribute(new Float32Array(seed), 2));
  geometry.setIndex(index);
  return geometry;
}

/** Direction des étiquettes : sous chaque figure, sur la voûte. */
export function labelDirections() {
  return FIGURES.map((figure) => figureDirection(figure, 0, -1.32, false, new Vector3()));
}
