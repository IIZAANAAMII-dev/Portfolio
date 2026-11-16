'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { islandById, islands } from '@/data/islands';
import { site } from '@/data/site';
import { LogbookButton } from '@/components/ui/Logbook';
import { boatState } from '@/lib/boat-state';
import { useLogbook } from '@/lib/logbook';
import { dockPosition, useWorld } from '@/lib/store';
import { isNightTime } from '@/lib/sky';
import type { IslandId } from '@/types';

const RAD2DEG = 180 / Math.PI;

/* ------------------------------------------------------------------- ICÔNES */

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg className="hud-btn__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.8h2.6L10 4.6v10.8l-3.9-3.2H3.5z" fill="currentColor" fillOpacity="0.18" />
      {on ? (
        <>
          <path d="M13 7.4a3.6 3.6 0 0 1 0 5.2" />
          <path d="M15.4 5.2a6.8 6.8 0 0 1 0 9.6" />
        </>
      ) : (
        <path d="M13.2 7.6l4 4.8M17.2 7.6l-4 4.8" />
      )}
    </svg>
  );
}

function QuickIcon() {
  return (
    <svg className="hud-btn__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="2.8" width="12" height="14.4" rx="2" fill="currentColor" fillOpacity="0.14" />
      <path d="M7 7h6M7 10h6M7 13h3.6" />
    </svg>
  );
}

/** Rose des vents à huit pointes (bouton « Cap », curseur). */
function CompassRose({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-12 -12 24 24" aria-hidden="true">
      <path d="M0 -11 L2.2 -2.2 L11 0 L2.2 2.2 L0 11 L-2.2 2.2 L-11 0 L-2.2 -2.2 Z" fill="currentColor" />
      <path d="M0 -6.5 L1.2 -1.2 L6.5 0 L1.2 1.2 L0 6.5 L-1.2 1.2 L-6.5 0 L-1.2 -1.2 Z" fill="currentColor" opacity="0.55" transform="rotate(45)" />
      <circle r="1.6" fill="#08121c" />
    </svg>
  );
}

function Chevron({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 7.5L6 4l3.5 3.5" />
    </svg>
  );
}

/* ----------------------------------------------------------------- BOUSSOLE */

/**
 * Boussole en bas à gauche, rafraîchie à chaque image pour refléter la position réelle du
 * bateau, sans rendu React : seules des transformations sont écrites (aucun recalcul de
 * mise en page), et seulement quand un angle a vraiment changé. Les îles sont des repères
 * autour du cadran (raccourcis à la souris ; au clavier et au doigt, la navigation du bas
 * fait foi). L'aiguille pointe vers l'île visée, sinon dans le cap du bateau.
 */
