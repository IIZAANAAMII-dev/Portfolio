'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { QUALITY_LEVELS, type QualityLevel } from '@/lib/quality';
import { useWorld } from '@/lib/store';

const ORDER: QualityLevel[] = ['low', 'medium', 'high'];
const SAMPLE_SECONDS = 4;
const COOLDOWN_SECONDS = 14;
const UPGRADE_SECONDS = 20;

/**
 * Régulation volontairement lente : une moyenne sur plusieurs secondes, puis un long
 * cooldown. La qualité ne peut donc pas osciller à chaque variation ponctuelle de FPS.
 */
export function PerformanceGovernor({ mobile }: { mobile: boolean }) {
  const setDpr = useThree((state) => state.setDpr);
  const elapsed = useRef(0);
  const frames = useRef(0);
  const cooldown = useRef(COOLDOWN_SECONDS);
  const upgradeTime = useRef(0);

  useEffect(() => {
    const initial: QualityLevel = mobile ? 'low' : 'high';
    useWorld.getState().setQuality(initial);
  }, [mobile]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25);
    elapsed.current += dt;
    frames.current += 1;
    cooldown.current += dt;
    if (elapsed.current < SAMPLE_SECONDS) return;

    const fps = frames.current / elapsed.current;
    elapsed.current = 0;
    frames.current = 0;

    const current = useWorld.getState().quality;
    const index = ORDER.indexOf(current);
    const downgradeThreshold = current === 'high' ? 48 : 38;

    if (fps < downgradeThreshold && index > 0 && cooldown.current >= COOLDOWN_SECONDS) {
      useWorld.getState().setQuality(ORDER[index - 1]);
      cooldown.current = 0;
      upgradeTime.current = 0;
      return;
    }

    if (fps >= 57 && index < ORDER.length - 1) {
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

  const quality = useWorld((state) => state.quality);
  useEffect(() => {
    const config = QUALITY_LEVELS[quality];
    setDpr(Math.min(window.devicePixelRatio || 1, config.dpr));
  }, [quality, setDpr]);

  return null;
}

/** Petit relevé en développement uniquement, sans setState ni rerender React. */
export function PerformanceDebug() {
  const gl = useThree((state) => state.gl);
  const panel = useRef<HTMLDivElement | null>(null);
  const elapsed = useRef(0);
  const frames = useRef(0);

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
