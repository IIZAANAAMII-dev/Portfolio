/**
 * Ambiance sonore : musique de fond + ressac généré + effets procéduraux.
 * Le contexte n'est créé qu'après un geste utilisateur, comme l'exigent les navigateurs.
 */
class Ambience {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private stormGain: GainNode | null = null;
  private stormBuffer: AudioBuffer | null = null;
  private thunderBuffer: AudioBuffer | null = null;
  private stormSource: AudioBufferSourceNode | null = null;
  private splashBuffer: AudioBuffer | null = null;
  private engine: { gain: GainNode; filter: BiquadFilterNode; rush: GainNode; low: OscillatorNode; high: OscillatorNode } | null = null;
  private enabled = false;
  private boundaryIntensity = 0;
  private boundaryHush = 0;
  private nodes: AudioNode[] = [];

  private async ensure() {
    if (this.context) return this.context;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const context = new Ctor();
    // Publier le contexte immédiatement : Intro et Experience peuvent demander
    // l'activation dans le même geste. Sans ce garde-fou, le chargement asynchrone
    // de la musique permettait de créer deux AudioContext concurrents.
    this.context = context;
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    this.master = master;

    // Groupe ambiant (vagues + vent), moins fort que la musique.
    const ambientGain = context.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(master);
    this.ambientGain = ambientGain;

    // Bus météo séparé : la tempête peut remplacer progressivement l'ambiance
    // tropicale sans créer/détruire de sources à chaque franchissement de limite.
    const stormGain = context.createGain();
    stormGain.gain.value = 0;
    stormGain.connect(master);
    this.stormGain = stormGain;

    // Bruit brownien : la base du ressac.
    const seconds = 4;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const surf = context.createBiquadFilter();
    surf.type = 'lowpass';
    surf.frequency.value = 520;

    // Deux vagues lentes et désaccordées : le rythme ne se répète pas.
    const swell = context.createGain();
    swell.gain.value = 0.6;
    [0.07, 0.041].forEach((rate, index) => {
      const lfo = context.createOscillator();
      lfo.frequency.value = rate;
      const depth = context.createGain();
      depth.gain.value = index === 0 ? 0.28 : 0.16;
      lfo.connect(depth).connect(swell.gain);
      lfo.start();
      this.nodes.push(lfo, depth);
    });

    // Souffle du vent, très en retrait.
    const wind = context.createBiquadFilter();
    wind.type = 'bandpass';
    wind.frequency.value = 1100;
    wind.Q.value = 0.7;
    const windGain = context.createGain();
    windGain.gain.value = 0.05;

    source.connect(surf).connect(swell).connect(ambientGain);
    source.connect(wind).connect(windGain).connect(ambientGain);
    source.start();

    this.nodes.push(source, surf, swell, wind, windGain);

    // Piste de fond.
    this.musicBuffer = await this.loadMusic(context);
    const musicGain = context.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    this.musicGain = musicGain;

    // Les bruitages restent locaux au site. Leur chargement ne bloque ni la musique,
    // ni la première interaction du visiteur.
    void this.loadWeather(context);

    return context;
  }

