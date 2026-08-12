'use client';

import dynamic from 'next/dynamic';

/**
 * WebGL n'existe pas côté serveur : la scène est chargée uniquement dans le navigateur.
 * Cela garde aussi le HTML initial (le contenu SEO de page.tsx) très léger.
 */
export const ExperienceLoader = dynamic(
  () => import('./Experience').then((mod) => mod.Experience),
  { ssr: false },
);
