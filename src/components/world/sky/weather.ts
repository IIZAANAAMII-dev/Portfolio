import { PerspectiveCamera, Vector3, type Camera } from 'three';
import { islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { clamp, damp, smoothstep } from '@/lib/utils/math';
import { skyParams } from './sky-layer';

/**
 * Moments de météo, rares : un grain passe au loin (nuage sombre, rideau de pluie, ronds
 * dans l'eau), puis un arc-en-ciel se lève derrière lui. État partagé hors React, avancé une
 * fois par image par `updateWeather`.
 *
 * Règles de mise en scène :
 *  - un grain ne naît qu'en navigation, de jour, loin de la tempête ; il traverse le tiers
 *    haut de l'image, au-delà du point visé ;
 *  - il ne passe jamais devant ce que la caméra regarde (le bateau, l'île de l'escale) :
 *    s'il s'en approche, il se dissipe ;
 *  - l'arc-en-ciel est composé pour la caméra du moment (il l'encadre), dans une direction
 *    fixe du monde : comme un vrai, on ne l'atteint jamais.
 */
export const SQUALL_BASE = 13;
export const SQUALL_RADIUS = 8;

export const squall = {
  active: false,
  /** Figé (captures `?weather=`). */
  hold: false,
  age: 0,
  life: 88,
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  /** Pente de la pluie poussée par le vent (m par m de chute). */
  sx: 0,
  sz: 0,
  /** Formation / dissipation, évitement compris (0 → 1). */
  presence: 0,
  rain: 0,
  rainbowDone: false,
};

export const rainbow = {
  active: false,
  hold: false,
  age: 0,
  life: 46,
  alpha: 0,
  dir: new Vector3(0, -0.6, 0.8).normalize(),
  distance: 60,
  radius: 40,
};

const schedule = {
  wait: 100 + Math.random() * 70,
  forced: skyParams.weather,
  /** Heure (horloge réelle) de l'arrivée dans le monde, pour les déclenchements forcés. */
  since: -1,
};

const DEG = Math.PI / 180;
const forward = new Vector3();
const cloud = new Vector3();
const focus = new Vector3();
const segment = new Vector3();
const offset = new Vector3();

function cameraFrame(camera: Camera) {
  camera.getWorldDirection(forward);
  const flat = Math.hypot(forward.x, forward.z) || 1;
  return {
    fx: forward.x / flat,
    fz: forward.z / flat,
    pitch: Math.asin(clamp(-forward.y, -1, 1)),
    vfov: (camera instanceof PerspectiveCamera ? camera.fov : 42) * DEG,
  };
}

export function spawnSquall(camera: Camera, frozen = false) {
  const { fx, fz, pitch, vfov } = cameraFrame(camera);
  // Le nuage traverse le tiers haut de l'image, au-delà du point visé.
  const depression = pitch - vfov * 0.5 + 0.2;
  const drop = camera.position.y - (SQUALL_BASE + 4);
  const ahead = depression > 0.12 && drop > 4 ? drop / Math.tan(depression) : 75;
  const side = frozen || Math.random() < 0.5 ? 1 : -1;
  const lateral = side * (frozen ? 17 : 64);
  squall.x = camera.position.x + fx * ahead - fz * lateral;
  squall.z = camera.position.z + fz * ahead + fx * lateral;
  squall.vx = fz * side * 1.45;
  squall.vz = -fx * side * 1.45;
  // Pluie poussée par le vent : elle penche vers l'observateur et dans le sens de la dérive,
  // le rideau sort ainsi de sous le nuage (vue plongeante) au lieu d'être caché par lui.
  const toX = camera.position.x - squall.x;
  const toZ = camera.position.z - squall.z;
  const toLength = Math.hypot(toX, toZ) || 1;
  squall.sx = (toX / toLength) * 0.55 + fz * side * 0.12;
  squall.sz = (toZ / toLength) * 0.55 - fx * side * 0.12;
  squall.life = 88;
  squall.age = frozen ? 32 : 0;
  squall.hold = frozen;
  squall.presence = frozen ? 1 : 0;
  squall.rainbowDone = frozen;
  squall.active = true;
  schedule.wait = 230 + Math.random() * 160;
}

export function spawnRainbow(camera: Camera, frozen = false) {
  const { fx, fz, pitch, vfov } = cameraFrame(camera);
  // Centre de l'arc un peu sous le centre de l'image, juste sous la mer : l'arc s'en élève,
  // encadre ce que l'on regarde (bateau, île de l'escale) et culmine sous le haut de l'image.
  const depression = clamp(pitch + vfov * 0.25, 0.12, 1.3);
  rainbow.dir.set(Math.cos(depression) * fx, -Math.sin(depression), Math.cos(depression) * fz);
  rainbow.distance = (Math.max(camera.position.y, 1) + 2) / Math.sin(depression);
  rainbow.radius = rainbow.distance * Math.tan(vfov * 0.68);
  rainbow.age = 0;
  rainbow.hold = frozen;
  rainbow.alpha = frozen ? 1 : 0;
  rainbow.active = true;
}

function distanceToSegment(point: Vector3, a: Vector3, b: Vector3) {
  segment.subVectors(b, a);
  const t = clamp(offset.subVectors(point, a).dot(segment) / Math.max(segment.lengthSq(), 1e-6), 0, 1);
  return offset.copy(a).addScaledVector(segment, t).distanceTo(point);
}

/** 1 si le grain ne gêne pas ; vers 0 s'il passe devant le sujet ou sur l'île de l'escale. */
function clearance(camera: Camera) {
  const { phase, activeIsland } = useWorld.getState();
  cloud.set(squall.x, SQUALL_BASE + 4, squall.z);
  const island = phase === 'docked' && activeIsland ? islandById[activeIsland] : null;
  if (island) focus.set(island.position[0], 4, island.position[1]);
  else focus.set(boatState.position.x, 1, boatState.position.z);
  let k = smoothstep(9, 17, distanceToSegment(cloud, camera.position, focus));
  if (island) {
    const away = Math.hypot(squall.x - island.position[0], squall.z - island.position[1]);
    k *= smoothstep(island.radius + 8, island.radius + 20, away);
  }
  return k;
}

export function updateWeather(camera: Camera, dt: number, time: number) {
  const { phase, reveal } = useWorld.getState();
  const live = reveal > 0.98 && (phase === 'playing' || phase === 'docked');
  const day = skyState.dayNight < 0.25 && skyState.sunElevation > 0.1;
  const calm = ecologyState.stormCover < 0.05;

  // Captures : `?weather=squall|rainbow|both` fige le moment voulu, peu après l'arrivée
  // (horloge réelle : le rendu logiciel des captures tourne à quelques images par seconde).
  if (schedule.forced && live) {
    if (schedule.since < 0) schedule.since = time;
    if (time - schedule.since > 0.8) {
      if (schedule.forced === 'squall' || schedule.forced === 'both') spawnSquall(camera, true);
      if (schedule.forced === 'rainbow' || schedule.forced === 'both') spawnRainbow(camera, true);
      schedule.forced = null;
    }
  }

  if (!squall.active && !rainbow.active && live && phase === 'playing' && day && calm) {
    schedule.wait -= dt;
    if (schedule.wait <= 0) spawnSquall(camera);
  }

  if (squall.active) {
    if (!squall.hold) {
      squall.age += dt;
      squall.x += squall.vx * dt;
      squall.z += squall.vz * dt;
    }
    const { life, age } = squall;
    const form = smoothstep(0, 8, age) * (1 - smoothstep(life - 12, life, age));
    const target = form * clearance(camera) * (day || squall.hold ? 1 : 0) * (calm ? 1 : 0);
    squall.presence = squall.hold ? target : damp(squall.presence, target, 1.1, dt);
    squall.rain = smoothstep(5, 14, age) * (1 - smoothstep(life - 24, life - 9, age)) * Math.min(1, squall.presence * 1.6);
    if (!squall.rainbowDone && age > life * 0.6) {
      squall.rainbowDone = true;
      if (skyState.sunElevation > 0.08 && !rainbow.active) spawnRainbow(camera);
    }
    if (age >= life) squall.active = false;
  }

  if (rainbow.active) {
    if (!rainbow.hold) rainbow.age += dt;
    const { life, age } = rainbow;
    const target = rainbow.hold ? 1 : smoothstep(0, 7, age) * (1 - smoothstep(life - 10, life, age));
    rainbow.alpha = damp(rainbow.alpha, target * (day || rainbow.hold ? 1 : 0), 1.5, dt);
    if (age >= life) rainbow.active = false;
  }
}
