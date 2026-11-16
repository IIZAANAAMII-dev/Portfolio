'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { homeIsland } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { isCoarsePointer } from '@/lib/utils/device';
import { smoothstep } from '@/lib/utils/math';

/**
 * Notes manuscrites posées à la surface de l'eau, comme les annotations d'une carte
 * ancienne. Elles apparaissent quand le bateau approche et s'effacent quand il s'éloigne.
 */

interface Note {
  lines: string[];
  /** Variante au doigt (écran tactile). */
  touchLines?: string[];
  at: [number, number];
  /** Direction de lecture : le haut du texte pointe vers ce cap (radians). */
  heading: number;
  width: number;
  arrow?: 'left' | 'right';
  /** Distance d'apparition. */
  reach?: number;
  /** A besoin de place sous le bateau : masquée sur un téléphone à l'horizontale (écran trop bas). */
  needsRoom?: boolean;
}

const outward = (x: number, z: number) => Math.atan2(z, x);

/** Le bateau au départ, amarré à l'îlot (même calcul que lib/boat-state.ts) : position et cap. */
const START_HEADING = homeIsland.dockAngle + Math.PI / 2;
const START_REACH = homeIsland.radius + 5.8;
const START: [number, number] = [
  homeIsland.position[0] + Math.cos(homeIsland.dockAngle) * START_REACH,
  homeIsland.position[1] + Math.sin(homeIsland.dockAngle) * START_REACH,
];

/** Un point repéré depuis le bateau au départ : `ahead` mètres vers l'avant, `right` vers la droite de l'écran. */
function fromStart(ahead: number, right: number): [number, number] {
  const fx = Math.cos(START_HEADING);
  const fz = Math.sin(START_HEADING);
  return [START[0] + fx * ahead - fz * right, START[1] + fz * ahead + fx * right];
}

const NOTES: Note[] = [
  // La consigne du départ : dans le sillage du bateau amarré, entre lui et la caméra, centrée
  // sur l'axe de la vue. Elle reste ainsi au milieu de l'écran quel que soit son format
  // (téléphone en portrait compris), sous le bateau sans le toucher, au-dessus du dock et loin
  // des coins (invitation à la visite, boussole, radio) ; devant l'étrave, le mât la couvrirait
  // et les jouets du terrain de jeu aussi.
  {
    lines: ['clique sur la mer', 'pour naviguer'],
    touchLines: ['touche la mer', 'pour naviguer'],
    at: fromStart(-6, 0),
    heading: START_HEADING,
    width: 10,
    reach: 70,
    needsRoom: true,
  },
  { lines: ['7 étoiles d’or', 'se cachent dans l’archipel'], at: [-6, -30], heading: 0.671, width: 17, reach: 55 },
  { lines: ['mes îlots de personnalité'], at: [-24, -24], heading: outward(-24, -24), width: 17, arrow: 'left', reach: 55 },
  { lines: ['on se parle\u202f?'], at: [32, -66], heading: outward(32, -66), width: 11, arrow: 'right', reach: 50 },
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
    // Faites pour la navigation : à quai, la caméra est trop près pour les lire.
    const sailing = phase === 'playing';
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
  // Au doigt, la consigne dit « touche » plutôt que « clique » (connu dès le premier rendu).
  const [touch] = useState(isCoarsePointer);
  // Téléphone à l'horizontale : sous le bateau, la rangée du dock ; autour, l'invitation et le
  // mot d'accueil. La consigne du départ y est déjà dite par l'écran d'accueil : elle se tait.
  const lowLandscape = useThree((state) => state.size.height <= 520 && state.size.width > state.size.height);
  const notes = useMemo(
    () =>
      NOTES.filter((note) => !(note.needsRoom && lowLandscape)).map((note) =>
        touch && note.touchLines ? { ...note, lines: note.touchLines } : note,
      ),
    [lowLandscape, touch],
  );

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
      {notes.map((note, index) => (
        <SeaNote key={index} note={note} family={family} />
      ))}
    </group>
  );
}
