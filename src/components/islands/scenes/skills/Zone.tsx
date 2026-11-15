'use client';

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, CylinderGeometry, Mesh, MeshBasicMaterial, ShaderMaterial } from 'three';
import { focusItem, useFocusedItem } from '@/lib/focus';
import { damp } from '@/lib/utils/math';
import type { SkillZone } from '@/types';
import { Hotspot, PaintedSign, useClearing } from '../../kit';
import { flatRing, Merger, pose, topAndSides } from './geometry';
import { PAD_TOP, ZONE_SCALE, type ZoneSpot } from './layout';
import { createBeamMaterial, vivid } from './materials';

/** Ce que reçoit chaque zone du laboratoire. */
export interface ZoneProps {
  zone: SkillZone;
  spot: ZoneSpot;
}

/**
 * Dalle octogonale d'une zone : dessus franchement teinté à la couleur de la zone, flancs
 * de pierre, liseré saturé et, sur le dessus, un filet lumineux qui s'éclaire la nuit.
 * Le dessus de la dalle est en y = 0.
 */
export function addPad(paint: Merger, glow: Merger, radius: number, accent: string) {
  const strong = new Color(vivid(accent));
  const top = new Color('#f4ead6').lerp(strong, 0.68).getStyle();
  const inner = new Color('#f4ead6').lerp(strong, 0.42).getStyle();
  const rim = new Color('#fbf3e3').lerp(strong, 0.12).getStyle();
  const band = vivid(accent, 0.9, 0.42);
  paint.add(
    new CylinderGeometry(radius, radius * 1.03, 0.8, 8, 1, false, Math.PI / 8),
    topAndSides(top, '#c9bdaa'),
    pose([0, -0.4, 0]),
    0.06,
  );
  // Disque central plus clair : la scène de la zone, cernée d'un anneau franc.
  paint.add(flatRing(0, radius * 0.58, 8, Math.PI / 8), inner, pose([0, 0.003, 0]), 0);
  paint.add(flatRing(radius * 0.9, radius * 0.985, 8, Math.PI / 8), rim, pose([0, 0.004, 0]), 0);
  paint.add(new CylinderGeometry(radius * 1.034, radius * 1.034, 0.16, 8, 1, true, Math.PI / 8), band, pose([0, -0.09, 0]), 0);
  glow.add(flatRing(radius * 0.82, radius * 0.875, 8, Math.PI / 8), vivid(accent, 0.95, 0.62), pose([0, 0.006, 0]), 0);
}

/** Les meshes décoratifs ne captent pas le pointeur : seul le volume de la zone le fait. */
export const noRaycast = () => null;

/**
 * Enveloppe d'une zone : posée sur sa dalle, tournée vers la caméra, cliquable en entier
 * (ouvre le panneau sur la zone), avec son panneau peint. Au survol, et tant que le
 * carnet est ouvert sur elle, la dalle s'illumine : voile de couleur sur le dessus et
 * rideau de lumière qui monte de ses bords. `sign` : position (x, z) du panneau.
 */
export function ZoneShell({
  zone,
  spot,
  sign,
  reach = 2.6,
  children,
}: ZoneProps & { sign: [number, number]; reach?: number; children: ReactNode }) {
  useClearing(spot.x, spot.z, spot.reach + 0.45);
  const activate = useCallback(() => focusItem('skills', zone.id), [zone.id]);
  const focused = useFocusedItem('skills') === zone.id;
  const hovered = useRef(false);
  const veil = useRef<MeshBasicMaterial>(null);
  const veilMesh = useRef<Mesh>(null);
  const curtain = useRef<Mesh>(null);
  const lit = useRef(0);
  const curtainMaterial = useMemo(() => createBeamMaterial(zone.accent, 0), [zone.accent]);
  const curtainShape = useMemo(() => new CylinderGeometry(spot.pad * 1.04, spot.pad * 1.04, 0.9, 8, 1, true, Math.PI / 8), [spot.pad]);
  const veilShape = useMemo(() => new Merger().add(flatRing(0, spot.pad * 0.985, 8, Math.PI / 8), '#ffffff', undefined, 0).build(), [spot.pad]);

  useEffect(
    () => () => {
      curtainMaterial.dispose();
      curtainShape.dispose();
      veilShape.dispose();
    },
    [curtainMaterial, curtainShape, veilShape],
  );

  useFrame((state, delta) => {
    const goal = Math.max(hovered.current ? 1 : 0, focused ? 0.75 : 0);
    lit.current = damp(lit.current, goal, 7, Math.min(delta, 1 / 30));
    const shimmer = 0.85 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
    if (veil.current) veil.current.opacity = lit.current * 0.32 * shimmer;
    if (veilMesh.current) veilMesh.current.visible = lit.current > 0.01;
    if (curtain.current) {
      curtain.current.visible = lit.current > 0.01;
      (curtain.current.material as ShaderMaterial).uniforms.uStrength.value = lit.current * 0.55 * shimmer;
    }
  });

  return (
    <Hotspot
      position={[spot.x, spot.level + PAD_TOP, spot.z]}
      rotation={[0, spot.facing, 0]}
      scale={ZONE_SCALE}
      hoverScale={1.03}
      onActivate={activate}
    >
      <group
        onPointerOver={() => {
          hovered.current = true;
        }}
        onPointerOut={() => {
          hovered.current = false;
        }}
      >
        {children}
        {/* Panneau assez large pour se lire depuis le ponton (≈ 2,5 m une fois la zone à l'échelle). */}
        <PaintedSign lines={[zone.label]} position={[sign[0], 0, sign[1]]} rotation={0} accent={vivid(zone.accent, 0.9, 0.45)} width={1.85} post={0.5} />
        {/* Volume de sélection : toute la zone répond au clic, sans lancer de rayon sur chaque pièce. */}
        <mesh visible={false} position-y={reach / 2 - 0.2}>
          <cylinderGeometry args={[spot.pad * 1.02, spot.pad * 1.02, reach, 8]} />
        </mesh>
      </group>
      <mesh ref={veilMesh} geometry={veilShape} position-y={0.012} visible={false} raycast={noRaycast}>
        <meshBasicMaterial ref={veil} color={zone.accent} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={curtain} geometry={curtainShape} material={curtainMaterial} position-y={0.45} visible={false} raycast={noRaycast} />
    </Hotspot>
  );
}
