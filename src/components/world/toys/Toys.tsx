'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { Hotspot } from '@/components/islands/kit';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { knockNow, pyramid, restackNow, setupPyramid, stepPyramid } from './chamboule';
import { fxSettings } from './effects';
import {
  barrelGeometry,
  beachBallGeometry,
  CRATE,
  crateGeometries,
  duckGeometry,
  lifebuoyGeometry,
  markerGeometry,
  markerLampGeometry,
  pennantGeometry,
  potGeometry,
  potNetGeometry,
  RAFT,
  raftGeometry,
  roundBuoyGeometry,
  toyMaterials,
} from './models';
import { boat, collidePairs, counts, frame, raft, readBoat, stepToys, toys, type Shape, type Toy } from './physics';

/**
 * Le terrain de jeu flottant : une instance par objet, un maillage par sorte d'objet, et le
 * radeau du chamboule-tout (cliquer dessus lance le bateau droit dedans).
 */

/** Peintures foraines de la pyramide, couleurs passées des caisses à la dérive. */
const FAIR = ['#e2553f', '#2f7fd6', '#f2c14e', '#f4efe6', '#3fa56b', '#ef8a3c'];
const FADED = ['#5c8fb8', '#5aa08a', '#c46a4f', '#d9c9a3'];
const WOOD = ['#ffffff', '#f2e9dd', '#fff4e6', '#e8e1d6'];
/** Le vent des drapeaux de l'archipel (même direction que les tissus animés). */
const WIND_YAW = Math.atan2(-0.54, 0.84);

const meshes: Record<Shape, InstancedMesh | null> = {
  crate: null,
  barrel: null,
  pot: null,
  buoy: null,
  ball: null,
  lifebuoy: null,
  duck: null,
  marker: null,
  raft: null,
};
const extras = { paint: null as InstancedMesh | null, net: null as InstancedMesh | null, lamp: null as InstancedMesh | null };
/** Tous les maillages, relus à chaque image sans rien allouer. */
const everyMesh: (InstancedMesh | null)[] = new Array(11).fill(null);

const matrix = new Matrix4();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const stretch = new Vector3();
const shifted = new Vector3();
const lift = new Vector3();
const forward = new Vector3();
const color = new Color();
const noRaycast = () => null;

let appliedQuality = '';

/** Qualité basse : moins d'objets (et une pyramide de 5 caisses). */
function applyQuality(quality: string) {
  if (quality === appliedQuality) return;
  appliedQuality = quality;
  const level = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  for (const toy of toys) toy.enabled = level >= toy.minQuality;
  setupPyramid(level === 0);
}

function place(mesh: InstancedMesh | null, toy: Toy, time: number) {
  if (!mesh) return;
  if (!toy.enabled) {
    mesh.setMatrixAt(toy.slot, HIDDEN);
    return;
  }
  const age = time - toy.squashAt;
  const squash = age >= 0 && age < 0.9 ? Math.sin(age * 23) * Math.exp(-age * 6.5) * toy.squashAmp : 0;
  stretch.set(toy.scale * (1 + squash * 0.55), toy.scale * (1 - squash), toy.scale * (1 + squash * 0.55));
  shifted.copy(toy.p);
  if (toy.mode === 'stacked' && squash !== 0) {
    // Une caisse qui atterrit s'écrase sur sa base, pas autour de son centre.
    lift.set(0, 1, 0).applyQuaternion(toy.q);
    shifted.addScaledVector(lift, -squash * CRATE.h * 0.5 * toy.scale);
  }
  matrix.compose(shifted, toy.q, stretch);
  mesh.setMatrixAt(toy.slot, matrix);
}

