'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';

/**
 * Traînées de vent : de fines lignes blanches qui filent dans l'air autour du bateau et
 * s'enroulent en boucle à leur extrémité. Chaque traînée naît, court le long de sa
 * trajectoire puis renaît ailleurs : tout est calculé sur le GPU (un draw call, aucune
 * donnée réécrite par image). Plus nombreuses quand le bateau file vite.
 */

const SEGMENTS = 48;
const TRAILS = 12;

function ribbon() {
  const base = new BufferGeometry();
  const along = new Float32Array((SEGMENTS + 1) * 2);
  const side = new Float32Array((SEGMENTS + 1) * 2);
  const indices: number[] = [];
  for (let index = 0; index <= SEGMENTS; index++) {
    along[index * 2] = index / SEGMENTS;
    along[index * 2 + 1] = index / SEGMENTS;
    side[index * 2] = -1;
    side[index * 2 + 1] = 1;
    if (index < SEGMENTS) {
      const a = index * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  // La position réelle est calculée dans le shader ; l'attribut sert au nombre de sommets.
  base.setAttribute('position', new BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3));
  base.setAttribute('aAlong', new BufferAttribute(along, 1));
  base.setAttribute('aSide', new BufferAttribute(side, 1));
  base.setIndex(indices);
  return base;
}

const vertexShader = /* glsl */ `
attribute float aAlong;
attribute float aSide;
attribute vec2 aSeed;
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uWind;
uniform vec3 uCamera;
uniform float uSpan;
varying float vAlong;
varying float vSide;
varying float vHead;

float trailHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

// Trajectoire : un long trait légèrement ondulé qui finit en boucle verticale.
vec3 trailPath(float s, float span, float curl, float wave) {
  vec3 p = vec3(s * span, sin(s * 3.14159 * 1.4 + wave) * 0.45, sin(s * 6.2 + wave) * 0.35);
  float loopAt = 0.68;
  if (s > loopAt) {
    float k = (s - loopAt) / (1.0 - loopAt);
    float angle = k * 6.28318 * 0.92;
    p.x = loopAt * span + sin(angle) * curl;
    // Boucle inclinée : elle se lit aussi bien vue d'en haut que de côté.
    p.y += (1.0 - cos(angle)) * curl * 0.55;
    p.z += (1.0 - cos(angle)) * curl * 0.85;
  }
  return p;
}

void main() {
  float period = 4.2 + aSeed.y * 2.0;
  float clock = (uTime + aSeed.x * 37.0) / period;
  float cycle = floor(clock);
  float local = fract(clock);
  float seed = aSeed.x * 91.7 + cycle * 7.31;

  // Naissance dans un disque autour du bateau, à quelques mètres au-dessus de l'eau.
  vec2 offset = (vec2(trailHash(seed), trailHash(seed + 1.7)) - 0.5) * uSpan;
  float altitude = 3.0 + trailHash(seed + 2.9) * 7.0;
  float heading = atan(uWind.y, uWind.x) + (trailHash(seed + 4.1) - 0.5) * 0.7;
  float trailLength = 7.0 + trailHash(seed + 5.3) * 7.0;
  float curl = 1.0 + trailHash(seed + 6.7) * 0.7;
  float wave = trailHash(seed + 8.9) * 6.28;

  vec3 local3 = trailPath(aAlong, trailLength, curl, wave);
  vec3 ahead = trailPath(min(aAlong + 0.01, 1.0), trailLength, curl, wave);
  vec3 behind = trailPath(max(aAlong - 0.01, 0.0), trailLength, curl, wave);
  float c = cos(heading);
  float s = sin(heading);
  mat3 turn = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  vec3 origin = vec3(uCenter.x + offset.x, altitude, uCenter.y + offset.y);
  vec3 world = origin + turn * local3;
  vec3 tangent = normalize(turn * (ahead - behind));
  // Ruban toujours tourné vers la caméra.
  vec3 toCamera = normalize(uCamera - world);
  vec3 across = normalize(cross(tangent, toCamera));
  world += across * aSide * 0.13;

  vAlong = aAlong;
  vSide = aSide;
  vHead = local * 1.45;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uPresence;
varying float vAlong;
varying float vSide;
varying float vHead;
void main() {
  // Seul un tronçon du tracé est visible : il court du début vers la boucle.
  float tail = smoothstep(vHead - 0.42, vHead - 0.08, vAlong);
  float head = 1.0 - smoothstep(vHead - 0.02, vHead, vAlong);
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float alpha = tail * head * edge * uPresence;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), alpha * 0.85);
  #include <colorspace_fragment>
}
`;

export function WindTrails() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const quality = useWorld((state) => state.quality);
  const count = quality === 'low' ? 5 : quality === 'medium' ? 8 : TRAILS;

  const geometry = useMemo(() => {
    const base = ribbon();
    const instanced = new InstancedBufferGeometry();
    instanced.index = base.index;
    instanced.setAttribute('position', base.getAttribute('position'));
    instanced.setAttribute('aAlong', base.getAttribute('aAlong'));
    instanced.setAttribute('aSide', base.getAttribute('aSide'));
    const seeds = new Float32Array(count * 2);
    for (let index = 0; index < count; index++) {
      seeds[index * 2] = hash(index * 3.17 + 0.5);
      seeds[index * 2 + 1] = hash(index * 7.31 + 0.2);
    }
    instanced.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 2));
    instanced.instanceCount = count;
    return instanced;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCenter: { value: new Vector2() },
      uWind: { value: new Vector2(0.84, 0.54) },
      uCamera: { value: new Vector3() },
      uSpan: { value: 70 },
      uPresence: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const shader = material.current;
    if (!shader) return;
    const { phase } = useWorld.getState();
    const u = shader.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCenter.value.set(boatState.position.x, boatState.position.z);
    u.uCamera.value.copy(state.camera.position);
    const sailing = Math.min(boatState.speed / MAX_SPEED, 1);
    const active = phase === 'playing' || phase === 'docked' ? 1 : 0;
    // Toujours un peu de vent, davantage en navigation ; discret la nuit, fort dans la tempête.
    u.uPresence.value = active * (0.35 + sailing * 0.65) * (1 - skyState.dayNight * 0.55)
      * (1 + ecologyState.stormWind * 0.6) * smoothstep(0, 1, 1 - ecologyState.leviathanAttack);
    if (mesh.current) mesh.current.visible = u.uPresence.value > 0.01;
  });

  return (
    <mesh ref={mesh} geometry={geometry} frustumCulled={false} renderOrder={8} raycast={() => null}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
