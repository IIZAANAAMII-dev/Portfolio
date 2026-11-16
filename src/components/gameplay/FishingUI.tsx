'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { islandById } from '@/data/islands';
import { skillZoneById, skillZones } from '@/data/skills';
import { boatState } from '@/lib/boat-state';
import { focusItem } from '@/lib/focus';
import { useWorld } from '@/lib/store';
import { fr, plural } from '@/components/ui/typography';
import { probe } from './bridge';
import { SPOTS, clockNow, levelLabel, zonesCaught } from './fishing-data';
import { ArrowIcon, CloseIcon, CreelIcon, FishIcon, RodIcon } from './icons';
import { nibbleAt, useGameplay } from './store';
import styles from './gameplay.module.css';

/**
 * Interface de « La pêche aux compétences » : rien ne bloque la navigation (un clic sur la
 * mer fait repartir le bateau, la ligne est relevée d'elle-même).
 */

const accent = (color: string) => ({ '--accent': color }) as CSSProperties;

/** Le coin est en vue : un clic amène le bateau juste au bord des bouillons. */
export function ApproachHint({ index }: { index: number }) {
  const spot = SPOTS[index];
  const goThere = () => {
    const dx = spot.x - boatState.position.x;
    const dz = spot.z - boatState.position.z;
    const length = Math.hypot(dx, dz) || 1;
    useWorld.getState().sailToPoint([spot.x - (dx / length) * 4.6, spot.z - (dz / length) * 4.6]);
  };
  return (
    <div className={styles.pill} data-enter="">
      <FishIcon className={styles.pillFish} />
      <p className={styles.pillText}>
        <span className={styles.label}>Coin de pêche en vue</span>
        <span className={styles.voice}>Des poissons sautent près de l’île {islandById[spot.island].label}.</span>
      </p>
      <button type="button" className={styles.primary} onClick={goThere}>
        Y aller
      </button>
    </div>
  );
}

/** Le contenu du dock pendant une partie de pêche. */
export function FishingDock() {
  const phase = useGameplay((s) => s.phase);
  const near = useGameplay((s) => s.near);
  const spot = useGameplay((s) => s.spot);
  const index = spot >= 0 ? spot : near;
  const stockLeft = useGameplay((s) => (index >= 0 ? s.stock[index] : 0));
  const strikeWindow = useGameplay((s) => s.strikeWindow);
  const biteAt = useGameplay((s) => s.biteAt);
  const cast = useGameplay((s) => s.cast);
  const strike = useGameplay((s) => s.strike);
  const stop = useGameplay((s) => s.stop);
  const island = index >= 0 ? islandById[SPOTS[index].island] : null;

  if (phase === 'idle') {
    return (
      <div className={styles.stack} data-enter="">
        <p className={styles.caption}>{fr(`Coin de pêche${island ? ` · île ${island.label}` : ''}`)}</p>
        {stockLeft > 0 ? (
          <button type="button" className={styles.primary} onClick={cast} aria-keyshortcuts="F">
            <RodIcon className={styles.icon} />
            Pêcher
          </button>
        ) : (
          <p className={styles.pill}>
            <span className={styles.voice}>{fr('Coin au repos : les poissons reviennent bientôt.')}</span>
          </p>
        )}
      </div>
    );
  }

  if (phase === 'cast' || phase === 'wait' || phase === 'bite' || phase === 'reel') {
    const state = phase === 'bite' ? 'bite' : phase === 'reel' ? 'reel' : 'wait';
    const caption = phase === 'bite' ? 'Ça mord !' : phase === 'reel' ? 'Ferré ! Il arrive…' : 'Attends que le bouchon plonge…';
    return (
      <div className={styles.stack}>
        <p className={styles.caption} data-tone={state}>
          {caption}
        </p>
        <div className={styles.row}>
          <button
            key={state === 'bite' ? `bite-${biteAt}` : state}
            type="button"
            className={styles.strike}
            data-state={state}
            style={{ '--window': `${strikeWindow}s` } as CSSProperties}
            onClick={strike}
            disabled={phase === 'reel'}
            aria-keyshortcuts="F Space"
          >
            Ferrer&#8239;!
          </button>
          <button type="button" className={styles.round} onClick={stop} aria-label="Ranger la canne" title="Ranger la canne">
            <CloseIcon className={styles.icon} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row} data-enter="">
      {stockLeft > 0 && near >= 0 ? (
        <button type="button" className={styles.primary} onClick={cast} aria-keyshortcuts="F">
          <RodIcon className={styles.icon} />
          Relancer
        </button>
      ) : (
        <p className={styles.pill}>
          <span className={styles.voice}>{fr('Coin vidé : il se repose un moment.')}</span>
        </p>
      )}
      <button type="button" className={styles.ghost} onClick={stop}>
        Ranger la canne
      </button>
    </div>
  );
}

