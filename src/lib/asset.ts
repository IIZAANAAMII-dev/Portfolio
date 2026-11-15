/**
 * Préfixe de publication du site, fixé à la construction (`NEXT_PUBLIC_BASE_PATH`, défini
 * par next.config.ts) : `/Portfolio` pour GitHub Pages, vide en développement et sur tout
 * hébergement servi à la racine.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * URL publique d'un fichier de `public/`. Next préfixe lui-même ses liens et ses
 * fichiers `/_next/`, mais jamais les chaînes écrites à la main : TOUTE adresse vers
 * `public/` (modèles, textures, sons, captures…) passe donc par ici.
 *
 *   asset('/models/pirate-kit/ship-small.glb') → '/Portfolio/models/pirate-kit/ship-small.glb'
 *
 * Les adresses absolues (`https:`, `data:`, `blob:`, `//hôte`) et celles déjà préfixées
 * sont rendues telles quelles : appliquer deux fois la fonction ne casse rien.
 */
export function asset(path: string): string {
  if (!BASE_PATH || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
