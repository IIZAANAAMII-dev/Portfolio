import { distanceHome, homeApproach, mooring } from '@/components/boat/mooring';
import { ambience } from '@/lib/audio/ambience';
import { atelier, flagById, isUnlocked, liveryById, useLivery, type FlagId, type LiveryId, type PaintKind } from '@/lib/livery';
import { useWorld } from '@/lib/store';

/**
 * Commandes de l'atelier (clics sur un pot, un pavillon, l'appentis).
 *
 * Un objet sous cadenas refuse (il secoue, un « toc » de bois). Sinon la commande attend le
 * bateau : s'il est déjà amarré au port de départ, la peinture commence aussitôt ; sinon il
 * rentre au port (en mer, il met le cap sur le poste ; au loin, il traverse l'archipel) et le
 * travail commence dès qu'il est amarré. Horloge : celle de three (secondes).
 */
export type OrderResult = 'locked' | 'same' | 'ordered' | 'busy';

export function orderPaint(kind: PaintKind, id: string, now: number): OrderResult {
  const item = kind === 'livery' ? liveryById(id as LiveryId) : flagById(id as FlagId);
  if (!isUnlocked(item)) {
    atelier.denied = { id: `${kind}:${id}`, at: now };
    ambience.bump('wood', 0.35);
    return 'locked';
  }
  const world = useWorld.getState();
  if (world.phase !== 'playing' && world.phase !== 'docked') return 'busy';
  atelier.focus = true;
  atelier.focusAt = now;
  const chosen = useLivery.getState();
  const running = atelier.job?.kind === kind ? atelier.job.id : null;
  const current = running ?? (kind === 'livery' ? chosen.livery : chosen.flag);
  const queued = atelier.queue.findIndex((order) => order.kind === kind);
  if (id === current && queued < 0) {
    ambience.cue(880, 0.12);
    return 'same';
  }
  // Une commande par sorte : un nouveau pot remplace le pot commandé, pas le pavillon.
  if (queued >= 0) atelier.queue[queued] = { kind, id };
  else atelier.queue.push({ kind, id });
  ambience.chime([523, 659], 0.06);
  const home = mooring.berth?.home === true && (mooring.phase === 'moored' || mooring.phase === 'arriving');
  if (!home) {
    mooring.wantHome = true;
    if (world.phase === 'docked' || world.destination !== null || world.freeTarget !== null || distanceHome() > 8.5) {
      const target = homeApproach();
      atelier.approach = target;
      world.sailToPoint(target);
    }
  }
  return 'ordered';
}

/** Clic sur l'appentis : plan rapproché de l'atelier (ou retour au suivi du bateau). */
export function toggleFocus(now: number) {
  atelier.focus = !atelier.focus;
  atelier.focusAt = now;
  if (atelier.focus) ambience.cue(660, 0.14);
}

/**
 * Une image de l'atelier (appelée par son décor) : une autre destination annule la commande,
 * et le plan rapproché se relâche quand il n'y a plus rien à voir.
 */
export function updateOrders(now: number) {
  const world = useWorld.getState();
  const elsewhere = world.destination !== null
    || (world.freeTarget !== null && (atelier.approach === null
      || Math.hypot(world.freeTarget[0] - atelier.approach[0], world.freeTarget[1] - atelier.approach[1]) > 0.5));
  if (elsewhere && (atelier.queue.length > 0 || atelier.focus || mooring.wantHome)) {
    atelier.queue.length = 0;
    atelier.focus = false;
    atelier.approach = null;
    mooring.wantHome = false;
  }
  if (world.freeTarget === null && atelier.approach !== null && !mooring.wantHome) atelier.approach = null;
  // Plus rien en cours : le plan rapproché se relâche (vite après un travail, plus tard sinon).
  if (atelier.focus && atelier.queue.length === 0 && !atelier.job) {
    const since = now - Math.max(atelier.focusAt, atelier.doneAt);
    if ((atelier.doneAt > atelier.focusAt && since > 3.2) || since > 14) atelier.focus = false;
  }
}
