'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { Pieces, pose } from '@/components/islands/docks/parts';
import { PAINTED } from '@/components/islands/docks/planks';
import { Hotspot } from '@/components/islands/kit';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { ripple } from '../Flotsam';

/**
 * Bouées bavardes : cinq balises le long des routes de l'archipel. Elles dansent sur la
 * houle, leur feu clignote la nuit, et une petite bulle « … » flotte au-dessus de celles
 * qu'on n'a pas encore écoutées. Un clic : la bouée se trémousse et souffle un indice dans
 * une bulle de papier (tampon « Bouée bavarde »).
 */

type Mark = 'can' | 'cone' | 'cross' | 'sphere';

interface BuoySpec {
  at: [number, number];
  hue: string;
  band: string;
  lamp: string;
  mark: Mark;
  hint: string;
}

/** Positions : à quelques mètres des routes habituelles, loin des côtes (voir navigation). */
const BUOYS: BuoySpec[] = [
  { at: [13, -20], hue: '#d9483b', band: '#f5efe3', lamp: '#ff5a4a', mark: 'can', hint: 'Ouvre ton carnet de bord : chaque île a son tampon.' },
  { at: [-20, -3], hue: '#2f9a6e', band: '#f5efe3', lamp: '#5dff9a', mark: 'cone', hint: 'La maison bretonne cache un atelier.' },
  { at: [36, 20], hue: '#f2c14e', band: '#2f343c', lamp: '#ffd36a', mark: 'cross', hint: 'Psst… quelque chose grésille dans la brume, au sud-est.' },
  { at: [-2, 28], hue: '#d9483b', band: '#f5efe3', lamp: '#ffffff', mark: 'sphere', hint: 'Un vieux chalutier s’est échoué quelque part…' },
  { at: [-31, 6], hue: '#2f9a6e', band: '#f2c14e', lamp: '#5dff9a', mark: 'can', hint: 'Les étoiles d’or brillent aussi la nuit.' },
];

/** Bouées déjà écoutées pendant la visite (la bulle « … » disparaît). */
const heard = new Set<number>();

function buoyGeometry(spec: BuoySpec) {
  const parts = new Pieces();
  // Flotteur : coque arrondie, bande claire, liston sombre.
  parts.add(new CylinderGeometry(0.62, 0.5, 0.55, 14), spec.hue, pose([0, 0.0, 0]), 0.12);
  parts.add(new SphereGeometry(0.5, 14, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), spec.hue, pose([0, -0.27, 0]));
  parts.add(new TorusGeometry(0.62, 0.06, 5, 20), '#2f343c', pose([0, 0.28, 0], [Math.PI / 2, 0, 0]));
  parts.add(new CylinderGeometry(0.6, 0.6, 0.06, 14), '#3a3f47', pose([0, 0.3, 0]));
  // Pylône : trois montants, bandes de couleur, plateforme.
  parts.add(new CylinderGeometry(0.28, 0.42, 0.5, 12), spec.hue, pose([0, 0.58, 0]), 0.1);
  parts.add(new CylinderGeometry(0.24, 0.28, 0.42, 12), spec.band, pose([0, 1.04, 0]), 0.1);
  parts.add(new CylinderGeometry(0.2, 0.24, 0.36, 12), spec.hue, pose([0, 1.43, 0]), 0.1);
  parts.add(new CylinderGeometry(0.3, 0.3, 0.05, 12), '#2f343c', pose([0, 1.63, 0]));
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
    parts.add(new BoxGeometry(0.03, 0.34, 0.03), '#2f343c', pose([Math.cos(angle) * 0.2, 1.82, Math.sin(angle) * 0.2]));
  }
  parts.add(new ConeGeometry(0.26, 0.16, 8), '#2f343c', pose([0, 2.06, 0]));
  // Voyant de tête (la marque de la balise).
  if (spec.mark === 'can') parts.add(new CylinderGeometry(0.13, 0.13, 0.26, 10), spec.hue, pose([0, 2.36, 0]));
  if (spec.mark === 'cone') parts.add(new ConeGeometry(0.17, 0.32, 10), spec.hue, pose([0, 2.36, 0]));
  if (spec.mark === 'sphere') parts.add(new SphereGeometry(0.15, 10, 8), spec.hue, pose([0, 2.36, 0]));
  if (spec.mark === 'cross') {
    parts.add(new BoxGeometry(0.06, 0.36, 0.06), spec.hue, pose([0, 2.38, 0], [0, 0, Math.PI / 4]));
    parts.add(new BoxGeometry(0.06, 0.36, 0.06), spec.hue, pose([0, 2.38, 0], [0, 0, -Math.PI / 4]));
  }
  parts.add(new CylinderGeometry(0.02, 0.02, 0.2, 4), '#2f343c', pose([0, 2.18, 0]));
  return parts.build()!;
}

