/**
 * Registre de débogage (développement seulement) : chaque secret y expose son état de
 * simulation pour les captures d'écran automatisées (`window.__secrets.state`). Rien n'y
 * est écrit en production.
 */
export const secretsDebug: Record<string, unknown> = {};

export function exposeForDebug(name: string, value: unknown) {
  if (process.env.NODE_ENV === 'production') return () => undefined;
  secretsDebug[name] = value;
  return () => {
    delete secretsDebug[name];
  };
}
