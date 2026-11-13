'use client';

import { useCallback, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Vector3 } from 'three';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { skyState } from '@/lib/sky';
import { SubstanceProp, SubstanceScatter } from './bell-island';
import { AtelierScene, HomeExtras, LighthouseScene, ShipyardScene, TrailScene } from './Metaphors';
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

/* ------------------------------------------------------------------------------------ */
/* ABOUT — la maison-butte de Bell Island : « chez moi ».                               */
/* ------------------------------------------------------------------------------------ */
function HomeScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const base = on(sampler, hillX, hillZ, 2.6, 0.25);
  // La façade (fenêtres, porte) du modèle regarde -X : un quart de tour la tourne vers le ponton.
  const rotation = facingDock(island, hillX, hillZ) + Math.PI / 2;
  return (
    <>
      <SubstanceProp name="house-mound" position={base} rotation={rotation} scale={0.92}>
        {/* La cheminée perce le dôme à l'arrière (+X dans le repère du modèle). */}
        <SubstanceProp name="chimney-curved" position={[0.8, 6.0, 0]} scale={0.75} smoke />
      </SubstanceProp>
      <HomeExtras island={island} sampler={sampler} />
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

  const bell = useRef<Object3D | null>(null);
  const struck = useRef(-100);
  const chimes = useRef(0);
  const clock = useThree((state) => state.clock);

  // La grosse cloche pend à son joug : on l'accroche à un pivot placé en haut de la cloche.
  const onModel = useCallback((model: Object3D) => {
    if (bell.current) return;
    let found: Mesh | null = null;
    model.traverse((child) => {
      if (!found && (child as Mesh).isMesh && child.name.startsWith('main_bell')) found = child as Mesh;
    });
    const mesh = found as Mesh | null;
    if (!mesh || !mesh.parent) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const pivotAt = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
    mesh.updateMatrix();
    pivotAt.applyMatrix4(mesh.matrix);
    const pivot = new Object3D();
    pivot.position.copy(pivotAt);
    mesh.parent.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(mesh);
    bell.current = pivot;
  }, []);

  const ring = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    struck.current = clock.elapsedTime;
    chimes.current = 1;
    ambience.bell();
    logbook.stamp('bell');
  }, [clock]);

  useFrame((state) => {
    if (light.current) light.current.rotation.y = state.clock.elapsedTime * 0.8;
    if (point.current) point.current.intensity = skyState.dayNight * 26;
    if (lamp.current) lamp.current.emissiveIntensity = 0.35 + skyState.dayNight * 2.15;
    // Volée amortie ; la cloche retinte à chaque aller-retour, de plus en plus doucement.
    const since = state.clock.elapsedTime - struck.current;
    if (bell.current) bell.current.rotation.z = since < 9 ? Math.sin(since * 3.4) * 0.42 * Math.exp(-since * 0.42) : 0;
    const swing = Math.floor((since * 3.4) / Math.PI);
    if (since < 6 && swing > chimes.current && swing % 2 === 0) {
      chimes.current = swing;
      ambience.bell(Math.exp(-since * 0.5));
    }
  });

  return (
    <>
      <SubstanceProp name="bell-tower" position={base} rotation={rotation} scale={1.25} onModel={onModel} onClick={ring} />
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
  grid: AtelierScene,
  monoliths: ShipyardScene,
  towers: LighthouseScene,
  path: TrailScene,
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
