'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { ambience } from '@/lib/audio/ambience';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { bevelBox, glowTexture, Pieces, pose, type Vec3 } from '../../docks/parts';
import { LIGHT_POOL_GEOMETRY, PAINTED } from '../../docks/planks';
import { Hotspot } from '../../kit';

/**
 * LA boîte aux lettres de l'île (générique, sans marque) : c'est l'appel à l'action du site.
 * Grosse, rouge, drapeau jaune levé (« du courrier à envoyer ! »), une enveloppe lumineuse
 * flotte au-dessus et une lueur chaude l'entoure. Au clic : le drapeau rebondit, la porte
 * s'ouvre, l'enveloppe plonge dans la fente et le formulaire « bouteille à la mer » du
 * panneau Contact s'ouvre.
 *
 * Repère : origine au pied du poteau, porte vers +Z, drapeau sur le flanc -X.
 */

const RED = '#de4a36';
const TRIM = '#b23a2b';
/** Hauteur du dessous de la boîte (repère non mis à l'échelle). */
const POST = 0.82;

function mailboxGeometries() {
  const post = new Pieces();
  post.add(new BoxGeometry(0.42, 0.12, 0.42), '#c9bcae', pose([0, 0.02, -0.04]), 0.15);
  post.add(bevelBox(0.14, POST, 0.14, 0.02), '#7a5236', pose([0, POST / 2, -0.04]), 0.15);
  post.add(new BoxGeometry(0.13, 0.08, 0.5), '#7a5236', pose([0, POST - 0.03, 0]), 0.15);
  post.add(new BoxGeometry(0.06, 0.32, 0.06), '#6a4630', pose([0, POST - 0.22, 0.14], [0.75, 0, 0]), 0.15);

  const body = new Pieces();
  body.add(new BoxGeometry(0.36, 0.26, 0.6), RED, pose([0, 0.13, 0]), 0.1);
  body.add(new CylinderGeometry(0.18, 0.18, 0.6, 16, 1, false, Math.PI / 2, Math.PI), RED, pose([0, 0.26, 0], [Math.PI / 2, 0, 0]), 0.06);
  // Fond et ourlets plus sombres, plaque crème, fente du dos.
  body.add(new BoxGeometry(0.38, 0.04, 0.62), TRIM, pose([0, 0.01, 0]));
  body.add(new BoxGeometry(0.39, 0.03, 0.03), TRIM, pose([0, 0.26, -0.28]));
  body.add(new BoxGeometry(0.012, 0.11, 0.2), '#f6efe0', pose([0.186, 0.17, 0.02]));
  body.add(new BoxGeometry(0.03, 0.06, 0.06), '#e8e2d6', pose([-0.195, 0.14, -0.12]));

  const door = new Pieces();
  door.add(new BoxGeometry(0.37, 0.27, 0.025), TRIM, pose([0, 0.135, 0.012]));
  door.add(new CylinderGeometry(0.185, 0.185, 0.025, 16, 1, false, Math.PI / 2, Math.PI), TRIM, pose([0, 0.27, 0.012], [Math.PI / 2, 0, 0]));
  door.add(new BoxGeometry(0.1, 0.03, 0.04), '#e8e2d6', pose([0, 0.36, 0.035]));

  const flag = new Pieces();
  flag.add(new BoxGeometry(0.024, 0.36, 0.024), '#f6c544', pose([0, 0.18, 0]));
  flag.add(new BoxGeometry(0.02, 0.13, 0.19), '#f6c544', pose([0, 0.3, 0.095]), 0.05);

  const letter = new Pieces();
  letter.add(new BoxGeometry(0.24, 0.012, 0.17), '#fbf6ea', pose([0, 0, 0]));
  letter.add(new BoxGeometry(0.035, 0.015, 0.035), RED, pose([0, 0.004, 0.02], [0, Math.PI / 4, 0]));

  // Enveloppe flottante : papier crème, rabat, cachet de cire rouge.
  const envelope = new Pieces();
  envelope.add(new BoxGeometry(0.36, 0.24, 0.035), '#fbf6ea', pose([0, 0, 0]), 0.06);
  envelope.add(new ConeGeometry(0.205, 0.13, 3), '#efe2c6', pose([0, 0.055, 0.02], [0, 0, Math.PI], [1, 1, 0.12]));
  envelope.add(new SphereGeometry(0.034, 8, 6), RED, pose([0, -0.005, 0.03], [0, 0, 0], [1, 1, 0.5]));

  return {
    post: post.build()!,
    body: body.build()!,
    door: door.build()!,
    flag: flag.build()!,
    letter: letter.build()!,
    envelope: envelope.build()!,
  };
}

/** Ressort amorti : rebond « dessin animé » du drapeau et de la porte. */
function spring(state: { value: number; velocity: number }, target: number, stiffness: number, damping: number, dt: number) {
  state.velocity += ((target - state.value) * stiffness - state.velocity * damping) * dt;
  state.value += state.velocity * dt;
  return state.value;
}

const ENVELOPE = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#fff1d6', emissiveIntensity: 0.35, flatShading: true });
const HALO = new SpriteMaterial({ map: glowTexture(), color: '#ffd9a0', transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.5 });
const GROUND = new ShaderMaterial({
  uniforms: { uStrength: { value: 0.2 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float a = 1.0 - smoothstep(0.15, 1.0, d);
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.45), a * a * uStrength);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
});

