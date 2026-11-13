'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, MeshStandardMaterial, Object3D, PointLight } from 'three';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { projects } from '@/data/projects';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { skillGroups } from '@/data/skills';
import { getSubstanceMaterial } from '@/lib/materials/substance-material';
import { hash } from '@/lib/utils/math';
import { useWorld } from '@/lib/store';
import { skyState } from '@/lib/sky';
import { SubstanceProp, SubstanceScatter } from './bell-island';
import { groundAt, terrainFeatures, type HeightSampler } from './terrain-shape';
import type { IslandConfig } from '@/types';

interface SceneProps {
  island: IslandConfig;
  sampler: HeightSampler;
  features: ReturnType<typeof terrainFeatures>;
}

/** Position posée sur le relief (le point le plus bas de l'empreinte, légèrement enfoncé). */
function on(sampler: HeightSampler, x: number, z: number, footprint = 0.8, sink = 0.06): [number, number, number] {
  return [x, groundAt(sampler, x, z, footprint) - sink, z];
}

/** Angle qui tourne la façade d'un objet vers le ponton de l'île. */
function facingDock(island: IslandConfig, x: number, z: number) {
  const dockX = Math.cos(island.dockAngle) * island.radius;
  const dockZ = Math.sin(island.dockAngle) * island.radius;
  return Math.atan2(dockX - x, dockZ - z);
}

/** Petite sphère lumineuse à la couleur de l'île, au-dessus d'un repère de contenu. */
function Beacon({ color, position, size = 0.22 }: { color: string; position: [number, number, number]; size?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 12, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
    </mesh>
  );
}

/* ------------------------------------------------------------------------------------ */
/* ABOUT — la maison-butte de Bell Island : « chez moi ».                               */
/* ------------------------------------------------------------------------------------ */
function HomeScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const base = on(sampler, hillX, hillZ, 2.6, 0.25);
  // La façade (fenêtres, porte) du modèle regarde -X : un quart de tour la tourne vers le ponton.
  const rotation = facingDock(island, hillX, hillZ) + Math.PI / 2;
  return (
    <SubstanceProp name="house-mound" position={base} rotation={rotation} scale={0.92}>
      {/* La cheminée perce le dôme à l'arrière (+X dans le repère du modèle). */}
      <SubstanceProp name="chimney-curved" position={[0.8, 6.0, 0]} scale={0.75} />
    </SubstanceProp>
  );
}

