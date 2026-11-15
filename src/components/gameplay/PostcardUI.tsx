'use client';

import { useEffect, useRef, useState } from 'react';
import { homeIsland, islands } from '@/data/islands';
import { site } from '@/data/site';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { darkroom } from './bridge';
import { ChevronIcon, CloseIcon, DownloadIcon, ShareIcon } from './icons';
import { composePostcard, type PostcardInfo } from './postcard';
import { FRAMINGS, useGameplay } from './store';
import styles from './gameplay.module.css';

/**
 * « Carte postale » : le viseur (trois cadrages, la caméra se déplace), le déclencheur et
 * son éclair, le développement (la photo monte comme un Polaroid) puis la carte : la
 * télécharger, la partager (Web Share), la reprendre.
 */

export const FRAMING_LABELS = ['Trois-quarts', 'Au ras de l’eau', 'Vue de la mouette'];

/** Lieu, date et lumière du déclenchement (lus au moment du clic). */
const pending: { info: PostcardInfo | null } = { info: null };

function postcardInfo(): PostcardInfo {
  const x = boatState.position.x;
  const z = boatState.position.z;
  let place = 'En mer';
  let best = Number.POSITIVE_INFINITY;
  for (const island of islands) {
    const distance = Math.hypot(island.position[0] - x, island.position[1] - z) - island.radius;
    if (distance < best) {
      best = distance;
      place = distance < 30 ? `Île ${island.label}` : 'En mer';
    }
  }
  const home = Math.hypot(homeIsland.position[0] - x, homeIsland.position[1] - z) - homeIsland.radius;
  if (home < best && home < 22) place = 'Port d’attache';
  const mood = skyState.dayNight > 0.6 ? 'sous les étoiles' : skyState.golden > 0.4 ? 'à l’heure dorée' : 'par beau temps';
  return { place, date: new Date(), mood };
}

function fileName(info: PostcardInfo) {
  const day = info.date.toISOString().slice(0, 10);
  const slug = info.place
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `carte-postale-archipel-${slug}-${day}.jpg`;
}

/** Déclencheur (bouton, Entrée/Espace dans le viseur). */
export function takePhoto() {
  const game = useGameplay.getState();
  if (game.photo !== 'aim') return;
  pending.info = postcardInfo();
  ambience.bump('soft', 0.32);
  ambience.cue(1568, 0.06);
  game.shoot();
}

/** Les commandes du viseur, dans le dock du bas. */
export function ShutterBar() {
  const framing = useGameplay((s) => s.framing);
  const setFraming = useGameplay((s) => s.setFraming);
  const photo = useGameplay((s) => s.photo);
  const closePhoto = useGameplay((s) => s.closePhoto);
  return (
    <div className={styles.stack} data-enter="">
      <p className={styles.caption} aria-live="polite">
        Cadrage · {FRAMING_LABELS[framing]} · {framing + 1}/{FRAMINGS}
      </p>
      <div className={styles.row}>
        <button type="button" className={styles.round} onClick={() => setFraming(framing - 1)} aria-label="Cadrage précédent" aria-keyshortcuts="ArrowLeft">
          <ChevronIcon left className={styles.icon} />
        </button>
        <button
          type="button"
          className={styles.shutter}
          onClick={takePhoto}
          disabled={photo !== 'aim'}
          aria-label="Déclencher : prendre la carte postale"
          title="Déclencher"
        >
          <span />
        </button>
        <button type="button" className={styles.round} onClick={() => setFraming(framing + 1)} aria-label="Cadrage suivant" aria-keyshortcuts="ArrowRight">
          <ChevronIcon className={styles.icon} />
        </button>
        <button type="button" className={styles.round} onClick={closePhoto} aria-label="Ranger l’appareil" title="Ranger l’appareil" aria-keyshortcuts="Escape">
          <CloseIcon className={styles.icon} />
        </button>
      </div>
    </div>
  );
}

