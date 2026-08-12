'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Prop } from '@/components/islands/decor';
import { boatState } from '@/lib/boat-state';
import { MODEL } from '@/lib/models';
import { useWorld } from '@/lib/store';
import { clamp, hash, shortestAngle } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';

const BASE = '/models/aquatic-quaternius';
const SPECIES = {
  reef: { file: 'Fish1.obj', colors: ['#2f8f91', '#79d0b3', '#f2c86e'] },
  blue: { file: 'Fish2.obj', colors: ['#4e91b8', '#8fd0ce', '#f0b45f'] },
  clown: { file: 'Fish3.obj', colors: ['#e88245', '#f6e6c8', '#343b47'] },
  shark: { file: 'Shark.obj', colors: ['#587786', '#b8ced0'] },
} as const;
type Species = keyof typeof SPECIES;

function useCreatureModel(species: Species) {
  const definition = SPECIES[species];
  const source = useLoader(OBJLoader, `${BASE}/${definition.file}`);
  return useMemo(() => {
    const clone = source.clone(true);
    let materialIndex = 0;
    clone.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      child.material = materials.map((material) => new MeshStandardMaterial({
        name: material.name,
        color: definition.colors[materialIndex++ % definition.colors.length],
        roughness: 0.78,
        metalness: 0,
        flatShading: true,
      }));
      child.castShadow = false;
      child.receiveShadow = false;
    });
    return clone;
  }, [definition.colors, source]);
}

type Agent = {
  phase: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  cruise: number;
  turnRate: number;
  depth: number;
  size: number;
  yaw: number;
};

