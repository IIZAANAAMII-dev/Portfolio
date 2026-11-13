'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { projects } from '@/data/projects';
import { skillZones } from '@/data/skills';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { IslandConfig } from '@/types';
import { ChimneySmoke } from './ChimneySmoke';
import { ClearingAt, facingDock, on, PaintedSign, useClearing, useHandFont } from './kit';
import { groundAt, type HeightSampler, type terrainFeatures } from './terrain-shape';

/**
 * Îles-métaphores : chaque île raconte son contenu en volumes, à partir des données du
 * portfolio (modifier `data/*.ts` met les îles à jour).
 *  - Compétences → l'Atelier : une forge et un totem par domaine, emblème qui tourne.
 *  - Projets → le Chantier naval : un bateau par projet sur sa cale, une grue.
 *  - Expériences → les Phares : un phare par poste, le plus récent le plus haut.
 *  - Parcours → le Sentier : un chemin de pierres qui monte, un panneau par étape.
 */

export interface MetaphorProps {
  island: IslandConfig;
  sampler: HeightSampler;
  features: ReturnType<typeof terrainFeatures>;
}

/* ================================================================= ATELIER */

const EMBLEM_COLORS = ['#5ee0ff', '#f29a3a', '#4f8fe0', '#e8668c'];

