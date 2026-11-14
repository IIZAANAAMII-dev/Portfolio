import { ambience } from '@/lib/audio/ambience';

/**
 * Moteur de la radio marine : deux stations jouées en direct par des oscillateurs WebAudio
 * (rien n'est téléchargé), branchées sur le bus de l'ambiance.
 *  - « Port breton » : un air de danse original dans l'esprit d'un an-dro du pays vannetais
 *    (bombarde et biniou en mode de ré, bourdon, accordéon « musette », basse, tambourin).
 *  - « Lo-fi du large » : accords de piano électrique un peu désaccordés par la « bande »,
 *    basse ronde, batterie feutrée et craquements de vinyle ; les voicings et la petite
 *    mélodie changent à chaque tour.
 * « Mer calme » rend la main à l'ambiance du monde ; « Silence radio » coupe la musique.
 * Un planificateur à anticipation (quelques centaines de ms) programme les notes sur
 * l'horloge audio : aucune dépendance au rythme d'affichage.
 */

export type StationId = 'calme' | 'port' | 'lofi' | 'silence';

interface Program {
  schedule(until: number): void;
  stop(at: number): void;
}

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/* ------------------------------------------------------------------ outils */

function noiseBuffer(context: AudioContext, seconds: number) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
  return buffer;
}

/** Craquements de vinyle : impulsions éparses à queue courte, souffle très bas. */
function crackleBuffer(context: AudioContext) {
  const seconds = 3.7;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = (Math.random() * 2 - 1) * 0.012;
  const pops = 70;
  for (let pop = 0; pop < pops; pop++) {
    const start = Math.floor(Math.random() * (data.length - 400));
    const size = 0.25 + Math.random() * (pop % 9 === 0 ? 0.9 : 0.35);
    const length = 20 + Math.floor(Math.random() * 160);
    for (let k = 0; k < length; k++) data[start + k] += (Math.random() * 2 - 1) * size * Math.exp(-k / (length * 0.25));
  }
  return buffer;
}

/** Enveloppe : attaque, maintien, extinction ; renvoie le gain (déjà branché sur `out`). */
function envelope(
  context: AudioContext,
  out: AudioNode,
  start: number,
  attack: number,
  hold: number,
  release: number,
  peak: number,
  sustain = 1,
) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  if (sustain < 1) gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustain), start + attack + hold * 0.5);
  gain.gain.setValueAtTime(Math.max(0.0002, peak * sustain), start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  gain.connect(out);
  return gain;
}

function tone(
  context: AudioContext,
  type: OscillatorType,
  frequency: number,
  start: number,
  stop: number,
  into: AudioNode,
  detune = 0,
  modulation?: AudioNode,
) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.value = detune;
  if (modulation) modulation.connect(oscillator.detune);
  oscillator.connect(into);
  oscillator.start(start);
  oscillator.stop(stop);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    if (modulation) {
      try {
        modulation.disconnect(oscillator.detune);
      } catch {
        // Déjà déconnecté.
      }
    }
  }, { once: true });
  return oscillator;
}

function release(nodes: AudioNode[], gain: GainNode, at: number) {
  gain.gain.cancelScheduledValues(at);
  gain.gain.setValueAtTime(gain.gain.value, at);
  gain.gain.linearRampToValueAtTime(0, at + 0.6);
  window.setTimeout(() => {
    for (const node of nodes) {
      try {
        if (node instanceof AudioScheduledSourceNode) node.stop();
      } catch {
        // Déjà arrêté.
      }
      node.disconnect();
    }
  }, 900);
}

/* ------------------------------------------------------------- Port breton */

