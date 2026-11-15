import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { hash } from '@/lib/utils/math';
import { Parts, pose, span, type V3 } from './parts';

/**
 * Modèles procéduraux des jouets flottants : caisses à poissons, tonneaux, casiers à homard,
 * bouées, ballon, bouées couronnes, canard marin à bachi, balises et le radeau du
 * chamboule-tout. Couleurs franches par sommet, bois facetté, plastique lisse : le
 * cel-shading global (lib/toon.ts) fait le reste.
 */

/** Caisse à poissons (mètres) : assez carrée pour s'empiler en pyramide. */
export const CRATE = { w: 1.05, h: 0.72, d: 1.05 } as const;

/** Radeau : demi-côté du pont, hauteur du pont au-dessus de l'origine, mât dans un coin. */
export const RAFT = { half: 2.25, deck: 0.37, mastX: 1.92, mastZ: 1.92, mastTop: 3.35 } as const;

const TAR = '#3b2d23';
const ROPE = '#e9d9ae';
const IRON = '#3c3a41';

/** Caisse : le bois (montants, lattes basses, fond, poissons) et la bande peinte (lattes hautes). */
export function crateGeometries() {
  const { w, h, d } = CRATE;
  const wood = new Parts();
  const paint = new Parts();
  const slatH = 0.24;
  const low = -h / 2 + 0.07 + slatH / 2;
  const high = h / 2 - 0.035 - slatH / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      wood.add(new BoxGeometry(0.1, h, 0.1), '#7b4d2b', pose([sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)]), { flat: true, shade: 0.14 });
    }
  }
  wood.add(new BoxGeometry(w - 0.06, 0.05, d - 0.06), '#6c4426', pose([0, -h / 2 + 0.035, 0]), { flat: true });
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(w - 0.14, slatH, 0.045), side < 0 ? '#c99152' : '#b57d43', pose([0, low, side * (d / 2 - 0.03)]), { flat: true, shade: 0.14 });
    wood.add(new BoxGeometry(0.045, slatH, d - 0.14), side < 0 ? '#b57d43' : '#c99152', pose([side * (w / 2 - 0.03), low, 0]), { flat: true, shade: 0.14 });
    paint.add(new BoxGeometry(w - 0.14, slatH, 0.05), '#ffffff', pose([0, high, side * (d / 2 - 0.03)]), { flat: true, shade: 0.12 });
    paint.add(new BoxGeometry(0.05, slatH, d - 0.14), '#ffffff', pose([side * (w / 2 - 0.03), high, 0]), { flat: true, shade: 0.12 });
    // Poignée : une fente sombre dans la bande peinte.
    wood.add(new BoxGeometry(0.02, 0.07, 0.28), '#2b1b10', pose([side * (w / 2), high + 0.02, 0]), { flat: true, shade: 0 });
  }
  // La pêche du jour, couchée au fond de la caisse.
  const catches: V3[] = [[-0.12, -0.16, 0.5], [0.14, 0.12, -2.6], [-0.05, 0.2, 2.9]];
  catches.forEach(([x, z, yaw], index) => {
    const y = -h / 2 + 0.11 + index * 0.035;
    wood.add(
      new OctahedronGeometry(1, 0),
      (_x, py, pz, out) => { out.set(py < 0 ? '#dfe8ee' : pz > 0 ? '#58799b' : '#a9c4d6'); },
      pose([x, y, z], [0, yaw, 0], [0.27, 0.07, 0.1]),
      { faces: true, local: true, flat: true, shade: 0 },
    );
    wood.add(
      new ConeGeometry(0.08, 0.13, 3),
      '#6d8da8',
      pose([x - Math.cos(yaw) * 0.31, y, z + Math.sin(yaw) * 0.31], [0, yaw, -Math.PI / 2], [0.35, 1, 1]),
      { flat: true, shade: 0 },
    );
  });
  return { wood: wood.build(), paint: paint.build() };
}

