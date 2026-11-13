'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';

/**
 * Notes manuscrites posées à la surface de l'eau, comme les annotations d'une carte
 * ancienne. Elles apparaissent quand le bateau approche et s'effacent quand il s'éloigne.
 */

interface Note {
  lines: string[];
  at: [number, number];
  /** Direction de lecture : le haut du texte pointe vers ce cap (radians). */
  heading: number;
  width: number;
  arrow?: 'left' | 'right';
  /** Distance d'apparition. */
  reach?: number;
}

const outward = (x: number, z: number) => Math.atan2(z, x);

const NOTES: Note[] = [
  { lines: ['clique sur la mer', 'pour naviguer'], at: [20, -20], heading: 0.671, width: 15, arrow: 'left', reach: 70 },
  { lines: ['7 étoiles d’or', 'se cachent dans l’archipel'], at: [-6, -30], heading: 0.671, width: 17, reach: 55 },
  { lines: ['mes îlots de personnalité'], at: [-24, -24], heading: outward(-24, -24), width: 17, arrow: 'left', reach: 55 },
  { lines: ['on se parle ?'], at: [32, -66], heading: outward(32, -66), width: 11, arrow: 'right', reach: 50 },
  { lines: ['ici vivent', 'des monstres'], at: [84, 86], heading: outward(84, 86), width: 15, reach: 60 },
  { lines: ['ici vivent', 'des monstres'], at: [-110, -52], heading: outward(-110, -52), width: 15, reach: 60 },
];

/** Nom de la police manuscrite chargée par next/font (variable CSS). */
function handFont() {
  const family = getComputedStyle(document.body).getPropertyValue('--font-caveat').trim();
  return family || 'cursive';
}

function drawNote(note: Note, family: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const lineHeight = note.lines.length > 1 ? 120 : 150;
  ctx.font = `500 ${lineHeight}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = canvas.height / 2 - ((note.lines.length - 1) * lineHeight) / 2;
  note.lines.forEach((line, index) => {
    const y = top + index * lineHeight;
    // Contour sombre et doux, puis l'encre claire : lisible sur l'eau claire comme sombre.
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8, 30, 40, 0.38)';
    ctx.strokeText(line, canvas.width / 2, y + 4);
    ctx.fillStyle = 'rgba(255, 252, 244, 0.96)';
    ctx.fillText(line, canvas.width / 2, y);
  });
  if (note.arrow) {
    // Flèche dessinée à la main, courbe, sous le texte.
    const direction = note.arrow === 'left' ? -1 : 1;
    const startX = canvas.width / 2 - direction * 160;
    const endX = canvas.width / 2 + direction * 300;
    const y = canvas.height - 46;
    ctx.lineCap = 'round';
    for (const [width, color, offset] of [[16, 'rgba(8, 30, 40, 0.3)', 4], [9, 'rgba(255, 252, 244, 0.95)', 0]] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(startX, y - 30 + offset);
      ctx.quadraticCurveTo(canvas.width / 2 + direction * 60, y + 26 + offset, endX, y - 6 + offset);
      ctx.moveTo(endX, y - 6 + offset);
      ctx.lineTo(endX - direction * 50, y - 40 + offset);
      ctx.moveTo(endX, y - 6 + offset);
      ctx.lineTo(endX - direction * 58, y + 22 + offset);
      ctx.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function SeaNote({ note, family }: { note: Note; family: string }) {
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const texture = useMemo(() => drawNote(note, family), [family, note]);
  useEffect(() => () => texture.dispose(), [texture]);
  const reach = note.reach ?? 55;

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    const { phase } = useWorld.getState();
    const sailing = phase === 'playing' || phase === 'docked';
    const distance = Math.hypot(boatState.position.x - note.at[0], boatState.position.z - note.at[1]);
    const opacity = sailing ? 1 - smoothstep(reach * 0.6, reach, distance) : 0;
    const material = target.material as MeshBasicMaterial;
    material.opacity = opacity * 0.92;
    target.visible = opacity > 0.01;
  });

  return (
    // Le haut du texte (axe -Z après bascule) pointe vers le cap de lecture.
    <group ref={group} position={[note.at[0], 0.32, note.at[1]]} rotation-y={-(note.heading + Math.PI / 2)}>
      <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={5} raycast={() => null}>
        <planeGeometry args={[note.width, (note.width * 384) / 1024]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SeaNotes() {
  const [family, setFamily] = useState<string | null>(null);

  // La police manuscrite doit être chargée avant de dessiner les notes.
  useEffect(() => {
    let cancelled = false;
    const name = handFont();
    void document.fonts.load(`500 64px ${name}`).catch(() => undefined).finally(() => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!family) return null;
  return (
    <group>
      {NOTES.map((note, index) => (
        <SeaNote key={index} note={note} family={family} />
      ))}
    </group>
  );
}
