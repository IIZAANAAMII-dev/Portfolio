import { clamp, damp, smoothstep } from './utils/math';

/**
 * Source unique de vérité du cycle jour/nuit.
 *
 * `timeOfDay` (dans le store) est LA donnée maîtresse : 0 = minuit, 0.25 = lever,
 * 0.5 = midi, 0.75 = coucher. Tout le reste (bouton UI, couleurs, lumières, océan)
 * en dérive via les fonctions ci-dessous — plus aucun état parallèle contradictoire.
 */

export function sunAngle(timeOfDay: number) {
  return (timeOfDay - 0.25) * Math.PI * 2;
}

export function sunElevation(timeOfDay: number) {
  return Math.sin(sunAngle(timeOfDay));
}

/** Cible du facteur nuit : 0 = plein jour, 1 = nuit complète. */
export function nightTarget(timeOfDay: number) {
  return 1 - smoothstep(-0.2, 0.15, sunElevation(timeOfDay));
}

/** Vrai si le monde est perçu comme « nuit » — utilisé par le bouton Jour/Nuit. */
export function isNightTime(timeOfDay: number) {
  return nightTarget(timeOfDay) > 0.5;
}

/** Facteur « heure dorée » : 1 quand le soleil rase l'horizon, 0 sinon. */
export function goldenHour(timeOfDay: number) {
  const elevation = sunElevation(timeOfDay);
  return smoothstep(-0.18, 0.02, elevation) * (1 - smoothstep(0.05, 0.4, elevation));
}

/**
 * État visuel du ciel, partagé hors React et mis à jour UNE fois par frame
 * (par Lighting, priorité -10). Les autres systèmes (océan, atmosphère, bateau,
 * lumières d'îles) le lisent au lieu de recalculer / re-damper chacun leur copie :
 * une seule valeur, zéro dérive entre les systèmes.
 */
export const skyState = {
  /** Facteur nuit amorti (0 → 1). */
  dayNight: 0,
  /** Facteur heure dorée amorti (0 → 1). */
  golden: 0,
  sunAngle: 0,
  sunElevation: 1,
};

export function updateSky(timeOfDay: number, dt: number) {
  skyState.sunAngle = sunAngle(timeOfDay);
  skyState.sunElevation = sunElevation(timeOfDay);
  skyState.dayNight = clamp(damp(skyState.dayNight, nightTarget(timeOfDay), 2.0, dt), 0, 1);
  skyState.golden = clamp(damp(skyState.golden, goldenHour(timeOfDay), 2.4, dt), 0, 1);
}
