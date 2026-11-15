/**
 * PAYSAGE SONORE — les voix, 100 % WebAudio procédural (aucun fichier audio).
 *
 *  - Ressources partagées par contexte : bruit blanc, bruit brun, et deux textures
 *    pré-calculées une seule fois (chœur de cigales, chant de grillon), jouées en boucle.
 *  - Nappes (`BEDS`) : quelques nœuds chacune, créées à l'approche, détruites au large.
 *    Leur niveau, leur panoramique et leur lente modulation (houle, rafales) sont pilotés
 *    par le moteur à cadence réduite.
 *  - Événements (`SHOTS`) : de petits graphes éphémères qui se débranchent seuls à la fin.
 *
 * Les enveloppes « réarmées » utilisent setTargetAtTime (attaque puis extinction) : chaque
 * coup repart de la valeur courante, sans clic, même s'il chevauche la queue du précédent.
 */

type Context = BaseAudioContext;

/* ------------------------------------------------------------------ ressources */

interface Resources {
  white?: AudioBuffer;
  brown?: AudioBuffer;
  cicadas?: AudioBuffer;
  crickets?: AudioBuffer;
}

const cache = new WeakMap<Context, Resources>();

function resources(context: Context) {
  let entry = cache.get(context);
  if (!entry) {
    entry = {};
    cache.set(context, entry);
  }
  return entry;
}

/** Remplit `data` avec la fin de `raw` fondue dans son début : la boucle ne claque pas. */
function seamless(raw: Float32Array, data: Float32Array, fade: number) {
  const length = data.length;
  for (let index = 0; index < length; index++) data[index] = raw[index];
  for (let index = 0; index < fade; index++) {
    const t = index / fade;
    data[index] = raw[index] * Math.sqrt(t) + raw[length + index] * Math.sqrt(1 - t);
  }
}

function normalize(data: Float32Array, rms: number) {
  let sum = 0;
  for (let index = 0; index < data.length; index++) sum += data[index] * data[index];
  const current = Math.sqrt(sum / data.length) || 1;
  const scale = rms / current;
  for (let index = 0; index < data.length; index++) data[index] *= scale;
}

function white(context: Context) {
  const entry = resources(context);
  if (!entry.white) {
    const length = Math.floor(context.sampleRate * 2);
    const raw = new Float32Array(length + 2048);
    for (let index = 0; index < raw.length; index++) raw[index] = Math.random() * 2 - 1;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    seamless(raw, buffer.getChannelData(0), 2048);
    entry.white = buffer;
  }
  return entry.white;
}

/** Bruit brun (intégrateur à fuite), normalisé : la matière du clapotis et des vagues. */
function brown(context: Context) {
  const entry = resources(context);
  if (!entry.brown) {
    const length = Math.floor(context.sampleRate * 5);
    const fade = 4096;
    const raw = new Float32Array(length + fade);
    let last = 0;
    for (let index = 0; index < raw.length; index++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      raw[index] = last;
    }
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    seamless(raw, data, fade);
    normalize(data, 0.5);
    entry.brown = buffer;
  }
  return entry.brown;
}

/** Passe-bande RBJ (gain 0 dB au centre), pour pré-calculer les textures. */
function resonate(input: Float32Array, frequency: number, q: number, rate: number) {
  const w0 = (2 * Math.PI * frequency) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < input.length; index++) {
    const x = input[index];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[index] = y;
  }
  return output;
}

/**
 * Chœur de cigales (3 s en boucle) : bruit résonant vers 5 kHz, haché par les cymbales
 * (impulsions à 190 Hz), pulsation du chant (9 Hz) et lente respiration. Toutes les
 * périodes tombent juste sur la durée : la boucle est continue.
 */
function cicadas(context: Context) {
  const entry = resources(context);
  if (!entry.cicadas) {
    const rate = context.sampleRate;
    const seconds = 3;
    const length = Math.floor(rate * seconds);
    const fade = 2048;
    const noise = new Float32Array(length + fade);
    for (let index = 0; index < noise.length; index++) noise[index] = Math.random() * 2 - 1;
    const low = resonate(noise, 4900, 5, rate);
    const high = resonate(noise, 7300, 7, rate);
    const raw = new Float32Array(length + fade);
    for (let index = 0; index < raw.length; index++) raw[index] = low[index] + high[index] * 0.45;
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    seamless(raw, data, fade);
    for (let index = 0; index < length; index++) {
      const t = index / rate;
      const click = Math.max(0, Math.sin(2 * Math.PI * 190 * t));
      const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * t);
      const phrase = 0.78 + 0.22 * Math.sin((2 * Math.PI * t) / seconds);
      data[index] *= (0.22 + click * click * click) * (0.3 + 0.7 * pulse * pulse) * phrase;
    }
    normalize(data, 0.4);
    entry.cicadas = buffer;
  }
  return entry.cicadas;
}

/**
 * Grillon des champs (4 s en boucle) : huit stridulations de quatre syllabes vers 4,4 kHz,
 * chacune légèrement descendante. Le silence entre deux chants rend la boucle continue.
 */