/** Tonneau couché (axe X) : douelles bombées, cerclages de fer, bonde. */
export function barrelGeometry() {
  const parts = new Parts();
  const length = 1.1;
  const belly = 0.44;
  const end = 0.36;
  const bulge = (t: number) => end + (belly - end) * (1 - t * t);
  const body = new CylinderGeometry(1, 1, length, 12, 6);
  const positions = body.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const k = bulge(positions.getY(index) / (length / 2));
    positions.setX(index, positions.getX(index) * k);
    positions.setZ(index, positions.getZ(index) * k);
  }
  parts.add(
    body,
    (x, y, z, out) => {
      if (Math.abs(y) > length / 2 - 0.001) out.set('#8d5b31');
      else out.set(Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0 ? '#bb7c42' : '#a96d39');
    },
    pose([0, 0, 0], [0, 0, Math.PI / 2]),
    { faces: true, local: true, flat: true, shade: 0.08 },
  );
  for (const t of [-0.8, -0.42, 0.42, 0.8]) {
    const radius = bulge(t) + 0.014;
    parts.add(new CylinderGeometry(radius, radius, 0.07, 12, 1, true), IRON, pose([(t * length) / 2, 0, 0], [0, 0, Math.PI / 2]), { flat: true, shade: 0.05 });
  }
  parts.add(new CylinderGeometry(0.05, 0.05, 0.03, 8), '#3b2617', pose([0, belly + 0.002, 0]), { shade: 0 });
  return parts.build();
}

/** Casier à homard breton : socle goudronné, arceaux, goulet, flotteur… et son prisonnier. */
export function potGeometry() {
  const parts = new Parts();
  const length = 1.0;
  const width = 0.66;
  const arch = 0.3;
  for (const side of [-1, 1]) {
    parts.add(new BoxGeometry(length, 0.07, 0.08), '#5c4030', pose([0, 0, side * (width / 2 - 0.04)]), { flat: true, shade: 0.12 });
  }
  for (const x of [-0.42, 0, 0.42]) parts.add(new BoxGeometry(0.09, 0.06, width), '#6b4a33', pose([x, 0.01, 0]), { flat: true, shade: 0.12 });
  for (const x of [-0.46, 0, 0.46]) {
    parts.add(new TorusGeometry(arch, 0.026, 4, 12, Math.PI), TAR, pose([x, 0.03, 0], [0, Math.PI / 2, 0]), { flat: true, shade: 0.05 });
  }
  parts.add(new CylinderGeometry(0.022, 0.022, 0.96, 5), TAR, pose([0, 0.03 + arch, 0], [0, 0, Math.PI / 2]), { flat: true, shade: 0 });
  for (const side of [-1, 1]) {
    parts.add(new CylinderGeometry(0.02, 0.02, 0.96, 5), TAR, pose([0, 0.03 + arch * 0.7, side * arch * 0.71], [0, 0, Math.PI / 2]), { flat: true, shade: 0 });
  }
  parts.add(new TorusGeometry(0.12, 0.024, 4, 12), ROPE, pose([0.47, 0.18, 0], [0, Math.PI / 2, 0]), { shade: 0 });
  parts.add(new CylinderGeometry(1, 1, 1, 4), ROPE, span([-0.18, 0.03 + arch, 0], [-0.24, 0.5, 0.06], 0.012), { shade: 0 });
  parts.add(new SphereGeometry(0.13, 10, 8), '#ff6a2c', pose([-0.25, 0.56, 0.07]), { shade: 0 });
  const shell = '#e2492f';
  parts.add(new OctahedronGeometry(1, 0), shell, pose([0, 0.11, 0], [0, 0.25, 0], [0.2, 0.065, 0.075]), { flat: true, shade: 0.05 });
  parts.add(new ConeGeometry(0.06, 0.12, 4), shell, pose([-0.22, 0.1, 0.06], [0, 0.25, -Math.PI / 2], [1, 1, 0.5]), { flat: true, shade: 0 });
  for (const side of [-1, 1]) {
    parts.add(new SphereGeometry(1, 6, 4), shell, pose([0.22, 0.12, side * 0.1], [0, 0.25 + side * 0.4, 0], [0.08, 0.04, 0.05]), { flat: true, shade: 0 });
  }
  return parts.build();
}

/** Filet du casier : demi-cylindre rendu en fil de fer (mailles losanges). */
export function potNetGeometry() {
  const net = new CylinderGeometry(0.3, 0.3, 0.92, 10, 3, true, 0, Math.PI);
  net.rotateZ(Math.PI / 2);
  net.translate(0, 0.03, 0);
  return net;
}

/** Bouée de mouillage ronde : orange à ceinture blanche, manille et organeau. */
export function roundBuoyGeometry() {
  const parts = new Parts();
  parts.add(
    new SphereGeometry(0.55, 18, 12),
    (_x, y, _z, out) => { out.set(Math.abs(y) < 0.12 ? '#f6f1e7' : y > 0 ? '#ff7a2e' : '#e3602a'); },
    undefined,
    { faces: true, shade: 0 },
  );
  parts.add(new CylinderGeometry(0.07, 0.1, 0.16, 8), IRON, pose([0, 0.56, 0]), { shade: 0.05 });
  parts.add(new TorusGeometry(0.13, 0.035, 6, 14), IRON, pose([0, 0.74, 0]), { shade: 0 });
  parts.add(new CylinderGeometry(0.06, 0.06, 0.22, 8), IRON, pose([0, -0.6, 0]), { shade: 0 });
  return parts.build();
}

