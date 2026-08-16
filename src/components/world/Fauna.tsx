'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AnimationMixer,
  Box3,
  type BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { JELLYFISH_ZONES, RAY_ZONES, TURTLE_ZONES } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { animalRevealScale } from '@/lib/cinematic';
import { ecologyState } from '@/lib/ecology';
import { SOLIDS } from '@/lib/navigation';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { clamp, hash, shortestAngle } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';

const RAY_URL = '/models/aquatic-quaternius/extra/manta-ray.glb';
const DOLPHIN_URL = '/models/aquatic-quaternius/extra/dolphin.glb';
const TURTLE_URL = '/models/living-ocean/sea-turtle.glb';
const ANGLER_URL = '/models/living-ocean/anglerfish.glb';
const JELLY_URL = '/models/living-ocean/jellyfish.glb';
const PUFFER_URL = '/models/living-ocean/puffer.glb';
const JELLY_DAY = new Color('#8dbbc2');
const JELLY_NIGHT = new Color('#35e6ff');

function useJellyGeometry() {
  const gltf = useGLTF(JELLY_URL);
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    let found: Mesh | undefined;
    gltf.scene.traverse((child) => {
      if (!found && child instanceof Mesh) found = child;
    });
    if (!found) throw new Error('Jellyfish GLB contains no mesh');
    const source = found as Mesh;
    const geometry = source.geometry.clone() as BufferGeometry;
    geometry.applyMatrix4(source.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    const scalar = 1.15 / Math.max(size.x, size.y, size.z, 0.001);
    geometry.scale(scalar, scalar, scalar);
    geometry.computeVertexNormals();
    return geometry;
  }, [gltf]);
}

/** Clone un GLB animé (skinned) et le normalise à `targetSize` (plus grande dimension). */
function useAnimatedClones(url: string, count: number, targetSize: number) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    box.getSize(size);
    const scalar = targetSize / Math.max(size.x, size.y, size.z, 0.001);
    const clip = gltf.animations.find((c) => /swim/i.test(c.name)) ?? gltf.animations[0];

    return Array.from({ length: count }, () => {
      const scene = SkeletonUtils.clone(gltf.scene);
      const materials: MeshStandardMaterial[] = [];
      scene.scale.setScalar(scalar);
      scene.userData.baseScale = scalar;
      scene.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = false;
          const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
          sourceMaterials.forEach((material) => {
            if (material instanceof MeshStandardMaterial && !materials.includes(material)) materials.push(material);
          });
        }
      });
      const mixer = new AnimationMixer(scene);
      if (clip) mixer.clipAction(clip).play();
      return { scene, mixer, materials };
    });
  }, [count, gltf, targetSize]);
}

/** Force d'évitement des îles : renvoie un delta de cap à appliquer. */
function steerAwayFromIslands(x: number, z: number, heading: number, margin: number) {
  let steer = 0;
  for (const solid of SOLIDS) {
    const dx = x - solid.x;
    const dz = z - solid.z;
    const distance = Math.hypot(dx, dz) - solid.r;
    if (distance > margin) continue;
    const away = Math.atan2(dz, dx);
    const urgency = clamp(1 - distance / margin, 0, 1);
    steer += shortestAngle(heading, away) * urgency * 0.9;
  }
  return steer;
}

type Wanderer = {
  x: number;
  z: number;
  heading: number;
  phase: number;
};

/**
 * RAIES — près du fond, ondulation portée par l'animation du GLB (CC0, Quaternius).
 * Elles patrouillent lentement leur zone profonde et fuient doucement les côtes.
 */
