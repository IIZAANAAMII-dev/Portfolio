'use client';

import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import {
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Prop } from '@/components/islands/decor';
import { Fauna } from '@/components/world/Fauna';
import { Plankton } from '@/components/world/Plankton';
import { UnderwaterWorld } from '@/components/world/UnderwaterWorld';
import { FISH_SCHOOLS, type SpeciesActivity } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { animalRevealScale } from '@/lib/cinematic';
import { activityFactor, ecologyState } from '@/lib/ecology';
import { MODEL } from '@/lib/models';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, shortestAngle, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';

const LazyWorldBoundary = lazy(() => import('@/components/world/WorldBoundary').then((module) => ({
  default: module.WorldBoundary,
})));

const BASE = '/models/aquatic-quaternius';
const SPECIES = {
  reef: { file: 'Fish1.obj', colors: ['#2f8f91', '#79d0b3', '#f2c86e'] },
  blue: { file: 'Fish2.obj', colors: ['#4e91b8', '#8fd0ce', '#f0b45f'] },
  clown: { file: 'Fish3.obj', colors: ['#e88245', '#f6e6c8', '#343b47'] },
  shark: { file: 'Shark.obj', colors: ['#587786', '#b8ced0'] },
  glow: { file: 'Fish2.obj', colors: ['#48e8db', '#9cf7df', '#5ba9ff'] },
} as const;
type Species = keyof typeof SPECIES;

type FishPart = {
  geometry: BufferGeometry;
  material: Material | Material[];
};

/**
 * Le corps et la queue sont déformés dans le vertex shader. Le poids augmente vers
 * l'extrémité -Z (la queue des modèles Quaternius), les nageoires reçoivent un peu plus
 * d'amplitude, et phase/vitesse viennent d'attributs propres à chaque instance.
 */