function crickets(context: Context) {
  const entry = resources(context);
  if (!entry.crickets) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * 4);
    const buffer = context.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    const strengths = [1, 0.82, 0.95, 0.78, 1, 0.88, 0.72, 0.93];
    for (let chirp = 0; chirp < 8; chirp++) {
      for (let syllable = 0; syllable < 4; syllable++) {
        const start = Math.floor((chirp * 0.5 + 0.06 + syllable * 0.034) * rate);
        const size = Math.floor(0.017 * rate);
        let phase = 0;
        for (let index = 0; index < size && start + index < length; index++) {
          const u = index / size;
          phase += (2 * Math.PI * (4480 - 160 * u)) / rate;
          const envelope = Math.sin(Math.PI * u);
          data[start + index] += strengths[chirp] * (syllable === 3 ? 0.75 : 1) * envelope * envelope * Math.sin(phase) * 0.6;
        }
      }
    }
    entry.crickets = buffer;
  }
  return entry.crickets;
}

/* ------------------------------------------------------------------ outils */

function gainNode(context: Context, value: number) {
  const node = context.createGain();
  node.gain.value = value;
  return node;
}

function filterNode(context: Context, type: BiquadFilterType, frequency: number, q = 0.7) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function oscillator(context: Context, type: OscillatorType, frequency: number) {
  const node = context.createOscillator();
  node.type = type;
  node.frequency.value = frequency;
  return node;
}

function loopSource(context: Context, buffer: AudioBuffer, rate = 1) {
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.loop = true;
  node.playbackRate.value = rate;
  return node;
}

function panNode(context: Context, value = 0) {
  if (typeof context.createStereoPanner !== 'function') return null;
  const node = context.createStereoPanner();
  node.pan.value = value;
  return node;
}

/** Bruit lisse dans [-1, 1] (somme de sinus incommensurables) : houle, rafales… */
export function wave(time: number, seed: number) {
  return 0.5 * Math.sin(time * 0.61 + seed) + 0.3 * Math.sin(time * 1.37 + seed * 2.1) + 0.2 * Math.sin(time * 2.89 + seed * 3.7);
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Attaque (setTarget rapide) puis extinction exponentielle de constante `decay`. */
function strike(param: AudioParam, at: number, peak: number, decay: number, attack = 0.0015) {
  param.setTargetAtTime(peak, at, attack);
  param.setTargetAtTime(0, at + attack * 4, decay);
}

/* ------------------------------------------------------------------ nappes */

export interface Bed {
  /** Niveau (piloté par le moteur : niveau du mixage × `trim`). */
  readonly level: GainNode;
  readonly pan: StereoPannerNode | null;
  /** Étalonnage de la nappe : niveau de sortie pour un mixage à 1. */
  readonly trim: number;
  /** Modulation lente (houle, rafales…), appelée à chaque mise à jour du moteur. */
  modulate(time: number, tone: number, now: number): void;
  /** Arrête les sources à `when` ; tout se débranche à la fin. */
  stop(when: number): void;
  /** Nombre de nœuds de la nappe (contrôle du budget). */
  readonly size: number;
}

class Graph implements Bed {
  readonly level: GainNode;
  readonly pan: StereoPannerNode | null;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private stopped = false;
  modulate: (time: number, tone: number, now: number) => void = () => {};

  constructor(context: Context, destination: AudioNode, readonly trim: number) {
    this.level = gainNode(context, 0);
    this.pan = panNode(context);
    if (this.pan) this.level.connect(this.pan).connect(destination);
    else this.level.connect(destination);
    this.nodes.push(this.level);
    if (this.pan) this.nodes.push(this.pan);
  }

  get size() {
    return this.nodes.length;
  }

  add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  source<T extends AudioScheduledSourceNode>(node: T): T {
    this.sources.push(node);
    this.nodes.push(node);
    return node;
  }

  start(context: Context) {
    const now = context.currentTime;
    for (const node of this.sources) {
      // Départ décalé dans la boucle : deux nappes identiques ne sont jamais en phase.
      if (node instanceof AudioBufferSourceNode && node.buffer) node.start(now, Math.random() * node.buffer.duration);
      else node.start(now);
    }
  }

  stop(when: number) {
    if (this.stopped) return;
    this.stopped = true;
    const nodes = this.nodes;
    const first = this.sources[0];
    if (first) first.addEventListener('ended', () => nodes.forEach((node) => node.disconnect()), { once: true });
    for (const node of this.sources) {
      try {
        node.stop(when);
      } catch {
        // Déjà arrêtée.
      }
    }
    if (!first) nodes.forEach((node) => node.disconnect());
  }
}

type BedFactory = (context: Context, destination: AudioNode, lite: boolean) => Bed;

/** Port breton : clapotis brun contre les cales, fines rides aiguës, houle irrégulière. */
const harborBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.077);
  const swell = graph.add(gainNode(context, 0.6));
  swell.connect(graph.level);
  const water = graph.source(loopSource(context, brown(context)));
  water.connect(graph.add(filterNode(context, 'lowpass', 640, 0.6))).connect(swell);
  if (!lite) {
    const ripples = graph.source(loopSource(context, white(context)));
    ripples
      .connect(graph.add(filterNode(context, 'bandpass', 2400, 1.2)))
      .connect(graph.add(gainNode(context, 0.09)))
      .connect(swell);
  }
  graph.modulate = (time, _tone, now) => {
    swell.gain.setTargetAtTime(0.55 + 0.3 * wave(time * 1.6, 0.3) + 0.15 * wave(time * 3.1, 2.2), now, 0.18);
  };
  graph.start(context);
  return graph;
};

