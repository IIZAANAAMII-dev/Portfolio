import { ambience } from '@/lib/audio/ambience';

/**
 * Le son de YELLOW STATIC, seulement si le visiteur a activé le son (`ambience.bus()`
 * renvoie null sinon) : bourdon électrique de néon (60 Hz et harmoniques, grésillement du
 * ballast), souffle de bande magnétique, et de rares coups sourds, comme frappés dans un mur.
 * La musique de fond s'efface à l'approche. Tout est détruit dès qu'on s'éloigne.
 */

let noiseBuffer: AudioBuffer | null = null;

function noise(context: AudioContext) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
    const length = context.sampleRate * 2;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function cleanup(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
  source.addEventListener('ended', () => nodes.forEach((node) => node.disconnect()), { once: true });
}

/** Grésillement haché : une rafale de petites coupures de bruit filtré. */
export function crackle(strength = 1, delay = 0) {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  source.buffer = noise(context);
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400 + Math.random() * 2200;
  band.Q.value = 0.7;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  const level = 0.06 * (0.35 + Math.max(0, Math.min(1, strength)) * 0.65);
  let at = start;
  for (let cut = 0; cut < 16; cut++) {
    gain.gain.setValueAtTime(Math.random() > 0.42 ? level * (0.35 + Math.random() * 0.65) : 0, at);
    at += 0.018 + Math.random() * 0.045;
  }
  gain.gain.setValueAtTime(0, at);
  source.connect(band).connect(gain).connect(destination);
  source.start(start, Math.random());
  source.stop(at + 0.05);
  cleanup(source, [source, band, gain]);
}

/** La cassette qu'on enfonce : choc mécanique, moteur qui démarre, un peu de neige. */
export function tapeInsert() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime;
  const thump = context.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(150, now);
  thump.frequency.exponentialRampToValueAtTime(52, now + 0.12);
  const thumpGain = context.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  thump.connect(thumpGain).connect(destination);
  thump.start(now);
  thump.stop(now + 0.24);
  cleanup(thump, [thump, thumpGain]);

  const motor = context.createOscillator();
  motor.type = 'sawtooth';
  motor.frequency.setValueAtTime(44, now + 0.16);
  motor.frequency.linearRampToValueAtTime(96, now + 0.8);
  const low = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 460;
  const motorGain = context.createGain();
  motorGain.gain.setValueAtTime(0.0001, now + 0.16);
  motorGain.gain.exponentialRampToValueAtTime(0.045, now + 0.32);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
  motor.connect(low).connect(motorGain).connect(destination);
  motor.start(now + 0.16);
  motor.stop(now + 1);
  cleanup(motor, [motor, low, motorGain]);
  crackle(0.7, 0.05);
}

interface Graph {
  context: AudioContext;
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

export class StaticAmbience {
  private graph: Graph | null = null;
  private knockIn = 7;
  private duck = -1;

  /** Appelé quelques fois par seconde avec la proximité (0 au large → 1 au ponton). */
  update(proximity: number, dt: number) {
    const bus = ambience.bus();
    const level = bus ? Math.max(0, Math.min(1, proximity)) : 0;
    if (Math.abs(level - this.duck) > 0.02 || (level === 0 && this.duck !== 0)) {
      this.duck = level;
      ambience.setMusicDuck('static', level * 0.85);
    }
    if (!bus || level <= 0.002) {
      this.release();
      return;
    }
    if (!this.graph || this.graph.context !== bus.context) {
      this.release();
      this.graph = this.build(bus.context, bus.destination);
    }
    const graph = this.graph;
    graph.out.gain.setTargetAtTime(Math.pow(level, 1.4), graph.context.currentTime, 0.4);
    this.knockIn -= dt;
    if (this.knockIn <= 0) {
      this.knockIn = 8 + Math.random() * 14;
      if (level > 0.35) this.knock(graph, level);
    }
  }

  dispose() {
    this.release();
    this.duck = 0;
    ambience.setMusicDuck('static', 0);
  }

