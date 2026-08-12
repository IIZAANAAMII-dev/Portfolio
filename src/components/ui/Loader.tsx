'use client';

import { useEffect, useState } from 'react';
import { site } from '@/data/site';

/**
 * Chargement : pas de pourcentage, juste deux états. La transition vers l'intro se fait
 * en fondu pour que la première image du monde ne soit jamais « poppée ».
 */
export function Loader({ done }: { done: boolean }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(() => setHidden(true), 1200);
    return () => clearTimeout(timeout);
  }, [done]);

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-abyss transition-opacity duration-700"
      style={{ opacity: done ? 0 : 1 }}
      aria-hidden={done}
    >
      <p className="text-sm tracking-[0.42em] text-paper/90">{site.shortName}</p>
      <p className="hand mt-4 text-xl text-dawn/80">
        {done ? 'Ready.' : 'Preparing the world…'}
      </p>
    </div>
  );
}
