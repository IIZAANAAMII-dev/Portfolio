import { ambience } from '@/lib/audio/ambience';

/**
 * Petits bruitages des secrets, synthétisés sur le bus de l'ambiance (rien n'est chargé).
 * Muets tant que le visiteur n'a pas activé le son : `ambience.bus()` vaut alors null.
 */

function voice(
  context: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  start: number,
  length: number,
  peak: number,
  frequencies: [number, number][],
  band?: { frequency: number; q: number },
) {
  const tone = context.createOscillator();
  tone.type = type;
  tone.frequency.setValueAtTime(frequencies[0][1], start);
  for (const [at, frequency] of frequencies.slice(1)) tone.frequency.exponentialRampToValueAtTime(frequency, start + at);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.03, length * 0.2));
  gain.gain.setValueAtTime(peak, start + length * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  let chain: AudioNode = tone;
  let filter: BiquadFilterNode | null = null;
  if (band) {
    filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = band.frequency;
    filter.Q.value = band.q;
    chain = tone.connect(filter);
  }
  chain.connect(gain).connect(destination);
  tone.start(start);
  tone.stop(start + length + 0.05);
  tone.addEventListener('ended', () => {
    tone.disconnect();
    filter?.disconnect();
    gain.disconnect();
  }, { once: true });
}

/** Cris de goélands qui s'envolent : deux « kiou » glissés. */
export function gullCries() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime + 0.02;
  [0, 0.32, 0.9].forEach((offset, index) => {
    const pitch = 1 + index * 0.06;
    voice(context, destination, 'sawtooth', now + offset, 0.3, 0.035, [
      [0, 1500 * pitch],
      [0.07, 2150 * pitch],
      [0.3, 1150 * pitch],
    ], { frequency: 1900, q: 3 });
  });
}

/** Grincement du bois du vieux chalutier. */
export function woodCreak() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime + 0.02;
  voice(context, destination, 'sawtooth', now, 0.75, 0.05, [
    [0, 92],
    [0.25, 138],
    [0.5, 104],
    [0.75, 126],
  ], { frequency: 620, q: 6 });
}

/** Klaxon de plongée « a-hou-ga » du mini sous-marin. */
export function diveKlaxon() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime + 0.02;
  for (const repeat of [0, 0.62]) {
    voice(context, destination, 'square', now + repeat, 0.5, 0.03, [
      [0, 210],
      [0.18, 420],
      [0.5, 330],
    ], { frequency: 900, q: 1.2 });
  }
}

/** « Bloup » : petites bulles qui remontent (sinusoïdes qui montent vite). */
export function bloops(count = 4) {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime + 0.02;
  for (let index = 0; index < count; index++) {
    const base = 320 + index * 90 + (index % 2) * 60;
    voice(context, destination, 'sine', now + index * 0.11, 0.12, 0.05, [
      [0, base],
      [0.12, base * 2.4],
    ]);
  }
}

/** Ressort qui se détend (le poisson remonté saute) : glissando montant. */
export function springBoing() {
  const bus = ambience.bus();
  if (!bus) return;
  const { context, destination } = bus;
  const now = context.currentTime + 0.02;
  voice(context, destination, 'triangle', now, 0.45, 0.05, [
    [0, 180],
    [0.2, 620],
    [0.45, 380],
  ]);
}
