'use client';

import { useEffect } from 'react';
import { islandById } from '@/data/islands';
import { useWorld } from '@/lib/store';
import type { IslandId } from '@/types';

function isIslandId(value: string | null): value is IslandId {
  return Boolean(value && value in islandById);
}

/**
 * `/?section=projects` ouvre directement la bonne île, sans rejouer l'intro.
 * Dans l'autre sens, chaque accostage met l'URL à jour pour rendre la section
 * partageable — sans jamais recharger la page.
 */
export function useDeepLink() {
  const activeIsland = useWorld((s) => s.activeIsland);
  const phase = useWorld((s) => s.phase);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (isIslandId(section)) useWorld.getState().jumpTo(section);
  }, []);

  useEffect(() => {
    if (phase === 'loading' || phase === 'intro') return;
    const url = new URL(window.location.href);
    if (activeIsland) url.searchParams.set('section', activeIsland);
    else url.searchParams.delete('section');
    window.history.replaceState(null, '', url);
  }, [activeIsland, phase]);
}
