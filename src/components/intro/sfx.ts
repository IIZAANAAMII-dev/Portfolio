import { ambience } from '@/lib/audio/ambience';

/**
 * Bruitages de la cinématique d'ouverture, construits à la volée sur le contexte audio de
 * l'ambiance (aucun fichier). Muets tant que le visiteur n'a pas activé le son. Branchés
 * hors du bus principal, encore en fondu d'ouverture pendant les premières secondes
 * (comme l'éclaboussure du bateau).
 */
let noiseBuffer: AudioBuffer | null = null;

function noise(context: AudioContext) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
    const length = Math.floor(context.sampleRate * 1.6);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function release(...nodes: AudioNode[]) {
  return () => nodes.forEach((node) => node.disconnect());
}

export const introSfx = {
  /** « Teuf » : le moteur qui toussote (coup sourd grave et souffle d'échappement). */
  cough(strength = 1) {
    const bus = ambience.bus();
    if (!bus) return;
    const { context } = bus;
    const now = context.currentTime;
    const thump = context.createOscillator();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(78, now);
    thump.frequency.exponentialRampToValueAtTime(41, now + 0.16);
    const thumpGain = context.createGain();
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.2 * strength, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    thump.connect(thumpGain).connect(context.destination);
    thump.start(now);
    thump.stop(now + 0.26);
    thump.addEventListener('ended', release(thump, thumpGain), { once: true });

    const puff = context.createBufferSource();
    puff.buffer = noise(context);
    const band = context.createBiquadFilter();
    band.type = 'lowpass';
    band.frequency.setValueAtTime(900, now);
    band.frequency.exponentialRampToValueAtTime(220, now + 0.3);
    const puffGain = context.createGain();
    puffGain.gain.setValueAtTime(0.0001, now);
    puffGain.gain.exponentialRampToValueAtTime(0.07 * strength, now + 0.02);
    puffGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    puff.connect(band).connect(puffGain).connect(context.destination);
    puff.start(now, Math.random() * 0.8);
    puff.stop(now + 0.36);
    puff.addEventListener('ended', release(puff, band, puffGain), { once: true });
  },

  /** Souffle d'un mouvement de caméra ample : bruit filtré dont la bande monte puis retombe. */
  whoosh(duration = 1.4, strength = 1) {
    const bus = ambience.bus();
    if (!bus) return;
    const { context } = bus;
    const now = context.currentTime;
    const air = context.createBufferSource();
    air.buffer = noise(context);
    air.loop = true;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(260, now);
    band.frequency.exponentialRampToValueAtTime(1150, now + duration * 0.45);
    band.frequency.exponentialRampToValueAtTime(380, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055 * strength, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    air.connect(band).connect(gain).connect(context.destination);
    air.start(now);
    air.stop(now + duration + 0.05);
    air.addEventListener('ended', release(air, band, gain), { once: true });
  },

  /** Une île qui crève la surface : l'eau qui ruisselle (plus discret au loin). */
  rise(distance: number) {
    ambience.splash(Math.max(0.12, 0.42 - distance * 0.0025));
  },

  /** Arrivée : la cloche du port. */
  bell() {
    ambience.bell(0.5);
  },
};