/** Lande bretonne : souffle large et sifflement qui erre dans la bruyère. */
const bretonBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.08);
  const gust = graph.add(gainNode(context, 0.6));
  gust.connect(graph.level);
  const air = graph.source(loopSource(context, white(context)));
  air
    .connect(graph.add(filterNode(context, 'bandpass', 520, 0.55)))
    .connect(graph.add(filterNode(context, 'lowpass', 1300, 0.6)))
    .connect(gust);
  let whistle: BiquadFilterNode | null = null;
  if (!lite) {
    whistle = graph.add(filterNode(context, 'bandpass', 700, 8));
    air.connect(whistle).connect(graph.add(gainNode(context, 0.9))).connect(gust);
  }
  graph.modulate = (time, _tone, now) => {
    gust.gain.setTargetAtTime(0.55 + 0.32 * wave(time * 0.9, 1.1) + 0.25 * Math.max(0, wave(time * 2.3, 5)), now, 0.3);
    whistle?.frequency.setTargetAtTime(640 + 190 * wave(time * 0.7, 3), now, 0.4);
  };
  graph.start(context);
  return graph;
};

/** Cigales : deux chanteuses désaccordées, de part et d'autre, qui enflent ensemble. */
const cicadaBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.019);
  const swell = graph.add(gainNode(context, 0.8));
  const air = graph.add(filterNode(context, 'highpass', 2400, 0.7));
  air.connect(swell).connect(graph.level);
  const voices: [number, number][] = lite ? [[1, 0]] : [[1, -0.35], [0.93, 0.4]];
  for (const [rate, side] of voices) {
    const singer = graph.source(loopSource(context, cicadas(context), rate));
    const place = panNode(context, side);
    if (place) singer.connect(graph.add(place)).connect(air);
    else singer.connect(air);
  }
  graph.modulate = (time, _tone, now) => {
    swell.gain.setTargetAtTime(0.75 + 0.25 * wave(time * 0.5, 4), now, 0.5);
  };
  graph.start(context);
  return graph;
};

/** Laboratoire : quinte grave de synthé (battement lent), filtre qui respire. */
const labBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.047);
  const breathe = graph.add(gainNode(context, 0.8));
  const tone = graph.add(filterNode(context, 'lowpass', 760, 0.9));
  tone.connect(breathe).connect(graph.level);
  graph.source(oscillator(context, 'triangle', 110)).connect(tone);
  if (!lite) graph.source(oscillator(context, 'sine', 110.45)).connect(tone);
  graph.source(oscillator(context, 'triangle', 164.81)).connect(graph.add(gainNode(context, 0.35))).connect(tone);
  graph.modulate = (time, _tone, now) => {
    breathe.gain.setTargetAtTime(0.8 + 0.2 * wave(time * 0.45, 6), now, 0.5);
    tone.frequency.setTargetAtTime(680 + 240 * wave(time * 0.3, 2), now, 0.6);
  };
  graph.start(context);
  return graph;
};

/** Ville : rumeur médium (300 Hz – 1 kHz) aux fluctuations de conversations lointaines. */
const townBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.078);
  const swell = graph.add(gainNode(context, 0.7));
  swell.connect(graph.level);
  const chatter = graph.add(gainNode(context, 0.62));
  chatter.connect(swell);
  graph
    .source(loopSource(context, white(context)))
    .connect(graph.add(filterNode(context, 'lowpass', 1100, 0.6)))
    .connect(graph.add(filterNode(context, 'highpass', 260, 0.6)))
    .connect(chatter);
  if (!lite) {
    for (const [rate, depth] of [[4.3, 0.22], [2.7, 0.16]]) {
      graph.source(oscillator(context, 'sine', rate)).connect(graph.add(gainNode(context, depth))).connect(chatter.gain);
    }
  }
  graph.modulate = (time, _tone, now) => {
    swell.gain.setTargetAtTime(0.7 + 0.3 * wave(time * 0.8, 7), now, 0.4);
  };
  graph.start(context);
  return graph;
};

/** La Ciotat : clapotis plus sombre contre le quai, grondement lointain du chantier. */
const quayBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.092);
  const swell = graph.add(gainNode(context, 0.6));
  swell.connect(graph.level);
  graph.source(loopSource(context, brown(context))).connect(graph.add(filterNode(context, 'lowpass', 470, 0.7))).connect(swell);
  if (!lite) {
    graph
      .source(oscillator(context, 'sawtooth', 55))
      .connect(graph.add(filterNode(context, 'lowpass', 160, 0.8)))
      .connect(graph.add(gainNode(context, 0.12)))
      .connect(graph.level);
  }
  graph.modulate = (time, _tone, now) => {
    swell.gain.setTargetAtTime(0.5 + 0.32 * wave(time * 1.9, 8) + 0.15 * wave(time * 3.7, 1), now, 0.16);
  };
  graph.start(context);
  return graph;
};