/** Ballon de plage (rayon 1) : six quartiers, pôles blancs. */
export function beachBallGeometry() {
  const parts = new Parts();
  const gores = ['#e2553f', '#f7f4ee', '#f2c14e', '#f7f4ee', '#2f7fd6', '#f7f4ee'];
  parts.add(
    new SphereGeometry(1, 24, 14),
    (x, y, z, out) => {
      if (Math.abs(y) > 0.86) out.set('#f7f4ee');
      else out.set(gores[Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 6) % 6]);
    },
    undefined,
    { faces: true, shade: 0 },
  );
  return parts.build();
}

/** Bouée couronne : huit secteurs rouges et blancs, filin de saisie et ses quatre brides. */
export function lifebuoyGeometry() {
  const parts = new Parts();
  parts.add(
    new TorusGeometry(0.58, 0.2, 10, 32),
    (x, y, _z, out) => { out.set(Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * 8) % 2 === 0 ? '#e1463a' : '#f7f2ea'); },
    pose([0, 0, 0], [Math.PI / 2, 0, 0]),
    { faces: true, local: true, shade: 0 },
  );
  parts.add(new TorusGeometry(0.8, 0.024, 4, 44), '#eadcb2', pose([0, 0, 0], [Math.PI / 2, 0, 0]), { shade: 0 });
  for (let k = 0; k < 4; k++) {
    const angle = (k / 4) * Math.PI * 2 + Math.PI / 8;
    parts.add(new TorusGeometry(0.215, 0.022, 4, 12), '#eadcb2', pose([Math.cos(angle) * 0.585, 0, Math.sin(angle) * 0.585], [0, -angle, 0]), { shade: 0 });
  }
  return parts.build();
}

/** Canard en plastique (regarde vers +X) coiffé d'un bachi de marin à pompon rouge. */
export function duckGeometry() {
  const parts = new Parts();
  const yellow = '#ffd23f';
  const opts = { shade: 0 };
  parts.add(new SphereGeometry(1, 22, 14), yellow, pose([0, 0.35, 0], [0, 0, 0], [1.45, 0.92, 1.05]), opts);
  parts.add(new ConeGeometry(0.42, 0.9, 12), yellow, pose([-1.15, 0.85, 0], [0, 0, 0.7]), opts);
  for (const side of [-1, 1]) {
    parts.add(new SphereGeometry(1, 14, 10), '#f7bf26', pose([-0.2, 0.62, side * 0.86], [side * -0.2, 0, -0.3], [0.72, 0.36, 0.22]), opts);
  }
  parts.add(new SphereGeometry(0.68, 18, 12), yellow, pose([0.75, 1.45, 0]), opts);
  parts.add(new SphereGeometry(0.42, 14, 10), '#ff8a1f', pose([1.38, 1.3, 0], [0, 0, -0.1], [1, 0.36, 0.8]), opts);
  for (const side of [-1, 1]) {
    parts.add(new SphereGeometry(0.11, 10, 8), '#16161c', pose([1.18, 1.68, 0.44 * side]), opts);
    parts.add(new SphereGeometry(0.035, 6, 4), '#ffffff', pose([1.25, 1.75, 0.5 * side]), opts);
    parts.add(new SphereGeometry(0.12, 8, 6), '#ffaa86', pose([1.07, 1.35, 0.57 * side], [0, 0, 0], [1, 0.6, 0.35]), opts);
  }
  // Bachi : calot bleu marine, ruban blanc, pompon rouge, deux rubans dans le dos.
  parts.add(new CylinderGeometry(0.47, 0.42, 0.17, 20), '#25335f', pose([0.66, 2.02, 0], [0, 0, 0.14]), { shade: 0.08 });
  parts.add(new CylinderGeometry(0.435, 0.435, 0.06, 20), '#f7f3ea', pose([0.672, 1.95, 0], [0, 0, 0.14]), opts);
  parts.add(new SphereGeometry(0.12, 10, 8), '#e0413a', pose([0.63, 2.16, 0]), opts);
  for (const side of [-1, 1]) {
    parts.add(new BoxGeometry(0.34, 0.04, 0.07), '#25335f', pose([0.2, 1.9, side * 0.1], [0, side * 0.35, -0.55]), { flat: true, shade: 0 });
  }
  return parts.build();
}

