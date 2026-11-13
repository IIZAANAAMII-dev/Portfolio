'use client';

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Group, SRGBColorSpace } from 'three';
import { hash, damp } from '@/lib/utils/math';
import { windowMaterial } from '@/lib/windows';
import type { IslandConfig } from '@/types';
import { addClearing, ClearingContext } from './clearings';
import { groundAt, type HeightSampler, type terrainFeatures } from './terrain-shape';

/**
 * Kit partagé des décors d'îles.
 *
 * Tout ce qu'un décor procédural a besoin pour bien se poser et se comporter :
 *  - `on()` pose un objet sur le relief, `facingDock()` l'oriente vers le ponton ;
 *  - `useClearing()` / `<ClearingAt>` empêchent l'herbe de traverser les planchers ;
 *  - `<PaintedSign>` : panneau en bois peint à la main (police Caveat du site) ;
 *  - `<WindowPane>` : vitre qui s'allume à son heure au crépuscule ;
 *  - `<Hotspot>` : objet cliquable (curseur, petit rebond au survol, clic isolé).
 */

export interface SceneProps {
  island: IslandConfig;
  sampler: HeightSampler;
  features: ReturnType<typeof terrainFeatures>;
}

export function on(sampler: HeightSampler, x: number, z: number, footprint = 0.8, sink = 0.06): [number, number, number] {
  return [x, groundAt(sampler, x, z, footprint) - sink, z];
}

export function facingDock(island: IslandConfig, x: number, z: number) {
  const dockX = Math.cos(island.dockAngle) * island.radius;
  const dockZ = Math.sin(island.dockAngle) * island.radius;
  return Math.atan2(dockX - x, dockZ - z);
}

/** Déclare une clairière (pas d'herbe) sous un décor procédural. */
export function useClearing(x: number, z: number, radius: number) {
  const clearings = useContext(ClearingContext);
  useLayoutEffect(() => addClearing(clearings, x, z, radius), [clearings, radius, x, z]);
}

/* ------------------------------------------------------------- panneau peint */

let handFamily: Promise<string> | null = null;

/** Police manuscrite du site (next/font), chargée une seule fois pour tous les panneaux. */
export function loadHandFont() {
  handFamily ??= (async () => {
    const family = getComputedStyle(document.body).getPropertyValue('--font-caveat').trim() || 'cursive';
    await document.fonts.load(`500 64px ${family}`).catch(() => undefined);
    return family;
  })();
  return handFamily;
}

export function useHandFont() {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadHandFont().then((name) => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return family;
}

export function signTexture(lines: string[], family: string, accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Planche claire, veinage léger, liseré de couleur.
  ctx.fillStyle = '#efdcb4';
  ctx.fillRect(0, 0, 512, 256);
  for (let index = 0; index < 18; index++) {
    ctx.strokeStyle = `rgba(140, 100, 60, ${0.06 + hash(index * 1.7) * 0.06})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const y = 8 + hash(index * 3.1) * 240;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 3);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = '#3b2f25';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (lines.length === 1) {
    ctx.font = `500 104px ${family}`;
    ctx.fillText(lines[0], 256, 132, 470);
  } else {
    ctx.font = `500 84px ${family}`;
    ctx.fillText(lines[0], 256, 88, 470);
    ctx.font = `500 58px ${family}`;
    ctx.fillText(lines[1], 256, 178, 470);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Panneau en bois sur son poteau : texte peint à la main, liseré à la couleur de l'île. */
export function PaintedSign({
  lines,
  position,
  rotation,
  accent,
  width = 2.1,
  post = 1.5,
}: {
  lines: string[];
  position: [number, number, number];
  rotation: number;
  accent: string;
  width?: number;
  post?: number;
}) {
  const family = useHandFont();
  const text = lines.join('\n');
  const texture = useMemo(() => (family ? signTexture(text.split('\n'), family, accent) : null), [accent, family, text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const height = width / 2;
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow position-y={post / 2}>
        <cylinderGeometry args={[0.07, 0.09, post, 6]} />
        <meshStandardMaterial color="#6e4a33" roughness={1} flatShading />
      </mesh>
      <mesh castShadow position-y={post + height / 2 - 0.1}>
        <boxGeometry args={[width + 0.12, height + 0.12, 0.1]} />
        <meshStandardMaterial color="#8a5d3b" roughness={1} />
      </mesh>
      {texture && (
        <mesh position={[0, post + height / 2 - 0.1, 0.056]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial map={texture} roughness={0.95} />
        </mesh>
      )}
    </group>
  );
}


/** Clairière déclarée depuis le rendu d'une liste (composant, pour respecter les règles des hooks). */
export function ClearingAt({ x, z, radius }: { x: number; z: number; radius: number }) {
  useClearing(x, z, radius);
  return null;
}



/**
 * Vitre (plan) qui s'allume progressivement au crépuscule. Matériau partagé par heure
 * d'allumage : des dizaines de fenêtres ne coûtent que quelques matériaux.
 */
export function WindowPane({
  seed,
  width = 0.32,
  height = 0.42,
  lit = '#ffc46b',
  glass = '#36506b',
  intensity,
  ...props
}: {
  seed: number;
  width?: number;
  height?: number;
  lit?: string;
  glass?: string;
  intensity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const material = useMemo(() => windowMaterial(seed, lit, glass, intensity), [glass, intensity, lit, seed]);
  return (
    <mesh {...props} material={material} raycast={() => null}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}

/**
 * Objet cliquable d'un décor : curseur main, léger rebond au survol, clic qui ne se
 * propage pas à l'île (sinon le bateau repartirait). `onActivate` reçoit l'événement.
 */
export function Hotspot({
  children,
  onActivate,
  hoverScale = 1.06,
  ...props
}: {
  children: ReactNode;
  onActivate: (event: ThreeEvent<MouseEvent>) => void;
  hoverScale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const inner = useRef<Group>(null);
  const hovered = useRef(false);
  useFrame((_, delta) => {
    const target = inner.current;
    if (!target) return;
    const goal = hovered.current ? hoverScale : 1;
    target.scale.setScalar(damp(target.scale.x, goal, 12, Math.min(delta, 1 / 30)));
  });
  return (
    <group
      {...props}
      onClick={(event) => {
        event.stopPropagation();
        onActivate(event);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        hovered.current = true;
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        hovered.current = false;
        document.body.style.cursor = '';
      }}
    >
      <group ref={inner}>{children}</group>
    </group>
  );
}
