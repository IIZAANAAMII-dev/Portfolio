#!/usr/bin/env node
/**
 * Textures des matériaux Substance (collection Bell Island).
 *
 *   public/textures/substance/<id>/basecolor.webp   couleur (sRGB) — alpha = opacité si besoin
 *   public/textures/substance/<id>/normal.webp      normales OpenGL
 *   public/textures/substance/<id>/orm.webp         occlusion (R), rugosité (G), métal (B)
 *
 * Deux sources possibles, par ordre de priorité :
 *  1. un export Substance (Sampler, Designer…) déposé dans assets-src/substance/textures/<id>/
 *     — les noms de fichiers usuels sont reconnus (basecolor, normal, roughness, ao, height…)
 *  2. le générateur procédural du projet (scripts/assets/textures/), qui reproduit le style
 *     de chaque matériau à partir de sa palette (src/lib/materials/substances.json)
 *
 * Le script régénère src/lib/materials/generated-textures.ts : l'application sait ainsi,
 * sans requête réseau, quels matériaux ont des cartes.
 *
 * Usage : npm run assets:textures            (tous les matériaux de la recette)
 *         npm run assets:textures -- wood_beam
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { normalMap } from './textures/image.mjs';
import { grass, iron, plaster, sand, stone, wood } from './textures/generators.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOGUE = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/materials/substances.json'), 'utf8'));
const EXPORTS = path.join(ROOT, 'assets-src/substance/textures');
const OUT = path.join(ROOT, 'public/textures/substance');
const MANIFEST = path.join(ROOT, 'src/lib/materials/generated-textures.ts');

const GENERATORS = { wood, stone, grass, sand, plaster, iron };

/**
 * Recettes : générateur, taille de sortie et réglages. Seuls les matériaux réellement
 * utilisés par la scène sont produits (voir src/lib/materials/model-materials.ts).
 */
const RECIPES = {
  ocean_spray_swept_wood: { generator: 'wood', out: 1024, options: { rows: 7, splits: 1, lines: 4, weathering: 0.45, cracks: 0.45, secondary: { color: '#6b4a2e', chance: 0.35, amount: 0.3 }, seed: 6 } },
  wood_flooring: { generator: 'wood', out: 1024, options: { rows: 5, splits: 2, lines: 4, carve: 0.1, knots: 3, secondary: { color: '#4e6d6e', chance: 0.3, amount: 0.4 }, seed: 2 } },
  ocean_spray_swept_wood_planks: { generator: 'wood', out: 1024, options: { rows: 6, splits: 2, lines: 5, weathering: 0.6, cracks: 0.55, seed: 4 } },
  wood_barrier: { generator: 'wood', out: 512, options: { rows: 4, splits: 2, lines: 3, carve: 0.14, knots: 4, seed: 8 } },
  wood_beam: { generator: 'wood', out: 512, options: { seams: false, rows: 2, lines: 7, carve: 0.12, knots: 2, seed: 10 } },
  driftwood: { generator: 'wood', out: 512, options: { seams: false, rows: 3, lines: 6, carve: 0.16, cracks: 0.8, weathering: 0.8, seed: 12 } },
  island_cliff: { generator: 'stone', out: 512, options: { cellsX: 3, cellsY: 10, top: '#c49a82', topAmount: 0.7, seed: 3 } },
  mossy_island_cliff: { generator: 'stone', out: 512, options: { cellsX: 3, cellsY: 9, top: '#a77655', moss: '#5f7a35', mossAmount: 0.85, seed: 5 } },
  blocky_stone_cliff: { generator: 'stone', out: 512, options: { cellsX: 3, cellsY: 6, bevel: 0.12, top: '#b3a796', seed: 7 } },
  coast_cliff_rock_overgrown: { generator: 'stone', out: 512, options: { cellsX: 5, cellsY: 7, top: '#a88c86', moss: '#6e3427', mossAmount: 0.45, barnacles: 0.6, seed: 9 } },
  barnacle_covered_rock: { generator: 'stone', out: 512, options: { cellsX: 6, cellsY: 6, top: '#76808f', barnacles: 1, seed: 11 } },
  earth_and_grass: { generator: 'grass', out: 512, options: { dirt: '#5b4e3f', dirtAmount: 0.9, pebbles: 0.25, seed: 13 } },
  wild_grass: { generator: 'grass', out: 512, options: { seed: 15 } },
  fine_sand_beach: { generator: 'sand', out: 512, options: { ripples: 0.7, pebbles: 0.05, seed: 17 } },
  mossy_brick_wall: { generator: 'plaster', out: 512, options: { brick: '#bf5f44', seed: 19 } },
  iron_steam_pipe: { generator: 'iron', out: 512, options: { rustAmount: 0.28, rust: '#7a5236', seed: 21 } },
};

