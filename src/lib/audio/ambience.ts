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
  private nodes: AudioNode[] = [];

  private async ensure() {
    if (this.context) return this.context;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    this.master = master;

    // Groupe ambiant (vagues + vent), moins fort que la musique.
    const ambientGain = context.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(master);
    this.ambientGain = ambientGain;

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

    this.context = context;
    return context;
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

  async setEnabled(enabled: boolean) {
    const context = await this.ensure();
    if (!context || !this.master) return;
    if (enabled) {
      if (context.state === 'suspended') await context.resume();
      if (!this.musicSource) this.startMusic();
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
      this.musicGain.gain.linearRampToValueAtTime(enabled ? 0.35 : 0, now + (enabled ? 2.5 : 0.4));
    }

    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(enabled ? 0.22 : 0, now + (enabled ? 2.5 : 0.4));
    }
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
