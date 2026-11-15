'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { site } from '@/data/site';
import { INTRO_DURATION } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { isCoarsePointer } from '@/lib/utils/device';
import { clamp, smoothstep } from '@/lib/utils/math';
import styles from './intro.module.css';

const [FIRST_NAME, ...FAMILY] = site.name.split(' ');
const FAMILY_NAME = FAMILY.join(' ');

/** Classe à poser sur le vrai titre du cartouche pendant que sa copie s'envole. */
export const handedOffClass = styles.handedOff;

/** Instant (s depuis le clic) où le nom quitte le cartouche, et durée de sa glissade. */
const GLIDE_FROM = 1.25;
const GLIDE_LENGTH = 1.15;

/** Arrivée avec un petit dépassement (« back ») : le nom se pose comme un objet lancé. */
function easeOutBack(value: number) {
  const x = clamp(value, 0, 1) - 1;
  return 1 + 2.3 * x * x * x + 1.3 * x * x;
}

/**
 * Pendant l'ouverture, un clic, Entrée, Espace ou Échap passent directement à la fin (le
 * monde se pose en une demi-seconde). Le clic est consommé : il ne lance pas le bateau.
 */
function useSkip(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Le clic qui a largué les amarres ne doit pas aussi passer l'ouverture.
    const armedAt = performance.now() + 380;
    const skip = (event: Event) => {
      const world = useWorld.getState();
      if (world.phase !== 'transitioning' || performance.now() < armedAt) return;
      event.stopPropagation();
      event.preventDefault();
      world.revealComplete();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') skip(event);
    };
    window.addEventListener('click', skip, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('click', skip, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [active]);
}

/**
 * Copie du nom posée sur le cartouche. Elle suit l'horloge de la cinématique (et non le temps
 * du navigateur) : si le rendu ralentit, le nom reste synchrone avec la caméra et les îles.
 */
function FlyingTitle({ leaving }: { leaving: boolean }) {
  const root = useRef<HTMLParagraphElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const family = useRef<HTMLSpanElement>(null);

  // Avant la première peinture : la copie ne doit jamais apparaître ailleurs qu'à sa place.
  useLayoutEffect(() => {
    const node = root.current;
    const name = first.current;
    const second = family.current;
    const source = document.querySelector<HTMLElement>('.intro-brand .intro-title');
    if (!node || !name || !second || !source) return;
    const origin = source.getBoundingClientRect();
    node.style.left = `${origin.left}px`;
    node.style.top = `${origin.top}px`;
    // Destination : la marque du HUD (même police et même graisse, en petit).
    const brand = document.querySelector<HTMLElement>('.hud-brand');
    const target = brand?.getBoundingClientRect();
    let glide: { dx: number; dy: number; scale: number } | null = null;
    if (brand && target && target.width > 0) {
      const line = name.getBoundingClientRect();
      const scale = parseFloat(getComputedStyle(brand).fontSize) / parseFloat(getComputedStyle(name).fontSize);
      glide = {
        dx: target.left - line.left,
        dy: target.top + target.height / 2 - (line.top + (line.height * scale) / 2),
        scale,
      };
    }
    let shown = -1;
    const apply = (seconds: number) => {
      if (Math.abs(seconds - shown) < 0.001) return;
      shown = seconds;
      // Le nom de famille s'efface en tombant…
      const drop = clamp((seconds - (GLIDE_FROM - 0.18)) / 0.52, 0, 1);
      const fall = drop * drop * drop;
      second.style.opacity = (1 - fall).toFixed(3);
      second.style.transform = `translateY(${(fall * 0.32).toFixed(3)}em)`;
      // … pendant que le prénom rapetisse et file vers le HUD.
      const progress = easeOutBack((seconds - GLIDE_FROM) / GLIDE_LENGTH);
      if (glide) {
        const scale = 1 + (glide.scale - 1) * progress;
        name.style.transform = `translate(${(glide.dx * progress).toFixed(1)}px, ${(glide.dy * progress).toFixed(1)}px) scale(${scale.toFixed(4)})`;
        name.style.letterSpacing = `${(0.01 + 0.15 * clamp(progress, 0, 1)).toFixed(4)}em`;
      } else {
        // Pas de marque visible : le prénom s'efface simplement.
        name.style.opacity = (1 - smoothstep(GLIDE_FROM, GLIDE_FROM + 0.6, seconds)).toFixed(3);
      }
    };
    apply(useWorld.getState().gameTransition * INTRO_DURATION);
    // Ouverture passée : le nom reste où il est et s'efface (classe « leaving »).
    return useWorld.subscribe((state) => {
      if (state.phase === 'transitioning') apply(state.gameTransition * INTRO_DURATION);
    });
  }, []);

  return (
    <p ref={root} className={`intro-title ${styles.title} ${leaving ? styles.leaving : ''}`} aria-hidden="true">
      <span ref={first} className={styles.line}>
        {FIRST_NAME}
      </span>
      <span ref={family} className={`${styles.line} ${styles.family}`}>
        {FAMILY_NAME}
      </span>
    </p>
  );
}

/**
 * Le nom, pendant l'ouverture : il quitte le cartouche, rapetisse et glisse jusqu'à la marque
 * du HUD, puis lui passe le relais en fondu quand le HUD apparaît. Absent en mouvement réduit.
 */
export function IntroTitle() {
  const phase = useWorld((state) => state.phase);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const [touch] = useState(isCoarsePointer);
  const [seen, setSeen] = useState(phase);
  const [handoff, setHandoff] = useState(false);
  if (seen !== phase) {
    setSeen(phase);
    setHandoff(seen === 'transitioning' && phase === 'playing' && !reducedMotion);
  }
  useEffect(() => {
    if (!handoff) return;
    const id = window.setTimeout(() => setHandoff(false), 900);
    return () => window.clearTimeout(id);
  }, [handoff]);

  const flying = phase === 'transitioning' && !reducedMotion;
  useSkip(flying);
  if (!flying && !handoff) return null;
  return (
    <>
      <FlyingTitle leaving={handoff} />
      {flying && (
        <p className={styles.skip} aria-hidden="true">
          {touch ? 'Touche pour passer' : (
            <>
              Clic ou <kbd>Échap</kbd> pour passer
            </>
          )}
        </p>
      )}
    </>
  );
}
