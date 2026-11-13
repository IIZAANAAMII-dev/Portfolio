'use client';

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { BOAT_FRAME } from '@/components/boat/BoatModel';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { getSubstanceMaterial } from '@/lib/materials/substance-material';
import { SOLIDS } from '@/lib/navigation';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { clamp, smoothstep } from '@/lib/utils/math';

/**
 * Objets flottants à bousculer : ballons de plage, bouées, caisses et un canard en
 * plastique géant. Une petite physique 2D (cercles) : le bateau les pousse, ils se
 * cognent, rebondissent sur les côtes, dérivent puis reviennent doucement vers leur coin.
 * Chaque choc fait un rond dans l'eau et un son (le canard couine).
 */

type Kind = 'ball' | 'buoy' | 'crate' | 'duck';

interface Body {
  kind: Kind;
  index: number;
  anchor: [number, number];
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  mass: number;
  drag: number;
  yaw: number;
  spin: Quaternion;
  cooldown: number;
}

const SPECS: Record<Kind, { radius: number; mass: number; drag: number }> = {
  ball: { radius: 0.85, mass: 0.35, drag: 0.55 },
  buoy: { radius: 0.8, mass: 1.6, drag: 1.4 },
  crate: { radius: 0.85, mass: 1.1, drag: 1.0 },
  duck: { radius: 2.5, mass: 3.2, drag: 0.8 },
};

/** Le canard attend devant le bateau au départ ; ballons et bouées autour du port. */
const LAYOUT: { kind: Kind; at: [number, number] }[] = [
  { kind: 'duck', at: [23, 2] },
  { kind: 'ball', at: [17, -5] },
  { kind: 'ball', at: [13, 7] },
  { kind: 'ball', at: [27, -9] },
  { kind: 'buoy', at: [30, 6] },
  { kind: 'buoy', at: [-12, -16] },
  { kind: 'buoy', at: [36, -24] },
  { kind: 'buoy', at: [-28, 22] },
  { kind: 'buoy', at: [44, -2] },
  { kind: 'crate', at: [52, 8] },
  { kind: 'crate', at: [55, 12] },
  { kind: 'crate', at: [-44, -48] },
];

/** État physique hors React (comme boatState) : un seul jeu d'objets dans le monde. */
const bodies: Body[] = (() => {
  const counters: Record<Kind, number> = { ball: 0, buoy: 0, crate: 0, duck: 0 };
  return LAYOUT.map(({ kind, at }, order) => ({
    kind,
    index: counters[kind]++,
    anchor: at,
    x: at[0],
    z: at[1],
    vx: 0,
    vz: 0,
    ...SPECS[kind],
    yaw: (order * 2.399) % (Math.PI * 2),
    spin: new Quaternion(),
    cooldown: 0,
  }));
})();

const counts: Record<Kind, number> = { ball: 0, buoy: 0, crate: 0, duck: 0 };
for (const body of bodies) counts[body.kind] += 1;

/* ------------------------------------------------------------------ géométries */

/** Ballon de plage : six quartiers de couleur, pôles blancs (faces non partagées : bords nets). */
function beachBall() {
  const sphere = new SphereGeometry(1, 24, 14).toNonIndexed();
  const positions = sphere.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const palette = ['#e2553f', '#f7f4ee', '#f2c14e', '#f7f4ee', '#2f7fd6', '#f7f4ee'].map((hex) => new Color(hex));
  const white = new Color('#f7f4ee');
  for (let face = 0; face < positions.count; face += 3) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      cx += positions.getX(face + k);
      cy += positions.getY(face + k);
      cz += positions.getZ(face + k);
    }
    const angle = Math.atan2(cz, cx) + Math.PI;
    const color = Math.abs(cy / 3) > 0.86 ? white : palette[Math.floor((angle / (Math.PI * 2)) * 6) % 6];
    for (let k = 0; k < 3; k++) color.toArray(colors, (face + k) * 3);
  }
  sphere.setAttribute('color', new BufferAttribute(colors, 3));
  sphere.computeVertexNormals();
  return sphere;
}

