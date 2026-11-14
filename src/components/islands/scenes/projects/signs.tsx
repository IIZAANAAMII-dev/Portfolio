'use client';

import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, DoubleSide, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { signTexture, useHandFont } from '../../kit';
import type { Maquette, V3 } from './builder';

/**
 * Signalétique de la ville : la plaque émaillée du numéro (« 01 »…) et l'enseigne peinte
 * du titre. Les supports (poteaux, cadres) sont ajoutés à la maquette du bâtiment ; seuls
 * les visuels peints sont des meshes à part.
 */

let sansFamily: Promise<string> | null = null;

function loadSansFont() {
  sansFamily ??= (async () => {
    const family = getComputedStyle(document.body).getPropertyValue('--font-inter').trim() || 'system-ui, sans-serif';
    await document.fonts.load(`800 120px ${family}`).catch(() => undefined);
    return family;
  })();
  return sansFamily;
}

function useSansFont() {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSansFont().then((name) => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return family;
}

/** Plaque émaillée : fond à la couleur du projet, liseré crème, numéro blanc. */
function plaqueTexture(index: string, accent: string, family: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbf3e2';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(30, 20, 40, 0.35)';
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 118px ${family}`;
  ctx.fillText(index, 128, 136, 190);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Disque émaillé du numéro de projet (face +Z), lisible de loin. */
export function Plaque({ index, accent, size = 1, position, rotation }: { index: string; accent: string; size?: number; position: V3; rotation?: V3 }) {
  const family = useSansFont();
  const texture = useMemo(() => (family ? plaqueTexture(index, accent, family) : null), [accent, family, index]);
  const material = useMemo(
    () => (texture ? new MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.05, transparent: true, alphaTest: 0.5 }) : null),
    [texture],
  );
  useEffect(
    () => () => {
      texture?.dispose();
      material?.dispose();
    },
    [material, texture],
  );
  if (!material) return null;
  return (
    <mesh position={position} rotation={rotation} material={material} raycast={() => null}>
      <circleGeometry args={[size / 2, 28]} />
    </mesh>
  );
}

/** Enseigne peinte (texte seul) : le cadre et le poteau sont dans la maquette. */
export function SignText({ lines, accent, width, position, rotation }: { lines: string[]; accent: string; width: number; position: V3; rotation?: V3 }) {
  const family = useHandFont();
  const text = lines.join('\n');
  const texture = useMemo(() => (family ? signTexture(text.split('\n'), family, accent) : null), [accent, family, text]);
  const material = useMemo(() => (texture ? new MeshStandardMaterial({ map: texture, roughness: 0.95 }) : null), [texture]);
  useEffect(
    () => () => {
      texture?.dispose();
      material?.dispose();
    },
    [material, texture],
  );
  if (!material) return null;
  return (
    <mesh position={position} rotation={rotation} material={material} raycast={() => null}>
      <planeGeometry args={[width, width / 2]} />
    </mesh>
  );
}

/**
 * Cadre en bois d'une enseigne sur poteau, ajouté à une maquette. Renvoie la position du
 * panneau peint (centre, légèrement devant le cadre) pour y poser <SignText>.
 */
export function signFrame(m: Maquette, at: V3, rotationY: number, width: number, post: number, wood = '#8a5d3b', pole = '#6e4a33'): V3 {
  const height = width / 2;
  const [x, y, z] = at;
  m.cylinder(0.07, 0.09, post, [x, y + post / 2, z], pole, 6);
  const boardY = y + post + height / 2 - 0.1;
  m.box([width + 0.14, height + 0.14, 0.1], [x, boardY, z], wood, [0, rotationY, 0]);
  return [x + Math.sin(rotationY) * 0.056, boardY, z + Math.cos(rotationY) * 0.056];
}

/** Enseigne murale (sans poteau) : cadre plaqué contre une façade (+Z local). */
export function wallSignFrame(m: Maquette, at: V3, width: number, wood = '#8a5d3b'): V3 {
  const height = width / 2;
  m.box([width + 0.14, height + 0.14, 0.08], at, wood);
  return [at[0], at[1], at[2] + 0.045];
}

/* ------------------------------------------------------------- ruban « Nouveau » */

function ribbonTexture(text: string, family: string, accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(0.5, '#c9b8ff');
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  // Ruban à queues d'aronde.
  ctx.moveTo(0, 8);
  ctx.lineTo(512, 8);
  ctx.lineTo(486, 64);
  ctx.lineTo(512, 120);
  ctx.lineTo(0, 120);
  ctx.lineTo(26, 64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(34, 18, 444, 92);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 78px ${family}`;
  ctx.shadowColor = 'rgba(40, 20, 90, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 256, 70, 420);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Ruban lumineux (texte venant des données : le badge du projet). */
export function Ribbon({ text, accent, width = 2.4, position, rotation }: { text: string; accent: string; width?: number; position: V3; rotation?: V3 }) {
  const family = useHandFont();
  const texture = useMemo(() => (family ? ribbonTexture(text, family, accent) : null), [accent, family, text]);
  const material = useMemo(
    () =>
      texture
        ? new MeshStandardMaterial({
            map: texture,
            emissive: '#ffffff',
            emissiveMap: texture,
            emissiveIntensity: 0.55,
            transparent: true,
            alphaTest: 0.4,
            side: DoubleSide,
            roughness: 0.6,
          })
        : null,
    [texture],
  );
  useEffect(
    () => () => {
      texture?.dispose();
      material?.dispose();
    },
    [material, texture],
  );
  if (!material) return null;
  return (
    <mesh position={position} rotation={rotation} material={material} raycast={() => null}>
      <planeGeometry args={[width, width / 4]} />
    </mesh>
  );
}
