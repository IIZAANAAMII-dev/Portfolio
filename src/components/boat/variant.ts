/**
 * Bateau affiché : le bateau breton procédural (par défaut, déployable), ou l'ancien modèle
 * Substance (`?boat=old`, fichiers locaux sous licence non déployés) pour les comparaisons A/B.
 * Lu une seule fois au chargement.
 */
export type BoatVariant = 'breton' | 'legacy';

export const BOAT_VARIANT: BoatVariant =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('boat') === 'old'
    ? 'legacy'
    : 'breton';
