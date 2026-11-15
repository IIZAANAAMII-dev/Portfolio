/**
 * Démonstration (développement uniquement) de la séquence de la mer interdite :
 *  - `?demo=kraken` place le bateau au bord du monde et joue la séquence en boucle ;
 *  - `?demo=kraken&pose=wrap` fige un moment (tips, shadow, ring, eye, wrap, lift, toss, ink)
 *    pour les captures — à combiner avec `time=`, `quality=`, `cam=` ;
 *  - `window.__kraken()` / `window.__kraken('eye')` la relance depuis la console.
 * Tout ce module disparaît du build de production (NODE_ENV remplacé statiquement).
 */
export const KRAKEN_POSES = ['tips', 'shadow', 'ring', 'eye', 'wrap', 'lift', 'toss', 'ink'] as const;
export type KrakenPose = (typeof KRAKEN_POSES)[number];

export const krakenDemo = {
  enabled: false,
  pose: null as KrakenPose | null,
  /** Incrémenté à chaque demande : la séquence repart du début. */
  request: 0,
};

declare global {
  interface Window {
    __kraken?: (pose?: string) => void;
  }
}

function asPose(value: string | null | undefined): KrakenPose | null {
  return value && (KRAKEN_POSES as readonly string[]).includes(value) ? (value as KrakenPose) : null;
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === 'kraken') {
    krakenDemo.enabled = true;
    krakenDemo.pose = asPose(params.get('pose'));
    krakenDemo.request = 1;
  }
  window.__kraken = (pose?: string) => {
    krakenDemo.enabled = true;
    krakenDemo.pose = asPose(pose);
    krakenDemo.request += 1;
  };
}
