'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Frustum, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, Sphere } from 'three';
import { skillZones } from '@/data/skills';
import { skyState } from '@/lib/sky';
import { perfOff } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { SPOT_RADIUS, SPOTS } from './fishing-data';
import {
  BUBBLE_GEOMETRY,
  BUBBLE_MATERIAL,
  FISH_GEOMETRY,
  FISH_MATERIAL,
  GLOW_GEOMETRY,
  GLOW_MATERIAL,
  GULL_GEOMETRY,
  GULL_MATERIAL,
  RING_GEOMETRY,
  RING_MATERIAL,
} from './models';
import { seaFx } from './SeaFx';
import { useGameplay } from './store';

/**
 * Les coins de pêche : un disque d'eau plus claire qui respire, des ronds d'écume, des
 * bulles qui crèvent la surface, un poisson aux couleurs du labo qui saute de temps en
 * temps et une mouette qui tourne puis pique dans les bouillons. Tout est instancié (cinq
 * draw calls pour les six coins) et calculé à partir de l'horloge : aucun état par image.
 * Un coin vidé se repose : l'eau se calme, plus de sauts, la mouette monte et attend.
 */

const COUNT = SPOTS.length;
const RINGS_PER_SPOT = 3;
const BUBBLES_PER_SPOT = 7;
const RING_PERIOD = 3.9;
const JUMP_TIME = 0.9;
const DIVE_TIME = 2.9;
/** Au-delà, les éclaboussures ne se voient plus : on n'en déclenche pas. */
const SPLASH_RANGE = 95;

const spots = SPOTS.map((spot, index) => ({
  ...spot,
  gullRadius: 5.4 + hash(index * 3.1) * 1.3,
  gullAltitude: 7.4 + hash(index * 5.3) * 2.4,
  gullSpeed: (0.36 + hash(index * 2.2) * 0.14) * (index % 2 ? 1 : -1),
  gullPhase: hash(index * 7.7) * Math.PI * 2,
  diveEvery: 12 + hash(index * 4.4) * 7,
  diveOffset: hash(index * 9.1) * 19,
  jumpEvery: 4.2 + hash(index * 6.6) * 3.4,
  jumpOffset: hash(index * 1.9) * 7.6,
}));

const bubbles = Array.from({ length: COUNT * BUBBLES_PER_SPOT }, (_, index) => ({
  spot: Math.floor(index / BUBBLES_PER_SPOT),
  every: 1.6 + hash(index * 13.7) * 1.5,
  offset: hash(index * 3.3) * 3,
  seed: index * 17.31,
}));

/** Suivi des événements ponctuels (éclaboussures) : un seul déclenchement par cycle. */
const jumpCycle = new Int32Array(COUNT).fill(-1);
const jumpEntered = new Uint8Array(COUNT);
const diveCycle = new Int32Array(COUNT).fill(-1);
const fishColorCycle = new Int32Array(COUNT).fill(-1);

const GULL_SPOT_GEOMETRY = (() => {
  const geometry = GULL_GEOMETRY.clone();
  geometry.setAttribute('aWing', new InstancedBufferAttribute(new Float32Array(COUNT * 2), 2));
  return geometry;
})();
const wing = GULL_SPOT_GEOMETRY.getAttribute('aWing') as InstancedBufferAttribute;

const dummy = new Object3D();
const tint = new Color();
/** Coins hors champ : ni draw call, ni matrices (ils sont éparpillés dans tout l'archipel). */
const view = new Frustum();
const viewMatrix = new Matrix4();
const probe = new Sphere();
const dayGlow = new Color('#7ff0e2');
const nightGlow = new Color('#4fd2ff');
const accents = skillZones.map((zone) => new Color(zone.accent));
const gullA = { x: 0, y: 0, z: 0, fold: 0, flap: 0 };
const gullB = { x: 0, y: 0, z: 0, fold: 0, flap: 0 };

interface Surface {
  height: number;
  slopeX: number;
  slopeZ: number;
}
const surfaces: Surface[] = spots.map(() => ({ height: 0, slopeX: 0, slopeZ: 0 }));

