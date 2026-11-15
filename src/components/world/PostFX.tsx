'use client';

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';

/** Post-traitement de l'image finale (qualité haute seulement). */
export function PostFX() {
  const quality = useWorld((s) => s.quality);
  if (!QUALITY_LEVELS[quality].bloom) return null;
  return (
    // MSAA dans la chaîne d'effets (sinon les arêtes crénèlent) et léger vignettage cinéma.
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.35} intensity={0.38} />
      <Vignette eskil={false} offset={0.3} darkness={0.38} />
    </EffectComposer>
  );
}
