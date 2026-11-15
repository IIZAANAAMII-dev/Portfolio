'use client';

import { useEffect, useRef, useState } from 'react';
import { site } from '@/data/site';
import { useWorld } from '@/lib/store';
import { isCoarsePointer } from '@/lib/utils/device';
import styles from './intro.module.css';

const [FIRST_NAME, ...FAMILY] = site.name.split(' ');
const FAMILY_NAME = FAMILY.join(' ');

/** Classe à poser sur le vrai titre du cartouche pendant que sa copie s'envole. */
export const handedOffClass = styles.handedOff;

/** Instant (ms) où le nom quitte le cartouche, et durée de sa glissade vers le HUD. */
const GLIDE_DELAY = 1250;
const GLIDE_DURATION = 1150;

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

function FlyingTitle({ leaving }: { leaving: boolean }) {
  const root = useRef<HTMLParagraphElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const family = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = root.current;
    const name = first.current;
    const second = family.current;
    const source = document.querySelector<HTMLElement>('.intro-title');
    if (!node || !name || !second || !source) return;
    // La copie se pose exactement sur le titre du cartouche…
    const origin = source.getBoundingClientRect();
    node.style.left = `${origin.left}px`;
    node.style.top = `${origin.top}px`;
    const animations: Animation[] = [];
    // … le nom de famille s'efface en tombant, pendant que le prénom part vers le HUD.
    animations.push(
      second.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(0.32em)' },
        ],
        { duration: 520, delay: GLIDE_DELAY - 180, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'both' },
      ),
    );
    const brand = document.querySelector<HTMLElement>('.hud-brand');
    const target = brand?.getBoundingClientRect();
    if (brand && target && target.width > 0) {
      const line = name.getBoundingClientRect();
      const scale = parseFloat(getComputedStyle(brand).fontSize) / parseFloat(getComputedStyle(name).fontSize);
      const dx = target.left - line.left;
      const dy = target.top + target.height / 2 - (line.top + (line.height * scale) / 2);
      animations.push(
        name.animate(
          [
            { transform: 'translate(0px, 0px) scale(1)', letterSpacing: '0.01em' },
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`, letterSpacing: '0.16em' },
          ],
          { duration: GLIDE_DURATION, delay: GLIDE_DELAY, easing: 'cubic-bezier(0.34, 1.3, 0.5, 1)', fill: 'both' },
        ),
      );
    } else {
      // Pas de marque visible (petit écran) : le prénom s'efface simplement.
      animations.push(
        name.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: GLIDE_DELAY, easing: 'ease', fill: 'both' }),
      );
    }
    return () => animations.forEach((animation) => animation.cancel());
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
