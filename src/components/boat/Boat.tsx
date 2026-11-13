'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D, PointLight } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION, INTRO_SPLASH_AT } from '@/lib/cinematic';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { damp } from '@/lib/utils/math';
import { MAX_SPEED, useBoatNavigation } from '@/hooks/useBoatNavigation';
import { Splash, triggerSplash } from './Splash';
import { Wake } from './Wake';
import { BOAT_FRAME, BoatModel } from './BoatModel';

const MAX_VISUAL_SPEED = MAX_SPEED;
/** Hauteur d'où tombe le bateau au clic d'intro (au-dessus du cadre de la caméra). */
const DROP_HEIGHT = 13;

/**
 * Chute d'intro : le bateau tombe du ciel (gravité constante), s'étire pendant la chute,
 * s'écrase à l'impact puis rebondit, amorti, comme un jouet qu'on pose dans l'eau.
 * Renvoie le décalage vertical, l'écrasement et l'inclinaison à appliquer.
 */
function dropPose(seconds: number) {
  const impact = INTRO_SPLASH_AT * INTRO_DURATION;
  if (seconds < impact) {
    const f = seconds / impact;
    return { y: DROP_HEIGHT * (1 - f * f), squash: -0.1 * f * f, pitch: -0.16 * f, roll: 0.06 * f };
  }
  const s = seconds - impact;
  const decay = Math.exp(-s * 3.1);
  return {
    // Le bateau s'enfonce d'abord (vitesse d'arrivée), puis remonte et oscille.
    y: -decay * Math.sin(s * 8.5) * 1.15,
    squash: 0.26 * Math.exp(-s * 6.5) * Math.cos(s * 15),
    pitch: decay * Math.sin(s * 6.2 + 0.4) * 0.13,
    roll: decay * Math.sin(s * 5.1 + 1.3) * 0.1,
  };
}

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
    const [ex, ey, ez] = BOAT_FRAME.exhaust;
    for (let index = 0; index < count; index++) {
      const life = (time * (0.34 + strength * 0.18) + index / count) % 1;
      // La fumée sort de la cheminée de la timonerie et file vers l'arrière avec la vitesse.
      dummy.position.set(
        ex - life * (0.5 + strength * 2.2),
        ey + life * (1.6 + (1 - strength) * 1.2),
        ez + Math.sin(index * 4.7 + time) * life * 0.4,
      );
      const scale = (0.08 + life * 0.5) * (0.5 + strength * 0.6);
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
      // L'étrave fend l'eau : l'écume naît à l'avant et glisse le long des flancs.
      dummy.position.set(
        BOAT_FRAME.bow * 0.82 - life * (BOAT_FRAME.bow + BOAT_FRAME.stern) * 0.78,
        0.04 + Math.sin(time * 2 + index) * 0.04,
        side * (BOAT_FRAME.halfBeam * (0.55 + Math.min(life * 3, 1) * 0.45) + life * 0.4),
      );
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
  const drop = useRef<Group>(null);
  const boatLight = useRef<PointLight>(null);
  const splashed = useRef(false);
  const quality = useWorld((state) => state.quality);

  useBoatNavigation();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { position, heading, speed } = boatState;
    const { phase, gameTransition } = useWorld.getState();
    // Avant le clic, il n'y a pas encore de bateau : il tombe dans l'anneau au départ.
    const waiting = phase === 'loading' || phase === 'intro';
    const dropping = phase === 'transitioning' && gameTransition * INTRO_DURATION < INTRO_SPLASH_AT * INTRO_DURATION + 2.2;
    const pose = dropping ? dropPose(gameTransition * INTRO_DURATION) : null;

    if (group.current) group.current.visible = !waiting;
    if (phase === 'transitioning' && !splashed.current && gameTransition >= INTRO_SPLASH_AT) {
      splashed.current = true;
      triggerSplash(time, position.x, position.z, 1);
      ambience.splash();
    }

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
      const heave = y + drift
        + Math.sin(time * 1.35) * Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.055
        + Math.sin(time * 2.35 + position.x * 0.08) * ecologyState.stormWaves * 0.12;
      group.current.position.x = position.x;
      // Pendant la chute, la position est imposée : un lissage la ferait traîner.
      group.current.position.y = pose
        ? heave + pose.y
        : damp(group.current.position.y, heave - swallowed * 5.4, 8, dt);
      group.current.position.z = position.z;
      group.current.rotation.y = -heading;
      const scale = damp(group.current.scale.x, 1 - swallowed * 0.42, 6, dt);
      group.current.scale.setScalar(scale);
    }

    if (drop.current) {
      const squash = pose?.squash ?? 0;
      drop.current.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      drop.current.rotation.set(pose?.roll ?? 0, 0, pose?.pitch ?? 0);
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
        (ahead - behind) * 0.34 * damping
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
          <group ref={drop}>
            <BoatModel />
          </group>
          <HullFoam />
          <ExhaustSmoke />
        </group>
      </group>
      <Wake />
      <Splash />
    </>
  );
}
