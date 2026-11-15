'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Frustum, Matrix4, Sphere } from 'three';
import { useLogbook } from '@/lib/logbook';
import { forcedQuality, qualityDpr, useRenderDpr, type QualityLevel } from '@/lib/quality';
import { useSheetCover } from '@/lib/sheet';
import { useWorld } from '@/lib/store';

const ORDER: QualityLevel[] = ['low', 'medium', 'high'];
const SAMPLE_SECONDS = 4;
const COOLDOWN_SECONDS = 14;
const UPGRADE_SECONDS = 20;
/** Résolution minimale du réglage fin (qualité basse) : en dessous, l'image devient floue. */
const MIN_DPR = 0.8;
const DPR_STEP = 0.1;
/** Délai entre deux changements de résolution (chacun réalloue les tampons du canvas). */
const DPR_COOLDOWN_SECONDS = 8;

function setRenderDpr(value: number) {
  const dpr = Math.round(value * 100) / 100;
  if (Math.abs(useRenderDpr.getState().dpr - dpr) > 0.001) useRenderDpr.setState({ dpr });
}

/**
 * Régulation volontairement lente : une moyenne sur plusieurs secondes, puis un long
 * cooldown. La qualité ne peut donc pas osciller à chaque variation ponctuelle de FPS.
 *  - le niveau de départ est fixé avant la première image (lib/quality : téléphone 'low') ;
 *  - un téléphone ne monte jamais au-delà de 'medium' (le bloom et son MSAA coûtent trop) ;
 *  - en qualité basse, si les FPS restent sous 27, la résolution baisse par petits pas
 *    (jusqu'à 0,8) puis remonte quand la marge revient : dernier levier avant le saccadé.
 */
export function PerformanceGovernor({ mobile }: { mobile: boolean }) {
  const elapsed = useRef(0);
  const frames = useRef(0);
  const cooldown = useRef(COOLDOWN_SECONDS);
  const dprCooldown = useRef(0);
  const upgradeTime = useRef(0);
  const forced = useRef(forcedQuality());

  useFrame((state, delta) => {
    if (forced.current) return;
    // Monde masqué par une page (voir CoveredWorldPause) : des FPS sans rapport avec la
    // scène, on ne les compte pas.
    if (!state.scene.visible) {
      elapsed.current = 0;
      frames.current = 0;
      return;
    }
    const dt = Math.min(delta, 0.25);
    elapsed.current += dt;
    frames.current += 1;
    cooldown.current += dt;
    dprCooldown.current += dt;
    if (elapsed.current < SAMPLE_SECONDS) return;

    const fps = frames.current / elapsed.current;
    elapsed.current = 0;
    frames.current = 0;

    const current = useWorld.getState().quality;
    const index = ORDER.indexOf(current);
    const top = mobile ? ORDER.indexOf('medium') : ORDER.length - 1;
    const downgradeThreshold = current === 'high' ? 48 : 38;

    if (fps < downgradeThreshold && index > 0 && cooldown.current >= COOLDOWN_SECONDS) {
      useWorld.getState().setQuality(ORDER[index - 1]);
      cooldown.current = 0;
      upgradeTime.current = 0;
      return;
    }

    // Qualité basse : réglage fin de la résolution.
    if (current === 'low' && dprCooldown.current >= DPR_COOLDOWN_SECONDS) {
      const ceiling = qualityDpr('low');
      const dpr = useRenderDpr.getState().dpr;
      if (fps < 27 && dpr > MIN_DPR + 0.001) {
        setRenderDpr(Math.max(MIN_DPR, dpr - DPR_STEP));
        dprCooldown.current = 0;
        upgradeTime.current = 0;
        return;
      }
      if (fps > 48 && dpr < ceiling - 0.001) {
        setRenderDpr(Math.min(ceiling, dpr + DPR_STEP));
        dprCooldown.current = 0;
        return;
      }
    }

    if (fps >= 57 && index < top) {
      upgradeTime.current += SAMPLE_SECONDS;
      if (upgradeTime.current >= UPGRADE_SECONDS && cooldown.current >= COOLDOWN_SECONDS) {
        useWorld.getState().setQuality(ORDER[index + 1]);
        cooldown.current = 0;
        upgradeTime.current = 0;
      }
    } else {
      upgradeTime.current = Math.max(0, upgradeTime.current - SAMPLE_SECONDS * 0.5);
    }
  });

  // Chaque niveau a son plafond de résolution (repart du plafond à chaque changement).
  const quality = useWorld((state) => state.quality);
  useEffect(() => {
    setRenderDpr(qualityDpr(quality));
  }, [quality]);

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
    panel.current.textContent = [
      `${fps} FPS · ${useWorld.getState().quality.toUpperCase()}`,
      `${info.render.calls} calls · ${info.render.triangles.toLocaleString()} tris`,
      `${info.memory.geometries} geometries · ${info.memory.textures} textures`,
    ].join('\n');
    elapsed.current = 0;
    frames.current = 0;
  });

  return null;
}
