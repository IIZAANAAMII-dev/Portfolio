'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, ShaderMaterial, Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { waveHeight } from '@/lib/waves';
import { damp } from '@/lib/utils/math';

const SEGMENTS = 34;
const SAMPLE_DISTANCE = 0.38;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uBio;
uniform float uStorm;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float age = vUv.y;
  float side = abs(vUv.x - 0.5) * 2.0;
  float brokenEdge = 0.72 + 0.28 * sin(age * 78.0 - uTime * (4.2 + uStorm * 1.8) + side * 9.0);
  float turbulent = hash(floor(vec2(age * 95.0, vUv.x * 9.0 + uTime * 2.0)));
  float centreChurn = pow(1.0 - side, 2.6) * (1.0 - smoothstep(0.0, 0.52, age));
  float arms = smoothstep(0.16, 0.48, side) * (1.0 - smoothstep(0.72, 1.0, side));
  // Bandes de ressac brisées, dans le même langage visuel que l'écume des îles.
  float washBands = smoothstep(0.42, 0.72,
    0.5 + 0.5 * sin(age * 52.0 - uTime * 2.8 + turbulent * 4.0));
  float fade = pow(1.0 - age, 1.55);
  float alpha = (arms * brokenEdge * mix(0.58, 1.0, washBands)
    + centreChurn * (0.55 + turbulent * 0.45)) * fade * uStrength;
  if (alpha < 0.025) discard;
  vec3 dayColor = mix(vec3(0.55, 0.88, 0.87), vec3(0.93, 0.97, 0.91), 0.62);
  vec3 nightColor = vec3(0.02, 1.0, 0.92) * 1.7;
  vec3 color = mix(dayColor, nightColor, uBio);
  gl_FragColor = vec4(color, alpha * (0.48 + uBio * 0.35 + uStorm * 0.08));
}
`;

type TrailPoint = { position: Vector3; heading: number };

export function Wake() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const trail = useRef<TrailPoint[]>([]);
  const lastSample = useRef(new Vector3(Number.POSITIVE_INFINITY, 0, 0));
  const stern = useMemo(() => new Vector3(), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uBio: { value: 0 },
    uStorm: { value: 0 },
  }), []);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    const positions = new Float32Array(SEGMENTS * 2 * 3);
    const uvs = new Float32Array(SEGMENTS * 2 * 2);
    const indices: number[] = [];
    for (let index = 0; index < SEGMENTS; index++) {
      const age = index / (SEGMENTS - 1);
      uvs.set([0, age, 1, age], index * 4);
      if (index < SEGMENTS - 1) {
        const vertex = index * 2;
        indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      }
    }
    const attribute = new BufferAttribute(positions, 3);
    attribute.setUsage(DynamicDrawUsage);
    result.setAttribute('position', attribute);
    result.setAttribute('uv', new BufferAttribute(uvs, 2));
    result.setIndex(indices);
    return result;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (!material.current) return;
    const time = state.clock.elapsedTime;
    material.current.uniforms.uTime.value = time;
    material.current.uniforms.uStrength.value = damp(
      material.current.uniforms.uStrength.value,
      Math.min(Math.max((Math.abs(boatState.speed) - 0.35) / 7.15, 0), 1)
        * (1 - ecologyState.leviathanAttack),
      4,
      dt,
    );

    material.current.uniforms.uBio.value = ecologyState.plankton;
    material.current.uniforms.uStorm.value = ecologyState.stormWaves;

    stern.set(
      boatState.position.x - Math.cos(boatState.heading) * 2.05,
      0,
      boatState.position.z - Math.sin(boatState.heading) * 2.05,
    );
    if (!Number.isFinite(lastSample.current.x) || lastSample.current.distanceTo(stern) >= SAMPLE_DISTANCE) {
      trail.current.unshift({ position: stern.clone(), heading: boatState.heading });
      trail.current.length = Math.min(trail.current.length, SEGMENTS);
      lastSample.current.copy(stern);
    } else if (trail.current[0]) {
      trail.current[0].position.copy(stern);
      trail.current[0].heading = boatState.heading;
    }
    if (!trail.current.length) return;
    while (trail.current.length < SEGMENTS) {
      const tail = trail.current[trail.current.length - 1];
      trail.current.push({ position: tail.position.clone(), heading: tail.heading });
    }

    const positions = geometry.getAttribute('position') as BufferAttribute;
    for (let index = 0; index < SEGMENTS; index++) {
      const point = trail.current[index];
      const age = index / (SEGMENTS - 1);
      const width = 0.52 + age * 3.0 + Math.sin(index * 1.73 + time * 0.8) * age * 0.18;
      const sideX = -Math.sin(point.heading);
      const sideZ = Math.cos(point.heading);
      const y = waveHeight(point.position.x, point.position.z, time) + 0.13;
      positions.setXYZ(index * 2, point.position.x - sideX * width, y, point.position.z - sideZ * width);
      positions.setXYZ(index * 2 + 1, point.position.x + sideX * width, y, point.position.z + sideZ * width);
    }
    positions.needsUpdate = true;
    if (mesh.current) mesh.current.visible = material.current.uniforms.uStrength.value > 0.015;
  });

  return (
    <mesh ref={mesh} geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}