/** Position de la mouette du coin `index` à l'instant `time` (écrite dans `out`). */
function gullAt(index: number, time: number, surface: Surface, rested: boolean, out: typeof gullA) {
  const spot = spots[index];
  const angle = spot.gullPhase + spot.gullSpeed * time;
  const lift = rested ? 4 : 0;
  const orbitX = spot.x + Math.cos(angle) * spot.gullRadius;
  const orbitY = surface.height + spot.gullAltitude + lift + Math.sin(time * 0.7 + index) * 0.6;
  const orbitZ = spot.z + Math.sin(angle) * spot.gullRadius;
  const glide = smoothstep(0.2, 0.65, Math.sin(time * 0.45 + index * 2.1));
  out.flap = Math.sin(time * 8.5 + index * 5) * (0.78 - glide * 0.7) + glide * 0.12;
  out.fold = 0;
  out.x = orbitX;
  out.y = orbitY;
  out.z = orbitZ;
  if (rested) return -1;

  const cycleTime = time + spot.diveOffset;
  const cycle = Math.floor(cycleTime / spot.diveEvery);
  const u = (cycleTime - cycle * spot.diveEvery) / DIVE_TIME;
  if (u >= 1) return -1;
  const bearing = hash(index * 3.7 + cycle * 1.13) * Math.PI * 2;
  const diveX = spot.x + Math.cos(bearing) * 1.4;
  const diveZ = spot.z + Math.sin(bearing) * 1.4;
  let blend: number;
  if (u < 0.32) blend = smoothstep(0, 0.32, u) ** 1.6;
  else if (u < 0.46) blend = 1;
  else blend = 1 - smoothstep(0.46, 1, u);
  out.x = orbitX + (diveX - orbitX) * blend;
  out.y = orbitY + (surface.height - 0.12 - orbitY) * blend;
  out.z = orbitZ + (diveZ - orbitZ) * blend;
  if (u < 0.46) {
    out.fold = smoothstep(0.02, 0.2, u);
    out.flap = 0.18;
  } else {
    out.fold = 1 - smoothstep(0.46, 0.56, u);
    out.flap = Math.sin(time * 13 + index) * 0.95;
  }
  return u >= 0.32 ? cycle : -1;
}

