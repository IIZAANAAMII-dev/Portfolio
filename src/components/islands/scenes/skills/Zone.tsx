'use client';

import { useCallback, type ReactNode } from 'react';
import { CylinderGeometry } from 'three';
import { focusItem } from '@/lib/focus';
import type { SkillZone } from '@/types';
import { Hotspot, PaintedSign, useClearing } from '../../kit';
import { flatRing, Merger, pose, topAndSides } from './geometry';
import { PAD_TOP, type ZoneSpot } from './layout';

/** Ce que reçoit chaque zone du laboratoire. */
export interface ZoneProps {
  zone: SkillZone;
  spot: ZoneSpot;
}

/**
 * Dalle octogonale d'une zone : pierre claire, liseré à la couleur de la zone et, sur le
 * dessus, un filet lumineux qui s'éclaire la nuit. Le dessus de la dalle est en y = 0.
 */
export function addPad(paint: Merger, glow: Merger, radius: number, accent: string) {
  paint.add(
    new CylinderGeometry(radius, radius * 1.03, 0.8, 8, 1, false, Math.PI / 8),
    topAndSides('#e8e1d4', '#c9bdaa'),
    pose([0, -0.4, 0]),
    0.06,
  );
  paint.add(new CylinderGeometry(radius * 1.034, radius * 1.034, 0.08, 8, 1, true, Math.PI / 8), accent, pose([0, -0.075, 0]), 0);
  glow.add(flatRing(radius * 0.83, radius * 0.87, 8, Math.PI / 8), accent, pose([0, 0.006, 0]), 0);
}

/** Les meshes décoratifs ne captent pas le pointeur : seul le volume de la zone le fait. */
export const noRaycast = () => null;

/**
 * Enveloppe d'une zone : posée sur sa dalle, tournée vers la caméra, cliquable en entier
 * (ouvre le panneau sur la zone), avec son panneau peint. `sign` : position (x, z) du
 * panneau dans le repère de la zone.
 */
export function ZoneShell({
  zone,
  spot,
  sign,
  reach = 2.6,
  children,
}: ZoneProps & { sign: [number, number]; reach?: number; children: ReactNode }) {
  useClearing(spot.x, spot.z, spot.pad + 0.45);
  const activate = useCallback(() => focusItem('skills', zone.id), [zone.id]);
  return (
    <Hotspot position={[spot.x, spot.level + PAD_TOP, spot.z]} rotation={[0, spot.facing, 0]} hoverScale={1.035} onActivate={activate}>
      {children}
      <PaintedSign lines={[zone.label]} position={[sign[0], 0, sign[1]]} rotation={0} accent={zone.accent} width={1.45} post={0.42} />
      {/* Volume de sélection : toute la zone répond au clic, sans lancer de rayon sur chaque pièce. */}
      <mesh visible={false} position-y={reach / 2 - 0.2}>
        <cylinderGeometry args={[spot.pad * 1.02, spot.pad * 1.02, reach, 8]} />
      </mesh>
    </Hotspot>
  );
}
