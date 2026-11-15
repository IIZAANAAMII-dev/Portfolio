'use client';

import { useEffect, useRef, useState } from 'react';
import { yellowStatic } from '@/data/yellow-static';
import { useWorld } from '@/lib/store';
import styles from './dossier.module.css';
import { proximityNow } from './signal';
import { tapeInsert } from './static-audio';
import { useStaticDossier } from './static-store';

/**
 * YELLOW STATIC — l'interface (racine DOM).
 *  - Le voile VHS : neige analogique, lignes de balayage, bande de défilement et « ● REC »
 *    qui montent à mesure que le bateau s'approche de l'île (rien du tout au large).
 *  - Le dossier : révélé par une caméra de surveillance ou par l'approche du bateau. Une
 *    pochette de bande VHS classée : étiquette manuscrite, compteur REC, fiche, rôles, index
 *    des piliers du jeu, tampon « en développement » et mention honnête.
 * Les textes viennent tous de `data/yellow-static.ts`.
 */

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Date du jour à la manière d'un caméscope (« 15 NOV. 2026 », mise en capitales en CSS). */
function camcorderDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Le pitch se tape lettre à lettre (le texte complet reste lisible par les lecteurs d'écran).
 * Le nombre de lettres suit le temps écoulé : sur un appareil lent, la frappe rattrape son
 * retard au lieu de ralentir.
 */
function useTypewriter(text: string, instant: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (instant) return;
    const start = performance.now() + 650;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.min(text.length, Math.floor((performance.now() - start) / 24)));
      setCount(next);
      if (next >= text.length) window.clearInterval(interval);
    }, 24);
    return () => window.clearInterval(interval);
  }, [instant, text]);
  return instant ? text : text.slice(0, count);
}

