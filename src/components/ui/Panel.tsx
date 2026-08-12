'use client';

import { useEffect, useState } from 'react';
import { islandById } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { islandContent } from './content';
import type { IslandId } from '@/types';

/**
 * Feuille de contenu. Elle reste montée pendant sa sortie pour que la fermeture soit
 * animée, et laisse volontairement le monde visible sur la moitié de l'écran.
 */
export function Panel() {
  const activeIsland = useWorld((s) => s.activeIsland);
  const close = useWorld((s) => s.close);
  const [displayed, setDisplayed] = useState<IslandId | null>(activeIsland);

  // Dérivé pendant le rendu : le panneau affiche immédiatement la nouvelle île...
  if (activeIsland && activeIsland !== displayed) setDisplayed(activeIsland);

  // ...mais reste monté le temps de son animation de sortie.
  useEffect(() => {
    if (activeIsland) return;
    const timeout = setTimeout(() => setDisplayed(null), 600);
    return () => clearTimeout(timeout);
  }, [activeIsland]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!displayed) return null;

  const island = islandById[displayed];
  const Content = islandContent[displayed];
  const open = Boolean(activeIsland);

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-30 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:inset-y-0 md:right-auto md:left-0 md:flex md:items-center md:p-8"
      style={{
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(24px)',
        pointerEvents: open ? 'auto' : 'none',
      }}
      aria-hidden={!open}
    >
      <div className="panel max-h-[62vh] overflow-y-auto rounded-b-none p-6 md:max-h-[78vh] md:w-[26rem] md:rounded-b-[20px] md:p-8">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow" style={{ color: island.accent }}>
              {island.tagline}
            </p>
            <h2 className="mt-1 font-medium">{island.label}</h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full border border-ink/15 px-3 py-1 text-xs tracking-widest text-ink/60 transition-colors hover:border-ink/40 hover:text-ink"
            aria-label="Fermer et revenir au monde"
          >
            Fermer
          </button>
        </div>
        <Content />
      </div>
    </aside>
  );
}
