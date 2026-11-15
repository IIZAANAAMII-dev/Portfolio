'use client';

import { useEffect } from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { Matrix4, Quaternion, Vector3, type Camera } from 'three';
import { islands } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { darkroom, probe, type ScreenPoint } from './bridge';
import { SPOTS, nearestSpot } from './fishing-data';
import { gear } from './FishingGear';
import { useGameplay } from './store';

/**
 * Le regard du gameplay, posé APRÈS le rig de caméra (même priorité, monté plus tard) :
 *  - à la pêche, la caméra descend de côté pour cadrer le bateau, la canne et le bouchon ;
 *  - dans le viseur de la carte postale, trois cadrages (trois-quarts avec l'île en fond,
 *    ras de l'eau, vue de la mouette).
 * Le rig garde son propre état : on mélange simplement sa pose et la nôtre (position
 * interpolée, orientation en slerp), d'où des allers-retours sans à-coups. Rien en mode
 * `?cam=` (captures figées) ni pendant la cinématique de la mer interdite.
 *
 * Ensuite, la sonde (positions à l'écran pour le DOM) et la chambre noire : l'image de la
 * carte postale est prise juste après un `gl.render` fait ici, dans la même tâche (le tampon
 * WebGL est encore intact, sans `preserveDrawingBuffer`).
 */

type Mode = 'none' | 'fish' | 'aim';

const UP = new Vector3(0, 1, 0);
const rigPosition = new Vector3();
const rigQuaternion = new Quaternion();
const goalPosition = new Vector3();
const goalTarget = new Vector3();
const posePosition = new Vector3();
const poseTarget = new Vector3();
const poseMatrix = new Matrix4();
const poseQuaternion = new Quaternion();
const work = new Vector3();
const point = new Vector3();
const blend = { value: 0, mode: 'none' as Mode, primed: false };

const fixedCamera = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cam');

/** Île la plus proche (bord du rivage), pour décider du fond de l'image. */
function nearestIsland(x: number, z: number) {
  let best: (typeof islands)[number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const island of islands) {
    const distance = Math.hypot(island.position[0] - x, island.position[1] - z) - island.radius;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = island;
    }
  }
  return { island: best, distance: bestDistance };
}

function fishingPose(aspect: number) {
  const { targetX, targetZ } = useGameplay.getState();
  const bx = boatState.position.x;
  const bz = boatState.position.z;
  let ux = targetX - bx;
  let uz = targetZ - bz;
  const length = Math.hypot(ux, uz) || 1;
  ux /= length;
  uz /= length;
  const cx = bx + ux * length * 0.42;
  const cz = bz + uz * length * 0.42;
  // De côté, du côté le plus dégagé (jamais dans le relief d'une île voisine).
  let px = -uz;
  let pz = ux;
  const { island } = nearestIsland(cx, cz);
  if (island && px * (island.position[0] - cx) + pz * (island.position[1] - cz) > 0) {
    px = -px;
    pz = -pz;
  }
  const landscape = aspect >= 1;
  const side = landscape ? 0.8 : 0.36;
  let dx = px * side - ux * (1 - side);
  let dz = pz * side - uz * (1 - side);
  const norm = Math.hypot(dx, dz) || 1;
  dx /= norm;
  dz /= norm;
  const distance = landscape ? 17 : 24;
  const height = landscape ? 11 : 15.5;
  goalPosition.set(cx + dx * distance, height, cz + dz * distance);
  // La visée glisse vers la caméra : le bateau monte dans le cadre et le pont arrière, où
  // retombe le poisson, reste visible au-dessus de la carte de prise.
  const lead = landscape ? 4.2 : 7;
  goalTarget.set(cx + dx * lead, landscape ? 0 : -0.4, cz + dz * lead);
}

function aimPose(framing: number, aspect: number, time: number, still: boolean) {
  const bx = boatState.position.x;
  const bz = boatState.position.z;
  // Axe de l'image : du bateau vers l'île la plus proche (elle se dresse en fond), sinon le cap.
  const { island, distance } = nearestIsland(bx, bz);
  let ux = Math.cos(boatState.heading);
  let uz = Math.sin(boatState.heading);
  if (island && distance < 95) {
    ux = island.position[0] - bx;
    uz = island.position[1] - bz;
    const norm = Math.hypot(ux, uz) || 1;
    ux /= norm;
    uz /= norm;
  }
  const portrait = aspect < 1;
  let angle: number;
  let range: number;
  let height: number;
  let lead: number;
  let aimY: number;
  if (framing === 1) {
    angle = Math.PI / 2 - 0.25;
    range = portrait ? 15 : 11.5;
    height = 3.1;
    lead = 4;
    aimY = 1.7;
  } else if (framing === 2) {
    angle = -0.55;
    range = portrait ? 15 : 12;
    height = portrait ? 38 : 31;
    lead = 6;
    aimY = 0;
  } else {
    angle = 0.42;
    range = portrait ? 23 : 17.5;
    height = 6.4;
    lead = 8;
    aimY = 2.3;
  }
  // La caméra se place derrière le bateau (−u), tournée de `angle` autour de lui.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = -ux * cos + uz * sin;
  const dz = -uz * cos - ux * sin;
  const sway = still ? 0 : Math.sin(time * 0.23) * 0.7;
  goalPosition.set(bx + dx * range - dz * sway, height, bz + dz * range + dx * sway);
  goalTarget.set(bx + ux * lead, aimY, bz + uz * lead);
}