/** Petite bulle « … » (papier, trois points d'encre). */
function chatterGeometry() {
  const parts = new Pieces();
  parts.add(new SphereGeometry(0.34, 14, 8), '#f6efe0', pose([0, 0, 0], [0, 0, 0], [1.25, 0.82, 0.42]));
  parts.add(new ConeGeometry(0.1, 0.22, 4), '#f6efe0', pose([-0.16, -0.27, 0], [0, 0, 0.5], [1, 1, 0.5]));
  for (const x of [-0.15, 0, 0.15]) parts.add(new SphereGeometry(0.05, 8, 5), '#3b2f25', pose([x, 0.01, 0.13]));
  return parts.build()!;
}

const LAMP_GEOMETRY = new SphereGeometry(0.12, 12, 8);
/** Un feu par bouée (chacune clignote à son rythme). */
const LAMPS = BUOYS.map((spec) => new MeshStandardMaterial({ color: spec.lamp, emissive: new Color(spec.lamp), emissiveIntensity: 0.4, roughness: 0.3 }));

function HintBubble({ text, onDone }: { text: string; onDone: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = card.current;
    element?.animate(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.6)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', fill: 'both' },
    );
    const fade = setTimeout(() => {
      element?.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-8px) scale(0.92)' },
        ],
        { duration: 380, easing: 'ease-in', fill: 'both' },
      );
    }, 5600);
    const done = setTimeout(onDone, 6000);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);
  return (
    <div style={{ transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <div
        ref={card}
        role="status"
        style={{
          position: 'relative',
          width: 'max-content',
          maxWidth: '15.5rem',
          padding: '0.55rem 1rem 0.7rem',
          borderRadius: '18px',
          background: '#f6efe0',
          color: '#3b2f25',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
          textAlign: 'center',
          transformOrigin: '50% 100%',
        }}
      >
        <span
          style={{
            display: 'block',
            marginBottom: '0.15rem',
            fontSize: '0.6rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(59, 47, 37, 0.55)',
          }}
        >
          Bouée bavarde
        </span>
        <span style={{ display: 'block', fontFamily: 'var(--font-caveat), cursive', fontSize: '1.45rem', fontWeight: 500, lineHeight: 1.05 }}>
          {text}
        </span>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '-7px',
            width: '16px',
            height: '16px',
            background: '#f6efe0',
            borderRadius: '3px',
            transform: 'translateX(-50%) rotate(45deg)',
          }}
        />
      </div>
    </div>
  );
}

