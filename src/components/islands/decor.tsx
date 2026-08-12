'use client';

import { MODEL, useModelPart, type ModelName } from '@/lib/models';
import { Scatter } from './Scatter';

/**
 * Décor végétal et minéral, instancié depuis le Kenney Pirate Kit.
 * Tous ces modèles sont mono-mesh et partagent le même atlas : chaque espèce coûte donc
 * exactement un draw call, quel que soit le nombre d'exemplaires.
 */

function InstancedModel({
  name,
  count,
  radius,
  innerRadius,
  seed,
  y = 0,
  sway = 0,
}: {
  name: ModelName;
  count: number;
  radius: number;
  innerRadius?: number;
  seed: number;
  y?: number;
  sway?: number;
}) {
  const { geometry, material } = useModelPart(name);
  return (
    <Scatter
      count={count}
      radius={radius}
      innerRadius={innerRadius}
      seed={seed}
      y={y}
      sway={sway}
    >
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </Scatter>
  );
}

export function Palms({
  radius,
  seed,
  count = 12,
}: {
  radius: number;
  seed: number;
  count?: number;
}) {
  return (
    <>
      <InstancedModel
        name={MODEL.palm}
        count={count}
        radius={radius * 0.74}
        innerRadius={radius * 0.2}
        seed={seed}
        y={1.5}
        sway={0.03}
      />
      <InstancedModel
        name={MODEL.palmBend}
        count={Math.round(count * 0.5)}
        radius={radius * 0.85}
        innerRadius={radius * 0.45}
        seed={seed + 11}
        y={1.5}
        sway={0.04}
      />
    </>
  );
}

export function Bushes({ radius, seed, count = 18 }: { radius: number; seed: number; count?: number }) {
  return (
    <InstancedModel
      name={MODEL.grass}
      count={count}
      radius={radius * 0.8}
      innerRadius={radius * 0.1}
      seed={seed + 200}
      y={1.6}
      sway={0.06}
    />
  );
}

export function Boulders({ radius, seed, count = 7 }: { radius: number; seed: number; count?: number }) {
  return (
    <>
      <InstancedModel
        name={MODEL.rockA}
        count={count}
        radius={radius * 0.95}
        innerRadius={radius * 0.55}
        seed={seed + 40}
        y={0.4}
      />
      <InstancedModel
        name={MODEL.rockC}
        count={Math.round(count * 0.7)}
        radius={radius * 1.02}
        innerRadius={radius * 0.7}
        seed={seed + 77}
        y={0.1}
      />
    </>
  );
}

/** Objet unique posé sur une île (phare, maison, tonneau…). */
export function Prop({
  name,
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
}: {
  name: ModelName;
  position?: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const { geometry, material } = useModelPart(name);
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation-y={rotation}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}