/** Viseur, éclair et chambre noire. */
export function PostcardLayer() {
  const photo = useGameplay((s) => s.photo);
  const framing = useGameplay((s) => s.framing);

  // Développement : composition de la carte sur un canvas 2D (au moins une seconde de suspense).
  useEffect(() => {
    if (photo !== 'develop') return;
    const snapshot = darkroom.snapshot;
    const info = pending.info ?? postcardInfo();
    if (!snapshot) {
      useGameplay.getState().closePhoto();
      return;
    }
    let cancelled = false;
    let timer = 0;
    const started = performance.now();
    composePostcard(snapshot, info)
      .then((blob) => {
        darkroom.snapshot = null;
        timer = window.setTimeout(() => {
          if (!cancelled) useGameplay.getState().developed({ url: URL.createObjectURL(blob), blob, name: fileName(info) });
        }, Math.max(0, 1100 - (performance.now() - started)));
      })
      .catch(() => {
        if (!cancelled) useGameplay.getState().closePhoto();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [photo]);

  return (
    <>
      {(photo === 'aim' || photo === 'shoot') && (
        <div className={styles.viewfinder} aria-hidden="true">
          <i data-corner="tl" />
          <i data-corner="tr" />
          <i data-corner="bl" />
          <i data-corner="br" />
          <span className={styles.viewfinderLabel}>
            <b>●</b> Carte postale · {FRAMING_LABELS[framing]}
          </span>
        </div>
      )}
      {(photo === 'shoot' || photo === 'develop') && <div className={styles.flash} aria-hidden="true" />}
      {(photo === 'develop' || photo === 'preview') && <PostcardDialog />}
    </>
  );
}

function PostcardDialog() {
  const photo = useGameplay((s) => s.photo);
  const postcard = useGameplay((s) => s.postcard);
  const retake = useGameplay((s) => s.retake);
  const closePhoto = useGameplay((s) => s.closePhoto);
  const download = useRef<HTMLAnchorElement>(null);
  const [shared, setShared] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (postcard) download.current?.focus();
  }, [postcard]);

  const share = async () => {
    if (!postcard) return;
    const text = `Bons baisers de l’Archipel de Kyliann — ${site.url}`;
    try {
      const file = new File([postcard.blob], postcard.name, { type: postcard.blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Carte postale de l’Archipel', text });
      } else {
        await navigator.share({ title: 'Carte postale de l’Archipel', text, url: site.url });
      }
      setShared(true);
    } catch {
      // Partage annulé : rien à signaler.
    }
  };

  return (
    <div className={styles.backdrop} onClick={closePhoto}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="postcard-title"
        onClick={(event) => event.stopPropagation()}
        data-enter=""
      >
        <p id="postcard-title" className={styles.kicker} data-tone="fresh">
          {photo === 'develop' ? 'Développement…' : 'Carte postale'}
        </p>
        <div className={styles.print} data-state={postcard ? 'ready' : 'developing'}>
          {postcard ? (
            // L'image est un blob local tout juste composé : pas d'optimisation Next possible.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={postcard.url} alt="Carte postale de l’archipel, prise depuis le bateau" />
          ) : (
            <span className={styles.developing} />
          )}
        </div>
        <div className={styles.dialogActions}>
          {postcard ? (
            <a ref={download} className={styles.primary} href={postcard.url} download={postcard.name}>
              <DownloadIcon className={styles.icon} />
              Télécharger
            </a>
          ) : (
            <span className={styles.primary} aria-disabled="true">
              <DownloadIcon className={styles.icon} />
              Télécharger
            </span>
          )}
          {canShare && (
            <button type="button" className={styles.ghost} onClick={share} disabled={!postcard}>
              <ShareIcon className={styles.icon} />
              {shared ? 'Envoyée' : 'Partager'}
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={retake} disabled={!postcard}>
            Reprendre
          </button>
          <button type="button" className={styles.round} onClick={closePhoto} aria-label="Fermer la carte postale">
            <CloseIcon className={styles.icon} />
          </button>
        </div>
      </div>
    </div>
  );
}
