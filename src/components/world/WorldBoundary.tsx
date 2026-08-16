'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, Mesh, ShaderMaterial } from 'three';
import { boatState, resetBoat } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, smoothstep } from '@/lib/utils/math';

type Stage = 'idle' | 'shadow' | 'hush' | 'approach' | 'stalk' | 'coil' | 'attack' | 'impact' | 'respawn' | 'cooldown';

const shadowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const shadowFragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 q = vUv - 0.5;
  float angle = atan(q.y, q.x);
  float wriggle = sin(q.x * 17.0 - uTime * 1.15) * 0.025 * (1.0 - abs(q.x) * 1.4);
  q.y += wriggle;
  float irregular = sin(angle * 5.0 + uTime * 0.7) * 0.035
    + sin(angle * 9.0 - uTime * 0.4) * 0.018;
  float d = length(vec2(q.x * 0.48, q.y));
  float body = 1.0 - smoothstep(0.19 + irregular, 0.34 + irregular, d);
  float centre = 1.0 - smoothstep(0.0, 0.32, d);
  gl_FragColor = vec4(0.001, 0.006, 0.009, body * (0.22 + centre * 0.44) * uStrength);
}
`;

const splashVertex = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uStrength;
varying float vAlpha;
void main() {
  float life = fract(aPhase + uTime * (0.22 + aPhase * 0.08));
  vec3 p = position;
  p.xz *= life * (0.8 + uStrength * 0.8);
  p.y = sin(life * 3.14159) * position.y * (0.55 + uStrength * 0.7);
  vAlpha = (1.0 - life) * uStrength;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp((1.8 + uStrength * 3.1) * (180.0 / max(1.0, -mv.z)), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}
`;

const splashFragment = /* glsl */ `
varying float vAlpha;
void main() {
  float dotShape = smoothstep(0.5, 0.08, length(gl_PointCoord - 0.5));
  float alpha = dotShape * vAlpha;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(0.74, 0.96, 0.94, alpha * 0.74);
}
`;

