'use client';

import { Extras } from '@/components/ui/extras/Extras';
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Hud } from '@/components/ui/Hud';
import { Intro } from '@/components/ui/Intro';
import { LogbookPanel, StampToast, WelcomeHint } from '@/components/ui/Logbook';
import { Panel } from '@/components/ui/Panel';
import { QuickView } from '@/components/ui/QuickView';
import { useDeepLink } from '@/hooks/useDeepLink';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { boatState } from '@/lib/boat-state';
import { isCoarsePointer, prefersReducedMotion, supportsWebGL } from '@/lib/utils/device';
import { Scene } from './Scene';
import { IntroStage } from '@/components/world/IntroStage';

/** Une erreur dans la scène ne doit jamais laisser une page cassée : on bascule en Quick View. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Experience() {
  const quickView = useWorld((s) => s.quickView);
  const soundOn = useWorld((s) => s.soundOn);
  const failWebgl = useWorld((s) => s.failWebgl);
  // Le composant n'est monté que côté client (voir ExperienceLoader) : on peut
  // interroger l'appareil dès le premier rendu, sans passer par un effet.
  const [device] = useState(() => ({
    mobile: isCoarsePointer() || window.innerWidth < 820,
    reducedMotion: prefersReducedMotion(),
    webgl: supportsWebGL(),
  }));
  const mobile = device.mobile;

  useDeepLink();

  useEffect(() => {
    const world = useWorld.getState();
    world.setReducedMotion(device.reducedMotion);
    if (!device.webgl) world.failWebgl();
  }, [device]);

  useEffect(() => {
    void ambience.setEnabled(soundOn);
  }, [soundOn]);

  // Tests automatisés (navigation, collisions) : accès à l'état du monde, en développement
  // seulement — rien n'est exposé en production.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__world = useWorld;
    target.__boat = boatState;
  }, []);

  if (quickView) return <QuickView />;

  return (
    <>
      <Canvas
        className="fixed inset-0"
        shadows={!mobile}
        dpr={[1, 1.5]}
        gl={{
          antialias: !mobile,
          powerPreference: 'high-performance',
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{ fov: 42, near: 0.5, far: 620, position: [12, 7.5, -11.2] }}
        onCreated={({ gl }) => {
          // Un contexte perdu (onglet en arrière-plan sur mobile, pilote qui redémarre) est
          // souvent restauré par le navigateur : three.js sait reprendre. On ne bascule en
          // version rapide que si la restauration n'arrive pas.
          let lostTimer = 0;
          gl.domElement.addEventListener('webglcontextlost', () => {
            window.clearTimeout(lostTimer);
            lostTimer = window.setTimeout(failWebgl, 5000);
          });
          gl.domElement.addEventListener('webglcontextrestored', () => window.clearTimeout(lostTimer));
        }}
      >
        {/* Le seuil (carte marine + anneau de chargement) s'affiche avant la scène. */}
        <IntroStage mobile={mobile} />
        <SceneBoundary onError={failWebgl}>
          <Suspense fallback={null}>
            <Scene mobile={mobile} />
          </Suspense>
        </SceneBoundary>
      </Canvas>

      <Intro />
      <Hud />
      <Panel />
      <LogbookPanel />
      <StampToast />
      <Extras />
      <WelcomeHint />
    </>
  );
}
