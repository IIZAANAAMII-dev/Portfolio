'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { Boat } from '@/components/boat/Boat';
import { CameraRig } from '@/components/camera/CameraRig';
import { Atmosphere } from '@/components/world/Atmosphere';
import { Lighting } from '@/components/world/Lighting';
import { Ocean } from '@/components/world/Ocean';
import { HomeIsland } from '@/components/world/HomeIsland';
import { Birds } from '@/components/world/Birds';
import { WindTrails } from '@/components/world/WindTrails';
import { Celebration } from '@/components/world/Celebration';
import { DestinationMarker } from '@/components/world/DestinationMarker';
import { Flotsam } from '@/components/world/Flotsam';
import { GoldenStars } from '@/components/world/GoldenStars';
import { MessageBottle } from '@/components/world/MessageBottle';
import { ReefFish } from '@/components/world/ReefFish';
import { SeaLife } from '@/components/world/SeaLife';
import { SeaNotes } from '@/components/world/SeaNotes';
import { BoundaryStorm } from '@/components/world/BoundaryStorm';
import { NightGlow } from '@/components/world/NightGlow';
import { PostFX } from '@/components/world/PostFX';
import { substanceTexturesSettled } from '@/lib/materials/substance-material';
import { applyToonShading } from '@/lib/toon';

// Cel-shading de tous les matériaux standard, avant la compilation du premier shader.
applyToonShading();
import { useWorldReveal } from '@/hooks/useWorldReveal';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';
import { PerformanceDebug, PerformanceGovernor } from './PerformanceGovernor';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { preview } from '@/lib/preview';

// Les modèles visibles dès l'intro sont demandés en priorité ; le reste de l'archipel
// se charge pendant que le visiteur regarde la première île.
const NIGHT_CLEAR = new Color('#08121c');

// Ces deux sous-arbres contiennent la majorité des modèles et de la simulation.
// Next les place dans des chunks séparés, chargés seulement quand leurs garde-fous
// ci-dessous deviennent vrais (conforme au guide Lazy Loading de Next 16 installé).
const Archipelago = dynamic(
  () => import('@/components/world/Archipelago').then((module) => module.Archipelago),
  { ssr: false },
);
// Secrets du monde : chunk séparé, isolé par une boundary.
const Secrets = dynamic(() => import('@/components/world/secrets/Secrets'), { ssr: false });
const HarborLife = dynamic(() => import('@/components/world/harbor/HarborLife'), { ssr: false });
const MarineLife = dynamic(
  () => import('@/components/world/MarineLife').then((module) => module.MarineLife),
  { ssr: false },
);

/** Le décor lourd arrive pendant que le visiteur observe le bateau, pas avant la première frame. */
function DeferredArchipelago() {
  const phase = useWorld((state) => state.phase);
  const sceneReady = useWorld((state) => state.sceneReady);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (phase !== 'loading' && phase !== 'intro') return;
    if (!sceneReady) return;
    const activate = () => setEnabled(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(activate, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(activate, 1400);
    return () => clearTimeout(id);
  }, [phase, sceneReady]);

  const shouldRender = enabled || phase !== 'loading';
  return shouldRender ? <Archipelago /> : null;
}

/** Les OBJ aquatiques arrivent après la première image, pendant un temps mort du navigateur. */
function DeferredMarineLife({ mobile }: { mobile: boolean }) {
  const sceneReady = useWorld((state) => state.sceneReady);
  const phase = useWorld((state) => state.phase);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!sceneReady || phase === 'loading' || phase === 'intro') return;
    const activate = () => setEnabled(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(activate, { timeout: 2200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(activate, 900);
    return () => clearTimeout(id);
  }, [phase, sceneReady]);

  return enabled ? (
    <Suspense fallback={null}>
      <MarineLife mobile={mobile} />
    </Suspense>
  ) : null;
}

export function Scene({ mobile }: { mobile: boolean }) {
  const gl = useThree((state) => state.gl);
  const renderer = useRef(gl);
  const ready = useWorld((s) => s.ready);
  useWorldReveal();
  // Aperçu `?solo=` : seulement le sujet de la capture (voir lib/preview.ts).
  const full = preview.solo === null;
  const sea = preview.solo === 'sea';

  const clearColor = useRef(new Color('#08121c'));

  // La première frame rendue, textures comprises, est le vrai signal de « prêt ».
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    void substanceTexturesSettled().then(() => {
      if (!cancelled) frame = requestAnimationFrame(() => ready());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  useFrame(() => {
    const { reveal, gameTransition } = useWorld.getState();
    clearColor.current.set('#6b9fbf').lerp(NIGHT_CLEAR, skyState.dayNight);
    renderer.current.setClearColor(clearColor.current);
    const anticipation = Math.sin(smoothstep(0, 0.09, gameTransition) * Math.PI) * 0.035;
    renderer.current.toneMappingExposure =
      0.92 + smoothstep(0.08, 0.96, reveal) * 0.22 + anticipation
      - ecologyState.stormCover * 0.13
      + ecologyState.stormFlash * 0.28;
  });

  return (
    <>
      <CameraRig mobile={mobile} />
      <PerformanceGovernor mobile={mobile} />
      {process.env.NODE_ENV !== 'production' && <PerformanceDebug />}
      <Atmosphere />
      <Lighting shadows={!mobile} />
      <NightGlow />
      <Ocean />
      <BoundaryStorm />
      {(full || sea) && <HomeIsland />}
      <DeferredArchipelago />
      <Boat />
      {full && <DeferredMarineLife mobile={mobile} />}
      {(full || sea) && <Birds />}
      {full && (
        <>
          <WindTrails />
          <Flotsam />
          <DestinationMarker />
          <MessageBottle />
          <SeaLife />
          <ReefFish />
          <GoldenStars />
          <SeaNotes />
          <Celebration />
          <AssetBoundary>
            <Secrets />
          </AssetBoundary>
          <AssetBoundary>
            <HarborLife />
          </AssetBoundary>
        </>
      )}
      <PostFX />
    </>
  );
}
