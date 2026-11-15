import { Color } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { smoothstep } from '@/lib/utils/math';
import { skyUniforms } from './sky-shader';

/**
 * Palette du ciel au fil de la journée : une seule fonction, appelée une fois par image par
 * l'atmosphère, calcule les couleurs du dôme, des nuages, du soleil, de la lune et du
 * brouillard à partir de lib/sky.ts (jour/nuit, heure dorée, hauteur du soleil).
 *
 * Quatre tons par ciel : horizon, bas, haut, zénith (codes sRGB, convertis en linéaire).
 */
type Stops = { horizon: Color; low: Color; high: Color; zenith: Color };
const stops = (horizon: string, low: string, high: string, zenith: string): Stops => ({
  horizon: new Color(horizon),
  low: new Color(low),
  high: new Color(high),
  zenith: new Color(zenith),
});

const INTRO = stops('#04070a', '#04070a', '#04070a', '#04070a');
// Lever de rideau de l'intro (inchangé) : le monde sort de la nuit par un ciel d'aube.
const REVEAL = stops('#ffb57a', '#b55a3f', '#143c5e', '#143c5e');
const DAY = stops('#b2dbea', '#76bedb', '#4a93c3', '#2b6c99');
const GOLDEN = stops('#ffb36b', '#f2956f', '#a983ab', '#3c4a7c');
const DAWN = stops('#ffc4a2', '#f3a2b0', '#a993c8', '#44568c');
const TWILIGHT = stops('#6b5d92', '#43528a', '#263866', '#101d3c');
const NIGHT = stops('#1d3247', '#12283e', '#0b192e', '#060d1c');
const STORM = stops('#5c6c72', '#43545e', '#172530', '#122029');

const SUN_DISK_DAY = new Color('#fffaf0');
const SUN_DISK_GOLDEN = new Color('#fff0c8');
const SUN_GLOW_DAY = new Color('#fff1d6');
const SUN_GLOW_GOLDEN = new Color('#ffbf6e');
const SUN_GLOW_DAWN = new Color('#ffc4a0');
const AFTERGLOW = new Color('#ff9560');
const BELT_GOLDEN = new Color('#e7a2c0');
const BELT_TWILIGHT = new Color('#57487e');

const CLOUD_LIT_DAY = new Color('#ffffff');
const CLOUD_SHADE_DAY = new Color('#b9c2e2');
const CLOUD_RIM_DAY = new Color('#fffaf0');
const CLOUD_LIT_GOLDEN = new Color('#ffcf9f');
const CLOUD_SHADE_GOLDEN = new Color('#9a86c0');
const CLOUD_RIM_GOLDEN = new Color('#fff0c0');
const CLOUD_LIT_TWILIGHT = new Color('#e8908c');
const CLOUD_SHADE_TWILIGHT = new Color('#3e3e6c');
const CLOUD_RIM_TWILIGHT = new Color('#ffb27a');
const CLOUD_LIT_NIGHT = new Color('#56688f');
const CLOUD_SHADE_NIGHT = new Color('#212a47');
const CLOUD_RIM_NIGHT = new Color('#a8bce8');
const CLOUD_STORM = new Color('#4a5860');

const STORM_FOG = new Color('#273940');
const INTRO_FOG = new Color('#020408');

/** Brouillard et couleurs dérivées, lus par l'atmosphère (et la lumière). */
export const atmosphere = {
  fogColor: new Color('#04070a'),
  fogNear: 11,
  fogFar: 24,
  /** Horizon courant : teinte de la brume lointaine. */
  horizon: new Color('#04070a'),
  /** Crépuscule (soleil juste sous l'horizon) : 0 → 1. */
  twilight: 0,
};

const scratch = new Color();

function blend(target: Stops, from: Stops, amount: number, weights = [1, 1, 1, 1]) {
  if (amount <= 0) return;
  target.horizon.lerp(from.horizon, Math.min(amount * weights[0], 1));
  target.low.lerp(from.low, Math.min(amount * weights[1], 1));
  target.high.lerp(from.high, Math.min(amount * weights[2], 1));
  target.zenith.lerp(from.zenith, Math.min(amount * weights[3], 1));
}

const current = stops('#04070a', '#04070a', '#04070a', '#04070a');
const goldenMix = stops('#000000', '#000000', '#000000', '#000000');

/**
 * Met à jour uniformes du ciel et brouillard. `time` : horloge (s) ; `reveal` : révélation
 * de l'intro (0 → 1).
 */