function Buoy({ spec, index, talking, onTalk }: { spec: BuoySpec; index: number; talking: boolean; onTalk: (index: number) => void }) {
  const geometry = useMemo(() => buoyGeometry(spec), [spec]);
  const chatter = useMemo(() => chatterGeometry(), []);
  const group = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const body = useRef<Group>(null);
  const bubble = useRef<Group>(null);
  const lampMesh = useRef<Group>(null);
  const talkedAt = useRef(-100);
  const clock = useThree((state) => state.clock);
  const close = useCallback(() => onTalk(-1), [onTalk]);
  const [x, z] = spec.at;

  useEffect(() => () => {
    geometry.dispose();
    chatter.dispose();
  }, [chatter, geometry]);

  useFrame((state) => {
    const target = group.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    const { introCenter, introRadius } = useWorld.getState();
    // Apparition au passage du cercle d'intro, comme les îles.
    const d = Math.hypot(x - introCenter[0], z - introCenter[1]);
    const reveal = smoothstep(d - 4.5, d, introRadius);
    target.visible = reveal > 0.01;
    if (!target.visible) return;
    target.scale.setScalar(reveal);
    // Houle : hauteur et inclinaison suivent la surface.
    const h = waveHeight(x, z, time);
    const hx = waveHeight(x + 0.8, z, time) - waveHeight(x - 0.8, z, time);
    const hz = waveHeight(x, z + 0.8, time) - waveHeight(x, z - 0.8, time);
    target.position.set(x, h * 0.9 + Math.sin(time * 1.9 + index) * 0.04, z);
    if (rocker.current) {
      rocker.current.rotation.set(hz * 0.55 + Math.sin(time * 1.3 + index) * 0.05, index * 1.7, -hx * 0.55 + Math.sin(time * 1.1 + index * 2) * 0.05);
    }
    // Trémoussement quand elle parle.
    const since = time - talkedAt.current;
    if (body.current) {
      const wiggle = since < 2.4 ? Math.sin(since * 16) * Math.exp(-since * 1.6) : 0;
      body.current.scale.set(1 - wiggle * 0.06, 1 + wiggle * 0.1, 1 - wiggle * 0.06);
      body.current.rotation.y = wiggle * 0.25;
    }
    // Feu : éclat bref toutes les ~2,6 s (décalé par bouée), plus fort la nuit.
    const night = skyState.dayNight;
    const flash = ((time + index * 0.61) % 2.6) < 0.45 ? 1 : 0;
    LAMPS[index].emissiveIntensity = 0.25 + night * (0.4 + flash * 3.4) + (1 - night) * flash * 0.5;
    if (lampMesh.current) lampMesh.current.scale.setScalar(1 + flash * night * 0.25);
    // Bulle « … » au-dessus des bouées pas encore écoutées.
    if (bubble.current) {
      bubble.current.visible = !heard.has(index) && !talking;
      bubble.current.position.y = 3.35 + Math.sin(time * 2.2 + index) * 0.12;
      // Toujours de face pour la caméra (rotation autour de la verticale seulement).
      bubble.current.rotation.y = Math.atan2(state.camera.position.x - x, state.camera.position.z - z);
      const pulse = 1 + Math.sin(time * 3.1 + index) * 0.05;
      bubble.current.scale.setScalar(pulse);
    }
  });

  const talk = () => {
    talkedAt.current = clock.elapsedTime;
    heard.add(index);
    ripple(x, z, clock.elapsedTime, 1.1);
    onTalk(index);
    ambience.cue(720 + index * 40, 0.12);
    ambience.cue(960 + index * 40, 0.16);
    logbook.stamp('buoy');
  };

  return (
    <group ref={group} visible={false}>
      <group ref={rocker}>
        <Hotspot onActivate={talk} hoverScale={1.08}>
          <group ref={body}>
            <mesh geometry={geometry} material={PAINTED} castShadow />
            <group ref={lampMesh} position={[0, 1.82, 0]}>
              <mesh geometry={LAMP_GEOMETRY} material={LAMPS[index]} />
            </group>
          </group>
          <mesh position={[0, 1.2, 0]} visible={false}>
            <cylinderGeometry args={[0.85, 0.85, 3.2, 8]} />
          </mesh>
        </Hotspot>
      </group>
      <group ref={bubble} position={[0, 3.35, 0]}>
        <mesh geometry={chatter} material={PAINTED} position={[0.15, 0, 0]} raycast={() => null} />
      </group>
      {talking && (
        <Html position={[0, 3.3, 0]} center zIndexRange={[25, 10]} style={{ pointerEvents: 'none' }}>
          <HintBubble text={spec.hint} onDone={close} />
        </Html>
      )}
    </group>
  );
}

export function HintBuoys() {
  const [talking, setTalking] = useState(-1);
  return (
    <>
      {BUOYS.map((spec, index) => (
        <Buoy key={index} spec={spec} index={index} talking={talking === index} onTalk={setTalking} />
      ))}
    </>
  );
}