/** Air original (mode de ré) : [hauteur MIDI ou null pour un silence, durée en temps]. */
type Phrase = [number | null, number][];
const A: Phrase = [
  [74, 0.75], [72, 0.25], [69, 0.5], [67, 0.5], [69, 1], [74, 0.5], [76, 0.5],
  [78, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [69, 1.5], [null, 0.5],
];
const A2: Phrase = [
  [74, 0.75], [72, 0.25], [69, 0.5], [67, 0.5], [66, 0.5], [67, 0.5], [69, 1],
  [67, 0.5], [66, 0.5], [64, 0.5], [66, 0.5], [62, 1.5], [null, 0.5],
];
const B: Phrase = [
  [69, 0.5], [74, 0.5], [74, 0.5], [76, 0.5], [78, 0.75], [76, 0.25], [74, 1],
  [76, 0.5], [74, 0.5], [72, 0.5], [69, 0.5], [71, 0.5], [72, 0.5], [74, 1],
];
const B2: Phrase = [
  [69, 0.5], [74, 0.5], [74, 0.5], [76, 0.5], [78, 0.5], [79, 0.5], [78, 0.5], [76, 0.5],
  [74, 0.5], [72, 0.5], [69, 0.5], [66, 0.5], [67, 0.5], [64, 0.5], [62, 1],
];
/** Tour complet : A A' A A' B B' B B' (16 mesures de 4 temps). */
const TUNE: { phrase: Phrase; second: boolean }[] = [
  { phrase: A, second: false }, { phrase: A2, second: false }, { phrase: A, second: true }, { phrase: A2, second: true },
  { phrase: B, second: false }, { phrase: B2, second: false }, { phrase: B, second: true }, { phrase: B2, second: true },
];
/** Accords par temps, par phrase (2 mesures = 8 temps). */
const CHORDS: Record<string, string[]> = {
  A: ['D', 'D', 'D', 'D', 'D', 'D', 'C', 'C'],
  A2: ['D', 'D', 'D', 'D', 'Em', 'Em', 'D', 'D'],
  B: ['D', 'D', 'D', 'D', 'C', 'C', 'C', 'C'],
  B2: ['D', 'D', 'D', 'D', 'Am', 'Am', 'D', 'D'],
};
const VOICING: Record<string, number[]> = {
  D: [50, 54, 57],
  C: [48, 52, 55],
  Em: [52, 55, 59],
  Am: [57, 60, 64],
};
const ROOT: Record<string, number> = { D: 38, C: 36, Em: 40, Am: 45 };
/** Gamme de ré (mixolydien) : la note d'ornement est le degré au-dessus. */
const MODE = [62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81];

function graceAbove(note: number) {
  return MODE.find((degree) => degree > note) ?? note + 2;
}

function portBreton(context: AudioContext, out: AudioNode): Program {
  const beat = 60 / 124;
  const cycleBeats = 64;
  const bus = context.createGain();
  bus.gain.value = 0.9;
  bus.connect(out);

  // Bombarde : anche nasale (bande médium + bosse de présence).
  const reedBand = context.createBiquadFilter();
  reedBand.type = 'bandpass';
  reedBand.frequency.value = 1350;
  reedBand.Q.value = 0.9;
  const reedPresence = context.createBiquadFilter();
  reedPresence.type = 'peaking';
  reedPresence.frequency.value = 2600;
  reedPresence.gain.value = 6;
  reedBand.connect(reedPresence).connect(bus);
  // Biniou : plus aigu, plus fin.
  const pipeBand = context.createBiquadFilter();
  pipeBand.type = 'bandpass';
  pipeBand.frequency.value = 2300;
  pipeBand.Q.value = 1.1;
  pipeBand.connect(bus);
  // Vibrato partagé des deux chanteurs.
  const vibrato = context.createOscillator();
  vibrato.frequency.value = 5.6;
  const vibratoDepth = context.createGain();
  vibratoDepth.gain.value = 9;
  vibrato.connect(vibratoDepth);
  vibrato.start();
  // Accordéon « musette » et basse, bourdon.
  const boxFilter = context.createBiquadFilter();
  boxFilter.type = 'lowpass';
  boxFilter.frequency.value = 1700;
  boxFilter.connect(bus);
  const lowFilter = context.createBiquadFilter();
  lowFilter.type = 'lowpass';
  lowFilter.frequency.value = 420;
  lowFilter.connect(bus);
  const droneFilter = context.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 760;
  const droneGain = context.createGain();
  droneGain.gain.value = 0.0001;
  droneGain.gain.setTargetAtTime(0.022, context.currentTime, 0.6);
  droneFilter.connect(droneGain).connect(bus);
  const drones = [midi(50), midi(50) * 1.003, midi(57)].map((frequency) => {
    const drone = context.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = frequency;
    drone.connect(droneFilter);
    drone.start();
    return drone;
  });
  // Tambourin : bruit aigu.
  const shaker = noiseBuffer(context, 0.5);
  const shakerFilter = context.createBiquadFilter();
  shakerFilter.type = 'highpass';
  shakerFilter.frequency.value = 5200;
  shakerFilter.connect(bus);

  const start = context.currentTime + 0.12;
  let nextBeat = 0;
  /** Curseur de la mélodie : temps absolu de la prochaine note, phrase, rang dans la phrase. */
  let noteBeat = 0;
  let part = 0;
  let index = 0;

  const playNote = (note: number, at: number, length: number, second: boolean) => {
    // Bombarde (scie + carré désaccordé) ; au second passage le biniou double à l'octave.
    const reed = envelope(context, reedBand, at, 0.018, length * 0.82, 0.07, 0.11, 0.85);
    tone(context, 'sawtooth', midi(note), at, at + length + 0.1, reed, 0, vibratoDepth);
    tone(context, 'square', midi(note), at, at + length + 0.1, reed, 4, vibratoDepth);
    if (second) {
      const pipe = envelope(context, pipeBand, at, 0.012, length * 0.85, 0.05, 0.045, 0.9);
      tone(context, 'square', midi(note + 12), at, at + length + 0.08, pipe, -3, vibratoDepth);
    }
  };

  const scheduleNotes = (until: number) => {
    while (start + noteBeat * beat <= until) {
      const current = TUNE[part];
      const [note, length] = current.phrase[index];
      const at = start + noteBeat * beat;
      if (note !== null) {
        const seconds = length * beat;
        // Ornement « pincé » avant les notes longues des temps forts.
        if (length >= 0.75 && noteBeat % 1 === 0) {
          const grace = envelope(context, reedBand, at - 0.055, 0.008, 0.03, 0.02, 0.07);
          tone(context, 'sawtooth', midi(graceAbove(note)), at - 0.055, at, grace);
          playNote(note, at, seconds - 0.01, current.second);
        } else {
          playNote(note, at, seconds * 0.94, current.second);
        }
      }
      noteBeat += length;
      index += 1;
      if (index >= current.phrase.length) {
        index = 0;
        part = (part + 1) % TUNE.length;
      }
    }
  };

  const scheduleBeats = (until: number) => {
    while (start + nextBeat * beat <= until) {
      const at = start + nextBeat * beat;
      const inCycle = nextBeat % cycleBeats;
      const phraseIndex = Math.floor(inCycle / 8);
      const name = ['A', 'A2', 'A', 'A2', 'B', 'B2', 'B', 'B2'][phraseIndex];
      const chord = CHORDS[name][inCycle % 8];
      const onBeat = inCycle % 2 === 0;
      // « Oum-pa » : basse sur 1 et 3, accord d'accordéon sur 2 et 4.
      if (onBeat) {
        const root = ROOT[chord] + (inCycle % 4 === 2 ? 7 : 0);
        const bass = envelope(context, lowFilter, at, 0.01, 0.16, 0.2, 0.13, 0.6);
        tone(context, 'triangle', midi(root), at, at + 0.5, bass);
        // Grosse caisse feutrée.
        const kick = context.createOscillator();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(115, at);
        kick.frequency.exponentialRampToValueAtTime(46, at + 0.12);
        kick.connect(envelope(context, bus, at, 0.004, 0.02, 0.16, inCycle % 4 === 0 ? 0.14 : 0.08));
        kick.start(at);
        kick.stop(at + 0.25);
        kick.addEventListener('ended', () => kick.disconnect(), { once: true });
      } else {
        for (const note of VOICING[chord]) {
          const stab = envelope(context, boxFilter, at, 0.012, 0.13, 0.09, 0.02, 0.8);
          tone(context, 'sawtooth', midi(note + 12), at, at + 0.3, stab, -7);
          tone(context, 'sawtooth', midi(note + 12), at, at + 0.3, stab, 7);
        }
      }
      // Tambourin sur chaque croche du contretemps, accent en fin de mesure.
      const off = at + beat / 2;
      const hit = context.createBufferSource();
      hit.buffer = shaker;
      hit.connect(envelope(context, shakerFilter, off, 0.003, 0.01, 0.06, inCycle % 4 === 3 ? 0.07 : 0.035));
      hit.start(off, Math.random() * 0.3);
      hit.stop(off + 0.09);
      hit.addEventListener('ended', () => hit.disconnect(), { once: true });
      nextBeat += 1;
    }
  };

  return {
    schedule(until) {
      scheduleNotes(until);
      scheduleBeats(until);
    },
    stop(at) {
      release([vibrato, ...drones, droneFilter, droneGain, reedBand, reedPresence, pipeBand, boxFilter, lowFilter, shakerFilter], bus, at);
    },
  };
}

/* ---------------------------------------------------------- Lo-fi du large */

const LOFI_CHORDS = [
  { root: 41, notes: [53, 57, 60, 64, 67] }, // Fa maj9
  { root: 40, notes: [52, 55, 59, 62, 66] }, // Mi m9
  { root: 38, notes: [50, 53, 57, 60, 64] }, // Ré m9
  { root: 36, notes: [48, 52, 55, 59, 62] }, // Do maj9
];
const PENTATONIC = [72, 74, 76, 79, 81, 84, 86, 88];

function lofi(context: AudioContext, out: AudioNode): Program {
  const beat = 60 / 74;
  const swing = 0.6;
  const bus = context.createGain();
  bus.gain.value = 0.95;
  // Chaleur de la bande : coupe des aigus sur tout le programme.
  const warmth = context.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 2900;
  warmth.Q.value = 0.4;
  bus.connect(warmth).connect(out);
  // Pleurage : une ondulation lente du diapason (tous les claviers).
  const wow = context.createOscillator();
  wow.frequency.value = 0.33;
  const wowDepth = context.createGain();
  wowDepth.gain.value = 7;
  wow.connect(wowDepth);
  wow.start();
  const keys = context.createBiquadFilter();
  keys.type = 'lowpass';
  keys.frequency.value = 2300;
  keys.connect(bus);
  const low = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 300;
  low.connect(bus);
  const drums = context.createBiquadFilter();
  drums.type = 'lowpass';
  drums.frequency.value = 3800;
  drums.connect(bus);
  const noise = noiseBuffer(context, 1);
  // Vinyle en boucle.
  const vinyl = context.createBufferSource();
  vinyl.buffer = crackleBuffer(context);
  vinyl.loop = true;
  const vinylBand = context.createBiquadFilter();
  vinylBand.type = 'bandpass';
  vinylBand.frequency.value = 3200;
  vinylBand.Q.value = 0.5;
  const vinylGain = context.createGain();
  vinylGain.gain.value = 0.0001;
  vinylGain.gain.setTargetAtTime(0.11, context.currentTime, 0.5);
  vinyl.connect(vinylBand).connect(vinylGain).connect(bus);
  vinyl.start();

  const start = context.currentTime + 0.15;
  let nextStep = 0;
  let voicing = LOFI_CHORDS.map((chord) => chord.notes);

  /** Piano électrique : fondamentale, octave discrète, « tine » d'attaque. */
  const ep = (note: number, at: number, length: number, level: number) => {
    const body = envelope(context, keys, at, 0.012, length * 0.25, length * 0.9, level, 0.45);
    tone(context, 'sine', midi(note), at, at + length * 1.3, body, 0, wowDepth);
    tone(context, 'triangle', midi(note) * 2, at, at + length * 1.3, envelope(context, keys, at, 0.01, 0.05, 0.6, level * 0.18), 3, wowDepth);
    tone(context, 'sine', midi(note) * 4.02, at, at + 0.4, envelope(context, keys, at, 0.004, 0.01, 0.25, level * 0.12));
  };

  const drum = (kind: 'kick' | 'snare' | 'hat', at: number, level: number) => {
    if (kind === 'kick') {
      const kick = context.createOscillator();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(96, at);
      kick.frequency.exponentialRampToValueAtTime(42, at + 0.16);
      kick.connect(envelope(context, drums, at, 0.005, 0.03, 0.26, 0.19 * level));
      kick.start(at);
      kick.stop(at + 0.35);
      kick.addEventListener('ended', () => kick.disconnect(), { once: true });
      return;
    }
    const hit = context.createBufferSource();
    hit.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = kind === 'hat' ? 7200 : 1900;
    filter.Q.value = kind === 'hat' ? 0.7 : 0.8;
    hit.connect(filter).connect(envelope(context, drums, at, 0.003, 0.01, kind === 'hat' ? 0.045 : 0.17, (kind === 'hat' ? 0.03 : 0.09) * level));
    hit.start(at, Math.random() * 0.6);
    hit.stop(at + 0.3);
    hit.addEventListener('ended', () => {
      hit.disconnect();
      filter.disconnect();
    }, { once: true });
    if (kind === 'snare') {
      const body = context.createOscillator();
      body.type = 'sine';
      body.frequency.setValueAtTime(185, at);
      body.frequency.exponentialRampToValueAtTime(150, at + 0.08);
      body.connect(envelope(context, drums, at, 0.003, 0.01, 0.1, 0.05 * level));
      body.start(at);
      body.stop(at + 0.15);
      body.addEventListener('ended', () => body.disconnect(), { once: true });
    }
  };

  return {
    schedule(until) {
      // Pas de croche (8 par mesure), deuxième croche en retard (swing).
      while (true) {
        const bar = Math.floor(nextStep / 8);
        const step = nextStep % 8;
        const beatIndex = Math.floor(step / 2);
        const at = start + (bar * 4 + beatIndex + (step % 2 === 1 ? swing : 0)) * beat;
        if (at > until) break;
        const chordIndex = bar % 4;
        const chord = LOFI_CHORDS[chordIndex];
        if (step === 0) {
          // Nouveau tour : voicings renouvelés (renversements, notes retirées).
          if (chordIndex === 0) {
            voicing = LOFI_CHORDS.map((entry) => entry.notes
              .filter((_, index) => index === 0 || Math.random() > 0.18)
              .map((note, index) => (index > 0 && Math.random() < 0.25 ? note + 12 : note)));
          }
          voicing[chordIndex].forEach((note, rank) => ep(note, at + rank * (0.012 + Math.random() * 0.02), beat * 3.2, 0.045));
          const bass = envelope(context, low, at, 0.02, beat * 1.1, 0.35, 0.16, 0.7);
          tone(context, 'sine', midi(chord.root), at, at + beat * 1.6, bass);
          tone(context, 'triangle', midi(chord.root), at, at + beat * 1.6, envelope(context, low, at, 0.02, beat, 0.3, 0.05));
        }
        if (step === 3) {
          const bass = envelope(context, low, at, 0.02, beat * 0.6, 0.3, 0.13, 0.7);
          tone(context, 'sine', midi(chord.root + (Math.random() < 0.5 ? 7 : 12)), at, at + beat, bass);
        }
        if (step === 5 && Math.random() < 0.55) {
          // Accord rejoué en fantôme.
          voicing[chordIndex].slice(1, 4).forEach((note) => ep(note, at, beat * 1.2, 0.022));
        }
        // Petite mélodie pentatonique, éparse.
        if (Math.random() < (step % 2 === 0 ? 0.3 : 0.16)) {
          const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
          ep(note, at, beat * (0.6 + Math.random() * 0.9), 0.03 + Math.random() * 0.018);
        }
        // Batterie : boom (1, « et » de 2), clap (2, 4), charleston (croches).
        if (step === 0 || step === 3 || (step === 6 && Math.random() < 0.3)) drum('kick', at, step === 0 ? 1 : 0.75);
        if (step === 2 || step === 6) drum('snare', at, 1);
        drum('hat', at, step % 2 === 0 ? 1 : 0.6);
        nextStep += 1;
      }
    },
    stop(at) {
      release([wow, vinyl, vinylBand, vinylGain, keys, low, drums, warmth], bus, at);
    },
  };
}

/* ------------------------------------------------------------------ moteur */

type Listener = () => void;

class RadioEngine {
  station: StationId = 'calme';
  private program: { id: StationId; context: AudioContext; out: GainNode; impl: Program } | null = null;
  private timer = 0;
  private listeners = new Set<Listener>();

  /** Vrai si une station joue réellement de la musique (pour l'égaliseur animé). */
  get playing() {
    return this.program !== null;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  select(id: StationId) {
    const changed = id !== this.station;
    this.station = id;
    ambience.setMusicDuck('radio', id === 'calme' ? 0 : 1);
    if (changed) this.tuningSweep();
    this.stopProgram();
    this.ensureTimer();
    this.tick();
    this.emit();
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = window.setInterval(() => this.tick(), 90);
  }

  private tick() {
    const wants = this.station === 'port' || this.station === 'lofi';
    const bus = ambience.bus();
    if (!wants || !bus) {
      if (this.program) {
        this.stopProgram();
        this.emit();
      }
      // Rien à jouer et rien à attendre : on arrête de surveiller.
      if (!wants && this.timer) {
        window.clearInterval(this.timer);
        this.timer = 0;
      }
      return;
    }
    if (!this.program || this.program.context !== bus.context) {
      this.stopProgram();
      const out = bus.context.createGain();
      out.gain.value = 0;
      out.gain.setTargetAtTime(0.85, bus.context.currentTime, 0.35);
      out.connect(bus.destination);
      const impl = this.station === 'port' ? portBreton(bus.context, out) : lofi(bus.context, out);
      this.program = { id: this.station, context: bus.context, out, impl };
      this.emit();
    }
    // Onglet caché : les minuteries ralentissent, on planifie plus loin.
    const ahead = document.hidden ? 1.8 : 0.35;
    this.program.impl.schedule(bus.context.currentTime + ahead);
  }

  private stopProgram() {
    const program = this.program;
    if (!program) return;
    this.program = null;
    const now = program.context.currentTime;
    program.impl.stop(now);
    program.out.gain.cancelScheduledValues(now);
    program.out.gain.setValueAtTime(program.out.gain.value, now);
    program.out.gain.linearRampToValueAtTime(0, now + 0.5);
    window.setTimeout(() => program.out.disconnect(), 1000);
  }

  /** Grésillement de recherche de station : bruit filtré qui balaie, petit sifflement. */
  private tuningSweep() {
    const bus = ambience.bus();
    if (!bus) return;
    const { context, destination } = bus;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, 0.6);
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 6;
    band.frequency.setValueAtTime(500, now);
    band.frequency.exponentialRampToValueAtTime(3200, now + 0.22);
    band.frequency.exponentialRampToValueAtTime(900, now + 0.45);
    const gain = envelope(context, destination, now, 0.02, 0.25, 0.2, 0.09);
    source.connect(band).connect(gain);
    source.start(now);
    source.stop(now + 0.55);
    const whistle = envelope(context, destination, now + 0.05, 0.02, 0.15, 0.15, 0.012);
    const sine = tone(context, 'sine', 1800, now + 0.05, now + 0.45, whistle);
    sine.frequency.exponentialRampToValueAtTime(2600, now + 0.4);
    source.addEventListener('ended', () => {
      source.disconnect();
      band.disconnect();
      gain.disconnect();
      whistle.disconnect();
    }, { once: true });
  }
}

export const radio = new RadioEngine();
