'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  autoTier,
  deviceProfile,
  forcedTier,
  tierDpr,
  tierRank,
  TIER_LABELS,
  useGraphicsStatus,
  useRenderDpr,
  type GraphicsMode,
  type GraphicsTier,
} from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { fr } from './typography';
import styles from './GraphicsSettings.module.css';

/** Auto en tête, puis du plus riche au plus léger. */
const OPTIONS: readonly GraphicsMode[] = ['auto', 'high', 'medium', 'low', 'minimal'];

/** Angle de l'aiguille du cadran selon le palier (du plus léger au plus riche). */
const NEEDLE: Record<GraphicsTier, number> = { minimal: -62, low: -22, medium: 22, high: 62 };

/** Cadran de manomètre : l'aiguille montre le palier en cours. */
function GaugeIcon({ tier }: { tier: GraphicsTier }) {
  return (
    <svg className="hud-btn__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.1 14.6a7.4 7.4 0 1 1 13.8 0z" fill="currentColor" fillOpacity="0.14" />
      <path d="M5.6 9.5l.9.5M10 5.4v1.1M14.4 9.5l-.9.5" />
      <g transform={`rotate(${NEEDLE[tier]} 10 13)`}>
        <path d="M10 13V7.4" />
      </g>
      <circle cx="10" cy="13" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface GraphicsSettingsProps {
  /** Côté où s'ouvre le panneau : sous le bouton (barre du haut, défaut) ou au-dessus. */
  placement?: 'below' | 'above';
  /** Bord du bouton sur lequel le panneau s'aligne (défaut : à droite, `end`). */
  align?: 'end' | 'start';
  /** Classe ajoutée au bouton (il porte déjà les classes `hud-btn` du HUD). */
  className?: string;
}

/**
 * Réglage « Graphismes » : un bouton compact (même verre et même typographie que la barre du
 * HUD) qui ouvre un petit menu — Auto (le régulateur choisit et l'affiche, « Auto ·
 * Équilibré »), Élevé, Équilibré, Économie, Très léger. Le choix est enregistré
 * (localStorage) ; un choix manuel fige le palier (seule la résolution peut encore baisser
 * en cas d'effondrement). `?quality=` dans l'adresse l'emporte : le menu l'indique.
 * Clavier : Entrée / Espace ou ↓ ouvrent, ↑ ↓ Début Fin parcourent, Échap referme.
 */
export function GraphicsSettings({ placement = 'below', align = 'end', className }: GraphicsSettingsProps) {
  const mode = useWorld((state) => state.graphicsMode);
  const tier = useWorld((state) => state.tier);
  const setGraphicsMode = useWorld((state) => state.setGraphicsMode);
  const dpr = useRenderDpr((state) => state.dpr);
  const thermal = useGraphicsStatus((state) => state.thermal);
  const capped = useGraphicsStatus((state) => state.capped);
  const [open, setOpen] = useState(false);
  const [forced] = useState(() => forcedTier());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const current = TIER_LABELS[tier].name;
  const value = fr(mode === 'auto' ? `Auto · ${current}` : current);

  // À l'ouverture, le focus va sur l'option choisie ; un clic ailleurs referme.
  useEffect(() => {
    if (!open) return;
    const selected = Math.max(0, OPTIONS.indexOf(mode));
    const frame = requestAnimationFrame(() => items.current[selected]?.focus());
    const onDown = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, mode]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const choose = (option: GraphicsMode) => {
    if (forced) return;
    setGraphicsMode(option);
    close(true);
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = OPTIONS.length;
    const index = items.current.findIndex((item) => item === document.activeElement);
    const focusAt = (next: number) => items.current[(next + count) % count]?.focus();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(count - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  // Pied du menu : la carte graphique, la résolution réduite par le régulateur, la cadence.
  const profile = open ? deviceProfile() : null;
  const trimmed = open && dpr < tierDpr(tier) - 0.005;
  const footer = profile
    ? fr([profile.gpu || 'Carte graphique non communiquée', trimmed ? 'résolution réduite' : '', capped ? '30 images/s' : '']
      .filter(Boolean)
      .join(' · '))
    : '';
  const recommended = open ? TIER_LABELS[autoTier()].name : '';

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={['hud-btn', styles.trigger, className].filter(Boolean).join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={fr(`Graphismes : ${value}`)}
        title="Graphismes"
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={onTriggerKey}
      >
        <GaugeIcon tier={tier} />
        <span className="hud-btn__label">{value}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Graphismes"
          className={styles.panel}
          data-placement={placement}
          data-align={align}
          onKeyDown={onMenuKey}
        >
          <p className={styles.title} aria-hidden="true">Graphismes</p>
          <div className={styles.list}>
            {OPTIONS.map((option, index) => {
              const checked = option === mode;
              const name = option === 'auto' ? 'Auto' : TIER_LABELS[option].name;
              const hint = fr(option === 'auto'
                ? mode === 'auto'
                  ? `S’adapte en continu à ton appareil · actuellement ${current}.`
                  : `S’adapte en continu à ton appareil. Conseillé : ${recommended}.`
                : TIER_LABELS[option].hint);
              const level = option === 'auto' ? null : tierRank(option);
              return (
                <button
                  key={option}
                  ref={(element) => {
                    items.current[index] = element;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  aria-disabled={forced ? true : undefined}
                  tabIndex={checked ? 0 : -1}
                  className={styles.option}
                  data-level={level ?? undefined}
                  onClick={() => choose(option)}
                >
                  <span className={styles.mark} aria-hidden="true" />
                  <span className={styles.name}>{fr(name)}</span>
                  <span className={styles.hint}>{hint}</span>
                </button>
              );
            })}
          </div>
          {forced && <p className={styles.note}>{fr(`Fixé par l’adresse de la page (?quality=${forced}).`)}</p>}
          {!forced && thermal && mode === 'auto' && (
            <p className={styles.note}>{fr('L’appareil chauffe : Auto reste plus léger quelques minutes.')}</p>
          )}
          {footer && <p className={styles.footer}>{footer}</p>}
        </div>
      )}
    </div>
  );
}