/** Cercle accroché au bouchon (pointillés à l'affût, rouge battant à la touche). */
export function FloatMarker() {
  const phase = useGameplay((s) => s.phase);
  if (phase !== 'cast' && phase !== 'wait' && phase !== 'bite') return null;
  return <MarkerTracker bite={phase === 'bite'} />;
}

function MarkerTracker({ bite }: { bite: boolean }) {
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const node = marker.current;
      if (node) {
        const point = probe.float;
        node.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
        node.dataset.visible = point.visible ? 'true' : 'false';
        const game = useGameplay.getState();
        node.dataset.nibble = game.phase === 'wait' && nibbleAt(game.nibbles, clockNow()) >= 0 ? 'true' : 'false';
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={marker} className={styles.marker} data-bite={bite} data-visible="false" aria-hidden="true">
      <span className={styles.markerRing} />
      <b className={styles.markerBang}>!</b>
    </div>
  );
}

/** Carte de prise (papier) ou petit mot quand le poisson s'est décroché. */
export function CatchCard() {
  const phase = useGameplay((s) => s.phase);
  const result = useGameplay((s) => s.result);
  const fresh = useGameplay((s) => s.fresh);
  const joke = useGameplay((s) => s.joke);
  const basket = useGameplay((s) => s.basket);

  if (phase === 'missed') {
    return (
      <div className={styles.cardSlot}>
        <article className={styles.miss} data-enter="">
          <p className={styles.kicker} data-tone="fresh">
            Il s’est décroché&#8239;!
          </p>
          <p className={styles.joke}>{joke}</p>
        </article>
      </div>
    );
  }
  if (phase !== 'caught' || !result) return null;

  const zone = skillZoneById[result.zone];
  const caught = zonesCaught(basket);
  const completed = fresh && caught.length === skillZones.length && (basket[result.zone]?.length ?? 0) === 1;
  return (
    <div className={styles.cardSlot}>
      <article className={styles.card} style={accent(zone.accent)} data-enter="">
        <FishIcon className={styles.cardFish} />
        <div className={styles.cardBody}>
          <p className={styles.kicker} data-tone={fresh ? 'fresh' : undefined}>
            {fresh ? 'Nouvelle prise !' : 'Déjà dans la bourriche'}
          </p>
          <h2 className={styles.cardName}>{result.name}</h2>
          <p className={styles.cardZone}>{zone.label}</p>
          <p className={styles.level} data-level={result.level}>
            {levelLabel(result.level)}
          </p>
          {completed && <p className={styles.cardWin}>{fr('Pêche miraculeuse : une prise de chaque zone du labo !')}</p>}
          <div className={styles.cardFoot}>
            <span className={styles.dots} role="img" aria-label={`${caught.length} ${plural(caught.length, 'zone')} sur ${skillZones.length} dans la bourriche`}>
              {skillZones.map((entry) => (
                <i key={entry.id} style={accent(entry.accent)} data-on={caught.includes(entry.id)} />
              ))}
            </span>
            <button type="button" className={styles.link} onClick={() => focusItem('skills', result.zone)}>
              Voir au labo
              <ArrowIcon className={styles.linkArrow} />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}

/** La bourriche : les technologies pêchées, zone par zone. */
export function Basket() {
  const open = useGameplay((s) => s.basketOpen);
  const basket = useGameplay((s) => s.basket);
  const setOpen = useGameplay((s) => s.setBasketOpen);
  if (!open) return null;
  const zones = zonesCaught(basket).length;
  return (
    <section id="bourriche" className={styles.basket} aria-labelledby="bourriche-title" data-enter="">
      <header className={styles.basketHead}>
        <CreelIcon className={styles.basketIcon} />
        <div>
          <p className={styles.kicker}>Pêche aux compétences</p>
          <h2 id="bourriche-title" className={styles.basketTitle}>
            La bourriche
          </h2>
        </div>
        <button type="button" className={styles.paperClose} onClick={() => setOpen(false)} aria-label="Fermer la bourriche">
          <CloseIcon className={styles.icon} />
        </button>
      </header>
      <ul className={styles.zones}>
        {skillZones.map((zone) => {
          const names = basket[zone.id] ?? [];
          return (
            <li key={zone.id} style={accent(zone.accent)} data-empty={names.length === 0}>
              <p className={styles.zoneHead}>
                <b>{zone.label}</b>
                <span>
                  {names.length}/{zone.items.length}
                </span>
              </p>
              {names.length > 0 ? (
                <ul className={styles.chips}>
                  {names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>Pas encore de prise</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.basketFoot}>
        {zones}/{skillZones.length} zones · une prise de chaque zone vaut le tampon «&nbsp;Pêche miraculeuse&nbsp;».
      </p>
    </section>
  );
}
