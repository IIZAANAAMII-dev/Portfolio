import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  SpriteMaterial,
  TorusGeometry,
} from 'three';
import { hash } from '@/lib/utils/math';
import { bevelBox, glowTexture, Pieces, pose } from './parts';

/**
 * Briques des pontons « dessin animé » : plancher de planches peintes, pieux cerclés de
 * cordage, lanternes. Partagées par le ponton de chaque île et par la longue jetée de
 * l'île Contact. Tout s'ajoute à un `Pieces` (fusion en un seul maillage).
 */

/** Hauteur du dessus du plancher au-dessus de l'eau. */
export const DECK = 0.78;
export const THICK = 0.1;

const WOODS = ['#c98d55', '#b97a48', '#d49f66', '#bf8450', '#ad7145'].map((hex) => new Color(hex));
const WEATHERED = new Color('#b9a88e');
const FRESH = new Color('#e3b57c');
const POST = new Color('#7a4e33');
export const POST_TOP = new Color('#95633f');
const WET = new Color('#4a392b');
const ALGAE = new Color('#3f6d4e');
export const ROPE = '#dcc084';
export const IRON = '#36444e';
export const BEAM = '#5f3d29';

/** Pieu : algues sous l'eau, bois mouillé à la flottaison, bois clair au-dessus. */
export function pilePainter(_x: number, y: number, _z: number, _ny: number, out: Color) {
  if (y < -0.32) out.copy(ALGAE);
  else if (y < 0.16) out.copy(WET);
  else out.copy(POST).multiplyScalar(0.95 + Math.min(1, (y - 0.16) * 0.6) * 0.12);
}

/** Générateur pseudo-aléatoire déterministe propre à un ouvrage. */
export function seeded(seed: number) {
  return (k: number) => hash(seed + k * 12.9898);
}

/**
 * Plancher le long de +X, de `start` à `end`, large de `2 × half` : fond sombre (les jours
 * entre planches restent noirs), deux lambourdes, planches de largeurs inégales avec
 * leurs clous. Renvoie le nombre de planches posées.
 */
export function addDeck(
  wood: Pieces,
  { start, end, half, deck = DECK, z = 0, seed }: { start: number; end: number; half: number; deck?: number; z?: number; seed: number },
) {
  const r = seeded(seed);
  const span = end - start;
  const mid = (start + end) / 2;
  wood.add(new BoxGeometry(span + 0.04, 0.02, half * 2 - 0.12), '#2a1d15', pose([mid, deck - THICK - 0.04, z]));
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(span + 0.1, 0.13, 0.15), BEAM, pose([mid, deck - THICK - 0.065, z + side * (half - 0.3)]), 0.18);
  }
  let x = start;
  let index = 0;
  while (x < end - 0.1) {
    let width = 0.24 + r(index) * 0.14;
    if (end - (x + width) < 0.18) width = end - x;
    const base = index % 11 === 6 ? WEATHERED : index % 13 === 9 ? FRESH : WOODS[Math.floor(r(index + 0.41) * WOODS.length)];
    const color = base.clone().multiplyScalar(0.93 + r(index + 0.77) * 0.12);
    const length = half * 2 + (r(index + 0.3) - 0.5) * 0.22;
    const matrix = pose(
      [x + width / 2, deck - THICK / 2 + (r(index + 0.63) - 0.5) * 0.022, z + (r(index + 0.52) - 0.5) * 0.09],
      [(r(index + 0.91) - 0.5) * 0.02, (r(index + 0.13) - 0.5) * 0.035, (r(index + 0.27) - 0.5) * 0.02],
    );
    wood.add(bevelBox(width - 0.045, THICK, length, 0.022), (_x, _y, pz, _ny, out) => {
      // Les bouts, plus exposés aux embruns, foncent un peu.
      out.copy(color).multiplyScalar(1 - Math.max(0, Math.abs(pz - z) - half * 0.55) * 0.32);
    }, matrix, 0.2);
    for (const side of [-1, 1]) {
      for (const dx of [-0.25, 0.25]) {
        const nail = pose([dx * (width - 0.06), THICK / 2 + 0.004, side * (half - 0.3)]);
        wood.add(new BoxGeometry(0.035, 0.012, 0.035), '#3a3330', matrix.clone().multiply(nail));
      }
    }
    x += width;
    index += 1;
  }
  return index;
}

/**
 * Pieu trapu planté dans l'eau : tête arrondie, cordage enroulé (si `rope`), balanes à la
 * flottaison. `top` est la hauteur de sa tête.
 */
