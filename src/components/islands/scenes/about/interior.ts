import { CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import { hash } from '@/lib/utils/math';
import { hullGeometry, type HullOptions } from './hull';
import { Mesher, pose, type Vec3 } from './mesher';

/**
 * L'intérieur de l'atelier de Kyliann (repère de la maison : façade vers +Z, sol en y = 0).
 * Un bureau de développeur dans une maison de pêcheur : plancher, murs chaulés, cheminée
 * de granit, bureau et ses deux écrans, lampe, tasse, plante, bibliothèque colorée,
 * tableau de liège des projets, maquette de sinagot sur l'étagère, tapis rayé comme une
 * marinière. Les meubles sont un peu surdimensionnés : on les regarde de loin.
 */

export interface InteriorLayout {
  /** Demi-largeur et demi-profondeur intérieures. */
  halfWidth: number;
  halfDepth: number;
  wall: number;
}

const WOOD = ['#a8774c', '#b98a5c', '#9a6b43'];
const LIME = '#efe5d2';
const BOOKS = ['#d8433b', '#3f6fb0', '#f2c14e', '#3c8a6e', '#e8668c', '#f28c38', '#7f5fc4', '#f4f0e7', '#2f3b52', '#5fb3b3'];

/** Écrans, tableau, lampe : à poser à part (textures, émissifs). */
export interface InteriorAnchors {
  mainScreen: { position: Vec3; rotation: Vec3; size: [number, number] };
  sideScreen: { position: Vec3; rotation: Vec3; size: [number, number] };
  cork: { position: Vec3; size: [number, number] };
  bulb: Vec3;
  mugSteam: Vec3;
  embers: Vec3;
  glow: Vec3;
}

const MODEL_HULL: HullOptions = {
  length: 0.62,
  beam: 0.22,
  freeboard: 0.06,
  draft: 0.07,
  transom: 0.55,
  sheer: 0.03,
  bottom: '#6e2f25',
  topside: '#1e2026',
  strake: '#e9e4d8',
  inside: '#9b7653',
};

export function buildInterior({ halfWidth, halfDepth, wall }: InteriorLayout) {
  const paint = new Mesher(true, false);
  const glowing = new Mesher(true, false);
  const back = -halfDepth;

  // --- Plancher de planches, murs chaulés (fond et pignons).
  const planks = 12;
  const plankWidth = (halfWidth * 2) / planks;
  for (let index = 0; index < planks; index++) {
    paint.box([plankWidth - 0.015, 0.06, halfDepth * 2], [-halfWidth + plankWidth * (index + 0.5), 0.03, 0], [0, 0, 0], WOOD[index % 3]);
  }
  paint.box([halfWidth * 2, wall, 0.03], [0, wall / 2, back + 0.015], [0, 0, 0], LIME);
  for (const side of [-1, 1]) paint.box([0.03, wall, halfDepth * 2], [side * (halfWidth - 0.015), wall / 2, 0], [0, 0, 0], LIME);
  // Poutre maîtresse en chêne sous le faîtage, de pignon à pignon.
  paint.box([halfWidth * 2, 0.2, 0.22], [0, wall + 0.05, back + 0.4], [0, 0, 0], '#6e4a33');

  // --- Cheminée de granit sur le pignon gauche, feu de bois.
  const hearthX = -halfWidth + 0.2;
  for (const dz of [-0.62, 0.62]) paint.box([0.36, 1.15, 0.2], [hearthX, 0.6, dz], [0, 0, 0], '#cfc7b8');
  paint.box([0.5, 0.18, 1.5], [hearthX + 0.05, 1.22, 0], [0, 0, 0], '#d8d1c3');
  paint.box([0.04, 0.95, 1.04], [-halfWidth + 0.04, 0.55, 0], [0, 0, 0], '#2a2224');
  paint.box([0.7, 0.06, 1.6], [hearthX + 0.15, 0.07, 0], [0, 0, 0], '#b9b1a3');
  for (const dz of [-0.16, 0.12]) paint.rod([hearthX - 0.05, 0.16, dz - 0.25], [hearthX - 0.02, 0.2, dz + 0.25], 0.07, '#6b4a32', 6);
  const embers: Vec3 = [hearthX - 0.02, 0.24, 0];
  const ember = new IcosahedronGeometry(1, 0);
  for (let index = 0; index < 5; index++) {
    glowing.add(ember, pose([embers[0] + (hash(index) - 0.5) * 0.1, 0.22 + hash(index * 2) * 0.06, (hash(index * 3) - 0.5) * 0.5], [index, index, 0], 0.06 + hash(index * 5) * 0.03), '#ff7a2e');
  }
  // Un vieux filet et sa boule de verre accrochés au-dessus du manteau.
  paint.box([0.03, 0.55, 0.9], [-halfWidth + 0.06, 1.75, 0.1], [0.08, 0, 0], '#4f8a86');
  paint.add(new SphereGeometry(0.11, 10, 8), pose([-halfWidth + 0.13, 1.6, 0.4]), '#5fb3c4');

  // --- Bureau contre le mur du fond.
  const deskX = 0.7;
  const deskZ = back + 0.48;
  const deskTop = 0.8;
  paint.box([2.2, 0.07, 0.8], [deskX, deskTop, deskZ], [0, 0, 0], '#b98a5c');
  for (const [dx, dz] of [[-1.03, -0.33], [-1.03, 0.33], [1.03, -0.33], [1.03, 0.33]]) {
    paint.box([0.07, deskTop, 0.07], [deskX + dx, deskTop / 2, deskZ + dz], [0, 0, 0], '#8a5d3b');
  }
  paint.box([0.5, 0.55, 0.7], [deskX + 0.78, deskTop - 0.31, deskZ], [0, 0, 0], '#a8774c');
  // Écran principal, second écran incliné.
  const mainCenter: Vec3 = [deskX - 0.15, deskTop + 0.52, back + 0.22];
  paint.box([1.12, 0.68, 0.06], mainCenter, [0, 0, 0], '#23262d');
  paint.box([0.08, 0.36, 0.06], [mainCenter[0], deskTop + 0.18, back + 0.2], [0, 0, 0], '#30343c');
  paint.box([0.42, 0.03, 0.24], [mainCenter[0], deskTop + 0.05, back + 0.26], [0, 0, 0], '#30343c');
  const sideAngle = -0.45;
  const sideCenter: Vec3 = [deskX + 0.82, deskTop + 0.44, back + 0.38];
  paint.box([0.74, 0.5, 0.05], sideCenter, [0, sideAngle, 0], '#23262d');
  paint.box([0.07, 0.3, 0.05], [sideCenter[0] + 0.03, deskTop + 0.16, sideCenter[2] - 0.03], [0, sideAngle, 0], '#30343c');
  // Clavier, souris, tasse, carnet.
  paint.box([0.7, 0.035, 0.22], [deskX - 0.15, deskTop + 0.05, deskZ + 0.18], [0, 0, 0], '#2b2f38');
  paint.box([0.64, 0.012, 0.17], [deskX - 0.15, deskTop + 0.072, deskZ + 0.18], [0, 0, 0], '#d6dce4');
  paint.box([0.08, 0.04, 0.12], [deskX + 0.35, deskTop + 0.055, deskZ + 0.2], [0, 0, 0], '#e9edf2');
  const mug: Vec3 = [deskX - 0.75, deskTop + 0.04, deskZ + 0.15];
  paint.add(new CylinderGeometry(0.075, 0.065, 0.15, 12), pose([mug[0], mug[1] + 0.075, mug[2]]), '#f4efe6');
  paint.add(new CylinderGeometry(0.066, 0.066, 0.01, 12), pose([mug[0], mug[1] + 0.14, mug[2]]), '#4a2c1e');
  const handle = new TorusGeometry(0.045, 0.014, 5, 10);
  paint.add(handle, pose([mug[0] + 0.085, mug[1] + 0.08, mug[2]]), '#f4efe6');
  handle.dispose();
  paint.box([0.3, 0.03, 0.22], [deskX + 0.62, deskTop + 0.05, deskZ + 0.18], [0, 0.3, 0], '#e2553f');
  paint.box([0.28, 0.035, 0.2], [deskX + 0.62, deskTop + 0.07, deskZ + 0.18], [0, 0.3, 0], '#fbf6ea');
  // Lampe d'architecte : socle, bras articulé, abat-jour.
  const lampBase: Vec3 = [deskX - 0.95, deskTop + 0.04, back + 0.25];
  const elbow: Vec3 = [lampBase[0] + 0.08, deskTop + 0.55, back + 0.32];
  const head: Vec3 = [lampBase[0] + 0.32, deskTop + 0.72, back + 0.5];
  paint.add(new CylinderGeometry(0.11, 0.12, 0.04, 12), pose(lampBase), '#2f6f5f');
  paint.rod(lampBase, elbow, 0.018, '#2f6f5f', 5);
  paint.rod(elbow, head, 0.018, '#2f6f5f', 5);
  paint.add(new CylinderGeometry(0.06, 0.16, 0.2, 12, 1, true), pose([head[0] + 0.03, head[1] - 0.04, head[2] + 0.03], [0.5, 0, -0.4]), '#2f6f5f');
  const bulb: Vec3 = [head[0] + 0.07, head[1] - 0.12, head[2] + 0.08];
  glowing.add(new SphereGeometry(0.07, 10, 8), pose(bulb), '#fff1c4');
  // Chaise de bureau : assise rouge, dossier, pied et roulettes.
  const chair: Vec3 = [deskX - 0.15, 0, deskZ + 0.85];
  paint.box([0.56, 0.1, 0.52], [chair[0], 0.5, chair[2]], [0, 0.15, 0], '#c8463a');
  paint.box([0.54, 0.62, 0.09], [chair[0] + 0.04, 0.9, chair[2] + 0.27], [-0.12, 0.15, 0], '#c8463a');
  paint.rod([chair[0], 0.08, chair[2]], [chair[0], 0.48, chair[2]], 0.035, '#30343c', 6);
  for (let leg = 0; leg < 5; leg++) {
    const angle = (leg / 5) * Math.PI * 2;
    paint.rod([chair[0], 0.08, chair[2]], [chair[0] + Math.cos(angle) * 0.3, 0.05, chair[2] + Math.sin(angle) * 0.3], 0.025, '#30343c', 4);
  }

  // --- Bibliothèque à gauche du bureau, livres de toutes les couleurs.
  const shelfX = -halfWidth + 1.25;
  const shelfZ = back + 0.2;
  const shelfWidth = 1.05;
  for (const dx of [-shelfWidth / 2, shelfWidth / 2]) paint.box([0.06, 2.0, 0.36], [shelfX + dx, 1.0, shelfZ], [0, 0, 0], '#8a5d3b');
  const levels = [0.08, 0.56, 1.04, 1.52, 1.98];
  for (const y of levels) paint.box([shelfWidth, 0.05, 0.34], [shelfX, y, shelfZ], [0, 0, 0], '#8a5d3b');
  levels.slice(0, 4).forEach((y, level) => {
    let x = shelfX - shelfWidth / 2 + 0.06;
    let book = 0;
    while (x < shelfX + shelfWidth / 2 - 0.1) {
      const key = level * 31 + book * 7.7;
      const thickness = 0.05 + hash(key) * 0.05;
      const height = 0.27 + hash(key + 1.3) * 0.14;
      const lean = book % 9 === 8 ? 0.28 : 0;
      paint.box(
        [thickness, height, 0.24 + hash(key + 2.1) * 0.06],
        [x + thickness / 2 + lean * 0.12, y + 0.025 + height / 2, shelfZ + 0.02],
        [0, 0, -lean],
        BOOKS[Math.floor(hash(key + 4.4) * BOOKS.length)],
      );
      x += thickness + 0.008 + lean * 0.25;
      book += 1;
    }
  });

  // --- Étagère du pignon droit : la maquette du sinagot (clin d'œil à la famille).
  const ledgeX = halfWidth - 0.16;
  paint.box([0.3, 0.05, 1.3], [ledgeX, 1.55, -0.15], [0, 0, 0], '#8a5d3b');
  for (const dz of [-0.6, 0.3]) paint.box([0.22, 0.14, 0.04], [ledgeX + 0.03, 1.47, dz], [0, 0, 0], '#6e4a33');
  const model = hullGeometry(MODEL_HULL);
  paint.add(model, pose([ledgeX - 0.02, 1.64, -0.25], [0, Math.PI / 2, 0]), '#ffffff');
  model.dispose();
  for (const [dx, height, color] of [[0.12, 0.42, '#bf5f36'], [-0.1, 0.5, '#bf5f36']] as const) {
    paint.rod([ledgeX - 0.02, 1.66, -0.25 - dx], [ledgeX - 0.02, 1.66 + height, -0.25 - dx], 0.006, '#6b4a32', 4);
    paint.box([0.01, height * 0.72, 0.2], [ledgeX - 0.02, 1.72 + height * 0.38, -0.25 - dx + 0.08], [0.18, 0, 0], color);
  }
  paint.add(new SphereGeometry(0.08, 10, 8), pose([ledgeX - 0.02, 1.66, 0.3]), '#7fc4c9');
  paint.box([0.18, 0.24, 0.05], [ledgeX - 0.02, 1.7, 0.08], [0, 0.2, 0.1], '#f2c14e');

  // --- Grande plante en pot dans l'angle, tapis rayé façon marinière.
  const plant: Vec3 = [halfWidth - 0.45, 0, halfDepth - 0.5];
  paint.add(new CylinderGeometry(0.2, 0.15, 0.36, 12), pose([plant[0], 0.18, plant[2]]), '#c26a48');
  const leaf = new IcosahedronGeometry(1, 1);
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.4;
    const lift = 0.5 + hash(index * 1.7) * 0.6;
    paint.add(leaf, pose([plant[0] + Math.cos(angle) * 0.2, lift, plant[2] + Math.sin(angle) * 0.2], [angle, angle * 0.5, 0.6], [0.22, 0.05, 0.13]), index % 2 ? '#3f8a4f' : '#5aa35a');
  }
  leaf.dispose();
  const stripes = 9;
  for (let index = 0; index < stripes; index++) {
    paint.box([2.0, 0.012, 1.3 / stripes], [deskX - 0.25, 0.065, deskZ + 1.05 - 0.65 + (1.3 / stripes) * (index + 0.5)], [0, 0, 0], index % 2 ? '#f4f0e7' : '#2f4a7a');
  }

  const anchors: InteriorAnchors = {
    mainScreen: { position: [mainCenter[0], mainCenter[1], mainCenter[2] + 0.032], rotation: [0, 0, 0], size: [1.02, 0.58] },
    sideScreen: {
      position: [sideCenter[0] + Math.sin(sideAngle) * 0.028, sideCenter[1], sideCenter[2] + Math.cos(sideAngle) * 0.028],
      rotation: [0, sideAngle, 0],
      size: [0.66, 0.43],
    },
    cork: { position: [deskX + 0.55, 2.05, back + 0.04], size: [1.3, 0.81] },
    bulb,
    mugSteam: [mug[0], mug[1] + 0.2, mug[2]],
    embers,
    glow: [deskX - 0.2, 0.075, deskZ + 0.7],
  };
  return { paint: paint.build()!, glowing: glowing.build()!, anchors };
}
