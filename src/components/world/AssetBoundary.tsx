'use client';

import { Component, Suspense, type ReactNode } from 'react';

/**
 * Un modèle manquant ou corrompu ne doit jamais casser la scène : le sous-arbre retombe
 * sur sa version procédurale. Le Suspense couvre le chargement, la boundary couvre
 * l'échec (voir docs/ASSETS.md).
 */
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[assets] modèle indisponible, retour au placeholder :', error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function AssetBoundary({
  children,
  fallback = null,
  loading,
  blocking = false,
}: {
  children: ReactNode;
  /** Rendu si le modèle échoue (et pendant le chargement, sauf `loading`). */
  fallback?: ReactNode;
  /** Rendu pendant le chargement, si différent du repli d'erreur. */
  loading?: ReactNode;
  /**
   * Le chargement remonte au Suspense parent au lieu d'afficher un repli : la première
   * image attend le modèle (le bateau, sujet de l'intro). Seule l'erreur est interceptée.
   */
  blocking?: boolean;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      {blocking ? children : <Suspense fallback={loading === undefined ? fallback : loading}>{children}</Suspense>}
    </ModelErrorBoundary>
  );
}
