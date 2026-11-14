'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
} from 'three';
import { hash } from '@/lib/utils/math';
import { erlenmeyerGeometry, flatRing, flipFaces, liquidGeometry, Merger, pose, topAndSides, type Vec3 } from '../geometry';
import { createBeamMaterial, glassMaterial, glowMaterial, labNight, labState, labTime, paintMaterial } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * LABORATOIRE 3D — un projecteur holographique fait tourner un icosaèdre en fil de
 * lumière autour d'un poisson low-poly translucide (un modèle en cours de rendu), un
 * anneau de balayage le parcourt, des particules montent dans le faisceau. Devant, un
 * bassin d'eau stylisée (shader) où dérive un canard en plastique — le confident des
 * développeurs. À gauche, la paillasse des expériences en cours : des fioles qui
 * bouillonnent (les technologies explorées).
 */

const PROJECTOR: Vec3 = [-0.12, 0, -0.55];
const HOLOGRAM_Y = 1.8;
const BASIN: Vec3 = [1.0, 0, 0.55];
const BASIN_INNER = 0.58;
const WATER_Y = 0.245;
const BENCH: Vec3 = [-1.18, 0, -0.2];
const BENCH_TOP = 0.57;
const FLASKS: { x: number; color: string }[] = [
  { x: -0.26, color: '#c58bff' },
  { x: 0.02, color: '#5ec8ff' },
];
const PARTICLES = 40;
const BUBBLES = 9;

const particleVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
varying float vAlpha;
void main() {
  float rise = fract(uTime * (0.16 + aSeed.w * 0.12) + aSeed.z);
  float angle = aSeed.x * 6.2831 + uTime * (0.35 + aSeed.w * 0.3);
  float radius = aSeed.y * (0.18 + rise * 0.42);
  vec3 p = vec3(cos(angle) * radius, 0.42 + rise * 1.55, sin(angle) * radius);
  vAlpha = smoothstep(0.0, 0.12, rise) * (1.0 - smoothstep(0.7, 1.0, rise));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(7.0 * (60.0 / max(1.0, -mv.z)), 1.5, 6.0);
  gl_Position = projectionMatrix * mv;
}
`;

const particleFragment = /* glsl */ `
uniform float uNight;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vAlpha * (0.7 + uNight * 0.5);
  if (a < 0.02) discard;
  gl_FragColor = vec4(mix(vec3(0.85, 0.6, 1.0), vec3(1.0), 0.35) * a * 1.6, a);
  #include <colorspace_fragment>
}
`;

const waterVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const waterFragment = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec2 uDuck;
varying vec2 vP;
void main() {
  float r = length(vP);
  // Ondes du canard, et une lente houle de fond.
  float d = length(vP - uDuck);
  float rings = sin(d * 24.0 - uTime * 4.2) * exp(-d * 2.4);
  float swell = sin(vP.x * 5.0 + uTime * 0.9) * sin(vP.y * 4.0 - uTime * 0.7);
  float h = rings * 0.7 + swell * 0.25;
  vec3 deep = vec3(0.07, 0.42, 0.52);
  vec3 shallow = vec3(0.28, 0.78, 0.78);
  vec3 color = mix(deep, shallow, smoothstep(0.95, 0.35, r));
  // Paliers nets façon dessin animé : reflets clairs sur les crêtes.
  color = mix(color, vec3(0.75, 0.97, 0.95), step(0.55, h) * 0.75);
  color = mix(color, deep * 0.8, step(h, -0.62) * 0.4);
  // Écume au bord, reflet violet de l'hologramme la nuit.
  color = mix(color, vec3(0.92, 0.98, 0.97), smoothstep(0.86, 0.97, r) * 0.8);
  color += vec3(0.32, 0.12, 0.5) * uNight * (0.35 + 0.25 * sin(uTime * 1.3));
  gl_FragColor = vec4(color * (1.0 - uNight * 0.45), 1.0);
  #include <colorspace_fragment>
}
`;