/** Atome (Frontend) : trois orbites et leurs électrons autour d'un noyau. */
function Atom({ color }: { color: string }) {
  const orbits = useRef<Group>(null);
  useFrame((state) => {
    const target = orbits.current;
    if (!target) return;
    target.children.forEach((ring, index) => {
      ring.rotation.z = state.clock.elapsedTime * (1.2 + index * 0.35);
    });
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.15, 14, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
      </mesh>
      <group ref={orbits}>
        {[0, 1, 2].map((index) => (
          <group key={index} rotation={[Math.PI / 2 + 0.2, (index * Math.PI) / 3, 0]}>
            <mesh>
              <torusGeometry args={[0.55, 0.03, 6, 40]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0.55, 0, 0]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Engrenage (Backend). */
function Gear({ color }: { color: string }) {
  const teeth = 12;
  return (
    <group rotation-x={Math.PI / 2}>
      <mesh castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.16, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} flatShading />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.14, 0.14, 0.18, 12]} />
        <meshStandardMaterial color="#3e4448" roughness={0.6} />
      </mesh>
      {Array.from({ length: teeth }, (_, index) => {
        const angle = (index / teeth) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.48]} rotation-y={-angle}>
            <boxGeometry args={[0.14, 0.16, 0.13]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Conteneurs empilés (DevOps). */
function Containers() {
  const stack: [number, number, string][] = [[-0.33, 0, '#2f7fd6'], [0.33, 0, '#e2553f'], [0, 0.34, '#9cc35a']];
  return (
    <group position-y={-0.15}>
      {stack.map(([x, y, color]) => (
        <mesh key={color} position={[x, y, 0]} castShadow>
          <boxGeometry args={[0.6, 0.32, 0.34]} />
          <meshStandardMaterial color={color} roughness={0.55} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Plume de dessin (Design). */
function Nib({ color }: { color: string }) {
  return (
    <group rotation-z={Math.PI}>
      <mesh scale={[1, 1, 0.38]} castShadow>
        <coneGeometry args={[0.32, 0.9, 4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0.11]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#2a2530" />
      </mesh>
    </group>
  );
}

function Emblem({ index, color }: { index: number; color: string }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.7 + index;
    group.current.position.y = Math.sin(t * 1.4 + index) * 0.12;
  });
  return (
    <group ref={group}>
      {index === 0 ? <Atom color={color} /> : index === 1 ? <Gear color={color} /> : index === 2 ? <Containers /> : <Nib color={color} />}
    </group>
  );
}

function Forge({ position }: { position: [number, number, number] }) {
  const embers = useRef<MeshStandardMaterial>(null);
  const light = useRef<PointLight>(null);
  const quality = useWorld((state) => state.quality);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const flicker = 2.2 + Math.sin(t * 13) * 0.4 + Math.sin(t * 7.3) * 0.3;
    if (embers.current) embers.current.emissiveIntensity = flicker;
    if (light.current) light.current.intensity = (4 + skyState.dayNight * 14) * (flicker / 2.2);
  });
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position-y={0.35}>
        <cylinderGeometry args={[0.95, 1.1, 0.7, 8]} />
        <meshStandardMaterial color="#8d8a96" roughness={1} flatShading />
      </mesh>
      {[0, 1, 2, 3, 4].map((index) => (
        <mesh key={index} position={[Math.cos(index * 1.3) * 0.35, 0.74, Math.sin(index * 1.3) * 0.35]}>
          <icosahedronGeometry args={[0.2 + hash(index) * 0.08, 0]} />
          <meshStandardMaterial ref={index === 0 ? embers : undefined} color="#5a1f12" emissive="#ff6a24" emissiveIntensity={2.2} flatShading />
        </mesh>
      ))}
      <mesh castShadow position={[0.55, 1.6, -0.3]}>
        <cylinderGeometry args={[0.16, 0.2, 2.4, 8]} />
        <meshStandardMaterial color="#3e4448" roughness={0.7} />
      </mesh>
      <ChimneySmoke position={[0.55, 2.8, -0.3]} />
      {/* Enclume. */}
      <group position={[-1.5, 0, 0.4]} rotation-y={0.5}>
        <mesh castShadow position-y={0.22}>
          <boxGeometry args={[0.36, 0.44, 0.3]} />
          <meshStandardMaterial color="#3e4448" roughness={0.6} />
        </mesh>
        <mesh castShadow position-y={0.52}>
          <boxGeometry args={[0.78, 0.18, 0.34]} />
          <meshStandardMaterial color="#4a5157" roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh castShadow position={[0.5, 0.52, 0]} rotation-z={-Math.PI / 2}>
          <coneGeometry args={[0.13, 0.42, 8]} />
          <meshStandardMaterial color="#4a5157" roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
      {quality !== 'low' && <pointLight ref={light} position={[0, 1.4, 0]} color="#ff8a3d" intensity={4} distance={12} decay={2} />}
    </group>
  );
}

export function AtelierScene({ island, sampler, features }: MetaphorProps) {
  const { hillX, hillZ } = features;
  useClearing(hillX, hillZ, 2.2);
  const totems = skillZones.map((group, index) => {
    const angle = island.dockAngle - 1.1 + (index / Math.max(skillZones.length - 1, 1)) * 2.2;
    const distance = island.radius * 0.42;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    return { group, index, x, z, base: on(sampler, x, z, 0.4, 0.05) };
  });
  return (
    <>
      <Forge position={on(sampler, hillX, hillZ, 1.2, 0.1)} />
      {totems.map(({ group, index, x, z, base }) => (
        <group key={group.id}>
          <ClearingAt x={x} z={z} radius={1.6} />
          <PaintedSign lines={[group.label]} position={base} rotation={facingDock(island, x, z)} accent={EMBLEM_COLORS[index]} width={1.9} post={1.7} />
          <group position={[base[0], base[1] + 3.9, base[2]]} scale={1.6}>
            <Emblem index={index} color={EMBLEM_COLORS[index]} />
          </group>
        </group>
      ))}
    </>
  );
}

/* ========================================================= CHANTIER NAVAL */

const HULL_COLORS = ['#e2553f', '#2f7fd6', '#f2c14e', '#9cc35a'];

function hullGeometry() {
  // Demi-sphère étirée : une coque ronde et « jouet ».
  const geometry = new SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  geometry.scale(2.2, 0.85, 0.95);
  return geometry;
}

function flagTexture(text: string, family: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 26, 192);
  ctx.fillStyle = '#3b2f25';
  ctx.font = `500 96px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 270, 102, 440);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ProjectBoat({ title, color, position, rotation }: { title: string; color: string; position: [number, number, number]; rotation: number }) {
  const family = useHandFont();
  const hull = useMemo(() => hullGeometry(), []);
  const texture = useMemo(() => (family ? flagTexture(title, family, color) : null), [color, family, title]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <group position={position} rotation-y={rotation}>
      {/* Cale de lancement : deux rails et des berceaux. */}
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[0.4, 0.08, z]} rotation-z={-0.08} castShadow receiveShadow>
          <boxGeometry args={[5.4, 0.16, 0.22]} />
          <meshStandardMaterial color="#7a5034" roughness={1} />
        </mesh>
      ))}
      {[-1.1, 0, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.32, 0]} castShadow>
          <boxGeometry args={[0.22, 0.4, 1.5]} />
          <meshStandardMaterial color="#8a5d3b" roughness={1} />
        </mesh>
      ))}
      <group position-y={1.15} scale={1.3}>
        <mesh geometry={hull} castShadow>
          <meshStandardMaterial color={color} roughness={0.5} side={DoubleSide} />
        </mesh>
        {/* Pont en retrait sous le plat-bord : le bordé coloré reste visible d'en haut. */}
        <mesh position-y={-0.2} scale={[2.0, 0.82, 1]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1, 24]} />
          <meshStandardMaterial color="#b98d5e" roughness={0.9} />
        </mesh>
        <mesh position-y={0.01} scale={[2.2, 0.95, 1]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1, 0.06, 6, 32]} />
          <meshStandardMaterial color="#f7f1e3" roughness={0.6} />
        </mesh>
        <mesh position={[-0.5, 0.36, 0]} castShadow>
          <boxGeometry args={[0.9, 0.62, 0.8]} />
          <meshStandardMaterial color="#f7f1e3" roughness={0.6} />
        </mesh>
        <mesh position={[0.5, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2.8, 6]} />
          <meshStandardMaterial color="#6e4a33" roughness={1} />
        </mesh>
        {texture && (
          <mesh position={[1.12, 2.35, 0]}>
            <planeGeometry args={[1.25, 0.47]} />
            <meshStandardMaterial map={texture} side={DoubleSide} roughness={0.9} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Crane({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const load = useRef<Group>(null);
  useFrame((state) => {
    if (load.current) load.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1) * 0.12;
  });
  return (
    <group position={position} rotation-y={rotation}>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 2, 0]} castShadow>
          <boxGeometry args={[0.18, 4, 0.18]} />
          <meshStandardMaterial color="#8a5d3b" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 4.05, 0]} castShadow>
        <boxGeometry args={[2.8, 0.2, 0.24]} />
        <meshStandardMaterial color="#7a5034" roughness={1} />
      </mesh>
      <group ref={load} position={[0.3, 3.95, 0]}>
        <mesh position-y={-0.8}>
          <cylinderGeometry args={[0.015, 0.015, 1.6, 4]} />
          <meshStandardMaterial color="#c9a66b" roughness={1} />
        </mesh>
        <mesh position-y={-1.8} castShadow>
          <boxGeometry args={[0.7, 0.55, 0.6]} />
          <meshStandardMaterial color="#b98a55" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

export function ShipyardScene({ island, sampler, features }: MetaphorProps) {
  const { hillX, hillZ } = features;
  return (
    <>
      {projects.map((project, index) => {
        const angle = island.dockAngle + 0.9 + (index / projects.length) * (Math.PI * 2 - 1.8);
        const x = Math.cos(angle) * island.radius * 0.5;
        const z = Math.sin(angle) * island.radius * 0.5;
        return (
          <group key={project.id}>
            <ClearingAt x={x} z={z} radius={3.2} />
            <ProjectBoat
              title={project.title}
              color={HULL_COLORS[index % HULL_COLORS.length]}
              position={on(sampler, x, z, 2.2, 0.12)}
              rotation={facingDock(island, x, z) + Math.PI / 2}
            />
          </group>
        );
      })}
      <Crane position={on(sampler, hillX, hillZ, 1.4, 0.1)} rotation={facingDock(island, hillX, hillZ)} />
    </>
  );
}

/* ================================================================ PHARES */

const STRIPES = ['#d8473a', '#2f6fc0', '#3f9a5c', '#e0a321'];

function stripedTower(height: number, color: string) {
  const tower = new CylinderGeometry(0.45, 0.7, height, 14, 8).toNonIndexed();
  const positions = tower.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const band = new Color(color);
  const white = new Color('#f4efe6');
  for (let face = 0; face < positions.count; face += 3) {
    const y = (positions.getY(face) + positions.getY(face + 1) + positions.getY(face + 2)) / 3;
    const stripe = Math.floor(((y + height / 2) / height) * 6) % 2 === 0 ? white : band;
    for (let k = 0; k < 3; k++) stripe.toArray(colors, (face + k) * 3);
  }
  tower.setAttribute('color', new BufferAttribute(colors, 3));
  tower.computeVertexNormals();
  tower.translate(0, height / 2, 0);
  return tower;
}

function MiniLighthouse({ height, color, position }: { height: number; color: string; position: [number, number, number] }) {
  const tower = useMemo(() => stripedTower(height, color), [color, height]);
  const lamp = useRef<Mesh>(null);
  const beam = useRef<Group>(null);
  useFrame((state, delta) => {
    const night = skyState.dayNight;
    if (lamp.current) (lamp.current.material as MeshStandardMaterial).emissiveIntensity = 0.5 + night * 3;
    if (beam.current) {
      beam.current.rotation.y += Math.min(delta, 1 / 30) * 0.9;
      beam.current.visible = night > 0.1;
    }
  });
  return (
    <group position={position}>
      <mesh geometry={tower} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
      <mesh position-y={height + 0.06}>
        <cylinderGeometry args={[0.66, 0.66, 0.12, 12]} />
        <meshStandardMaterial color="#2a2c33" roughness={0.5} />
      </mesh>
      <mesh ref={lamp} position-y={height + 0.42}>
        <cylinderGeometry args={[0.32, 0.32, 0.6, 10]} />
        <meshStandardMaterial color="#fff2cf" emissive="#ffc76e" emissiveIntensity={0.5} />
      </mesh>
      <mesh position-y={height + 0.92} castShadow>
        <coneGeometry args={[0.44, 0.5, 10]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <group ref={beam} position-y={height + 0.42}>
        <mesh rotation-z={Math.PI / 2} position-x={6}>
          <coneGeometry args={[1.2, 12, 12, 1, true]} />
          <meshBasicMaterial color="#ffe0a3" transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function LighthouseScene({ island, sampler }: MetaphorProps) {
  return (
    <>
      {experiences.map((entry, index) => {
        const angle = island.dockAngle + 0.75 + (index / Math.max(experiences.length - 1, 1)) * 1.9;
        const distance = island.radius * 0.45;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        // Le poste le plus récent est le plus haut.
        const height = 6.2 - index * 1.3;
        const base = on(sampler, x, z, 0.9, 0.12);
        const signX = x + Math.cos(angle - 0.5) * 1.9;
        const signZ = z + Math.sin(angle - 0.5) * 1.9;
        const company = entry.company.split(' ').slice(0, 2).join(' ');
        return (
          <group key={entry.id}>
            <ClearingAt x={x} z={z} radius={1.2} />
            <MiniLighthouse height={height} color={STRIPES[index % STRIPES.length]} position={base} />
            <PaintedSign
              lines={[company, entry.period.split('—')[0].trim()]}
              position={on(sampler, signX, signZ, 0.3, 0.04)}
              rotation={facingDock(island, signX, signZ)}
              accent={STRIPES[index % STRIPES.length]}
              width={2}
              post={1.2}
            />
          </group>
        );
      })}
    </>
  );
}

/* ================================================================ SENTIER */

export function TrailScene({ island, sampler, features }: MetaphorProps) {
  const stones = useRef<InstancedMesh>(null);
  const { hillX, hillZ } = features;
  // Du ponton jusqu'au sommet, en lacets.
  const curve = useMemo(() => {
    const start = island.dockAngle;
    const points = [0, 1, 2, 3, 4].map((step) => {
      const t = step / 4;
      const angle = start + t * 2.4;
      const reach = island.radius * (0.78 - t * 0.7);
      return new Vector3(hillX * t + Math.cos(angle) * reach, 0, hillZ * t + Math.sin(angle) * reach);
    });
    return new CatmullRomCurve3(points, false, 'centripetal');
  }, [hillX, hillZ, island.dockAngle, island.radius]);
  const count = Math.max(8, Math.round(curve.getLength() / 0.85));

  useLayoutEffect(() => {
    const target = stones.current;
    if (!target) return;
    const dummy = new Object3D();
    const point = new Vector3();
    for (let index = 0; index < count; index++) {
      curve.getPointAt(index / (count - 1), point);
      const jitter = (hash(index * 3.3) - 0.5) * 0.35;
      const x = point.x + jitter;
      const z = point.z - jitter;
      dummy.position.set(x, groundAt(sampler, x, z, 0.3) + 0.02, z);
      dummy.rotation.set(0, hash(index * 1.9) * Math.PI, 0);
      const size = 0.32 + hash(index * 7.1) * 0.14;
      dummy.scale.set(size, 0.12, size * (0.8 + hash(index * 2.2) * 0.3));
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [count, curve, sampler]);

  const milestones = journey.map((step, index) => {
    const t = 0.1 + (index / Math.max(journey.length - 1, 1)) * 0.86;
    const point = curve.getPointAt(Math.min(t, 1));
    const tangent = curve.getTangentAt(Math.min(t, 1));
    const side = index % 2 === 0 ? 1 : -1;
    const x = point.x - tangent.z * 1.25 * side;
    const z = point.z + tangent.x * 1.25 * side;
    return { step, x, z };
  });

  return (
    <>
      <instancedMesh ref={stones} args={[undefined, undefined, count]} castShadow receiveShadow raycast={() => null}>
        <cylinderGeometry args={[1, 1.1, 1, 7]} />
        <meshStandardMaterial color="#cfc6b6" roughness={1} flatShading />
      </instancedMesh>
      {milestones.map(({ step, x, z }) => (
        <PaintedSign
          key={step.id}
          lines={[step.marker, step.title]}
          position={on(sampler, x, z, 0.3, 0.04)}
          rotation={facingDock(island, x, z)}
          accent={island.accent}
          width={1.9}
          post={1.25}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------- utilitaires */

/* ============================================================ À PROPOS : CHEZ MOI */

function screenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#16202c';
  ctx.fillRect(0, 0, 256, 160);
  const lines = [
    ['#ff9ad5', 'export function'],
    ['#bff6ff', '  Portfolio() {'],
    ['#ffe28a', "    return <Archipel />"],
    ['#bff6ff', '  }'],
    ['#7fa7b8', '// fait main, avec soin'],
  ];
  ctx.font = '600 17px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'top';
  lines.forEach(([color, text], index) => {
    ctx.fillStyle = color;
    ctx.fillText(text, 12, 14 + index * 27);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Bureau en plein air : table, ordinateur ouvert sur du code, tasse qui fume, chaise. */
function OutdoorDesk({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const screen = useMemo(() => screenTexture(), []);
  const glow = useRef<MeshStandardMaterial>(null);
  useEffect(() => () => screen.dispose(), [screen]);
  useFrame(() => {
    if (glow.current) glow.current.emissiveIntensity = 0.55 + skyState.dayNight * 1.4;
  });
  const wood = '#9b6b45';
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow receiveShadow position-y={0.86}>
        <boxGeometry args={[1.5, 0.08, 0.8]} />
        <meshStandardMaterial color={wood} roughness={0.9} />
      </mesh>
      {[[-0.66, -0.32], [0.66, -0.32], [-0.66, 0.32], [0.66, 0.32]].map(([x, z]) => (
        <mesh key={`${x}${z}`} castShadow position={[x, 0.42, z]}>
          <boxGeometry args={[0.07, 0.84, 0.07]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
      ))}
      {/* Ordinateur portable : socle, écran incliné qui affiche du code. */}
      <mesh castShadow position={[0, 0.915, 0.05]}>
        <boxGeometry args={[0.62, 0.03, 0.42]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.35} metalness={0.4} />
      </mesh>
      <group position={[0, 0.93, -0.16]} rotation-x={-0.32}>
        <mesh castShadow position-y={0.2}>
          <boxGeometry args={[0.62, 0.4, 0.025]} />
          <meshStandardMaterial color="#c9ced6" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0.014]}>
          <planeGeometry args={[0.56, 0.35]} />
          <meshStandardMaterial ref={glow} map={screen} emissive="#ffffff" emissiveMap={screen} emissiveIntensity={0.6} roughness={0.4} />
        </mesh>
      </group>
      {/* Tasse de café, et sa vapeur. */}
      <group position={[0.52, 0.9, 0.12]}>
        <mesh castShadow position-y={0.07}>
          <cylinderGeometry args={[0.07, 0.06, 0.14, 12]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.5} />
        </mesh>
        <mesh position={[0.08, 0.07, 0]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.04, 0.012, 6, 12]} />
          <meshStandardMaterial color="#f4efe6" roughness={0.5} />
        </mesh>
        <group scale={0.18}>
          <ChimneySmoke position={[0, 0.9, 0]} />
        </group>
      </group>
      {/* Chaise. */}
      <group position={[0, 0, 0.75]}>
        <mesh castShadow position-y={0.46}>
          <boxGeometry args={[0.5, 0.06, 0.48]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, 0.78, 0.22]}>
          <boxGeometry args={[0.5, 0.56, 0.05]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
        {[[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.22, z]}>
            <boxGeometry args={[0.05, 0.44, 0.05]} />
            <meshStandardMaterial color={wood} roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Boîte aux lettres au pied du ponton, au nom du propriétaire des lieux. */
function Mailbox({ position, rotation, accent }: { position: [number, number, number]; rotation: number; accent: string }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow position-y={0.55}>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 6]} />
        <meshStandardMaterial color="#6e4a33" roughness={1} />
      </mesh>
      <mesh castShadow position-y={1.2}>
        <boxGeometry args={[0.5, 0.34, 0.32]} />
        <meshStandardMaterial color="#d8473a" roughness={0.55} />
      </mesh>
      <mesh position={[0.26, 1.38, 0.08]}>
        <boxGeometry args={[0.03, 0.26, 0.06]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.5} />
      </mesh>
      <PaintedSign lines={['Kyliann']} position={[0, 0, -0.45]} rotation={0} accent={accent} width={1.2} post={0.85} />
    </group>
  );
}

/** Habillage « chez moi » de l'île À propos : ce que Kyliann fait, là où il vit. */
export function HomeExtras({ island, sampler }: Pick<MetaphorProps, 'island' | 'sampler'>) {
  const deskAngle = island.dockAngle + 0.95;
  const deskX = Math.cos(deskAngle) * island.radius * 0.5;
  const deskZ = Math.sin(deskAngle) * island.radius * 0.5;
  const boxAngle = island.dockAngle + 0.2;
  const boxX = Math.cos(boxAngle) * island.radius * 0.9;
  const boxZ = Math.sin(boxAngle) * island.radius * 0.9;
  return (
    <>
      <ClearingAt x={deskX} z={deskZ} radius={1.7} />
      <ClearingAt x={boxX} z={boxZ} radius={0.8} />
      <OutdoorDesk position={on(sampler, deskX, deskZ, 0.9, 0.04)} rotation={facingDock(island, deskX, deskZ)} />
      <Mailbox position={on(sampler, boxX, boxZ, 0.4, 0.04)} rotation={facingDock(island, boxX, boxZ)} accent={island.accent} />
    </>
  );
}