export function addPile(
  wood: Pieces,
  { x, z, top, radius = 0.17, rope = true, seed, bottom = -1.95 }: { x: number; z: number; top: number; radius?: number; rope?: boolean; seed: number; bottom?: number },
) {
  const r = seeded(seed);
  const shaft = pose([x, (top + bottom) / 2, z], [(r(1) - 0.5) * 0.07, r(2) * Math.PI, (r(3) - 0.5) * 0.07]);
  wood.add(new CylinderGeometry(radius * 0.93, radius, top - bottom, 7, 4), pilePainter, shaft);
  wood.add(new SphereGeometry(radius * 0.97, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), POST_TOP, shaft.clone().multiply(pose([0, (top - bottom) / 2, 0])));
  if (rope) {
    // Trois tours de cordage bien serrés sous la tête.
    for (let turn = 0; turn < 3; turn++) {
      const coil = pose([0, (top - bottom) / 2 - 0.17 - turn * 0.07, 0], [Math.PI / 2, 0, (r(4 + turn) - 0.5) * 0.1]);
      wood.add(new TorusGeometry(radius + 0.012, 0.04, 4, 10), ROPE, shaft.clone().multiply(coil));
    }
  }
  if (bottom < -0.2) {
    for (let barnacle = 0; barnacle < 3; barnacle++) {
      const around = r(9 + barnacle) * Math.PI * 2;
      const height = -0.15 + r(9.5 + barnacle) * 0.32 - (top + bottom) / 2;
      const spot = pose([Math.cos(around) * radius, height, Math.sin(around) * radius], [0, 0, 0], 0.045 + r(barnacle) * 0.03);
      wood.add(new IcosahedronGeometry(1, 0), '#ece6d6', shaft.clone().multiply(spot));
    }
  }
}

/**
 * Lanterne de quai sur son grand pieu : socle, montants en fer, petit toit rouge. La vitre
 * (émissive) est un maillage à part : `LANTERN_GLASS` à placer en (x, y, z).
 */
export function addLanternPost(wood: Pieces, { x, y, z, bottom = -1.95, seed }: { x: number; y: number; z: number; bottom?: number; seed: number }) {
  const top = y - 0.24;
  wood.add(new CylinderGeometry(0.15, 0.19, top - bottom, 7, 5), pilePainter, pose([x, (top + bottom) / 2, z], [0, seeded(seed)(1) * Math.PI, 0]));
  wood.add(bevelBox(0.26, 0.08, 0.26, 0.03), POST_TOP, pose([x, top + 0.03, z]), 0.15);
  for (const drop of [0.5, 0.57, 0.64]) {
    wood.add(new TorusGeometry(0.17, 0.038, 4, 10), ROPE, pose([x, top - drop, z], [Math.PI / 2, 0, 0]));
  }
  addLantern(wood, x, y, z);
}

/** Lanterne seule (socle, montants, toit), centrée sur sa vitre en (x, y, z). */
export function addLantern(wood: Pieces, x: number, y: number, z: number, roof = '#c8553d') {
  wood.add(new BoxGeometry(0.34, 0.05, 0.34), IRON, pose([x, y - 0.17, z]), 0.1);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      wood.add(new BoxGeometry(0.035, 0.34, 0.035), IRON, pose([x + cx * 0.135, y, z + cz * 0.135]));
    }
  }
  wood.add(new BoxGeometry(0.34, 0.04, 0.34), IRON, pose([x, y + 0.18, z]));
  wood.add(new ConeGeometry(0.29, 0.24, 4), roof, pose([x, y + 0.32, z], [0, Math.PI / 4, 0]), 0.12);
  wood.add(new TorusGeometry(0.045, 0.014, 4, 8), IRON, pose([x, y + 0.47, z]));
}

/* ------------------------------------------------------------ matériaux partagés */

/** Bois et ferrures peints par sommet (facettes nettes). */
export const PAINTED = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
/** Vitre de lanterne : chaude, elle s'allume à la nuit (voir `updateHarborLights`). */
export const LANTERN_GLASS = new MeshStandardMaterial({ color: '#ffe7b3', emissive: '#ffb85c', emissiveIntensity: 0.3, roughness: 0.25 });
export const LANTERN_GLASS_GEOMETRY = new BoxGeometry(0.24, 0.31, 0.24);
/** Flaque de lumière chaude au pied d'une lanterne (additive). */
export const LIGHT_POOL_GEOMETRY = new CircleGeometry(1.75, 28).rotateX(-Math.PI / 2);
export const LIGHT_POOL = new ShaderMaterial({
  uniforms: { uStrength: { value: 0 }, uColor: { value: new Color('#ffb062') } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uStrength;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float a = 1.0 - smoothstep(0.0, 1.0, d);
      gl_FragColor = vec4(uColor, a * a * uStrength);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
});
/** Halo des lanternes (sprite additif). */
export const LANTERN_HALO = new SpriteMaterial({
  map: glowTexture(),
  color: '#ffc27a',
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  opacity: 0,
});

let lastUpdate = -1;

/**
 * Allume les lanternes à la tombée de la nuit (léger vacillement de flamme). Appelée par
 * chaque ponton à chaque image : seul le premier appel d'une image fait le travail.
 */
export function updateHarborLights(time: number, night: number) {
  if (lastUpdate === time) return;
  lastUpdate = time;
  const flicker = 1 + Math.sin(time * 7.3) * 0.03 + Math.sin(time * 13.1) * 0.02;
  LANTERN_GLASS.emissiveIntensity = (0.28 + night * 2.9) * flicker;
  LIGHT_POOL.uniforms.uStrength.value = night * 0.42 * flicker;
  LANTERN_HALO.opacity = night * 0.85 * flicker;
}
