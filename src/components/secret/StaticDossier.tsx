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
 *  - Le voile VHS : lignes de balayage, neige et bande de défilement qui montent à mesure
 *    que le bateau s'approche de l'île (rien du tout au large).
 *  - Le dossier : révélé par une caméra de surveillance ou par l'approche du bateau. Une
 *    pochette de bande VHS classée : étiquette manuscrite, compteur REC, fiche, rôles, index
 *    des piliers du jeu, tampon « en développement » et mention honnête.
 * Les textes viennent tous de `data/yellow-static.ts`.
 */

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Le pitch se tape lettre à lettre (le texte complet reste lisible par les lecteurs d'écran). */
function useTypewriter(text: string, instant: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (instant) return;
    let index = 0;
    let interval = 0;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1;
        setCount(index);
        if (index >= text.length) window.clearInterval(interval);
      }, 24);
    }, 650);
    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [instant, text]);
  return instant ? text : text.slice(0, count);
}

function Dossier() {
  const close = useStaticDossier((state) => state.close);
  const reduced = useWorld((state) => state.reducedMotion);
  const dialog = useRef<HTMLDivElement>(null);
  const eject = useRef<HTMLButtonElement>(null);
  const timecode = useRef<HTMLSpanElement>(null);
  const typed = useTypewriter(yellowStatic.pitch, reduced);
  const [first, ...rest] = yellowStatic.title.split(' ');

  // Focus : déplacé dans le dialogue, piégé, rendu à l'élément d'origine à la fermeture.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    eject.current?.focus({ preventScroll: true });
    tapeInsert();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
    // Phase de capture : Échap ferme le dossier sans fermer aussi le panneau d'île.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [close]);

  // Compteur de bande (heures:minutes:secondes:images), écrit hors React.
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const target = timecode.current;
      if (!target) return;
      const elapsed = (performance.now() - start) / 1000;
      const seconds = Math.floor(elapsed);
      target.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(Math.floor((elapsed % 1) * 25))}`;
    }, 40);
    return () => window.clearInterval(id);
  }, []);

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
        <div className={styles.screen} aria-hidden="true">
          <span className={styles.rec}>Rec</span>
          <span>▶ Lecture</span>
          <span>SP</span>
          <span ref={timecode} className={styles.timecode}>
            00:00:00:00
          </span>
        </div>

        <div className={styles.body}>
          <div>
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

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Fiche</h3>
              <dl className={styles.facts}>
                {yellowStatic.facts.map((fact) => (
                  <div key={fact.label} className={styles.fact}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Rôles</h3>
              <ul className={styles.roles}>
                {yellowStatic.roles.map((role) => (
                  <li key={role} className={styles.role}>
                    {role}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div>
            <p className={styles.eyebrow}>Projet personnel · {yellowStatic.engine}</p>
            <h2 id="yellow-static-title" className={styles.title}>
              {first}
              <span>{rest.join(' ')}</span>
            </h2>
            <p id="yellow-static-pitch" className={styles.pitch}>
              <span className={styles.srOnly}>{yellowStatic.pitch}</span>
              <span aria-hidden="true" className={typing ? styles.typed : undefined}>
                {typed}
              </span>
            </p>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Index de la bande</h3>
              <ol className={styles.tracks}>
                {yellowStatic.pillars.map((pillar) => (
                  <li key={pillar.title} className={styles.track}>
                    <strong>{pillar.title}</strong>
                    <p>{pillar.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <p className={styles.stamp}>« {yellowStatic.status} »</p>
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
            ref={eject}
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

/** Voile VHS plein écran, proportionnel à la proximité du bateau (rien au large). */
function VhsVeil() {
  const veil = useRef<HTMLDivElement>(null);
  const noise = useRef<HTMLCanvasElement>(null);
  const reduced = useWorld((state) => state.reducedMotion);
  const dossierOpen = useStaticDossier((state) => state.open);

  useEffect(() => {
    const element = veil.current;
    const canvas = noise.current;
    if (!element || !canvas) return;
    const context = canvas.getContext('2d');
    const image = context ? context.createImageData(canvas.width, canvas.height) : null;
    let level = 0;
    let frame = 0;
    let last = 0;
    let shown = false;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const target = dossierOpen ? 0 : proximityNow();
      level += (target - level) * 0.06;
      if (level < 0.006) {
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
      element.style.opacity = (Math.min(1, level) * 0.8).toFixed(3);
      if (reduced || !context || !image || now - last < 70) return;
      last = now;
      const data = image.data;
      for (let index = 0; index < data.length; index += 4) {
        const value = Math.random() * 255;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [dossierOpen, reduced]);

  return (
    <div ref={veil} className={styles.veil} aria-hidden="true" style={{ visibility: 'hidden' }}>
      <canvas ref={noise} width={160} height={90} className={styles.veilNoise} />
      <div className={styles.veilScan} />
      {!reduced && <div className={styles.veilBand} />}
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
