'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { islandById, islands } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { STAMPS, useLogbook } from '@/lib/logbook';
import { SHEET_PEEK, setSheetCover } from '@/lib/sheet';
import { islandContent } from './content';
import { Stamp } from './Logbook';
import type { IslandId } from '@/types';

/** Sur le papier, une couleur d'accent trop claire (blanc…) devient une encre brune. */
function inkFor(accent: string) {
  const value = Number.parseInt(accent.replace('#', ''), 16);
  const luma = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return luma > 0.72 ? '#8a6d4f' : accent;
}

const PHONE = '(max-width: 767px)';

function isPhoneLayout() {
  return typeof window !== 'undefined' && window.matchMedia(PHONE).matches;
}

/** Hauteur visible de la feuille (px) et part de l'écran qu'elle couvre (caméra, CSS). */
function publishSheet(visible: number) {
  const height = Math.max(window.innerHeight, 1);
  setSheetCover(Math.min(Math.max(visible / height, 0), 1));
  document.documentElement.style.setProperty('--sheet-h', `${Math.round(Math.max(visible, 0))}px`);
}

interface Drag {
  id: number;
  startY: number;
  startOffset: number;
  offset: number;
  height: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  /** Le geste a commencé sur la poignée (un simple toucher y déplie / replie la page). */
  onHandle: boolean;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

/**
 * Page du carnet de l'île à quai. Bureau : page posée à gauche, le monde reste visible à
 * droite. Téléphone : feuille qui monte du bas, à moitié ouverte (l'île reste visible
 * au-dessus, la caméra la recadre) ; on la tire vers le haut par sa poignée, ou elle se
 * déplie d'elle-même dès qu'on fait défiler le texte. Elle reste montée pendant sa sortie
 * pour que la fermeture soit animée.
 */
export function Panel() {
  const activeIsland = useWorld((s) => s.activeIsland);
  const close = useWorld((s) => s.close);
  const sailTo = useWorld((s) => s.sailTo);
  const stamps = useLogbook((s) => s.stamps);
  const [displayed, setDisplayed] = useState<IslandId | null>(activeIsland);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [phone, setPhone] = useState(isPhoneLayout);
  const sheet = useRef<HTMLElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Dérivé pendant le rendu : le panneau affiche immédiatement la nouvelle île (repliée)...
  if (activeIsland && activeIsland !== displayed) {
    setDisplayed(activeIsland);
    setExpanded(false);
  }

  // ...mais reste monté le temps de son animation de sortie.
  useEffect(() => {
    if (activeIsland) return;
    const timeout = setTimeout(() => setDisplayed(null), 600);
    return () => clearTimeout(timeout);
  }, [activeIsland]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const open = Boolean(activeIsland);

  // `html[data-panel='open']` : le HUD (navigation, boussole, radio) s'efface sous la page.
  useEffect(() => {
    const html = document.documentElement;
    if (open) html.dataset.panel = 'open';
    else delete html.dataset.panel;
    return () => {
      delete html.dataset.panel;
    };
  }, [open]);

  // Hauteur visible publiée pour la caméra (recadrage de l'île) et la CSS (`--sheet-h`).
  useLayoutEffect(() => {
    const update = () => {
      if (!open || !phone) return publishSheet(0);
      const full = sheet.current?.clientHeight ?? window.innerHeight;
      publishSheet(expanded ? full : Math.min(full, window.innerHeight * SHEET_PEEK));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [displayed, expanded, open, phone]);

  useEffect(() => () => publishSheet(0), []);

  if (!displayed) return null;

  const island = islandById[displayed];
  const Content = islandContent[displayed];
  const stamp = STAMPS.find((entry) => entry.id === `island:${displayed}`);
  const visited = stamps.includes(`island:${displayed}`);
  const next = islands[(islands.findIndex((entry) => entry.id === displayed) + 1) % islands.length];

  /* Glisser la feuille par sa poignée ou son en-tête (téléphone). */
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!phone || !open || event.button > 0) return;
    if ((event.target as HTMLElement).closest('.sheet__close')) return;
    const height = sheet.current?.clientHeight ?? window.innerHeight;
    const visible = expanded ? height : Math.min(height, window.innerHeight * SHEET_PEEK);
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startOffset: height - visible,
      offset: height - visible,
      height,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
      onHandle: Boolean((event.target as HTMLElement).closest('.sheet__handle')),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    const element = paper.current;
    if (!state || state.id !== event.pointerId || !element) return;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.abs(dy) < 6) return;
    if (!state.moved) setDragging(true);
    state.moved = true;
    // Un peu de résistance au-delà du plein écran.
    const raw = state.startOffset + dy;
    state.offset = raw < 0 ? raw * 0.25 : Math.min(raw, state.height);
    const dt = Math.max(event.timeStamp - state.lastT, 1);
    state.velocity = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastT = event.timeStamp;
    element.style.transform = `translateY(${state.offset.toFixed(1)}px)`;
    publishSheet(state.height - Math.max(state.offset, 0));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    if (paper.current) paper.current.style.transform = '';
    setDragging(false);
    if (!state.moved) {
      // Un simple toucher sur la poignée déplie ou replie la page (la capture du pointeur
      // redirige `pointerup` vers la zone de prise : on se fie au point de départ).
      if (state.onHandle && event.type === 'pointerup') setExpanded(!expanded);
      return;
    }
    const peekOffset = state.height - Math.min(state.height, window.innerHeight * SHEET_PEEK);
    // Lancer vers le bas sous la position repliée : la page se range, le monde reprend.
    if (state.offset > peekOffset + 90 || (state.velocity > 0.9 && state.offset > peekOffset * 0.6)) {
      close();
      return;
    }
    const wantsFull = state.velocity < -0.45 || (state.velocity < 0.45 && state.offset < peekOffset * 0.5);
    setExpanded(wantsFull);
    // Même état qu'avant le geste : React ne réécrit rien, on republie la hauteur.
    if (wantsFull === expanded) publishSheet(wantsFull ? state.height : state.height - peekOffset);
  };

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  return (
    <aside
      ref={sheet}
      className="sheet"
      data-open={open}
      data-expanded={phone && expanded ? 'true' : undefined}
      data-dragging={dragging ? '' : undefined}
      aria-hidden={!open}
      aria-labelledby="sheet-title"
      inert={!open}
      style={{ ['--accent' as string]: island.accent }}
    >
      <div ref={paper} className="sheet__paper panel panel--page">
        <div className="sheet__grip" {...dragHandlers}>
          <button
            type="button"
            className="sheet__handle"
            aria-label={expanded ? 'Réduire la page' : 'Agrandir la page'}
            aria-expanded={expanded}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setExpanded(!expanded);
              }
            }}
          />
        </div>
        <header className="sheet__header" {...dragHandlers}>
          <div className="sheet__heading">
            <p className="eyebrow" style={{ color: inkFor(island.accent) }}>
              {island.tagline}
            </p>
            <h2 id="sheet-title" className="panel__title mt-1">{island.label}</h2>
          </div>
          {stamp && (
            <div className="panel__stamp" aria-hidden="true">
              <Stamp stamp={stamp} earned={visited} />
            </div>
          )}
          <button type="button" onClick={close} className="sheet__close" aria-label="Fermer et revenir au monde">
            <CloseIcon />
            <span>Fermer</span>
          </button>
        </header>
        <div
          ref={body}
          className="sheet__body"
          onScroll={() => {
            // Téléphone : lire, c'est déplier la page en grand.
            if (phone && !expanded && !drag.current && (body.current?.scrollTop ?? 0) > 24) setExpanded(true);
          }}
        >
          <Content />
          {next && next.id !== displayed && (
            <button
              type="button"
              className="sheet__next"
              style={{ ['--accent' as string]: next.accent }}
              onClick={() => sailTo(next.id)}
            >
              <span>
                <small>Cap suivant</small>
                <strong>{next.label}</strong>
              </span>
              <i aria-hidden="true">→</i>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
