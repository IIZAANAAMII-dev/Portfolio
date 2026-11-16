'use client';

import { useEffect, useRef } from 'react';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { fr } from '@/components/ui/typography';
import { probe } from './bridge';
import { clockNow } from './fishing-data';
import { ArrowIcon, CloseIcon, FlagIcon, RestartIcon } from './icons';
import { COURSE, MARKS, raceClock, useRegatta } from './regatta';
import styles from './gameplay.module.css';

/** La marque de départ est en vue : la régate se propose. */
export function RegattaHint() {
  const best = useRegatta((s) => s.best);
  const start = useRegatta((s) => s.start);
  return (
    <div className={styles.pill} data-enter="">
      <FlagIcon className={styles.pillFlag} />
      <p className={styles.pillText}>
        <span className={styles.label}>La régate des bouées</span>
        <span className={styles.voice}>
          {fr(best !== null ? `Ton record : ${raceClock(best)}. Tu le bats ?` : 'Six bouées autour du port, un chrono : à toi de jouer.')}
        </span>
      </p>
      <button type="button" className={styles.primary} onClick={start}>
        Départ
      </button>
    </div>
  );
}

/** Pendant la régate : prochaine marque (flèche à l'écran), chrono, puis le résultat. */
export function RegattaDock() {
  const phase = useRegatta((s) => s.phase);
  const leg = useRegatta((s) => s.leg);
  const time = useRegatta((s) => s.time);
  const best = useRegatta((s) => s.best);
  const record = useRegatta((s) => s.record);
  const start = useRegatta((s) => s.start);
  const abort = useRegatta((s) => s.abort);
  const clock = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const racing = phase === 'armed' || phase === 'racing';

  // Chrono et flèche écrits directement dans le DOM (aucun rendu React par image).
  useEffect(() => {
    if (!racing) return;
    let frame = 0;
    const loop = () => {
      const race = useRegatta.getState();
      if (clock.current) clock.current.textContent = raceClock(race.phase === 'racing' ? clockNow() - race.startAt : 0);
      if (arrow.current && race.phase !== 'off' && race.phase !== 'finished') {
        const [x, z] = MARKS[COURSE[race.leg]];
        const dx = x - boatState.position.x;
        const dz = z - boatState.position.z;
        const across = dx * -probe.viewZ + dz * probe.viewX;
        const along = dx * probe.viewX + dz * probe.viewZ;
        arrow.current.style.transform = `rotate(${((Math.atan2(across, along) * 180) / Math.PI).toFixed(1)}deg)`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [racing]);

  const sailToMark = () => {
    const [x, z] = MARKS[COURSE[useRegatta.getState().leg]];
    useWorld.getState().sailToPoint([x, z]);
  };

  // Un instrument compact (étiquette, puis chrono et boutons sur une ligne) : sur téléphone, il
  // tient entre la boussole et la radio, sous les sous-titres de la visite guidée.
  if (phase === 'finished') {
    const verdict = fr(record ? 'Arrivée · nouveau record !' : best !== null ? `Arrivée · record ${raceClock(best)}` : 'Arrivée !');
    return (
      <div className={styles.race} data-enter="">
        <span className={styles.label}>{verdict}</span>
        <div className={styles.raceRow}>
          <span className={styles.timer}>{raceClock(time)}</span>
          <button type="button" className={`${styles.primary} ${styles.squeeze}`} onClick={start} aria-label="Recommencer la régate">
            <RestartIcon className={styles.icon} />
            <span className={styles.wide}>Recommencer</span>
          </button>
          <button type="button" className={styles.round} onClick={abort} aria-label="Fermer le résultat" title="Fermer">
            <CloseIcon className={styles.icon} />
          </button>
        </div>
      </div>
    );
  }

  const finale = leg === COURSE.length - 1;
  const label = phase === 'armed' ? 'Passe la bouée de départ' : finale ? 'Ligne d’arrivée' : `Bouée ${leg}/${COURSE.length - 2}`;
  const heading = phase === 'armed' ? 'Cap sur le départ' : finale ? 'Cap sur l’arrivée' : 'Cap sur la bouée';
  return (
    <div className={styles.race} data-enter="">
      <span className={styles.label}>{fr(`Régate · ${label}`)}</span>
      <div className={styles.raceRow}>
        <span ref={clock} className={styles.timer} role="timer" aria-live="off">
          {raceClock(0)}
        </span>
        <button type="button" className={`${styles.primary} ${styles.squeeze}`} onClick={sailToMark} aria-label={heading}>
          <span ref={arrow} className={styles.raceArrow}>
            <ArrowIcon className={styles.icon} />
          </span>
          <span className={styles.wide}>{heading}</span>
        </button>
        <button type="button" className={styles.round} onClick={abort} aria-label="Abandonner la régate" title="Abandonner">
          <CloseIcon className={styles.icon} />
        </button>
      </div>
    </div>
  );
}
