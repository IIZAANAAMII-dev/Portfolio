'use client';

import dynamic from 'next/dynamic';
import { AssetBoundary } from '@/components/world/AssetBoundary';

/**
 * Interfaces DOM des surprises (dossier secret, radio marine). Chargées à part et
 * isolées : une erreur dans l'une ne casse ni le HUD ni les panneaux.
 */
const StaticDossier = dynamic(() => import('@/components/secret/StaticDossier'), { ssr: false });
const MarineRadio = dynamic(() => import('./MarineRadio'), { ssr: false });

export function Extras() {
  return (
    <>
      <AssetBoundary>
        <MarineRadio />
      </AssetBoundary>
      <AssetBoundary>
        <StaticDossier />
      </AssetBoundary>
    </>
  );
}