/* ------------------------------------------------------------------------------------ */
/* SKILLS — l'atelier : technologies en cristaux flottants, kiosque à outils.           */
/* ------------------------------------------------------------------------------------ */
function SkillCrystals({ island, height }: { island: IslandConfig; height: number }) {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const items = useMemo(
    () => skillGroups.flatMap((groupData, g) => groupData.items.map((item, i) => ({ groupData, g, item, i }))),
    [],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    items.forEach(({ g, i, groupData }, index) => {
      const angle = (g / skillGroups.length) * Math.PI * 2 + (i / groupData.items.length) * 0.9;
      const ring = 3.4 + g * 1.5;
      dummy.position.set(Math.cos(angle) * ring, Math.sin(hash(g * 13 + i) * Math.PI * 2) * 1.2, Math.sin(angle) * ring);
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
    <group ref={group} position={[0, height, 0]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={island.accent} emissive={island.accent} emissiveIntensity={0.35} roughness={0.4} flatShading />
      </instancedMesh>
    </group>
  );
}

function WorkshopScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ, summit } = features;
  const kioskX = hillX + 1.2;
  const kioskZ = hillZ - 0.6;
  const rotation = facingDock(island, kioskX, kioskZ);
  return (
    <>
      <SkillCrystals island={island} height={summit + 4.2} />
      <SubstanceProp name="kiosk" position={on(sampler, kioskX, kioskZ, 1.2)} rotation={rotation} scale={1.15} />
      <SubstanceProp name="chimney-straight" position={on(sampler, hillX - 1.9, hillZ + 1.4, 0.4)} scale={1.5} />
      <SubstanceProp name="chimney-straight" position={on(sampler, hillX - 2.6, hillZ + 0.3, 0.4)} scale={1.1} />
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* PROJECTS — un chantier par projet : terrasse, bannière et balise lumineuse.          */
/* ------------------------------------------------------------------------------------ */
function ProjectYard({ island, sampler }: SceneProps) {
  return (
    <>
      {projects.map((project, i) => {
        const [x, z] = project.offset;
        const base = on(sampler, x, z, 1.9, 0.18);
        const rotation = facingDock(island, x, z) + (hash(i * 3.1) - 0.5) * 0.5;
        return (
          <group key={project.id} position={base} rotation-y={rotation}>
            <SubstanceProp name="porch" position={[0, 0, 0]} scale={0.42} />
            <SubstanceProp name="flags-rectangle" position={[1.1, 0.5, -1.0]} rotation={0.4} scale={1.25} />
            <Beacon color={island.accent} position={[0, 4.2, 0]} size={0.24} />
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* EXPERIENCE — l'escalier, une bannière par poste, de la plus ancienne à la plus haute. */
/* ------------------------------------------------------------------------------------ */
function CareerScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const rotation = facingDock(island, hillX, hillZ);
  return (
    <>
      <SubstanceProp name="staircase" position={on(sampler, hillX, hillZ, 2, 0.2)} rotation={rotation} scale={0.95} />
      {experiences.map((entry, i) => {
        const angle = island.dockAngle + 0.9 + (i / Math.max(experiences.length, 1)) * Math.PI * 1.1;
        const distance = island.radius * 0.52;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const scale = 1.2 + (experiences.length - 1 - i) * 0.25;
        const base = on(sampler, x, z, 0.4, 0.05);
        return (
          <group key={entry.id} position={base}>
            <SubstanceProp name="flags-rectangle" position={[0, 0, 0]} rotation={facingDock(island, x, z)} scale={scale} />
            <Beacon color={island.accent} position={[0, 2.7 * scale, 0]} size={0.18} />
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* JOURNEY — un chemin de pierres de gué, une étape par marche.                         */
/* ------------------------------------------------------------------------------------ */
function JourneyStones({ island, sampler }: SceneProps) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const material = useMemo(
    () => getSubstanceMaterial('blocky_stone_cliff', { projection: 'triplanar', space: 'object', scale: 0.5 }),
    [],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    journey.forEach((_, index) => {
      const t = index / Math.max(journey.length - 1, 1);
      const x = (t - 0.5) * island.radius * 1.05;
      const z = Math.sin(t * Math.PI * 1.4) * island.radius * 0.26;
      dummy.position.set(x, groundAt(sampler, x, z, 0.7) + 0.05, z);
      dummy.rotation.set(0, t * Math.PI * 1.7, 0);
      dummy.scale.set(0.8 + hash(index * 4.1) * 0.2, 0.75, 0.8 + hash(index * 7.3) * 0.2);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, island.radius, sampler]);

  return (
    <instancedMesh ref={mesh} args={[undefined, material, journey.length]} castShadow receiveShadow>
      <cylinderGeometry args={[0.62, 0.76, 0.32, 9]} />
    </instancedMesh>
  );
}

function PathScene(props: SceneProps) {
  const { island, sampler } = props;
  return (
    <>
      <JourneyStones {...props} />
      <SubstanceScatter
        name="fence-set"
        sampler={sampler}
        zone={{ inner: island.radius * 0.5, outer: island.radius * 0.68, maxSlope: 0.3, minHeight: 1.2, avoidAngle: island.dockAngle, avoidWidth: 0.5 }}
        count={7}
        seed={53}
        scale={[0.9, 1.05]}
        variety={4}
        sink={0.04}
      />
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* CONTACT — le clocher : « sonnez, je réponds ». Un phare tourne à son sommet.          */
/* ------------------------------------------------------------------------------------ */
function BellScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const light = useRef<Group>(null);
  const point = useRef<PointLight>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const quality = useWorld((state) => state.quality);
  const base = on(sampler, hillX, hillZ, 1.6, 0.15);
  const rotation = facingDock(island, hillX, hillZ);
  const dockX = Math.cos(island.dockAngle) * island.radius * 0.62;
  const dockZ = Math.sin(island.dockAngle) * island.radius * 0.62;

  useFrame((state) => {
    if (light.current) light.current.rotation.y = state.clock.elapsedTime * 0.8;
    if (point.current) point.current.intensity = skyState.dayNight * 26;
    if (lamp.current) lamp.current.emissiveIntensity = 0.35 + skyState.dayNight * 2.15;
  });

  return (
    <>
      <SubstanceProp name="bell-tower" position={base} rotation={rotation} scale={1.25} />
      <group ref={light} position={[hillX, base[1] + 6.05, hillZ]}>
        <mesh>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial ref={lamp} color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={0.35} />
        </mesh>
        {quality === 'high' && <pointLight ref={point} color="#ffd9a0" intensity={0} distance={44} decay={2} />}
      </group>
      <SubstanceProp name="cymbal" position={on(sampler, dockX, dockZ, 0.8)} rotation={facingDock(island, dockX, dockZ) + Math.PI / 2} />
    </>
  );
}

const SCENES = {
  nature: HomeScene,
  grid: WorkshopScene,
  monoliths: ProjectYard,
  towers: CareerScene,
  path: PathScene,
  beacon: BellScene,
} as const;

/** Habillage commun : rochers au bord de l'eau et au pied des falaises, fleurs, étoiles de mer. */
export function IslandDressing({ island, sampler, features, seed }: SceneProps & { seed: number }) {
  const avoid = { avoidAngle: island.dockAngle, avoidWidth: 0.42 };
  return (
    <>
      <SubstanceScatter
        name="rocks-small"
        sampler={sampler}
        zone={{ inner: island.radius * 0.86, outer: island.radius * 1.12, minHeight: -0.6, maxHeight: 0.55, ...avoid }}
        count={Math.round(island.radius * 1.1)}
        seed={seed + 11}
        scale={[0.7, 1.35]}
        variety={5}
        sink={0.25}
      />
      <SubstanceScatter
        name="rocks-edged"
        sampler={sampler}
        zone={{ inner: island.radius * 0.6, outer: island.radius * 0.84, minHeight: 0.5, ...avoid }}
        count={Math.round(island.radius * 0.6)}
        seed={seed + 23}
        scale={[0.55, 1.05]}
        variety={4}
        sink={0.3}
      />
      <SubstanceScatter
        name="flower-clump"
        sampler={sampler}
        mode="together"
        zone={{ inner: 0, outer: island.radius * 0.76, minHeight: features.plateau - 0.4, maxSlope: 0.22, ...avoid }}
        count={Math.round(island.radius * 1.6)}
        seed={seed + 37}
        scale={[1.5, 2.6]}
        sink={0.02}
        shadows={false}
      />
      <SubstanceScatter
        name="starfish"
        sampler={sampler}
        mode="together"
        zone={{ inner: island.radius * 0.8, outer: island.radius * 1.02, minHeight: 0.1, maxHeight: 0.85, ...avoid }}
        count={5}
        seed={seed + 41}
        scale={[1.6, 2.4]}
        sink={0}
        shadows={false}
      />
    </>
  );
}

export function Silhouette(props: SceneProps & { seed: number }) {
  const Scene = SCENES[props.island.silhouette];
  // Une île sans décor reste navigable : seul l'habillage disparaît si un modèle manque.
  return (
    <>
      <AssetBoundary>
        <Scene {...props} />
      </AssetBoundary>
      <AssetBoundary>
        <IslandDressing {...props} />
      </AssetBoundary>
    </>
  );
}
