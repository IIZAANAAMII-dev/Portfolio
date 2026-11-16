/**
 * Typographie française à l'affichage.
 *
 * Les textes (data/*.ts, interface) s'écrivent avec des espaces ordinaires, faciles à relire
 * et à modifier ; `fr()` pose les bonnes espaces au moment du rendu :
 *  - espace fine insécable (U+202F) avant « ; ! ? » ;
 *  - espace insécable (U+00A0) avant les deux-points et à l'intérieur des guillemets « » ;
 *  - insécables aussi entre un nombre et ce qu'il compte (« 6 escales », « 2 min »), avant un
 *    séparateur « · », « — » ou « – », et après un mot d'une lettre (« à », « y »…).
 * Aucune ligne ne commence donc par « ? », « : », « · » ou « min », ni ne finit par « à ».
 */

/** Espace fine insécable : avant ; ! ? */
export const NNBSP = ' ';
/** Espace insécable : avant les deux-points, dans les guillemets. */
export const NBSP = ' ';

const SPACES = '[   ]';

export function fr(text: string) {
  return text
    .replace(new RegExp(`${SPACES}+([;!?])`, 'g'), `${NNBSP}$1`)
    .replace(new RegExp(`${SPACES}+:(?=\\s|$)`, 'g'), `${NBSP}:`)
    .replace(new RegExp(`«${SPACES}*`, 'g'), `«${NBSP}`)
    .replace(new RegExp(`${SPACES}*»`, 'g'), `${NBSP}»`)
    .replace(/(\d) (?=[A-Za-zÀ-ÿ%€])/g, `$1${NBSP}`)
    .replace(/ ([·—–]) /g, `${NBSP}$1 `)
    .replace(/(^|[\s(«])([aàÀyY]) /g, `$1$2${NBSP}`);
}

/**
 * Accord en nombre à la française : zéro et un restent au singulier (« 0 tampon »,
 * « 1,5 mille »), le pluriel commence à deux.
 */
export function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return Math.abs(value) < 2 ? singular : pluralForm;
}
