'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { IslandConfig } from '@/types';

const CRAB_URL = '/models/living-ocean/crab.glb';
const CRAB_ISLANDS = new Set<IslandConfig['id']>(['about', 'projects', 'journey', 'contact']);

const moteVertex = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uNight;
uniform float uSize;
varying float vPulse;
void main() {
  vec3 p = position;
  float flutter = sin(uTime * (0.75 + aPhase * 0.3) + aPhase * 6.2831);
  p.x += sin(uTime * 0.34 + aPhase * 11.0) * 0.72;
  p.z += cos(uTime * 0.29 + aPhase * 9.0) * 0.72;
  p.y += flutter * (0.24 + uNight * 0.12);
  vPulse = 0.55 + 0.45 * sin(uTime * (1.1 + aPhase) + aPhase * 17.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * (150.0 / max(1.0, -mv.z)) * (0.78 + vPulse * 0.3), 1.0, 5.5);
  gl_Position = projectionMatrix * mv;
}
`;

const moteFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uNight;
varying float vPulse;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float shape = smoothstep(0.5, 0.12, length(q));
  float alpha = shape * uOpacity * mix(0.45, 0.65 + vPulse * 0.35, uNight);
  if (alpha < 0.015) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/** Pollen le jour, lucioles la nuit : une seule petite passe de points par île. */
function IslandMotes({ island, index }: { island: IslandConfig; index: number }) {
  const group = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const count = island.id === 'about' || island.id === 'journey' ? 14 : 10;
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let item = 0; item < count; item++) {
      const angle = hash(index * 31 + item * 3.17) * Math.PI * 2;
      const radius = island.radius * (0.18 + hash(index * 19 + item * 7.11) * 0.52);
      positions[item * 3] = Math.cos(angle) * radius;
      positions[item * 3 + 1] = 1.3 + hash(index * 13 + item * 5.7) * (island.elevation * 0.52 + 1.8);
      positions[item * 3 + 2] = Math.sin(angle) * radius;
      phases[item] = hash(index * 23 + item * 4.9);
    }
    return { positions, phases };
  }, [count, index, island.elevation, island.radius]);
  const dayColor = useMemo(() => new Color(island.accent).lerp(new Color('#fff0bd'), 0.55), [island.accent]);
  const nightColor = useMemo(
    () => new Color(island.id === 'projects' ? '#7ff4e8' : '#ffd47a'),
    [island.id],
  );
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNight: { value: 0 },
    uSize: { value: 1.8 },
    uColor: { value: dayColor.clone() },
    uOpacity: { value: 0 },
  }), [dayColor]);

  useFrame((state) => {
    if (!group.current || !material.current) return;
    const world = useWorld.getState();
    const distance = Math.hypot(
      boatState.position.x - island.position[0],
      boatState.position.z - island.position[1],
    );
    const qualityFactor = world.quality === 'high' ? 1 : world.quality === 'medium' ? 0.72 : 0;
    const nearby = distance < (world.quality === 'high' ? 105 : 78);
    group.current.visible = qualityFactor > 0 && nearby;
    if (!group.current.visible) return;
    const night = skyState.dayNight;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uNight.value = night;
    material.current.uniforms.uSize.value = 1.65 + night * 0.85;
    material.current.uniforms.uOpacity.value = qualityFactor * (0.28 + night * 0.58);
    material.current.uniforms.uColor.value.copy(dayColor).lerp(nightColor, night);
  });

  return (
    <group ref={group}>
      <points frustumCulled={false} renderOrder={9}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={moteVertex}
          fragmentShader={moteFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Un crabe animé rare sur les plages, avec une vraie animation de marche CC0. */
function BeachCrab({ island, index }: { island: IslandConfig; index: number }) {
  const root = useRef<Group>(null);
  const gltf = useGLTF(CRAB_URL);
  const asset = useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene);
    const size = new Box3().setFromObject(scene).getSize(new Vector3());
    const scalar = 1.15 / Math.max(size.x, size.y, size.z, 0.001);
    scene.scale.setScalar(scalar);
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
    const mixer = new AnimationMixer(scene);
    const walk = gltf.animations.find((clip) => /walk/i.test(clip.name)) ?? gltf.animations[0];
    if (walk) mixer.clipAction(walk).setEffectiveTimeScale(0.72).play();
    return { scene, mixer };
  }, [gltf]);

  useEffect(() => () => {
    asset.mixer.stopAllAction();
  }, [asset]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const world = useWorld.getState();
    const distance = Math.hypot(
      boatState.position.x - island.position[0],
      boatState.position.z - island.position[1],
    );
    const visible = world.quality !== 'low'
      && distance < 92
      && ecologyState.dayFish * ecologyState.worldLife > 0.08;
    root.current.visible = visible;
    if (!visible) return;
    asset.mixer.update(Math.min(delta, 1 / 24));
    const phase = hash(index * 8.17 + 3) * Math.PI * 2;
    const arc = island.dockAngle + 1.35 + Math.sin(state.clock.elapsedTime * 0.13 + phase) * 0.52;
    const coast = island.radius * 0.91;
    root.current.position.set(Math.cos(arc) * coast, 0.24, Math.sin(arc) * coast);
    root.current.rotation.y = -arc + Math.PI * 0.5;
  });

  return <group ref={root}><primitive object={asset.scene} /></group>;
}

export function IslandLife({ island, index }: { island: IslandConfig; index: number }) {
  return (
    <group>
      <IslandMotes island={island} index={index} />
      {CRAB_ISLANDS.has(island.id) && <BeachCrab island={island} index={index} />}
    </group>
  );
}

useGLTF.preload(CRAB_URL);