/** Poisson low-poly (le modèle 3D « en cours » de l'hologramme). Avant = +X. */
function fishGeometry() {
  const positions: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  const nose = [0.42, 0, 0];
  const tail = [-0.3, 0.01, 0];
  const top = [0.02, 0.17, 0];
  const bottom = [0.02, -0.15, 0];
  const left = [0.02, 0, 0.1];
  const right = [0.02, 0, -0.1];
  for (const end of [nose, tail]) {
    const flip = end === tail;
    triangle(end, flip ? left : top, flip ? top : left);
    triangle(end, flip ? top : right, flip ? right : top);
    triangle(end, flip ? bottom : left, flip ? left : bottom);
    triangle(end, flip ? right : bottom, flip ? bottom : right);
  }
  // Nageoire caudale et dorsale.
  triangle(tail, [-0.54, 0.18, 0], [-0.54, -0.16, 0]);
  triangle([0.05, 0.15, 0], [-0.16, 0.28, 0], [-0.17, 0.11, 0]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Icosaèdre en fil de lumière : une tige par arête, une perle par sommet. */
function wireGeometry(color: string) {
  const merger = new Merger();
  const edges = new EdgesGeometry(new IcosahedronGeometry(0.52, 0));
  const positions = edges.attributes.position;
  const nodes = new Map<string, Vec3>();
  for (let index = 0; index < positions.count; index += 2) {
    const a: Vec3 = [positions.getX(index), positions.getY(index), positions.getZ(index)];
    const b: Vec3 = [positions.getX(index + 1), positions.getY(index + 1), positions.getZ(index + 1)];
    merger.rod(a, b, 0.013, color, 4);
    nodes.set(a.map((v) => v.toFixed(3)).join(','), a);
    nodes.set(b.map((v) => v.toFixed(3)).join(','), b);
  }
  edges.dispose();
  nodes.forEach((node) => merger.sphere(0.032, '#ffffff', node, 1, [6, 4], 0));
  return merger.build();
}

function duckGeometry() {
  const merger = new Merger();
  merger.sphere(0.1, '#ffd23f', [0, 0.04, 0], [1.25, 0.72, 1], [12, 8], 0.08);
  merger.sphere(0.065, '#ffd23f', [0.085, 0.13, 0], 1, [10, 8], 0.08);
  merger.add(new CylinderGeometry(0.0, 0.05, 0.08, 6), '#ffd23f', pose([-0.13, 0.08, 0], [0, 0, 1.0]), 0.08);
  merger.box([0.06, 0.018, 0.045], '#ff8c42', [0.155, 0.12, 0], undefined, 0);
  for (const side of [-0.034, 0.034]) merger.sphere(0.012, '#1f2430', [0.13, 0.15, side], 1, [6, 4], 0);
  return merger.build();
}

function buildStatic(accent: string) {
  const paint = new Merger();
  const glow = new Merger();
  const glass = new Merger();
  addPad(paint, glow, 2.0, accent);

  // Projecteur : socle à pans, platine, ailettes, émetteur lumineux.
  paint.group(pose(PROJECTOR), () => {
    paint.octagon(0.36, 0.48, 0.32, topAndSides('#5a5078', '#3e3656'), [0, 0.16, 0]);
    paint.cylinder(0.34, 0.36, 0.05, 16, '#2f2944', [0, 0.345, 0], undefined, 0);
    for (let index = 0; index < 3; index++) {
      const angle = (index / 3) * Math.PI * 2 + 0.4;
      paint.box([0.06, 0.26, 0.2], '#6c62a0', [Math.sin(angle) * 0.47, 0.13, Math.cos(angle) * 0.47], [0, angle, 0]);
    }
  });
  glow.add(flatRing(0.16, 0.27, 16), accent, pose([PROJECTOR[0], 0.372, PROJECTOR[2]]), 0);
  glow.cylinder(0.12, 0.12, 0.02, 14, '#f3e6ff', [PROJECTOR[0], 0.37, PROJECTOR[2]], undefined, 0);

  // Bassin octogonal : fond plein, margelle, parois intérieure et extérieure.
  paint.group(pose(BASIN), () => {
    paint.octagon(0.7, 0.74, 0.2, '#bfb4a2', [0, 0.1, 0]);
    paint.add(new CylinderGeometry(0.7, 0.7, 0.12, 8, 1, true, Math.PI / 8), '#cfc5b3', pose([0, 0.26, 0]), 0.05);
    paint.add(flipFaces(new CylinderGeometry(BASIN_INNER, BASIN_INNER, 0.12, 8, 1, true, Math.PI / 8)), '#a99f8d', pose([0, 0.26, 0]), 0);
    paint.add(flatRing(BASIN_INNER, 0.7, 8, Math.PI / 8), '#e4dccd', pose([0, 0.321, 0]), 0);
  });

  // Paillasse et verrerie : fioles, portoir à éprouvettes.
  paint.group(pose(BENCH), () => {
    paint.box([0.82, 0.05, 0.38], '#9b6b45', [0, BENCH_TOP - 0.025, 0]);
    for (const [dx, dz] of [[-0.37, -0.15], [0.37, -0.15], [-0.37, 0.15], [0.37, 0.15]]) paint.box([0.04, BENCH_TOP - 0.05, 0.04], '#7a5034', [dx, (BENCH_TOP - 0.05) / 2, dz]);
    paint.box([0.7, 0.03, 0.3], '#8a5d3b', [0, 0.16, 0]);
    paint.box([0.22, 0.07, 0.07], '#6e4a33', [0.27, BENCH_TOP + 0.035, 0.02]);
  });
  FLASKS.forEach(({ x, color }) => {
    glass.add(erlenmeyerGeometry(), '#ffffff', pose([BENCH[0] + x, BENCH_TOP, BENCH[2]]), 0);
    glow.add(liquidGeometry(), color, pose([BENCH[0] + x, BENCH_TOP, BENCH[2]]), 0);
  });
  ['#7bd88f', '#ff6fa8', '#ffd23f'].forEach((color, index) => {
    const at: Vec3 = [BENCH[0] + 0.2 + index * 0.07, BENCH_TOP + 0.1, BENCH[2] + 0.02];
    glass.cylinder(0.019, 0.019, 0.2, 8, '#ffffff', at, undefined, 0);
    glow.cylinder(0.015, 0.015, 0.08, 8, color, [at[0], BENCH_TOP + 0.045, at[2]], undefined, 0);
  });
  return { paint: paint.build(), glow: glow.build(), glass: glass.build() };
}

const dummy = new Object3D();
const bubbleTint = new Color();

export function Lab3DZone({ zone, spot }: ZoneProps) {
  const spinner = useRef<Group>(null);
  const fish = useRef<Mesh>(null);
  const scan = useRef<Mesh>(null);
  const duck = useRef<Group>(null);
  const water = useRef<Mesh>(null);
  const bubbles = useRef<InstancedMesh>(null);

  const built = useMemo(() => buildStatic(zone.accent), [zone.accent]);
  const wire = useMemo(() => wireGeometry(zone.accent), [zone.accent]);
  const fishShape = useMemo(() => fishGeometry(), []);
  const duckShape = useMemo(() => duckGeometry(), []);
  const beam = useMemo(() => createBeamMaterial(zone.accent, 0.3), [zone.accent]);
  const fishMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#e2c7ff',
        emissive: new Color(zone.accent),
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.62,
        roughness: 0.4,
        flatShading: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    [zone.accent],
  );
  const particles = useMemo(() => {
    const geometry = new BufferGeometry();
    const seeds = new Float32Array(PARTICLES * 4);
    for (let index = 0; index < PARTICLES; index++) {
      seeds.set([hash(index * 3.1), 0.3 + hash(index * 5.7) * 0.7, hash(index * 7.9), hash(index * 2.3)], index * 4);
    }
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    return geometry;
  }, []);
  const particleMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: labTime, uNight: labNight },
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const waterMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: labTime, uNight: labNight, uDuck: { value: new Vector2() } },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
      }),
    [],
  );
  const waterShape = useMemo(() => new CircleGeometry(BASIN_INNER + 0.005, 8, -Math.PI * 0.375), []);
  const bubble = useMemo(() => new Merger().add(new SphereGeometry(0.016, 6, 4), '#ffffff', undefined, 0).build(), []);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      built.glass.dispose();
      wire.dispose();
      fishShape.dispose();
      duckShape.dispose();
      beam.dispose();
      fishMaterial.dispose();
      particles.dispose();
      particleMaterial.dispose();
      waterMaterial.dispose();
      waterShape.dispose();
      bubble.dispose();
    },
    [beam, bubble, built, duckShape, fishMaterial, fishShape, particleMaterial, particles, waterMaterial, waterShape, wire],
  );

  useLayoutEffect(() => {
    const mesh = bubbles.current;
    if (!mesh) return;
    for (let index = 0; index < BUBBLES; index++) {
      dummy.position.set(0, -10, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, bubbleTint.set(index % 3 === 0 ? FLASKS[0].color : index % 3 === 1 ? FLASKS[1].color : '#ffffff'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    if (!labState.awake) return;
    const t = state.clock.elapsedTime;
    if (spinner.current) {
      spinner.current.rotation.y = t * 0.45;
      spinner.current.rotation.x = Math.sin(t * 0.3) * 0.35;
      spinner.current.position.y = HOLOGRAM_Y + Math.sin(t * 1.1) * 0.06;
    }
    if (fish.current) {
      fish.current.rotation.y = -t * 0.7;
      fish.current.rotation.z = Math.sin(t * 2.2) * 0.12;
      fish.current.position.y = HOLOGRAM_Y + Math.sin(t * 1.1) * 0.06;
    }
    if (scan.current) {
      const sweep = Math.sin(t * 1.4);
      scan.current.position.y = HOLOGRAM_Y + sweep * 0.5;
      scan.current.scale.setScalar(Math.sqrt(Math.max(0.05, 1 - sweep * sweep)) * 0.95 + 0.05);
    }
    // Canard : il fait le tour du bassin en dodelinant ; ses ondes suivent (shader).
    const angle = t * 0.32;
    const dx = Math.cos(angle) * 0.27;
    const dz = Math.sin(angle) * 0.27;
    if (duck.current) {
      duck.current.position.set(BASIN[0] + dx, WATER_Y + Math.sin(t * 2.3) * 0.012, BASIN[2] + dz);
      duck.current.rotation.set(Math.sin(t * 2.3) * 0.08, angle + Math.PI / 2, Math.sin(t * 1.7) * 0.06);
    }
    if (water.current) (water.current.material as ShaderMaterial).uniforms.uDuck.value.set(dx / BASIN_INNER, -dz / BASIN_INNER);
    // Bulles des fioles : elles montent du col, gonflent, éclatent.
    const mesh = bubbles.current;
    if (mesh) {
      for (let index = 0; index < BUBBLES; index++) {
        const flask = index % 3;
        const life = (t * (0.55 + (index % 2) * 0.2) + hash(index * 4.3)) % 1;
        const x = flask < 2 ? BENCH[0] + FLASKS[flask].x : BENCH[0] + 0.27;
        const base = flask < 2 ? BENCH_TOP + 0.24 : BENCH_TOP + 0.2;
        dummy.position.set(x + Math.sin(life * 9 + index) * 0.015, base + life * 0.3, BENCH[2] + Math.cos(life * 7 + index) * 0.012);
        dummy.scale.setScalar((0.6 + life * 0.9) * (life > 0.88 ? (1 - life) / 0.12 : 1));
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[-0.92, 1.3]} reach={2.8}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={built.glass} material={glassMaterial} raycast={noRaycast} />

      {/* Faisceau, hologramme, particules. */}
      <mesh position={[PROJECTOR[0], 0.38 + 0.6, PROJECTOR[2]]} material={beam} raycast={noRaycast}>
        <cylinderGeometry args={[0.68, 0.24, 1.2, 24, 1, true]} />
      </mesh>
      <group position={[PROJECTOR[0], 0, PROJECTOR[2]]}>
        <group ref={spinner} position-y={HOLOGRAM_Y}>
          <mesh geometry={wire} material={glowMaterial} raycast={noRaycast} />
        </group>
        <mesh ref={fish} geometry={fishShape} material={fishMaterial} position-y={HOLOGRAM_Y} raycast={noRaycast} />
        <mesh ref={scan} position-y={HOLOGRAM_Y} rotation-x={Math.PI / 2} raycast={noRaycast}>
          <torusGeometry args={[0.6, 0.01, 4, 40]} />
          <meshBasicMaterial color={zone.accent} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        <points geometry={particles} material={particleMaterial} frustumCulled={false} raycast={noRaycast} />
      </group>

      {/* Bassin : eau stylisée et canard. */}
      <mesh ref={water} geometry={waterShape} material={waterMaterial} position={[BASIN[0], WATER_Y, BASIN[2]]} rotation-x={-Math.PI / 2} raycast={noRaycast} />
      <group ref={duck}>
        <mesh geometry={duckShape} material={paintMaterial} castShadow raycast={noRaycast} />
      </group>
      <instancedMesh ref={bubbles} args={[bubble, glowMaterial, BUBBLES]} frustumCulled={false} raycast={noRaycast} />
    </ZoneShell>
  );
}
