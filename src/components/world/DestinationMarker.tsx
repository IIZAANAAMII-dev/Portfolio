'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { boatState } from '@/lib/boat-state';
import { computePath, pushOutOfLand } from '@/lib/navigation';
import { dockPosition, useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import type { Vec2 } from '@/types';

/**
 * Retour visuel du geste principal : là où le visiteur a cliqué, un anneau pulse sur
 * l'eau et une petite bouée-fanion attend le bateau ; entre les deux, un pointillé de
 * bouées miniatures dessine la route prévue (qui contourne les îles). Les points
 * disparaissent à mesure que le bateau avance.
 */

const DOTS = 48;
const SPACING = 2.6;

export function DestinationMarker() {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const echo = useRef<Mesh>(null);
  const flag = useRef<Group>(null);
  const dots = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const route = useRef<{ key: string; points: Vec2[]; refreshed: number }>({ key: '', points: [], refreshed: 0 });

  useFrame((state) => {
    const root = group.current;
    if (!root) return;
    const time = state.clock.elapsedTime;
    const { phase, destination, freeTarget } = useWorld.getState();
    const goal: Vec2 | null = phase !== 'playing'
      ? null
      : destination
        ? dockPosition(destination)
        : freeTarget
          ? pushOutOfLand(freeTarget)
          : null;
    root.visible = goal !== null;
    if (!goal) {
      route.current.key = '';
      return;
    }

    // Route : recalculée quand la cible change, puis rafraîchie depuis le bateau.
    const key = `${goal[0].toFixed(1)}|${goal[1].toFixed(1)}`;
    const r = route.current;
    if (r.key !== key || time - r.refreshed > 0.6) {
      r.key = key;
      r.refreshed = time;
      r.points = computePath([boatState.position.x, boatState.position.z], goal);
    }

    // Repère d'arrivée : anneau qui pulse, écho qui s'élargit, fanion qui flotte.
    const wave = waveHeight(goal[0], goal[1], time);
    const pulse = (time * 0.9) % 1;
    if (ring.current) {
      ring.current.position.set(goal[0], wave + 0.16, goal[1]);
      ring.current.scale.setScalar(1.6 + Math.sin(time * 3) * 0.12);
    }
    if (echo.current) {
      echo.current.position.set(goal[0], wave + 0.15, goal[1]);
      echo.current.scale.setScalar(1.6 + pulse * 3.2);
      (echo.current.material as MeshBasicMaterial).opacity = (1 - pulse) * 0.55;
    }
    if (flag.current) {
      flag.current.position.set(goal[0], wave + Math.sin(time * 2.2) * 0.12, goal[1]);
      flag.current.rotation.set(Math.sin(time * 1.7) * 0.08, time * 0.6, Math.cos(time * 1.4) * 0.08);
    }

    // Pointillé le long de la route, du bateau vers la cible.
    const mesh = dots.current;
    if (!mesh) return;
    let placed = 0;
    let carry = SPACING * 0.8;
    for (let segment = 0; segment < r.points.length - 1 && placed < DOTS; segment++) {
      const [ax, az] = r.points[segment];
      const [bx, bz] = r.points[segment + 1];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < carry) {
        carry -= length;
        continue;
      }
      for (let along = carry; along < length && placed < DOTS; along += SPACING) {
        const x = ax + ((bx - ax) * along) / length;
        const z = az + ((bz - az) * along) / length;
        // Les derniers mètres restent dégagés autour du repère.
        if (Math.hypot(goal[0] - x, goal[1] - z) < 2.4) continue;
        dummy.position.set(x, waveHeight(x, z, time) + 0.18, z);
        dummy.scale.setScalar(0.2 + Math.sin(time * 4 - placed * 0.5) * 0.04);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed += 1;
      }
      carry = SPACING - ((length - carry) % SPACING);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} renderOrder={8} raycast={() => null}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial color="#fff3d6" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={echo} rotation-x={-Math.PI / 2} renderOrder={8} raycast={() => null}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial color="#ffd28a" transparent opacity={0.5} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {/* Bouée-fanion : flotteur rouge et blanc, mât, petit fanion. */}
      <group ref={flag} raycast={() => null}>
        <mesh position-y={0.18} castShadow>
          <sphereGeometry args={[0.38, 14, 10]} />
          <meshStandardMaterial color="#e2553f" roughness={0.5} />
        </mesh>
        <mesh position-y={0.36}>
          <cylinderGeometry args={[0.39, 0.39, 0.12, 14]} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.5} />
        </mesh>
        <mesh position-y={1.05}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 5]} />
          <meshStandardMaterial color="#3b2f25" roughness={0.6} />
        </mesh>
        <mesh position={[0.26, 1.48, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.02]} />
          <meshStandardMaterial color="#ffd23f" roughness={0.6} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, DOTS]} frustumCulled={false} renderOrder={8} raycast={() => null}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#fff6e4" transparent opacity={0.85} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
