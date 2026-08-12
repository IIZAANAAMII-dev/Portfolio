'use client';

import { useEffect } from 'react';
import { islands } from '@/data/islands';
import { site } from '@/data/site';
import { useWorld } from '@/lib/store';
import { islandContent } from './content';

/**
 * Version DOM complète du portfolio. Ce n'est pas un mode dégradé : c'est le chemin
 * rapide pour un recruteur pressé, un appareil ancien, ou une absence de WebGL.
 */
export function QuickView() {
  const setQuickView = useWorld((s) => s.setQuickView);
  const webglFailed = useWorld((s) => s.webglFailed);

  useEffect(() => {
    document.body.classList.add('is-quick-view');
    return () => document.body.classList.remove('is-quick-view');
  }, []);

  return (
    <div className="min-h-full bg-abyss text-paper">
      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        <header className="mb-16">
          <p className="text-xs tracking-[0.4em] text-paper/60">{site.shortName}</p>
          <h1 className="mt-6 text-4xl leading-tight font-light tracking-tight md:text-5xl">
            {site.name}
          </h1>
          <p className="mt-3 text-paper/60">
            {site.role} · {site.location}
          </p>
          {!webglFailed && (
            <button
              type="button"
              className="ghost-button mt-8"
              onClick={() => setQuickView(false)}
            >
              Revenir à l’expérience 3D
            </button>
          )}
          {webglFailed && (
            <p className="mt-8 text-xs text-paper/45">
              L’expérience 3D n’a pas pu démarrer sur cet appareil. Tout le contenu reste
              accessible ici.
            </p>
          )}
        </header>

        <div className="space-y-20">
          {islands.map((island) => {
            const Content = islandContent[island.id];
            return (
              <section key={island.id} id={island.id} className="scroll-mt-16">
                <h2
                  className="eyebrow mb-6 !opacity-100"
                  style={{ color: island.accent }}
                >
                  {island.label}
                </h2>
                <div className="panel p-6 md:p-8">
                  <Content />
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-24 border-t border-paper/10 pt-8 text-xs text-paper/40">
          © {new Date().getFullYear()} {site.name}
        </footer>
      </div>
    </div>
  );
}
