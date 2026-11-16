'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3, type Camera } from 'three';
import { arrivalShot, distanceHome, mooring } from '@/components/boat/mooring';
import { splashState } from '@/components/boat/Splash';
import { islandById } from '@/data/islands';
import { impactRecoil, introCameraAt } from '@/components/intro/camera-path';
import { sceneConfigs } from '@/components/islands/scenes/registry';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { INTRO_DURATION, introSeconds } from '@/lib/cinematic';
import { atelier } from '@/lib/livery';
import { SHEET_PEEK, sheetState } from '@/lib/sheet';
import { useWorld } from '@/lib/store';
import { damp, lerp, shortestAngle, smoothstep } from '@/lib/utils/math';
import { MAX_SPEED } from '@/hooks/useBoatNavigation';
import { arrivalPose, atelierPose, springTo } from './shots';

const desiredPosition = new Vector3();
const desiredTarget = new Vector3();
const gameplayPosition = new Vector3();
const gameplayTarget = new Vector3();
const introPosition = new Vector3();
const introTarget = new Vector3();
const boundaryPosition = new Vector3();
const boundaryTarget = new Vector3();
// Vecteurs de travail réutilisés (aucune allocation par image).
const workForward = new Vector3();
const workSide = new Vector3();
const bankPosition = new Vector3();
const bankTarget = new Vector3();

/** Poses de départ et d'arrivée de la grue d'ouverture (vecteurs partagés, champ mis à jour). */
const introStartPose = { position: introPosition, target: introTarget, fov: 30 };
const introEndPose = { position: gameplayPosition, target: gameplayTarget, fov: 42 };
/**
 * Échelle des clés de la grue : un téléphone recule et monte un peu plus (cadre plus serré) ;
 * en portrait, le regard porte moins loin (moins de ciel, l'archipel au centre de l'écran).
 */
const CRANE_SCALE = {
  desktop: { along: 1, height: 1, reach: 1 },
  mobile: { along: 1.1, height: 1.12, reach: 0.9 },
  portrait: { along: 1.18, height: 1.2, reach: 0.68 },
};

function introFov(aspect: number, mobile: boolean) {
  return aspect < 0.82 ? 36 : mobile ? 33 : 30;
}

/** Téléphone en portrait, à quai : champ vertical plus ouvert (le cadre est étroit). */
const PORTRAIT_DOCK_FOV = 50;
/** Bureau, page ouverte à gauche : part de la largeur dont le plan rapproché décale le sujet. */
const PANEL_SHIFT = 0.36;
/** Durée de la glissade douce quand on quitte le quai (cadrage de l'île → suivi du bateau). */
const DEPART_GLIDE = 2.6;
/** Bande occupée par la barre du HUD en haut d'un téléphone (part de la hauteur d'écran). */
const HUD_TOP_SHARE = 0.085;

/**
 * Mode photo : `?cam=x,y,z,tx,ty,tz` fige la caméra sur une position et une cible (relevés
 * visuels, captures d'écran). Lu une seule fois.
 */
const photoCamera = (() => {
  if (typeof window === 'undefined') return null;
  const values = new URLSearchParams(window.location.search).get('cam')?.split(',').map(Number);
  if (!values || values.length !== 6 || values.some((value) => !Number.isFinite(value))) return null;
  return { position: new Vector3(values[0], values[1], values[2]), target: new Vector3(values[3], values[4], values[5]) };
})();

function directions() {
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  return { forwardX, forwardZ, sideX: forwardZ, sideZ: -forwardX };
}

function introPose(mobile: boolean, aspect: number) {
  const portrait = aspect < 0.82;
  // Caméra 3/4 plongeante face à l'avant du bateau, le bateau est le sujet,
  // l'îlot n'est qu'un petit décor derrière / sur le côté.
  const bx = boatState.position.x;
  const bz = boatState.position.z;
  const forward = workForward.set(Math.cos(boatState.heading), 0, Math.sin(boatState.heading)).normalize();
  const side = workSide.set(forward.z, 0, -forward.x);
  const dist = portrait ? 30 : mobile ? 27 : 26;
  const sideShift = portrait ? -5.5 : mobile ? -4.5 : -4.0;
  const height = portrait ? 11 : mobile ? 10 : 9.5;
  introPosition.set(
    bx - forward.x * dist + side.x * sideShift,
    height,
    bz - forward.z * dist + side.z * sideShift,
  );
  introTarget.set(bx, 2.2, bz);
}