  private async loadBuffer(context: AudioContext, url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio not found: ${response.status}`);
    return context.decodeAudioData(await response.arrayBuffer());
  }

  private async loadWeather(context: AudioContext) {
    try {
      const [storm, thunder] = await Promise.all([
        this.loadBuffer(context, '/audio/living-ocean/rain-pack/1.mp3'),
        this.loadBuffer(context, '/audio/living-ocean/thunderclap.ogg'),
      ]);
      this.stormBuffer = storm;
      this.thunderBuffer = thunder;
      if (this.enabled || this.boundaryIntensity > 0.01) this.startStorm();
    } catch (error) {
      console.warn('Could not load boundary weather:', error);
    }
  }

  private async loadMusic(context: AudioContext): Promise<AudioBuffer | null> {
    try {
      const url = '/models/' + encodeURIComponent('Bateau sur l’équateur.mp3');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`audio not found: ${res.status}`);
      const data = await res.arrayBuffer();
      return await context.decodeAudioData(data);
    } catch (e) {
      console.warn('Could not load music:', e);
      return null;
    }
  }

  private startMusic() {
    if (!this.context || !this.musicBuffer || !this.musicGain) return;
    if (this.musicSource) this.musicSource.stop();
    const src = this.context.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start(0);
    this.musicSource = src;
  }

  private stopMusic() {
    if (this.musicSource) {
      this.musicSource.stop();
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  private startStorm() {
    if (!this.context || !this.stormBuffer || !this.stormGain || this.stormSource) return;
    const source = this.context.createBufferSource();
    source.buffer = this.stormBuffer;
    source.loop = true;
    source.connect(this.stormGain);
    source.start();
    this.stormSource = source;
  }

  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    // L'état initial est silencieux. Ne pas créer d'AudioContext tant que le visiteur
    // n'a pas réellement demandé le son, sinon les navigateurs déclenchent leur garde
    // autoplay avant tout geste utilisateur.
    if (!enabled && !this.context) return;
    const context = await this.ensure();
    if (!context || !this.master) return;
    if (enabled) {
      if (context.state === 'suspended') await context.resume();
      if (!this.musicSource) this.startMusic();
      this.startStorm();
    } else {
      this.stopMusic();
    }
    const now = context.currentTime;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(enabled ? 0.42 : 0, now + (enabled ? 2.2 : 0.6));

    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      const musicTarget = enabled
        ? 0.35 * (1 - this.boundaryIntensity * 0.78) * (1 - this.boundaryHush * 0.9)
        : 0;
      this.musicGain.gain.linearRampToValueAtTime(musicTarget, now + (enabled ? 2.5 : 0.4));
    }

    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(enabled ? 0.22 : 0, now + (enabled ? 2.5 : 0.4));
    }

    if (this.stormGain) {
      this.stormGain.gain.cancelScheduledValues(now);
      this.stormGain.gain.setValueAtTime(this.stormGain.gain.value, now);
      this.stormGain.gain.linearRampToValueAtTime(
        enabled ? this.boundaryIntensity * 0.48 * (1 - this.boundaryHush * 0.62) : 0,
        now + (enabled ? 1.2 : 0.35),
      );
    }
  }

  /** Mix continu de la mer interdite. Appelé à cadence réduite par BoundaryStorm. */
  setBoundaryIntensity(intensity: number, hush = 0) {
    this.boundaryIntensity = Math.max(0, Math.min(1, intensity));
    this.boundaryHush = Math.max(0, Math.min(1, hush));
    const context = this.context;
    if (!context || !this.master || !this.stormGain) return;
    this.startStorm();
    const now = context.currentTime;
    const audible = this.enabled && this.master.gain.value > 0.001;

    this.stormGain.gain.cancelScheduledValues(now);
    this.stormGain.gain.setValueAtTime(this.stormGain.gain.value, now);
    this.stormGain.gain.linearRampToValueAtTime(
      audible ? this.boundaryIntensity * 0.48 * (1 - this.boundaryHush * 0.62) : 0,
      now + 0.45,
    );

    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(
        audible
          ? 0.35 * (1 - this.boundaryIntensity * 0.78) * (1 - this.boundaryHush * 0.9)
          : 0,
        now + 0.65,
      );
    }
  }

  /** Coup de tonnerre réutilisant un seul buffer, sans nouvelle requête réseau. */
  thunder(strength = 1) {
    const context = this.context;
    if (!context || !this.master || !this.thunderBuffer || !this.enabled) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = this.thunderBuffer;
    source.playbackRate.value = 0.88 + Math.random() * 0.18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22 * Math.max(0.25, strength), now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);
    source.connect(gain).connect(this.master);
    source.start(now, Math.random() * Math.max(0, this.thunderBuffer.duration - 5.2));
    source.stop(now + 5.25);
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    }, { once: true });
  }

  /**
   * « Plouf » de l'intro : un bruit blanc filtré dont l'aigu retombe (la gerbe d'eau)
   * et un coup sourd très court (la coque). Branché hors du bus principal, qui est encore
   * en fondu d'ouverture au moment de l'impact.
   */
  splash(strength = 1) {
    const context = this.context;
    if (!context || !this.enabled) return;
    const now = context.currentTime;
    const noise = context.createBufferSource();
    noise.buffer = this.noise(context);
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(2400, now);
    band.frequency.exponentialRampToValueAtTime(360, now + 1.1);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.16 * strength, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    noise.connect(band).connect(noiseGain).connect(context.destination);

    const thump = context.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(44, now + 0.3);
    const thumpGain = context.createGain();
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.2 * strength, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    thump.connect(thumpGain).connect(context.destination);

    noise.start(now);
    noise.stop(now + 1.4);
    thump.start(now);
    thump.stop(now + 0.42);
    noise.addEventListener('ended', () => {
      noise.disconnect();
      band.disconnect();
      noiseGain.disconnect();
    }, { once: true });
    thump.addEventListener('ended', () => {
      thump.disconnect();
      thumpGain.disconnect();
    }, { once: true });
  }

  /** Bruit blanc partagé par les petits effets (chocs, éclaboussures). */
  private noise(context: AudioContext) {
    if (!this.splashBuffer) {
      const length = Math.floor(context.sampleRate * 1.4);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.splashBuffer = buffer;
    }
    return this.splashBuffer;
  }

  /** Enveloppe courte : attaque, puis extinction exponentielle. */
  private envelope(context: AudioContext, peak: number, attack: number, release: number) {
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
    gain.connect(context.destination);
    return gain;
  }

  /**
   * Choc d'un objet flottant : « mou » (ballon, bouée), « bois » (caisse) ou « canard »
   * (couinement de jouet en caoutchouc).
   */
  bump(kind: 'soft' | 'wood' | 'duck', strength = 1) {
    const context = this.context;
    if (!context || !this.enabled) return;
    const now = context.currentTime;
    if (kind === 'duck') {
      const squeak = context.createOscillator();
      squeak.type = 'triangle';
      squeak.frequency.setValueAtTime(760, now);
      squeak.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
      squeak.frequency.exponentialRampToValueAtTime(980, now + 0.22);
      const out = this.envelope(context, 0.09 * strength + 0.04, 0.015, 0.24);
      squeak.connect(out);
      squeak.start(now);
      squeak.stop(now + 0.3);
      return;
    }
    const thump = context.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(kind === 'wood' ? 190 : 140, now);
    thump.frequency.exponentialRampToValueAtTime(kind === 'wood' ? 90 : 60, now + 0.16);
    thump.connect(this.envelope(context, 0.16 * strength + 0.04, 0.008, 0.2));
    thump.start(now);
    thump.stop(now + 0.25);
    const splash = context.createBufferSource();
    splash.buffer = this.noise(context);
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = kind === 'wood' ? 900 : 1500;
    band.Q.value = 0.9;
    splash.connect(band).connect(this.envelope(context, 0.05 * strength + 0.02, 0.01, 0.35));
    splash.start(now, Math.random() * 0.8);
    splash.stop(now + 0.4);
  }

  /**
   * Moteur du bateau : un ronronnement grave (deux oscillateurs filtrés) et le bruissement
   * de l'eau sur la coque, qui montent avec la vitesse (0 → 1). Créé au premier appel.
   */
  setEngine(throttle: number) {
    const context = this.context;
    if (!context || !this.master) return;
    if (!this.engine) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 160;
      filter.Q.value = 2.2;
      const gain = context.createGain();
      gain.gain.value = 0;
      const low = context.createOscillator();
      low.type = 'sawtooth';
      low.frequency.value = 46;
      const high = context.createOscillator();
      high.type = 'square';
      high.frequency.value = 92.5;
      const highLevel = context.createGain();
      highLevel.gain.value = 0.35;
      low.connect(filter);
      high.connect(highLevel).connect(filter);
      filter.connect(gain).connect(this.master);
      // Bruissement : bruit en boucle, filtré en bande.
      const water = context.createBufferSource();
      water.buffer = this.noise(context);
      water.loop = true;
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.6;
      const rush = context.createGain();
      rush.gain.value = 0;
      water.connect(band).connect(rush).connect(this.master);
      low.start();
      high.start();
      water.start();
      this.engine = { gain, filter, rush, low, high };
    }
    const now = context.currentTime;
    const t = Math.max(0, Math.min(1, throttle));
    this.engine.gain.gain.setTargetAtTime(0.012 + t * 0.07, now, 0.25);
    this.engine.filter.frequency.setTargetAtTime(150 + t * 520, now, 0.3);
    this.engine.low.frequency.setTargetAtTime(44 + t * 22, now, 0.3);
    this.engine.high.frequency.setTargetAtTime(88 + t * 44, now, 0.3);
    this.engine.rush.gain.setTargetAtTime(t * t * 0.09, now, 0.35);
  }

  /** Une note : oscillateur, enveloppe, filtre optionnel (timbres des motifs d'îlots). */
  private note(
    frequency: number,
    start: number,
    length: number,
    { type = 'sine', peak = 0.06, vibrato = 0, band = 0 }: { type?: OscillatorType; peak?: number; vibrato?: number; band?: number } = {},
  ) {
    const context = this.context;
    if (!context) return;
    const tone = context.createOscillator();
    tone.type = type;
    tone.frequency.value = frequency;
    if (vibrato > 0) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(tone.frequency);
      lfo.start(start);
      lfo.stop(start + length + 0.1);
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.setValueAtTime(peak, start + length * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    let chain: AudioNode = tone;
    if (band > 0) {
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = band;
      filter.Q.value = 1.4;
      chain = tone.connect(filter);
    }
    chain.connect(gain).connect(context.destination);
    tone.start(start);
    tone.stop(start + length + 0.05);
  }

  /**
   * Motif d'éveil d'un îlot de personnalité : air de cornemuse sur bourdon pour la
   * Bretagne, arpège numérique pour le high-tech, cloches douces pour le design.
   */
  motif(kind: 'breizh' | 'tech' | 'design') {
    const context = this.context;
    if (!context || !this.enabled) return;
    const now = context.currentTime + 0.05;
    if (kind === 'breizh') {
      this.note(146.8, now, 2.2, { type: 'sawtooth', peak: 0.025, band: 600 });
      const tune: [number, number][] = [[880, 0.22], [987.8, 0.22], [880, 0.22], [784, 0.3], [659.3, 0.3], [587.3, 0.6]];
      let at = now;
      for (const [frequency, length] of tune) {
        this.note(frequency, at, length * 1.05, { type: 'sawtooth', peak: 0.03, vibrato: 4, band: 1400 });
        at += length;
      }
    } else if (kind === 'tech') {
      [1046.5, 1318.5, 1568, 2093, 1568, 2093].forEach((frequency, index) => {
        this.note(frequency, now + index * 0.07, 0.09, { type: 'square', peak: 0.018 });
      });
    } else {
      [523.3, 659.3, 784, 987.8].forEach((frequency, index) => {
        this.note(frequency, now + index * 0.12, 1.4, { type: 'sine', peak: 0.045 });
      });
    }
  }

  /** Arpège cristallin : une étoile d'or repêchée, un tampon gagné. */
  chime(notes: number[] = [880, 1175, 1568], spacing = 0.07) {
    const context = this.context;
    if (!context || !this.enabled) return;
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * spacing;
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      tone.connect(gain).connect(context.destination);
      tone.start(start);
      tone.stop(start + 1);
    });
  }

  /** Petit repère sonore : clic, accostage, ouverture. */
  cue(frequency: number, duration = 0.16) {
    const context = this.context;
    if (!context || !this.master || this.master.gain.value < 0.001) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }
}

export const ambience = new Ambience();