/** Corps de bouée : cylindre à bandes rouges et blanches. */
function buoyBody() {
  const body = new CylinderGeometry(0.5, 0.72, 1.5, 14, 6).toNonIndexed();
  const positions = body.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const red = new Color('#d8473a');
  const white = new Color('#f4f0e8');
  for (let face = 0; face < positions.count; face += 3) {
    const y = (positions.getY(face) + positions.getY(face + 1) + positions.getY(face + 2)) / 3;
    const color = Math.floor((y + 0.75) / 0.5) % 2 === 0 ? red : white;
    for (let k = 0; k < 3; k++) color.toArray(colors, (face + k) * 3);
  }
  body.setAttribute('color', new BufferAttribute(colors, 3));
  body.computeVertexNormals();
  body.translate(0, 0.45, 0);
  return body;
}

/* --------------------------------------------------------------- ronds dans l'eau */

const RIPPLES = 10;
const rippleState = Array.from({ length: RIPPLES }, () => ({ x: 0, z: 0, start: -10, size: 1 }));
let rippleCursor = 0;

/** Rond dans l'eau à cet endroit (réutilisé par la bouteille à la mer). */
export function ripple(x: number, z: number, time: number, size: number) {
  const slot = rippleState[rippleCursor];
  rippleCursor = (rippleCursor + 1) % RIPPLES;
  slot.x = x;
  slot.z = z;
  slot.start = time;
  slot.size = size;
}

function Ripples() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const fade = useMemo(() => new Color(), []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    for (let index = 0; index < RIPPLES; index++) {
      const ring = rippleState[index];
      const age = time - ring.start;
      const life = clamp(age / 1.3, 0, 1);
      dummy.position.set(ring.x, 0.14, ring.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(age < 1.3 ? ring.size * (0.6 + life * 2.6) : 0);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, fade.setScalar((1 - life) * 0.7));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, RIPPLES]} frustumCulled={false} renderOrder={7} raycast={() => null}>
      <ringGeometry args={[0.82, 1, 40]} />
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  );
}

/* --------------------------------------------------------------------- canard */

function Duck({ duck }: { duck: RefObject<Group | null> }) {
  const yellow = useMemo(() => new MeshStandardMaterial({ color: '#ffd23f', roughness: 0.45 }), []);
  const orange = useMemo(() => new MeshStandardMaterial({ color: '#ff8a1f', roughness: 0.5 }), []);
  const black = useMemo(() => new MeshStandardMaterial({ color: '#16161c', roughness: 0.25 }), []);
  return (
    <group ref={duck}>
      <group scale={1.65}>
      <mesh material={yellow} scale={[1.45, 0.92, 1.05]} position-y={0.35} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>
      <mesh material={yellow} position={[-1.15, 0.85, 0]} rotation-z={0.7} castShadow>
        <coneGeometry args={[0.42, 0.9, 12]} />
      </mesh>
      <mesh material={yellow} position={[0.75, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.68, 18, 12]} />
      </mesh>
      <mesh material={orange} position={[1.38, 1.32, 0]} scale={[1, 0.38, 0.8]} castShadow>
        <sphereGeometry args={[0.42, 14, 10]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={black} position={[1.12, 1.66, 0.38 * side]}>
          <sphereGeometry args={[0.1, 10, 8]} />
        </mesh>
      ))}
      </group>
    </group>
  );
}

/* --------------------------------------------------------------------- moteur */

const SEGMENT_START = new Vector3();
const forward = new Vector3();
const tilt = new Quaternion();
const roll = new Quaternion();
const axis = new Vector3();
const UP = new Vector3(0, 1, 0);

