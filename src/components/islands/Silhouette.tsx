'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { projects } from '@/data/projects';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { skillGroups } from '@/data/skills';
import { hash } from '@/lib/utils/math';
import { Scatter } from './Scatter';
import type { IslandConfig } from '@/types';

/** Végétation : deux Scatter partageant la même graine, donc parfaitement alignés. */
function Vegetation({ radius, seed, count = 14 }: { radius: number; seed: number; count?: number }) {
  return (
    <group>
      <Scatter count={count} radius={radius * 0.72} innerRadius={radius * 0.15} seed={seed} y={1.4}>
        <cylinderGeometry args={[0.14, 0.2, 1.4, 5]} />
        <meshStandardMaterial color="#7a5a3c" roughness={1} flatShading />
      </Scatter>
      <Scatter
        count={count}
        radius={radius * 0.72}
        innerRadius={radius * 0.15}
        seed={seed}
        y={3.1}
        sway={0.035}
      >
        <coneGeometry args={[1.05, 2.6, 6]} />
        <meshStandardMaterial color="#3f6b45" roughness={1} flatShading />
      </Scatter>
    </group>
  );
}

function Rocks({ radius, seed }: { radius: number; seed: number }) {
  return (
    <Scatter count={9} radius={radius * 0.92} innerRadius={radius * 0.55} seed={seed + 40} y={0.8}>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#6b6f76" roughness={1} flatShading />
    </Scatter>
  );
}

/** SKILLS : les technologies deviennent des solides en lévitation, groupés par famille. */
function SkillGrid({ island }: { island: IslandConfig }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.06;
  });

  return (
    <group ref={group} position={[0, island.elevation * 0.6 + 2.4, 0]}>
      {skillGroups.map((groupData, g) =>
        groupData.items.map((item, i) => {
          const angle = (g / skillGroups.length) * Math.PI * 2 + (i / groupData.items.length) * 0.9;
          const ring = 3.4 + g * 1.5;
          const y = Math.sin(hash(g * 13 + i) * Math.PI * 2) * 1.2;
          return (
            <mesh
              key={`${groupData.id}-${item}`}
              position={[Math.cos(angle) * ring, y, Math.sin(angle) * ring]}
              rotation={[hash(i + g) * 3, hash(i * 2 + g) * 3, 0]}
              castShadow
            >
              <octahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial
                color={island.accent}
                emissive={island.accent}
                emissiveIntensity={0.35}
                roughness={0.4}
                flatShading
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

/** PROJECTS : un monolithe par projet, posé à sa position dans les données. */
function Monoliths({ island }: { island: IslandConfig }) {
  return (
    <group>
      {projects.map((project, i) => (
        <group key={project.id} position={[project.offset[0], 1.6, project.offset[1]]}>
          <mesh position={[0, 2.6, 0]} rotation-y={hash(i * 3.1) * 0.6} castShadow receiveShadow>
            <boxGeometry args={[1.6, 5.2, 0.5]} />
            <meshStandardMaterial color="#8d8577" roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 5.5, 0]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshStandardMaterial
              color={island.accent}
              emissive={island.accent}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}
      <Vegetation radius={island.radius} seed={91} count={8} />
    </group>
  );
}

/** EXPERIENCE : une structure par poste, hauteur croissante avec l'ancienneté. */
function Towers({ island }: { island: IslandConfig }) {
  return (
    <group>
      {experiences.map((entry, i) => {
        const angle = (i / Math.max(experiences.length, 1)) * Math.PI * 1.4 - 0.7;
        const distance = island.radius * 0.38;
        const height = 4 + i * 1.8;
        return (
          <group
            key={entry.id}
            position={[Math.cos(angle) * distance, 2, Math.sin(angle) * distance]}
          >
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.4, height, 2.4]} />
              <meshStandardMaterial color="#cfc6bb" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0, height + 0.6, 0]} castShadow>
              <coneGeometry args={[2, 1.4, 4]} />
              <meshStandardMaterial color={island.accent} roughness={0.8} flatShading />
            </mesh>
          </group>
        );
      })}
      <Rocks radius={island.radius} seed={12} />
    </group>
  );
}

/** JOURNEY : un chemin physique, une borne par étape. */
function Path({ island }: { island: IslandConfig }) {
  return (
    <group>
      {journey.map((step, i) => {
        const t = i / Math.max(journey.length - 1, 1);
        const x = (t - 0.5) * island.radius * 1.3;
        const z = Math.sin(t * Math.PI * 1.4) * island.radius * 0.35;
        return (
          <group key={step.id} position={[x, 1.8 + t * 1.6, z]}>
            <mesh receiveShadow>
              <cylinderGeometry args={[1.1, 1.2, 0.3, 7]} />
              <meshStandardMaterial color="#b9ae97" roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.16, 1.5, 5]} />
              <meshStandardMaterial color="#7a5a3c" roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 1.75, 0]} castShadow>
              <sphereGeometry args={[0.24, 10, 8]} />
              <meshStandardMaterial
                color={island.accent}
                emissive={island.accent}
                emissiveIntensity={0.7}
              />
            </mesh>
          </group>
        );
      })}
      <Vegetation radius={island.radius} seed={53} count={10} />
    </group>
  );
}

/** CONTACT : presque vide. Un phare, et rien d'autre. */
function Beacon({ island }: { island: IslandConfig }) {
  const light = useRef<Group>(null);
  useFrame((state) => {
    if (light.current) light.current.rotation.y = state.clock.elapsedTime * 0.8;
  });

  return (
    <group position={[0, island.elevation * 0.5, 0]}>
      <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.5, 6.8, 8]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 7.1, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 1.4, 8]} />
        <meshStandardMaterial color="#2c3440" roughness={0.7} flatShading />
      </mesh>
      <group ref={light} position={[0, 7.1, 0]}>
        <mesh>
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshStandardMaterial color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={2} />
        </mesh>
        <pointLight color="#ffd9a0" intensity={22} distance={38} decay={2} />
      </group>
      <mesh position={[0, 8.1, 0]} castShadow>
        <coneGeometry args={[1.3, 1.1, 8]} />
        <meshStandardMaterial color="#2c3440" roughness={0.7} flatShading />
      </mesh>
    </group>
  );
}

export function Silhouette({ island }: { island: IslandConfig }) {
  switch (island.silhouette) {
    case 'nature':
      return (
        <group>
          <Vegetation radius={island.radius} seed={7} count={16} />
          <Rocks radius={island.radius} seed={7} />
        </group>
      );
    case 'grid':
      return (
        <group>
          <SkillGrid island={island} />
          <Rocks radius={island.radius} seed={31} />
        </group>
      );
    case 'monoliths':
      return <Monoliths island={island} />;
    case 'towers':
      return <Towers island={island} />;
    case 'path':
      return <Path island={island} />;
    case 'beacon':
      return <Beacon island={island} />;
  }
}