export function Mailbox({ position, yaw, scale = 1.7 }: { position: Vec3; yaw: number; scale?: number }) {
  const geometries = useMemo(() => mailboxGeometries(), []);
  const flag = useRef<Group>(null);
  const door = useRef<Group>(null);
  const letter = useRef<Group>(null);
  const box = useRef<Group>(null);
  const envelope = useRef<Group>(null);
  const halo = useRef<Sprite>(null);
  const motion = useRef({
    flag: { value: 0, velocity: 0 },
    door: { value: 0, velocity: 0 },
    hop: { value: 0, velocity: 0 },
    openedAt: -100,
  });
  const clock = useThree((state) => state.clock);

  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const m = motion.current;
    const since = time - m.openedAt;
    // Drapeau levé ; il s'agite toutes les quelques secondes comme pour faire signe.
    const wave = time % 6.5;
    const flagTarget = wave > 5.6 ? -0.35 * Math.sin((wave - 5.6) * 14) : 0;
    const flagAngle = spring(m.flag, flagTarget, 140, 7.5, dt);
    const doorAngle = spring(m.door, since < 4.2 ? 1.05 : 0, 90, 9, dt);
    const hop = spring(m.hop, 0, 160, 10, dt);
    if (flag.current) flag.current.rotation.x = flagAngle;
    if (door.current) door.current.rotation.x = doorAngle;
    if (box.current) {
      box.current.position.y = POST + Math.max(0, hop) * 0.12;
      box.current.rotation.z = hop * 0.08;
    }
    if (letter.current) {
      const out = Math.min(1, Math.max(0, doorAngle / 1.05));
      letter.current.position.z = 0.12 + out * 0.24;
      letter.current.position.y = 0.1 + out * 0.03 + Math.sin(time * 6) * 0.004 * out;
      letter.current.rotation.x = out * 0.25;
      letter.current.visible = out > 0.05;
    }
    // L'enveloppe flotte, tourne doucement ; au clic elle plonge dans la boîte, puis revient.
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    if (envelope.current) {
      const dive = since < 0.9 ? since / 0.9 : 0;
      const back = since >= 0.9 && since < 3.2 ? 0 : since >= 3.2 && since < 4.2 ? (since - 3.2) / 1.0 : 1;
      const shown = since < 0.9 ? 1 - dive * dive : back;
      envelope.current.position.y = POST + 0.78 + Math.sin(time * 1.8) * 0.05 - (since < 0.9 ? dive * 0.45 : 0);
      envelope.current.rotation.set(0.12, Math.sin(time * 0.9) * 0.6, Math.sin(time * 1.3) * 0.08);
      envelope.current.scale.setScalar(Math.max(0.001, shown));
    }
    ENVELOPE.emissiveIntensity = 0.3 + night * 0.9 + pulse * 0.15;
    HALO.opacity = (0.32 + night * 0.45) * (0.8 + pulse * 0.2);
    GROUND.uniforms.uStrength.value = 0.16 + night * 0.38 + pulse * 0.04;
    if (halo.current) {
      halo.current.position.y = POST + 0.78 + Math.sin(time * 1.8) * 0.05;
      halo.current.scale.setScalar(0.95 + pulse * 0.12);
    }
  });

  const open = () => {
    const m = motion.current;
    m.openedAt = clock.elapsedTime;
    m.hop.velocity = 3.2;
    m.flag.velocity = -9;
    ambience.bump('wood', 0.55);
    ambience.chime([988, 1319, 1568], 0.08);
    focusItem('contact', null);
  };

  return (
    <group position={position} rotation-y={yaw}>
      <mesh geometry={LIGHT_POOL_GEOMETRY} material={GROUND} position-y={0.06} scale={0.85} renderOrder={4} raycast={() => null} />
      <group scale={scale}>
        <mesh geometry={geometries.post} material={PAINTED} castShadow raycast={() => null} />
        <sprite ref={halo} material={HALO} position={[0, POST + 0.78, 0]} raycast={() => null} />
        <Hotspot onActivate={open} hoverScale={1.08}>
          <group ref={box} position-y={POST}>
            <mesh geometry={geometries.body} material={PAINTED} castShadow />
            <group ref={door} position={[0, 0, 0.3]}>
              <mesh geometry={geometries.door} material={PAINTED} castShadow />
            </group>
            <group ref={flag} position={[-0.21, 0.12, -0.12]}>
              <mesh geometry={geometries.flag} material={PAINTED} castShadow />
            </group>
            <group ref={letter} visible={false}>
              <mesh geometry={geometries.letter} material={PAINTED} />
            </group>
          </group>
          <group ref={envelope} position-y={POST + 0.78}>
            <mesh geometry={geometries.envelope} material={ENVELOPE} />
          </group>
          {/* Volume de clic généreux (invisible) : boîte, poteau et enveloppe. */}
          <mesh position-y={POST * 0.75 + 0.3} visible={false}>
            <cylinderGeometry args={[0.45, 0.45, POST * 1.5 + 0.6, 8]} />
          </mesh>
        </Hotspot>
      </group>
    </group>
  );
}