/** Contact : vagues lourdes sur les rochers (houle lente), écume aiguë. */
const rocksBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.093);
  const swell = graph.add(gainNode(context, 0.5));
  swell.connect(graph.level);
  graph.source(loopSource(context, brown(context))).connect(graph.add(filterNode(context, 'lowpass', 900, 0.6))).connect(swell);
  if (!lite) {
    graph
      .source(loopSource(context, white(context)))
      .connect(graph.add(filterNode(context, 'highpass', 2800, 0.7)))
      .connect(graph.add(gainNode(context, 0.06)))
      .connect(swell);
  }
  graph.modulate = (time, _tone, now) => {
    swell.gain.setTargetAtTime(0.42 + 0.45 * Math.max(0, wave(time * 0.85, 9)) + 0.12 * wave(time * 2.5, 3), now, 0.3);
  };
  graph.start(context);
  return graph;
};

/** Pleine mer : vent apparent (bande qui monte avec la vitesse) et sifflement du gréement. */
const windBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.058);
  const gust = graph.add(gainNode(context, 0.6));
  gust.connect(graph.level);
  const air = graph.source(loopSource(context, white(context)));
  const band = graph.add(filterNode(context, 'bandpass', 600, 0.7));
  const soften = graph.add(filterNode(context, 'lowpass', 1800, 0.6));
  air.connect(band).connect(soften).connect(gust);
  let rigging: GainNode | null = null;
  let whistle: BiquadFilterNode | null = null;
  if (!lite) {
    whistle = graph.add(filterNode(context, 'bandpass', 1400, 6));
    rigging = graph.add(gainNode(context, 0));
    air.connect(whistle).connect(rigging).connect(gust);
  }
  graph.modulate = (time, speed, now) => {
    band.frequency.setTargetAtTime(480 + 700 * speed + 160 * wave(time * 0.6, 2), now, 0.4);
    soften.frequency.setTargetAtTime(1500 + 1300 * speed, now, 0.5);
    gust.gain.setTargetAtTime(0.6 + 0.3 * wave(time * 0.9 * (1 + speed), 5) + 0.25 * Math.max(0, wave(time * 1.7, 1)), now, 0.25);
    rigging?.gain.setTargetAtTime(0.1 + 1.1 * speed * speed, now, 0.4);
    whistle?.frequency.setTargetAtTime(1250 + 450 * speed + 120 * wave(time * 1.1, 6), now, 0.4);
  };
  graph.start(context);
  return graph;
};

/** Nuit : deux grillons à des cadences différentes, de part et d'autre. */
const cricketBed: BedFactory = (context, destination, lite) => {
  const graph = new Graph(context, destination, 0.05);
  const voices: [number, number][] = lite ? [[1, 0]] : [[1, -0.45], [0.86, 0.5]];
  for (const [rate, side] of voices) {
    const singer = graph.source(loopSource(context, crickets(context), rate));
    const place = panNode(context, side);
    if (place) singer.connect(graph.add(place)).connect(graph.level);
    else singer.connect(graph.level);
  }
  graph.start(context);
  return graph;
};

/** Indexé par BED (voir mix.ts). */
export const BEDS: BedFactory[] = [harborBed, bretonBed, cicadaBed, labBed, townBed, quayBed, rocksBed, windBed, cricketBed];

/* ------------------------------------------------------------------ événements */

/** Joue un événement à `when` ; renvoie sa durée (s). */
export type Shot = (context: Context, destination: AudioNode, when: number, level: number, pan: number, lite: boolean) => number;

/** Sortie panoramique d'un événement. */
function output(context: Context, destination: AudioNode, pan: number, nodes: AudioNode[]) {
  const node = panNode(context, pan);
  if (!node) return destination;
  node.connect(destination);
  nodes.push(node);
  return node;
}

/** Débranche tout quand la dernière source s'arrête. */
function release(last: AudioScheduledSourceNode, nodes: AudioNode[], tail = 0) {
  last.addEventListener('ended', () => {
    if (tail > 0) setTimeout(() => nodes.forEach((node) => node.disconnect()), tail * 1000);
    else nodes.forEach((node) => node.disconnect());
  }, { once: true });
}

function noiseShot(context: Context, buffer: AudioBuffer, when: number, duration: number, nodes: AudioNode[]) {
  const node = context.createBufferSource();
  node.buffer = buffer;
  // En boucle : un événement plus long que le tampon ne s'arrête pas net.
  node.loop = true;
  node.start(when, Math.random() * Math.max(0, buffer.duration - duration - 0.05));
  node.stop(when + duration);
  nodes.push(node);
  return node;
}