/** Remous poolés : ils signalent la masse sous l'eau sans faire sortir la créature. */
function SurfaceDisturbance() {
  const group = useRef<Group>(null);
  const splash = useRef<ShaderMaterial>(null);
  const splashData = useMemo(() => {
    const positions = new Float32Array(72 * 3);
    const phases = new Float32Array(72);
    for (let index = 0; index < 72; index++) {
      const angle = hash(index * 7.13 + 1) * Math.PI * 2;
      const radius = 4 + hash(index * 3.71 + 2) * 8;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 2.8 + hash(index * 9.17 + 3) * 7.2;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
      phases[index] = hash(index * 5.53 + 4);
    }
    return { positions, phases };
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: 0 } }), []);

  useFrame(() => {
    if (!group.current || !splash.current) return;
    const strength = ecologyState.monsterSurface;
    group.current.visible = strength > 0.015;
    group.current.position.set(ecologyState.monsterX, 0.16, ecologyState.monsterZ);
    splash.current.uniforms.uTime.value = ecologyState.monsterEffectTime;
    splash.current.uniforms.uStrength.value = strength;
  });

  return (
    <group ref={group} visible={false}>
      <points renderOrder={9} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[splashData.positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[splashData.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={splash}
          uniforms={uniforms}
          vertexShader={splashVertex}
          fragmentShader={splashFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

/**
 * Limite cachée entièrement sous-marine. La créature n'est jamais rendue hors de
 * l'eau : sa taille se lit par l'ombre, les remous, le plancton et le mouvement de caméra.
 */
export function WorldBoundary() {
  const shadow = useRef<Mesh>(null);
  const shadowMaterial = useRef<ShaderMaterial>(null);
  const sequence = useRef({
    stage: 'idle' as Stage,
    timer: 0,
    cooldown: 0,
    side: 1,
    approachX: 0,
    approachZ: 0,
    attackX: 0,
    attackZ: 0,
    resetDone: false,
  });
  const shadowUniforms = useMemo(() => ({ uStrength: { value: 0 }, uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (!shadow.current || !shadowMaterial.current) return;
    const dt = Math.min(delta, 1 / 15);
    const timelineDt = Math.min(delta, 0.25);
    const seq = sequence.current;
    const world = useWorld.getState();
    seq.cooldown = Math.max(0, seq.cooldown - dt);
    const forwardX = Math.cos(boatState.heading);
    const forwardZ = Math.sin(boatState.heading);
    const sideX = -forwardZ * seq.side;
    const sideZ = forwardX * seq.side;

    const showShadow = (
      x: number,
      z: number,
      strength: number,
      heading: number,
      length = 46,
      width = 23,
    ) => {
      if (!shadow.current || !shadowMaterial.current) return;
      shadow.current.visible = strength > 0.012;
      shadow.current.position.set(x, -1.82, z);
      shadow.current.rotation.z = -heading;
      shadow.current.scale.set(length, width, 1);
      shadowMaterial.current.uniforms.uStrength.value = strength;
      ecologyState.monsterX = x;
      ecologyState.monsterZ = z;
      ecologyState.monsterShadow = strength;
    };

    ecologyState.sequenceActive = seq.stage === 'idle' || seq.stage === 'cooldown' ? 0 : 1;
    ecologyState.boundaryStage = seq.stage;
    ecologyState.monsterEffectTime = seq.timer;
    shadowMaterial.current.uniforms.uTime.value = state.clock.elapsedTime;

    if (seq.stage === 'idle') {
      ecologyState.boundaryHush = damp(ecologyState.boundaryHush, 0, 3, dt);
      ecologyState.boundaryCinematic = damp(ecologyState.boundaryCinematic, 0, 2.2, dt);
      ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, 0, 4, dt);
      ecologyState.monsterShadow = 0;
      ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 3, dt);
      ecologyState.monsterSurface = damp(ecologyState.monsterSurface, 0, 3, dt);
      ecologyState.impact = 0;
      ecologyState.respawnFade = 0;
      ecologyState.leviathanAttack = 0;
      shadow.current.visible = false;
      shadowMaterial.current.uniforms.uStrength.value = 0;
      if (world.phase === 'playing' && seq.cooldown <= 0 && ecologyState.leviathan > 0.56) {
        seq.stage = 'shadow';
        seq.timer = 0;
        seq.side = Math.sin(boatState.position.x * 0.17 + boatState.position.z) > 0 ? 1 : -1;
        seq.approachX = boatState.position.x + forwardX * 31 + sideX * 20;
        seq.approachZ = boatState.position.z + forwardZ * 31 + sideZ * 20;
        useWorld.setState({ destination: null, freeTarget: null, activeIsland: null });
      }
      return;
    }

    seq.timer += timelineDt;
    const lockTarget = seq.stage === 'shadow' ? 0.16 : seq.stage === 'hush' ? 0.38 : 1;
    ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, lockTarget, 2.4, dt);
    boatState.speed = damp(boatState.speed, 0, seq.stage === 'shadow' ? 0.42 : 2.8, dt);
    ecologyState.boundaryHush = damp(ecologyState.boundaryHush, seq.stage === 'hush' ? 1 : 0, 3.2, dt);
    const cameraTarget = seq.stage === 'shadow' ? 0.12 : seq.stage === 'hush' ? 0.28 : seq.stage === 'respawn' ? 0 : 1;
    ecologyState.boundaryCinematic = damp(ecologyState.boundaryCinematic, cameraTarget, 1.45, dt);

    if (seq.stage === 'shadow') {
      const progress = clamp(seq.timer / 3.8, 0, 1);
      const eased = smoothstep(0, 1, progress);
      const fromX = boatState.position.x - forwardX * 30 - sideX * 24;
      const fromZ = boatState.position.z - forwardZ * 30 - sideZ * 24;
      const toX = boatState.position.x + forwardX * 35 + sideX * 16;
      const toZ = boatState.position.z + forwardZ * 35 + sideZ * 16;
      const x = fromX + (toX - fromX) * eased;
      const z = fromZ + (toZ - fromZ) * eased;
      const strength = Math.sin(progress * Math.PI) * 0.94;
      showShadow(x, z, strength, boatState.heading - seq.side * 0.22, 52, 25);
      ecologyState.monsterWake = strength * 0.82;
      ecologyState.monsterSurface = strength * 0.06;
      ecologyState.monsterFromX = fromX;
      ecologyState.monsterFromZ = fromZ;
      ecologyState.monsterToX = x;
      ecologyState.monsterToZ = z;
      if (seq.timer >= 3.8) {
        seq.stage = 'hush';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'hush') {
      const strength = damp(shadowMaterial.current.uniforms.uStrength.value, 0, 4, dt);
      shadowMaterial.current.uniforms.uStrength.value = strength;
      shadow.current.visible = strength > 0.015;
      ecologyState.monsterShadow = strength;
      ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 2.6, dt);
      ecologyState.monsterSurface = 0;
      if (seq.timer >= 1.15) {
        seq.stage = 'approach';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'approach') {
      const progress = clamp(seq.timer / 2.8, 0, 1);
      const eased = smoothstep(0, 1, progress);
      const targetX = boatState.position.x + forwardX * 17 + sideX * 12;
      const targetZ = boatState.position.z + forwardZ * 17 + sideZ * 12;
      const curve = Math.sin(progress * Math.PI) * seq.side * 4.2;
      const x = seq.approachX + (targetX - seq.approachX) * eased - forwardZ * curve;
      const z = seq.approachZ + (targetZ - seq.approachZ) * eased + forwardX * curve;
      const heading = Math.atan2(targetZ - z, targetX - x);
      const strength = 0.3 + Math.sin(progress * Math.PI) * 0.46;
      showShadow(x, z, strength, heading, 50, 24);
      ecologyState.monsterWake = 0.32 + eased * 0.3;
      ecologyState.monsterSurface = 0.04 + Math.sin(progress * Math.PI) * 0.1;
      ecologyState.monsterFromX = seq.approachX;
      ecologyState.monsterFromZ = seq.approachZ;
      ecologyState.monsterToX = x;
      ecologyState.monsterToZ = z;
      if (seq.timer >= 2.8) {
        seq.stage = 'stalk';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'stalk') {
      const orbit = boatState.heading + seq.side * (0.72 + seq.timer * 0.3);
      const radius = 22 - Math.sin(seq.timer * 1.1) * 1.2;
      const x = boatState.position.x + Math.cos(orbit) * radius;
      const z = boatState.position.z + Math.sin(orbit) * radius;
      const heading = Math.atan2(boatState.position.z - z, boatState.position.x - x);
      showShadow(x, z, 0.7, heading, 53, 25);
      ecologyState.monsterWake = 0.42;
      ecologyState.monsterSurface = 0.055;
      ecologyState.monsterFromX = ecologyState.monsterToX;
      ecologyState.monsterFromZ = ecologyState.monsterToZ;
      ecologyState.monsterToX = x;
      ecologyState.monsterToZ = z;
      if (seq.timer >= 1.45) {
        seq.attackX = x;
        seq.attackZ = z;
        seq.stage = 'coil';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'coil') {
      const progress = smoothstep(0, 1, clamp(seq.timer / 1.35, 0, 1));
      const dx = seq.attackX - boatState.position.x;
      const dz = seq.attackZ - boatState.position.z;
      const length = Math.max(Math.hypot(dx, dz), 0.001);
      const outwardX = dx / length;
      const outwardZ = dz / length;
      const curl = Math.sin(progress * Math.PI) * seq.side * 3.4;
      const x = seq.attackX + outwardX * progress * 6.5 - outwardZ * curl;
      const z = seq.attackZ + outwardZ * progress * 6.5 + outwardX * curl;
      const heading = Math.atan2(boatState.position.z - z, boatState.position.x - x);
      showShadow(x, z, 0.72 + progress * 0.16, heading, 55, 26);
      ecologyState.monsterWake = 0.48 + progress * 0.18;
      ecologyState.monsterSurface = 0.07 + progress * 0.08;
      ecologyState.monsterFromX = seq.attackX;
      ecologyState.monsterFromZ = seq.attackZ;
      ecologyState.monsterToX = x;
      ecologyState.monsterToZ = z;
      if (seq.timer >= 1.35) {
        seq.attackX = x;
        seq.attackZ = z;
        seq.stage = 'attack';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'attack') {
      const progress = clamp(seq.timer / 1.75, 0, 1);
      const charge = Math.pow(smoothstep(0.1, 0.96, progress), 1.55);
      const targetX = boatState.position.x;
      const targetZ = boatState.position.z;
      const dx = targetX - seq.attackX;
      const dz = targetZ - seq.attackZ;
      const length = Math.max(Math.hypot(dx, dz), 0.001);
      const curve = Math.sin(charge * Math.PI) * seq.side * 2.8;
      const x = seq.attackX + dx * charge - dz / length * curve;
      const z = seq.attackZ + dz * charge + dx / length * curve;
      const heading = Math.atan2(targetZ - z, targetX - x);
      const strength = 0.88 * (1 - smoothstep(0.87, 1, progress));
      showShadow(x, z, strength, heading, 56 - charge * 12, 26 - charge * 7);
      ecologyState.monsterWake = 0.68 + progress * 0.32;
      ecologyState.monsterSurface = 0.16 + smoothstep(0.38, 1, progress) * 0.68;
      ecologyState.monsterFromX = seq.attackX;
      ecologyState.monsterFromZ = seq.attackZ;
      ecologyState.monsterToX = x;
      ecologyState.monsterToZ = z;
      ecologyState.leviathanAttack = smoothstep(0.58, 0.98, progress) * 0.72;
      if (seq.timer >= 1.75) {
        seq.stage = 'impact';
        seq.timer = 0;
      }
      return;
    }

    if (seq.stage === 'impact') {
      const progress = clamp(seq.timer / 0.95, 0, 1);
      ecologyState.monsterX = boatState.position.x;
      ecologyState.monsterZ = boatState.position.z;
      ecologyState.monsterToX = boatState.position.x;
      ecologyState.monsterToZ = boatState.position.z;
      ecologyState.monsterWake = 1;
      ecologyState.monsterSurface = 1;
      ecologyState.monsterShadow = 0;
      ecologyState.impact = Math.sin(progress * Math.PI) * 0.9 + progress * 0.1;
      ecologyState.leviathanAttack = smoothstep(0.02, 0.72, progress);
      ecologyState.respawnFade = smoothstep(0.28, 0.86, progress);
      shadow.current.visible = false;
      if (seq.timer >= 0.95) {
        seq.stage = 'respawn';
        seq.timer = 0;
        seq.resetDone = false;
      }
      return;
    }

    if (seq.stage === 'respawn') {
      ecologyState.respawnFade = seq.timer < 0.58 ? 1 : 1 - smoothstep(0.58, 1.65, seq.timer);
      ecologyState.impact = damp(ecologyState.impact, 0, 5, dt);
      ecologyState.monsterWake = damp(ecologyState.monsterWake, 0, 3, dt);
      ecologyState.monsterSurface = damp(ecologyState.monsterSurface, 0, 4, dt);
      ecologyState.monsterShadow = 0;
      shadow.current.visible = false;
      if (!seq.resetDone && seq.timer >= 0.28) {
        seq.resetDone = true;
        resetBoat();
        ecologyState.boundaryWarning = 0;
        ecologyState.boundaryDanger = 0;
        ecologyState.leviathan = 0;
        ecologyState.stormCover = 0;
        ecologyState.stormWaves = 0;
        ecologyState.stormWind = 0;
        ecologyState.stormRain = 0;
        ecologyState.leviathanAttack = 0;
        useWorld.setState({
          phase: 'playing',
          destination: null,
          freeTarget: null,
          activeIsland: null,
        });
      }
      if (seq.timer >= 1.65) {
        seq.stage = 'cooldown';
        seq.timer = 0;
        seq.cooldown = 28;
      }
      return;
    }

    shadow.current.visible = false;
    ecologyState.respawnFade = 0;
    ecologyState.leviathanAttack = 0;
    ecologyState.monsterShadow = 0;
    ecologyState.boundaryCinematic = damp(ecologyState.boundaryCinematic, 0, 3, dt);
    ecologyState.boundaryControlLock = damp(ecologyState.boundaryControlLock, 0, 4, dt);
    if (seq.timer >= 1.1) {
      seq.stage = 'idle';
      seq.timer = 0;
    }
  });

  return (
    <group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={shadowMaterial}
          uniforms={shadowUniforms}
          vertexShader={shadowVertex}
          fragmentShader={shadowFragment}
          transparent
          depthWrite={false}
        />
      </mesh>
      <SurfaceDisturbance />
    </group>
  );
}
