'use client';

import { useEffect, useMemo } from 'react';
import { Vector3 } from 'three';
import { ClearingAt, on } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { Glass, Smoke } from './Glass';
import { buildHouse, type GlassSpec, type HouseParts } from './houses';
import { HOUSES, facing, polar, type HousePlan } from './layout';
import { villageMaterials } from './materials';
import { Mesher, pose, type Vec3 } from './mesher';

/**
 * Le hameau : trois maisons de granit (une longère, la maison du capitaine à étage, un
 * petit penty chaulé) tournées vers le port. Toutes les maisons sont fusionnées par
 * matériau : murs, ardoises, détails peints, vitres (par heure d'allumage), fumées.
 */

/** Pose d'une maison du plan : position au sol et orientation. */
export function housePose(sampler: HeightSampler, plan: HousePlan) {
  const [x, z] = polar(plan.angle, plan.radius);
  const position = on(sampler, x, z, Math.max(plan.width, plan.depth) * 0.45, 0.03);
  const yaw = facing(plan.angle + plan.turn);
  return { position, yaw, matrix: pose(position, [0, yaw, 0]) };
}

function buildVillage(sampler: HeightSampler) {
  const walls = new Mesher(false, true);
  const roofs = new Mesher(false, true);
  const details = new Mesher(true, false);
  const glass: GlassSpec[] = [];
  const smoke: Vec3[] = [];
  const point = new Vector3();
  for (const plan of HOUSES) {
    const { matrix } = housePose(sampler, plan);
    const parts: HouseParts = { walls: new Mesher(false, true), roof: new Mesher(false, true), details: new Mesher(true, false), glass: [] };
    const info = buildHouse(plan, () => parts);
    walls.merge(parts.walls, matrix);
    roofs.merge(parts.roof, matrix);
    details.merge(parts.details, matrix);
    for (const spec of parts.glass) glass.push({ ...spec, matrix: matrix.clone().multiply(spec.matrix) });
    for (const chimney of info.chimneys) {
      if (!plan.smoke?.includes(chimney.side)) continue;
      point.set(...chimney.top).applyMatrix4(matrix);
      smoke.push([point.x, point.y, point.z]);
    }
    parts.walls.build()?.dispose();
    parts.roof.build()?.dispose();
    parts.details.build()?.dispose();
  }
  return { walls: walls.build(), roofs: roofs.build(), details: details.build(), glass, smoke };
}

/** Perchoirs des goélands sur les faîtages (repère de l'île). */
export function villagePerches(sampler: HeightSampler): Vec3[] {
  const point = new Vector3();
  return HOUSES.flatMap((plan) => {
    const { matrix } = housePose(sampler, plan);
    const parts: HouseParts = { walls: new Mesher(false, true), roof: new Mesher(false, true), details: new Mesher(true, false), glass: [] };
    const info = buildHouse(plan, () => parts);
    return info.perches.slice(0, plan.kind === 'penty' ? 1 : 2).map((perch) => {
      point.set(...perch).applyMatrix4(matrix);
      return [point.x, point.y, point.z] as Vec3;
    });
  });
}

export function Village({ sampler }: { sampler: HeightSampler }) {
  const built = useMemo(() => buildVillage(sampler), [sampler]);
  const materials = villageMaterials();
  useEffect(() => () => {
    built.walls?.dispose();
    built.roofs?.dispose();
    built.details?.dispose();
  }, [built]);
  const clearings = useMemo(
    () => HOUSES.map((plan) => {
      const [x, z] = polar(plan.angle, plan.radius);
      return { id: plan.id, x, z, radius: Math.max(plan.width, plan.depth) * 0.62 };
    }),
    [],
  );
  return (
    <group>
      {clearings.map((clearing) => (
        <ClearingAt key={clearing.id} x={clearing.x} z={clearing.z} radius={clearing.radius} />
      ))}
      {built.walls && <mesh geometry={built.walls} material={materials.granite} castShadow receiveShadow />}
      {built.roofs && <mesh geometry={built.roofs} material={materials.slate} castShadow receiveShadow />}
      {built.details && <mesh geometry={built.details} material={materials.paint} castShadow receiveShadow />}
      <Glass specs={built.glass} />
      <Smoke sources={built.smoke} />
    </group>
  );
}
