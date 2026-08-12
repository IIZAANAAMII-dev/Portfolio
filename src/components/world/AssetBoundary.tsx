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
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ModelErrorBoundary>
  );
}
