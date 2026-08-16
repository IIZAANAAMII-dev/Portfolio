'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Group,
  LineBasicMaterial,
  LineSegments,
  PointLight,
  Points,
  ShaderMaterial,
} from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { clamp, hash } from '@/lib/utils/math';

// Un seul draw call : la densité augmente, pas le nombre d'objets Three.js.
const RAIN_COUNT = 560;

const rainVertex = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
void main() {
  vec3 p = position;
  float speed = 31.0 + fract(abs(position.x * 0.173 + position.z * 0.317)) * 29.0;
  p.y = mod(position.y - uTime * speed + 9.0, 68.0) - 9.0;
  p.x += sin(uTime * 1.3 + position.z * 0.17) * uIntensity * 4.2;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp((3.0 + uIntensity * 5.8) * (190.0 / -mvPosition.z), 1.1, 9.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const rainFragment = /* glsl */ `
uniform float uIntensity;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float streak = smoothstep(0.12, 0.025, abs(uv.x));
  float fade = smoothstep(0.5, 0.15, abs(uv.y));
  float alpha = streak * fade * uIntensity * 0.66;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(0.63, 0.76, 0.81, alpha);
}
`;

/** Pluie locale poolée + éclairs lointains. La couverture vit dans le shader du ciel. */
export function BoundaryStorm() {
  const root = useRef<Group>(null);
  const rain = useRef<Points>(null);
  const lightning = useRef<LineSegments>(null);
  const lightningLight = useRef<PointLight>(null);
  const lightningMaterial = useRef<LineBasicMaterial>(null);
  const audioClock = useRef(0);
  const storm = useRef({ flash: 0, next: 7.5, strikeX: 58, strikeZ: -42 });
  const rainUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }), []);

  const rainPositions = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let index = 0; index < RAIN_COUNT; index++) {
      positions[index * 3] = (hash(index * 3.17 + 8) - 0.5) * 108;
      positions[index * 3 + 1] = hash(index * 8.31 + 4) * 68 - 9;
      positions[index * 3 + 2] = (hash(index * 5.73 + 19) - 0.5) * 108;
    }
    return positions;
  }, []);

  const boltPositions = useMemo(() => new Float32Array([
    0, 92, 0, -2.5, 76, 0,
    -2.5, 76, 0, 2.2, 61, 0,
    2.2, 61, 0, -1.4, 45, 0,
    -1.4, 45, 0, 1.8, 31, 0,
    1.8, 31, 0, 0.4, 18, 0,
  ]), []);

  useEffect(() => () => {
    ambience.setBoundaryIntensity(0);
    ecologyState.stormFlash = 0;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const phase = useWorld.getState().phase;
    const active = phase === 'playing' || phase === 'docked';
    const hush = ecologyState.boundaryHush;
    const cover = active ? ecologyState.stormCover : 0;
    const rainStrength = active
      ? clamp(ecologyState.stormRain * 1.34 + ecologyState.boundaryDanger * 0.16, 0, 1)
        * (1 - hush * 0.72)
      : 0;
    const audioStrength = clamp(
      (ecologyState.stormWind * 0.55 + rainStrength * 0.45) * (1 - hush * 0.55),
      0,
      1,
    );

    if (root.current) {
      root.current.visible = cover > 0.015;
      root.current.position.set(boatState.position.x, 0, boatState.position.z);
    }
    const rainMaterial = rain.current?.material as ShaderMaterial | undefined;
    if (rainMaterial && rain.current) {
      rainMaterial.uniforms.uTime.value = state.clock.elapsedTime;
      rainMaterial.uniforms.uIntensity.value = rainStrength;
      rain.current.visible = rainStrength > 0.035;
      const quality = useWorld.getState().quality;
      rain.current.geometry.setDrawRange(
        0,
        quality === 'high' ? RAIN_COUNT : quality === 'medium' ? 360 : 220,
      );
    }

    audioClock.current += dt;
    if (audioClock.current > 0.2) {
      ambience.setBoundaryIntensity(audioStrength, hush);
      audioClock.current = 0;
    }

    const lightningState = storm.current;
    lightningState.flash *= Math.exp(-dt * 9.5);
    if (rainStrength > 0.32 && hush < 0.4) {
      lightningState.next -= dt * (0.55 + rainStrength * 0.5);
      if (lightningState.next <= 0) {
        lightningState.flash = 1;
        lightningState.next = 5 + Math.random() * 7;
        const angle = Math.random() * Math.PI * 2;
        const distance = 46 + Math.random() * 42;
        lightningState.strikeX = Math.cos(angle) * distance;
        lightningState.strikeZ = Math.sin(angle) * distance;
        ambience.thunder(0.42 + rainStrength * 0.5);
      }
    } else {
      lightningState.next = Math.min(lightningState.next, 7.5);
    }

    const flash = lightningState.flash * rainStrength;
    ecologyState.stormFlash = flash;
    if (lightning.current) {
      lightning.current.visible = flash > 0.025;
      lightning.current.position.set(lightningState.strikeX, 0, lightningState.strikeZ);
    }
    if (lightningMaterial.current) lightningMaterial.current.opacity = flash * 0.82;
    if (lightningLight.current) {
      lightningLight.current.position.set(lightningState.strikeX, 42, lightningState.strikeZ);
      lightningLight.current.intensity = flash * 115;
    }
  });

  return (
    <group ref={root} visible={false}>
      <points ref={rain} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[rainPositions, 3]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={rainUniforms}
          vertexShader={rainVertex}
          fragmentShader={rainFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      <lineSegments ref={lightning} visible={false} renderOrder={20}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[boltPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lightningMaterial}
          color="#dff7ff"
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
        />
      </lineSegments>
      <pointLight ref={lightningLight} color="#c8eaff" intensity={0} distance={180} decay={1.45} />
    </group>
  );
}
