'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CylinderGeometry, Group, LatheGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import type { Vec3 } from '../../docks/parts';
import { Hotspot } from '../../kit';

/**
 * Cloche de bord en laiton, pendue à la potence de son poteau au pied du ponton. Un clic
 * la fait sonner : grande volée amortie, le battant suit avec un temps de retard et la
 * cloche retinte à chaque aller-retour, de plus en plus doucement. Tampon « Sonneur de
 * cloche » dans le carnet de bord.
 */

const BRASS = new MeshStandardMaterial({ color: '#dba842', roughness: 0.34, metalness: 0.32, emissive: '#3b2606', emissiveIntensity: 0.25 });
const IRON = new MeshStandardMaterial({ color: '#3a3f46', roughness: 0.6, metalness: 0.2 });
const ROPE = new MeshStandardMaterial({ color: '#efe2c0', roughness: 0.95, flatShading: true });

function bellGeometry() {
  // Profil tourné, de la couronne à la lèvre, puis l'intérieur (cloche fermée).
  const profile = [
    [0.0, 0.0], [0.075, 0.0], [0.095, -0.025], [0.122, -0.075], [0.14, -0.15], [0.15, -0.235],
    [0.168, -0.305], [0.205, -0.365], [0.243, -0.405], [0.252, -0.428], [0.225, -0.435],
    [0.19, -0.405], [0.15, -0.335], [0.12, -0.22], [0.0, -0.2],
  ].map(([x, y]) => new Vector2(x, y));
  const shell = new LatheGeometry(profile, 20);
  // Anneau de suspension et cordon de renfort.
  const crown = new TorusGeometry(0.05, 0.018, 6, 12).translate(0, 0.035, 0);
  const lip = new TorusGeometry(0.248, 0.012, 4, 24).rotateX(Math.PI / 2).translate(0, -0.42, 0);
  for (const part of [shell, crown, lip]) part.deleteAttribute('uv');
  const merged = mergeGeometries([shell.toNonIndexed(), crown.toNonIndexed(), lip.toNonIndexed()])!;
  merged.computeVertexNormals();
  return merged;
}

export function ShipBell({ pivot, yaw }: { pivot: Vec3; yaw: number }) {
  const swing = useRef<Group>(null);
  const clapper = useRef<Group>(null);
  const struck = useRef(-100);
  const chimes = useRef(0);
  const clock = useThree((state) => state.clock);
  const geometry = useMemo(() => bellGeometry(), []);
  const clapperRod = useMemo(() => new CylinderGeometry(0.012, 0.012, 0.3, 5).translate(0, -0.15, 0), []);
  const clapperBall = useMemo(() => new SphereGeometry(0.045, 10, 8), []);
  const lanyard = useMemo(() => new CylinderGeometry(0.018, 0.016, 0.36, 5).translate(0, -0.18, 0), []);
  const knot = useMemo(() => new SphereGeometry(0.036, 7, 5), []);

  useEffect(
    () => () => [geometry, clapperRod, clapperBall, lanyard, knot].forEach((item) => item.dispose()),
    [clapperBall, clapperRod, geometry, knot, lanyard],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const since = time - struck.current;
    // Volée amortie ; au repos, la brise la balance à peine.
    const ringing = since < 9;
    const angle = ringing ? Math.sin(since * 3.4) * 0.5 * Math.exp(-since * 0.42) : Math.sin(time * 0.9) * 0.025;
    if (swing.current) swing.current.rotation.z = angle;
    // Le battant traîne derrière la cloche puis la rattrape (et la frappe).
    if (clapper.current) {
      clapper.current.rotation.z = ringing
        ? -Math.sin(since * 3.4 - 0.55) * 0.42 * Math.exp(-since * 0.42)
        : Math.sin(time * 0.9 - 0.6) * 0.03;
    }
    const swingIndex = Math.floor((since * 3.4) / Math.PI);
    if (since < 6 && swingIndex > chimes.current && swingIndex % 2 === 0) {
      chimes.current = swingIndex;
      ambience.bell(Math.exp(-since * 0.5));
    }
  });

  const ring = () => {
    struck.current = clock.elapsedTime;
    chimes.current = 1;
    ambience.bell();
    logbook.stamp('bell');
  };

  return (
    <group position={pivot} rotation-y={yaw}>
      <Hotspot onActivate={ring} hoverScale={1.1}>
        <group ref={swing}>
          <mesh geometry={geometry} material={BRASS} castShadow />
          <group ref={clapper} position={[0, -0.12, 0]}>
            <mesh geometry={clapperRod} material={IRON} />
            <mesh geometry={clapperBall} material={IRON} position={[0, -0.3, 0]} />
            <group position={[0, -0.33, 0]}>
              <mesh geometry={lanyard} material={ROPE} />
              <mesh geometry={knot} material={ROPE} position={[0, -0.37, 0]} />
            </group>
          </group>
          {/* Volume de clic généreux (invisible) : la cloche est petite. */}
          <mesh position={[0, -0.3, 0]} visible={false}>
            <cylinderGeometry args={[0.36, 0.36, 0.9, 8]} />
          </mesh>
        </group>
      </Hotspot>
    </group>
  );
}
