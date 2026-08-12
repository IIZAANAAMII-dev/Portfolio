import type { MetadataRoute } from 'next';
import { islands } from '@/data/islands';
import { site } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: site.url, lastModified, priority: 1 },
    ...islands.map((island) => ({
      url: `${site.url}/?section=${island.id}`,
      lastModified,
      priority: 0.6,
    })),
  ];
}