function MantaRays({ mobile }: { mobile: boolean }) {
  const group = useRef<Group>(null);
  const zones = mobile ? RAY_ZONES.slice(0, 1) : RAY_ZONES;
  const clones = useAnimatedClones(RAY_URL, zones.length, 4.4);
  const agents = useRef<Wanderer[]>(
    zones.map((zone) => ({
      x: zone.center[0],
      z: zone.center[1],
      heading: hash(zone.seed) * Math.PI * 2,
      phase: hash(zone.seed * 3.7) * Math.PI * 2,
    })),
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const quality = useWorld.getState().quality;
    const config = QUALITY_LEVELS[quality];
    const simulationDistance = quality === 'high' ? 86 : quality === 'medium' ? 66 : 48;
    const world = useWorld.getState();
    group.current.visible = ecologyState.dayLarge * ecologyState.worldLife > 0.04;
    if (!group.current.visible) return;

    clones.forEach(({ scene, mixer }, index) => {
      const zone = zones[index];
      const agent = agents.current[index];
      const camDistance = Math.hypot(
        state.camera.position.x - agent.x,
        state.camera.position.z - agent.z,
      );
      const revealDistance = Math.hypot(
        agent.x - world.introCenter[0],
        agent.z - world.introCenter[1],
      );
      const revealScale = world.reducedMotion
        ? (world.reveal > 0.01 ? 1 : 0)
        : animalRevealScale(revealDistance, world.introRadius, hash(zone.seed * 2.9) * 2.4);
      scene.scale.setScalar((scene.userData.baseScale as number) * revealScale);
      const active = revealScale > 0.006
        && camDistance < Math.min(config.fishDistance, simulationDistance);
      scene.visible = active;
      if (!active) return; // population dynamique : pas de simulation hors champ

      mixer.update(dt * 0.55);

      // Errance : cap sinusoïdal + rappel vers la zone + évitement des îles.
      const homeDx = zone.center[0] - agent.x;
      const homeDz = zone.center[1] - agent.z;
      const homeDistance = Math.hypot(homeDx, homeDz);
      let desired = agent.heading + Math.sin(time * 0.11 + agent.phase) * 0.32 * dt;
      if (homeDistance > zone.radius) {
        desired += shortestAngle(desired, Math.atan2(homeDz, homeDx))
          * clamp((homeDistance - zone.radius) / 10, 0, 1);
      }
      desired += steerAwayFromIslands(agent.x, agent.z, desired, 10) * dt * 2.2;
      agent.heading += clamp(shortestAngle(agent.heading, desired), -0.5 * dt, 0.5 * dt);

      const speed = 1.35;
      agent.x += Math.cos(agent.heading) * speed * dt;
      agent.z += Math.sin(agent.heading) * speed * dt;

      scene.position.set(
        agent.x,
        -1.85 + Math.sin(time * 0.24 + agent.phase) * 0.22 - (1 - revealScale) * 0.32,
        agent.z,
      );
      scene.rotation.y = -agent.heading + Math.PI * 0.5;
      scene.rotation.z = Math.sin(time * 0.5 + agent.phase) * 0.08;
    });
  });

  return (
    <group ref={group}>
      {clones.map(({ scene }, index) => (
        <primitive key={index} object={scene} />
      ))}
    </group>
  );
}

/**
 * TORTUE MARINE — très rare (une seule), procédurale pour rester dans le langage
 * low-poly du monde. Nage lente, remonte respirer en surface puis redescend.
 */
