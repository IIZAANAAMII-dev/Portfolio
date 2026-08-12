'use client';

import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Hud } from '@/components/ui/Hud';
import { Intro } from '@/components/ui/Intro';
import { Loader } from '@/components/ui/Loader';
import { Panel } from '@/components/ui/Panel';
import { QuickView } from '@/components/ui/QuickView';
import { useDeepLink } from '@/hooks/useDeepLink';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { isCoarsePointer, prefersReducedMotion, supportsWebGL } from '@/lib/utils/device';
import { Scene } from './Scene';

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
  const sceneReady = useWorld((s) => s.sceneReady);
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

  if (quickView) return <QuickView />;

  return (
    <>
      <Canvas
        className="fixed inset-0"
        shadows={!mobile}
        dpr={[1, mobile ? 1.5 : 2]}
        gl={{
          antialias: !mobile,
          powerPreference: 'high-performance',
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{ fov: 42, near: 0.5, far: 620, position: [12, 7.5, -11.2] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', failWebgl);
        }}
      >
        <SceneBoundary onError={failWebgl}>
          <Suspense fallback={null}>
            <Scene mobile={mobile} />
          </Suspense>
        </SceneBoundary>
      </Canvas>

      <Loader done={sceneReady} />
      <Intro />
      <Hud />
      <Panel />
    </>
  );
}