/* ------------------------------------------------------------------------------------ */
/* Exports Substance                                                                     */
/* ------------------------------------------------------------------------------------ */

const CHANNELS = {
  basecolor: /(base[_ -]?colou?r|albedo|diffuse|color)\b/i,
  normal: /normal/i,
  roughness: /rough/i,
  ao: /(ambient[_ -]?occlusion|\bao\b|occlusion)/i,
  metallic: /metal/i,
  opacity: /(opacity|alpha|transparen)/i,
  height: /(height|displace)/i,
};

function findExport(id) {
  const dir = path.join(EXPORTS, id);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((name) => /\.(png|jpe?g|tga|tiff?|webp)$/i.test(name));
  const found = {};
  for (const [channel, pattern] of Object.entries(CHANNELS)) {
    const match = files.find((name) => pattern.test(name) && !(channel === 'basecolor' && CHANNELS.normal.test(name)));
    if (match) found[channel] = path.join(dir, match);
  }
  return found.basecolor || found.normal ? found : null;
}

async function grey(file, size) {
  if (!file) return null;
  return sharp(file).resize(size, size, { fit: 'fill' }).greyscale().raw().toBuffer();
}

async function fromExport(id, files, size) {
  const color = await sharp(files.basecolor).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const opacity = await grey(files.opacity, size);
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = color[i * 3];
    rgba[i * 4 + 1] = color[i * 3 + 1];
    rgba[i * 4 + 2] = color[i * 3 + 2];
    rgba[i * 4 + 3] = opacity ? opacity[i] : 255;
  }
  const normal = files.normal
    ? await sharp(files.normal).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    : null;
  // Substance exporte en DirectX par défaut (vert inversé) : la carte de hauteur permet de
  // le détecter. En OpenGL, le vert suit l'opposé de la pente verticale de la hauteur.
  let convention = 'OpenGL (supposé)';
  if (normal && files.height) {
    const height = await grey(files.height, size);
    let correlation = 0;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 0; x < size; x++) {
        const slope = height[(y - 1) * size + x] - height[(y + 1) * size + x];
        correlation += (normal[(y * size + x) * 3 + 1] - 128) * -slope;
      }
    }
    if (correlation < 0) {
      for (let i = 0; i < size * size; i++) normal[i * 3 + 1] = 255 - normal[i * 3 + 1];
      convention = 'DirectX → retourné';
    } else {
      convention = 'OpenGL';
    }
  }
  const [ao, rough, metal] = await Promise.all([grey(files.ao, size), grey(files.roughness, size), grey(files.metallic, size)]);
  const orm = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    orm[i * 3] = ao ? ao[i] : 255;
    orm[i * 3 + 1] = rough ? rough[i] : Math.round(CATALOGUE[id].roughness * 255);
    orm[i * 3 + 2] = metal ? metal[i] : 0;
  }
  return { rgba, alpha: Boolean(opacity), normal, orm, source: `export Substance, normales ${convention}` };
}

/* ------------------------------------------------------------------------------------ */
/* Génération                                                                            */
/* ------------------------------------------------------------------------------------ */

