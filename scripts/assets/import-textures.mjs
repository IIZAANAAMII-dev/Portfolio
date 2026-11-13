#!/usr/bin/env node
/**
 * Range des exports Substance (Sampler, Designer / sbsrender…) dans
 * assets-src/substance/textures/<id>/<carte>.<ext>, prêts pour `npm run assets:textures`.
 *
 * Accepte un dossier (le zip décompressé), quelle que soit son organisation :
 *   export/stylized_wood_beam/basecolor.png                 (sbsrender, un dossier par matériau)
 *   textures/stylized_wood_beam_basecolor.png               (Sampler, préfixe du matériau)
 *   Stylized Wood Beam/Stylized_Wood_Beam_Normal.png        (export manuel)
 *
 * Usage : npm run assets:import -- <dossier>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOGUE = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/materials/substances.json'), 'utf8'));
const DEST = path.join(ROOT, 'assets-src/substance/textures');

/** Cartes reconnues, dans l'ordre de test (normal avant tout ce qui contient « color »). */
const CHANNELS = [
  ['normal', /normal/],
  ['ambientocclusion', /ambient[ _-]?occlusion|(^|[^a-z])ao([^a-z]|$)|occlusion/],
  ['roughness', /rough/],
  ['metallic', /metal/],
  ['height', /height|displace/],
  ['opacity', /opacity|alpha|transparen/],
  ['emissive', /emissi/],
  ['basecolor', /base[ _-]?colou?r|albedo|diffuse|(^|[^a-z])colou?r([^a-z]|$)/],
];

/** Identifiants triés du plus long au plus court : « …_wood_planks » avant « …_wood ». */
const IDS = Object.keys(CATALOGUE).sort((a, b) => b.length - a.length);

function normalise(text) {
  return text.toLowerCase().replace(/[\s.-]+/g, '_');
}

function materialOf(filePath) {
  const text = normalise(filePath);
  return IDS.find((id) => text.includes(id)) ?? null;
}

function channelOf(fileName, id) {
  // Le nom du matériau est retiré avant de chercher la carte (« wood_flooring » ≠ carte).
  const rest = normalise(fileName).replace(`stylized_${id}`, '').replace(id, '');
  return CHANNELS.find(([, pattern]) => pattern.test(rest))?.[0] ?? null;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(png|jpe?g|tga|tiff?|webp|exr)$/i.test(entry)) files.push(full);
  }
  return files;
}

function main() {
  const source = process.argv[2];
  if (!source || !existsSync(source)) {
    console.error('Usage : npm run assets:import -- <dossier des exports>');
    process.exit(1);
  }
  const found = {};
  const ignored = [];
  for (const file of walk(path.resolve(source))) {
    const id = materialOf(path.relative(source, file));
    const channel = id ? channelOf(path.basename(file, path.extname(file)), id) : null;
    if (!id || !channel) {
      ignored.push(path.relative(source, file));
      continue;
    }
    // Cartes de l'ancien flux spéculaire : le moteur est en PBR métal / rugosité.
    if (/specular|glossiness|diffuse/i.test(path.basename(file))) continue;
    const dir = path.join(DEST, id);
    mkdirSync(dir, { recursive: true });
    copyFileSync(file, path.join(dir, `${channel}${path.extname(file).toLowerCase()}`));
    (found[id] ??= []).push(channel);
  }
  for (const [id, channels] of Object.entries(found).sort()) {
    console.log(`${id.padEnd(32)} ${CATALOGUE[id].label.padEnd(34)} ${channels.sort().join(', ')}`);
  }
  if (ignored.length) console.log(`\nIgnorés (${ignored.length}) : ${ignored.slice(0, 12).join(' · ')}${ignored.length > 12 ? '…' : ''}`);
  console.log(`\n${Object.keys(found).length} matériaux importés. Lancer ensuite : npm run assets:textures`);
}

main();
