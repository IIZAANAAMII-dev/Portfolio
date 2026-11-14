'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { Pieces, pose } from '@/components/islands/docks/parts';
import { PAINTED } from '@/components/islands/docks/planks';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { ripple } from '../Flotsam';

/**
 * Le vieux pêcheur du port : ciré et suroît jaunes, barbe blanche, assis au bord du ponton,
 * les bottes qui se balancent au-dessus de l'eau. Le bouchon danse sur la houle, frétille,
 * plonge : le pêcheur ferre, un poisson file en cloche jusqu'au seau, puis il relance.
 * Le chat, à côté, suit le poisson des yeux (`fishWatch`).
 *
 * Repère du pêcheur : origine au bord du plancher sous lui, il regarde vers +Z (la mer).
 */

const CYCLE = 17;
/** Poisson en vol et bouchon (lus par le chat pour les suivre du regard). */
export const fishWatch = { active: false, position: new Vector3(), float: new Vector3() };

const YELLOW = '#f2c230';
const NAVY = '#2d3e63';
const SKIN = '#f1c6a0';
const BOOT = '#2f3a35';

function fishermanGeometries() {
  const body = new Pieces();
  // Ciré jaune (buste un peu penché), boutons, col ; bassin et cuisses sur le plancher.
  body.add(new CylinderGeometry(0.17, 0.23, 0.5, 9), YELLOW, pose([0, 0.3, -0.16], [0.12, 0, 0]), 0.1);
  body.add(new SphereGeometry(0.17, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), YELLOW, pose([0, 0.54, -0.13]), 0.1);
  for (const y of [0.22, 0.34, 0.46]) body.add(new SphereGeometry(0.018, 5, 4), '#3a3a3a', pose([0, y, 0.05 - (y - 0.22) * 0.12]));
  body.add(new SphereGeometry(0.2, 9, 6), NAVY, pose([0, 0.08, -0.13], [0, 0, 0], [1.1, 0.55, 1]));
  for (const side of [-1, 1]) {
    body.add(new CylinderGeometry(0.075, 0.08, 0.4, 7), NAVY, pose([side * 0.1, 0.08, 0.08], [Math.PI / 2, 0, 0]), 0.1);
  }
  // Seau de pêche (et la queue d'une prise précédente), boîte à appâts.
  body.add(new CylinderGeometry(0.15, 0.12, 0.26, 10), '#7f93a3', pose([-0.5, 0.13, -0.3]), 0.12);
  body.add(new TorusGeometry(0.15, 0.015, 4, 14), '#5f7283', pose([-0.5, 0.26, -0.3], [Math.PI / 2, 0, 0]));
  body.add(new TorusGeometry(0.15, 0.008, 4, 10, Math.PI), '#4b5a66', pose([-0.5, 0.26, -0.3], [0, 0.4, 0]));
  body.add(new ConeGeometry(0.05, 0.09, 3), '#e98a4a', pose([-0.47, 0.31, -0.28], [0.3, 0, 0.5], [1, 1, 0.4]));
  body.add(new CylinderGeometry(0.11, 0.11, 0.12, 4, 1), '#3f7f6f', pose([0.44, 0.06, -0.3], [0, Math.PI / 4, 0], [1.4, 1, 1]), 0.15);

  // Tête (pivot au cou) : visage, barbe blanche, nez rouge, yeux, joues roses, suroît.
  const head = new Pieces();
  head.add(new SphereGeometry(0.14, 12, 9), SKIN, pose([0, 0.1, 0.0]));
  head.add(new SphereGeometry(0.13, 10, 7), '#f4f1ea', pose([0, 0.01, 0.06], [0, 0, 0], [1.05, 0.85, 0.75]), 0.05);
  head.add(new SphereGeometry(0.038, 6, 5), '#e48a74', pose([0, 0.09, 0.14]));
  for (const side of [-1, 1]) {
    head.add(new SphereGeometry(0.02, 5, 4), '#2a221d', pose([side * 0.05, 0.14, 0.12]));
    head.add(new SphereGeometry(0.03, 5, 4), '#f0a49a', pose([side * 0.085, 0.08, 0.1], [0, 0, 0], [1, 0.7, 0.5]));
    head.add(new SphereGeometry(0.04, 6, 4), '#f4f1ea', pose([side * 0.1, 0.15, 0.07], [0, 0, 0], [1.3, 0.55, 0.7]));
  }
  head.add(new SphereGeometry(0.155, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), YELLOW, pose([0, 0.18, -0.01], [0, 0, 0], [1, 0.85, 1]), 0.1);
  head.add(new CylinderGeometry(0.25, 0.27, 0.03, 14), YELLOW, pose([0, 0.18, -0.05], [-0.18, 0, 0]), 0.1);

  // Tibias (balancés) et bottes.
  const shin = new Pieces();
  shin.add(new CylinderGeometry(0.068, 0.07, 0.42, 7), NAVY, pose([0, -0.21, 0]), 0.08);
  shin.add(new CylinderGeometry(0.08, 0.085, 0.2, 8), BOOT, pose([0, -0.38, 0]), 0.1);
  shin.add(new SphereGeometry(0.085, 8, 5), BOOT, pose([0, -0.48, 0.05], [0, 0, 0], [1, 0.6, 1.5]));

  // Bras, mains et canne (pivot aux épaules) : le tout bouge d'un bloc quand il ferre.
  const rod = new Pieces();
  for (const side of [-1, 1]) {
    rod.add(new CylinderGeometry(0.06, 0.055, 0.36, 7), YELLOW, pose([side * 0.13, -0.07, 0.15], [-1.1, 0, -side * 0.35]), 0.08);
    rod.add(new SphereGeometry(0.055, 7, 5), SKIN, pose([side * 0.05, -0.14, 0.3]));
  }
  rod.add(new CylinderGeometry(0.022, 0.026, 0.42, 6), '#4a2f22', pose([0, -0.1, 0.32], [1.0, 0, 0]));
  rod.add(new CylinderGeometry(0.045, 0.045, 0.05, 8), '#bfc6cc', pose([0.05, -0.12, 0.33], [0, 0, Math.PI / 2]));
  // Scion en trois tronçons, de plus en plus fins et courbés vers le bout.
  let at = new Vector3(0, -0.1 + Math.cos(1.0) * 0.21, 0.32 + Math.sin(1.0) * 0.21);
  let tilt = 1.0;
  for (const [length, radius, bend] of [[0.8, 0.016, 0.06], [0.75, 0.012, 0.12], [0.6, 0.008, 0.2]] as const) {
    tilt += bend;
    const dir = new Vector3(0, Math.cos(tilt), Math.sin(tilt));
    const center = at.clone().addScaledVector(dir, length / 2);
    rod.add(new CylinderGeometry(radius * 0.8, radius, length, 5), '#2b2523', pose([center.x, center.y, center.z], [tilt, 0, 0]));
    at = at.clone().addScaledVector(dir, length);
  }
  rod.add(new TorusGeometry(0.02, 0.006, 4, 8), '#d9483b', pose([0, -0.1 + Math.cos(1.0) * 0.6, 0.32 + Math.sin(1.0) * 0.6]));

  const float = new Pieces();
  float.add(new SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e0413b', pose([0, 0, 0]));
  float.add(new SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#f5efe3', pose([0, 0, 0]));
  float.add(new CylinderGeometry(0.01, 0.01, 0.12, 4), '#2b2523', pose([0, 0.1, 0]));

  const fish = new Pieces();
  fish.add(new SphereGeometry(0.1, 9, 6), (_x, y, _z, _ny, out) => out.set(y > 0.02 ? '#5f8fb0' : '#d9e3e7'), pose([0, 0, 0], [0, 0, 0], [1.6, 0.8, 0.55]));
  fish.add(new ConeGeometry(0.07, 0.12, 3), '#e98a4a', pose([-0.2, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.3]));
  fish.add(new SphereGeometry(0.014, 5, 4), '#1d1d1d', pose([0.1, 0.025, 0.04]));

  return {
    body: body.build()!,
    head: head.build()!,
    shin: shin.build()!,
    rod: rod.build()!,
    float: float.build()!,
    fish: fish.build()!,
    tip: at,
  };
}

const LINE = new LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.75 });
const LINE_POINTS = 12;