export function Toys() {
  const crate = useRef<InstancedMesh>(null);
  const cratePaint = useRef<InstancedMesh>(null);
  const barrel = useRef<InstancedMesh>(null);
  const pot = useRef<InstancedMesh>(null);
  const potNet = useRef<InstancedMesh>(null);
  const buoy = useRef<InstancedMesh>(null);
  const ball = useRef<InstancedMesh>(null);
  const lifebuoy = useRef<InstancedMesh>(null);
  const duck = useRef<InstancedMesh>(null);
  const marker = useRef<InstancedMesh>(null);
  const lamp = useRef<InstancedMesh>(null);
  const raftGroup = useRef<Group>(null);
  const pennant = useRef<Group>(null);
  const materials = toyMaterials();
  const assets = useMemo(() => {
    const crates = crateGeometries();
    return {
      crate: crates.wood,
      paint: crates.paint,
      barrel: barrelGeometry(),
      pot: potGeometry(),
      net: potNetGeometry(),
      buoy: roundBuoyGeometry(),
      ball: beachBallGeometry(),
      lifebuoy: lifebuoyGeometry(),
      duck: duckGeometry(),
      marker: markerGeometry(),
      lamp: markerLampGeometry(),
      raft: raftGeometry(),
      pennant: pennantGeometry(),
    };
  }, []);

  // Peinture des caisses (foraine sur la pyramide, délavée à la dérive), bois un peu varié.
  useLayoutEffect(() => {
    for (const toy of toys) {
      if (toy.shape === 'crate') {
        crate.current?.setColorAt(toy.slot, color.set(WOOD[toy.slot % WOOD.length]));
        const paint = toy.tint < 100 ? FAIR[toy.tint % FAIR.length] : FADED[toy.tint % FADED.length];
        cratePaint.current?.setColorAt(toy.slot, color.set(paint));
      } else if (toy.shape === 'barrel') {
        barrel.current?.setColorAt(toy.slot, color.set(WOOD[(toy.slot + 1) % WOOD.length]));
      }
    }
    for (const mesh of [crate.current, cratePaint.current, barrel.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, []);

  // Outils de développement (captures, réglages) : rien n'est exposé en production.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__toys = {
      toys,
      raft,
      pyramid,
      knock: (strength = 1) => knockNow(strength, frame.time),
      restack: () => restackNow(),
      /** Lance le bateau dans la pyramide depuis `distance` mètres (décalé de `offset` à tribord). */
      charge: (distance = 16, heading = 0.67, offset = 0.7) => {
        const world = useWorld.getState();
        if (world.phase === 'docked') world.close();
        const fx = Math.cos(heading);
        const fz = Math.sin(heading);
        const sx = -fz * offset;
        const sz = fx * offset;
        boatState.position.set(raft.p.x - fx * distance + sx, 0, raft.p.z - fz * distance + sz);
        boatState.heading = heading;
        boatState.speed = 11;
        useWorld.getState().sailToPoint([raft.p.x + fx * 14 + sx, raft.p.z + fz * 14 + sz]);
      },
    };
    return () => {
      delete target.__toys;
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    frame.time = time;
    const { phase, quality, reducedMotion } = useWorld.getState();
    // Absents de la cinématique d'intro : la chute du bateau reste le seul sujet.
    const visible = phase === 'playing' || phase === 'docked';
    meshes.crate = crate.current;
    meshes.barrel = barrel.current;
    meshes.pot = pot.current;
    meshes.buoy = buoy.current;
    meshes.ball = ball.current;
    meshes.lifebuoy = lifebuoy.current;
    meshes.duck = duck.current;
    meshes.marker = marker.current;
    extras.paint = cratePaint.current;
    extras.net = potNet.current;
    extras.lamp = lamp.current;
    everyMesh[0] = crate.current;
    everyMesh[1] = cratePaint.current;
    everyMesh[2] = barrel.current;
    everyMesh[3] = pot.current;
    everyMesh[4] = potNet.current;
    everyMesh[5] = buoy.current;
    everyMesh[6] = ball.current;
    everyMesh[7] = lifebuoy.current;
    everyMesh[8] = duck.current;
    everyMesh[9] = marker.current;
    everyMesh[10] = lamp.current;
    for (let index = 0; index < everyMesh.length; index++) {
      const mesh = everyMesh[index];
      if (mesh) mesh.visible = visible;
    }
    const group = raftGroup.current;
    if (group) group.visible = visible;
    if (!visible) return;

    fxSettings.reduced = reducedMotion;
    applyQuality(quality);
    readBoat();
    stepToys(dt, time);
    stepPyramid(dt, time);
    collidePairs(time);

    for (let index = 0; index < toys.length; index++) {
      const toy = toys[index];
      if (toy === raft) continue;
      place(meshes[toy.shape], toy, time);
      if (toy.shape === 'crate') place(extras.paint, toy, time);
      else if (toy.shape === 'pot') place(extras.net, toy, time);
      else if (toy.shape === 'marker') place(extras.lamp, toy, time);
    }
    for (let index = 0; index < everyMesh.length; index++) {
      const mesh = everyMesh[index];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }

    if (group) {
      group.position.copy(raft.p);
      group.quaternion.copy(raft.q);
    }
    const flag = pennant.current;
    if (flag) {
      forward.set(1, 0, 0).applyQuaternion(raft.q);
      const raftYaw = Math.atan2(-forward.z, forward.x);
      flag.rotation.y = WIND_YAW - raftYaw + Math.sin(time * 2.3) * 0.2 + Math.sin(time * 5.7) * 0.07;
      flag.rotation.x = Math.sin(time * 7.1) * 0.12;
    }
    toyMaterials().lamp.emissiveIntensity = 0.3 + skyState.dayNight * 3 * (Math.sin(time * 2.4) > 0.2 ? 1 : 0.25);
  });

  // Un clic sur le radeau : le bateau fonce droit dans la pyramide (et la traverse).
  const ram = () => {
    const world = useWorld.getState();
    if (world.phase !== 'playing' && world.phase !== 'docked') return;
    const dx = raft.p.x - boat.x;
    const dz = raft.p.z - boat.z;
    const distance = Math.hypot(dx, dz) || 1;
    world.sailToPoint([raft.p.x + (dx / distance) * 11, raft.p.z + (dz / distance) * 11]);
  };

  return (
    <group>
      <instancedMesh ref={crate} args={[assets.crate, materials.wood, counts.crate]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={cratePaint} args={[assets.paint, materials.paint, counts.crate]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={barrel} args={[assets.barrel, materials.wood, counts.barrel]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={pot} args={[assets.pot, materials.wood, counts.pot]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={potNet} args={[assets.net, materials.net, counts.pot]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={buoy} args={[assets.buoy, materials.plastic, counts.buoy]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={ball} args={[assets.ball, materials.plastic, counts.ball]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={lifebuoy} args={[assets.lifebuoy, materials.plastic, counts.lifebuoy]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={duck} args={[assets.duck, materials.plastic, counts.duck]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={marker} args={[assets.marker, materials.plastic, counts.marker]} castShadow frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={lamp} args={[assets.lamp, materials.lamp, counts.marker]} frustumCulled={false} raycast={noRaycast} />
      <group ref={raftGroup} position={[raft.p.x, 0, raft.p.z]}>
        <mesh geometry={assets.raft} material={materials.raft} castShadow receiveShadow raycast={noRaycast} />
        <group ref={pennant} position={[RAFT.mastX, RAFT.mastTop - 0.12, RAFT.mastZ]}>
          <mesh geometry={assets.pennant} material={materials.wood} raycast={noRaycast} />
        </group>
        <Hotspot onActivate={ram} hoverScale={1}>
          <mesh position={[0, 1.4, 0]} visible={false}>
            <boxGeometry args={[5, 3, 5]} />
          </mesh>
        </Hotspot>
      </group>
    </group>
  );
}
