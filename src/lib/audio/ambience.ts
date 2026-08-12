/**
 * Ambiance sonore générée à la volée (bruit filtré modulé) plutôt que chargée.
 * Aucun asset audio à télécharger, aucune licence à gérer, et le ressac ne boucle
 * jamais de façon audible. Le contexte n'est créé qu'après un geste utilisateur, comme
 * l'exigent les navigateurs.
 */
class Ambience {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];

  private ensure() {
    if (this.context) return this.context;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

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

    source.connect(surf).connect(swell).connect(master);
    source.connect(wind).connect(windGain).connect(master);
    source.start();

    this.nodes.push(source, surf, swell, wind, windGain);
    this.context = context;
    this.master = master;
    return context;
  }

  async setEnabled(enabled: boolean) {
    const context = this.ensure();
    if (!context || !this.master) return;
    if (enabled && context.state === 'suspended') await context.resume();
    const now = context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(enabled ? 0.16 : 0, now + (enabled ? 2.2 : 0.6));
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
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }
}

export const ambience = new Ambience();