function Dossier() {
  const close = useStaticDossier((state) => state.close);
  const reduced = useWorld((state) => state.reducedMotion);
  const dialog = useRef<HTMLDivElement>(null);
  const stop = useRef<HTMLButtonElement>(null);
  const timecode = useRef<HTMLSpanElement>(null);
  const date = useRef<HTMLSpanElement>(null);
  const typed = useTypewriter(yellowStatic.pitch, reduced);
  const [first, ...rest] = yellowStatic.title.split(' ');

  // Focus : déplacé dans le dialogue, piégé, rendu à l'élément d'origine à la fermeture.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stop.current?.focus({ preventScroll: true });
    tapeInsert();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Phase de capture : Échap ferme le dossier sans fermer aussi le panneau d'île.
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }
      const root = dialog.current;
      if (event.key !== 'Tab' || !root) return;
      const focusables = [...root.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')];
      if (focusables.length === 0) return;
      const head = focusables[0];
      const tail = focusables[focusables.length - 1];
      if (!root.contains(document.activeElement)) {
        event.preventDefault();
        head.focus();
      } else if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [close]);

  // Compteur de bande (heures:minutes:secondes:images) et date, écrits hors React.
  useEffect(() => {
    if (date.current) date.current.textContent = camcorderDate(new Date());
    const start = performance.now();
    const tick = () => {
      const target = timecode.current;
      if (!target) return;
      const elapsed = (performance.now() - start) / 1000;
      const seconds = Math.floor(elapsed);
      const frames = reduced ? 0 : Math.floor((elapsed % 1) * 25);
      target.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(frames)}`;
    };
    tick();
    const id = window.setInterval(tick, reduced ? 1000 : 40);
    return () => window.clearInterval(id);
  }, [reduced]);

  const typing = typed.length < yellowStatic.pitch.length;

  return (
    <div className={`${styles.backdrop} ${reduced ? styles.still : ''}`} onClick={close}>
      <div
        ref={dialog}
        className={styles.file}
        role="dialog"
        aria-modal="true"
        aria-labelledby="yellow-static-title"
        aria-describedby="yellow-static-pitch"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.screen}>
          <div className={styles.osd} aria-hidden="true">
            <span className={styles.rec}>Rec</span>
            <span className={styles.optional}>▶ Lecture</span>
            <span className={styles.optional}>SP</span>
            <span ref={date} className={styles.optional} />
            <span ref={timecode} className={styles.timecode}>
              00:00:00:00
            </span>
          </div>
          <button
            ref={stop}
            type="button"
            className={styles.stop}
            onClick={close}
            aria-label={`Fermer le dossier ${yellowStatic.title}`}
          >
            <span aria-hidden="true">■</span> Fermer
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>Projet personnel · {yellowStatic.engine}</p>
            <h2 id="yellow-static-title" className={styles.title}>
              {first} <span>{rest.join(' ')}</span>
            </h2>
            <p id="yellow-static-pitch" className={styles.pitch}>
              <span className={styles.srOnly}>{yellowStatic.pitch}</span>
              <span aria-hidden="true" className={typing ? styles.typed : undefined}>
                {typed}
              </span>
            </p>
          </div>

          <p className={styles.stamp}>
            <span className={styles.srOnly}>Statut : </span>
            {yellowStatic.status}
          </p>

          <div className={styles.cassette} aria-hidden="true">
            <div className={styles.label}>
              <span className={styles.labelTitle}>{yellowStatic.title}</span>
              <span className={styles.labelNote}>▶ ne pas effacer</span>
            </div>
            <div className={styles.window}>
              <span className={styles.reel} />
              <span className={styles.reel} />
            </div>
          </div>

          <div className={styles.side}>
            <section className={styles.section} aria-labelledby="yellow-static-facts">
              <h3 id="yellow-static-facts" className={styles.sectionTitle}>
                Fiche
              </h3>
              <dl className={styles.facts}>
                {yellowStatic.facts.map((fact) => (
                  <div key={fact.label} className={styles.fact}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={styles.section} aria-labelledby="yellow-static-roles">
              <h3 id="yellow-static-roles" className={styles.sectionTitle}>
                Rôles
              </h3>
              <ul className={styles.roles}>
                {yellowStatic.roles.map((role) => (
                  <li key={role} className={styles.role}>
                    {role}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${styles.section} ${styles.index}`} aria-labelledby="yellow-static-index">
            <h3 id="yellow-static-index" className={styles.sectionTitle}>
              Index de la bande
            </h3>
            <ol className={styles.tracks}>
              {yellowStatic.pillars.map((pillar) => (
                <li key={pillar.title} className={styles.track}>
                  <strong>{pillar.title}</strong>
                  <p>{pillar.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className={styles.seal} aria-hidden="true">
            <span>
              <b>▦</b>
              Signal jaune
            </span>
          </div>
        </div>

        <footer className={styles.footer}>
          <p className={styles.disclaimer}>{yellowStatic.disclaimer}</p>
          <button
            type="button"
            className={styles.eject}
            onClick={close}
            aria-label={`Éjecter la cassette : fermer le dossier ${yellowStatic.title}`}
          >
            <span aria-hidden="true">⏏</span> Éjecter
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Neige analogique : chaque ligne est un bruit lissé horizontalement (des traînées, pas des
 * pixels), et quelques lignes « décrochent » en clair, comme une bande usée.
 */
function paintSnow(image: ImageData) {
  const { data, width, height } = image;
  let index = 0;
  for (let y = 0; y < height; y++) {
    const dropout = Math.random() < 0.035 ? 60 + Math.random() * 90 : 0;
    let value = Math.random() * 255;
    for (let x = 0; x < width; x++) {
      value = value * 0.5 + Math.random() * 127.5;
      const shade = Math.min(255, value + dropout);
      data[index] = shade;
      data[index + 1] = shade;
      data[index + 2] = shade;
      data[index + 3] = 255;
      index += 4;
    }
  }
}

/** Voile VHS plein écran, proportionnel à la proximité du bateau (rien au large). */
function VhsVeil() {
  const veil = useRef<HTMLDivElement>(null);
  const noise = useRef<HTMLCanvasElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  /** Niveau lissé, conservé d'un effet à l'autre (fondu quand le dossier s'ouvre/se ferme). */
  const level = useRef(0);
  const reduced = useWorld((state) => state.reducedMotion);
  const dossierOpen = useStaticDossier((state) => state.open);

  useEffect(() => {
    const element = veil.current;
    const canvas = noise.current;
    if (!element || !canvas) return;
    const context = canvas.getContext('2d');
    const image = context ? context.createImageData(canvas.width, canvas.height) : null;
    if (context && image) {
      paintSnow(image);
      context.putImageData(image, 0, 0);
    }
    let frame = 0;
    let previous = performance.now();
    let lastNoise = 0;
    let lastClock = -1;
    let recorded = 0;
    let shown = element.style.visibility === 'visible';

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.25, Math.max(0, (now - previous) / 1000));
      previous = now;
      const target = dossierOpen ? 0 : proximityNow();
      level.current += (target - level.current) * (1 - Math.exp(-dt * 2.4));
      const value = level.current;
      if (value < 0.006) {
        recorded = 0;
        if (shown) {
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
          shown = false;
        }
        return;
      }
      if (!shown) {
        element.style.visibility = 'visible';
        shown = true;
      }
      element.style.opacity = (Math.min(1, value) * 0.78).toFixed(3);
      element.style.setProperty('--osd', Math.max(0, Math.min(1, (value - 0.3) * 2.5)).toFixed(3));

      // Compteur « REC » : le temps passé dans le champ de la caméra.
      recorded += dt;
      const seconds = Math.floor(recorded);
      if (seconds !== lastClock && clock.current) {
        lastClock = seconds;
        clock.current.textContent = `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
      }

      if (reduced || !context || !image || now - lastNoise < 70) return;
      lastNoise = now;
      paintSnow(image);
      context.putImageData(image, 0, 0);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [dossierOpen, reduced]);

  return (
    <div ref={veil} className={styles.veil} aria-hidden="true" style={{ visibility: 'hidden' }}>
      <canvas ref={noise} width={128} height={240} className={styles.veilNoise} />
      <div className={styles.veilScan} />
      {!reduced && <div className={styles.veilBand} />}
      {!reduced && <div className={styles.veilHead} />}
      <div className={styles.veilOsd}>
        <span className={styles.rec}>Rec</span>
        <span ref={clock} className={styles.veilTime}>
          0:00:00
        </span>
        <span>SP</span>
      </div>
    </div>
  );
}

export default function StaticDossier() {
  const open = useStaticDossier((state) => state.open);
  const session = useStaticDossier((state) => state.session);

  // Aide de capture en développement : ouvrir le dossier sans naviguer jusqu'à l'île.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__openStaticDossier = () => useStaticDossier.getState().reveal('debug');
    return () => {
      delete target.__openStaticDossier;
    };
  }, []);

  return (
    <>
      <VhsVeil />
      {open && <Dossier key={session} />}
    </>
  );
}