/** Place la caméra d'intro (utilisée aussi par la scène de chargement avant le montage du rig). */
export function placeIntroCamera(camera: Camera, mobile: boolean, aspect: number) {
  introPose(mobile, aspect);
  camera.position.copy(introPosition);
  camera.lookAt(introTarget);
  if (camera instanceof PerspectiveCamera) {
    const fov = introFov(aspect, mobile);
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}

function gameplayPose(mobile: boolean) {
  const { forwardX, forwardZ } = directions();
  const distance = mobile ? 36 : 30;
  const height = mobile ? 62 : 54;
  gameplayPosition.set(
    boatState.position.x - forwardX * distance,
    height,
    boatState.position.z - forwardZ * distance,
  );
  gameplayTarget.set(
    boatState.position.x + forwardX * 8,
    0.8,
    boatState.position.z + forwardZ * 8,
  );
}

function boundaryPose(mobile: boolean) {
  let dx = ecologyState.monsterX - boatState.position.x;
  let dz = ecologyState.monsterZ - boatState.position.z;
  const length = Math.max(Math.hypot(dx, dz), 0.001);
  dx /= length;
  dz /= length;
  const sideX = -dz;
  const sideZ = dx;
  const midpointX = (boatState.position.x + ecologyState.monsterX) * 0.5;
  const midpointZ = (boatState.position.z + ecologyState.monsterZ) * 0.5;
  const distance = mobile ? 92 : 78;
  boundaryPosition.set(
    midpointX + sideX * distance - dx * 7,
    mobile ? 22 : 18,
    midpointZ + sideZ * distance - dz * 7,
  );
  boundaryTarget.set(midpointX, 12, midpointZ);
}

/**
 * Grue d'ouverture : pose de la caméra `seconds` après le clic (voir intro/camera-path.ts),
 * avec le recul encaissé à l'impact du bateau. Renvoie le champ vertical.
 */
function cranePose(seconds: number, mobile: boolean, aspect: number, reducedMotion: boolean, outPosition: Vector3, outTarget: Vector3) {
  const portrait = aspect < 0.82;
  introStartPose.fov = introFov(aspect, mobile);
  const wide = portrait ? 56 : mobile ? 48 : 46;
  const scale = portrait ? CRANE_SCALE.portrait : mobile ? CRANE_SCALE.mobile : CRANE_SCALE.desktop;
  const fov = introCameraAt(seconds, introStartPose, introEndPose, wide, scale, outPosition, outTarget);
  if (!reducedMotion) {
    // L'impact pousse la caméra vers l'arrière et vers le haut, vivement, puis la grue l'absorbe.
    const recoil = impactRecoil(seconds);
    if (recoil > 0) {
      workForward.subVectors(outPosition, outTarget).setY(0).normalize();
      outPosition.addScaledVector(workForward, recoil);
      outPosition.y += recoil * 0.45;
    }
  }
  return fov;
}

export function CameraRig({ mobile }: { mobile: boolean }) {
  const pointer = useThree((state) => state.pointer);
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1));
  const position = useRef(new Vector3());
  const target = useRef(new Vector3());
  /** Vitesses de la caméra et de sa visée (glissades à ressort, vitesse continue). */
  const velocity = useRef({ position: new Vector3(), target: new Vector3() });
  const initialized = useRef(false);
  const lens = useRef({ shift: 0, applied: 0 });
  const lastPhase = useRef('loading');
  /** Instant où le bateau a quitté le quai (ou la page s'est fermée) : glissade douce vers le suivi. */
  const departAt = useRef(-10);
  /** Plan de l'atelier de peinture à l'image précédente (sa fin relance la glissade douce). */
  const atelierShot = useRef(false);

  useFrame((state, delta) => {
    const camera = state.camera;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { phase, gameTransition, activeIsland, reducedMotion } = useWorld.getState();
    // Mouvement réduit : le monde se pose d'un coup sous le fondu de la carte, la caméra aussi.
    const snapAfterIntro = reducedMotion && phase !== lastPhase.current
      && (lastPhase.current === 'intro' || lastPhase.current === 'transitioning');
    if (lastPhase.current === 'docked' && phase === 'playing') departAt.current = time;
    lastPhase.current = phase;
    // Téléphone en portrait, page ouverte : décentrage optique (la perspective ne change
    // pas), l'île se place au milieu de l'espace libre entre le HUD et la feuille.
    const portraitDock = mobile && aspect < 1 && phase === 'docked' && activeIsland !== null;
    // (+ un peu plus haut : le ponton et le bateau, côté caméra, prolongent l'île vers le bas.)
    const lensGoal = portraitDock && sheetState.cover > 0
      ? Math.max(0, (Math.min(sheetState.cover, SHEET_PEEK) - HUD_TOP_SHARE) * 0.5 + 0.035)
      : 0;
    const optics = lens.current;
    optics.shift = reducedMotion ? lensGoal : damp(optics.shift, lensGoal, 2.4, dt);
    if (lensGoal === 0 && Math.abs(optics.shift) < 0.0006) optics.shift = 0;
    if (camera instanceof PerspectiveCamera && Math.abs(optics.shift - optics.applied) > 0.00002) {
      optics.applied = optics.shift;
      if (optics.shift === 0) camera.clearViewOffset();
      else camera.setViewOffset(1, 1, 0, optics.shift, 1, 1);
    }
    if (photoCamera && phase !== 'loading' && phase !== 'intro') {
      camera.position.copy(photoCamera.position);
      camera.lookAt(photoCamera.target);
      return;
    }
    introPose(mobile, aspect);
    gameplayPose(mobile);
    let lambda = 2.4;
    // Glissade à ressort : pulsation (raideur) et amortissement (1 = critique, < 1 : se pose).
    let omega = 4.8;
    let zeta = 1;
    let exponential = false;
    const motion = velocity.current;

    if (!initialized.current) {
      position.current.copy(introPosition);
      target.current.copy(introTarget);
      initialized.current = true;
    }

    if (phase === 'loading' || phase === 'intro') {
      desiredPosition.copy(introPosition);
      desiredTarget.copy(introTarget);
      // Idle statique : la caméra attend le clic START, aucun mouvement.
      lambda = 1.2;
      exponential = true;
      if (camera instanceof PerspectiveCamera) {
        const introFov = aspect < 0.82 ? 36 : mobile ? 33 : 30;
        const nextFov = damp(camera.fov, introFov, 4, dt);
        if (Math.abs(nextFov - camera.fov) > 0.001) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }
    } else if (phase === 'transitioning') {
      // Grue d'ouverture : recul à l'impact, montée en panoramique, piqué vers le bateau.
      const seconds = introSeconds(gameTransition);
      const nextFov = cranePose(seconds, mobile, aspect, reducedMotion, desiredPosition, desiredTarget);

      // L'impact du bateau secoue brièvement la caméra : la chute a du poids.
      const sinceSplash = state.clock.elapsedTime - splashState.time;
      if (splashState.time >= 0 && sinceSplash >= 0 && sinceSplash < 1.2 && !reducedMotion) {
        const shake = Math.exp(-sinceSplash * 5.5) * 0.3;
        desiredPosition.y += Math.sin(sinceSplash * 38) * shake;
        desiredPosition.x += Math.sin(sinceSplash * 29 + 1.3) * shake * 0.6;
      }

      // Vitesse de la grue retenue : le suivi du bateau en repartira sans à-coup.
      if (dt > 0) {
        motion.position.subVectors(desiredPosition, position.current).divideScalar(dt);
        motion.target.subVectors(desiredTarget, target.current).divideScalar(dt);
      }
      position.current.copy(desiredPosition);
      target.current.copy(desiredTarget);
      camera.position.copy(position.current);
      camera.lookAt(target.current);
      // La grue s'incline un peu quand le regard balaie l'horizon, et se redresse en se posant.
      cranePose(Math.min(seconds + 0.1, INTRO_DURATION), mobile, aspect, true, bankPosition, bankTarget);
      const yawNow = Math.atan2(desiredTarget.z - desiredPosition.z, desiredTarget.x - desiredPosition.x);
      const yawNext = Math.atan2(bankTarget.z - bankPosition.z, bankTarget.x - bankPosition.x);
      const bank = Math.max(-0.06, Math.min(0.06, shortestAngle(yawNow, yawNext) * 0.45));
      if (!reducedMotion) camera.rotateZ(bank * (1 - smoothstep(5.6, 6.9, seconds)));
      if (camera instanceof PerspectiveCamera && Math.abs(camera.fov - nextFov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      return;
    } else if (phase === 'docked' && activeIsland) {
      const island = islandById[activeIsland];
      // Cadrage propre à chaque île (scenes/<île>/config.ts) : « À propos » recule pour
      // montrer ses îlots de personnalité, La Ciotat relève la visée vers son portique…
      const framing = sceneConfigs[activeIsland].camera;
      let zoomOut = (mobile ? 1.35 : 1) * (framing?.zoom ?? 1);
      if (portraitDock) {
        // Le cadre d'un téléphone est étroit : on recule juste assez pour voir l'île entière
        // (le recul propre à l'île n'est gardé que s'il est plus grand).
        const halfWidth = Math.tan(((PORTRAIT_DOCK_FOV * Math.PI) / 180) * 0.5) * aspect;
        const reach = Math.hypot(0.78 * (island.radius + 26), 32);
        zoomOut = Math.max(framing?.zoom ?? 1, (island.radius * 1.15) / halfWidth / reach);
      }
      const distance = (island.radius + 26) * zoomOut;
      // La caméra se place entre le ponton et le soleil : l'île est éclairée de face
      // (couleurs franches, ombres derrière les objets) et le bateau reste au premier plan.
      const sunX = Math.cos(skyState.sunAngle) * 80;
      const sunLength = Math.hypot(sunX, 40);
      let viewX = Math.cos(island.dockAngle) + sunX / sunLength;
      let viewZ = Math.sin(island.dockAngle) + 40 / sunLength;
      const viewLength = Math.hypot(viewX, viewZ) || 1;
      viewX /= viewLength;
      viewZ /= viewLength;
      desiredPosition.set(
        island.position[0] + viewX * distance * 0.78,
        32 * zoomOut,
        island.position[1] + viewZ * distance * 0.78,
      );
      // Visée relevée selon le relief : les monuments (clocher, maison…) restent dans le cadre.
      desiredTarget.set(island.position[0], 2.2 + island.elevation * 0.45 + (framing?.lift ?? 0), island.position[1]);
      lambda = 1.6;
      // Révélation de l'île : longue glissade qui se pose, avec un soupçon de dépassement.
      omega = 2.1;
      zeta = 0.84;
      const berth = mooring.berth;
      if (berth && berth.key === activeIsland && arrivalShot(time)) {
        // Accostage : plan rapproché sur le bateau et le bout du ponton, le temps que le
        // patron lance l'amarre et que le passavant se pose ; puis la caméra révèle l'île.
        const panelOpen = !mobile && state.size.width >= 768 && document.documentElement.dataset.panel === 'open';
        arrivalPose(berth, { x: viewX, z: viewZ }, mobile, panelOpen ? PANEL_SHIFT : 0, desiredPosition, desiredTarget);
        omega = 2.6;
        zeta = 0.9;
      }
    } else {
      gameplayPose(mobile);
      desiredPosition.copy(gameplayPosition);
      desiredTarget.copy(gameplayTarget);
      lambda = 2.2 + Math.min(boatState.speed / MAX_SPEED, 1) * 1.2;
      // Suivi : ressort critique aussi vif que l'ancien lissage ; en quittant le quai, il
      // démarre en douceur (la caméra décolle du cadrage de l'île, puis rattrape le bateau).
      const leaving = smoothstep(0, DEPART_GLIDE, time - departAt.current);
      omega = lerp(1.8, lambda * 2, leaving);
      // Atelier de peinture : dès que le bateau approche du port de départ, plan sur l'appentis
      // et le bateau amarré (le pinceau court sur sa coque, le pavillon est hissé).
      // Rien de commandé : on choisit (plan serré sur l'appentis, où que soit le bateau) ;
      // sinon on regarde peindre, dès que le bateau est rentré au port.
      const browse = atelier.queue.length === 0 && !atelier.job && atelier.doneAt < atelier.focusAt;
      const painting = phase === 'playing' && atelier.focus && (browse || distanceHome() < 28);
      if (painting) {
        atelierPose(mobile, aspect < 0.82, browse, desiredPosition, desiredTarget);
        omega = 2.2;
        zeta = 0.86;
      } else if (atelierShot.current) departAt.current = time;
      atelierShot.current = painting;

      const boundaryBlend = ecologyState.boundaryCinematic;
      if (boundaryBlend > 0.001) {
        boundaryPose(mobile);
        desiredPosition.lerp(boundaryPosition, boundaryBlend);
        desiredTarget.lerp(boundaryTarget, boundaryBlend);
        lambda = 1.35 + boundaryBlend * 0.75;
        omega = lerp(omega, lambda * 2, boundaryBlend);
        const shake = ecologyState.impact * (reducedMotion ? 0.08 : 0.42);
        desiredPosition.x += Math.sin(state.clock.elapsedTime * 31) * shake;
        desiredPosition.y += Math.sin(state.clock.elapsedTime * 37 + 1.7) * shake * 0.7;
      }

      if (!reducedMotion && !mobile && boundaryBlend < 0.05 && (phase === 'playing' || phase === 'docked')) {
        desiredPosition.x += pointer.x * 1.8;
        desiredPosition.y += pointer.y * 0.8;
      }
    }

    if (snapAfterIntro) {
      position.current.copy(desiredPosition);
      target.current.copy(desiredTarget);
      motion.position.set(0, 0, 0);
      motion.target.set(0, 0, 0);
    }
    if (exponential) {
      // Attente de l'intro : l'ancien lissage, inchangé (la vitesse est tout de même suivie).
      const fromX = position.current.x;
      const fromY = position.current.y;
      const fromZ = position.current.z;
      position.current.x = damp(position.current.x, desiredPosition.x, lambda, dt);
      position.current.y = damp(position.current.y, desiredPosition.y, lambda, dt);
      position.current.z = damp(position.current.z, desiredPosition.z, lambda, dt);
      target.current.x = damp(target.current.x, desiredTarget.x, lambda, dt);
      target.current.y = damp(target.current.y, desiredTarget.y, lambda, dt);
      target.current.z = damp(target.current.z, desiredTarget.z, lambda, dt);
      if (dt > 0) motion.position.set(position.current.x - fromX, position.current.y - fromY, position.current.z - fromZ).divideScalar(dt);
      motion.target.set(0, 0, 0);
    } else {
      springTo(position.current, motion.position, desiredPosition, omega, zeta, dt);
      springTo(target.current, motion.target, desiredTarget, omega, zeta, dt);
    }
    camera.position.copy(position.current);
    camera.lookAt(target.current);

    if (camera instanceof PerspectiveCamera) {
      const speedZoom = phase === 'playing' ? Math.min(boatState.speed / MAX_SPEED, 1) * 2.8 : 0;
      const gameplayFov = (portraitDock ? PORTRAIT_DOCK_FOV : 42) + speedZoom;
      const boundaryBlend = ecologyState.boundaryCinematic;
      const nextFov = damp(camera.fov, gameplayFov + boundaryBlend * (48 - gameplayFov), 3, dt);
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
