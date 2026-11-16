'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Frustum, Matrix4, Sphere } from 'three';
import { useLogbook } from '@/lib/logbook';
import {
  automatedBrowser,
  deviceProfile,
  forcedTier,
  graphicsMemory,
  tierDpr,
  tierDprFloor,
  perfOff,
  TIER_LEVELS,
  useGraphicsStatus,
  useRenderDpr,
} from '@/lib/quality';
import { useSheetCover } from '@/lib/sheet';
import { useWorld } from '@/lib/store';
import { createPolicyState, decide, onTierChanged } from './governor-policy';

/*
 * Régulateur graphique : il observe les temps d'image réellement présentés (et non une
 * moyenne de FPS), par fenêtres de 2,5 s, résumées par leur médiane et leur 90e centile ; la
 * décision elle-même est une fonction pure (governor-policy.ts : résolution avant palier,
 * montée lente, essais bloqués s'ils échouent, chauffe, choix manuel respecté).
 *  - Rien n'est jugé pendant l'ouverture (compilations), monde masqué, onglet caché, ni
 *    juste après un changement. `?quality=` : rien ne bouge.
 * Le rendu lui-même : onglet caché = aucune image ; palier « Très léger » = 30 images/s
 * régulières (les animations gardent leur horloge, seules les images sautent).
 */

const WINDOW_MS = 2500;
const SETTLE_MS = 2500;
const MAX_SAMPLES = 512;

/** Partagé avec l'enveloppe de `gl.render` (cadence, temps d'image présentés, ombres). */
const pacing = {
  cap: 0,
  lastFrameAt: 0,
  samples: new Float32Array(MAX_SAMPLES),
  count: 0,
  /** Palier « Équilibré » : carte d'ombre redessinée une image sur deux. */
  halfShadows: false,
  shadowFlip: false,
};

function setRenderDpr(value: number) {
  const dpr = Math.round(value * 100) / 100;
  if (Math.abs(useRenderDpr.getState().dpr - dpr) > 0.001) useRenderDpr.setState({ dpr });
}

function percentile(sorted: Float32Array, count: number, p: number) {
  const index = Math.min(count - 1, Math.max(0, Math.round((count - 1) * p)));
  return sorted[index];
}

const sortBuffer = new Float32Array(MAX_SAMPLES);

export function PerformanceGovernor({ mobile }: { mobile: boolean }) {
  const getState = useThree((state) => state.get);
  const tier = useWorld((state) => state.tier);
  const mode = useWorld((state) => state.graphicsMode);
  const timing = useRef({ windowStart: 0, settleUntil: 0 });
  const policy = useRef(createPolicyState(0));
  const forced = useRef(forcedTier());

  // Enveloppe du rendu à l'écran : onglet caché = rien ; cadence plafonnée ; temps d'image.
  useEffect(() => {
    const renderer = getState().gl;
    const original = renderer.render;
    renderer.render = (scene, camera) => {
      if (renderer.getRenderTarget() === null) {
        if (typeof document !== 'undefined' && document.hidden) return;
        const now = performance.now();
        if (pacing.cap > 0 && now - pacing.lastFrameAt < 1000 / pacing.cap - 3) return;
        if (pacing.lastFrameAt > 0 && pacing.count < MAX_SAMPLES) pacing.samples[pacing.count++] = now - pacing.lastFrameAt;
        pacing.lastFrameAt = now;
        // Ombres à mi-cadence (« Équilibré ») : la passe d'ombre doublait les draw calls. Les
        // matrices d'ombre ne changent qu'avec la carte : aucune incohérence, au pire une image
        // de retard pour l'ombre d'un objet en mouvement.
        const shadows = renderer.shadowMap;
        if (pacing.halfShadows) {
          shadows.autoUpdate = false;
          pacing.shadowFlip = !pacing.shadowFlip;
          if (pacing.shadowFlip) shadows.needsUpdate = true;
        } else if (!shadows.autoUpdate) {
          shadows.autoUpdate = true;
        }
      }
      original.call(renderer, scene, camera);
    };
    return () => {
      renderer.render = original;
      renderer.shadowMap.autoUpdate = true;
    };
  }, [getState]);

  // Chaque palier a son plafond de résolution (on repart du plafond à chaque changement)
  // et sa cadence ; le mode automatique retient son dernier choix.
  useEffect(() => {
    setRenderDpr(tierDpr(tier));
    pacing.cap = TIER_LEVELS[tier].frameCap;
    pacing.count = 0;
    // L'image qui suit un changement de palier redessine toujours les ombres (carte recréée).
    pacing.halfShadows = tier === 'medium' && !perfOff;
    pacing.shadowFlip = false;
    useGraphicsStatus.setState({ capped: pacing.cap > 0 });
    if (useWorld.getState().graphicsMode === 'auto') graphicsMemory.autoTier = tier;
    const now = performance.now();
    onTierChanged(policy.current, now);
    timing.current.settleUntil = now + SETTLE_MS;
  }, [tier]);

  // Nouveau choix du joueur : on repart de zéro (pas de jugement sur l'ancien réglage).
  useEffect(() => {
    const now = performance.now();
    policy.current.probation = null;
    onTierChanged(policy.current, now);
    timing.current.settleUntil = now + SETTLE_MS;
    pacing.count = 0;
  }, [mode]);

  // Onglet de retour, fenêtre redimensionnée (le budget de pixels change avec la taille).
  useEffect(() => {
    let timer = 0;
    const resettle = () => {
      timing.current.settleUntil = performance.now() + SETTLE_MS;
      pacing.count = 0;
      pacing.lastFrameAt = 0;
    };
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const ceiling = tierDpr(useWorld.getState().tier);
        if (useRenderDpr.getState().dpr > ceiling) setRenderDpr(ceiling);
        resettle();
      }, 400);
    };
    document.addEventListener('visibilitychange', resettle);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resettle);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useFrame((state) => {
    const now = performance.now();
    const clock = timing.current;
    const world = useWorld.getState();
    // Ouverture (compilations), monde masqué par une page, onglet caché : pas de jugement.
    const judged = (world.phase === 'playing' || world.phase === 'docked') && state.scene.visible && !document.hidden;
    if (!judged || now < clock.settleUntil || forced.current) {
      if (!judged) clock.settleUntil = Math.max(clock.settleUntil, now + 600);
      clock.windowStart = now;
      pacing.count = 0;
      return;
    }
    if (now - clock.windowStart < WINDOW_MS) return;
    const count = pacing.count;
    const span = now - clock.windowStart;
    // Trop peu d'images pour conclure : la fenêtre s'allonge (jusqu'à 6 s) au lieu d'être
    // jetée, sinon un appareil à moins de 2,4 i/s ne serait jamais jugé.
    if (count < 6 && span < 6000) return;
    clock.windowStart = now;
    pacing.count = 0;
    if (count === 0) return;

    sortBuffer.set(pacing.samples.subarray(0, count));
    const sorted = sortBuffer.subarray(0, count).sort();
    const current = world.tier;
    const action = decide(
      policy.current,
      {
        mobile,
        auto: world.graphicsMode === 'auto',
        ceiling: deviceProfile().ceiling,
        // Captures de l'équipe (navigateur piloté, rendu logiciel) : jamais sous 'low' tout seul.
        lowest: automatedBrowser() ? 'low' : 'minimal',
      },
      {
        tier: current,
        cap: TIER_LEVELS[current].frameCap,
        dpr: useRenderDpr.getState().dpr,
        dprCeiling: tierDpr(current),
        dprFloor: tierDprFloor(current),
      },
      { p50: percentile(sorted, count, 0.5), p90: percentile(sorted, count, 0.9), span },
      now,
    );
    const thermal = policy.current.thermalUntil > now;
    if (thermal !== useGraphicsStatus.getState().thermal) useGraphicsStatus.setState({ thermal });
    if (action.type === 'dpr') {
      setRenderDpr(action.value);
      clock.settleUntil = now + SETTLE_MS;
    } else if (action.type === 'tier') {
      world.setTier(action.tier);
      clock.settleUntil = now + SETTLE_MS;
    }
  });

  return null;
}

