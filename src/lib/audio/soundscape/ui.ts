import { brownNoise, filterNode, gainNode, noiseShot, oscillator, release, strike, whiteNoise } from './voices';

/**
 * Sons d'interface du carnet de bord : page qui se tourne (panneau ouvert / refermé),
 * coup de tampon (tampon gagné), petit clic de bouton. Branchés directement sur le bus
 * principal : ils restent audibles même quand le paysage se tait (île secrète, intro).
 */

export interface Bus {
  context: BaseAudioContext;
  destination: AudioNode;
}

/**
 * Feuille de papier qu'on tourne : un froissement (bruit dans une bande qui balaie, haché
 * de petites saccades), puis la page qui retombe (souffle grave). Plus court à la fermeture.
 */
export function pageTurn(bus: Bus, open: boolean) {
  const { context, destination } = bus;
  const nodes: AudioNode[] = [];
  const when = context.currentTime + 0.01;
  const length = open ? 0.36 : 0.28;
  const rustle = noiseShot(context, whiteNoise(context), when, length + 0.1, nodes);
  const air = filterNode(context, 'highpass', 520, 0.7);
  const sweep = filterNode(context, 'bandpass', 1800, 0.8);
  const gain = gainNode(context, 0);
  nodes.push(air, sweep, gain);
  rustle.connect(air).connect(sweep).connect(gain).connect(destination);
  if (open) {
    sweep.frequency.setValueAtTime(1500, when);
    sweep.frequency.exponentialRampToValueAtTime(4300, when + length * 0.5);
    sweep.frequency.exponentialRampToValueAtTime(2500, when + length);
  } else {
    sweep.frequency.setValueAtTime(3600, when);
    sweep.frequency.exponentialRampToValueAtTime(1700, when + length);
  }
  // Saccades : la feuille accroche et glisse (enveloppe en cloche sur toute la durée).
  const flicks = open ? 9 : 7;
  for (let flick = 0; flick < flicks; flick++) {
    const u = flick / (flicks - 1);
    const at = when + u * length * 0.9 + Math.random() * 0.012;
    strike(gain.gain, at, 0.05 * Math.sin(Math.PI * (0.15 + u * 0.8)) * (0.6 + Math.random() * 0.4), 0.014, 0.003);
  }
  // La page se pose.
  const flap = noiseShot(context, brownNoise(context), when + length * 0.85, 0.3, nodes);
  const low = filterNode(context, 'lowpass', 520, 0.7);
  const flapGain = gainNode(context, 0);
  nodes.push(low, flapGain);
  flap.connect(low).connect(flapGain).connect(destination);
  strike(flapGain.gain, when + length * 0.85, open ? 0.07 : 0.05, 0.045, 0.008);
  release(flap, nodes);
}

/**
 * Coup de tampon encreur sur le papier, posé sur un bureau de bois : choc grave, « pat »
 * du caoutchouc, résonance courte du bois, puis le tampon qu'on relève.
 */
export function stampThump(bus: Bus, delay = 0) {
  const { context, destination } = bus;
  const nodes: AudioNode[] = [];
  const when = context.currentTime + 0.01 + delay;
  const thump = oscillator(context, 'sine', 120);
  const thumpGain = gainNode(context, 0);
  nodes.push(thump, thumpGain);
  thump.connect(thumpGain).connect(destination);
  thump.frequency.setValueAtTime(125, when);
  thump.frequency.exponentialRampToValueAtTime(52, when + 0.12);
  strike(thumpGain.gain, when, 0.16, 0.045, 0.002);
  const desk = oscillator(context, 'sine', 210);
  const deskGain = gainNode(context, 0);
  nodes.push(desk, deskGain);
  desk.connect(deskGain).connect(destination);
  desk.frequency.setValueAtTime(215, when);
  desk.frequency.exponentialRampToValueAtTime(182, when + 0.15);
  strike(deskGain.gain, when, 0.03, 0.06, 0.002);
  const pat = noiseShot(context, whiteNoise(context), when, 0.35, nodes);
  const band = filterNode(context, 'bandpass', 1100, 0.9);
  const patGain = gainNode(context, 0);
  nodes.push(band, patGain);
  pat.connect(band).connect(patGain).connect(destination);
  strike(patGain.gain, when, 0.07, 0.018, 0.001);
  // Le tampon se relève (encre qui colle à peine).
  band.frequency.setValueAtTime(2400, when + 0.16);
  strike(patGain.gain, when + 0.17, 0.012, 0.015, 0.002);
  for (const node of [thump, desk]) {
    node.start(when);
    node.stop(when + 0.35);
  }
  release(pat, nodes);
}

/** Clic de bouton, à peine là : un tic aigu très bref et une pointe de sinus. */
export function softClick(bus: Bus) {
  const { context, destination } = bus;
  const nodes: AudioNode[] = [];
  const when = context.currentTime + 0.005;
  const tick = noiseShot(context, whiteNoise(context), when, 0.08, nodes);
  const band = filterNode(context, 'bandpass', 3600, 2.2);
  const gain = gainNode(context, 0);
  nodes.push(band, gain);
  tick.connect(band).connect(gain).connect(destination);
  strike(gain.gain, when, 0.03, 0.006, 0.0005);
  const tone = oscillator(context, 'sine', 2100);
  const toneGain = gainNode(context, 0);
  nodes.push(tone, toneGain);
  tone.connect(toneGain).connect(destination);
  strike(toneGain.gain, when, 0.008, 0.012, 0.0008);
  tone.start(when);
  tone.stop(when + 0.08);
  release(tick, nodes);
}
