'use client';

import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';

/**
 * Post-traitement de l'image finale (qualité haute seulement).
 *
 * Un contexte WebGL perdu (onglet en arrière-plan, pilote qui redémarre) ne doit jamais
 * emporter la scène : la chaîne d'effets est retirée tant que le contexte est perdu, puis
 * remontée à sa restauration ; une erreur éventuelle ne coûte que les effets.
 */
export function PostFX() {
  const quality = useWorld((s) => s.quality);
  const gl = useThree((s) => s.gl);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = () => setLost(true);
    const onRestored = () => setLost(false);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);

  if (lost || !QUALITY_LEVELS[quality].bloom) return null;
  return (
    <AssetBoundary>
      {/* MSAA dans la chaîne d'effets (sinon les arêtes crénèlent) et léger vignettage cinéma. */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.35} intensity={0.38} />
        <Vignette eskil={false} offset={0.3} darkness={0.38} />
      </EffectComposer>
    </AssetBoundary>
  );
}
