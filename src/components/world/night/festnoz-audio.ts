import { ambience } from '@/lib/audio/ambience';

/**
 * La musique du fest-noz, jouée en direct par des oscillateurs (aucun fichier) et seulement
 * si le visiteur a activé le son (`ambience.bus()` vaut null sinon) : un couple de sonneurs
 * — bombarde et biniou à l'octave — sur un air d'an-dro original en mode de la (dorien), le
 * bourdon du biniou, et les pas des danseurs qui frappent le sol. Le volume suit la
 * distance du bateau ; tout près, la musique de fond s'efface. Tout est détruit au large.
 */

type Note = [number | null, number];

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

// Huit mesures de quatre temps : A, A', B, B'.
const TUNE: Note[] = [
  [76, 1], [74, 0.5], [72, 0.5], [71, 1], [69, 1],
  [72, 0.5], [74, 0.5], [76, 1], [74, 0.5], [72, 0.5], [71, 1],
  [76, 1], [74, 0.5], [72, 0.5], [71, 1], [69, 1],
  [67, 0.5], [69, 0.5], [71, 1], [69, 2],
  [81, 1], [79, 0.5], [78, 0.5], [76, 1], [74, 1],
  [76, 0.5], [78, 0.5], [79, 1], [76, 1], [74, 1],
  [81, 1], [79, 0.5], [78, 0.5], [76, 1], [74, 0.5], [72, 0.5],
  [71, 0.5], [72, 0.5], [74, 1], [69, 2],
];
/** La bombarde se tait sur les phrases A' (elle reprend son souffle), le biniou continue. */
const BOMBARDE_RESTS = [[8, 16]] as const;
const LOOP_BEATS = TUNE.reduce((sum, [, length]) => sum + length, 0);
const BPM = 124;

interface Graph {
  context: AudioContext;
  out: GainNode;
  reed: BiquadFilterNode;
  pipe: BiquadFilterNode;
  vibrato: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  /** Curseurs : temps audio du prochain temps de la mélodie, rang de la note. */
  nextAt: number;
  beatInLoop: number;
  index: number;
  nextStomp: number;
  stompBeat: number;
}

function stopLater(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
  source.addEventListener('ended', () => nodes.forEach((node) => node.disconnect()), { once: true });
}

export class FestNozAudio {
  private graph: Graph | null = null;
  private duck = -1;
  private releasing = 0;
  /** Accélération passagère (clic sur la ronde) : 1 = tempo normal. */
  hurry = 1;

  /** Appelé quelques fois par seconde : `proximity` 0 (loin) → 1 (au pied de l'îlot). */
  update(proximity: number) {
    const bus = ambience.bus();
    const level = bus ? Math.max(0, Math.min(1, proximity)) : 0;
    if (Math.abs(level - this.duck) > 0.03 || (level === 0 && this.duck !== 0)) {
      this.duck = level;
      ambience.setMusicDuck('festnoz', Math.min(1, level * 1.15) * 0.85);
    }
    if (!bus || level <= 0.004) {
      this.release();
      return;
    }
    if (!this.graph || this.graph.context !== bus.context) {
      this.disposeNow();
      this.graph = this.build(bus.context, bus.destination);
    }
    const graph = this.graph;
    this.releasing = 0;
    graph.out.gain.setTargetAtTime(0.5 * Math.pow(level, 1.3), graph.context.currentTime, 0.35);
    this.schedule(graph, graph.context.currentTime + 0.6);
  }

  dispose() {
    this.disposeNow();
    this.duck = 0;
    ambience.setMusicDuck('festnoz', 0);
  }

  private release() {
    const graph = this.graph;
    if (!graph) return;
    if (!this.releasing) {
      this.releasing = graph.context.currentTime;
      graph.out.gain.setTargetAtTime(0, graph.context.currentTime, 0.25);
    } else if (graph.context.currentTime - this.releasing > 1.5) {
      this.disposeNow();
    }
  }

  private disposeNow() {
    const graph = this.graph;
    if (!graph) return;
    this.graph = null;
    this.releasing = 0;
    const now = graph.context.currentTime;
    graph.sources.forEach((source) => {
      try {
        source.stop(now + 0.05);
      } catch {
        // Déjà arrêtée.
      }
    });
    window.setTimeout(() => graph.nodes.forEach((node) => node.disconnect()), 200);
  }