/** Goéland : une série de « kyow » (glissando dent-de-scie, timbre rauque), qui retombe. */
const gull: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const voice = oscillator(context, 'sawtooth', 800);
  const rasp = oscillator(context, 'sine', random(30, 42));
  const raspDepth = gainNode(context, random(18, 40));
  const throat = filterNode(context, 'bandpass', random(1700, 2200), 1.4);
  const envelope = gainNode(context, 0);
  nodes.push(voice, rasp, raspDepth, throat, envelope);
  rasp.connect(raspDepth).connect(voice.frequency);
  voice.connect(throat).connect(envelope).connect(out);
  const notes = 2 + Math.floor(Math.random() * 4);
  const base = random(700, 880);
  const peak = 0.05 * level;
  let at = when;
  for (let note = 0; note < notes; note++) {
    const long = note === 0 && Math.random() < 0.4;
    const length = long ? 0.42 : random(0.16, 0.24);
    const pitch = base * (note === 0 ? 1.06 : 1 - note * 0.025);
    voice.frequency.setValueAtTime(pitch, at);
    voice.frequency.linearRampToValueAtTime(pitch * 1.5, at + length * 0.3);
    voice.frequency.linearRampToValueAtTime(pitch * 1.12, at + length);
    const loud = peak * (1 - note * 0.08);
    envelope.gain.setTargetAtTime(loud, at, 0.006);
    envelope.gain.setTargetAtTime(loud * 0.8, at + length * 0.35, 0.05);
    envelope.gain.setTargetAtTime(0, at + length * 0.75, 0.03);
    at += length + random(0.07, 0.15);
  }
  voice.start(when);
  rasp.start(when);
  voice.stop(at + 0.15);
  rasp.stop(at + 0.15);
  release(voice, nodes);
  return at - when + 0.15;
};

/** Gréement qui grince : frottement (dent-de-scie lente) dans la résonance du bois. */
const creak: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const rub = oscillator(context, 'sawtooth', 80);
  const wood = filterNode(context, 'bandpass', random(620, 980), 6);
  const cut = filterNode(context, 'highpass', 220, 0.7);
  const envelope = gainNode(context, 0);
  nodes.push(rub, wood, cut, envelope);
  rub.connect(wood).connect(cut).connect(envelope).connect(out);
  const peak = 0.18 * level;
  // Le bateau roule : un grincement, parfois son retour un peu plus grave.
  const swings = Math.random() < 0.5 ? 2 : 1;
  let at = when;
  for (let swing = 0; swing < swings; swing++) {
    const length = random(0.5, 1.1);
    const low = random(55, 85) * (swing === 0 ? 1 : 0.85);
    const high = low * random(1.5, 2.1);
    rub.frequency.setValueAtTime(low, at);
    rub.frequency.linearRampToValueAtTime(high, at + length * 0.6);
    rub.frequency.linearRampToValueAtTime(low * 1.1, at + length);
    const loud = peak * (swing === 0 ? 1 : 0.7);
    envelope.gain.setTargetAtTime(loud, at, 0.05);
    envelope.gain.setTargetAtTime(loud * random(0.55, 0.9), at + length * 0.35, 0.04);
    envelope.gain.setTargetAtTime(loud, at + length * 0.55, 0.05);
    envelope.gain.setTargetAtTime(0, at + length * 0.8, 0.06);
    at += length + random(0.45, 0.9);
  }
  rub.start(when);
  rub.stop(at);
  release(rub, nodes);
  return at - when;
};

/** Drisse contre un mât : deux partiels métalliques, deux à quatre coups qui faiblissent. */
const halyard: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const pitch = random(1850, 2700);
  const body = oscillator(context, 'sine', pitch);
  const ring = oscillator(context, 'sine', pitch * 2.76);
  const bodyGain = gainNode(context, 0);
  const ringGain = gainNode(context, 0);
  nodes.push(body, ring, bodyGain, ringGain);
  body.connect(bodyGain).connect(out);
  ring.connect(ringGain).connect(out);
  const hits = 2 + Math.floor(Math.random() * 3);
  const peak = 0.027 * level;
  let at = when;
  for (let hit = 0; hit < hits; hit++) {
    const loud = peak * Math.pow(0.68, hit) * random(0.8, 1);
    strike(bodyGain.gain, at, loud, 0.12);
    strike(ringGain.gain, at, loud * 0.5, 0.045);
    at += random(0.16, 0.42);
  }
  const end = at + 0.7;
  body.start(when);
  ring.start(when);
  body.stop(end);
  ring.stop(end);
  release(body, nodes);
  return end - when;
};

/** Pitch fixe de la bouée à cloche (toujours la même cloche, bercée par la houle). */
const BUOY_PITCH = 318;
const BUOY_PARTIALS: [number, number, number][] = [
  [0.5, 0.35, 0.9], [1, 1, 0.7], [1.19, 0.5, 0.5], [1.56, 0.3, 0.42], [2, 0.35, 0.3], [2.66, 0.15, 0.2],
];

