'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import type { BloomEffect, VignetteEffect } from 'postprocessing';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { ContactShadeEffect, updateContactCamera } from './render/ContactShadeEffect';
import { GradeEffect } from './render/GradeEffect';
import { postLook, updatePostLook } from './render/post-look';

/** Post-traitement de l'image finale (qualité haute seulement). */
export function PostFX() {
  const quality = useWorld((s) => s.quality);
  if (!QUALITY_LEVELS[quality].bloom) return null;
  return <Effects />;
}

/**
 * Chaîne d'effets, fusionnée par postprocessing en une seule passe plein écran :
 * ombrage de contact (profondeur) → bloom → étalonnage → vignettage.
 */
function Effects() {
  const bloom = useRef<BloomEffect>(null);
  const vignette = useRef<VignetteEffect>(null);
  const contact = useMemo(() => new ContactShadeEffect(), []);
  const grade = useMemo(() => new GradeEffect(), []);
  useEffect(() => () => {
    contact.dispose();
    grade.dispose();
  }, [contact, grade]);

  useFrame((state) => {
    updatePostLook();
    updateContactCamera(state.camera);
    if (bloom.current) {
      bloom.current.intensity = postLook.bloomIntensity;
      bloom.current.luminanceMaterial.threshold = postLook.bloomThreshold;
    }
    if (vignette.current) vignette.current.darkness = postLook.vignette;
  });

  return (
    // MSAA dans la chaîne d'effets (sinon les arêtes crénèlent) et léger vignettage cinéma.
    <EffectComposer multisampling={4}>
      <primitive object={contact} />
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.35} intensity={0.38} />
      <primitive object={grade} />
      <Vignette ref={vignette} eskil={false} offset={0.3} darkness={0.38} />
    </EffectComposer>
  );
}
