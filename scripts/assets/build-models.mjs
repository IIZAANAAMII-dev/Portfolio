#!/usr/bin/env node
/**
 * Pipeline des modèles Substance 3D (collection Bell Island + bateau de pêche).
 *
 *   assets-src/substance/models/*.fbx|*.glb  ──►  public/models/bell-island/<nom>.glb
 *
 * Étapes, dans l'ordre :
 *  1. FBX → glTF (FBX2glTF), ou lecture directe des .glb
 *  2. nettoyage : extensions obsolètes (KHR_materials_pbrSpecularGlossiness), couleurs de
 *     sommets (masques d'ID Substance, inutiles et nuisibles dans three.js)
 *  3. transforms « cuites » dans les sommets : tout le modèle est exprimé en mètres, Y-up,
 *     sans hiérarchie ; correction d'unité éventuelle (`scale`)
 *  4. pivot : centré en X/Z et posé sur Y = 0 (ou chaque pièce séparément en mode `split`)
 *  5. soudure + simplification meshoptimizer vers le budget de triangles
 *  6. fusion des primitives par matériau (un draw call par matériau), sauf nœuds `keep`
 *  7. densité UV mesurée et écrite dans les extras de chaque matériau (`uvDensity`, en
 *     unités UV par mètre) : l'application en déduit la répétition exacte des matériaux
 *     tuilables Substance, à l'échelle réelle
 *  8. quantification + compression EXT_meshopt_compression
 *
 * Usage : npm run assets:models            (tous les modèles)
 *         npm run assets:models -- cymbal  (un ou plusieurs modèles)
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  dedup,
  getBounds,
  join,
  prune,
  quantize,
  reorder,
  simplify,
  transformMesh,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { MODELS } from './models.config.mjs';

const require = createRequire(import.meta.url);
const convertFbx = require('fbx2gltf');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_DIR = path.join(ROOT, 'assets-src/substance/models');
const OUT_DIR = path.join(ROOT, 'public/models/bell-island');

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function triangleCount(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      count += (indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return Math.round(count);
}

function translation(x, y, z) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

function scaling(s) {
  return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
}

/** Bornes d'un mesh, positions lues telles quelles (déjà en espace monde après cuisson). */
function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const v = [0, 0, 0];
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute('POSITION');
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v);
      for (let k = 0; k < 3; k++) {
        if (v[k] < min[k]) min[k] = v[k];
        if (v[k] > max[k]) max[k] = v[k];
      }
    }
  }
  return { min, max };
}

/** Toutes les transforms de nœuds sont appliquées aux sommets ; la scène devient plate. */
function bakeTransforms(document, extraScale) {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const meshNodes = [];
  scene.traverse((node) => {
    if (node.getMesh()) meshNodes.push(node);
  });
  const correction = scaling(extraScale);
  for (const node of meshNodes) {
    const world = node.getWorldMatrix();
    // world * correction appliqué dans l'ordre : d'abord la transform du nœud, puis l'échelle.
    const matrix = multiply(correction, world);
    let mesh = node.getMesh();
    const users = mesh.listParents().filter((parent) => parent !== root);
    if (users.length > 1) {
      mesh = mesh.clone();
      node.setMesh(mesh);
    }
    transformMesh(mesh, matrix);
    const parent = node.getParentNode();
    if (parent) parent.removeChild(node);
    else scene.removeChild(node);
    node.setMatrix(IDENTITY);
    scene.addChild(node);
  }
}

function multiply(a, b) {
  // Matrices column-major (convention glTF / gl-matrix).
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** Densité UV moyenne (unités UV par mètre), pondérée par l'aire. */
function uvDensity(document) {
  let worldArea = 0;
  let uvArea = 0;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  const ua = [0, 0];
  const ub = [0, 0];
  const uc = [0, 0];
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const uv = prim.getAttribute('TEXCOORD_0');
      const indices = prim.getIndices();
      if (!uv || !indices) continue;
      for (let i = 0; i < indices.getCount(); i += 3) {
        const i0 = indices.getScalar(i);
        const i1 = indices.getScalar(i + 1);
        const i2 = indices.getScalar(i + 2);
        position.getElement(i0, a);
        position.getElement(i1, b);
        position.getElement(i2, c);
        uv.getElement(i0, ua);
        uv.getElement(i1, ub);
        uv.getElement(i2, uc);
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cross = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        worldArea += Math.hypot(cross[0], cross[1], cross[2]) / 2;
        uvArea += Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
      }
    }
  }
  return worldArea > 0 ? Math.sqrt(uvArea / worldArea) : 0;
}

async function loadSource(io, file, workDir) {
  const src = path.join(SRC_DIR, file);
  if (!existsSync(src)) throw new Error(`source introuvable : ${src}`);
  if (file.toLowerCase().endsWith('.glb')) return io.read(src);
  const converted = path.join(workDir, `${path.basename(file, path.extname(file))}.glb`);
  await convertFbx(src, converted, []);
  return io.read(converted);
}