/** Balise lumineuse de chenal : corps à bandes, défense, voyant conique (le feu est à part). */
export function markerGeometry() {
  const parts = new Parts();
  parts.add(
    new CylinderGeometry(0.5, 0.72, 1.5, 14, 6),
    (_x, y, _z, out) => { out.set(Math.floor((y + 0.75) / 0.5) % 2 === 0 ? '#d8473a' : '#f4f0e8'); },
    pose([0, 0.45, 0]),
    { faces: true, local: true, shade: 0.06 },
  );
  parts.add(new CylinderGeometry(0.8, 0.8, 0.1, 16), IRON, pose([0, -0.22, 0]), { shade: 0.05 });
  parts.add(new ConeGeometry(0.42, 0.62, 12), '#d8473a', pose([0, 1.5, 0]), { shade: 0.05 });
  return parts.build();
}

export function markerLampGeometry() {
  return new SphereGeometry(0.15, 10, 8).translate(0, 1.93, 0);
}

/** Guirlande de fanions entre deux points (corde en chaînette, triangles colorés). */
function garland(parts: Parts, a: V3, b: V3, sag: number, seed: number) {
  const points: V3[] = [];
  const segments = 9;
  for (let k = 0; k <= segments; k++) {
    const t = k / segments;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  for (let k = 0; k < segments; k++) parts.add(new CylinderGeometry(1, 1, 1, 4), ROPE, span(points[k], points[k + 1], 0.014), { shade: 0 });
  const colors = ['#e2553f', '#f2c14e', '#2f7fd6', '#f7f2ea', '#3fa56b'];
  const yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
  for (let k = 1; k < segments; k++) {
    const p = points[k];
    parts.add(new ConeGeometry(0.11, 0.24, 3), colors[(k + seed) % colors.length], pose([p[0], p[1] - 0.12, p[2]], [Math.PI, -yaw, 0], [1, 1, 0.18]), { flat: true, shade: 0 });
  }
}

/** Radeau de rondins du chamboule-tout : pont de planches, mât à cible, fanions, cordage, seau. */
export function raftGeometry() {
  const parts = new Parts();
  const logs = ['#9b6537', '#b07544', '#8e5b31', '#a76e3d', '#966139', '#ad7445', '#9a6436'];
  for (let index = 0; index < 7; index++) {
    const length = 4.55 + hash(index * 3.7 + 1) * 0.4;
    parts.add(
      new CylinderGeometry(0.31, 0.31, length, 7, 1),
      (_x, y, _z, out) => { out.set(Math.abs(y) > length / 2 - 0.001 ? '#dcb27a' : logs[index]); },
      pose([-1.98 + index * 0.66, 0, (hash(index * 1.3 + 2) - 0.5) * 0.2], [Math.PI / 2, hash(index * 5.1 + 3) * 0.8, 0]),
      { faces: true, local: true, flat: true, shade: 0.06 },
    );
  }
  const planks = ['#c99657', '#b98548', '#d3a466'];
  for (let row = 0; row < 9; row++) {
    parts.add(
      new BoxGeometry(4.5, 0.07, 0.45),
      planks[row % 3],
      pose([(hash(row * 2.1 + 4) - 0.5) * 0.12, RAFT.deck - 0.035, -2 + row * 0.5], [0, (hash(row * 7.7 + 5) - 0.5) * 0.04, 0]),
      { flat: true, shade: 0.16 },
    );
  }
  const { mastX, mastZ, mastTop, deck } = RAFT;
  parts.add(new CylinderGeometry(0.07, 0.085, mastTop - deck, 8), '#7a4b29', pose([mastX, (deck + mastTop) / 2, mastZ]), { flat: true, shade: 0.06 });
  parts.add(new CylinderGeometry(0.16, 0.2, 0.12, 8), '#5b3a22', pose([mastX, deck + 0.06, mastZ]), { flat: true, shade: 0.1 });
  parts.add(new SphereGeometry(0.1, 10, 8), '#f2c14e', pose([mastX, mastTop + 0.06, mastZ]), { shade: 0 });
  // Cible peinte sur le mât, tournée vers la pyramide (et vers l'arrivée du bateau).
  const face = -0.75 * Math.PI;
  const target: V3 = [mastX - 0.12, 1.78, mastZ - 0.12];
  const rings: [number, number, string][] = [[0, 0.1, '#e2553f'], [0.1, 0.2, '#f7f2ea'], [0.2, 0.3, '#e2553f'], [0.3, 0.35, '#f7f2ea']];
  for (const [inner, outer, color] of rings) parts.add(new RingGeometry(inner, outer, 20, 1), color, pose(target, [0, face, 0]), { shade: 0 });
  parts.add(new RingGeometry(0, 0.38, 20, 1), '#6b4426', pose([target[0] + 0.03, target[1], target[2] + 0.03], [0, face, 0]), { shade: 0 });
  // Guirlandes de fanions du mât vers deux poteaux d'angle : l'air d'un stand de fête foraine.
  const top: V3 = [mastX, mastTop - 0.15, mastZ];
  garland(parts, top, [-2.05, 0.95, 2.05], 0.35, 0);
  garland(parts, top, [2.05, 0.95, -2.05], 0.35, 2);
  for (const [x, z] of [[-2.05, 2.05], [2.05, -2.05]]) {
    parts.add(new CylinderGeometry(0.06, 0.07, 0.62, 6), '#7a4b29', pose([x, deck + 0.29, z]), { flat: true, shade: 0.06 });
  }
  // Glène de cordage et seau rouge sur le pont.
  parts.add(new TorusGeometry(0.27, 0.065, 6, 18), '#e6d4a6', pose([-1.95, deck + 0.065, -1.95], [Math.PI / 2, 0, 0]), { shade: 0.05 });
  parts.add(new TorusGeometry(0.19, 0.06, 6, 16), '#dcc897', pose([-1.95, deck + 0.18, -1.95], [Math.PI / 2, 0, 0]), { shade: 0.05 });
  parts.add(
    new CylinderGeometry(0.2, 0.16, 0.34, 12, 1),
    (_x, y, _z, out) => { out.set(y > 0.169 ? '#6f2a1f' : '#d9533e'); },
    pose([-1.98, deck + 0.17, -0.15]),
    { faces: true, local: true, shade: 0.1 },
  );
  parts.add(new TorusGeometry(0.2, 0.018, 4, 14, Math.PI), IRON, pose([-1.98, deck + 0.34, -0.15], [0, 0.4, 0]), { shade: 0 });
  return parts.build();
}

/** Flamme du mât (pointe vers +X depuis la drisse). */
export function pennantGeometry() {
  const parts = new Parts();
  parts.add(
    new ConeGeometry(0.17, 0.95, 3),
    (_x, y, _z, out) => { out.set(y > 0.12 ? '#f7f2ea' : '#e2553f'); },
    pose([0.475, 0, 0], [0, 0, -Math.PI / 2], [1, 1, 0.12]),
    { faces: true, local: true, flat: true, shade: 0 },
  );
  return parts.build();
}

/** Étoile d'impact (huit branches inégales), cœur doré, pointes blanches. */
export function starGeometry() {
  const branches = 16;
  const positions = new Float32Array(branches * 9);
  const colors = new Float32Array(branches * 9);
  const core = new Color('#fff1a8');
  const tip = new Color('#ffffff');
  const radius = (index: number) => (index % 2 === 1 ? 0.24 : index % 4 === 0 ? 1 : 0.6);
  for (let k = 0; k < branches; k++) {
    const a0 = (k / branches) * Math.PI * 2;
    const a1 = ((k + 1) / branches) * Math.PI * 2;
    const r0 = radius(k);
    const r1 = radius(k + 1);
    positions.set([0, 0, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0], k * 9);
    core.toArray(colors, k * 9);
    tip.toArray(colors, k * 9 + 3);
    tip.toArray(colors, k * 9 + 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

interface ToyMaterials {
  wood: MeshStandardMaterial;
  plastic: MeshStandardMaterial;
  paint: MeshStandardMaterial;
  raft: MeshStandardMaterial;
  net: MeshBasicMaterial;
  lamp: MeshStandardMaterial;
}

let materials: ToyMaterials | null = null;

/** Matériaux partagés (créés une fois) : le feu des balises est animé à la nuit. */
export function toyMaterials(): ToyMaterials {
  if (!materials) {
    materials = {
      wood: new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      plastic: new MeshStandardMaterial({ vertexColors: true, roughness: 0.48 }),
      paint: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
      raft: new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: DoubleSide }),
      net: new MeshBasicMaterial({ color: '#2b2420', wireframe: true }),
      lamp: new MeshStandardMaterial({ color: '#fff3d6', emissive: new Color('#ffd38a'), emissiveIntensity: 0.3, roughness: 0.3 }),
    };
  }
  return materials;
}
