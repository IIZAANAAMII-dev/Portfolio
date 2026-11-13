'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { addClearing, ClearingContext } from '@/components/islands/clearings';
import { groundAt } from '@/components/islands/terrain-shape';
import { skyState } from '@/lib/sky';
import type { IsletDecorProps } from './types';

/**
 * High-tech : plateforme hexagonale aux arêtes néon, serveur aux LED qui clignotent,
 * parabole qui scrute le ciel, hologramme de code qui défile et cubes en orbite. Les
 * néons brillent plus fort quand l'îlot se réveille et la nuit (bloom).
 */

const CODE = [
  'const kyliann = {',
  "  role: 'dev web & UI/UX',",
  "  stack: ['React', 'TypeScript',",
  "          'Node.js', 'Three.js'],",
  "  port: 'Marseille',",
  "  racines: 'Breizh',",
  '};',
  '',
  'function craft(idea) {',
  '  return design(idea)',
  '    .then(build)',
  '    .then(polish)',
  '    .then(ship);',
  '}',
  '',
  '// chaque détail compte',
  'export default craft(kyliann);',
  '',
];

function codeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'top';
  const lineHeight = canvas.height / CODE.length;
  CODE.forEach((line, index) => {
    // Coloration syntaxique minimale : mots-clés, chaînes, commentaires.
    const color = line.trim().startsWith('//')
      ? '#7fa7b8'
      : /(const|function|return|export|default)/.test(line)
        ? '#ff9ad5'
        : line.includes("'")
          ? '#ffe28a'
          : '#bff6ff';
    ctx.fillStyle = color;
    ctx.fillText(line, 22, index * lineHeight + 6);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapT = RepeatWrapping;
  return texture;
}

const hologramVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const hologramFragment = /* glsl */ `
uniform sampler2D uCode;
uniform float uTime;
uniform float uPower;
varying vec2 vUv;
void main() {
  // Le code défile vers le haut ; lignes de balayage et léger scintillement.
  vec2 uv = vec2(vUv.x, vUv.y - uTime * 0.035);
  float text = texture2D(uCode, uv).a;
  vec3 tint = texture2D(uCode, uv).rgb;
  float scan = 0.82 + 0.18 * sin(vUv.y * 260.0 - uTime * 6.0);
  float flicker = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 13.0);
  vec2 edge = min(vUv, 1.0 - vUv);
  float frame = 1.0 - smoothstep(0.0, 0.018, min(edge.x, edge.y));
  float fill = 0.1 + 0.05 * sin(vUv.y * 9.0 + uTime);
  vec3 cyan = vec3(0.32, 0.95, 1.0);
  vec3 color = cyan * (fill * 1.4 + frame * 2.0) + tint * text * 2.6;
  float alpha = (fill * 1.4 + frame + text) * scan * flicker * uPower;
  gl_FragColor = vec4(color * scan * flicker * uPower, clamp(alpha, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

const ledVertex = hologramVertex;

const ledFragment = /* glsl */ `
uniform float uTime;
uniform float uPower;
varying vec2 vUv;
float cellHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 grid = vUv * vec2(5.0, 16.0);
  vec2 cell = floor(grid);
  vec2 f = fract(grid) - 0.5;
  float led = 1.0 - smoothstep(0.16, 0.26, length(f * vec2(1.0, 0.8)));
  float rate = 1.2 + cellHash(cell) * 3.5;
  float on = step(0.42, cellHash(cell + floor(uTime * rate)));
  vec3 color = mix(vec3(0.2, 1.0, 0.7), vec3(0.35, 0.7, 1.0), cellHash(cell * 1.7));
  color = mix(color, vec3(1.0, 0.4, 0.75), step(0.93, cellHash(cell * 3.1)));
  vec3 rgb = vec3(0.025, 0.03, 0.045) + color * led * on * (0.8 + uPower * 1.6);
  gl_FragColor = vec4(rgb, 1.0);
  #include <colorspace_fragment>
}
`;

/** Parabole : un paraboloïde tourné, monté sur une fourche, qui balaie lentement le ciel. */
function Dish({ position }: { position: [number, number, number] }) {
  const head = useRef<Group>(null);
  const bowl = useMemo(() => {
    const profile = Array.from({ length: 9 }, (_, index) => {
      const r = (index / 8) * 1.15;
      return new Vector2(r, r * r * 0.32);
    });
    return new LatheGeometry(profile, 24);
  }, []);
  useFrame((state) => {
    if (!head.current) return;
    const t = state.clock.elapsedTime;
    head.current.rotation.y = Math.sin(t * 0.21) * 1.2;
    head.current.rotation.x = -0.75 + Math.sin(t * 0.33) * 0.18;
  });
  return (
    <group position={position}>
      <mesh castShadow position-y={0.55}>
        <cylinderGeometry args={[0.1, 0.16, 1.1, 8]} />
        <meshStandardMaterial color="#c9d2dc" roughness={0.4} metalness={0.5} />
      </mesh>
      <group ref={head} position-y={1.15}>
        <mesh geometry={bowl} castShadow>
          <meshStandardMaterial color="#eef2f6" roughness={0.45} side={DoubleSide} />
        </mesh>
        <mesh position-y={0.62}>
          <cylinderGeometry args={[0.025, 0.025, 1.2, 5]} />
          <meshStandardMaterial color="#9aa6b2" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position-y={1.22}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color="#1c2430" emissive="#5ef2ff" emissiveIntensity={2.2} />
        </mesh>
      </group>
    </group>
  );
}

function Server({ position, awake }: { position: [number, number, number]; awake: IsletDecorProps['awake'] }) {
  const leds = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPower: { value: 0 } }), []);
  useFrame((state) => {
    const material = leds.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPower.value = awake.value * 0.7 + skyState.dayNight * 0.5;
  });
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position-y={1.45}>
        <boxGeometry args={[1.15, 2.9, 0.85]} />
        <meshStandardMaterial color="#3b465a" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* Façade : grille de LED animée sur le GPU. */}
      <mesh position={[0, 1.5, 0.431]}>
        <planeGeometry args={[0.95, 2.55]} />
        <shaderMaterial ref={leds} uniforms={uniforms} vertexShader={ledVertex} fragmentShader={ledFragment} />
      </mesh>
      <mesh position-y={2.95}>
        <boxGeometry args={[1.22, 0.08, 0.92]} />
        <meshStandardMaterial color="#0f141c" emissive="#5ef2ff" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Hologram({ position, awake }: { position: [number, number, number]; awake: IsletDecorProps['awake'] }) {
  const group = useRef<Group>(null);
  const screen = useRef<ShaderMaterial>(null);
  const world = useMemo(() => new Vector3(), []);
  const uniforms = useMemo(() => ({ uCode: { value: codeTexture() }, uTime: { value: 0 }, uPower: { value: 0.5 } }), []);
  useFrame((state) => {
    const target = group.current;
    const material = screen.current;
    if (!target || !material) return;
    // L'écran se tourne toujours vers le visiteur (rotation autour de la verticale).
    target.getWorldPosition(world);
    target.rotation.y = Math.atan2(state.camera.position.x - world.x, state.camera.position.z - world.z);
    target.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.3) * 0.08;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPower.value = 0.45 + awake.value * 0.55;
  });
  return (
    <group>
      {/* Projecteur posé sur la plateforme. */}
      <mesh position={[position[0], position[1] - 2.24, position[2]]} castShadow>
        <cylinderGeometry args={[0.35, 0.45, 0.3, 12]} />
        <meshStandardMaterial color="#3b465a" roughness={0.4} metalness={0.1} emissive="#5ef2ff" emissiveIntensity={0.4} />
      </mesh>
      <group ref={group} position={position}>
        <mesh>
          <planeGeometry args={[2.8, 1.85]} />
          <shaderMaterial
            ref={screen}
            uniforms={uniforms}
            vertexShader={hologramVertex}
            fragmentShader={hologramFragment}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Petits cubes lumineux en orbite autour du serveur. */
function Orbiters({ center }: { center: [number, number, number] }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = 8;
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const t = state.clock.elapsedTime;
    for (let index = 0; index < count; index++) {
      const angle = t * 0.6 + (index / count) * Math.PI * 2;
      dummy.position.set(
        center[0] + Math.cos(angle) * 1.7,
        center[1] + Math.sin(angle * 2 + index) * 0.35,
        center[2] + Math.sin(angle) * 1.7,
      );
      dummy.rotation.set(t * 1.3 + index, t * 0.9, 0);
      dummy.scale.setScalar(0.17);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1c2430" emissive="#ff6ad5" emissiveIntensity={2.4} />
    </instancedMesh>
  );
}

function Antenna({ position }: { position: [number, number, number] }) {
  const light = useRef<Mesh>(null);
  useFrame((state) => {
    if (!light.current) return;
    const blink = Math.sin(state.clock.elapsedTime * 3.1) > 0.55 ? 1 : 0;
    (light.current.material as MeshStandardMaterial).emissiveIntensity = 0.3 + blink * 3;
  });
  return (
    <group position={position}>
      <mesh castShadow position-y={1.9}>
        <cylinderGeometry args={[0.04, 0.09, 3.8, 6]} />
        <meshStandardMaterial color="#c9d2dc" roughness={0.4} metalness={0.6} />
      </mesh>
      {[1.2, 2.1, 2.9].map((y) => (
        <mesh key={y} position-y={y} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.8 - y * 0.15, 4]} />
          <meshStandardMaterial color="#c9d2dc" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <mesh ref={light} position-y={3.88}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshStandardMaterial color="#3a0d0d" emissive="#ff3b3b" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export function TechDecor({ islet, sampler, features, awake }: IsletDecorProps) {
  const clearings = useContext(ClearingContext);
  const platformRef = useRef<Mesh>(null);
  const { hillX, hillZ } = features;
  // La dalle repose sur le point le plus haut de son emprise : le relief ne la traverse pas,
  // son socle épais descend jusqu'au sol tout autour.
  const base = useMemo(() => {
    let top = sampler(hillX, hillZ);
    for (let index = 0; index < 12; index++) {
      const angle = (index / 12) * Math.PI * 2;
      for (const reach of [1.6, 3.3]) top = Math.max(top, sampler(hillX + Math.cos(angle) * reach, hillZ + Math.sin(angle) * reach));
    }
    return top + 0.02;
  }, [hillX, hillZ, sampler]);
  const antennaX = -islet.radius * 0.45;
  const antennaZ = islet.radius * 0.3;

  useLayoutEffect(() => {
    const removePlatform = addClearing(clearings, hillX, hillZ, 3.6);
    const removeAntenna = addClearing(clearings, antennaX, antennaZ, 0.5);
    return () => {
      removePlatform?.();
      removeAntenna?.();
    };
  }, [antennaX, antennaZ, clearings, hillX, hillZ]);

  useFrame(() => {
    const edge = platformRef.current;
    if (edge) (edge.material as MeshStandardMaterial).emissiveIntensity = 0.8 + awake.value * 1.8 + skyState.dayNight * 0.8;
  });

  return (
    <group>
      {/* Plateforme hexagonale et son liseré néon. */}
      <mesh position={[hillX, base - 0.6, hillZ]} castShadow receiveShadow>
        <cylinderGeometry args={[3.3, 3.75, 1.9, 6]} />
        <meshStandardMaterial color="#56627a" roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh ref={platformRef} position={[hillX, base + 0.36, hillZ]}>
        <cylinderGeometry args={[3.32, 3.32, 0.05, 6, 1, true]} />
        <meshStandardMaterial color="#0f141c" emissive="#5ef2ff" emissiveIntensity={1} side={DoubleSide} />
      </mesh>
      <Server position={[hillX - 1.25, base + 0.36, hillZ - 0.35]} awake={awake} />
      <Orbiters center={[hillX - 1.25, base + 2.2, hillZ - 0.35]} />
      <Dish position={[hillX + 1.55, base + 0.36, hillZ + 0.75]} />
      <Hologram position={[hillX + 0.6, base + 2.75, hillZ - 1.55]} awake={awake} />
      <Antenna position={[antennaX, groundAt(sampler, antennaX, antennaZ, 0.3) - 0.05, antennaZ]} />
    </group>
  );
}
