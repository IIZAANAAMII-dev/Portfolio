import { smoothstep } from '@/lib/utils/math';

/**
 * Horloge de l'aube de la cinématique d'ouverture (secondes depuis le clic, voir
 * lib/cinematic.ts). L'aube s'embrase à l'impact du bateau (0,86 s), le soleil perce
 * l'horizon pendant que la grue s'élève, le matin s'éclaircit au rythme des îles, puis
 * l'aube se retire quand la caméra plonge vers le bateau (le ciel quitte alors le cadre) :
 * le ciel de jour ordinaire a repris sa place avant la fin (7,2 s).
 */

/** Présence de l'aube (0 → 1 → 0). */
export function dawnPresence(seconds: number) {
  return smoothstep(0.8, 1.45, seconds) * (1 - smoothstep(4.7, 6.3, seconds));
}

/** Aube profonde (0, soleil sous l'horizon) → matin clair (1). */
export function dawnMorning(seconds: number) {
  return smoothstep(1.2, 4.9, seconds);
}

/**
 * Hauteur du centre du soleil au-dessus de l'horizon visible (rad) : caché à l'impact, il
 * pointe vers 1,7 s, se dégage vers 3 s puis monte franchement.
 */
export function dawnSunLift(seconds: number) {
  return -0.034 + 0.034 * smoothstep(1.2, 2.6, seconds) + 0.13 * smoothstep(2.2, 6.0, seconds);
}