const scratch = {
  tip: new Vector3(),
  end: new Vector3(),
  water: new Vector3(),
  bucket: new Vector3(),
};

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function Fisherman({ position, yaw, water }: { position: [number, number, number]; yaw: number; water: [number, number] }) {
  const geometries = useMemo(() => fishermanGeometries(), []);
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array((LINE_POINTS - 1) * 2 * 3), 3));
    return geometry;
  }, []);
  const rod = useRef<Group>(null);
  const tip = useRef<Group>(null);
  const bucket = useRef<Group>(null);
  const float = useRef<Group>(null);
  const fish = useRef<Group>(null);
  const shins = useRef<(Group | null)[]>([]);
  const head = useRef<Group>(null);
  const lineRef = useRef<LineSegments>(null);
  const events = useRef({ cycle: -1, splashed: false, struck: false, cast: false });

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => {
      if (geometry instanceof BufferGeometry) geometry.dispose();
    });
    line.dispose();
  }, [geometries, line]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const cycle = Math.floor(time / CYCLE);
    const t = time - cycle * CYCLE;
    const e = events.current;
    if (e.cycle !== cycle) {
      e.cycle = cycle;
      e.splashed = false;
      e.struck = false;
      e.cast = false;
    }
    const near = Math.hypot(boatState.position.x - position[0], boatState.position.z - position[2]) < 28;
    const audible = near && useWorld.getState().phase !== 'intro';

    // Canne : ferrage d'un coup sec, puis remise en place ; lancer (arrière puis avant).
    let rodAngle = Math.sin(time * 0.8) * 0.02;
    if (t > 10.6 && t < 13.2) rodAngle = -0.75 * smooth((t - 10.6) / 0.18) * (1 - smooth((t - 12.3) / 0.9));
    if (t > 13.6 && t < 14.8) rodAngle = -0.9 * Math.sin(smooth((t - 13.6) / 0.6) * Math.PI) + 0.35 * smooth((t - 14.1) / 0.3) * (1 - smooth((t - 14.4) / 0.4));
    if (rod.current) rod.current.rotation.x = rodAngle;

    // Jambes qui se balancent, tête qui dodeline.
    shins.current.forEach((shin, index) => {
      if (shin) shin.rotation.x = 0.1 + Math.sin(time * 1.6 + index * Math.PI) * 0.22;
    });
    if (head.current) head.current.rotation.set(Math.sin(time * 0.7) * 0.04 + (t > 10.6 && t < 12.6 ? -0.15 : 0), Math.sin(time * 0.31) * 0.12, 0);

    if (!tip.current || !float.current || !fish.current || !bucket.current) return;
    tip.current.getWorldPosition(scratch.tip);
    bucket.current.getWorldPosition(scratch.bucket);
    const [wx, wz] = water;
    const wave = waveHeight(wx, wz, time);
    scratch.water.set(wx + Math.sin(time * 0.4) * 0.15, wave + 0.03, wz + Math.cos(time * 0.33) * 0.12);

    // Où est le bout de la ligne ?
    let slack = 0.6;
    fishWatch.active = false;
    fish.current.visible = false;
    if (t < 10.6) {
      // Le bouchon danse ; deux touches, puis il plonge.
      const nibble = (t > 7.2 && t < 7.5 ? Math.sin((t - 7.2) * 20) * 0.05 : 0) + (t > 8.6 && t < 8.9 ? Math.sin((t - 8.6) * 20) * 0.06 : 0);
      const dive = t > 10.0 ? -0.18 * smooth((t - 10.0) / 0.25) : 0;
      scratch.end.copy(scratch.water);
      scratch.end.y += nibble + dive;
      if (t > 10.05 && !e.splashed) {
        e.splashed = true;
        ripple(scratch.water.x, scratch.water.z, time, 0.5);
      }
    } else if (t < 12.0) {
      // Ferrage : le poisson jaillit et file en cloche vers le seau.
      const k = smooth((t - 10.6) / 1.4);
      if (!e.struck) {
        e.struck = true;
        ripple(scratch.water.x, scratch.water.z, time, 0.9);
        if (audible) ambience.splash(0.25);
      }
      scratch.end.lerpVectors(scratch.water, scratch.bucket, k);
      scratch.end.y += Math.sin(k * Math.PI) * 2.4 + 0.15 * k;
      fish.current.visible = true;
      fish.current.position.copy(scratch.end);
      fish.current.rotation.set(Math.sin(time * 30) * 0.5, time * 4, Math.PI / 2 - k * 2.5);
      fishWatch.active = true;
      fishWatch.position.copy(scratch.end);
      slack = 0.05;
    } else if (t < 14.3) {
      // Le bouchon pend au bout de la canne.
      scratch.end.copy(scratch.tip);
      scratch.end.y -= 0.55 + Math.sin(time * 3) * 0.03;
      scratch.end.x += Math.sin(time * 2.1) * 0.05;
      slack = 0.02;
    } else if (t < 15.1) {
      // Lancer : le bouchon file en cloche jusqu'à l'eau.
      const k = smooth((t - 14.3) / 0.8);
      scratch.end.copy(scratch.tip);
      scratch.end.y -= 0.55;
      scratch.end.lerp(scratch.water, k);
      scratch.end.y += Math.sin(k * Math.PI) * 1.6;
      slack = 0.25;
    } else {
      if (!e.cast) {
        e.cast = true;
        ripple(scratch.water.x, scratch.water.z, time, 0.6);
      }
      scratch.end.copy(scratch.water);
    }
    float.current.position.copy(scratch.end);
    fishWatch.float.copy(scratch.end);
    float.current.rotation.set(Math.sin(time * 1.7) * 0.15, 0, Math.sin(time * 1.3) * 0.15);

    // Ligne : courbe qui pend entre le scion et le bouchon (plus tendue au ferrage).
    const positions = lineRef.current?.geometry.attributes.position as BufferAttribute | undefined;
    if (positions) {
      const span = scratch.tip.distanceTo(scratch.end);
      for (let index = 0; index < LINE_POINTS - 1; index++) {
        for (let corner = 0; corner < 2; corner++) {
          const k = (index + corner) / (LINE_POINTS - 1);
          const sag = Math.sin(k * Math.PI) * span * slack * 0.25;
          positions.setXYZ(
            index * 2 + corner,
            scratch.tip.x + (scratch.end.x - scratch.tip.x) * k,
            scratch.tip.y + (scratch.end.y - scratch.tip.y) * k - sag,
            scratch.tip.z + (scratch.end.z - scratch.tip.z) * k,
          );
        }
      }
      positions.needsUpdate = true;
      lineRef.current!.geometry.computeBoundingSphere();
    }
  });

  return (
    <>
      <group position={position} rotation-y={yaw}>
        <mesh geometry={geometries.body} material={PAINTED} castShadow />
        <group ref={head} position={[0, 0.62, -0.1]}>
          <mesh geometry={geometries.head} material={PAINTED} castShadow />
        </group>
        {[-1, 1].map((side, index) => (
          <group
            key={side}
            ref={(element) => {
              shins.current[index] = element;
            }}
            position={[side * 0.1, 0.08, 0.27]}
          >
            <mesh geometry={geometries.shin} material={PAINTED} castShadow />
          </group>
        ))}
        <group ref={rod} position={[0, 0.48, -0.1]}>
          <mesh geometry={geometries.rod} material={PAINTED} castShadow />
          <group ref={tip} position={geometries.tip} />
        </group>
        <group ref={bucket} position={[-0.5, 0.3, -0.3]} />
      </group>
      <group ref={float}>
        <mesh geometry={geometries.float} material={PAINTED} />
      </group>
      <group ref={fish} visible={false}>
        <mesh geometry={geometries.fish} material={PAINTED} castShadow />
      </group>
      <lineSegments ref={lineRef} geometry={line} material={LINE} frustumCulled={false} raycast={() => null} />
    </>
  );
}
