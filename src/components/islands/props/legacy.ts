/**
 * Interrupteur de comparaison (développement seulement) : `?props=old` remet les anciens
 * accessoires Bell Island (modèles sous licence, absents du site déployé) pour les
 * captures avant / après. Sans effet en production.
 */
export const legacyProps =
  process.env.NODE_ENV !== 'production'
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('props') === 'old';
