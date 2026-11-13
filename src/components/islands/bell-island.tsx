'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, InstancedMesh, Object3D } from 'three';
import type { SubstanceModelName } from '@/lib/materials/model-materials';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { useSubstanceModel, useSubstancePieces, type SubstancePiece } from '@/lib/substance-models';
import { hash } from '@/lib/utils/math';
import { ClearingContext, clearingFor } from './clearings';
import type { HeightSampler } from './terrain-shape';

/**
 * Pose des modèles Bell Island sur les îles.
 *
 * - `SubstanceProp` : un objet unique (maison, clocher, kiosque…), posé sur le relief.
 * - `SubstanceScatter` : un semis instancié (rochers, fleurs, étoiles de mer). Un draw call
 *   par pièce distincte, quel que soit le nombre d'exemplaires.
 */

export function SubstanceProp({
  name,
  position,
  rotation = 0,
  scale = 1,
  children,
}: {
  name: SubstanceModelName;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  /** Objets attachés dans le repère du modèle (cheminée sur une maison…). */
  children?: React.ReactNode;
}) {
  const model = useSubstanceModel(name);
  const holder = useRef<Group>(null);
  const clearings = useContext(ClearingContext);
  const [px, py, pz] = position;

  // L'emprise du bâtiment devient une clairière : l'herbe de l'île n'y pousse pas.
  useLayoutEffect(() => {
    if (!clearings || !holder.current) return;
    const clearing = clearingFor(holder.current, model);
    return clearing ? clearings.add(clearing) : undefined;
  }, [clearings, model, px, py, pz, rotation, scale]);

  return (
    <group ref={holder} position={position} rotation-y={rotation} scale={scale}>
      <primitive object={model} />
      {children}
    </group>
  );
}

/** Zone de semis : où les exemplaires ont le droit de pousser. */
export interface ScatterZone {
  /** Rayon minimal et maximal autour du centre de l'île. */
  inner: number;
  outer: number;
  /** Altitudes autorisées. */
  minHeight?: number;
  maxHeight?: number;
  /** Pente maximale (0 = plat, 1 = vertical), estimée par différences finies. */
  maxSlope?: number;
  /** Secteur angulaire à éviter (le ponton), en radians. */
  avoidAngle?: number;
  avoidWidth?: number;
}

interface Placement {
  piece: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  tilt: number;
  scale: number;
}

function slopeAt(sampler: HeightSampler, x: number, z: number) {
  const step = 0.5;
  const dx = sampler(x + step, z) - sampler(x - step, z);
  const dz = sampler(x, z + step) - sampler(x, z - step);
  const gradient = Math.hypot(dx, dz) / (2 * step);
  return gradient / Math.sqrt(1 + gradient * gradient);
}

function angleDistance(a: number, b: number) {
  const d = Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  return d;
}

function computePlacements(
  sampler: HeightSampler,
  zone: ScatterZone,
  count: number,
  seed: number,
  pieceCount: number,
  scale: [number, number],
  sink: number,
) {
  const placements: Placement[] = [];
  let attempt = 0;
  while (placements.length < count && attempt < count * 14) {
    attempt += 1;
    const angle = hash(seed + attempt * 1.37) * Math.PI * 2;
    if (zone.avoidAngle !== undefined && angleDistance(angle, zone.avoidAngle) < (zone.avoidWidth ?? 0.35)) continue;
    const t = hash(seed + attempt * 3.71);
    const spread = Math.sqrt(zone.inner ** 2 + t * (zone.outer ** 2 - zone.inner ** 2));
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const y = sampler(x, z);
    if (zone.minHeight !== undefined && y < zone.minHeight) continue;
    if (zone.maxHeight !== undefined && y > zone.maxHeight) continue;
    if (zone.maxSlope !== undefined && slopeAt(sampler, x, z) > zone.maxSlope) continue;
    const s = scale[0] + hash(seed + attempt * 5.11) * (scale[1] - scale[0]);
    placements.push({
      piece: Math.floor(hash(seed + attempt * 7.77) * pieceCount) % pieceCount,
      x,
      y: y - sink * s,
      z,
      rotation: hash(seed + attempt * 9.23) * Math.PI * 2,
      tilt: (hash(seed + attempt * 2.53) - 0.5) * 0.18,
      scale: s,
    });
  }
  return placements;
}

function InstancedPiece({ piece, placements, castShadow }: { piece: SubstancePiece; placements: Placement[]; castShadow: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.tilt, placement.rotation, placement.tilt * 0.6);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [dummy, placements]);
  if (placements.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[piece.geometry, piece.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

export function SubstanceScatter({
  name,
  sampler,
  zone,
  count,
  seed,
  scale = [0.8, 1.2],
  /** `pick` : chaque exemplaire choisit une pièce (lots de rochers) ; `together` : toutes les pièces forment un objet (touffe de fleurs). */
  mode = 'pick',
  /** Nombre de pièces distinctes utilisées en mode `pick` (= draw calls). */
  variety = 5,
  /** Enfoncement dans le sol, en fraction de la taille de la pièce. */
  sink = 0.12,
  shadows = true,
}: {
  name: SubstanceModelName;
  sampler: HeightSampler;
  zone: ScatterZone;
  count: number;
  seed: number;
  scale?: [number, number];
  mode?: 'pick' | 'together';
  variety?: number;
  sink?: number;
  shadows?: boolean;
}) {
  const pieces = useSubstancePieces(name);
  const quality = useWorld((state) => state.quality);
  const density = QUALITY_LEVELS[quality].vegetationDensity;
  const actualCount = Math.max(1, Math.round(count * density));

  const chosen = useMemo(() => {
    if (mode === 'together') return pieces;
    // Sous-ensemble stable de pièces : variété visuelle sans multiplier les draw calls.
    const order = pieces.map((piece, index) => ({ piece, key: hash(seed * 3.1 + index * 1.7) }));
    order.sort((a, b) => a.key - b.key);
    return order.slice(0, Math.min(variety, pieces.length)).map((entry) => entry.piece);
  }, [mode, pieces, seed, variety]);

  const placements = useMemo(
    () => computePlacements(sampler, zone, actualCount, seed, mode === 'together' ? 1 : chosen.length, scale, sink),
    [actualCount, chosen.length, mode, sampler, scale, seed, sink, zone],
  );

  const castShadow = shadows && quality !== 'low';
  if (mode === 'together') {
    return (
      <>
        {chosen.map((piece) => (
          <InstancedPiece key={piece.name} piece={piece} placements={placements} castShadow={castShadow} />
        ))}
      </>
    );
  }
  return (
    <>
      {chosen.map((piece, index) => (
        <InstancedPiece
          key={piece.name}
          piece={piece}
          placements={placements.filter((placement) => placement.piece === index)}
          castShadow={castShadow}
        />
      ))}
    </>
  );
}