async function buildModel(io, name, config, workDir) {
  const document = await loadSource(io, config.src, workDir);
  const root = document.getRoot();
  const sourceTris = triangleCount(document);

  // 2. Nettoyage.
  for (const extension of root.listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_materials_pbrSpecularGlossiness') extension.dispose();
  }
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (semantic.startsWith('COLOR_') || semantic === 'TANGENT' || semantic.startsWith('TEXCOORD_') && semantic !== 'TEXCOORD_0') {
          prim.setAttribute(semantic, null);
        }
      }
    }
  }
  // Matériaux neutres : l'application les remplace par la bibliothèque Substance.
  for (const material of root.listMaterials()) {
    material
      .setBaseColorFactor([0.78, 0.76, 0.72, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(0.88)
      .setEmissiveFactor([0, 0, 0])
      // Le nom du slot dans les extras empêche dedup() de fusionner des matériaux devenus
      // identiques : c'est ce nom que l'application utilise pour choisir le matériau Substance.
      .setExtras({ slot: material.getName() });
  }

  // 3. Transforms cuites.
  bakeTransforms(document, config.scale ?? 1);
  await document.transform(prune({ keepLeaves: false, keepAttributes: true }), dedup());

  // 4. Pivot.
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (config.split) {
    for (const node of scene.listChildren()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const { min, max } = meshBounds(mesh);
      const cx = (min[0] + max[0]) / 2;
      const cz = (min[2] + max[2]) / 2;
      transformMesh(mesh, translation(-cx, -min[1], -cz));
      node.setExtras({ placement: [cx, min[1], cz], size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] });
    }
  } else if (config.pivot !== 'none') {
    const { min, max } = getBounds(scene);
    const offset = translation(-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2);
    for (const mesh of root.listMeshes()) transformMesh(mesh, offset);
  }

  // 5. Simplification.
  await MeshoptSimplifier.ready;
  const welded = triangleCount(document);
  const ratio = Math.min(1, Math.max(0.02, config.tris / Math.max(welded, 1)));
  await document.transform(weld());
  if (ratio < 0.98) {
    await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: config.error ?? 0.0015 }));
  }

  // 6. Un draw call par matériau, sauf les pièces animées ou autonomes.
  const keep = new Set(config.keep ?? []);
  if (!config.split) {
    await document.transform(join({ keepNamed: false, filter: (node) => !keep.has(node.getName()) }));
  }
  await document.transform(prune({ keepLeaves: false, keepAttributes: true }), dedup());

  // 7. Densité UV et dimensions, lues par l'application via userData.
  const density = uvDensity(document);
  const bounds = getBounds(scene);
  const size = [0, 1, 2].map((k) => +(bounds.max[k] - bounds.min[k]).toFixed(3));
  for (const material of root.listMaterials()) {
    material.setExtras({ slot: material.getName(), uvDensity: +density.toFixed(5) });
  }
  scene.setExtras({ uvDensity: +density.toFixed(5), size, source: config.src });
  scene.setName(name);

  // 8. Compression.
  await document.transform(
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ quantizationVolume: 'mesh', quantizeNormal: 10, quantizeTexcoord: 14 }),
  );
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!prim.getAttribute('TEXCOORD_0')) throw new Error(`${name} : UV perdues sur ${mesh.getName()}`);
    }
  }

  const out = path.join(OUT_DIR, `${name}.glb`);
  await io.write(out, document);
  const finalTris = triangleCount(document);
  const nodes = scene.listChildren().map((node) => node.getName()).filter(Boolean);
  return {
    name,
    sourceTris,
    finalTris,
    kb: Math.round(statSync(out).size / 1024),
    density: +density.toFixed(4),
    size,
    materials: root.listMaterials().map((m) => m.getName()),
    nodes: nodes.length > 8 ? `${nodes.length} nœuds` : nodes.join(', '),
  };
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  mkdirSync(OUT_DIR, { recursive: true });
  const workDir = mkdtempSync(path.join(tmpdir(), 'substance-models-'));
  const only = process.argv.slice(2);
  const names = Object.keys(MODELS).filter((name) => only.length === 0 || only.includes(name));
  const reports = [];
  try {
    for (const name of names) {
      const report = await buildModel(io, name, MODELS[name], workDir);
      reports.push(report);
      console.log(
        `${name.padEnd(17)} ${String(report.sourceTris).padStart(7)} → ${String(report.finalTris).padStart(6)} tris`
          + `  ${String(report.kb).padStart(5)} Ko  uv/m=${report.density}  taille=${report.size.join('×')} m`
          + `\n${''.padEnd(18)}matériaux: ${report.materials.join(', ')}${report.nodes ? `\n${''.padEnd(18)}nœuds: ${report.nodes}` : ''}`,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  const total = reports.reduce((sum, r) => sum + r.kb, 0);
  console.log(`\n${reports.length} modèles, ${total} Ko au total.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