  private build(context: AudioContext, destination: AudioNode): Graph {
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const out = context.createGain();
    out.gain.value = 0;
    out.connect(destination);
    // Bombarde : anche nasale, bande médium et bosse de présence.
    const reed = context.createBiquadFilter();
    reed.type = 'bandpass';
    reed.frequency.value = 1250;
    reed.Q.value = 0.85;
    const presence = context.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2500;
    presence.gain.value = 5;
    reed.connect(presence).connect(out);
    // Biniou : plus aigu et plus fin.
    const pipe = context.createBiquadFilter();
    pipe.type = 'bandpass';
    pipe.frequency.value = 2200;
    pipe.Q.value = 1.2;
    pipe.connect(out);
    // Vibrato commun.
    const lfo = context.createOscillator();
    lfo.frequency.value = 5.4;
    const vibrato = context.createGain();
    vibrato.gain.value = 7;
    lfo.connect(vibrato);
    lfo.start();
    sources.push(lfo);
    // Bourdon du biniou (la grave et sa quinte), doux et continu.
    const droneFilter = context.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 700;
    const droneGain = context.createGain();
    droneGain.gain.value = 0.0001;
    droneGain.gain.setTargetAtTime(0.03, context.currentTime, 0.8);
    droneFilter.connect(droneGain).connect(out);
    for (const frequency of [midi(45), midi(45) * 1.004, midi(52)]) {
      const drone = context.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.value = frequency;
      drone.connect(droneFilter);
      drone.start();
      sources.push(drone);
    }
    nodes.push(out, reed, presence, pipe, lfo, vibrato, droneFilter, droneGain);
    const start = context.currentTime + 0.15;
    return { context, out, reed, pipe, vibrato, sources, nodes, nextAt: start, beatInLoop: 0, index: 0, nextStomp: start, stompBeat: 0 };
  }

  private beat() {
    return 60 / (BPM * this.hurry);
  }

  private tone(graph: Graph, type: OscillatorType, frequency: number, at: number, length: number, into: AudioNode, peak: number, detune = 0) {
    const { context } = graph;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    graph.vibrato.connect(oscillator.frequency);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.018);
    gain.gain.setValueAtTime(peak * 0.85, at + Math.max(0.03, length * 0.8));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.06);
    oscillator.connect(gain).connect(into);
    oscillator.start(at);
    oscillator.stop(at + length + 0.1);
    stopLater(oscillator, [oscillator, gain]);
    oscillator.addEventListener('ended', () => {
      try {
        graph.vibrato.disconnect(oscillator.frequency);
      } catch {
        // Déjà débranché.
      }
    }, { once: true });
  }

  private schedule(graph: Graph, until: number) {
    const beat = this.beat();
    // Onglet masqué, appareil à la peine : on reprend au présent plutôt que de rattraper.
    const now = graph.context.currentTime;
    if (graph.nextAt < now) graph.nextAt = now + 0.08;
    if (graph.nextStomp < now) graph.nextStomp = now + 0.08;
    while (graph.nextAt < until) {
      const [note, length] = TUNE[graph.index];
      const at = graph.nextAt;
      const seconds = length * beat;
      if (note !== null) {
        const resting = BOMBARDE_RESTS.some(([from, to]) => graph.beatInLoop >= from && graph.beatInLoop < to);
        if (!resting) {
          // Bombarde : scie et carré désaccordés, ornement pincé sur les notes longues.
          if (length >= 1) this.tone(graph, 'sawtooth', midi(note - 10), at - 0.05, 0.035, graph.reed, 0.05);
          this.tone(graph, 'sawtooth', midi(note - 12), at, seconds * 0.92, graph.reed, 0.075);
          this.tone(graph, 'square', midi(note - 12), at, seconds * 0.92, graph.reed, 0.035, 5);
        }
        // Biniou à l'octave (le chant aigu du couple de sonneurs).
        this.tone(graph, 'square', midi(note), at, seconds * 0.9, graph.pipe, resting ? 0.05 : 0.032, -4);
      }
      graph.nextAt += seconds;
      graph.beatInLoop += length;
      graph.index += 1;
      if (graph.index >= TUNE.length) {
        graph.index = 0;
        graph.beatInLoop = 0;
      }
    }
    // Les pas de la ronde : un coup sourd sur les temps 1 et 3, plus léger sur 2 et 4.
    while (graph.nextStomp < until) {
      const at = graph.nextStomp;
      const strong = graph.stompBeat % 2 === 0;
      const { context } = graph;
      const thump = context.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(strong ? 105 : 130, at);
      thump.frequency.exponentialRampToValueAtTime(48, at + 0.11);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(strong ? 0.16 : 0.07, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      thump.connect(gain).connect(graph.out);
      thump.start(at);
      thump.stop(at + 0.22);
      stopLater(thump, [thump, gain]);
      graph.nextStomp += beat;
      graph.stompBeat = (graph.stompBeat + 1) % 4;
    }
  }
}

/** Durée d'un tour complet de l'air (s), au tempo normal. */
export const FESTNOZ_LOOP_SECONDS = (LOOP_BEATS * 60) / BPM;
