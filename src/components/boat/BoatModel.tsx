'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Group, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { AssetBoundary } from '@/components/world/AssetBoundary';
import { MODEL, useModelScene } from '@/lib/models';
import { bindSubstanceRoot } from '@/lib/materials/substance-material';
import { preloadSubstanceModels, useSubstanceModel } from '@/lib/substance-models';
import { boatState } from '@/lib/boat-state';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';

/**
 * Le bateau de pêche (Substance 3D Assets, habillage Bell Island). Dans le fichier, la
 * proue regarde +Z ; la navigation raisonne en « avant = +X » : le quart de tour vit ici
 * et nulle part ailleurs (voir docs/ASSETS.md).
 */
const FORWARD_FIX = Math.PI / 2;
/** 8,9 m dans le fichier → 6,7 m dans le monde, l'échelle pour laquelle caméra et sillage sont réglés. */
export const BOAT_SCALE = 0.76;
/** Ligne de flottaison du modèle (le liseré blanc), en mètres dans le fichier. */
const WATERLINE = 0.66;

/** Repères du bateau dans le repère de navigation (+X = avant, Y = surface de l'eau). */
export const BOAT_FRAME = {
  bow: 4.3 * BOAT_SCALE,
  stern: 4.4 * BOAT_SCALE,
  halfBeam: 1.25 * BOAT_SCALE,
  /** Sortie de la cheminée d'échappement posée sur la timonerie. */
  exhaust: [0.35 * BOAT_SCALE, (4.25 - WATERLINE) * BOAT_SCALE, 0.7 * BOAT_SCALE] as const,
};

/** Cheminée Bell Island sur l'arrière du toit de la timonerie (coordonnées du fichier). */
const CHIMNEY_POSITION: [number, number, number] = [-0.7, 3.2, 0.35];
const CHIMNEY_SCALE = 0.56;

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

function FishingBoat() {
  const model = useSubstanceModel('fishing-boat');
  const chimney = useSubstanceModel('chimney-straight');
  const quality = useWorld((state) => state.quality);
  const rudderPivot = useRef<Group>(null);
  const previousHeading = useRef(boatState.heading);
  const steer = useRef(0);

  // Le gouvernail (un seul mesh avec l'hélice) pivote autour de sa mèche, à l'avant du safran.
  const { rudder, pivot, hull } = useMemo(() => {
    let rudderMesh: Object3D | null = null;
    let hullMaterial: MeshStandardMaterial | null = null;
    model.traverse((child) => {
      if (child.name === 'direction_propellor_mesh') rudderMesh = child;
      if (isMesh(child)) {
        const material = child.material as MeshStandardMaterial;
        if (material.userData.substance?.options?.band) hullMaterial = material;
      }
    });
    let pivotPoint = new Vector3();
    if (rudderMesh) {
      model.updateMatrixWorld(true);
      const box = new Box3().setFromObject(rudderMesh);
      pivotPoint = new Vector3((box.min.x + box.max.x) / 2, 0, box.max.z - 0.12);
    }
    return { rudder: rudderMesh as Object3D | null, pivot: pivotPoint, hull: hullMaterial as MeshStandardMaterial | null };
  }, [model]);

  useEffect(() => {
    if (!rudder || !rudderPivot.current) return;
    const holder = rudderPivot.current;
    rudder.position.set(-pivot.x, 0, -pivot.z);
    holder.add(rudder);
    return () => {
      holder.remove(rudder);
      rudder.position.set(0, 0, 0);
      model.add(rudder);
    };
  }, [model, pivot, rudder]);

  useEffect(() => {
    const cast = quality !== 'low';
    model.traverse((child) => {
      child.castShadow = cast;
    });
    chimney.traverse((child) => {
      child.castShadow = cast;
    });
  }, [chimney, model, quality]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    // La ligne de flottaison est peinte dans le repère du modèle, qui tangue et roule.
    if (hull) bindSubstanceRoot(hull, model);
    if (rudderPivot.current && dt > 0) {
      let turn = boatState.heading - previousHeading.current;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      previousHeading.current = boatState.heading;
      const rate = turn / dt;
      const speed = Math.min(Math.abs(boatState.speed) / MAX_SPEED, 1);
      steer.current = damp(steer.current, Math.max(-0.55, Math.min(0.55, rate * 1.6)) * (0.25 + speed), 3, dt);
      rudderPivot.current.rotation.y = -steer.current;
    }
  });

  return (
    <group rotation-y={FORWARD_FIX} scale={BOAT_SCALE} position-y={-WATERLINE * BOAT_SCALE}>
      <primitive object={model} />
      <group ref={rudderPivot} position={[pivot.x, 0, pivot.z]} />
      <primitive object={chimney} position={CHIMNEY_POSITION} scale={CHIMNEY_SCALE} />
    </group>
  );
}

/** Repli : le petit navire du Kenney Pirate Kit (CC0), voiles animées. */
function PirateShip() {
  const scene = useModelScene(MODEL.ship);
  const quality = useWorld((state) => state.quality);
  const { model, animatedParts } = useMemo(() => {
    const clone = scene.clone(true);
    const parts: Object3D[] = [];
    clone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = false;
      if (child.name.startsWith('sail-') || child.name.startsWith('flag-')) {
        child.userData.baseRotationZ = child.rotation.z;
        child.userData.baseRotationY = child.rotation.y;
        child.userData.baseScaleX = child.scale.x;
        child.userData.baseScaleZ = child.scale.z;
        parts.push(child);
      }
    });
    return { model: clone, animatedParts: parts };
  }, [scene]);

  useEffect(() => {
    model.traverse((child) => {
      child.castShadow = quality !== 'low';
    });
  }, [model, quality]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const wind = Math.min(Math.abs(boatState.speed) / MAX_SPEED, 1);
    animatedParts.forEach((part, index) => {
      const isFlag = part.name.startsWith('flag-');
      const flutter = Math.sin(time * (1.7 + wind * 4.2 + index * 0.17) + index * 1.9);
      const gust = Math.sin(time * 0.63 + index * 2.4) * 0.5 + 0.5;
      const activity = 0.12 + wind * (0.72 + gust * 0.28);
      part.rotation.z = part.userData.baseRotationZ + flutter * activity * (isFlag ? 0.13 : 0.035);
      part.rotation.y = part.userData.baseRotationY + Math.sin(time * 0.9 + index) * wind * (isFlag ? 0.08 : 0.018);
      part.scale.x = part.userData.baseScaleX * (1 + wind * (isFlag ? 0.1 : 0.055) + flutter * activity * 0.025);
      part.scale.z = part.userData.baseScaleZ * (1 + wind * (isFlag ? 0.04 : 0.085));
    });
  });

  return (
    <group rotation-y={FORWARD_FIX} scale={0.76} position-y={-0.42}>
      <primitive object={model} />
    </group>
  );
}

preloadSubstanceModels(['fishing-boat', 'chimney-straight']);

export function BoatModel() {
  return (
    <AssetBoundary fallback={<PirateShip />} blocking>
      <FishingBoat />
    </AssetBoundary>
  );
}