function makeSwimMaterial(
  source: Material,
  color: string,
  species: Species,
  materialIndex: number,
  tailMin: number,
  tailMax: number,
  timeRef: { current: number },
) {
  const material = new MeshStandardMaterial({
    name: source.name,
    color,
    roughness: 0.78,
    metalness: 0,
    flatShading: true,
    emissive: species === 'glow' ? color : '#000000',
    emissiveIntensity: species === 'glow' ? 1.25 : 0,
  });
  const span = Math.max(tailMax - tailMin, 0.001);
  const tailStart = tailMin + span * 0.05;
  const tailEnd = tailMin + span * 0.72;
  const finFactor = source.name.toLowerCase().includes('fin') ? 1.16 : 1;

  material.onBeforeCompile = (shader) => {
    const timeUniform = {} as { value: number };
    Object.defineProperty(timeUniform, 'value', { get: () => timeRef.current });
    shader.uniforms.fishTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float fishPhase;
attribute float fishSpeed;
uniform float fishTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
float fishTail = 1.0 - smoothstep(${tailStart.toFixed(5)}, ${tailEnd.toFixed(5)}, position.z);
float fishWave = sin(fishTime * fishSpeed - position.z * 0.82 + fishPhase);
float fishBodyAmplitude = 0.022 + pow(fishTail, 1.45) * 0.285;
transformed.x += fishWave * fishBodyAmplitude * ${finFactor.toFixed(2)};
transformed.y += sin(fishTime * fishSpeed * 0.54 - position.z * 0.38 + fishPhase) * fishTail * 0.012 * ${finFactor.toFixed(2)};`,
      );
  };
  material.customProgramCacheKey = () => `fish-swim-${species}-${materialIndex}`;
  return material;
}

function useCreatureParts(
  species: Species,
  phases: Float32Array,
  speeds: Float32Array,
  timeRef: { current: number },
) {
  const definition = SPECIES[species];
  const source = useLoader(OBJLoader, `${BASE}/${definition.file}`);

  return useMemo<FishPart[]>(() => {
    const parts: FishPart[] = [];
    source.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const geometry = child.geometry.clone();
      geometry.computeBoundingBox();
      const tailMin = geometry.boundingBox?.min.z ?? -1;
      const tailMax = geometry.boundingBox?.max.z ?? 1;
      geometry.setAttribute('fishPhase', new InstancedBufferAttribute(phases, 1));
      geometry.setAttribute('fishSpeed', new InstancedBufferAttribute(speeds, 1));

      const originals = Array.isArray(child.material) ? child.material : [child.material];
      const materials = originals.map((original, index) =>
        makeSwimMaterial(
          original,
          definition.colors[index % definition.colors.length],
          species,
          index,
          tailMin,
          tailMax,
          timeRef,
        ),
      );
      parts.push({
        geometry,
        material: Array.isArray(child.material) ? materials : materials[0],
      });
    });
    return parts;
  }, [definition.colors, phases, source, species, speeds, timeRef]);
}

type Agents = {
  phase: Float32Array;
  cruise: Float32Array;
  turnRate: Float32Array;
  depth: Float32Array;
  size: Float32Array;
  x: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vz: Float32Array;
  ax: Float32Array;
  az: Float32Array;
  yaw: Float32Array;
  bank: Float32Array;
};

function createAgents(
  species: Species,
  count: number,
  radius: number,
  depth: number,
  seed: number,
  scale: number,
): Agents {
  const result: Agents = {
    phase: new Float32Array(count), cruise: new Float32Array(count),
    turnRate: new Float32Array(count), depth: new Float32Array(count),
    size: new Float32Array(count), x: new Float32Array(count), z: new Float32Array(count),
    vx: new Float32Array(count), vz: new Float32Array(count),
    ax: new Float32Array(count), az: new Float32Array(count),
    yaw: new Float32Array(count), bank: new Float32Array(count),
  };
  for (let index = 0; index < count; index++) {
    const angle = hash(seed + index * 4.17) * Math.PI * 2;
    // Formation volontairement lâche : certains individus explorent presque tout
    // le rayon du banc au lieu de rester empilés autour du leader.
    const spread = radius * (0.24 + hash(seed + index * 7.31) * 0.82);
    const cruise = (species === 'shark' ? 0.74 : 1.05) * (0.78 + hash(seed + index * 2.63) * 0.42);
    result.phase[index] = hash(seed + index * 4.17) * Math.PI * 2;
    result.cruise[index] = cruise;
    result.turnRate[index] = 0.62 + hash(seed + index * 6.41) * 0.42;
    result.depth[index] = depth - hash(seed + index * 9.11) * 1.3;
    result.size[index] = scale * 0.42 * (0.75 + hash(seed + index * 5.71) * 0.4);
    result.x[index] = Math.cos(angle) * spread;
    result.z[index] = Math.sin(angle) * spread;
    result.vx[index] = -Math.sin(angle) * cruise;
    result.vz[index] = Math.cos(angle) * cruise;
    result.yaw[index] = Math.atan2(result.vx[index], result.vz[index]);
  }
  return result;
}

function setInstanceCount(meshes: InstancedMesh[], count: number) {
  for (const mesh of meshes) if (mesh) mesh.count = count;
}

function markInstanceMatricesForUpload(meshes: InstancedMesh[]) {
  for (const mesh of meshes) if (mesh) mesh.instanceMatrix.needsUpdate = true;
}

function FishSchool({
  species,
  center,
  route,
  travelSpeed = 0.36,
  count,
  radius,
  depth,
  seed,
  scale = 0.42,
  activity,
}: {
  species: Species;
  center: [number, number];
  route?: [number, number][];
  travelSpeed?: number;
  count: number;
  radius: number;
  depth: number;
  seed: number;
  scale?: number;
  activity?: SpeciesActivity;
}) {
  const group = useRef<Group>(null);
  const meshes = useRef<InstancedMesh[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const updateAccumulator = useRef(0);
  const timeRef = useRef(0);
  const agentsRef = useRef<Agents | null>(null);
  const initialAgents = useMemo(
    () => createAgents(species, count, radius, depth, seed, scale),
    [count, depth, radius, scale, seed, species],
  );
  const routeData = useMemo(() => {
    const points = route && route.length > 1 ? route : [center];
    const lengths: number[] = [];
    let total = 0;
    if (points.length > 1) {
      for (let index = 0; index < points.length; index++) {
        const from = points[index];
        const to = points[(index + 1) % points.length];
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        lengths.push(length);
        total += length;
      }
    }
    return { points, lengths, total };
  }, [center, route]);

  const shaderSpeeds = useMemo(() => {
    const values = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      values[index] = 2.2 + initialAgents.cruise[index] * 1.35;
    }
    return values;
  }, [count, initialAgents]);
  const parts = useCreatureParts(species, initialAgents.phase, shaderSpeeds, timeRef);

  useLayoutEffect(() => {
    agentsRef.current = createAgents(species, count, radius, depth, seed, scale);
    for (let index = 0; index < count; index++) {
      dummy.position.set(initialAgents.x[index], initialAgents.depth[index], initialAgents.z[index]);
      dummy.rotation.set(0, initialAgents.yaw[index], 0);
      dummy.scale.setScalar(initialAgents.size[index]);
      dummy.updateMatrix();
      for (const mesh of meshes.current) mesh?.setMatrixAt(index, dummy.matrix);
    }
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;
    }
  }, [count, depth, dummy, initialAgents, radius, scale, seed, species]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const agents = agentsRef.current;
    if (!agents) return;
    const time = state.clock.elapsedTime;
    timeRef.current = time;

    // Le groupe entier suit une boucle entre plusieurs îles. Les poissons restent
    // en coordonnées locales : leur boids continue donc de fonctionner sans recréer
    // les instances, tandis que le leader se déplace réellement dans le monde.
    let leaderX = center[0];
    let leaderZ = center[1];
    if (routeData.total > 0) {
      let cursor = (time * travelSpeed + hash(seed * 2.71) * routeData.total) % routeData.total;
      for (let index = 0; index < routeData.lengths.length; index++) {
        const segmentLength = routeData.lengths[index];
        if (cursor <= segmentLength || index === routeData.lengths.length - 1) {
          const from = routeData.points[index];
          const to = routeData.points[(index + 1) % routeData.points.length];
          const segmentProgress = smoothstep(0, 1, clamp(cursor / Math.max(segmentLength, 0.001), 0, 1));
          leaderX = from[0] + (to[0] - from[0]) * segmentProgress;
          leaderZ = from[1] + (to[1] - from[1]) * segmentProgress;
          break;
        }
        cursor -= segmentLength;
      }
    }
    group.current.position.set(leaderX, 0, leaderZ);

    const world = useWorld.getState();
    const revealDistance = Math.hypot(
      leaderX - world.introCenter[0],
      leaderZ - world.introCenter[1],
    );
    const revealScale = world.reducedMotion
      ? (world.reveal > 0.01 ? 1 : 0)
      : animalRevealScale(revealDistance, world.introRadius, hash(seed * 4.13) * 2.8);
    const frameDt = Math.min(delta, 1 / 30);
    const currentScale = damp(group.current.scale.x, revealScale, 9, frameDt);
    group.current.scale.setScalar(currentScale);

    const quality = world.quality;
    const config = QUALITY_LEVELS[quality];
    // Le banc apparaît bien avant d'arriver dessus. La couronne lointaine tourne à
    // basse fréquence et avec moins d'instances, donc son coût reste contenu.
    const simulationDistance = quality === 'high' ? 132 : quality === 'medium' ? 98 : 72;
    const dx = boatState.position.x - leaderX;
    const dz = boatState.position.z - leaderZ;
    const distance = Math.hypot(dx, dz);
    const ecologicalActivity = activityFactor(activity ?? (species === 'shark' ? 'predator' : 'day'))
      * ecologyState.worldLife;
    const visible = currentScale > 0.006 && distance < simulationDistance && ecologicalActivity > 0.025;
    group.current.visible = visible;
    if (!visible) return;

    // Population légèrement réduite, mais toujours visible de loin et bien répartie.
    let lodDensity = config.fishDensity * 0.82;
    let updateInterval = 0;
    if (distance > simulationDistance * 0.72) {
      lodDensity *= 0.28;
      updateInterval = 1 / 6;
    } else if (distance > simulationDistance * 0.43) {
      lodDensity *= 0.62;
      updateInterval = 1 / 12;
    }
    // La nuit, les poissons diurnes se raréfient fortement (ce sont les méduses
    // bioluminescentes qui prennent le relais) ; le requin, lui, rôde toujours.
    lodDensity *= ecologicalActivity;
    const activeCount = Math.max(species === 'shark' ? 1 : 0, Math.ceil(count * lodDensity));
    setInstanceCount(meshes.current, activeCount);

    updateAccumulator.current += Math.min(delta, 0.1);
    if (updateInterval && updateAccumulator.current < updateInterval) return;
    const dt = Math.min(updateAccumulator.current, 0.1);
    updateAccumulator.current = 0;

    const schoolX = Math.sin(time * 0.035 + seed) * radius * 0.27;
    const schoolZ = Math.cos(time * 0.029 + seed * 1.7) * radius * 0.22;
    const localBoatX = boatState.position.x - leaderX;
    const localBoatZ = boatState.position.z - leaderZ;

    for (let index = 0; index < activeCount; index++) {
      let cohesionX = 0;
      let cohesionZ = 0;
      let alignmentX = 0;
      let alignmentZ = 0;
      let separationX = 0;
      let separationZ = 0;
      let neighbours = 0;

      for (let other = 0; other < activeCount; other++) {
        if (index === other) continue;
        const fishDx = agents.x[other] - agents.x[index];
        const fishDz = agents.z[other] - agents.z[index];
        const distanceSq = fishDx * fishDx + fishDz * fishDz;
        if (distanceSq < 56) {
          cohesionX += agents.x[other];
          cohesionZ += agents.z[other];
          alignmentX += agents.vx[other];
          alignmentZ += agents.vz[other];
          neighbours++;
        }
        if (distanceSq > 0.001 && distanceSq < 9.2) {
          separationX -= fishDx / distanceSq;
          separationZ -= fishDz / distanceSq;
        }
      }

      let forceX = separationX * 0.76;
      let forceZ = separationZ * 0.76;
      if (neighbours) {
        forceX += (cohesionX / neighbours - agents.x[index]) * 0.016
          + (alignmentX / neighbours - agents.vx[index]) * 0.1;
        forceZ += (cohesionZ / neighbours - agents.z[index]) * 0.016
          + (alignmentZ / neighbours - agents.vz[index]) * 0.1;
      }
      forceX += Math.sin(time * (0.19 + index * 0.007) + agents.phase[index]) * 0.17;
      forceZ += Math.cos(time * (0.16 + index * 0.009) + agents.phase[index] * 1.3) * 0.17;

      const homeX = schoolX - agents.x[index];
      const homeZ = schoolZ - agents.z[index];
      const homeDistance = Math.hypot(homeX, homeZ);
      const boundary = clamp((homeDistance - radius * 0.9) / (radius * 0.85), 0, 1);
      if (homeDistance > 0.001) {
        forceX += homeX / homeDistance * boundary * 0.38;
        forceZ += homeZ / homeDistance * boundary * 0.38;
      }

      // Réaction au bateau : les petits poissons s'écartent à courte distance
      // (le banc se fend puis se reforme), le requin garde ses distances de loin.
      const avoidRadius = species === 'shark' ? 26 : 11;
      const avoidForce = species === 'shark' ? 0.5 : 1.15;
      const boatX = agents.x[index] - localBoatX;
      const boatZ = agents.z[index] - localBoatZ;
      const boatDistance = Math.hypot(boatX, boatZ);
      const avoid = clamp((avoidRadius - boatDistance) / avoidRadius, 0, 1);
      if (boatDistance > 0.001 && avoid > 0) {
        forceX += boatX / boatDistance * avoid * avoidForce;
        forceZ += boatZ / boatDistance * avoid * avoidForce;
      }

      const forceLength = Math.hypot(forceX, forceZ);
      const maxForce = species === 'shark' ? 0.26 : 0.4;
      if (forceLength > maxForce) {
        forceX = forceX / forceLength * maxForce;
        forceZ = forceZ / forceLength * maxForce;
      }
      agents.ax[index] = forceX;
      agents.az[index] = forceZ;
    }

    for (let index = 0; index < activeCount; index++) {
      agents.vx[index] += agents.ax[index] * dt;
      agents.vz[index] += agents.az[index] * dt;
      const speedPulse = 1 + Math.sin(time * 0.27 + agents.phase[index] * 1.7) * 0.075;
      const boatDistance = Math.hypot(agents.x[index] - localBoatX, agents.z[index] - localBoatZ);
      const targetSpeed = agents.cruise[index] * speedPulse
        * (1 + clamp((11 - boatDistance) / 11, 0, 0.28));
      const currentSpeed = Math.max(Math.hypot(agents.vx[index], agents.vz[index]), 0.001);
      const correctedSpeed = currentSpeed + (targetSpeed - currentSpeed) * (1 - Math.exp(-1.1 * dt));
      agents.vx[index] *= correctedSpeed / currentSpeed;
      agents.vz[index] *= correctedSpeed / currentSpeed;
      agents.x[index] += agents.vx[index] * dt;
      agents.z[index] += agents.vz[index] * dt;

      const desiredYaw = Math.atan2(agents.vx[index], agents.vz[index]);
      const yawDelta = clamp(
        shortestAngle(agents.yaw[index], desiredYaw),
        -agents.turnRate[index] * dt,
        agents.turnRate[index] * dt,
      );
      agents.yaw[index] += yawDelta;
      const targetBank = clamp(-yawDelta / Math.max(dt, 0.001), -0.13, 0.13);
      agents.bank[index] += (targetBank - agents.bank[index]) * (1 - Math.exp(-2.4 * dt));

      dummy.position.set(
        agents.x[index],
        agents.depth[index] + Math.sin(time * 0.52 + agents.phase[index]) * 0.16,
        agents.z[index],
      );
      dummy.rotation.set(
        Math.sin(time * (1.1 + agents.cruise[index] * 0.45) + agents.phase[index]) * 0.018,
        agents.yaw[index],
        agents.bank[index],
      );
      dummy.scale.setScalar(agents.size[index]);
      dummy.updateMatrix();
      for (const mesh of meshes.current) mesh?.setMatrixAt(index, dummy.matrix);
    }
    markInstanceMatricesForUpload(meshes.current);
  });

  return (
    <group ref={group} position={[center[0], 0, center[1]]}>
      {parts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => { if (mesh) meshes.current[index] = mesh; }}
          args={[part.geometry, part.material, count]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function DistantBoat() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    if (useWorld.getState().quality === 'low') {
      group.current.visible = false;
      return;
    }
    const time = state.clock.elapsedTime;
    const angle = time * 0.018 + 2.4;
    const x = Math.cos(angle) * 112;
    const z = Math.sin(angle) * 82;
    group.current.visible = useWorld.getState().reveal > 0.82;
    group.current.position.set(x, waveHeight(x, z, time) - 0.05, z);
    group.current.rotation.y = -angle + Math.PI * 0.5;
    group.current.rotation.z = Math.sin(time * 0.7) * 0.035;
  });
  return (
    <group ref={group} scale={0.8}>
      <Prop name={MODEL.rowBoat} />
      <Prop name={MODEL.paddle} position={[-0.1, 0.65, 0.5]} rotation={0.4} scale={0.8} />
    </group>
  );
}

/** Les effets sous-marins de la limite ne sont montés qu'au premier avertissement. */
function DeferredWorldBoundary() {
  const [enabled, setEnabled] = useState(false);
  useFrame(() => {
    if (!enabled && ecologyState.boundaryWarning > 0.035) setEnabled(true);
  });
  return enabled ? (
    <Suspense fallback={null}>
      <LazyWorldBoundary />
    </Suspense>
  ) : null;
}

export function MarineLife({ mobile }: { mobile: boolean }) {
  // Les bancs sont définis par zones écologiques (plages, rochers, eau profonde) :
  // voir data/zones.ts. Sur mobile on garde une zone représentative de chaque type.
  const schools = mobile
    ? FISH_SCHOOLS.filter((_, index) => index % 2 === 0)
    : FISH_SCHOOLS;
  return (
    <group>
      {schools.map((school) => (
        <FishSchool
          key={school.seed}
          species={school.species}
          center={school.center}
          route={school.route}
          travelSpeed={school.travelSpeed}
          count={school.count}
          radius={school.radius}
          depth={school.depth}
          seed={school.seed}
          scale={school.scale}
          activity={school.activity}
        />
      ))}
      <Fauna mobile={mobile} />
      <UnderwaterWorld mobile={mobile} />
      <Plankton />
      <DeferredWorldBoundary />
      {!mobile && <DistantBoat />}
    </group>
  );
}
