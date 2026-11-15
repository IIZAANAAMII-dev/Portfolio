'use client';

import { lazy, Suspense } from 'react';
import { BretonBoat } from './breton/BretonBoat';
import { ANCHORS } from './breton/parts';
import { BOAT_VARIANT } from './variant';

/** L'ancien modèle Substance n'est téléchargé que pour `?boat=old` (comparaisons A/B). */
const LegacyBoat = lazy(() => import('./LegacyBoat'));

/** Échelle de l'ancien modèle Substance (8,9 m dans son fichier → 6,7 m dans le monde). */
const LEGACY_SCALE = 0.76;
const LEGACY_WATERLINE = 0.66;

/**
 * Repères du bateau dans le repère de navigation (+X = avant, Y = surface de l'eau, +Z =
 * tribord). Encombrements identiques pour les deux bateaux : sillage, écume, collisions avec
 * les objets flottants et caméra restent réglés pareil.
 */
export const BOAT_FRAME = {
  bow: 4.3 * LEGACY_SCALE,
  stern: 4.4 * LEGACY_SCALE,
  halfBeam: 1.25 * LEGACY_SCALE,
  /** Sortie de la cheminée (fumée). */
  exhaust: (BOAT_VARIANT === 'legacy'
    ? [0.35 * LEGACY_SCALE, (4.25 - LEGACY_WATERLINE) * LEGACY_SCALE, 0.7 * LEGACY_SCALE]
    : ANCHORS.stackTip) as readonly [number, number, number],
  /** Projecteur de pont (lumière ponctuelle allumée la nuit). */
  lamp: (BOAT_VARIANT === 'legacy' ? [0, 2.2, 0] : [-0.45, 1.95, 0]) as readonly [number, number, number],
};

export function BoatModel() {
  if (BOAT_VARIANT === 'legacy') {
    return (
      <Suspense fallback={null}>
        <LegacyBoat />
      </Suspense>
    );
  }
  return <BretonBoat />;
}