/** Bouée à cloche au loin : partiels de bronze, deux ou trois coups irréguliers, voilés. */
const bellBuoy: Shot = (context, destination, when, level, pan, lite) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const distance = filterNode(context, 'lowpass', 1600, 0.5);
  distance.connect(out);
  nodes.push(distance);
  const hits = Math.random() < 0.6 ? 2 : 3;
  const times: number[] = [];
  let at = when;
  for (let hit = 0; hit < hits; hit++) {
    times.push(at);
    at += random(1.1, 1.9);
  }
  const partials = lite ? BUOY_PARTIALS.slice(0, 4) : BUOY_PARTIALS;
  const peak = 0.042 * level;
  let last: OscillatorNode | null = null;
  const end = times[times.length - 1] + 4.6;
  for (const [ratio, amount, decay] of partials) {
    const tone = oscillator(context, 'sine', BUOY_PITCH * ratio * (1 + (Math.random() - 0.5) * 0.002));
    const gain = gainNode(context, 0);
    nodes.push(tone, gain);
    tone.connect(gain).connect(distance);
    times.forEach((time, hit) => strike(gain.gain, time, peak * amount * Math.pow(0.65, hit), decay, 0.002));
    tone.start(when);
    tone.stop(end);
    last = tone;
  }
  if (last) release(last, nodes);
  return end - when;
};

const BLIP_NOTES = [1318.5, 1568, 1760, 2093, 2349.3, 2637];

/** Bips de données : bavardage pentatonique, petit arpège ou glissando de modem. */
const blip: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const tone = oscillator(context, 'triangle', 1568);
  const gain = gainNode(context, 0);
  nodes.push(tone, gain);
  tone.connect(gain).connect(out);
  const peak = 0.025 * level;
  const pattern = Math.random();
  let at = when;
  if (pattern < 0.15) {
    tone.frequency.setValueAtTime(900, at);
    tone.frequency.exponentialRampToValueAtTime(2400, at + 0.18);
    gain.gain.setTargetAtTime(peak * 0.7, at, 0.01);
    gain.gain.setTargetAtTime(0, at + 0.16, 0.02);
    at += 0.3;
  } else {
    const arpeggio = pattern < 0.4;
    const count = arpeggio ? 3 : 2 + Math.floor(Math.random() * 4);
    const first = Math.floor(Math.random() * (BLIP_NOTES.length - 3));
    for (let pip = 0; pip < count; pip++) {
      const note = arpeggio ? BLIP_NOTES[first + pip] : BLIP_NOTES[Math.floor(Math.random() * BLIP_NOTES.length)];
      tone.frequency.setValueAtTime(note, at);
      strike(gain.gain, at, peak * random(0.7, 1), 0.016, 0.002);
      at += arpeggio ? 0.075 : random(0.085, 0.14);
    }
    at += 0.12;
  }
  tone.start(when);
  tone.stop(at);
  release(tone, nodes);
  return at - when;
};

/** Camionnette de livraison qui recule : bip carré filtré, quatre à sept fois. */
const van: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const tone = oscillator(context, 'square', 1040);
  const soft = filterNode(context, 'lowpass', 1900, 0.7);
  const gain = gainNode(context, 0);
  nodes.push(tone, soft, gain);
  tone.connect(soft).connect(gain).connect(out);
  const beeps = 4 + Math.floor(Math.random() * 4);
  const peak = 0.009 * level;
  for (let beep = 0; beep < beeps; beep++) {
    const at = when + beep * 0.62;
    gain.gain.setTargetAtTime(peak, at, 0.006);
    gain.gain.setTargetAtTime(0, at + 0.3, 0.008);
  }
  const end = when + beeps * 0.62 + 0.1;
  tone.start(when);
  tone.stop(end);
  release(tone, nodes);
  return end - when;
};

/** Sonnette de vélo : « dring-dring », deux partiels avec le frémissement du timbre. */
const bike: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const low = oscillator(context, 'sine', 2350);
  const high = oscillator(context, 'sine', 3480);
  const gain = gainNode(context, 0);
  const tremolo = gainNode(context, 0.65);
  const flutter = oscillator(context, 'sine', 27);
  const depth = gainNode(context, 0.35);
  nodes.push(low, high, gain, tremolo, flutter, depth);
  low.connect(gain);
  high.connect(gain);
  gain.connect(tremolo).connect(out);
  flutter.connect(depth).connect(tremolo.gain);
  const peak = 0.02 * level;
  strike(gain.gain, when, peak, 0.12);
  strike(gain.gain, when + 0.21, peak * 0.9, 0.16);
  const end = when + 1.1;
  for (const node of [low, high, flutter]) {
    node.start(when);
    node.stop(end);
  }
  release(low, nodes);
  return end - when;
};