function SeaTurtle() {
  const group = useRef<Group>(null);
  const flippers = useRef<Mesh[]>([]);
  const zone = TURTLE_ZONES[0];
  const agent = useRef<Wanderer>({
    x: zone.center[0],
    z: zone.center[1],
    heading: hash(zone.seed) * Math.PI * 2,
    phase: hash(zone.seed * 5.1) * Math.PI * 2,
  });

  const materials = useMemo(
    () => ({
      shell: new MeshStandardMaterial({ color: '#5f7d4f', roughness: 0.85, flatShading: true }),
      shellRim: new MeshStandardMaterial({ color: '#8aa06c', roughness: 0.9, flatShading: true }),
      skin: new MeshStandardMaterial({ color: '#a5b183', roughness: 0.95, flatShading: true }),
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const agentState = agent.current;
    const quality = useWorld.getState().quality;
    const config = QUALITY_LEVELS[quality];
    const simulationDistance = quality === 'high' ? 82 : quality === 'medium' ? 62 : 46;
    const camDistance = Math.hypot(
      boatState.position.x - agentState.x,
      boatState.position.z - agentState.z,
    );
    const world = useWorld.getState();
    const revealDistance = Math.hypot(
      agentState.x - world.introCenter[0],
      agentState.z - world.introCenter[1],
    );
    const revealScale = world.reducedMotion
      ? (world.reveal > 0.01 ? 1 : 0)
      : animalRevealScale(revealDistance, world.introRadius, hash(zone.seed * 2.9) * 2.4);
    const visible = revealScale > 0.006
      && camDistance < Math.min(config.fishDistance, simulationDistance);
    group.current.visible = visible;
    group.current.scale.setScalar(revealScale);
    if (!visible) return;

    // Errance très lente dans la grande boucle centrale.
    const homeDx = zone.center[0] - agentState.x;
    const homeDz = zone.center[1] - agentState.z;
    const homeDistance = Math.hypot(homeDx, homeDz);
    let desired = agentState.heading + Math.sin(time * 0.06 + agentState.phase) * 0.2 * dt;
    if (homeDistance > zone.radius) {
      desired += shortestAngle(desired, Math.atan2(homeDz, homeDx)) * 0.6;
    }
    desired += steerAwayFromIslands(agentState.x, agentState.z, desired, 9) * dt * 2;
    agentState.heading += clamp(shortestAngle(agentState.heading, desired), -0.3 * dt, 0.3 * dt);

    const speed = 0.62;
    agentState.x += Math.cos(agentState.heading) * speed * dt;
    agentState.z += Math.sin(agentState.heading) * speed * dt;

    // Cycle de respiration ~55 s : remonte près de la surface, souffle, redescend.
    const breathe = Math.sin(time * 0.115 + agentState.phase);
    const depth = -1.5 + Math.max(0, breathe - 0.55) * 2.6 + Math.sin(time * 0.3) * 0.1;
    group.current.position.set(agentState.x, Math.min(depth, -0.32), agentState.z);
    group.current.rotation.y = -agentState.heading;

    // Battement lent des nageoires avant, alterné.
    flippers.current.forEach((flipper, index) => {
      if (!flipper) return;
      const front = index < 2;
      const side = index % 2 === 0 ? 1 : -1;
      flipper.rotation.z = side * (0.25 + Math.sin(time * (front ? 1.05 : 0.7) + index) * (front ? 0.5 : 0.22));
    });
  });

  return (
    <group ref={group}>
      {/* Carapace */}
      <mesh material={materials.shell} scale={[1, 0.5, 1.25]}>
        <sphereGeometry args={[0.62, 8, 6]} />
      </mesh>
      <mesh material={materials.shellRim} position={[0, -0.14, 0]} scale={[1.12, 0.22, 1.36]}>
        <sphereGeometry args={[0.62, 8, 5]} />
      </mesh>
      {/* Tête */}
      <mesh material={materials.skin} position={[0.78, 0.02, 0]}>
        <sphereGeometry args={[0.2, 7, 6]} />
      </mesh>
      {/* Nageoires : avant (grandes) puis arrière (petites) */}
      {[
        [0.42, 0.62, 1],
        [0.42, -0.62, 0.9],
        [-0.55, 0.5, 0.55],
        [-0.55, -0.5, 0.55],
      ].map(([x, z, size], index) => (
        <mesh
          key={index}
          ref={(el) => { if (el) flippers.current[index] = el; }}
          material={materials.skin}
          position={[x, -0.05, z]}
          scale={[size, 0.3, size * 0.5]}
        >
          <sphereGeometry args={[0.42, 6, 4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Tortue GLB reconnaissable (Poly by Google, CC BY), conservee rare et diurne. */
function SeaTurtleAsset() {
  const group = useRef<Group>(null);
  const zone = TURTLE_ZONES[0];
  const clone = useAnimatedClones(TURTLE_URL, 1, 2.65)[0];
  const agent = useRef<Wanderer>({
    x: zone.center[0],
    z: zone.center[1],
    heading: hash(zone.seed) * Math.PI * 2,
    phase: hash(zone.seed * 5.1) * Math.PI * 2,
  });

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const current = agent.current;
    const distance = Math.hypot(
      boatState.position.x - current.x,
      boatState.position.z - current.z,
    );
    const quality = useWorld.getState().quality;
    const config = QUALITY_LEVELS[quality];
    const simulationDistance = quality === 'high' ? 82 : quality === 'medium' ? 62 : 46;
    const world = useWorld.getState();
    const revealDistance = Math.hypot(
      current.x - world.introCenter[0],
      current.z - world.introCenter[1],
    );
    const revealScale = world.reducedMotion
      ? (world.reveal > 0.01 ? 1 : 0)
      : animalRevealScale(revealDistance, world.introRadius, hash(zone.seed * 2.9) * 2.4);
    clone.scene.scale.setScalar((clone.scene.userData.baseScale as number) * revealScale);
    const activity = ecologyState.dayLarge * ecologyState.worldLife;
    group.current.visible = revealScale > 0.006
      && activity > 0.045 && distance < Math.min(config.fishDistance, simulationDistance);
    if (!group.current.visible) return;

    const homeDx = zone.center[0] - current.x;
    const homeDz = zone.center[1] - current.z;
    const homeDistance = Math.hypot(homeDx, homeDz);
    let desired = current.heading + Math.sin(time * 0.06 + current.phase) * 0.2 * dt;
    if (homeDistance > zone.radius) desired += shortestAngle(desired, Math.atan2(homeDz, homeDx)) * 0.6;
    desired += steerAwayFromIslands(current.x, current.z, desired, 9) * dt * 2;
    current.heading += clamp(shortestAngle(current.heading, desired), -0.3 * dt, 0.3 * dt);
    current.x += Math.cos(current.heading) * 0.62 * dt;
    current.z += Math.sin(current.heading) * 0.62 * dt;

    const breathe = Math.sin(time * 0.115 + current.phase);
    const depth = Math.min(-1.5 + Math.max(0, breathe - 0.55) * 2.6, -0.32);
    clone.scene.position.set(current.x, depth, current.z);
    clone.scene.rotation.set(
      Math.sin(time * 0.48 + current.phase) * 0.07,
      -current.heading + Math.PI * 0.5,
      Math.sin(time * 0.34 + current.phase) * 0.08,
    );
  });

  return <group ref={group}><primitive object={clone.scene} /></group>;
}

/**
 * MÉDUSES — uniquement dans deux poches (voir zones.ts). Pulsation du corps,
 * dérive verticale lente, et bioluminescence la nuit : quand les poissons
 * disparaissent, ce sont elles qui font vivre l'eau sombre.
 */
function JellyfishCluster({ center, radius, seed, geometry }: {
  center: [number, number]; radius: number; seed: number; geometry: BufferGeometry;
}) {
  const COUNT = 6;
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: JELLY_DAY,
        emissive: JELLY_NIGHT,
        emissiveIntensity: 0,
        roughness: 0.42,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  const drift = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, index) => ({
        x: (hash(seed + index * 3.1) - 0.5) * radius * 1.7,
        z: (hash(seed + index * 7.7) - 0.5) * radius * 1.7,
        phase: hash(seed + index * 5.3) * Math.PI * 2,
        size: 0.75 + hash(seed + index * 9.2) * 0.7,
      })),
    [radius, seed],
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const time = state.clock.elapsedTime;
    const quality = useWorld.getState().quality;
    const config = QUALITY_LEVELS[quality];
    const simulationDistance = quality === 'high' ? 82 : quality === 'medium' ? 64 : 48;
    const camDistance = Math.hypot(
      state.camera.position.x - center[0],
      state.camera.position.z - center[1],
    );
    const nightActivity = ecologyState.jellyfish * ecologyState.worldLife;
    const visible = useWorld.getState().reveal > 0.75
      && nightActivity > 0.018
      && camDistance < Math.min(config.fishDistance, simulationDistance);
    mesh.current.visible = visible;
    if (!visible) return;

    // Bioluminescence nocturne : l'émissif dépasse le seuil du bloom la nuit.
    const currentMaterial = mesh.current.material as MeshStandardMaterial;
    const glowPulse = 1 + nightActivity * (0.38 + Math.sin(time * 1.15 + seed) * 0.1);
    currentMaterial.color
      .copy(JELLY_DAY)
      .lerp(JELLY_NIGHT, nightActivity)
      .multiplyScalar(glowPulse);
    currentMaterial.emissive.copy(JELLY_NIGHT);
    currentMaterial.emissiveIntensity = nightActivity * (1.2 + Math.sin(time * 1.15 + seed) * 0.18);
    currentMaterial.opacity = nightActivity * 0.78;

    drift.forEach((jelly, index) => {
      const pulse = Math.sin(time * 1.45 + jelly.phase);
      const rise = Math.sin(time * 0.22 + jelly.phase * 1.7);
      dummy.position.set(
        center[0] + jelly.x + Math.sin(time * 0.1 + jelly.phase) * 1.2,
        -1.5 + rise * 0.75,
        center[1] + jelly.z + Math.cos(time * 0.08 + jelly.phase) * 1.2,
      );
      dummy.rotation.set(Math.sin(time * 0.3 + jelly.phase) * 0.14, jelly.phase, 0);
      dummy.scale.set(
        jelly.size * (1 - pulse * 0.11),
        jelly.size * (1 + pulse * 0.2),
        jelly.size * (1 - pulse * 0.11),
      );
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}

/**
 * DAUPHINS — un petit événement, pas un décor permanent. À intervalle rare, un pod
 * de trois dauphins rejoint le bateau, marsouine à ses côtés puis repart au large.
 */
function DolphinPod() {
  const group = useRef<Group>(null);
  const clones = useAnimatedClones(DOLPHIN_URL, 3, 2.7);
  const mode = useRef<'idle' | 'follow' | 'leave'>('idle');
  const timer = useRef(38 + hash(55.3) * 45); // première rencontre assez tôt
  const podX = useRef(0);
  const podZ = useRef(0);
  const podHeading = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const world = useWorld.getState();

    if (mode.current === 'idle') {
      group.current.visible = false;
      // Le compteur n'avance que pendant la navigation active : voir des dauphins
      // doit rester lié au fait de naviguer.
      if (world.phase === 'playing' && boatState.speed > 3.5) timer.current -= dt;
      if (timer.current <= 0) {
        mode.current = 'follow';
        timer.current = 19 + Math.random() * 7;
        const behind = boatState.heading + Math.PI + (Math.random() - 0.5) * 0.9;
        podX.current = boatState.position.x + Math.cos(behind) * 34;
        podZ.current = boatState.position.z + Math.sin(behind) * 34;
        podHeading.current = boatState.heading;
      }
      return;
    }

    group.current.visible = world.reveal > 0.75
      && ecologyState.dayLarge * ecologyState.worldLife > 0.08;
    timer.current -= dt;

    // Cible du pod : le flanc tribord du bateau en mode follow, le large en mode leave.
    let targetX: number;
    let targetZ: number;
    if (mode.current === 'follow') {
      const side = boatState.heading - Math.PI * 0.5;
      targetX = boatState.position.x + Math.cos(side) * 6 + Math.cos(boatState.heading) * 4;
      targetZ = boatState.position.z + Math.sin(side) * 6 + Math.sin(boatState.heading) * 4;
      if (timer.current <= 0 || world.phase !== 'playing') {
        mode.current = 'leave';
        timer.current = 9;
      }
    } else {
      targetX = podX.current + Math.cos(podHeading.current) * 60;
      targetZ = podZ.current + Math.sin(podHeading.current) * 60;
      if (timer.current <= 0) {
        mode.current = 'idle';
        timer.current = 90 + Math.random() * 110; // rare : pas toutes les 20 secondes
        return;
      }
    }

    const dx = targetX - podX.current;
    const dz = targetZ - podZ.current;
    const distance = Math.hypot(dx, dz);
    const desired = Math.atan2(dz, dx);
    podHeading.current += clamp(shortestAngle(podHeading.current, desired), -1.6 * dt, 1.6 * dt);
    const speed = mode.current === 'leave' ? 10.5 : clamp(distance * 0.9, 4, 15.5);
    podX.current += Math.cos(podHeading.current) * speed * dt;
    podZ.current += Math.sin(podHeading.current) * speed * dt;

    clones.forEach(({ scene, mixer }, index) => {
      mixer.update(dt * 1.35);
      const lateral = podHeading.current + Math.PI * 0.5;
      const offset = (index - 1) * 3.1;
      const trail = Math.abs(index - 1) * 2.2;
      const x = podX.current + Math.cos(lateral) * offset - Math.cos(podHeading.current) * trail;
      const z = podZ.current + Math.sin(lateral) * offset - Math.sin(podHeading.current) * trail;

      // Marsouinage : arcs sinusoïdaux qui sortent légèrement de l'eau.
      const arc = Math.sin(time * 2.05 + index * 2.1);
      const y = waveHeight(x, z, time) - 0.55 + Math.max(0, arc) * 1.15;
      scene.position.set(x, y, z);
      scene.rotation.y = -podHeading.current + Math.PI * 0.5;
      scene.rotation.x = -Math.cos(time * 2.05 + index * 2.1) * 0.42 * Math.max(0, Math.sign(arc + 0.25));
    });
  });

  return (
    <group ref={group} visible={false}>
      {clones.map(({ scene }, index) => (
        <primitive key={index} object={scene} />
      ))}
    </group>
  );
}

/** Predateur nocturne rare : deux baudroies animees, emissives, sans PointLight. */
function Anglerfish({ mobile }: { mobile: boolean }) {
  const group = useRef<Group>(null);
  const count = mobile ? 1 : 2;
  const clones = useAnimatedClones(ANGLER_URL, count, 2.5);
  const agents = useRef<Wanderer[]>(Array.from({ length: count }, (_, index) => ({
    x: JELLYFISH_ZONES[index].center[0] + 4,
    z: JELLYFISH_ZONES[index].center[1] - 3,
    heading: hash(index * 7.7 + 9) * Math.PI * 2,
    phase: hash(index * 4.1 + 3) * Math.PI * 2,
  })));

  useFrame((state, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30);
    const activity = ecologyState.nocturnalFish * ecologyState.predator * ecologyState.worldLife;
    group.current.visible = useWorld.getState().reveal > 0.75 && activity > 0.06;
    if (!group.current.visible) return;
    const quality = useWorld.getState().quality;
    const config = QUALITY_LEVELS[quality];
    const simulationDistance = quality === 'high' ? 84 : quality === 'medium' ? 64 : 48;
    const time = state.clock.elapsedTime;

    clones.forEach(({ scene, mixer, materials }, index) => {
      const zone = JELLYFISH_ZONES[index];
      const agent = agents.current[index];
      const distance = Math.hypot(boatState.position.x - agent.x, boatState.position.z - agent.z);
      scene.visible = distance < Math.min(config.fishDistance, simulationDistance);
      if (!scene.visible) return;
      mixer.update(dt * 0.72);
      const homeAngle = Math.atan2(zone.center[1] - agent.z, zone.center[0] - agent.x);
      const homeDistance = Math.hypot(zone.center[0] - agent.x, zone.center[1] - agent.z);
      let desired = agent.heading + Math.sin(time * 0.08 + agent.phase) * 0.22 * dt;
      if (homeDistance > zone.radius) desired += shortestAngle(desired, homeAngle) * 0.55;
      agent.heading += clamp(shortestAngle(agent.heading, desired), -0.34 * dt, 0.34 * dt);
      agent.x += Math.cos(agent.heading) * 0.56 * dt;
      agent.z += Math.sin(agent.heading) * 0.56 * dt;
      scene.position.set(agent.x, -1.55 + Math.sin(time * 0.28 + agent.phase) * 0.25, agent.z);
      scene.rotation.y = -agent.heading + Math.PI * 0.5;
      materials.forEach((item) => {
        item.emissive.copy(item.color).multiplyScalar(0.48);
        item.emissiveIntensity = activity * (0.72 + Math.sin(time * 1.4 + index) * 0.12);
      });
    });
  });

  return <group ref={group}>{clones.map(({ scene }, index) => <primitive key={index} object={scene} />)}</group>;
}

const PUFFER_HOMES: [number, number][] = [
  [-18, 12], [23, -17], [-43, 12], [41, 19],
];

/** Poissons-globes animés CC0 : petits solitaires autour des récifs, jamais en boule. */
function Pufferfish({ mobile }: { mobile: boolean }) {
  const group = useRef<Group>(null);
  const count = mobile ? 2 : PUFFER_HOMES.length;
  const clones = useAnimatedClones(PUFFER_URL, count, 1.45);

  useFrame((state, delta) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    const world = useWorld.getState();
    const activity = ecologyState.dayFish * ecologyState.worldLife;
    group.current.visible = activity > 0.045;
    if (!group.current.visible) return;
    const range = world.quality === 'high' ? 112 : world.quality === 'medium' ? 84 : 62;

    clones.forEach((clone, index) => {
      const home = PUFFER_HOMES[index];
      const phase = hash(index * 7.31 + 2) * Math.PI * 2;
      const orbit = time * (0.075 + index * 0.009) + phase;
      const x = home[0] + Math.cos(orbit) * (7 + index * 0.7);
      const z = home[1] + Math.sin(orbit * 0.83) * (6 + index * 0.5);
      const distance = Math.hypot(boatState.position.x - x, boatState.position.z - z);
      const revealDistance = Math.hypot(x - world.introCenter[0], z - world.introCenter[1]);
      const revealScale = world.reducedMotion
        ? (world.reveal > 0.01 ? 1 : 0)
        : animalRevealScale(revealDistance, world.introRadius, hash(index * 3.1) * 2);
      const visible = revealScale > 0.006 && distance < range;
      clone.scene.visible = visible;
      if (!visible) return;
      clone.mixer.update(Math.min(delta, 1 / 24) * 0.82);
      clone.scene.scale.setScalar((clone.scene.userData.baseScale as number) * revealScale);
      clone.scene.position.set(x, -1.05 + Math.sin(time * 0.42 + phase) * 0.24, z);
      clone.scene.rotation.set(
        Math.sin(time * 0.31 + phase) * 0.06,
        -orbit,
        Math.cos(time * 0.27 + phase) * 0.08,
      );
    });
  });

  return <group ref={group}>{clones.map(({ scene }, index) => <primitive key={index} object={scene} />)}</group>;
}

/**
 * Faune « spéciale » : raies, tortue, méduses, dauphins. Les bancs de poissons
 * ordinaires vivent dans MarineLife ; ici on gère les rencontres mémorables.
 * Sur mobile, les dauphins restent (l'événement vaut le coût), mais une seule
 * poche de méduses et une seule raie sont conservées.
 */
export function Fauna({ mobile }: { mobile: boolean }) {
  const jellyGeometry = useJellyGeometry();
  const jellyZones = mobile ? JELLYFISH_ZONES.slice(0, 1) : JELLYFISH_ZONES;
  return (
    <group>
      <MantaRays mobile={mobile} />
      <Pufferfish mobile={mobile} />
      <DolphinPod />
      <AssetBoundary fallback={<SeaTurtle />}>
        <SeaTurtleAsset />
      </AssetBoundary>
      <Anglerfish mobile={mobile} />
      {jellyZones.map((zone) => (
        <JellyfishCluster
          key={zone.seed}
          center={zone.center}
          radius={zone.radius}
          seed={zone.seed}
          geometry={jellyGeometry}
        />
      ))}
    </group>
  );
}