async function generate(id, recipe) {
  const out = recipe.out;
  const genSize = Math.min(1024, out * 2);
  const result = GENERATORS[recipe.generator](genSize, CATALOGUE[id], recipe.options);
  const normalRaw = normalMap(result.height, genSize, result.normalStrength);
  const orm = Buffer.alloc(genSize * genSize * 3);
  for (let i = 0; i < genSize * genSize; i++) {
    orm[i * 3] = Math.round(result.ao[i] * 255);
    orm[i * 3 + 1] = Math.round(result.roughness[i] * 255);
    orm[i * 3 + 2] = result.metallic ? Math.round(result.metallic[i] * 255) : 0;
  }
  const resize = (buffer, channels) =>
    sharp(Buffer.from(buffer), { raw: { width: genSize, height: genSize, channels } })
      .resize(out, out, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();
  const color = await resize(result.color, 3);
  const rgba = Buffer.alloc(out * out * 4);
  for (let i = 0; i < out * out; i++) {
    rgba[i * 4] = color[i * 3];
    rgba[i * 4 + 1] = color[i * 3 + 1];
    rgba[i * 4 + 2] = color[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return {
    rgba,
    alpha: false,
    normal: await resize(normalRaw, 3),
    orm: await resize(orm, 3),
    heightPreview: result.height,
    source: 'procédural',
  };
}

async function writeWebp(file, buffer, size, channels, quality) {
  await sharp(buffer, { raw: { width: size, height: size, channels } })
    .webp({ quality, alphaQuality: 90, effort: 5 })
    .toFile(file);
}

async function bake(id, recipe) {
  const size = recipe.out;
  const exported = findExport(id);
  if (!exported && !recipe.generator) throw new Error(`${id} : ni export Substance ni recette procédurale`);
  const maps = exported ? await fromExport(id, exported, size) : await generate(id, recipe);
  const dir = path.join(OUT, id);
  mkdirSync(dir, { recursive: true });
  await writeWebp(path.join(dir, 'basecolor.webp'), maps.alpha ? maps.rgba : stripAlpha(maps.rgba, size), size, maps.alpha ? 4 : 3, 86);
  if (maps.normal) await writeWebp(path.join(dir, 'normal.webp'), maps.normal, size, 3, 90);
  await writeWebp(path.join(dir, 'orm.webp'), maps.orm, size, 3, 86);
  const hash = createHash('sha1').update(maps.rgba).update(maps.normal ?? '').update(maps.orm).digest('hex').slice(0, 8);
  return { size, basecolor: true, normal: Boolean(maps.normal), orm: true, alpha: maps.alpha, version: hash, source: maps.source };
}

function stripAlpha(rgba, size) {
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
  }
  return rgb;
}

function readManifest() {
  if (!existsSync(MANIFEST)) return {};
  const match = readFileSync(MANIFEST, 'utf8').match(/SUBSTANCE_TEXTURES[^=]*= (\{[\s\S]*\});/);
  try {
    return match ? JSON.parse(match[1]) : {};
  } catch {
    return {};
  }
}

function writeManifest(entries) {
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((key) => [key, entries[key]]));
  const body = `// Généré par scripts/assets/bake-textures.mjs — ne pas modifier à la main.
// Liste les matériaux Substance dont les cartes existent dans public/textures/substance/<id>/.
// Un matériau absent est rendu par son repli procédural (voir substance-material.ts).
import type { SubstanceId } from './substances';

export interface SubstanceTextureSet {
  /** Côté des textures, en pixels. */
  size: number;
  basecolor: boolean;
  normal: boolean;
  /** Occlusion (R), rugosité (G), métal (B) — convention glTF. */
  orm: boolean;
  /** L'alpha de basecolor porte l'opacité du .sbsar. */
  alpha: boolean;
  /** Empreinte du contenu, pour invalider le cache navigateur. */
  version: string;
}

export const SUBSTANCE_TEXTURES: Partial<Record<SubstanceId, SubstanceTextureSet>> = ${JSON.stringify(sorted, null, 2)};
`;
  writeFileSync(MANIFEST, body);
}

async function main() {
  const only = process.argv.slice(2);
  const exported = existsSync(EXPORTS) ? readdirSync(EXPORTS).filter((id) => id in CATALOGUE) : [];
  const ids = [...new Set([...Object.keys(RECIPES), ...exported])].filter((id) => only.length === 0 || only.includes(id));
  const manifest = readManifest();
  let total = 0;
  for (const id of ids) {
    const started = Date.now();
    const entry = await bake(id, RECIPES[id] ?? { generator: null, out: 512, options: {} });
    const { source, ...rest } = entry;
    manifest[id] = rest;
    const dir = path.join(OUT, id);
    const kb = readdirSync(dir).reduce((sum, file) => sum + readFileSync(path.join(dir, file)).length, 0) / 1024;
    total += kb;
    console.log(`${id.padEnd(32)} ${entry.size}px  ${kb.toFixed(0).padStart(5)} Ko  ${((Date.now() - started) / 1000).toFixed(1)} s  ${source}`);
  }
  writeManifest(manifest);
  console.log(`\n${ids.length} matériaux, ${total.toFixed(0)} Ko.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
