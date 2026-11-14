'use client';

import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three';
import { Pieces, pose } from '@/components/islands/docks/parts';
import { PAINTED } from '@/components/islands/docks/planks';
import { Hotspot } from '@/components/islands/kit';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { damp } from '@/lib/utils/math';
import { fishWatch } from './Fisherman';

/**
 * Le chat du port : un rouquin tigré assis sur le ponton du départ. Il respire, sa queue
 * balaie le plancher, une oreille frémit de temps en temps, il cligne des yeux et sa tête
 * suit le bateau. Une caresse (clic) : yeux plissés de bonheur, queue dressée, petits
 * cœurs, un « mrrrp » discret et le tampon « Le chat du port ».
 *
 * Repère du chat : origine sous lui, il regarde vers +Z.
 */

const GINGER = new Color('#f0a35e');
const STRIPE = new Color('#d27434');
const CREAM = new Color('#fbe9d2');

/** Pelage tigré : rayures nettes (par triangle) sur le dos, ventre et poitrail crème. */
function coat(stripes: number, creamBelow: number) {
  return (x: number, y: number, z: number, _ny: number, out: Color) => {
    if (z > creamBelow) out.copy(CREAM);
    else if (Math.sin(y * stripes + Math.abs(x) * 9) > 0.45) out.copy(STRIPE);
    else out.copy(GINGER);
  };
}

function catGeometries() {
  const body = new Pieces();
  // Arrière-train assis, poitrail, pattes avant et pattes arrière repliées.
  body.addLocal(new SphereGeometry(0.17, 12, 9), coat(38, 0.12), pose([0, 0.15, -0.03], [0, 0, 0], [1.1, 0.86, 1.22]));
  body.addLocal(new SphereGeometry(0.13, 12, 9), coat(40, 0.06), pose([0, 0.28, 0.06], [-0.25, 0, 0], [1, 1.25, 0.95]));
  for (const side of [-1, 1]) {
    body.add(new CylinderGeometry(0.034, 0.038, 0.22, 6), GINGER, pose([side * 0.058, 0.11, 0.135]));
    body.add(new SphereGeometry(0.045, 8, 5), CREAM, pose([side * 0.058, 0.022, 0.16], [0, 0, 0], [1, 0.6, 1.3]));
    body.addLocal(new SphereGeometry(0.1, 10, 7), coat(42, 9), pose([side * 0.125, 0.1, -0.05], [0, 0, 0], [0.62, 0.9, 1.25]));
    body.add(new SphereGeometry(0.045, 8, 5), CREAM, pose([side * 0.1, 0.022, 0.07], [0, 0, 0], [1, 0.6, 1.5]));
  }

  const head = new Pieces();
  head.addLocal(new SphereGeometry(0.135, 14, 10), coat(55, 0.11), pose([0, 0.085, 0.02], [0, 0, 0], [1.12, 0.95, 1]));
  // Joues rebondies, museau crème, truffe rose.
  for (const side of [-1, 1]) head.add(new SphereGeometry(0.06, 8, 6), GINGER, pose([side * 0.075, 0.045, 0.07]));
  head.add(new SphereGeometry(0.06, 10, 7), CREAM, pose([0, 0.04, 0.115], [0, 0, 0], [1.25, 0.8, 0.85]));
  head.add(new SphereGeometry(0.018, 6, 4), '#e58a95', pose([0, 0.07, 0.163], [0, 0, 0], [1.3, 0.8, 1]));
  // Moustaches : trois fils de chaque côté.
  for (const side of [-1, 1]) {
    for (const tilt of [-0.18, 0, 0.18]) {
      head.add(new CylinderGeometry(0.003, 0.003, 0.15, 3), '#ffffff', pose([side * 0.12, 0.045 + tilt * 0.05, 0.13], [0, 0, side * (Math.PI / 2 + tilt)]));
    }
  }

  const eyes = new Pieces();
  for (const side of [-1, 1]) {
    eyes.add(new SphereGeometry(0.026, 8, 6), '#2a221d', pose([side * 0.052, 0, 0], [0, 0, 0], [1, 1.15, 0.7]));
    eyes.add(new SphereGeometry(0.008, 5, 4), '#ffffff', pose([side * 0.052 + 0.008, 0.01, 0.018]));
  }

  const ear = new Pieces();
  ear.add(new ConeGeometry(0.055, 0.1, 4), GINGER, pose([0, 0.05, 0], [0, Math.PI / 4, 0], [1, 1, 0.6]));
  ear.add(new ConeGeometry(0.032, 0.065, 4), '#f2a3ae', pose([0, 0.04, 0.016], [0, Math.PI / 4, 0], [1, 1, 0.5]));

  // Queue en cinq segments emboîtés (chacun part vers -Z depuis son pivot).
  const tail = new Pieces();
  tail.addLocal(new CylinderGeometry(0.028, 0.032, 0.11, 6), (_x, y, _z, _ny, out) => out.copy(y > 0.02 ? STRIPE : GINGER), pose([0, 0, -0.055], [Math.PI / 2, 0, 0]));
  const tip = new Pieces();
  tip.add(new CylinderGeometry(0.02, 0.028, 0.1, 6), STRIPE, pose([0, 0, -0.05], [Math.PI / 2, 0, 0]));
  tip.add(new SphereGeometry(0.022, 6, 4), CREAM, pose([0, 0, -0.1]));

  return {
    body: body.build()!,
    head: head.build()!,
    eyes: eyes.build()!,
    ear: ear.build()!,
    tail: tail.build()!,
    tip: tip.build()!,
  };
}

