'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { logbook, useLogbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { radio, type StationId } from './radio-engine';
import styles from './MarineRadio.module.css';

/**
 * Radio marine (DOM) : un petit poste ancien en noyer et laiton, dans le coin libre en bas
 * à droite (en miroir de la boussole). Il ouvre un cadran à aiguille et quatre touches
 * d'ivoire : « Mer calme » (l'ambiance du monde), « Port breton » (air de fest-noz original),
 * « Lo-fi du large » (accords doux et vinyle), « Silence radio » (musique coupée).
 * Choisir une station allume le son s'il était coupé ; le premier changement de station
 * vaut un tampon au carnet.
 */

interface Station {
  id: StationId;
  name: string;
  hint: string;
  playing: string;
  /** Position de l'aiguille sur le cadran (%). */
  dial: number;
}

const STATIONS: Station[] = [
  { id: 'calme', name: 'Mer calme', hint: 'ressac et musique du bord', playing: 'Ressac et musique du bord', dial: 13 },
  { id: 'port', name: 'Port breton', hint: 'air de fest-noz', playing: 'En direct du port : un air de fest-noz', dial: 38 },
  { id: 'lofi', name: 'Lo-fi du large', hint: 'accords doux, vinyle', playing: 'Accords doux et craquements de vinyle', dial: 63 },
  { id: 'silence', name: 'Silence radio', hint: 'rien que la mer', playing: 'Radio coupée : rien que la mer', dial: 88 },
];

const subscribe = (listener: () => void) => radio.subscribe(listener);
const getPlaying = () => radio.playing;
const getServerPlaying = () => false;

/** Le poste vu de face, en miniature (bouton du coin). */
function RadioIcon({ needle, live }: { needle: number; live: boolean }) {
  return (
    <svg className={styles.icon} viewBox="0 0 52 42" aria-hidden="true">
      <defs>
        <linearGradient id="radio-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a6339" />
          <stop offset="1" stopColor="#5d3620" />
        </linearGradient>
      </defs>
      <line x1="37" y1="11" x2="46" y2="2.5" stroke="#d9b26a" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="46.2" cy="2.4" r="1.7" fill="#f0cf7f" />
      <g className={live ? styles.waves : styles.wavesIdle}>
        <path d="M49 0.4 a4 4 0 0 1 0 4.6" />
        <path d="M50.8 -1.2 a6.5 6.5 0 0 1 0 7.8" />
      </g>
      <rect x="2.5" y="10.5" width="44" height="28" rx="6.5" fill="url(#radio-wood)" stroke="#2c1a0f" strokeWidth="1.2" />
      <rect x="4.6" y="12.6" width="39.8" height="23.8" rx="4.8" fill="none" stroke="#c99a50" strokeOpacity="0.55" strokeWidth="0.8" />
      {/* Haut-parleur : fentes de laiton. */}
      <rect x="7.5" y="15" width="13.5" height="19" rx="3" fill="#2f1c10" />
      {[17.5, 20.5, 23.5, 26.5, 29.5, 32].map((y) => (
        <line key={y} x1="9.5" y1={y} x2="19" y2={y} stroke="#c99a50" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.85" />
      ))}
      {/* Cadran crème et son aiguille. */}
      <rect x="24" y="15" width="18.5" height="9.5" rx="2" fill={live ? '#ffe9b8' : '#f1e3c0'} />
      {[26, 29, 32, 35, 38, 41].map((x) => (
        <line key={x} x1={x} y1="15.8" x2={x} y2={x % 2 === 0 ? 18.4 : 17.4} stroke="#6b4a2a" strokeWidth="0.6" />
      ))}
      <line
        className={styles.iconNeedle}
        x1="25.2"
        y1="15.4"
        x2="25.2"
        y2="24.2"
        stroke="#d94a3a"
        strokeWidth="1.3"
        style={{ transform: `translateX(${(needle / 100) * 16}px)` }}
      />
      {/* Boutons de réglage. */}
      <circle cx="28.5" cy="30.5" r="3.4" fill="#d9b26a" stroke="#6b4a2a" strokeWidth="0.7" />
      <circle cx="38.5" cy="30.5" r="3.4" fill="#d9b26a" stroke="#6b4a2a" strokeWidth="0.7" />
      <line x1="38.5" y1="30.5" x2="38.5" y2="27.6" stroke="#5a3a1c" strokeWidth="1" style={{ transform: `rotate(${needle * 2.4}deg)`, transformOrigin: '38.5px 30.5px' }} />
      <circle cx="33.5" cy="30.5" r="1.2" className={live ? styles.lampOn : styles.lampOff} />
    </svg>
  );
}