export function FishingSpots() {
  const glowMesh = useRef<InstancedMesh>(null);
  const ringMesh = useRef<InstancedMesh>(null);
  const bubbleMesh = useRef<InstancedMesh>(null);
  const fishMesh = useRef<InstancedMesh>(null);
  const gullMesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    // Les couleurs d'instance existent avant la première image (pas de recompilation).
    tint.setRGB(0, 0, 0);
    for (let index = 0; index < COUNT; index++) {
      glowMesh.current?.setColorAt(index, tint);
      fishMesh.current?.setColorAt(index, accents[index % accents.length]);
    }
    for (let index = 0; index < COUNT * RINGS_PER_SPOT; index++) ringMesh.current?.setColorAt(index, tint);
  }, []);

  useFrame((state) => {
    const glows = glowMesh.current;
    const ringsMesh = ringMesh.current;
    const bubblesMesh = bubbleMesh.current;
    const fishes = fishMesh.current;
    const gulls = gullMesh.current;
    if (!glows || !ringsMesh || !bubblesMesh || !fishes || !gulls) return;
    const time = state.clock.elapsedTime;
    const { stock, near, phase, spot: fishingSpot } = useGameplay.getState();
    const low = useWorld.getState().quality === 'low';

    // Aucun coin dans le champ (marge : la mouette, les éclaboussures) : tout dort.
    const eye = state.camera;
    eye.updateMatrixWorld();
    viewMatrix.multiplyMatrices(eye.projectionMatrix, eye.matrixWorldInverse);
    view.setFromProjectionMatrix(viewMatrix);
    let seen = perfOff;
    for (let index = 0; index < COUNT && !seen; index++) {
      const spot = spots[index];
      probe.center.set(spot.x, 4, spot.z);
      probe.radius = spot.gullRadius + SPOT_RADIUS * 1.5 + 9;
      seen = view.intersectsSphere(probe);
    }
    glows.visible = seen;
    ringsMesh.visible = seen;
    bubblesMesh.visible = seen;
    fishes.visible = seen;
    if (!seen) {
      gulls.visible = false;
      return;
    }
    const night = skyState.dayNight;
    const camera = state.camera.position;
    const gullPresence = 1 - smoothstep(0.55, 0.85, night);

    for (let index = 0; index < COUNT; index++) {
      const spot = spots[index];
      const surface = surfaces[index];
      const h = waveHeight(spot.x, spot.z, time);
      surface.height = h;
      surface.slopeX = (waveHeight(spot.x + 1, spot.z, time) - waveHeight(spot.x - 1, spot.z, time)) * 0.5;
      surface.slopeZ = (waveHeight(spot.x, spot.z + 1, time) - waveHeight(spot.x, spot.z - 1, time)) * 0.5;
      const rested = stock[index] <= 0;
      // Coin où l'on pêche : les bouillons s'apaisent pour que le bouchon se lise.
      const focus = phase !== 'idle' && fishingSpot === index ? 0.7 : near === index ? 1.3 : 1;
      const calm = rested ? 0.35 : 1;
      const audible = Math.hypot(camera.x - spot.x, camera.z - spot.z) < SPLASH_RANGE;
      const tiltX = -Math.atan(surface.slopeZ);
      const tiltZ = Math.atan(surface.slopeX);

      // Disque d'eau claire (bioluminescent la nuit).
      const breathe = (0.34 + Math.sin(time * 1.4 + index * 1.7) * 0.08) * focus * calm * (1 + night * 0.5);
      tint.copy(dayGlow).lerp(nightGlow, night).multiplyScalar(breathe);
      dummy.position.set(spot.x, h + 0.1, spot.z);
      dummy.rotation.set(tiltX, 0, tiltZ);
      dummy.scale.set(SPOT_RADIUS * 1.45, 1, SPOT_RADIUS * 1.45);
      dummy.updateMatrix();
      glows.setMatrixAt(index, dummy.matrix);
      glows.setColorAt(index, tint);

      // Ronds d'écume concentriques.
      for (let ring = 0; ring < RINGS_PER_SPOT; ring++) {
        const u = ((time + ring * (RING_PERIOD / RINGS_PER_SPOT) + index * 0.37) % RING_PERIOD) / RING_PERIOD;
        const grow = 1 - (1 - u) * (1 - u);
        const light = 0.5 * (1 - u) * (1 - u) * Math.min(1, u * 8) * focus * calm;
        dummy.position.set(spot.x, h + 0.13, spot.z);
        dummy.rotation.set(tiltX, 0, tiltZ);
        dummy.scale.set(SPOT_RADIUS * (0.28 + grow * 0.72), 1, SPOT_RADIUS * (0.28 + grow * 0.72));
        dummy.updateMatrix();
        const slot = index * RINGS_PER_SPOT + ring;
        ringsMesh.setMatrixAt(slot, dummy.matrix);
        tint.setRGB(light, light, light * 1.02);
        ringsMesh.setColorAt(slot, tint);
      }

      // Poisson qui saute (couleur d'une zone du labo, change à chaque saut).
      const jumpTime = time + spot.jumpOffset;
      const cycle = Math.floor(jumpTime / spot.jumpEvery);
      const local = jumpTime - cycle * spot.jumpEvery;
      if (!rested && local < JUMP_TIME) {
        const u = local / JUMP_TIME;
        const bearing = hash(index * 5.1 + cycle * 0.77) * Math.PI * 2;
        const reach = hash(index * 2.9 + cycle * 1.31) * SPOT_RADIUS * 0.6;
        const heading = hash(index * 8.3 + cycle * 0.53) * Math.PI * 2;
        const length = 1.9;
        const height = 1.25;
        const cx = spot.x + Math.cos(bearing) * reach;
        const cz = spot.z + Math.sin(bearing) * reach;
        const along = (u - 0.5) * length;
        const fx = cx + Math.cos(heading) * along;
        const fz = cz + Math.sin(heading) * along;
        dummy.position.set(fx, h - 0.25 + 4 * height * u * (1 - u), fz);
        dummy.rotation.order = 'YZX';
        dummy.rotation.set(Math.sin(time * 26) * 0.25, -heading, Math.atan2(4 * height * (1 - 2 * u), length));
        dummy.scale.setScalar(0.95);
        if (fishColorCycle[index] !== cycle) {
          fishColorCycle[index] = cycle;
          fishes.setColorAt(index, accents[(cycle + index) % accents.length]);
          if (fishes.instanceColor) fishes.instanceColor.needsUpdate = true;
        }
        if (jumpCycle[index] !== cycle) {
          jumpCycle[index] = cycle;
          jumpEntered[index] = 0;
          if (audible) seaFx.splash(cx - Math.cos(heading) * length * 0.5, cz - Math.sin(heading) * length * 0.5, 0.32, h);
        }
        if (u > 0.9 && !jumpEntered[index]) {
          jumpEntered[index] = 1;
          if (audible) seaFx.splash(cx + Math.cos(heading) * length * 0.5, cz + Math.sin(heading) * length * 0.5, 0.38, h);
        }
      } else {
        dummy.position.set(spot.x, h - 2, spot.z);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      dummy.rotation.order = 'XYZ';
      fishes.setMatrixAt(index, dummy.matrix);

      // La mouette (direction de vol : différence finie sur la trajectoire).
      const splashCycle = gullAt(index, time, surface, rested, gullA);
      gullAt(index, time + 0.05, surface, rested, gullB);
      if (splashCycle >= 0 && diveCycle[index] !== splashCycle) {
        diveCycle[index] = splashCycle;
        if (audible) seaFx.splash(gullA.x, gullA.z, 0.5, h);
      }
      const dx = gullB.x - gullA.x;
      const dy = gullB.y - gullA.y;
      const dz = gullB.z - gullA.z;
      const flat = Math.hypot(dx, dz);
      dummy.position.set(gullA.x, gullA.y, gullA.z);
      dummy.rotation.order = 'YZX';
      dummy.rotation.set(-spot.gullSpeed * 0.9, -Math.atan2(dz, dx), Math.atan2(dy, Math.max(flat, 0.0001)) * 0.85);
      dummy.scale.setScalar(1.45 * gullPresence);
      dummy.updateMatrix();
      dummy.rotation.order = 'XYZ';
      gulls.setMatrixAt(index, dummy.matrix);
      wing.setXY(index, gullA.flap, gullA.fold);
    }

    // Bulles : chacune vit un cycle, éclot et crève à un endroit tiré au hasard.
    const visibleBubbles = low ? 3 : BUBBLES_PER_SPOT;
    for (let index = 0; index < bubbles.length; index++) {
      const bubble = bubbles[index];
      const spot = spots[bubble.spot];
      const surface = surfaces[bubble.spot];
      const rank = index % BUBBLES_PER_SPOT;
      const rested = stock[bubble.spot] <= 0;
      const t = time + bubble.offset;
      const cycle = Math.floor(t / bubble.every);
      const u = (t - cycle * bubble.every) / bubble.every;
      const hidden = rank >= visibleBubbles || (rested && rank % 2 === 1);
      const radius = Math.sqrt(hash(bubble.seed + cycle * 1.7)) * SPOT_RADIUS * 0.85;
      const angle = hash(bubble.seed + cycle * 2.3) * Math.PI * 2;
      const ox = Math.cos(angle) * radius;
      const oz = Math.sin(angle) * radius;
      // Éclosion rapide, gonflement, puis « plop ».
      const size = hidden ? 0 : (0.07 + hash(bubble.seed + cycle) * 0.1) * smoothstep(0, 0.25, u) * (1 - smoothstep(0.82, 0.9, u));
      dummy.position.set(spot.x + ox, surface.height + surface.slopeX * ox + surface.slopeZ * oz + 0.06, spot.z + oz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(size, size * 0.8, size);
      dummy.updateMatrix();
      bubblesMesh.setMatrixAt(index, dummy.matrix);
    }

    glows.instanceMatrix.needsUpdate = true;
    if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    ringsMesh.instanceMatrix.needsUpdate = true;
    if (ringsMesh.instanceColor) ringsMesh.instanceColor.needsUpdate = true;
    bubblesMesh.instanceMatrix.needsUpdate = true;
    fishes.instanceMatrix.needsUpdate = true;
    gulls.instanceMatrix.needsUpdate = true;
    gulls.visible = gullPresence > 0.01;
    wing.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={glowMesh}
        args={[GLOW_GEOMETRY, GLOW_MATERIAL, COUNT]}
        frustumCulled={false}
        renderOrder={4}
        raycast={() => null}
      />
      <instancedMesh
        ref={ringMesh}
        args={[RING_GEOMETRY, RING_MATERIAL, COUNT * RINGS_PER_SPOT]}
        frustumCulled={false}
        renderOrder={5}
        raycast={() => null}
      />
      <instancedMesh
        ref={bubbleMesh}
        args={[BUBBLE_GEOMETRY, BUBBLE_MATERIAL, COUNT * BUBBLES_PER_SPOT]}
        frustumCulled={false}
        renderOrder={6}
        raycast={() => null}
      />
      <instancedMesh
        ref={fishMesh}
        args={[FISH_GEOMETRY, FISH_MATERIAL, COUNT]}
        frustumCulled={false}
        castShadow={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={gullMesh}
        args={[GULL_SPOT_GEOMETRY, GULL_MATERIAL, COUNT]}
        frustumCulled={false}
        castShadow={false}
        raycast={() => null}
      />
    </group>
  );
}
