/**
 * Paramètres d'aperçu (captures, réglages visuels), lus une seule fois au chargement :
 *  - `?solo=<île>` ne monte que cette île (about, skills, projects, experience, journey,
 *    contact), `?solo=static` l'île secrète, `?solo=sea` la mer seule (bateau, oiseaux) ;
 *    la faune et les objets flottants sont retirés pour des captures rapides et nettes.
 *  - `?time=0.78` fige l'heure du cycle (0 minuit, 0.25 lever, 0.5 midi, 0.75 coucher).
 * Combinables avec `?section=<île>` (accoster directement) et `?cam=x,y,z,tx,ty,tz`.
 */
function read() {
  if (typeof window === 'undefined') return { solo: null as string | null, time: null as number | null };
  const params = new URLSearchParams(window.location.search);
  const solo = params.get('solo');
  const raw = params.get('time');
  const time = raw !== null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) - Math.floor(Number(raw)) : null;
  return { solo, time };
}

export const preview = read();

/** Vrai si ce sous-système doit être monté dans l'aperçu courant. */
export function inPreview(part: string) {
  return preview.solo === null || preview.solo === part;
}
