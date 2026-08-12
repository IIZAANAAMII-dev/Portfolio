'use client';

import { islands } from '@/data/islands';
import { site } from '@/data/site';
import { useWorld } from '@/lib/store';

/**
 * L'interface permanente. Trois éléments seulement, tous dans les marges : le monde
 * garde le centre de l'écran.
 */
export function Hud() {
  const phase = useWorld((s) => s.phase);
  const activeIsland = useWorld((s) => s.activeIsland);
  const destination = useWorld((s) => s.destination);
  const soundOn = useWorld((s) => s.soundOn);
  const toggleSound = useWorld((s) => s.toggleSound);
  const setQuickView = useWorld((s) => s.setQuickView);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);

  const visible = phase === 'sailing' || phase === 'docked';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 transition-opacity duration-1000 md:p-7"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <header className="flex items-start justify-between">
        <p className="text-xs tracking-[0.4em] text-paper/90">{site.shortName}</p>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            className="ghost-button"
            aria-pressed={soundOn}
            onClick={toggleSound}
          >
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
          <button type="button" className="ghost-button" onClick={() => setQuickView(true)}>
            Quick view
          </button>
        </div>
      </header>

      <nav
        className="pointer-events-auto mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 md:gap-x-8"
        aria-label="Sections du portfolio"
      >
        {islands.map((island) => {
          const current = activeIsland === island.id;
          const heading = destination === island.id;
          return (
            <button
              key={island.id}
              type="button"
              onClick={() => sailTo(island.id)}
              onMouseEnter={() => hover(island.id)}
              onMouseLeave={() => hover(null)}
              className="group relative py-2 text-[0.7rem] tracking-[0.2em] uppercase transition-colors duration-200"
              style={{ color: current || heading ? island.accent : 'rgba(244,241,234,0.6)' }}
            >
              {island.label}
              <span
                className="absolute inset-x-0 -bottom-0.5 h-px origin-center scale-x-0 bg-current transition-transform duration-300 group-hover:scale-x-100"
                style={{ transform: current ? 'scaleX(1)' : undefined }}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