function heartGeometry() {
  const shape = new Shape();
  shape.moveTo(0, -0.45);
  shape.bezierCurveTo(-0.15, -0.3, -0.56, -0.05, -0.5, 0.2);
  shape.bezierCurveTo(-0.45, 0.47, -0.1, 0.52, 0, 0.26);
  shape.bezierCurveTo(0.1, 0.52, 0.45, 0.47, 0.5, 0.2);
  shape.bezierCurveTo(0.56, -0.05, 0.15, -0.3, 0, -0.45);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  geometry.center();
  return geometry as BufferGeometry;
}

const HEART = new MeshStandardMaterial({ color: '#ff6f91', emissive: '#ff3d6e', emissiveIntensity: 0.35, roughness: 0.45 });
const HEARTS = 5;
const TAIL_SEGMENTS = 5;

/** Scratch (hors React) : aucune allocation par image. */
const scratch = {
  object: new Object3D(),
  world: new Vector3(),
  local: new Vector3(),
  inverse: new Matrix4(),
  quaternion: new Quaternion(),
};

export function HarborCat({ position, yaw }: { position: [number, number, number]; yaw: number }) {
  const geometries = useMemo(() => catGeometries(), []);
  const heart = useMemo(() => heartGeometry(), []);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const earLeft = useRef<Group>(null);
  const earRight = useRef<Group>(null);
  const tail = useRef<(Group | null)[]>([]);
  const hearts = useRef<InstancedMesh>(null);
  const state = useRef({ pettedAt: -100, nextFlick: 2, flickAt: -10, flickEar: 0, nextBlink: 1.5, headYaw: 0, headPitch: 0 });
  const clock = useThree((three) => three.clock);

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose());
    heart.dispose();
  }, [geometries, heart]);

  useFrame((three, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = three.clock.elapsedTime;
    const s = state.current;
    const since = time - s.pettedAt;
    const happy = since < 2.6;

    // Respiration.
    if (body.current) body.current.scale.set(1, 1 + Math.sin(time * 2.3) * 0.018, 1 + Math.sin(time * 2.3) * 0.01);

    // Regard : le poisson qui vole, sinon le bateau quand il bouge (ou tout près), sinon le
    // bouchon du pêcheur, et parfois un coup d'œil alentour.
    if (head.current && root.current) {
      root.current.updateWorldMatrix(true, false);
      scratch.inverse.copy(root.current.matrixWorld).invert();
      const boatDistance = Math.hypot(boatState.position.x - root.current.matrixWorld.elements[12], boatState.position.z - root.current.matrixWorld.elements[14]);
      const glance = Math.sin(time * 0.21) > 0.55;
      let look: Vector3 | null = null;
      if (fishWatch.active) look = fishWatch.position;
      else if (boatState.speed > 0.6 && boatDistance < 60) look = boatState.position;
      else if (!glance) look = fishWatch.float;
      let targetYaw = Math.sin(time * 0.37) * 0.6 + Math.sin(time * 0.13) * 0.3;
      let targetPitch = Math.sin(time * 0.23) * 0.08;
      if (look) {
        scratch.local.copy(look).applyMatrix4(scratch.inverse);
        targetYaw = Math.atan2(scratch.local.x, scratch.local.z);
        targetPitch = -Math.atan2(scratch.local.y - 0.45, Math.max(Math.hypot(scratch.local.x, scratch.local.z), 0.5)) * 0.7;
      }
      if (happy) {
        targetYaw = 0;
        targetPitch = -0.12;
      }
      targetYaw = Math.max(-1.2, Math.min(1.2, targetYaw));
      targetPitch = Math.max(-0.5, Math.min(0.35, targetPitch));
      s.headYaw = damp(s.headYaw, targetYaw, fishWatch.active ? 7 : 3.2, dt);
      s.headPitch = damp(s.headPitch, targetPitch, fishWatch.active ? 7 : 3.2, dt);
      head.current.rotation.set(s.headPitch, s.headYaw, happy ? Math.sin(since * 5) * 0.12 : 0);
    }

    // Clignement (et yeux plissés de bonheur après une caresse).
    if (time > s.nextBlink) s.nextBlink = time + 2.2 + ((time * 7.31) % 1) * 3.5;
    const blinking = s.nextBlink - time > 0 && s.nextBlink - time < 0.12;
    if (eyes.current) eyes.current.scale.y = happy ? 0.18 : blinking ? 0.12 : 1;

    // Une oreille frémit de temps en temps.
    if (time > s.nextFlick) {
      s.nextFlick = time + 2.5 + ((time * 3.71) % 1) * 4;
      s.flickAt = time;
      s.flickEar = (s.flickEar + 1) % 2;
    }
    const flickPhase = time - s.flickAt;
    const twitch = flickPhase < 0.3 ? Math.sin((flickPhase / 0.3) * Math.PI * 2) * 0.5 : 0;
    // Oreilles légèrement écartées vers l'extérieur (gauche en +X, droite en -X).
    if (earLeft.current) earLeft.current.rotation.set(-0.12, 0, -0.3 - (s.flickEar === 0 ? twitch : 0));
    if (earRight.current) earRight.current.rotation.set(-0.12, 0, 0.3 + (s.flickEar === 1 ? twitch : 0));

    // Queue : balayage paresseux, le bout fouette ; dressée en crosse quand il est content.
    for (let index = 0; index < TAIL_SEGMENTS; index++) {
      const segment = tail.current[index];
      if (!segment) continue;
      const lag = index * 0.55;
      if (happy) {
        segment.rotation.set(index === 0 ? -1.25 : index === TAIL_SEGMENTS - 1 ? 0.55 : -0.12, Math.sin(time * 6 - lag) * 0.08, 0);
      } else {
        const swish = Math.sin(time * 1.5 - lag) * (0.18 + index * 0.1) + Math.sin(time * 0.43) * 0.15;
        segment.rotation.set(index === 0 ? -0.15 : 0.05, swish + (index === 0 ? 0.9 : 0.12), 0);
      }
    }

    // Petits cœurs qui montent en se dandinant.
    const mesh = hearts.current;
    if (mesh) {
      mesh.visible = since < 2.4;
      if (mesh.visible && root.current) {
        three.camera.getWorldQuaternion(scratch.quaternion);
        for (let index = 0; index < HEARTS; index++) {
          const life = Math.min(1, Math.max(0, (since - index * 0.18) / 1.8));
          const o = scratch.object;
          scratch.world.set(Math.sin(index * 2.4) * 0.18 + Math.sin(life * 9 + index) * 0.05, 0.62 + life * 0.85, 0.12 + Math.cos(index * 2.4) * 0.1);
          root.current.localToWorld(scratch.world);
          o.position.copy(scratch.world);
          o.quaternion.copy(scratch.quaternion);
          const grow = life <= 0 ? 0 : life < 0.2 ? life / 0.2 : life > 0.75 ? Math.max(0, 1 - (life - 0.75) / 0.25) : 1;
          o.scale.setScalar(0.11 * grow * (1 + Math.sin(life * 18) * 0.06));
          o.updateMatrix();
          mesh.setMatrixAt(index, o.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const pet = () => {
    const s = state.current;
    if (clock.elapsedTime - s.pettedAt < 1.2) return;
    s.pettedAt = clock.elapsedTime;
    ambience.cue(587, 0.2);
    ambience.cue(784, 0.26);
    logbook.stamp('cat');
  };

  return (
    <>
      <group ref={root} position={position} rotation-y={yaw}>
        <Hotspot onActivate={pet} hoverScale={1.12}>
          <group ref={body}>
            <mesh geometry={geometries.body} material={PAINTED} castShadow />
          </group>
          <group ref={head} position={[0, 0.37, 0.075]}>
            <mesh geometry={geometries.head} material={PAINTED} castShadow />
            <group ref={eyes} position={[0, 0.1, 0.134]}>
              <mesh geometry={geometries.eyes} material={PAINTED} />
            </group>
            <group ref={earLeft} position={[0.075, 0.17, 0.0]}>
              <mesh geometry={geometries.ear} material={PAINTED} />
            </group>
            <group ref={earRight} position={[-0.075, 0.17, 0.0]}>
              <mesh geometry={geometries.ear} material={PAINTED} />
            </group>
          </group>
          {/* Queue : segments emboîtés, du croupion jusqu'au bout clair. */}
          <group position={[0, 0.06, -0.2]}>
            <TailChain refs={tail} tail={geometries.tail} tip={geometries.tip} />
          </group>
          {/* Volume de clic : le chat est petit, on l'attrape facilement. */}
          <mesh position={[0, 0.3, 0]} visible={false}>
            <sphereGeometry args={[0.45, 8, 6]} />
          </mesh>
        </Hotspot>
      </group>
      <instancedMesh ref={hearts} args={[heart, HEART, HEARTS]} visible={false} frustumCulled={false} raycast={() => null} />
    </>
  );
}

/** Chaîne de segments : chaque segment est enfant du précédent (la queue ondule). */
function TailChain({ refs, tail, tip }: { refs: RefObject<(Group | null)[]>; tail: BufferGeometry; tip: BufferGeometry }) {
  const build = (index: number): ReactNode => (
    <group
      ref={(element) => {
        refs.current[index] = element;
      }}
      position={[0, 0, index === 0 ? 0 : -0.1]}
    >
      <mesh geometry={index === TAIL_SEGMENTS - 1 ? tip : tail} material={PAINTED} castShadow />
      {index < TAIL_SEGMENTS - 1 && build(index + 1)}
    </group>
  );
  return <>{build(0)}</>;
}