function FishSchool({ species, center, count, radius, depth, seed, scale = 0.42 }: {
  species: Species;
  center: [number, number];
  count: number;
  radius: number;
  depth: number;
  seed: number;
  scale?: number;
}) {
  const source = useCreatureModel(species);
  const group = useRef<Group>(null);
  const fish = useMemo(() => Array.from({ length: count }, () => source.clone(true)), [count, source]);
  const agents = useMemo<Agent[]>(() => Array.from({ length: count }, (_, index) => {
    const angle = hash(seed + index * 4.17) * Math.PI * 2;
    const spread = radius * (0.18 + hash(seed + index * 7.31) * 0.62);
    const cruise = (species === 'shark' ? 0.7 : 0.92) * (0.82 + hash(seed + index * 2.63) * 0.36);
    const individualDepth = depth - hash(seed + index * 9.11) * 1.3;
    return {
      phase: hash(seed + index * 4.17) * Math.PI * 2,
      position: new Vector3(center[0] + Math.cos(angle) * spread, individualDepth, center[1] + Math.sin(angle) * spread),
      velocity: new Vector3(-Math.sin(angle) * cruise, 0, Math.cos(angle) * cruise),
      acceleration: new Vector3(),
      cruise,
      turnRate: 0.68 + hash(seed + index * 6.41) * 0.38,
      depth: individualDepth,
      size: scale * 0.42 * (0.75 + hash(seed + index * 5.71) * 0.4),
      yaw: angle - Math.PI * 0.5,
    };
  }), [center, count, depth, radius, scale, seed, species]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    group.current.visible = useWorld.getState().reveal > 0.75;
    const schoolX = center[0] + Math.sin(time * 0.035 + seed) * radius * 0.48;
    const schoolZ = center[1] + Math.cos(time * 0.029 + seed * 1.7) * radius * 0.38;

    agents.forEach((agent, index) => {
      let cohesionX = 0, cohesionZ = 0, alignmentX = 0, alignmentZ = 0;
      let separationX = 0, separationZ = 0, neighbours = 0;
      agents.forEach((other, otherIndex) => {
        if (index === otherIndex) return;
        const dx = other.position.x - agent.position.x;
        const dz = other.position.z - agent.position.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < 42) {
          cohesionX += other.position.x;
          cohesionZ += other.position.z;
          alignmentX += other.velocity.x;
          alignmentZ += other.velocity.z;
          neighbours += 1;
        }
        if (distanceSq > 0.001 && distanceSq < 5.8) {
          separationX -= dx / distanceSq;
          separationZ -= dz / distanceSq;
        }
      });

      let forceX = separationX * 0.58;
      let forceZ = separationZ * 0.58;
      if (neighbours) {
        forceX += (cohesionX / neighbours - agent.position.x) * 0.035
          + (alignmentX / neighbours - agent.velocity.x) * 0.16;
        forceZ += (cohesionZ / neighbours - agent.position.z) * 0.035
          + (alignmentZ / neighbours - agent.velocity.z) * 0.16;
      }
      forceX += Math.sin(time * (0.19 + index * 0.007) + agent.phase) * 0.11;
      forceZ += Math.cos(time * (0.16 + index * 0.009) + agent.phase * 1.3) * 0.11;

      const homeX = schoolX - agent.position.x;
      const homeZ = schoolZ - agent.position.z;
      const homeDistance = Math.hypot(homeX, homeZ);
      const boundary = clamp((homeDistance - radius * 0.5) / radius, 0, 1);
      if (homeDistance > 0.001) {
        forceX += homeX / homeDistance * boundary * 0.62;
        forceZ += homeZ / homeDistance * boundary * 0.62;
      }

      const boatX = agent.position.x - boatState.position.x;
      const boatZ = agent.position.z - boatState.position.z;
      const boatDistance = Math.hypot(boatX, boatZ);
      const avoid = clamp((11 - boatDistance) / 11, 0, 1);
      if (boatDistance > 0.001 && avoid > 0) {
        forceX += boatX / boatDistance * avoid * 1.15;
        forceZ += boatZ / boatDistance * avoid * 1.15;
      }

      const forceLength = Math.hypot(forceX, forceZ);
      const maxForce = species === 'shark' ? 0.26 : 0.4;
      if (forceLength > maxForce) {
        forceX = forceX / forceLength * maxForce;
        forceZ = forceZ / forceLength * maxForce;
      }
      agent.acceleration.set(forceX, 0, forceZ);
    });

    agents.forEach((agent) => {
      agent.velocity.addScaledVector(agent.acceleration, dt);
      const boatDistance = Math.hypot(agent.position.x - boatState.position.x, agent.position.z - boatState.position.z);
      const targetSpeed = agent.cruise * (1 + clamp((11 - boatDistance) / 11, 0, 0.28));
      const currentSpeed = Math.max(Math.hypot(agent.velocity.x, agent.velocity.z), 0.001);
      const correctedSpeed = currentSpeed + (targetSpeed - currentSpeed) * (1 - Math.exp(-1.1 * dt));
      agent.velocity.multiplyScalar(correctedSpeed / currentSpeed);
      agent.position.addScaledVector(agent.velocity, dt);
      agent.position.y += (agent.depth - agent.position.y) * (1 - Math.exp(-0.75 * dt));
      agent.position.y += Math.sin(time * 0.52 + agent.phase) * 0.0025;
    });

    group.current.children.forEach((child, index) => {
      const agent = agents[index];
      child.position.copy(agent.position);
      const desiredYaw = Math.atan2(agent.velocity.z, agent.velocity.x) - Math.PI;
      const yawDelta = clamp(shortestAngle(agent.yaw, desiredYaw), -agent.turnRate * dt, agent.turnRate * dt);
      agent.yaw += yawDelta;
      child.rotation.y = agent.yaw;
      child.rotation.x = Math.sin(time * (1.25 + agent.cruise * 0.7) + agent.phase) * 0.018;
      const bank = clamp(-yawDelta / Math.max(dt, 0.001), -0.13, 0.13);
      child.rotation.z += (bank - child.rotation.z) * (1 - Math.exp(-2.4 * dt));
      child.scale.setScalar(agent.size);
    });
  });

  return <group ref={group}>{fish.map((model, index) => <primitive key={index} object={model} />)}</group>;
}

function DistantBoat() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    const angle = time * 0.018 + 2.4;
    const x = Math.cos(angle) * 112;
    const z = Math.sin(angle) * 82;
    group.current.visible = useWorld.getState().reveal > 0.82;
    group.current.position.set(x, waveHeight(x, z, time) - 0.05, z);
    group.current.rotation.y = -angle + Math.PI * 0.5;
    group.current.rotation.z = Math.sin(time * 0.7) * 0.035;
  });
  return <group ref={group} scale={0.8}><Prop name={MODEL.rowBoat} /><Prop name={MODEL.paddle} position={[-0.1, 0.65, 0.5]} rotation={0.4} scale={0.8} /></group>;
}

export function MarineLife({ mobile }: { mobile: boolean }) {
  return (
    <group>
      <FishSchool species="reef" center={[-32, -18]} count={mobile ? 6 : 12} radius={10} depth={-0.9} seed={12} />
      <FishSchool species="blue" center={[35, -28]} count={mobile ? 6 : 11} radius={9} depth={-1.15} seed={31} scale={0.36} />
      <FishSchool species="clown" center={[46, 24]} count={mobile ? 5 : 10} radius={8} depth={-0.78} seed={57} scale={0.31} />
      <FishSchool species="shark" center={[-82, 72]} count={1} radius={25} depth={-1.5} seed={83} scale={0.42} />
      <DistantBoat />
    </group>
  );
}

Object.values(SPECIES).forEach(({ file }) => useLoader.preload(OBJLoader, `${BASE}/${file}`));
