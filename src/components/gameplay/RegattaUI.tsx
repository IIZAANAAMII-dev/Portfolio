'use client';

import { useEffect, useRef } from 'react';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { probe } from './bridge';
import { clockNow } from './fishing-data';
import { ArrowIcon, CloseIcon, FlagIcon } from './icons';
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
          {best !== null ? `Ton record : ${raceClock(best)}. Tu le bats ?` : 'Six bouées autour du port, un chrono : à toi de jouer.'}
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

  if (phase === 'finished') {
    return (
      <div className={styles.race} data-enter="">
        <span className={styles.label}>Arrivée&nbsp;!</span>
        <span className={styles.timer}>{raceClock(time)}</span>
        <span className={styles.record}>
          {record ? 'Nouveau record !' : best !== null ? `Record : ${raceClock(best)}` : ''}
        </span>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={start}>
            Recommencer
          </button>
          <button type="button" className={styles.ghost} onClick={abort}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const finale = leg === COURSE.length - 1;
  const label = phase === 'armed' ? 'Bouée de départ' : finale ? 'Ligne d’arrivée' : `Bouée ${leg}/${COURSE.length - 2}`;
  return (
    <div className={styles.race} data-enter="">
      <span className={styles.label}>La régate des bouées · {label}</span>
      <span ref={clock} className={styles.timer} role="timer" aria-live="off">
        {raceClock(0)}
      </span>
      {phase === 'armed' && <span className={styles.record}>Passe la bouée de départ pour lancer le chrono.</span>}
      <div className={styles.row}>
        <button type="button" className={styles.primary} onClick={sailToMark}>
          <span ref={arrow} className={styles.raceArrow}>
            <ArrowIcon className={styles.icon} />
          </span>
          {phase === 'armed' ? 'Cap sur le départ' : finale ? 'Cap sur l’arrivée' : 'Cap sur la bouée'}
        </button>
        <button type="button" className={styles.round} onClick={abort} aria-label="Abandonner la régate" title="Abandonner">
          <CloseIcon className={styles.icon} />
        </button>
      </div>
    </div>
  );
}