/** Grue du chantier : choc d'acier (modes inharmoniques + impact) ou chaîne qui cliquette. */
const clank: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const distance = filterNode(context, 'lowpass', 3000, 0.6);
  distance.connect(out);
  nodes.push(distance);
  const noise = white(context);
  if (Math.random() < 0.35) {
    const source = noiseShot(context, noise, when, 1.4, nodes);
    const band = filterNode(context, 'bandpass', 2600, 1.5);
    const gain = gainNode(context, 0);
    nodes.push(band, gain);
    source.connect(band).connect(gain).connect(distance);
    const links = 8 + Math.floor(Math.random() * 7);
    let at = when;
    for (let link = 0; link < links; link++) {
      strike(gain.gain, at, 0.1 * level * (1 - link / (links + 4)) * random(0.5, 1), 0.008, 0.001);
      at += random(0.05, 0.11);
    }
    release(source, nodes);
    return 1.4;
  }
  const hits = Math.random() < 0.4 ? 2 : 1;
  const base = random(180, 260);
  const modes: [number, number, number][] = [[1, 1, 0.18], [2.41, 0.6, 0.1], [3.93, 0.4, 0.06]];
  const end = when + 1.4;
  let last: AudioScheduledSourceNode | null = null;
  for (const [ratio, amount, decay] of modes) {
    const tone = oscillator(context, 'sine', base * ratio);
    const gain = gainNode(context, 0);
    nodes.push(tone, gain);
    tone.connect(gain).connect(distance);
    for (let hit = 0; hit < hits; hit++) strike(gain.gain, when + hit * 0.27, 0.055 * level * amount * (hit ? 0.6 : 1), decay, 0.001);
    tone.start(when);
    tone.stop(end);
    last = tone;
  }
  const impact = noiseShot(context, noise, when, 0.4, nodes);
  const band = filterNode(context, 'bandpass', 1800, 0.8);
  const impactGain = gainNode(context, 0);
  nodes.push(band, impactGain);
  impact.connect(band).connect(impactGain).connect(distance);
  for (let hit = 0; hit < hits; hit++) strike(impactGain.gain, when + hit * 0.27, 0.066 * level * (hit ? 0.6 : 1), 0.012, 0.0008);
  if (last) release(last, nodes);
  return end - when;
};

/** Clapotis contre le quai : bruit dont la bande retombe, parfois une petite bulle. */
const plop: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const source = noiseShot(context, white(context), when, 0.5, nodes);
  const band = filterNode(context, 'bandpass', 1200, 1.8);
  const gain = gainNode(context, 0);
  nodes.push(band, gain);
  source.connect(band).connect(gain).connect(out);
  const peak = 0.093 * level;
  band.frequency.setValueAtTime(random(1000, 1400), when);
  band.frequency.exponentialRampToValueAtTime(random(300, 420), when + 0.2);
  strike(gain.gain, when, peak, 0.06, 0.006);
  if (Math.random() < 0.4) {
    const again = when + random(0.13, 0.22);
    band.frequency.setValueAtTime(random(800, 1100), again);
    band.frequency.exponentialRampToValueAtTime(300, again + 0.16);
    strike(gain.gain, again, peak * 0.55, 0.05, 0.006);
  }
  if (Math.random() < 0.3) {
    const bubble = oscillator(context, 'sine', 600);
    const bubbleGain = gainNode(context, 0);
    nodes.push(bubble, bubbleGain);
    bubble.connect(bubbleGain).connect(out);
    const at = when + 0.05;
    bubble.frequency.setValueAtTime(random(520, 700), at);
    bubble.frequency.exponentialRampToValueAtTime(random(1000, 1300), at + 0.05);
    strike(bubbleGain.gain, at, peak * 0.35, 0.015, 0.002);
    bubble.start(at);
    bubble.stop(at + 0.12);
  }
  release(source, nodes);
  return 0.5;
};

/** Vague qui s'écrase sur les rochers : bande qui s'ouvre puis retombe, boum grave, écume. */
const crash: Shot = (context, destination, when, level, pan, lite) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const duration = 2.8;
  const source = noiseShot(context, white(context), when, duration, nodes);
  const band = filterNode(context, 'bandpass', 380, 0.6);
  const body = filterNode(context, 'lowpass', 2400, 0.6);
  const gain = gainNode(context, 0);
  nodes.push(band, body, gain);
  source.connect(band).connect(body).connect(gain).connect(out);
  band.frequency.setValueAtTime(380, when);
  band.frequency.exponentialRampToValueAtTime(random(1300, 1700), when + 0.25);
  band.frequency.exponentialRampToValueAtTime(520, when + 2.4);
  const peak = 0.061 * level;
  gain.gain.setTargetAtTime(peak, when, 0.06);
  gain.gain.setTargetAtTime(0, when + 0.32, 0.6);
  const boom = noiseShot(context, brown(context), when, 1.2, nodes);
  const low = filterNode(context, 'lowpass', 200, 0.7);
  const boomGain = gainNode(context, 0);
  nodes.push(low, boomGain);
  boom.connect(low).connect(boomGain).connect(out);
  boomGain.gain.setTargetAtTime(peak * 1.6, when + 0.05, 0.03);
  boomGain.gain.setTargetAtTime(0, when + 0.18, 0.25);
  if (!lite) {
    const spray = noiseShot(context, white(context), when + 0.15, 2, nodes);
    const hiss = filterNode(context, 'highpass', 3500, 0.7);
    const sprayGain = gainNode(context, 0);
    nodes.push(hiss, sprayGain);
    spray.connect(hiss).connect(sprayGain).connect(out);
    sprayGain.gain.setTargetAtTime(peak * 0.25, when + 0.2, 0.08);
    sprayGain.gain.setTargetAtTime(0, when + 0.5, 0.5);
  }
  release(source, nodes);
  return duration;
};

