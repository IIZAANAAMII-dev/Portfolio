'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { GEAR_MATERIAL, MARK_GEOMETRY, RING_GEOMETRY, RING_MATERIAL } from './models';
import { COURSE, MARKS, useRegatta, type RacePhase } from './regatta';
import { seaFx } from './SeaFx';

/**
 * Les marques de la régate : la marque de départ flotte toujours près du port d'attache ;
 * les cinq autres montent de l'eau quand la régate est lancée et y retournent ensuite. La
 * prochaine marque porte un anneau d'écume lumineux qui bat ; chaque passage éclabousse.
 * Deux draw calls (six marques instanciées, un anneau).
 */

const dummy = new Object3D();
const tint = new Color();
const shown = { value: 0 };
const last = { phase: 'off' as RacePhase, leg: 0 };

export function Regatta() {
  const marks = useRef<InstancedMesh>(null);
  const ring = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    ring.current?.setColorAt(0, tint.setRGB(0, 0, 0));
  }, []);

  useFrame((state, delta) => {
    const markMesh = marks.current;
    const ringMesh = ring.current;
    if (!markMesh || !ringMesh) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const race = useRegatta.getState();
    const reduced = useWorld.getState().reducedMotion;
    const active = race.phase === 'armed' || race.phase === 'racing';
    const goal = active || race.phase === 'finished' ? 1 : 0;
    shown.value = reduced ? goal : damp(shown.value, goal, 2.2, dt);

    // Passage d'une marque (ou arrivée) : gerbe d'écume sur la marque franchie.
    if (race.phase !== last.phase || race.leg !== last.leg) {
      const passed = (race.phase === 'racing' && (last.phase === 'armed' || race.leg > last.leg)) || race.phase === 'finished';
      if (passed) {
        const [x, z] = MARKS[COURSE[Math.max(0, race.phase === 'finished' ? COURSE.length - 1 : race.leg - 1)]];
        seaFx.splash(x, z, 0.85);
      }
      last.phase = race.phase;
      last.leg = race.leg;
    }

    const next = active ? COURSE[race.leg] : -1;
    for (let index = 0; index < MARKS.length; index++) {
      const [x, z] = MARKS[index];
      const rise = index === 0 ? 1 : shown.value;
      const h = waveHeight(x, z, time);
      dummy.position.set(x, h - 0.2 - (1 - rise) * 3.2, z);
      dummy.rotation.set(
        reduced ? 0 : Math.sin(time * 1.1 + index * 1.7) * 0.07,
        index * 1.9,
        reduced ? 0 : Math.sin(time * 0.9 + index * 2.3) * 0.07,
      );
      dummy.scale.setScalar(Math.max(rise, 0.001) * (index === next ? 1.18 : 1));
      dummy.updateMatrix();
      markMesh.setMatrixAt(index, dummy.matrix);
    }
    markMesh.instanceMatrix.needsUpdate = true;

    if (next >= 0) {
      const [x, z] = MARKS[next];
      const pulse = reduced ? 0.5 : 0.5 + Math.sin(time * 3.2) * 0.5;
      dummy.position.set(x, waveHeight(x, z, time) + 0.12, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(2.6 + pulse * 0.5, 1, 2.6 + pulse * 0.5);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(0, dummy.matrix);
      const light = 0.55 + pulse * 0.45;
      ringMesh.setColorAt(0, tint.setRGB(light, light * 0.82, light * 0.45));
      ringMesh.visible = true;
      ringMesh.instanceMatrix.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    } else {
      ringMesh.visible = false;
    }
  });

  return (
    <>
      <instancedMesh
        ref={marks}
        args={[MARK_GEOMETRY, GEAR_MATERIAL, MARKS.length]}
        frustumCulled={false}
        castShadow={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={ring}
        args={[RING_GEOMETRY, RING_MATERIAL, 1]}
        visible={false}
        frustumCulled={false}
        renderOrder={5}
        raycast={() => null}
      />
    </>
  );
}
