import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

/**
 * Deux façons de construire le site :
 *  - par défaut (`next dev`, `next build` sur Vercel ou tout hébergement avec serveur) :
 *    servi à la racine, avec la route serveur `/api/contact` ;
 *  - GitHub Pages (`PAGES=1`, voir .github/workflows/deploy-pages.yml) : export statique
 *    dans `out/`, servi sous le préfixe `PAGES_BASE_PATH` (`/Portfolio`), sans serveur.
 *
 *    PAGES=1 PAGES_BASE_PATH=/Portfolio npx next build
 */
const pages = process.env.PAGES === '1';

// « Portfolio », « /Portfolio/ » → « /Portfolio » ; vide ou « / » → aucun préfixe.
const basePath = pages ? (process.env.PAGES_BASE_PATH ?? '').replace(/^\/*/, '/').replace(/\/+$/, '') : '';

/*
 * Fichiers sous licence Adobe Substance 3D, gardés hors du dépôt public (docs/ASSETS.md) :
 * le build GitHub Pages ne contient que ce qui est versionné. Il relève donc ce qui est
 * réellement là pour ne jamais demander un fichier absent (le repli procédural sert).
 * Ailleurs (dev, Vercel), tout est tenté et AssetBoundary rattrape un manque.
 */
const publicDir = join(process.cwd(), 'public');
const bellIslandDir = join(publicDir, 'models/bell-island');
const bellIslandModels = !pages
  ? '*'
  : existsSync(bellIslandDir)
    ? readdirSync(bellIslandDir)
        .filter((file) => file.endsWith('.glb'))
        .map((file) => file.slice(0, -'.glb'.length))
        .join(',')
    : '';
const adobeTextures = !pages || existsSync(join(publicDir, 'textures/substance-adobe/manifest.json')) ? '1' : '';

const staticExport: NextConfig = {
  output: 'export',
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
};

const nextConfig: NextConfig = {
  ...(pages ? staticExport : {}),
  // Les fichiers `*.server.ts` de src/app (la route /api/contact) exigent un serveur : ils
  // ne sont reconnus comme routes qu'en dehors de l'export statique.
  pageExtensions: pages ? ['tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js', 'server.ts'],
  // Figés dans le code à la construction : préfixe des fichiers de public/ (lib/asset.ts),
  // absence de serveur (le formulaire de contact passe alors par la messagerie) et fichiers
  // facultatifs réellement livrés (lib/substance-models.ts, lib/materials/substance-material.ts).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_EXPORT: pages ? '1' : '',
    NEXT_PUBLIC_BELL_ISLAND_MODELS: bellIslandModels,
    NEXT_PUBLIC_ADOBE_TEXTURES: adobeTextures,
  },
  // Le canvas est déjà chargé dynamiquement ; on garde le reste du bundle minimal.
  experimental: {
    optimizePackageImports: ['@react-three/drei'],
  },
  // Permet d'ouvrir l'aperçu de développement depuis 127.0.0.1 comme depuis localhost.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
