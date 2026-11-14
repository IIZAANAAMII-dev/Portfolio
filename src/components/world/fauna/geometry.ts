import { BufferAttribute, BufferGeometry, Color } from 'three';

/**
 * Petit atelier de modelage procédural : triangles à couleur franche (une teinte par face,
 * lisible en cel-shading), corps « lofts » à sections elliptiques, nageoires minces.
 * Des canaux libres (identifiant de partie, position le long d'un tentacule…) accompagnent
 * chaque sommet : le vertex shader de la créature s'en sert pour l'animer.
 */

export type Vec3 = readonly [number, number, number];

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly channels: Record<string, number[]> = {};
  readonly current: Record<string, number> = {};

  constructor(channels: string[] = []) {
    for (const name of channels) {
      this.channels[name] = [];
      this.current[name] = 0;
    }
  }

  set(channel: string, value: number) {
    this.current[channel] = value;
    return this;
  }

  private vertex(point: Vec3, color: Color) {
    this.positions.push(point[0], point[1], point[2]);
    this.colors.push(color.r, color.g, color.b);
    for (const name in this.channels) this.channels[name].push(this.current[name]);
  }

  tri(a: Vec3, b: Vec3, c: Vec3, color: Color) {
    this.vertex(a, color);
    this.vertex(b, color);
    this.vertex(c, color);
    return this;
  }

  /** Quadrilatère a-b-c-d (ordre de contour). */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
    return this;
  }

  /** Triangle visible des deux côtés (nageoires très fines). */
  sheet(a: Vec3, b: Vec3, c: Vec3, color: Color) {
    this.tri(a, b, c, color);
    this.tri(a, c, b, color);
    return this;
  }

  /** Canal par sommet ajouté pendant la construction (ex. couleur calculée après coup). */
  build() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    for (const name in this.channels) {
      geometry.setAttribute(name, new BufferAttribute(new Float32Array(this.channels[name]), 1));
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** Section d'un corps : abscisse, demi-largeur (z), demi-hauteur (y), centre vertical. */
export interface Section {
  x: number;
  w: number;
  h: number;
  y: number;
  /** Aplatissement du dessous (1 = ellipse, < 1 = ventre plat). */
  belly?: number;
}

export interface LoftFace {
  /** Hauteur relative du centre de la face sur la section : 1 dos, -1 ventre. */
  up: number;
  /** Côté : 1 = +z, -1 = -z. */
  side: number;
  /** Abscisse du centre de la face. */
  x: number;
  /** Indices de la bande (section) et du segment radial. */
  ring: number;
  segment: number;
}

function ringPoint(section: Section, angle: number): Vec3 {
  const up = Math.cos(angle);
  const scale = up < 0 ? (section.belly ?? 1) : 1;
  return [section.x, section.y + section.h * up * scale, section.w * Math.sin(angle)];
}

/**
 * Corps tubulaire le long de X : `radial` segments par section, pointe fermée aux deux bouts
 * (le premier et le dernier anneau se referment sur leur centre). Le contour est décalé d'un
 * demi-segment pour qu'une arête passe exactement sur le dos (silhouette nette vue de profil).
 */
export function loft(
  builder: MeshBuilder,
  sections: Section[],
  radial: number,
  paint: (face: LoftFace) => Color,
) {
  const step = (Math.PI * 2) / radial;
  for (let ring = 0; ring < sections.length - 1; ring++) {
    const front = sections[ring];
    const back = sections[ring + 1];
    for (let segment = 0; segment < radial; segment++) {
      const a0 = segment * step;
      const a1 = a0 + step;
      const mid = a0 + step * 0.5;
      const color = paint({
        up: Math.cos(mid),
        side: Math.sign(Math.sin(mid)) || 1,
        x: (front.x + back.x) * 0.5,
        ring,
        segment,
      });
      // Orientation : normales vers l'extérieur pour un corps dont l'avant est en +X.
      builder.quad(ringPoint(front, a0), ringPoint(back, a0), ringPoint(back, a1), ringPoint(front, a1), color);
    }
  }
  // Bouchons : éventails vers le centre de chaque extrémité.
  const first = sections[0];
  const last = sections[sections.length - 1];
  for (let segment = 0; segment < radial; segment++) {
    const a0 = segment * step;
    const a1 = a0 + step;
    const mid = a0 + step * 0.5;
    const capFront = paint({ up: Math.cos(mid), side: Math.sign(Math.sin(mid)) || 1, x: first.x, ring: -1, segment });
    const capBack = paint({ up: Math.cos(mid), side: Math.sign(Math.sin(mid)) || 1, x: last.x, ring: sections.length, segment });
    builder.tri([first.x + 0.0001, first.y, 0], ringPoint(first, a0), ringPoint(first, a1), capFront);
    builder.tri([last.x - 0.0001, last.y, 0], ringPoint(last, a1), ringPoint(last, a0), capBack);
  }
}

/** Couleur sRGB (hexadécimal) → espace de travail linéaire, mise en cache. */
const cache = new Map<string, Color>();
export function tone(hex: string) {
  let color = cache.get(hex);
  if (!color) {
    color = new Color(hex);
    cache.set(hex, color);
  }
  return color;
}

/** Mélange de deux teintes (nouvelle couleur). */
export function blend(a: string, b: string, t: number) {
  return tone(a).clone().lerp(tone(b), t);
}
