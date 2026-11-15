export const dynamic = 'force-static';

import type { MetadataRoute } from 'next';
import { islands } from '@/data/islands';
import { site } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    // Barre finale : l'adresse que GitHub Pages sert sans redirection (trailingSlash).
    { url: `${site.url}/`, lastModified, priority: 1 },
    ...islands.map((island) => ({
      url: `${site.url}/?section=${island.id}`,
      lastModified,
      priority: 0.6,
    })),
  ];
}
