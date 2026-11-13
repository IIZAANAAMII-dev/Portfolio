'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Group, ShaderMaterial } from 'three';
import { boatState } from '@/lib/boat-state';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { IslandConfig } from '@/types';

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

export function IslandLife({ island, index }: { island: IslandConfig; index: number }) {
  return (
    <group>
      <IslandMotes island={island} index={index} />
    </group>
  );
}

