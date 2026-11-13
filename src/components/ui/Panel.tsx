'use client';

import { useEffect, useState } from 'react';
import { islandById } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { STAMPS, useLogbook } from '@/lib/logbook';
import { islandContent } from './content';
import { Stamp } from './Logbook';
import type { IslandId } from '@/types';

/** Sur le papier, une couleur d'accent trop claire (blanc…) devient une encre brune. */
function inkFor(accent: string) {
  const value = Number.parseInt(accent.replace('#', ''), 16);
  const luma = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return luma > 0.72 ? '#8a6d4f' : accent;
}

/**
 * Feuille de contenu. Elle reste montée pendant sa sortie pour que la fermeture soit
 * animée, et laisse volontairement le monde visible sur la moitié de l'écran.
 */
export function Panel() {
  const activeIsland = useWorld((s) => s.activeIsland);
  const close = useWorld((s) => s.close);
  const stamps = useLogbook((s) => s.stamps);
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
  const stamp = STAMPS.find((entry) => entry.id === `island:${displayed}`);
  const visited = stamps.includes(`island:${displayed}`);

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
      <div className="panel panel--page max-h-[62vh] overflow-y-auto rounded-b-none p-6 md:max-h-[78vh] md:w-[26rem] md:rounded-b-[20px] md:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow" style={{ color: inkFor(island.accent) }}>
              {island.tagline}
            </p>
            <h2 className="panel__title mt-1">{island.label}</h2>
          </div>
          {stamp && (
            <div className="panel__stamp" aria-hidden="true">
              <Stamp stamp={stamp} earned={visited} />
            </div>
          )}
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