/**
 * Téléphone : quand une page couvre tout l'écran (carnet de bord, feuille dépliée), le
 * monde invisible derrière ne se dessine plus — plus aucun draw call pendant la lecture
 * (batterie, chauffe, et donc des FPS stables au retour). La simulation continue (aucune
 * horloge remise à zéro) ; le dessin reprend à l'instant où la page se replie.
 */
export function CoveredWorldPause() {
  const getState = useThree((state) => state.get);
  const logbookOpen = useLogbook((state) => state.open);
  const sheetFull = useSheetCover((state) => state.full);

  useEffect(() => {
    const covered = sheetFull || (logbookOpen && window.matchMedia('(max-width: 640px)').matches);
    if (!covered) return;
    // Après l'animation d'ouverture : on ne fige jamais une page qui monte encore.
    const timeout = setTimeout(() => {
      getState().scene.visible = false;
    }, 700);
    return () => {
      clearTimeout(timeout);
      getState().scene.visible = true;
    };
  }, [getState, logbookOpen, sheetFull]);

  return null;
}

/** Petit relevé en développement uniquement, sans setState ni rerender React. */
export function PerformanceDebug() {
  const gl = useThree((state) => state.gl);
  const getState = useThree((state) => state.get);
  const panel = useRef<HTMLDivElement | null>(null);
  const elapsed = useRef(0);
  const frames = useRef(0);

  // Relevés automatisés (répartition des draw calls par île) : accès à la scène, en
  // développement seulement.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__three = { get: getState, Frustum, Matrix4, Sphere };
    return () => {
      delete target.__three;
    };
  }, [getState]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'fixed',
      right: '10px',
      bottom: '10px',
      zIndex: '100',
      padding: '7px 9px',
      borderRadius: '6px',
      background: 'rgba(4, 12, 18, .78)',
      color: '#bdeee8',
      font: '11px/1.45 monospace',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });
    document.body.appendChild(element);
    panel.current = element;
    return () => {
      element.remove();
      panel.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    if (!panel.current) return;
    elapsed.current += delta;
    frames.current += 1;
    if (elapsed.current < 0.5) return;
    const info = gl.info;
    const fps = Math.round(frames.current / elapsed.current);
    const world = useWorld.getState();
    panel.current.textContent = [
      `${fps} FPS · ${world.tier.toUpperCase()}${world.graphicsMode === 'auto' ? ' (auto)' : ''} · DPR ${useRenderDpr.getState().dpr}`,
      `${info.render.calls} calls · ${info.render.triangles.toLocaleString()} tris`,
      `${info.memory.geometries} geometries · ${info.memory.textures} textures`,
    ].join('\n');
    elapsed.current = 0;
    frames.current = 0;
  });

  return null;
}
