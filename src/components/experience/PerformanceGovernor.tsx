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
  stepTier,
  tierDpr,
  tierDprFloor,
  tierRank,
  TIER_LEVELS,
  useGraphicsStatus,
  useRenderDpr,
  type GraphicsTier,
} from '@/lib/quality';
import { useSheetCover } from '@/lib/sheet';
import { useWorld } from '@/lib/store';

/*
 * Régulateur graphique : il observe les temps d'image réellement présentés (et non une
 * moyenne de FPS), par fenêtres de 2,5 s, et n'agit que sur des tendances franches.
 *  - Ordre des leviers : la résolution d'abord (par grands pas, jusqu'au plancher du
 *    palier), puis le palier. Effondrement (médiane très lente) : palier tout de suite.
 *  - Montée lente : il faut une longue période d'images parfaites (16 s sur ordinateur,
 *    40 s sur téléphone), la résolution remonte avant le palier, et jamais au-delà du
 *    plafond de l'appareil (lib/quality : deviceProfile).
 *  - Pas d'oscillation : un palier essayé puis quitté dans les 30 s est bloqué (3 min, puis
 *    pour la visite) ; une baisse après une longue période stable est lue comme de la
 *    chauffe (throttling) : plus aucune montée pendant 5 min.
 *  - Choix manuel (« Graphismes ») : le palier ne bouge plus ; seule la résolution peut
 *    baisser en cas d'effondrement durable. `?quality=` : rien ne bouge.
 *  - Rien n'est jugé pendant l'ouverture (compilations), monde masqué, onglet caché, ni
 *    juste après un changement.
 * Le rendu lui-même : onglet caché = aucune image ; palier « Très léger » = 30 images/s
 * régulières (les animations gardent leur horloge, seules les images sautent).
 */

const WINDOW_MS = 2500;
const SETTLE_MS = 2500;
const MAX_SAMPLES = 512;
const PROBATION_MS = 30_000;
const THERMAL_MS = 5 * 60_000;
const STABLE_FOR_THERMAL_MS = 120_000;

/** Seuils (ms) d'une fenêtre, selon la cible : ordinateur 60 i/s, téléphone 30 i/s acceptés. */
function thresholds(mobile: boolean, cap: number) {
  if (cap > 0) {
    const frame = 1000 / cap;
    return { great: frame + 2.5, bad: frame * 1.35, severe: frame * 2.1 };
  }
  return mobile ? { great: 18.5, bad: 36, severe: 55 } : { great: 18.5, bad: 26, severe: 40 };
}