  private build(context: AudioContext, destination: AudioNode): Graph {
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const out = context.createGain();
    out.gain.value = 0;
    out.connect(destination);
    nodes.push(out);

    // Bourdon : 60 Hz et ses harmoniques, plus le grésillement aigu du ballast.
    const hum = context.createGain();
    hum.gain.value = 0.06;
    hum.connect(out);
    nodes.push(hum);
    const partials: [number, number, OscillatorType][] = [[60, 1, 'sine'], [120, 0.6, 'sine'], [180, 0.3, 'triangle'], [240, 0.16, 'sine']];
    for (const [frequency, level, type] of partials) {
      const tone = context.createOscillator();
      tone.type = type;
      tone.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = level;
      tone.connect(gain).connect(hum);
      tone.start();
      sources.push(tone);
      nodes.push(tone, gain);
    }
    const buzz = context.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 120;
    const high = context.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1500;
    const buzzGain = context.createGain();
    buzzGain.gain.value = 0.16;
    buzz.connect(high).connect(buzzGain).connect(hum);
    buzz.start();
    // Le néon fatigue : le bourdon tremble.
    const flutter = context.createOscillator();
    flutter.frequency.value = 0.8;
    const flutterDepth = context.createGain();
    flutterDepth.gain.value = 0.018;
    flutter.connect(flutterDepth).connect(hum.gain);
    flutter.start();
    sources.push(buzz, flutter);
    nodes.push(buzz, high, buzzGain, flutter, flutterDepth);

    // Souffle de bande : bruit en boucle, filtré, avec un léger pleurage.
    const hiss = context.createBufferSource();
    hiss.buffer = noise(context);
    hiss.loop = true;
    const hissHigh = context.createBiquadFilter();
    hissHigh.type = 'highpass';
    hissHigh.frequency.value = 2400;
    const hissLow = context.createBiquadFilter();
    hissLow.type = 'lowpass';
    hissLow.frequency.value = 7500;
    const hissGain = context.createGain();
    hissGain.gain.value = 0.03;
    hiss.connect(hissHigh).connect(hissLow).connect(hissGain).connect(out);
    hiss.start();
    const wow = context.createOscillator();
    wow.frequency.value = 0.33;
    const wowDepth = context.createGain();
    wowDepth.gain.value = 1400;
    wow.connect(wowDepth).connect(hissLow.frequency);
    wow.start();
    sources.push(hiss, wow);
    nodes.push(hiss, hissHigh, hissLow, hissGain, wow, wowDepth);

    return { context, out, sources, nodes };
  }

  /** Deux ou trois coups sourds, quelque part dans les murs. */
  private knock(graph: Graph, level: number) {
    const { context, out } = graph;
    const now = context.currentTime;
    const pan = context.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 360;
    const echo = context.createDelay(1);
    echo.delayTime.value = 0.19;
    const feedback = context.createGain();
    feedback.gain.value = 0.3;
    low.connect(pan);
    pan.connect(out);
    pan.connect(echo);
    echo.connect(feedback).connect(echo);
    echo.connect(out);
    const count = Math.random() > 0.6 ? 3 : 2;
    const tones: OscillatorNode[] = [];
    for (let index = 0; index < count; index++) {
      const at = now + index * (0.3 + Math.random() * 0.08);
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(78, at);
      tone.frequency.exponentialRampToValueAtTime(44, at + 0.14);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.45 * level, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      tone.connect(gain).connect(low);
      tone.start(at);
      tone.stop(at + 0.26);
      tones.push(tone);
      cleanup(tone, [tone, gain]);
    }
    window.setTimeout(() => {
      [low, pan, echo, feedback].forEach((node) => node.disconnect());
    }, (count * 0.4 + 2.5) * 1000);
  }

  private release() {
    const graph = this.graph;
    if (!graph) return;
    this.graph = null;
    const now = graph.context.currentTime;
    graph.out.gain.cancelScheduledValues(now);
    graph.out.gain.setTargetAtTime(0, now, 0.08);
    window.setTimeout(() => {
      graph.sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Déjà arrêtée.
        }
      });
      graph.nodes.forEach((node) => node.disconnect());
    }, 450);
  }
}
