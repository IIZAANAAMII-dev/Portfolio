'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { projects } from '@/data/projects';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { skillGroups } from '@/data/skills';
import { MODEL } from '@/lib/models';
import { hash } from '@/lib/utils/math';
import { useWorld } from '@/lib/store';
import { skyState } from '@/lib/sky';
import { Boulders, Bushes, Palms, Prop } from './decor';
import type { IslandConfig } from '@/types';

/** ABOUT — île naturelle : palmiers, buissons, quelques rochers. */
function NatureScene({ island }: { island: IslandConfig }) {
  return (
    <>
      <Palms radius={island.radius} seed={7} count={13} />
      <Bushes radius={island.radius} seed={7} count={16} />
      <Boulders radius={island.radius} seed={7} />
      <Prop name={MODEL.house} position={[0, island.elevation * 0.62, 0]} rotation={0.4} scale={1.3} />
      <Prop name={MODEL.roof} position={[0, island.elevation * 0.62 + 2.86, 0]} rotation={0.4} scale={1.3} />
      <Prop name={MODEL.chest} position={[3.4, island.elevation * 0.45, 2.2]} rotation={-0.8} />
    </>
  );
}

/**
 * SKILLS — la seule île volontairement abstraite : les technologies flottent au-dessus
 * du sol comme des objets en cours d'assemblage. Le contraste avec les autres îles est
 * intentionnel, c'est son identité.
 */
function SkillGrid({ island }: { island: IslandConfig }) {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const items = useMemo(
    () => skillGroups.flatMap((groupData, g) =>
      groupData.items.map((item, i) => ({ groupData, g, item, i }))),
    [],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    items.forEach(({ g, i, groupData }, index) => {
      const angle = (g / skillGroups.length) * Math.PI * 2 + (i / groupData.items.length) * 0.9;
      const ring = 3.4 + g * 1.5;
      dummy.position.set(
        Math.cos(angle) * ring,
        Math.sin(hash(g * 13 + i) * Math.PI * 2) * 1.2,
        Math.sin(angle) * ring,
      );
      dummy.rotation.set(hash(i + g) * 3, hash(i * 2 + g) * 3, 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, items]);

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.06;
  });

  return (
    <>
      <group ref={group} position={[0, island.elevation * 0.6 + 2.8, 0]}>
        <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial
            color={island.accent}
            emissive={island.accent}
            emissiveIntensity={0.35}
            roughness={0.4}
            flatShading
          />
        </instancedMesh>
      </group>
      <Boulders radius={island.radius} seed={31} count={9} />
      <Prop name={MODEL.towerBase} position={[0, island.elevation * 0.62, 0]} scale={1.6} />
    </>
  );
}

