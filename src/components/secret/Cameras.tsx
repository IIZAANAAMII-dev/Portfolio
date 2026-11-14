'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, CylinderGeometry, Group, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { Hotspot } from '@/components/islands/kit';
import { ambience } from '@/lib/audio/ambience';
import { merge, part } from './geo';
import { GLOW, setGlow } from './Glows';
import { CAMERAS, restSite } from './layout';
import { useStaticDossier } from './static-store';

/**
 * Caméras de surveillance sur poteaux : elles balaient lentement la cour, diode rouge
 * allumée. Un clic sur l'une d'elles « rembobine la bande » : le dossier s'ouvre.
 */

const HOUSING = '#d7d8d0';
const METAL = '#8a8e90';

function poleGeometry() {
  return merge(
    CAMERAS.flatMap((camera) => {
      const y = restSite(camera.x, camera.z, 0.25);
      return [
        part(new CylinderGeometry(0.055, 0.075, camera.height, 7), METAL, { at: [camera.x, y + camera.height / 2, camera.z] }),
        part(new BoxGeometry(0.2, 0.26, 0.12), '#bfc0b8', { at: [camera.x, y + 1.25, camera.z + 0.08] }),
        part(new CylinderGeometry(0.11, 0.11, 0.05, 8), METAL, { at: [camera.x, y + camera.height + 0.02, camera.z] }),
      ];
    }),
  );
}

/** Tête de caméra : boîtier, visière, objectif vers +Z. Origine sur le pivot. */
function headGeometry() {
  return merge([
    part(new CylinderGeometry(0.035, 0.035, 0.16, 6), METAL, { at: [0, 0.08, 0] }),
    part(new BoxGeometry(0.2, 0.19, 0.46), HOUSING, { at: [0, 0.24, 0.06] }),
    part(new BoxGeometry(0.25, 0.03, 0.56), '#bdbeb5', { at: [0, 0.35, 0.09] }),
    part(new CylinderGeometry(0.07, 0.07, 0.04, 12), '#1a1c1d', { at: [0, 0.24, 0.3], rot: [Math.PI / 2, 0, 0] }),
    part(new SphereGeometry(0.05, 10, 6), '#30484e', { at: [0, 0.24, 0.31], scale: [1, 1, 0.5] }),
    part(new BoxGeometry(0.12, 0.08, 0.06), '#55585a', { at: [0, 0.22, -0.2] }),
  ]);
}

const RED = new Color('#ff2a22');
const ledPoint = new Vector3();

function SurveillanceCamera({ index }: { index: number }) {
  const spec = CAMERAS[index];
  const head = useRef<Group>(null);
  const base = useMemo(() => restSite(spec.x, spec.z, 0.25) + spec.height + 0.04, [spec]);
  const reveal = useStaticDossier((state) => state.reveal);

  useFrame((state) => {
    const group = head.current;
    if (!group) return;
    const time = state.clock.elapsedTime;
    // Balayage lent, avec de courts arrêts aux extrémités (comme un vrai moteur de tourelle).
    const swing = Math.sin(time * 0.32 + spec.seed * 2.1);
    const yaw = spec.base + Math.sign(swing) * Math.pow(Math.abs(swing), 0.55) * 0.75;
    group.rotation.set(0, yaw, 0);
    // Diode : à l'avant du boîtier, recalculée depuis le lacet (repère du site).
    ledPoint.set(0.075, 0.3, 0.26).applyAxisAngle(UP, yaw);
    const blink = Math.sin(time * 2.4 + spec.seed * 5) > 0.1 ? 1 : 0.1;
    setGlow(GLOW.camera + index, spec.x + ledPoint.x, base + ledPoint.y, spec.z + ledPoint.z, 0.3, RED, blink * 1.4, 0.6);
  });

  return (
    <Hotspot
      position={[spec.x, base, spec.z]}
      hoverScale={1.18}
      onActivate={() => {
        ambience.cue(1320, 0.08);
        reveal('camera');
      }}
    >
      <group ref={head}>
        <group rotation-x={-0.32}>
          <CameraHead />
        </group>
      </group>
      {/* Cible de clic généreuse : la caméra fait vingt centimètres. */}
      <mesh visible={false} position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.85, 8, 6]} />
      </mesh>
    </Hotspot>
  );
}

const UP = new Vector3(0, 1, 0);

let headKit: { geometry: ReturnType<typeof headGeometry>; material: MeshStandardMaterial } | null = null;
function cameraKit() {
  headKit ??= {
    geometry: headGeometry(),
    material: new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, flatShading: true }),
  };
  return headKit;
}

function CameraHead() {
  const kit = useMemo(() => cameraKit(), []);
  return <mesh geometry={kit.geometry} material={kit.material} castShadow />;
}

export function Cameras() {
  const poles = useMemo(() => poleGeometry(), []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }), []);
  useEffect(() => () => poles.dispose(), [poles]);
  return (
    <group>
      <mesh geometry={poles} material={material} castShadow receiveShadow />
      {CAMERAS.map((_, index) => (
        <SurveillanceCamera key={index} index={index} />
      ))}
    </group>
  );
}
