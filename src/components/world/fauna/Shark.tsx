'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  ShaderMaterial,
} from 'three';
import { SHARK_ZONES, type SharkZone } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { clamp, damp, hash, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { loft, MeshBuilder, tone, type Section, type Vec3 } from './geometry';
import { creatureMaterial, faunaClock, faunaDemo, revealScaleAt } from './shared';

/**
 * REQUIN — un aileron qui tourne autour d'une île lointaine. La dorsale fend la surface, la
 * pointe de la caudale balaie l'eau derrière elle et un petit sillage en V s'ouvre dans son
 * dos (phosphorescent la nuit). Le corps reste sous l'eau : une ombre fuselée. Il sonde de
 * temps en temps, et plonge quand le bateau s'approche de trop près.
 * Trajectoire analytique (cercle ondulé) : le sillage se calcule en remontant le temps,
 * sans historique à stocker.
 */

/* ------------------------------------------------------------------------- modèle */

function sharkGeometry() {
  const builder = new MeshBuilder();
  const top = tone('#56687a');
  const flank = tone('#6d8090');
  const belly = tone('#e6ebed');
  const fin = tone('#4a5b6c');
  const sections: Section[] = [
    { x: 1.78, w: 0.03, h: 0.03, y: -0.03 },
    { x: 1.56, w: 0.15, h: 0.12, y: -0.03 },
    { x: 1.25, w: 0.27, h: 0.22, y: -0.01 },
    { x: 0.85, w: 0.36, h: 0.31, y: 0.0 },
    { x: 0.3, w: 0.4, h: 0.36, y: 0.02 },
    { x: -0.3, w: 0.34, h: 0.32, y: 0.03 },
    { x: -0.85, w: 0.22, h: 0.22, y: 0.04 },
    { x: -1.25, w: 0.11, h: 0.13, y: 0.05 },
    { x: -1.46, w: 0.07, h: 0.09, y: 0.06 },
  ];
  // Contre-ombrage net : dos gris ardoise, ventre blanc, frontière franche (grand blanc).
  loft(builder, sections, 10, ({ up, x, segment }) => {
    if (up > 0.45) return top;
    if (up > -0.1) {
      // Fentes branchiales : trois traits sombres sur le flanc.
      if (x < 0.9 && x > 0.55 && (segment === 2 || segment === 7)) return tone('#3a4856');
      return flank;
    }
    return belly;
  });
  // Grande dorsale (exagérée pour se lire de loin), légèrement falciforme, avec épaisseur.
  for (const side of [1, -1]) {
    const front: Vec3 = [0.42, 0.34, 0];
    const back: Vec3 = [-0.36, 0.33, 0];
    const base: Vec3 = [0.02, 0.37, 0.07 * side];
    const lead: Vec3 = [0.06, 0.95, 0.012 * side];
    const tip: Vec3 = [-0.3, 1.32, 0];
    const trail: Vec3 = [-0.24, 0.72, 0.01 * side];
    builder.sheet(front, base, lead, fin);
    builder.sheet(base, tip, lead, fin);
    builder.sheet(base, trail, tip, fin);
    builder.sheet(base, back, trail, fin);
  }
  // Seconde petite dorsale.
  builder.sheet([-0.92, 0.22, 0], [-1.12, 0.16, 0], [-1.1, 0.38, 0], fin);
  // Pectorales larges, en flèche.
  for (const side of [1, -1]) {
    builder.sheet([0.78, -0.16, 0.33 * side], [0.42, -0.2, 0.36 * side], [0.05, -0.48, 1.02 * side], fin);
  }
  // Caudale en croissant, lobe supérieur plus long : sa pointe affleure derrière l'aileron.
  builder.sheet([-1.38, 0.07, 0], [-1.52, 0.02, 0], [-2.04, 0.86, 0], fin);
  builder.sheet([-1.38, 0.07, 0], [-2.04, 0.86, 0], [-1.66, 0.12, 0], fin);
  builder.sheet([-1.4, 0.03, 0], [-1.86, -0.52, 0], [-1.6, 0.02, 0], fin);
  return builder.build();
}

const uniforms = { uSwim: { value: 0 } };
const SHARK_GEOMETRY = sharkGeometry();
const SHARK_MATERIAL = creatureMaterial(
  'fauna-shark-v1',
  uniforms,
  'uniform float uSwim;',
  `vec3 transformed = vec3(position);
// Nage latérale : l'onde grandit jusqu'à la caudale, la tête bouge à peine.
float sharkBody = smoothstep(0.7, -2.05, position.x);
transformed.z += sin(uSwim - position.x * 2.4) * (0.03 + sharkBody * sharkBody * 0.36);`,
  { roughness: 0.75 },
);

/* -------------------------------------------------------------------------- sillage */

const TRAIL = 18;
const TRAIL_STEP = 0.11;

const wakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const wakeFragment = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uBio;
varying vec2 vUv;
void main() {
  float age = vUv.y;
  float side = abs(vUv.x - 0.5) * 2.0;
  // Deux bras d'écume (le V) et un remous central qui s'efface vite.
  float arms = smoothstep(0.45, 0.85, side) * (1.0 - smoothstep(0.9, 1.0, side));
  float churn = (1.0 - side) * (1.0 - smoothstep(0.0, 0.35, age));
  float broken = 0.65 + 0.35 * sin(age * 46.0 - uTime * 5.0 + side * 7.0);
  float alpha = (arms * broken + churn * 0.7) * pow(1.0 - age, 1.4) * uStrength;
  if (alpha < 0.02) discard;
  vec3 day = vec3(0.93, 0.98, 0.96);
  vec3 night = vec3(0.2, 1.0, 0.9) * 1.6;
  gl_FragColor = vec4(mix(day, night, uBio), alpha * (0.62 + uBio * 0.3));
}
`;

function wakeGeometry() {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(TRAIL * 2 * 3);
  const uvs = new Float32Array(TRAIL * 2 * 2);
  const indices: number[] = [];
  for (let index = 0; index < TRAIL; index++) {
    const age = index / (TRAIL - 1);
    uvs.set([0, age, 1, age], index * 4);
    if (index < TRAIL - 1) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
    }
  }
  const attribute = new BufferAttribute(positions, 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/* --------------------------------------------------------------------- trajectoire */

const path = { x: 0, z: 0, heading: 0 };

/** Position sur le cercle ondulé à l'instant t (cap = tangente). */
function sharkPath(zone: SharkZone, t: number) {
  const omega = (zone.speed / zone.radius) * zone.direction;
  const angle = zone.phase + t * omega;
  const wobble = Math.sin(angle * 3 + zone.phase) * 1.6 + Math.sin(angle * 7 - zone.phase) * 0.5;
  const radius = zone.radius + wobble;
  path.x = zone.center[0] + Math.cos(angle) * radius;
  path.z = zone.center[1] + Math.sin(angle) * radius;
  // Tangente analytique (dérivée du rayon comprise) : le cap suit vraiment la courbe.
  const dr = (Math.cos(angle * 3 + zone.phase) * 4.8 + Math.cos(angle * 7 - zone.phase) * 3.5) * omega;
  const dx = -Math.sin(angle) * radius * omega + Math.cos(angle) * dr;
  const dz = Math.cos(angle) * radius * omega + Math.sin(angle) * dr;
  path.heading = Math.atan2(dz, dx);
  return path;
}

function SharkCircling({ zone }: { zone: SharkZone }) {
  const group = useRef<Group>(null);
  const wake = useRef<Mesh>(null);
  const geometry = useMemo(() => wakeGeometry(), []);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uBio: { value: 0 } },
    vertexShader: wakeVertex,
    fragmentShader: wakeFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), []);
  const memo = useRef({ depth: -0.5, swim: 0 });

  useFrame((state, delta) => {
    const target = group.current;
    const ribbon = wake.current;
    if (!target || !ribbon) return;
    const dt = Math.min(delta, 1 / 30);
    const time = faunaClock(state.clock.elapsedTime);
    const waveTime = state.clock.elapsedTime;
    const world = useWorld.getState();
    const { x, z, heading } = sharkPath(zone, time);

    const quality = world.quality;
    const reach = quality === 'high' ? 115 : quality === 'medium' ? 90 : 70;
    const camDistance = Math.hypot(state.camera.position.x - x, state.camera.position.z - z);
    const reveal = revealScaleAt(x, z, hash(zone.seed) * 2);
    const visible = reveal > 0.01 && camDistance < reach && ecologyState.worldLife > 0.2;
    target.visible = visible;
    ribbon.visible = visible;
    if (!visible) return;

    // Cycle de plongée (≈ 1 min) et prudence : il sonde quand le bateau approche.
    const cycle = (time * zone.speed / (Math.PI * 2 * zone.radius) * 1.4 + zone.phase) % 1;
    const sounding = smoothstep(0.62, 0.68, cycle) * (1 - smoothstep(0.8, 0.86, cycle));
    const boatGap = Math.hypot(boatState.position.x - x, boatState.position.z - z);
    const wary = 1 - smoothstep(11, 17, boatGap);
    const demo = faunaDemo.kind === 'shark';
    const dive = demo ? 0 : Math.max(sounding, wary);
    const m = memo.current;
    m.depth = faunaDemo.freeze !== null ? -0.52 - dive * 1.5 : damp(m.depth, -0.52 - dive * 1.5, 1.6, dt);
    m.swim = faunaDemo.freeze !== null ? time * 5.2 : m.swim + dt * 5.2;

    const surface = waveHeight(x, z, waveTime);
    target.position.set(x, surface + m.depth, z);
    // Léger lacet synchronisé avec la nage, roulis vers l'intérieur du virage.
    target.rotation.set(-0.12 * zone.direction, -heading + Math.sin(m.swim) * 0.05, 0, 'YXZ');
    target.scale.setScalar(zone.size * reveal);
    uniforms.uSwim.value = m.swim;

    // Sillage : on remonte la trajectoire dans le temps (V qui s'ouvre derrière la dorsale).
    const exposure = clamp((m.depth + 1.25) / 0.7, 0, 1);
    const positions = geometry.getAttribute('position') as BufferAttribute;
    for (let index = 0; index < TRAIL; index++) {
      const age = index / (TRAIL - 1);
      const past = sharkPath(zone, time - index * TRAIL_STEP);
      const width = (0.16 + Math.pow(age, 0.8) * 1.05) * zone.size;
      const sideX = -Math.sin(past.heading);
      const sideZ = Math.cos(past.heading);
      // La dorsale est un peu en avant du centre : le V part de sa base.
      const baseX = past.x + Math.cos(past.heading) * 0.15 * zone.size;
      const baseZ = past.z + Math.sin(past.heading) * 0.15 * zone.size;
      const y = waveHeight(baseX, baseZ, waveTime) + 0.06;
      positions.setXYZ(index * 2, baseX - sideX * width, y, baseZ - sideZ * width);
      positions.setXYZ(index * 2 + 1, baseX + sideX * width, y, baseZ + sideZ * width);
    }
    positions.needsUpdate = true;
    const u = material.uniforms;
    u.uTime.value = time;
    u.uStrength.value = exposure * reveal;
    u.uBio.value = ecologyState.plankton;
  });

  return (
    <>
      <group ref={group}>
        <mesh geometry={SHARK_GEOMETRY} material={SHARK_MATERIAL} castShadow={false} raycast={() => null} />
      </group>
      <mesh ref={wake} geometry={geometry} material={material} frustumCulled={false} renderOrder={6} raycast={() => null} />
    </>
  );
}

export function Sharks() {
  return (
    <>
      {SHARK_ZONES.map((zone) => <SharkCircling key={zone.seed} zone={zone} />)}
    </>
  );
}