/** PROJECTS — une construction par projet, posée à sa position dans les données. */
function ProjectYard({ island }: { island: IslandConfig }) {
  return (
    <>
      {projects.map((project, i) => (
        <group key={project.id} position={[project.offset[0], island.elevation * 0.6, project.offset[1]]}>
          <Prop name={MODEL.house} rotation={hash(i * 3.1) * 1.4} scale={1.1} />
          <Prop name={MODEL.roof} position={[0, 2.42, 0]} rotation={hash(i * 3.1) * 1.4} scale={1.1} />
          <Prop name={MODEL.flag} position={[1.7, 0, 1.3]} rotation={hash(i * 7.7) * 3} scale={1.2} />
          <mesh position={[0, 4.6, 0]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshStandardMaterial
              color={island.accent}
              emissive={island.accent}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}
      <Palms radius={island.radius} seed={91} count={9} />
      <Bushes radius={island.radius} seed={91} count={12} />
      <Prop name={MODEL.crate} position={[-2.4, island.elevation * 0.6, 4.6]} rotation={0.5} />
    </>
  );
}

/** EXPERIENCE — une tour par poste, de plus en plus haute avec l'ancienneté. */
function Towers({ island }: { island: IslandConfig }) {
  return (
    <>
      {experiences.map((entry, i) => {
        const angle = (i / Math.max(experiences.length, 1)) * Math.PI * 1.4 - 0.7;
        const distance = island.radius * 0.36;
        const floors = 1 + i;
        return (
          <group
            key={entry.id}
            position={[Math.cos(angle) * distance, island.elevation * 0.62, Math.sin(angle) * distance]}
          >
            {Array.from({ length: floors }, (_, floor) => (
              <Prop key={floor} name={MODEL.house} position={[0, floor * 2.2, 0]} scale={1.1} />
            ))}
            <Prop name={MODEL.roof} position={[0, floors * 2.2 + 0.22, 0]} scale={1.1} />
            <mesh position={[0, floors * 2.2 + 2.4, 0]}>
              <sphereGeometry args={[0.2, 10, 8]} />
              <meshStandardMaterial
                color={island.accent}
                emissive={island.accent}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        );
      })}
      <Boulders radius={island.radius} seed={12} />
      <Bushes radius={island.radius} seed={12} count={10} />
    </>
  );
}

/** JOURNEY — un chemin physique, une plateforme par étape. */
function JourneyMarkers({ island }: { island: IslandConfig }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    journey.forEach((_, index) => {
      const t = index / Math.max(journey.length - 1, 1);
      const x = (t - 0.5) * island.radius * 1.15;
      const z = Math.sin(t * Math.PI * 1.4) * island.radius * 0.29;
      dummy.position.set(x, island.elevation * 0.47 + t * 1.25, z);
      dummy.rotation.set(0, t * Math.PI * 1.7, 0);
      dummy.scale.set(0.75 + hash(index * 4.1) * 0.2, 0.7, 0.75 + hash(index * 7.3) * 0.2);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, island.elevation, island.radius]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, journey.length]} receiveShadow>
      <cylinderGeometry args={[0.62, 0.76, 0.3, 7]} />
      <meshStandardMaterial color="#798b72" roughness={1} flatShading />
    </instancedMesh>
  );
}

function Path({ island }: { island: IslandConfig }) {
  return (
    <>
      <JourneyMarkers island={island} />
      <Palms radius={island.radius} seed={53} count={8} />
      <Bushes radius={island.radius} seed={53} count={14} />
      <Boulders radius={island.radius} seed={53} count={6} />
    </>
  );
}

/** CONTACT — presque vide. Un phare, et rien d'autre. */
function Beacon({ island }: { island: IslandConfig }) {
  const light = useRef<Group>(null);
  const point = useRef<PointLight>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const quality = useWorld((state) => state.quality);
  useFrame((state) => {
    if (light.current) light.current.rotation.y = state.clock.elapsedTime * 0.8;
    if (point.current) point.current.intensity = skyState.dayNight * 26;
    if (lamp.current) lamp.current.emissiveIntensity = 0.35 + skyState.dayNight * 2.15;
  });

  const top = island.elevation * 0.62 + 6.6;

  return (
    <>
      <Prop name={MODEL.lighthouse} position={[0, island.elevation * 0.62, 0]} scale={1.4} />
      <group ref={light} position={[0, top, 0]}>
        <mesh>
          <sphereGeometry args={[0.45, 12, 10]} />
            <meshStandardMaterial ref={lamp} color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={0.35} />
        </mesh>
        {quality === 'high' && (
          <pointLight ref={point} color="#ffd9a0" intensity={0} distance={44} decay={2} />
        )}
      </group>
      <Boulders radius={island.radius} seed={5} count={5} />
    </>
  );
}

const SCENES = {
  nature: NatureScene,
  grid: SkillGrid,
  monoliths: ProjectYard,
  towers: Towers,
  path: Path,
  beacon: Beacon,
} as const;

export function Silhouette({ island }: { island: IslandConfig }) {
  const Scene = SCENES[island.silhouette];
  // Une île sans décor reste navigable : seul l'habillage disparaît si un modèle manque.
  return (
    <AssetBoundary>
      <Scene island={island} />
    </AssetBoundary>
  );
}