export default function MarineRadio() {
  const phase = useWorld((state) => state.phase);
  const activeIsland = useWorld((state) => state.activeIsland);
  const soundOn = useWorld((state) => state.soundOn);
  const logbookOpen = useLogbook((state) => state.open);
  const playing = useSyncExternalStore(subscribe, getPlaying, getServerPlaying);
  const [open, setOpen] = useState(false);
  const [station, setStation] = useState<StationId>(() => radio.station);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const keys = useRef<(HTMLButtonElement | null)[]>([]);

  const visible = phase === 'playing' || phase === 'docked';
  const dialOpen = open && visible && !logbookOpen;
  const current = STATIONS.find((entry) => entry.id === station) ?? STATIONS[0];
  const live = soundOn && playing;

  // Clic en dehors du poste : le cadran se referme.
  useEffect(() => {
    if (!dialOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [dialOpen]);

  const choose = (id: StationId) => {
    const world = useWorld.getState();
    // Choisir une station, c'est vouloir l'entendre : le son s'allume s'il était coupé.
    if (!world.soundOn) world.toggleSound();
    if (id !== radio.station) logbook.stamp('radio');
    radio.select(id);
    setStation(id);
  };

  const toggle = () => {
    const next = !dialOpen;
    setOpen(next);
    if (next) {
      const index = STATIONS.findIndex((entry) => entry.id === station);
      requestAnimationFrame(() => keys.current[Math.max(0, index)]?.focus());
    }
  };

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = STATIONS.findIndex((entry) => entry.id === station);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % STATIONS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + STATIONS.length) % STATIONS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = STATIONS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    choose(STATIONS[next].id);
    keys.current[next]?.focus();
  };

  const onEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  };

  const status = !soundOn
    ? 'Son coupé : choisir une station l’allume.'
    : current.playing;

  return (
    <div
      ref={root}
      className={styles.root}
      data-visible={visible ? 'true' : 'false'}
      data-panel={activeIsland ? 'open' : 'closed'}
      aria-hidden={!visible}
      onKeyDown={onEscape}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={`Radio de bord : ${current.name}. Changer d’ambiance sonore`}
        aria-expanded={dialOpen}
        aria-controls="marine-radio-dial"
        data-live={live ? 'true' : 'false'}
        onClick={toggle}
        tabIndex={visible ? 0 : -1}
      >
        <RadioIcon needle={current.dial} live={live} />
      </button>

      <div
        id="marine-radio-dial"
        className={styles.dial}
        role="dialog"
        aria-label="Radio de bord"
        data-open={dialOpen ? 'true' : 'false'}
        hidden={!dialOpen}
      >
        <header className={styles.header}>
          <span className={styles.eyebrow}>Radio de bord</span>
          <span className={styles.lamp} data-on={live ? 'true' : 'false'} aria-hidden="true" />
          <button type="button" className={styles.close} onClick={close} aria-label="Fermer la radio">
            ×
          </button>
        </header>

        <div className={styles.plate} aria-hidden="true">
          <span className={styles.bands}>GO · PO · OC</span>
          <div className={styles.scale} />
          {STATIONS.map((entry) => (
            <span
              key={entry.id}
              className={styles.mark}
              data-active={entry.id === station ? 'true' : 'false'}
              style={{ left: `${entry.dial}%` }}
            >
              {entry.name}
            </span>
          ))}
          <span className={styles.needle} style={{ left: `${current.dial}%` }} />
        </div>

        <div className={styles.keys} role="radiogroup" aria-label="Stations" onKeyDown={onKeys}>
          {STATIONS.map((entry, index) => {
            const selected = entry.id === station;
            return (
              <button
                key={entry.id}
                ref={(element) => {
                  keys.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className={styles.key}
                onClick={() => choose(entry.id)}
              >
                <span className={styles.keyName}>{entry.name}</span>
                <span className={styles.keyHint}>{entry.hint}</span>
              </button>
            );
          })}
        </div>

        <p className={styles.status} role="status" aria-live="polite">
          <span className={styles.equalizer} data-live={live ? 'true' : 'false'} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {status}
        </p>
      </div>
    </div>
  );
}
