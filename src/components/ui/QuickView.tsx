'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { islands } from '@/data/islands';
import { site } from '@/data/site';
import { useWorld } from '@/lib/store';
import { islandContent } from './content';

/**
 * Version DOM complète du portfolio, pensée comme une carte de navigation.
 * Ce n'est pas un mode dégradé : c'est le chemin rapide pour un recruteur pressé,
 * un appareil ancien, ou une absence de WebGL. Une timeline GSAP anime l'entrée.
 */
export function QuickView() {
  const setQuickView = useWorld((s) => s.setQuickView);
  const webglFailed = useWorld((s) => s.webglFailed);
  const reducedMotion = useWorld((s) => s.reducedMotion);

  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    document.body.classList.add('is-quick-view');
    return () => document.body.classList.remove('is-quick-view');
  }, []);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const header = headerRef.current;
    const line = lineRef.current;
    const items = itemsRef.current.filter(Boolean);
    if (!root || !header || !line || items.length === 0) return;

    gsap.set([header, line, ...items], { clearProps: 'all' });
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo(header, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 })
        .fromTo(
          line,
          { scaleY: 0 },
          { scaleY: 1, duration: 1.1, transformOrigin: 'top center', ease: 'power3.inOut' },
          '-=0.5',
        )
        .fromTo(
          items,
          { y: 48, opacity: 0, scale: 0.98 },
          { y: 0, opacity: 1, scale: 1, duration: 0.75, stagger: 0.14 },
          '-=0.7',
        );
    }, root);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-x-hidden bg-abyss text-paper"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% -10%, rgba(29,95,116,0.28), transparent 45%), radial-gradient(circle at 80% 80%, rgba(246,201,159,0.06), transparent 35%)',
      }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-28">
        <header ref={headerRef} className="mb-20 text-center">
          <span className="eyebrow mb-6 inline-block rounded-full border border-paper/15 bg-paper/5 px-3 py-1.5 text-[0.65rem] tracking-[0.22em] text-paper/70">
            Quick view
          </span>
          <h1 className="mt-2 text-5xl font-light tracking-tight md:text-7xl">
            {site.name}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-paper/55 md:text-lg">
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
            <p className="mx-auto mt-8 max-w-sm text-xs text-paper/45">
              L’expérience 3D n’a pas pu démarrer sur cet appareil. Tout le contenu reste
              accessible ici.
            </p>
          )}
        </header>

        <div className="relative">
          <div
            ref={lineRef}
            className="absolute left-[27px] top-0 h-full w-px md:left-[43px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(244,241,234,0.08) 0%, rgba(244,241,234,0.32) 40%, rgba(244,241,234,0.32) 60%, rgba(244,241,234,0.08) 100%)',
            }}
          />

          <div className="space-y-14 md:space-y-20">
            {islands.map((island, index) => {
              const Content = islandContent[island.id];
              return (
                <div
                  key={island.id}
                  id={island.id}
                  ref={(el) => {
                    itemsRef.current[index] = el;
                  }}
                  className="relative pl-16 md:pl-28"
                >
                  <div className="absolute left-0 top-0 md:left-3">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full text-[0.75rem] font-semibold leading-none"
                      style={{
                        backgroundColor: island.accent,
                        color: 'var(--abyss)',
                        boxShadow: `0 0 0 5px var(--abyss), 0 0 32px 6px ${island.accent}45`,
                      }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <h2
                      className="eyebrow mt-4 !text-[0.7rem] !opacity-100"
                      style={{ color: island.accent }}
                    >
                      {island.label}
                    </h2>
                    <p className="hand text-lg text-dawn/85 md:text-xl">
                      {island.tagline}
                    </p>
                  </div>

                  <section className="scroll-mt-16 pt-1">
                    <div
                      className="panel p-6 transition-transform duration-300 will-change-transform md:p-8"
                      style={{
                        borderTop: `2px solid ${island.accent}`,
                        boxShadow: `0 30px 80px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(244,241,234,0.04)`,
                      }}
                    >
                      <Content />
                    </div>
                  </section>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="mt-28 border-t border-paper/10 pt-8 text-center text-xs text-paper/40">
          © {new Date().getFullYear()} {site.name} — {site.location}
        </footer>
      </div>
    </div>
  );
}