function Compass() {
  const needle = useRef<HTMLElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const destination = useWorld((s) => s.destination);
  const activeIsland = useWorld((s) => s.activeIsland);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);
  const targetId = destination || activeIsland;

  useEffect(() => {
    let rafId = 0;
    let lastNeedle = Number.NaN;
    const lastDots = islands.map(() => Number.NaN);
    const loop = () => {
      const boatX = boatState.position.x;
      const boatZ = boatState.position.z;
      let angle = boatState.heading * RAD2DEG + 90;
      if (targetId) {
        const [tx, tz] = dockPosition(targetId);
        angle = Math.atan2(tz - boatZ, tx - boatX) * RAD2DEG + 90;
      }
      if (needle.current && Math.abs(angle - lastNeedle) > 0.15) {
        lastNeedle = angle;
        needle.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }
      islands.forEach((island, index) => {
        const dot = dots.current[index];
        if (!dot) return;
        const bearing = Math.atan2(island.position[1] - boatZ, island.position[0] - boatX) * RAD2DEG;
        if (Math.abs(bearing - lastDots[index]) < 0.2) return;
        lastDots[index] = bearing;
        dot.style.setProperty('--a', `${bearing.toFixed(2)}deg`);
      });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [targetId]);

  return (
    <div className="hud-compass" aria-hidden="true">
      <span className="hud-compass__n">N</span>
      <i ref={needle} className="hud-compass__needle" />
      <b className="hud-compass__star">✦</b>
      {islands.map((island, index) => (
        <button
          key={island.id}
          ref={(element) => {
            dots.current[index] = element;
          }}
          type="button"
          tabIndex={-1}
          className="hud-island-dot"
          title={island.label}
          onClick={(event) => {
            event.stopPropagation();
            sailTo(island.id);
          }}
          onMouseEnter={() => hover(island.id)}
          onMouseLeave={() => hover(null)}
          style={{ backgroundColor: island.accent }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ CADRAN DU JOUR */

/**
 * Cadran du cycle : le soleil glisse sur un arc d'horizon pendant la journée, la lune
 * prend le relais la nuit. Abonné directement au store : l'heure change quatre fois par
 * seconde sans jamais faire re-rendre le HUD.
 */
function DayDial() {
  const body = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const apply = (timeOfDay: number) => {
      const circle = body.current;
      if (!circle) return;
      const angle = (timeOfDay - 0.25) * Math.PI * 2;
      const day = Math.sin(angle) >= 0;
      const shown = day ? angle : angle + Math.PI;
      circle.setAttribute('cx', (13 - Math.cos(shown) * 10).toFixed(2));
      circle.setAttribute('cy', (14 - Math.sin(shown) * 10).toFixed(2));
      circle.setAttribute('r', day ? '2.6' : '2.2');
      circle.setAttribute('fill', day ? '#ffd27a' : '#e8eef8');
    };
    apply(useWorld.getState().timeOfDay);
    return useWorld.subscribe((state, previous) => {
      if (state.timeOfDay !== previous.timeOfDay) apply(state.timeOfDay);
    });
  }, []);
  return (
    <svg className="day-dial" viewBox="0 0 26 16" aria-hidden="true">
      <path d="M3 14 A10 10 0 0 1 23 14" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="1.6 2" />
      <line x1="1" y1="14.5" x2="25" y2="14.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
      <circle ref={body} cx="13" cy="4" r="2.6" fill="#ffd27a" />
    </svg>
  );
}

/* ------------------------------------------------------------- NAVIGATION */

type NavState = 'here' | 'heading' | undefined;

function useIslandStates() {
  const activeIsland = useWorld((s) => s.activeIsland);
  const destination = useWorld((s) => s.destination);
  const stamps = useLogbook((s) => s.stamps);
  return (id: IslandId): { state: NavState; visited: boolean } => ({
    state: activeIsland === id ? 'here' : destination === id ? 'heading' : undefined,
    visited: stamps.includes(`island:${id}`),
  });
}

/**
 * Les îles : une barre de verre quand la place le permet, sinon un bouton « Cap » qui
 * déplie une page du carnet (la requête de conteneur CSS choisit, page ouverte comprise).
 */
function IslandNav({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (open: boolean) => void }) {
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);
  const activeIsland = useWorld((s) => s.activeIsland);
  const destination = useWorld((s) => s.destination);
  const reducedMotion = useWorld((s) => s.reducedMotion);
  const statusOf = useIslandStates();
  const menu = useRef<HTMLDivElement>(null);
  const capButton = useRef<HTMLButtonElement>(null);
  const target = destination ?? activeIsland;
  const targetIsland = target ? islandById[target] : null;

  // Ouverture : la page monte du bouton, les îles s'inscrivent une à une.
  useLayoutEffect(() => {
    const element = menu.current;
    if (!menuOpen || !element || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(element, { opacity: 0, y: 14, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
      gsap.fromTo(element.querySelectorAll('li'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.035, delay: 0.06, ease: 'expo.out' });
    }, element);
    return () => ctx.revert();
  }, [menuOpen, reducedMotion]);

  // `html[data-menu='cap']` : le dock du jeu, le rail, la radio et la visite guidée s'effacent
  // tant que la liste est ouverte (elle passe au-dessus d'eux, sous un voile).
  useEffect(() => {
    if (!menuOpen) return;
    const html = document.documentElement;
    html.dataset.menu = 'cap';
    return () => {
      delete html.dataset.menu;
    };
  }, [menuOpen]);

  // Échap referme la liste avant toute autre chose (phase de capture), puis rend le focus.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenuOpen(false);
      capButton.current?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [menuOpen, setMenuOpen]);

  const choose = (id: IslandId) => {
    setMenuOpen(false);
    sailTo(id);
  };

  return (
    <nav className="hud-nav" aria-label="Îles du portfolio">
      <ul className="hud-nav__list">
        {islands.map((island) => {
          const { state, visited } = statusOf(island.id);
          return (
            <li key={island.id}>
              <button
                type="button"
                className="hud-nav__item"
                data-state={state === 'heading' ? 'heading' : undefined}
                data-visited={visited || undefined}
                aria-current={state === 'here' ? 'location' : undefined}
                style={{ ['--accent' as string]: island.accent }}
                onClick={() => sailTo(island.id)}
                onMouseEnter={() => hover(island.id)}
                onMouseLeave={() => hover(null)}
              >
                {island.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hud-nav__compact">
        <button
          ref={capButton}
          type="button"
          className="hud-cap"
          aria-expanded={menuOpen}
          aria-controls="hud-cap-menu"
          data-target={targetIsland ? '' : undefined}
          style={targetIsland ? { ['--accent' as string]: targetIsland.accent } : undefined}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <CompassRose className="hud-cap__rose" />
          <span className="hud-cap__label">{destination ? 'Cap sur' : activeIsland ? 'À quai' : 'Mettre le cap'}</span>
          {targetIsland && <span className="hud-cap__target">{targetIsland.label}</span>}
          <Chevron className="hud-cap__chevron" />
        </button>
        <div ref={menu} id="hud-cap-menu" className="hud-cap-menu" hidden={!menuOpen}>
          <p className="hud-cap-menu__title">Mettre le cap sur…</p>
          <ul>
            {islands.map((island) => {
              const { state, visited } = statusOf(island.id);
              return (
                <li key={island.id}>
                  <button
                    type="button"
                    className="hud-cap-item"
                    aria-current={state === 'here' ? 'location' : undefined}
                    style={{ ['--accent' as string]: island.accent }}
                    onClick={() => choose(island.id)}
                  >
                    <span className="hud-cap-item__dot" aria-hidden="true" />
                    <span className="hud-cap-item__text">
                      <span className="hud-cap-item__name">{island.label}</span>
                      <span className="hud-cap-item__tagline">{island.tagline}</span>
                    </span>
                    <span className="hud-cap-item__state" data-tone={visited && !state ? 'visited' : undefined}>
                      {state === 'here' ? 'à quai' : state === 'heading' ? 'en route' : visited ? '✓ visitée' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------- CURSEUR NAUTIQUE */

/**
 * Bureau seulement (souris) : au-dessus de la mer, une petite rose des vents « naviguer
 * ici » ; au-dessus d'une île ou d'un objet cliquable, elle se resserre dans un anneau
 * doré. Hors du canvas (interface DOM), le curseur natif reprend la main. La position est
 * écrite en transform, une fois par image au plus, sans rendu React.
 */
function NauticalCursor({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = root.current;
    const text = label.current;
    if (!active || !element || !text) return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!query.matches) return;
    const html = document.documentElement;
    html.dataset.cursor = 'on';
    let x = -200;
    let y = -200;
    let overCanvas = false;
    let frame = 0;
    let lastKey = '';

    const render = () => {
      frame = 0;
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const hovered = useWorld.getState().hovered;
      const pointer = document.body.style.cursor === 'pointer';
      const state = !overCanvas ? 'hidden' : hovered ? 'island' : pointer ? 'target' : 'sea';
      if (state === lastKey) return;
      lastKey = state;
      element.dataset.visible = state === 'hidden' ? 'false' : 'true';
      element.dataset.state = state;
      text.textContent = state === 'island' ? 'accoster' : state === 'sea' ? 'naviguer ici' : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      const target = event.target;
      overCanvas = event.pointerType === 'mouse' && target instanceof HTMLCanvasElement && target.hasAttribute('data-engine');
      schedule();
    };
    const onDown = () => {
      if (!overCanvas) return;
      element.dataset.press = 'false';
      void element.offsetWidth;
      element.dataset.press = 'true';
    };
    const onLeave = () => {
      overCanvas = false;
      schedule();
    };
    // Le survol 3D change le curseur du body sans bouger la souris : on l'observe aussi.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    const unsubscribe = useWorld.subscribe((state, previous) => {
      if (state.hovered !== previous.hovered) schedule();
    });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    html.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      html.removeEventListener('pointerleave', onLeave);
      delete html.dataset.cursor;
      element.dataset.visible = 'false';
    };
  }, [active]);

  return (
    <div ref={root} className="nav-cursor" aria-hidden="true" data-visible="false" data-state="sea">
      <span className="nav-cursor__ring" />
      <CompassRose className="nav-cursor__rose" />
      <span ref={label} className="nav-cursor__label" />
    </div>
  );
}

/* --------------------------------------------------------------------- HUD */

/**
 * L'interface permanente, toute dans les marges : le monde garde le centre de l'écran.
 * Les positions suivent les zones de globals.css (encoche et barre d'accueil comprises).
 */
export function Hud() {
  const phase = useWorld((s) => s.phase);
  const soundOn = useWorld((s) => s.soundOn);
  // Booléen dérivé : le HUD ne se re-rend qu'au passage jour ↔ nuit, pas à chaque tic d'horloge.
  const isNight = useWorld((s) => isNightTime(s.timeOfDay));
  const toggleSound = useWorld((s) => s.toggleSound);
  const toggleDayNight = useWorld((s) => s.toggleDayNight);
  const setQuickView = useWorld((s) => s.setQuickView);
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = phase === 'playing' || phase === 'docked';
  // La liste des îles se referme d'elle-même quand le monde change d'état (accostage…).
  const [menuPhase, setMenuPhase] = useState(phase);
  if (menuPhase !== phase) {
    setMenuPhase(phase);
    if (menuOpen) setMenuOpen(false);
  }

  return (
    <>
      <div className="hud" data-visible={visible} data-menu={menuOpen ? 'open' : undefined} inert={!visible}>
        <header className="hud-top">
          <p className="hud-brand">{site.shortName}</p>
          <div className="hud-actions" role="toolbar" aria-label="Réglages du voyage">
            <button type="button" className="hud-btn" aria-pressed={soundOn} onClick={toggleSound} title={soundOn ? 'Couper le son' : 'Activer le son'}>
              <SoundIcon on={soundOn} />
              <span className="hud-btn__label">Son</span>
            </button>
            <button
              type="button"
              className="hud-btn"
              onClick={toggleDayNight}
              aria-label={isNight ? 'Nuit : passer au jour' : 'Jour : passer à la nuit'}
              title={isNight ? 'Passer au jour' : 'Passer à la nuit'}
            >
              <DayDial />
              <span className="hud-btn__label">{isNight ? 'Nuit' : 'Jour'}</span>
            </button>
            <LogbookButton />
            <button
              type="button"
              className="hud-btn"
              onClick={() => setQuickView(true)}
              aria-label="Version rapide du portfolio, pour les recruteurs"
              title="Version rapide du portfolio"
            >
              <QuickIcon />
              <span className="hud-btn__label">Version rapide</span>
            </button>
          </div>
        </header>

        {menuOpen && (
          <button
            type="button"
            className="hud-cap-backdrop"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <IslandNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        {visible && <Compass />}
      </div>
      <NauticalCursor active={visible} />
    </>
  );
}
