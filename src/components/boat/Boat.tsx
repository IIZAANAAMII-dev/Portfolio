'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D, PointLight } from 'three';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { damp } from '@/lib/utils/math';
import { MAX_SPEED, useBoatNavigation } from '@/hooks/useBoatNavigation';
import { Wake } from './Wake';
import { BoatModel } from './BoatModel';

const MAX_VISUAL_SPEED = MAX_SPEED;

function ExhaustSmoke() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = 9;

  useFrame((state) => {
    if (!mesh.current) return;
    const strength = Math.min(boatState.speed / MAX_VISUAL_SPEED, 1);
    mesh.current.visible = strength > 0.08 && useWorld.getState().quality !== 'low';
    if (!mesh.current.visible) return;
    const time = state.clock.elapsedTime;
    for (let index = 0; index < count; index++) {
      const life = (time * (0.34 + strength * 0.18) + index / count) % 1;
      dummy.position.set(
        -2.25 - life * (0.7 + strength * 1.3),
        2.75 + life * 3.1,
        Math.sin(index * 4.7 + time) * life * 0.45,
      );
      const scale = (0.12 + life * 0.62) * (0.5 + strength * 0.7);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.65, 0]} />
      <meshBasicMaterial color="#8c9799" transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
  );
}

function HullFoam() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = 12;
  useFrame((state) => {
    if (!mesh.current) return;
    const strength = Math.min(Math.max((boatState.speed - 0.5) / 7.5, 0), 1);
    mesh.current.visible = strength > 0.025;
    if (!mesh.current.visible) return;
    const time = state.clock.elapsedTime;
    for (let index = 0; index < count; index++) {
      const life = (time * (0.55 + strength * 0.65) + index / count) % 1;
      const side = index % 2 === 0 ? -1 : 1;
      dummy.position.set(1.25 - life * 3.15, -0.34 + Math.sin(time * 2 + index) * 0.04, side * (1.05 + life * 0.36));
      const scalar = (0.08 + life * 0.19) * (0.45 + strength);
      dummy.scale.set(scalar * 1.8, scalar * 0.35, scalar);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} renderOrder={6}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#dffcf2" transparent opacity={0.48} depthWrite={false} />
    </instancedMesh>
  );
}

export function Boat() {
  const group = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const boatLight = useRef<PointLight>(null);
  const quality = useWorld((state) => state.quality);

  useBoatNavigation();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { position, heading, speed } = boatState;
    const { phase, gameTransition } = useWorld.getState();
    const anticipation = phase === 'transitioning' && gameTransition < 0.09
      ? Math.sin((gameTransition / 0.09) * Math.PI) : 0;

    if (boatLight.current) {
      const silhouetteLight = Math.max(skyState.dayNight, ecologyState.stormCover * 0.52);
      boatLight.current.intensity = damp(boatLight.current.intensity, silhouetteLight * 18, 2, dt);
    }

    if (group.current) {
      const y = waveHeight(position.x, position.z, time);
      const drift = Math.sin(time * 0.74) * 0.16
        + Math.sin(time * 1.3 + 1.1) * 0.07
        + Math.sin(time * 2.1 + 2.5) * 0.03;
      const swallowed = ecologyState.leviathanAttack;
      const heave = y + drift + anticipation * 0.1
        + Math.sin(time * 1.35) * Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.055
        + Math.sin(time * 2.35 + position.x * 0.08) * ecologyState.stormWaves * 0.12;
      group.current.position.x = position.x;
      group.current.position.y = damp(group.current.position.y, heave - swallowed * 5.4, 8, dt);
      group.current.position.z = position.z;
      group.current.rotation.y = -heading;
      const scale = damp(group.current.scale.x, 1 - swallowed * 0.42, 6, dt);
      group.current.scale.setScalar(scale);
    }

    if (rocker.current) {
      const sampleDistance = 2.45;
      const ahead = waveHeight(
        position.x + Math.cos(heading) * sampleDistance,
        position.z + Math.sin(heading) * sampleDistance,
        time,
      );
      const behind = waveHeight(
        position.x - Math.cos(heading) * sampleDistance,
        position.z - Math.sin(heading) * sampleDistance,
        time,
      );
      const port = waveHeight(
        position.x - Math.sin(heading) * 1.05,
        position.z + Math.cos(heading) * 1.05,
        time,
      );
      const starboard = waveHeight(
        position.x + Math.sin(heading) * 1.05,
        position.z - Math.cos(heading) * 1.05,
        time,
      );
      const damping = 1 - Math.min(speed / 14, 0.5);
      rocker.current.rotation.z = damp(
        rocker.current.rotation.z,
        (ahead - behind) * 0.34 * damping - anticipation * 0.018
          + Math.sin(time * 1.13) * ecologyState.stormWind * 0.055
          + ecologyState.leviathanAttack * 0.72,
        4,
        dt,
      );
      rocker.current.rotation.x = damp(
        rocker.current.rotation.x,
        (port - starboard) * 0.52 * damping + boatState.collision * 0.08
          + Math.sin(time * 0.83 + 1.2) * ecologyState.stormWind * 0.075
          - ecologyState.leviathanAttack * 0.38,
        3,
        dt,
      );
    }
  });

  return (
    <>
      <group ref={group}>
        <group ref={rocker}>
          {quality !== 'low' && (
            <pointLight
              ref={boatLight}
              position={[0, 2.2, 0]}
              color="#fff4e6"
              intensity={0}
              distance={22}
              decay={1.8}
            />
          )}
          <BoatModel />
          <HullFoam />
          <ExhaustSmoke />
        </group>
      </group>
      <Wake />
    </>
  );
}