/** Partagé avec l'enveloppe de `gl.render` (cadence, temps d'image présentés). */
const pacing = {
  cap: 0,
  lastFrameAt: 0,
  samples: new Float32Array(MAX_SAMPLES),
  count: 0,
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
  const gov = useRef({
    windowStart: 0,
    settleUntil: 0,
    badStreak: 0,
    severeStreak: 0,
    greatMs: 0,
    lastChange: 0,
    lastDprChange: 0,
    lastGoodAt: 0,
    probation: null as { tier: GraphicsTier; until: number } | null,
    blocked: new Map<GraphicsTier, { until: number; failures: number }>(),
    thermalUntil: 0,
  });
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
      }
      original.call(renderer, scene, camera);
    };
    return () => {
      renderer.render = original;
    };
  }, [getState]);

  // Chaque palier a son plafond de résolution (on repart du plafond à chaque changement)
  // et sa cadence ; le mode automatique retient son dernier choix.
  useEffect(() => {
    setRenderDpr(tierDpr(tier));
    pacing.cap = TIER_LEVELS[tier].frameCap;
    useGraphicsStatus.setState({ capped: pacing.cap > 0 });
    if (useWorld.getState().graphicsMode === 'auto') graphicsMemory.autoTier = tier;
    const g = gov.current;
    g.settleUntil = performance.now() + SETTLE_MS;
    g.lastChange = performance.now();
    g.badStreak = 0;
    g.severeStreak = 0;
    pacing.count = 0;
  }, [tier]);

  // Nouveau choix du joueur : on repart de zéro (pas de jugement sur l'ancien réglage).
  useEffect(() => {
    const g = gov.current;
    g.settleUntil = performance.now() + SETTLE_MS;
    g.greatMs = 0;
    g.badStreak = 0;
    g.probation = null;
    pacing.count = 0;
  }, [mode]);

  // Onglet de retour, fenêtre redimensionnée (le budget de pixels change avec la taille).
  useEffect(() => {
    let timer = 0;
    const resettle = () => {
      gov.current.settleUntil = performance.now() + SETTLE_MS;
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
    const g = gov.current;
    const world = useWorld.getState();
    // Ouverture (compilations), monde masqué par une page, onglet caché : pas de jugement.
    const judged = (world.phase === 'playing' || world.phase === 'docked') && state.scene.visible && !document.hidden;
    if (!judged || now < g.settleUntil || forced.current) {
      if (!judged) g.settleUntil = Math.max(g.settleUntil, now + 600);
      g.windowStart = now;
      pacing.count = 0;
      return;
    }
    if (now - g.windowStart < WINDOW_MS) return;
    const count = pacing.count;
    const span = now - g.windowStart;
    // Trop peu d'images pour conclure : la fenêtre s'allonge (jusqu'à 6 s) au lieu d'être
    // jetée, sinon un appareil à moins de 2,4 i/s ne serait jamais jugé.
    if (count < 6 && span < 6000) return;
    g.windowStart = now;
    pacing.count = 0;
    if (count === 0) return;

    sortBuffer.set(pacing.samples.subarray(0, count));
    const sorted = sortBuffer.subarray(0, count).sort();
    const p50 = percentile(sorted, count, 0.5);
    const p90 = percentile(sorted, count, 0.9);
    const current = world.tier;
    const limits = thresholds(mobile, TIER_LEVELS[current].frameCap);
    const verdict = p50 > limits.severe ? 'severe' : p90 > limits.bad ? 'bad' : p90 <= limits.great ? 'great' : 'ok';

    const auto = world.graphicsMode === 'auto';
    const dpr = useRenderDpr.getState().dpr;
    const ceiling = tierDpr(current);
    const floor = tierDprFloor(current);
    const step = Math.max(0.08, (ceiling - floor) / 2);
    const profile = deviceProfile();
    // Captures de l'équipe (navigateur piloté, rendu logiciel) : jamais sous 'low' tout seul.
    const lowest: GraphicsTier = automatedBrowser() ? 'low' : 'minimal';
    if (g.thermalUntil > 0 && now > g.thermalUntil) {
      g.thermalUntil = 0;
      useGraphicsStatus.setState({ thermal: false });
    }

    const changed = () => {
      g.settleUntil = now + SETTLE_MS;
      g.lastChange = now;
      g.badStreak = 0;
      g.severeStreak = 0;
      g.greatMs = 0;
    };
    const lowerDpr = (to: number) => {
      setRenderDpr(Math.max(floor, to));
      g.lastDprChange = now;
      changed();
    };
    const downgrade = () => {
      const next = stepTier(current, -1);
      if (next === current || tierRank(next) < tierRank(lowest)) return false;
      // Palier essayé puis quitté aussitôt : bloqué (3 min, puis pour la visite).
      if (g.probation && g.probation.tier === current && now < g.probation.until) {
        const entry = g.blocked.get(current) ?? { until: 0, failures: 0 };
        entry.failures += 1;
        entry.until = entry.failures >= 2 ? Infinity : now + 3 * 60_000;
        g.blocked.set(current, entry);
      } else if (now - g.lastChange > STABLE_FOR_THERMAL_MS && now - g.lastGoodAt < 15_000) {
        // Longtemps parfait, puis plus lent à réglage égal : l'appareil chauffe.
        g.thermalUntil = now + THERMAL_MS;
        useGraphicsStatus.setState({ thermal: true });
      }
      g.probation = null;
      world.setTier(next);
      changed();
      return true;
    };

    if (verdict === 'great') g.lastGoodAt = now;

    if (verdict === 'severe') {
      g.severeStreak += 1;
      g.badStreak += 1;
      g.greatMs = 0;
      if (auto) {
        if (!downgrade() && dpr > floor + 0.005) lowerDpr(floor);
      } else if (g.severeStreak >= 2 && dpr > floor + 0.005) {
        // Choix manuel : le palier est respecté, la résolution baisse en dernier recours.
        lowerDpr(dpr - step);
      }
      return;
    }
    g.severeStreak = 0;

    if (verdict === 'bad') {
      g.badStreak += 1;
      g.greatMs = 0;
      if (!auto || g.badStreak < 2) return;
      if (dpr > floor + 0.005) {
        if (now - g.lastDprChange > 4000) lowerDpr(dpr - step);
      } else {
        downgrade();
      }
      return;
    }

    if (verdict === 'ok') {
      g.badStreak = Math.max(0, g.badStreak - 1);
      g.greatMs = Math.max(0, g.greatMs - span * 0.5);
      return;
    }

    // Images parfaites : on accumule, puis on remonte lentement (résolution d'abord).
    g.badStreak = 0;
    g.greatMs += span;
    const patience = !auto ? 20_000 : mobile ? 40_000 : 16_000;
    if (g.greatMs < patience) return;
    g.greatMs = 0;
    if (dpr < ceiling - 0.005) {
      setRenderDpr(Math.min(ceiling, dpr + step));
      g.lastDprChange = now;
      g.settleUntil = now + SETTLE_MS;
      return;
    }
    if (!auto || g.thermalUntil > now) return;
    const next = stepTier(current, 1);
    if (next === current || tierRank(next) > tierRank(profile.ceiling)) return;
    const blocked = g.blocked.get(next);
    if (blocked && now < blocked.until) return;
    g.probation = { tier: next, until: now + PROBATION_MS };
    world.setTier(next);
    changed();
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
