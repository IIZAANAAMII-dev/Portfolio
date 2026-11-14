import { BufferAttribute, BufferGeometry, Color } from 'three';

/**
 * Coque paramétrique de bateau traditionnel (repère : étrave vers +X, ligne de flottaison
 * en y = 0, largeur sur Z). Sections en « U » qui s'affinent jusqu'à l'étrave, tableau
 * arrière plat, tonture relevée aux extrémités. Les couleurs sont posées par face (bandes
 * nettes : carène, œuvres mortes, liston).
 */
export interface HullOptions {
  length: number;
  beam: number;
  /** Hauteur du plat-bord au milieu, au-dessus de l'eau. */
  freeboard: number;
  /** Profondeur de la quille sous l'eau. */
  draft: number;
  /** Largeur relative du tableau arrière (0 : pointu). */
  transom?: number;
  /** Relevé de la tonture aux extrémités. */
  sheer?: number;
  /** Couleurs : carène (sous l'eau), coque, liston (bande sous le plat-bord). */
  bottom: string;
  topside: string;
  strake: string;
  /** Intérieur (vaigrage) : la coque est vue d'en haut. */
  inside: string;
}

export function hullProfile(options: HullOptions, u: number) {
  const { beam, freeboard, draft, transom = 0.62, sheer = 0.16 } = options;
  const peak = 0.42;
  const width = u < peak
    ? transom + (1 - transom) * Math.sin((u / peak) * Math.PI * 0.5)
    : Math.pow(Math.max(0, Math.cos(((u - peak) / (1 - peak)) * Math.PI * 0.5)), 0.85);
  const halfBeam = (beam / 2) * Math.max(width, 0.015);
  const rise = (u - 0.45) / 0.55;
  const top = freeboard + sheer * rise * rise + (u > 0.8 ? (u - 0.8) * 0.4 : 0);
  const keel = -draft * (0.8 + 0.2 * Math.sin(Math.PI * u));
  return { halfBeam, top, keel };
}

export function hullGeometry(options: HullOptions) {
  const segmentsU = 18;
  const segmentsV = 10;
  const positions: number[] = [];
  const grid: [number, number, number][][] = [];
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const { halfBeam, top, keel } = hullProfile(options, u);
    const x = (u - 0.5) * options.length;
    const row: [number, number, number][] = [];
    for (let j = 0; j <= segmentsV; j++) {
      const phi = (j / segmentsV) * Math.PI;
      const fullness = Math.pow(Math.sin(phi), 0.55);
      row.push([x, top - (top - keel) * fullness, Math.cos(phi) * halfBeam]);
    }
    grid.push(row);
  }
  const colors: number[] = [];
  const bottom = new Color(options.bottom);
  const topside = new Color(options.topside);
  const strake = new Color(options.strake);
  const inside = new Color(options.inside);
  const pushTriangle = (a: number[], b: number[], c: number[], color: Color) => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      const y = (a[1] + b[1] + c[1] + d[1]) / 4;
      const top = (hullProfile(options, (i + 0.5) / segmentsU).top);
      const color = y < 0.02 ? bottom : y > top - 0.12 ? strake : topside;
      // Faces extérieures (sens trigonométrique vu de l'extérieur).
      pushTriangle(a, c, b, color);
      pushTriangle(a, d, c, color);
      // Faces intérieures : le vaigrage, visible d'en haut.
      pushTriangle(a, b, c, inside);
      pushTriangle(a, c, d, inside);
    }
  }
  // Tableau arrière : éventail fermant la section de poupe.
  const stern = grid[0];
  const center = [stern[0][0], (stern[0][1] + stern[segmentsV / 2][1]) / 2, 0];
  for (let j = 0; j < segmentsV; j++) {
    pushTriangle(center, stern[j], stern[j + 1], topside);
    pushTriangle(center, stern[j + 1], stern[j], topside);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}
