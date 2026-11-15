import { BED_COUNT, computeMix, createMix, EVENT, EVENT_COUNT, type SoundscapeInput } from './mix';
import { BEDS, SHOTS, type Bed } from './voices';

/**
 * PAYSAGE SONORE — le moteur. Appelé à cadence réduite (≈ 5 Hz), jamais par image.
 *
 *  - Un sous-mixage unique (`out`) branché sur le bus d'ambience : un seul gain à baisser
 *    pour tout faire taire (onglet caché, son coupé, île secrète).
 *  - Nappes créées paresseusement quand leur niveau dépasse un seuil, détruites après
 *    quelques secondes de silence (hystérésis : pas de création/destruction en rafale).
 *  - Événements tirés au hasard (processus de Poisson, fréquence donnée par le mixage),
 *    avec un délai minimal par type et un plafond de voix simultanées.
 *
 * Testable hors de la page : `update` reçoit le bus ({ context, destination }) en
 * paramètre — un OfflineAudioContext convient.
 */

export interface SoundscapeBus {
  context: BaseAudioContext;
  destination: AudioNode;
}

/** Délai minimal entre deux événements du même type (s). */
const COOLDOWN: number[] = [];
/** Dispersion du panoramique d'un événement autour de sa zone. */
const SPREAD: number[] = [];

function define(kind: number, cooldown: number, spread: number) {
  COOLDOWN[kind] = cooldown;
  SPREAD[kind] = spread;
}
define(EVENT.gull, 2.5, 0.5);
define(EVENT.creak, 2, 0.35);
define(EVENT.halyard, 1.6, 0.4);
define(EVENT.bellBuoy, 9, 0.2);
define(EVENT.blip, 0.9, 0.45);
define(EVENT.van, 28, 0.25);
define(EVENT.bike, 18, 0.4);
define(EVENT.clank, 5, 0.3);
define(EVENT.plop, 0.9, 0.45);
define(EVENT.crash, 4.5, 0.4);
define(EVENT.foghorn, 22, 0.1);
define(EVENT.slap, 0.35, 0.35);
define(EVENT.chime, 3, 0.3);

/** Seuils de création / destruction d'une nappe (niveau de mixage) et délai de silence. */
const BED_ON = 0.035;
const BED_OFF = 0.012;
const BED_LINGER = 3;

export class SoundscapeEngine {
  readonly mix = createMix();
  private context: BaseAudioContext | null = null;
  private out: GainNode | null = null;
  private readonly beds: (Bed | null)[] = new Array<Bed | null>(BED_COUNT).fill(null);
  private readonly quiet = new Float64Array(BED_COUNT);
  private readonly lastEvent = new Float64Array(EVENT_COUNT).fill(-1e9);
  /** Fin prévue de chaque voix ponctuelle en cours (plafond de polyphonie). */
  private readonly voices = new Float64Array(10);
  private clock = 0;
  private hidden = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  /** Qualité basse : nappes allégées, moins de voix simultanées. */
  lite = false;

  /** Mise à jour à cadence réduite. `bus` vaut null quand le son est coupé. */
  update(bus: SoundscapeBus | null, input: SoundscapeInput, dt: number) {
    if (!bus) {
      this.release();
      return;
    }
    if (this.context && bus.context !== this.context) this.release();
    this.context = bus.context;
    const context = bus.context;
    this.clock += dt;
    computeMix(input, this.mix);
    const mix = this.mix;
    const master = this.hidden ? 0 : mix.master;

    if (!this.out) {
      // Rien à faire entendre : aucun nœud créé.
      if (master < 0.01) return;
      this.out = context.createGain();
      this.out.gain.value = 0;
      this.out.connect(bus.destination);
    }
    const now = context.currentTime;
    this.out.gain.setTargetAtTime(master, now, this.hidden ? 0.08 : 0.6);

    for (let index = 0; index < BED_COUNT; index++) {
      const want = master > 0.004 ? mix.bed[index] : 0;
      let bed = this.beds[index];
      if (!bed) {
        if (want < BED_ON) continue;
        bed = BEDS[index](context, this.out, this.lite);
        this.beds[index] = bed;
        this.quiet[index] = 0;
      }
      bed.level.gain.setTargetAtTime(want * bed.trim, now, 0.6);
      bed.pan?.pan.setTargetAtTime(mix.pan[index], now, 0.45);
      bed.modulate(this.clock, mix.tone[index], now);
      if (want < BED_OFF) {
        this.quiet[index] += dt;
        if (this.quiet[index] > BED_LINGER) {
          bed.stop(now + 0.1);
          this.beds[index] = null;
        }
      } else {
        this.quiet[index] = 0;
      }
    }

    if (master < 0.01) return;
    const limit = this.lite ? 6 : this.voices.length;
    for (let kind = 0; kind < EVENT_COUNT; kind++) {
      const rate = mix.events[kind] * mix.rateScale;
      if (rate <= 0) continue;
      if (Math.random() >= 1 - Math.exp(-rate * dt)) continue;
      if (now - this.lastEvent[kind] < COOLDOWN[kind]) continue;
      const slot = this.freeVoice(now, limit);
      if (slot < 0) continue;
      // Réparti dans l'intervalle jusqu'à la prochaine mise à jour : pas de grille à 5 Hz.
      const when = now + 0.04 + Math.random() * Math.min(dt, 0.3);
      const level = mix.evLevel[kind] * (0.7 + 0.3 * Math.random());
      const spread = SPREAD[kind];
      const pan = Math.max(-0.9, Math.min(0.9, mix.evPan[kind] + (Math.random() * 2 - 1) * spread));
      const duration = SHOTS[kind](context, this.out, when, level, pan, this.lite);
      this.voices[slot] = when + duration;
      this.lastEvent[kind] = when;
    }
  }

  private freeVoice(now: number, limit: number) {
    for (let index = 0; index < limit; index++) if (this.voices[index] <= now) return index;
    return -1;
  }

  /**
   * Onglet caché : fondu immédiat, puis tout est libéré si l'absence dure. La mise à jour
   * suivante (onglet visible) reconstruit les nappes à la demande, en fondu.
   */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (!hidden || !this.context || !this.out) return;
    this.out.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.hidden) this.release();
    }, 1500);
  }

  /** Fondu de sortie, arrêt des nappes ; les événements en vol s'éteignent seuls. */
  release() {
    const context = this.context;
    const out = this.out;
    this.out = null;
    if (!context) return;
    const now = context.currentTime;
    if (out) {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.25);
      setTimeout(() => out.disconnect(), 700);
    }
    for (let index = 0; index < BED_COUNT; index++) {
      this.beds[index]?.stop(now + 0.35);
      this.beds[index] = null;
      this.quiet[index] = 0;
    }
    this.voices.fill(0);
  }

  dispose() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.release();
    this.context = null;
  }

  /** État courant (développement, tests) : nappes actives, niveaux, voix en cours. */
  stats() {
    const now = this.context?.currentTime ?? 0;
    const beds: Record<number, { level: number; pan: number; nodes: number }> = {};
    this.beds.forEach((bed, index) => {
      if (bed) beds[index] = { level: this.mix.bed[index], pan: this.mix.pan[index], nodes: bed.size };
    });
    let voices = 0;
    this.voices.forEach((end) => {
      if (end >= now) voices++;
    });
    return {
      active: this.out !== null,
      master: this.mix.master,
      sea: this.mix.sea,
      seaShade: this.mix.seaShade,
      beds,
      voices,
      bedNodes: this.beds.reduce((sum, bed) => sum + (bed?.size ?? 0), 0),
    };
  }
}