export function Flotsam() {
  const balls = useRef<InstancedMesh>(null);
  const buoys = useRef<InstancedMesh>(null);
  const buoyTops = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const lampGlow = useRef<MeshStandardMaterial>(null);
  const crates = useRef<InstancedMesh>(null);
  const duck = useRef<Group>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const ballGeometry = useMemo(() => beachBall(), []);
  const buoyGeometry = useMemo(() => buoyBody(), []);
  const topGeometry = useMemo(() => new ConeGeometry(0.42, 0.62, 12).translate(0, 1.5, 0), []);
  const lampGeometry = useMemo(() => new SphereGeometry(0.15, 10, 8).translate(0, 1.92, 0), []);
  const crateMaterial = useMemo(() => getSubstanceMaterial('wood_barrier', { projection: 'triplanar', space: 'object', scale: 0.6 }), []);

  useLayoutEffect(() => {
    // Les objets se déplacent : leurs sphères englobantes ne sont jamais recalculées.
    for (const mesh of [balls.current, buoys.current, buoyTops.current, lamps.current, crates.current]) {
      if (mesh) mesh.frustumCulled = false;
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { phase, introRadius } = useWorld.getState();
    const visible = phase === 'playing' || phase === 'docked' || (phase === 'transitioning' && introRadius > 30);
    for (const mesh of [balls.current, buoys.current, buoyTops.current, lamps.current, crates.current]) {
      if (mesh) mesh.visible = visible;
    }
    if (duck.current) duck.current.visible = visible;
    if (!visible) return;

    // Le bateau est une capsule : son axe va de la poupe à la proue.
    forward.set(Math.cos(boatState.heading), 0, Math.sin(boatState.heading));
    SEGMENT_START.set(boatState.position.x - forward.x * BOAT_FRAME.stern, 0, boatState.position.z - forward.z * BOAT_FRAME.stern);
    const segmentLength = BOAT_FRAME.bow + BOAT_FRAME.stern;
    const boatVX = forward.x * boatState.speed;
    const boatVZ = forward.z * boatState.speed;

    for (const body of bodies) {
      body.cooldown = Math.max(0, body.cooldown - dt);
      // Choc avec la coque.
      const along = clamp((body.x - SEGMENT_START.x) * forward.x + (body.z - SEGMENT_START.z) * forward.z, 0, segmentLength);
      const px = SEGMENT_START.x + forward.x * along;
      const pz = SEGMENT_START.z + forward.z * along;
      let dx = body.x - px;
      let dz = body.z - pz;
      let distance = Math.hypot(dx, dz) || 0.001;
      const reach = BOAT_FRAME.halfBeam + body.radius;
      if (distance < reach) {
        const nx = dx / distance;
        const nz = dz / distance;
        body.x += nx * (reach - distance);
        body.z += nz * (reach - distance);
        const push = Math.max(boatVX * nx + boatVZ * nz, 0) * 1.5 + 0.8;
        body.vx += (nx * push + boatVX * 0.3) / body.mass;
        body.vz += (nz * push + boatVZ * 0.3) / body.mass;
        if (body.cooldown <= 0 && boatState.speed > 0.6) {
          body.cooldown = 0.6;
          const strength = clamp(boatState.speed / 8, 0.3, 1);
          ripple(body.x, body.z, time, body.radius * (1 + strength));
          ambience.bump(body.kind === 'duck' ? 'duck' : body.kind === 'crate' ? 'wood' : 'soft', strength);
          logbook.bump(body.kind);
        }
      }
      // Côtes : rebond amorti.
      for (const solid of SOLIDS) {
        dx = body.x - solid.x;
        dz = body.z - solid.z;
        distance = Math.hypot(dx, dz) || 0.001;
        const limit = solid.r + body.radius + 0.6;
        if (distance < limit) {
          const nx = dx / distance;
          const nz = dz / distance;
          body.x = solid.x + nx * limit;
          body.z = solid.z + nz * limit;
          const into = body.vx * nx + body.vz * nz;
          if (into < 0) {
            body.vx -= nx * into * 1.6;
            body.vz -= nz * into * 1.6;
          }
        }
      }
    }

    // Chocs entre objets.
    for (let a = 0; a < bodies.length; a++) {
      for (let b = a + 1; b < bodies.length; b++) {
        const first = bodies[a];
        const second = bodies[b];
        const dx = second.x - first.x;
        const dz = second.z - first.z;
        const distance = Math.hypot(dx, dz) || 0.001;
        const limit = first.radius + second.radius;
        if (distance >= limit) continue;
        const nx = dx / distance;
        const nz = dz / distance;
        const overlap = (limit - distance) * 0.5;
        first.x -= nx * overlap;
        first.z -= nz * overlap;
        second.x += nx * overlap;
        second.z += nz * overlap;
        const relative = (second.vx - first.vx) * nx + (second.vz - first.vz) * nz;
        if (relative < 0) {
          const impulse = (-1.7 * relative) / (1 / first.mass + 1 / second.mass);
          first.vx -= (impulse / first.mass) * nx;
          first.vz -= (impulse / first.mass) * nz;
          second.vx += (impulse / second.mass) * nx;
          second.vz += (impulse / second.mass) * nz;
        }
      }
    }

    // Intégration : traînée de l'eau, bouées tenues par leur corps-mort, retour lent au coin.
    for (const body of bodies) {
      const ax = body.anchor[0] - body.x;
      const az = body.anchor[1] - body.z;
      const away = Math.hypot(ax, az);
      const spring = body.kind === 'buoy' ? 0.9 : smoothstep(18, 40, away) * 0.08;
      body.vx += ax * spring * dt;
      body.vz += az * spring * dt;
      const damping = Math.exp(-body.drag * dt);
      body.vx *= damping;
      body.vz *= damping;
      const speed = Math.hypot(body.vx, body.vz);
      if (speed > 14) {
        body.vx *= 14 / speed;
        body.vz *= 14 / speed;
      }
      body.x += body.vx * dt;
      body.z += body.vz * dt;
      if (speed > 0.05) {
        const target = Math.atan2(body.vz, body.vx);
        const turn = Math.atan2(Math.sin(target - body.yaw), Math.cos(target - body.yaw));
        body.yaw += turn * Math.min(1, dt * (body.kind === 'duck' ? 1.6 : 0.6));
      }
      // Le ballon roule : rotation autour de l'axe perpendiculaire au mouvement.
      if (body.kind === 'ball' && speed > 0.01) {
        axis.set(body.vz, 0, -body.vx).normalize();
        roll.setFromAxisAngle(axis, -(speed * dt) / body.radius);
        body.spin.premultiply(roll);
      }
    }

    // Rendu : posés sur la vague, inclinés par sa pente.
    const night = skyState.dayNight;
    for (const body of bodies) {
      const wave = waveHeight(body.x, body.z, time);
      const slopeX = waveHeight(body.x + 0.8, body.z, time) - waveHeight(body.x - 0.8, body.z, time);
      const slopeZ = waveHeight(body.x, body.z + 0.8, time) - waveHeight(body.x, body.z - 0.8, time);
      const bob = Math.sin(time * 1.7 + body.anchor[0]) * 0.06;
      tilt.setFromUnitVectors(UP, axis.set(-slopeX * 0.9, 1, -slopeZ * 0.9).normalize());
      dummy.quaternion.copy(tilt).multiply(roll.setFromAxisAngle(UP, -body.yaw));
      if (body.kind === 'ball') {
        dummy.position.set(body.x, wave + body.radius * 0.62 + bob, body.z);
        dummy.quaternion.copy(body.spin);
        dummy.scale.setScalar(body.radius);
        dummy.updateMatrix();
        balls.current?.setMatrixAt(body.index, dummy.matrix);
      } else if (body.kind === 'buoy') {
        dummy.position.set(body.x, wave - 0.25 + bob, body.z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        buoys.current?.setMatrixAt(body.index, dummy.matrix);
        buoyTops.current?.setMatrixAt(body.index, dummy.matrix);
        lamps.current?.setMatrixAt(body.index, dummy.matrix);
      } else if (body.kind === 'crate') {
        dummy.position.set(body.x, wave - 0.1 + bob * 0.5, body.z);
        dummy.scale.setScalar(1.25);
        dummy.updateMatrix();
        crates.current?.setMatrixAt(body.index, dummy.matrix);
      } else if (duck.current) {
        duck.current.position.set(body.x, wave - 0.15 + bob, body.z);
        duck.current.quaternion.copy(dummy.quaternion);
      }
    }
    for (const mesh of [balls.current, buoys.current, buoyTops.current, lamps.current, crates.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
    const lampMaterial = lampGlow.current;
    if (lampMaterial) lampMaterial.emissiveIntensity = 0.3 + night * 3 * (Math.sin(time * 2.4) > 0.2 ? 1 : 0.25);
  });

  return (
    <group>
      <instancedMesh ref={balls} args={[ballGeometry, undefined, counts.ball]} castShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={buoys} args={[buoyGeometry, undefined, counts.buoy]} castShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={buoyTops} args={[topGeometry, undefined, counts.buoy]} castShadow raycast={() => null}>
        <meshStandardMaterial color="#d8473a" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[lampGeometry, undefined, counts.buoy]} raycast={() => null}>
        <meshStandardMaterial ref={lampGlow} color="#fff3d6" emissive="#ffd38a" emissiveIntensity={0.3} />
      </instancedMesh>
      <instancedMesh ref={crates} args={[undefined, crateMaterial, counts.crate]} castShadow raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <Duck duck={duck} />
      <Ripples />
    </group>
  );
}