export function updateSkyPalette(time: number, reveal: number) {
  const { dayNight, golden, sunAngle, sunElevation } = skyState;
  const storm = ecologyState.stormCover;
  const lift = smoothstep(0.0, 0.55, reveal);
  const dayLight = smoothstep(0.25, 1.0, reveal);

  // Crépuscule : le soleil vient de passer sous l'horizon (ou va se lever).
  const twilight = (1 - smoothstep(-0.06, 0.04, sunElevation)) * (1 - smoothstep(-0.34, -0.5, sunElevation));
  const afterglow = twilight * (1 - smoothstep(-0.05, -0.38, sunElevation));
  // Le matin, l'heure dorée tire vers le rose ; le soir, vers l'orangé.
  const dawn = smoothstep(-0.2, 0.2, Math.cos(sunAngle));
  atmosphere.twilight = twilight;

  // Dégradé : intro → jour → heure dorée → nuit → crépuscule → orage.
  for (const key of ['horizon', 'low', 'high', 'zenith'] as const) {
    current[key].copy(INTRO[key]).lerp(REVEAL[key], lift).lerp(DAY[key], dayLight);
    goldenMix[key].copy(GOLDEN[key]).lerp(DAWN[key], dawn);
  }
  blend(current, goldenMix, golden, [0.92, 0.8, 0.6, 0.38]);
  blend(current, NIGHT, dayNight);
  blend(current, TWILIGHT, twilight * dayNight, [0.85, 0.9, 0.8, 0.55]);
  blend(current, STORM, storm, [0.7, 0.78, 0.88, 0.88]);

  const u = skyUniforms;
  u.uHorizon.value.copy(current.horizon);
  u.uLow.value.copy(current.low);
  u.uHigh.value.copy(current.high);
  u.uZenith.value.copy(current.zenith);
  atmosphere.horizon.copy(current.horizon);

  // Soleil : vraie position (il se couche sous l'horizon) ; la lune prend la place que la
  // lumière et l'océan donnent à l'astre de nuit (même direction : le reflet lui répond).
  const sunX = Math.cos(sunAngle) * 80;
  u.uSunDir.value.set(sunX, sunElevation * 70, 40).normalize();
  u.uMoonDir.value.set(sunX, Math.max(sunElevation * 70, 10), 40).normalize();
  u.uLightDir.value.copy(u.uSunDir.value).lerp(u.uMoonDir.value, dayNight).normalize();
  u.uSunVisible.value = smoothstep(-0.1, 0.03, sunElevation) * (1 - storm * 0.95) * dayLight;
  u.uMoonVisible.value = smoothstep(0.55, 0.92, dayNight) * (1 - storm * 0.92) * dayLight;
  u.uSunDisk.value.copy(SUN_DISK_DAY).lerp(SUN_DISK_GOLDEN, golden);
  scratch.copy(SUN_GLOW_GOLDEN).lerp(SUN_GLOW_DAWN, dawn);
  u.uSunGlow.value.copy(SUN_GLOW_DAY).lerp(scratch, golden);
  u.uHorizonGlow.value = golden * 0.72 * (1 - storm);
  u.uBelt.value.copy(BELT_GOLDEN).lerp(BELT_TWILIGHT, dayNight);
  u.uBeltAmount.value = Math.max(golden * 0.5, twilight * dayNight * 0.45) * (1 - storm);
  u.uAfterglow.value.copy(AFTERGLOW);
  u.uAfterglowAmount.value = afterglow * 0.85 * (1 - storm);

  // Nuages : blancs lavande le jour, pêche et violet au couchant, roses au crépuscule,
  // bleutés sous la lune.
  u.uCloudLit.value.copy(CLOUD_LIT_DAY).lerp(CLOUD_LIT_GOLDEN, golden).lerp(CLOUD_LIT_NIGHT, dayNight);
  u.uCloudShade.value.copy(CLOUD_SHADE_DAY).lerp(CLOUD_SHADE_GOLDEN, golden).lerp(CLOUD_SHADE_NIGHT, dayNight);
  u.uCloudRim.value.copy(CLOUD_RIM_DAY).lerp(CLOUD_RIM_GOLDEN, golden).lerp(CLOUD_RIM_NIGHT, dayNight);
  const dusk = twilight * dayNight * 0.85;
  u.uCloudLit.value.lerp(CLOUD_LIT_TWILIGHT, dusk);
  u.uCloudShade.value.lerp(CLOUD_SHADE_TWILIGHT, dusk);
  u.uCloudRim.value.lerp(CLOUD_RIM_TWILIGHT, dusk);
  u.uCloudLit.value.lerp(CLOUD_STORM, storm);
  u.uCloudShade.value.lerp(CLOUD_STORM, storm * 0.8);
  u.uCloudAmount.value = smoothstep(0.3, 0.9, reveal) * (1 - storm * 0.85);

  u.uTime.value = time;
  u.uStorm.value = storm;
  // Étoiles : à la nuit tombée (pas en plein coucher), et dans le noir de l'intro.
  u.uNight.value = Math.max(smoothstep(0.45, 0.95, dayNight), 1 - smoothstep(0, 0.35, reveal));
  // Luminosité du dôme : celle que l'on connaît (0,9), à peine relevée après l'intro.
  u.uBrightness.value = 0.9 + 0.04 * reveal * (1 - dayNight);

  // Brouillard : le lointain se fond dans la brume de l'horizon (perspective aérienne),
  // le proche garde ses couleurs.
  const fog = atmosphere.fogColor;
  fog.copy(INTRO_FOG).lerp(current.low, smoothstep(0, 0.35, reveal));
  fog.lerp(current.zenith, dayLight * 0.35);
  fog.lerp(STORM_FOG, storm * 0.78);
  atmosphere.fogNear = 11 + lift * 39 - storm * 18;
  atmosphere.fogFar = 24
    + smoothstep(0.04, 0.96, reveal) * 358
    + (1 - smoothstep(0.0, 0.25, reveal)) * 60
    - storm * 168;
}