function project(source: Vector3, out: ScreenPoint, camera: Camera, width: number, height: number) {
  work.copy(source).project(camera);
  out.x = (work.x * 0.5 + 0.5) * width;
  out.y = (-work.y * 0.5 + 0.5) * height;
  out.visible = work.z > -1 && work.z < 1 && Math.abs(work.x) < 1.04 && Math.abs(work.y) < 1.04;
}

/** Tirage de la carte postale : rendu, copie immédiate du canvas WebGL réduite à 1800 px. */
function develop(state: RootState) {
  const { gl, scene, camera } = state;
  const autoClear = gl.autoClear;
  const previous = gl.getRenderTarget();
  try {
    gl.autoClear = true;
    gl.setRenderTarget(null);
    gl.render(scene, camera);
    const source = gl.domElement;
    const scale = Math.min(1, 1800 / Math.max(source.width, source.height, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    // Canvas tenu en mémoire vive : la composition 2D qui suit ne fait aucun aller-retour GPU.
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(source, 0, 0, canvas.width, canvas.height);
    darkroom.snapshot = canvas;
  } catch {
    darkroom.snapshot = null;
  } finally {
    gl.setRenderTarget(previous);
    gl.autoClear = autoClear;
  }
  useGameplay.getState().captured();
}

export function GameplayCamera() {
  const get = useThree((state) => state.get);

  // Déclencheur direct : rendu + copie dans le gestionnaire du clic (voir bridge.ts).
  useEffect(() => {
    darkroom.capture = () => develop(get());
    return () => {
      darkroom.capture = null;
    };
  }, [get]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const camera = state.camera;
    const world = useWorld.getState();
    const game = useGameplay.getState();
    const width = state.size.width;
    const height = state.size.height;
    const aspect = width / Math.max(height, 1);

    let mode: Mode = 'none';
    if (!fixedCamera && world.phase === 'playing' && ecologyState.boundaryCinematic < 0.05) {
      if (game.photo === 'aim' || game.photo === 'shoot') mode = 'aim';
      else if (game.phase !== 'idle' && game.spot >= 0) mode = 'fish';
    }
    if (mode !== 'none') blend.mode = mode;
    const goal = mode === 'none' ? 0 : 1;
    blend.value = world.reducedMotion ? goal : damp(blend.value, goal, blend.mode === 'aim' ? 2.4 : 1.8, dt);

    if (goal === 0 && blend.value < 0.002) {
      blend.value = 0;
      blend.primed = false;
    } else {
      if (blend.mode === 'aim') aimPose(game.framing, aspect, state.clock.elapsedTime, world.reducedMotion);
      else fishingPose(aspect);
      if (!blend.primed || world.reducedMotion) {
        posePosition.copy(goalPosition);
        poseTarget.copy(goalTarget);
        blend.primed = true;
      } else {
        const lambda = 3.2;
        posePosition.set(
          damp(posePosition.x, goalPosition.x, lambda, dt),
          damp(posePosition.y, goalPosition.y, lambda, dt),
          damp(posePosition.z, goalPosition.z, lambda, dt),
        );
        poseTarget.set(
          damp(poseTarget.x, goalTarget.x, lambda, dt),
          damp(poseTarget.y, goalTarget.y, lambda, dt),
          damp(poseTarget.z, goalTarget.z, lambda, dt),
        );
      }
      poseMatrix.lookAt(posePosition, poseTarget, UP);
      poseQuaternion.setFromRotationMatrix(poseMatrix);
      const k = smoothstep(0, 1, blend.value);
      rigPosition.copy(camera.position);
      rigQuaternion.copy(camera.quaternion);
      camera.position.lerpVectors(rigPosition, posePosition, k);
      camera.quaternion.slerpQuaternions(rigQuaternion, poseQuaternion, k);
      camera.updateMatrixWorld();
    }

    // Sonde : positions à l'écran (pixels CSS) lues par l'interface DOM.
    point.set(boatState.position.x, 1.8, boatState.position.z);
    project(point, probe.boat, camera, width, height);
    if (gear.floatVisible) project(gear.float, probe.float, camera, width, height);
    else probe.float.visible = false;
    const nearest = nearestSpot(boatState.position.x, boatState.position.z);
    probe.spotIndex = nearest.index;
    probe.spotDistance = nearest.distance;
    if (nearest.index >= 0) {
      point.set(SPOTS[nearest.index].x, 0.4, SPOTS[nearest.index].z);
      project(point, probe.spot, camera, width, height);
    }
    camera.getWorldDirection(work);
    const flat = Math.hypot(work.x, work.z);
    if (flat > 0.0001) {
      probe.viewX = work.x / flat;
      probe.viewZ = work.z / flat;
    }

    // Repli de la chambre noire (le déclencheur n'a pas pu tirer tout de suite) : on attend
    // que le viseur soit en place avant le tirage.
    if (game.photo === 'shoot' && (mode !== 'aim' || blend.value > 0.97 || world.reducedMotion)) develop(state);
  });

  return null;
}