/** Corne de brume (diaphone) : longue plainte grave, grognement final, écho des falaises. */
const foghorn: Shot = (context, destination, when, level, pan, lite) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const horn = filterNode(context, 'lowpass', 380, 1.1);
  const gain = gainNode(context, 0);
  const echo = context.createDelay(2);
  echo.delayTime.value = 1.15;
  const echoTone = filterNode(context, 'lowpass', 300, 0.6);
  const feedback = gainNode(context, 0.38);
  nodes.push(horn, gain, echo, echoTone, feedback);
  horn.connect(gain).connect(out);
  gain.connect(echo).connect(echoTone).connect(feedback).connect(echo);
  echoTone.connect(out);
  const voices = lite ? [100] : [100, 100.7];
  const end = when + 3.2;
  let first: OscillatorNode | null = null;
  for (const pitch of voices) {
    const reed = oscillator(context, 'sawtooth', pitch);
    nodes.push(reed);
    reed.connect(horn);
    reed.frequency.setValueAtTime(pitch, when + 2.35);
    reed.frequency.exponentialRampToValueAtTime(pitch * 0.74, when + 2.85);
    reed.start(when);
    reed.stop(end);
    first ??= reed;
  }
  const peak = 0.063 * level;
  gain.gain.setTargetAtTime(peak, when, 0.12);
  gain.gain.setTargetAtTime(peak * 0.85, when + 1.2, 0.5);
  gain.gain.setTargetAtTime(0, when + 2.55, 0.14);
  // L'écho s'éteint en quelques secondes après la fin de la corne.
  if (first) release(first, nodes, 5);
  return end - when + 4;
};

/** Claque de l'eau sur la coque : souffle bref et sourd, petit choc grave. */
const slap: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const source = noiseShot(context, white(context), when, 0.3, nodes);
  const low = filterNode(context, 'lowpass', 900, 0.8);
  const gain = gainNode(context, 0);
  nodes.push(low, gain);
  source.connect(low).connect(gain).connect(out);
  low.frequency.setValueAtTime(random(800, 1100), when);
  low.frequency.exponentialRampToValueAtTime(380, when + 0.12);
  const peak = 0.1 * level;
  strike(gain.gain, when, peak, 0.035, 0.003);
  const thump = oscillator(context, 'sine', 120);
  const thumpGain = gainNode(context, 0);
  nodes.push(thump, thumpGain);
  thump.connect(thumpGain).connect(out);
  thump.frequency.setValueAtTime(random(105, 130), when);
  thump.frequency.exponentialRampToValueAtTime(55, when + 0.1);
  strike(thumpGain.gain, when, peak * 1.2, 0.04, 0.002);
  thump.start(when);
  thump.stop(when + 0.3);
  release(source, nodes);
  return 0.3;
};

const CHIME_NOTES = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];

/** Carillon de l'îlot du design : tubes accordés (pentatonique), deux à quatre notes. */
const chime: Shot = (context, destination, when, level, pan) => {
  const nodes: AudioNode[] = [];
  const out = output(context, destination, pan, nodes);
  const count = 2 + Math.floor(Math.random() * 3);
  const peak = 0.021 * level;
  let at = when;
  let end = when;
  let last: OscillatorNode | null = null;
  for (let note = 0; note < count; note++) {
    const pitch = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
    const tube = oscillator(context, 'sine', pitch);
    const overtone = oscillator(context, 'sine', pitch * 2.76);
    const tubeGain = gainNode(context, 0);
    const overtoneGain = gainNode(context, 0);
    nodes.push(tube, overtone, tubeGain, overtoneGain);
    tube.connect(tubeGain).connect(out);
    overtone.connect(overtoneGain).connect(out);
    const loud = peak * random(0.6, 1);
    strike(tubeGain.gain, at, loud, 0.35, 0.002);
    strike(overtoneGain.gain, at, loud * 0.3, 0.1, 0.002);
    const stop = at + 2;
    tube.start(at);
    overtone.start(at);
    tube.stop(stop);
    overtone.stop(stop);
    end = stop;
    last = tube;
    at += random(0.25, 0.6);
  }
  if (last) release(last, nodes);
  return end - when;
};

/** Indexé par EVENT (voir mix.ts). */
export const SHOTS: Shot[] = [gull, creak, halyard, bellBuoy, blip, van, bike, clank, plop, crash, foghorn, slap, chime];

/** Bruit blanc partagé (sons d'interface). */
export function whiteNoise(context: Context) {
  return white(context);
}

/** Bruit brun partagé (sons d'interface). */
export function brownNoise(context: Context) {
  return brown(context);
}

export { strike, gainNode, filterNode, oscillator, noiseShot, release, output };
