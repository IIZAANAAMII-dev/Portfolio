'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  Object3D,
  Vector3,
} from 'three';
import { skillZoneById } from '@/data/skills';
import { boatMotion } from '@/components/boat/motion';
import { boatState } from '@/lib/boat-state';
import { useWorld } from '@/lib/store';
import { clamp, damp, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { CAST_SECONDS, REEL_SECONDS, clockNow } from './fishing-data';
import { FISH_GEOMETRY, FISH_MATERIAL, FLOAT_GEOMETRY, GEAR_MATERIAL, ROD_GEOMETRY, ROD_LENGTH } from './models';
import { seaFx } from './SeaFx';
import { nibbleAt, useGameplay, type FishingPhase } from './store';

/**
 * Le matériel de pêche : la canne plantée dans un porte-canne sur le plat-bord (côté du
 * coin visé), le fil qui fait son mou puis se tend, le bouchon qui file, danse sur la houle,
 * frétille aux fausses touches et plonge à la vraie, puis le poisson — aux couleurs de sa
 * zone du labo — qui jaillit et retombe sur le pont arrière. Tout suit les horodatages du
 * store : la scène n'ajoute aucun état, seulement des détecteurs de fronts (éclaboussures).
 */

const LINE_POINTS = 18;
/** Le fil : géométrie en coordonnées monde, réécrite à chaque image (objet de module). */
const LINE_GEOMETRY = new BufferGeometry();
LINE_GEOMETRY.setAttribute('position', new BufferAttribute(new Float32Array(LINE_POINTS * 3), 3));
const LINE_MATERIAL = new LineBasicMaterial({ color: '#26303c', transparent: true, opacity: 0.82, depthWrite: false });
const LINE = new Line(LINE_GEOMETRY, LINE_MATERIAL);
LINE.frustumCulled = false;
LINE.renderOrder = 8;
LINE.raycast = () => null;

/** Position du bouchon partagée avec la sonde (bulle « Ferrer ! » du DOM). */
export const gear = {
  float: new Vector3(),
  floatVisible: false,
};

const anim = {
  deploy: 0,
  elevation: 1.25,
  azimuth: 0,
  side: 1,
  phase: 'idle' as FishingPhase,
  nibble: -1,
  leapt: false,
  catchKey: '',
};

const base = new Vector3();
const tip = new Vector3();
const target = new Vector3();
const floatAt = new Vector3();
const landing = new Vector3();
const fishAt = new Vector3();
const mouth = new Vector3();
const control = new Vector3();
const dummy = new Object3D();
const fishTint = new Color();

const clamp01 = (value: number) => clamp(value, 0, 1);

export function FishingGear() {
  const rod = useRef<Mesh>(null);
  const bobber = useRef<Mesh>(null);
  const fish = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (rod.current) rod.current.rotation.order = 'YZX';
    const mesh = fish.current;
    if (mesh) {
      mesh.setColorAt(0, fishTint.set('#5ec8ff'));
      mesh.count = 1;
    }
  }, []);

  useFrame((state, delta) => {
    const rodMesh = rod.current;
    const floatMesh = bobber.current;
    const fishMesh = fish.current;
    if (!rodMesh || !floatMesh || !fishMesh) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const now = clockNow();
    const game = useGameplay.getState();
    const { phase } = game;
    const reduced = useWorld.getState().reducedMotion;

    const out = phase !== 'idle';
    anim.deploy = reduced ? (out ? 1 : 0) : damp(anim.deploy, out ? 1 : 0, out ? 7 : 5, dt);
    if (!out && anim.deploy < 0.02) {
      anim.deploy = 0;
      anim.phase = 'idle';
      rodMesh.visible = false;
      floatMesh.visible = false;
      fishMesh.visible = false;
      LINE.visible = false;
      gear.floatVisible = false;
      return;
    }

    // Repère du bateau (même houle que Boat.tsx, à quelques centimètres près).
    const heading = boatState.heading;
    const fx = Math.cos(heading);
    const fz = Math.sin(heading);
    const sx = -Math.sin(heading);
    const sz = Math.cos(heading);
    const bx = boatState.position.x;
    const bz = boatState.position.z;
    const drift = (Math.sin(time * 0.74) * 0.16 + Math.sin(time * 1.3 + 1.1) * 0.07 + Math.sin(time * 2.1 + 2.5) * 0.03)
      * (reduced ? 0.5 : 1);
    const deckY = waveHeight(bx, bz, time) + drift;
    const tx = game.targetX;
    const tz = game.targetZ;
    const surface = waveHeight(tx, tz, time);
    target.set(tx, surface, tz);

    if (out) anim.side = (tx - bx) * sx + (tz - bz) * sz >= 0 ? 1 : -1;
    const side = anim.side;
    base.set(
      bx - fx * 1.7 + sx * 0.88 * side,
      deckY + 0.98 - 0.88 * side * Math.sin(boatMotion.roll),
      bz - fz * 1.7 + sz * 0.88 * side,
    );
    if (out) anim.azimuth = Math.atan2(tz - base.z, tx - base.x);

    // Fronts : chaque changement de phase a son éclaboussure.
    if (phase !== anim.phase) {
      if (phase === 'wait') seaFx.splash(tx, tz, 0.32, surface);
      else if (phase === 'bite') seaFx.splash(tx, tz, 0.5, surface);
      else if (phase === 'reel') seaFx.splash(tx, tz, 0.72, surface);
      else if (phase === 'missed' && anim.phase === 'bite') seaFx.ring(tx, tz, 1.5, 0.9, 0.6);
      anim.phase = phase;
      anim.leapt = false;
      anim.nibble = -1;
    }
    const nibble = phase === 'wait' ? nibbleAt(game.nibbles, now) : -1;
    if (nibble >= 0 && nibble !== anim.nibble) {
      anim.nibble = nibble;
      seaFx.ring(tx, tz, 0.95, 0.55, 0.55);
    }
    const reelU = phase === 'reel' ? clamp01((now - game.phaseAt) / REEL_SECONDS) : 0;

    // Canne : fouettée au lancer, penchée vers l'eau à l'affût, tirée vers le bas par la
    // touche, relevée d'un coup sec au ferrage.
    let elevation = 1.25;
    let snap = false;
    if (phase === 'cast') {
      const u = clamp01((now - game.phaseAt) / CAST_SECONDS);
      elevation = u < 0.16 ? 1.25 + 0.25 * smoothstep(0, 0.16, u) : 1.5 - 0.92 * smoothstep(0.16, 0.5, u);
      snap = true;
    } else if (phase === 'wait') {
      elevation = 0.6 + (reduced ? 0 : Math.sin(time * 1.3) * 0.025) - (nibble >= 0 ? 0.08 : 0);
    } else if (phase === 'bite') {
      elevation = 0.36 + (reduced ? 0 : Math.sin(time * 31) * 0.05);
    } else if (phase === 'reel') {
      elevation = reelU < 0.14 ? 1.3 : 1.05 + Math.sin(time * 22) * 0.02 * (1 - reelU);
    } else if (phase === 'caught') {
      elevation = 1.15;
    } else if (phase === 'missed') {
      elevation = 0.95;
    }
    anim.elevation = snap || reduced ? elevation : damp(anim.elevation, elevation, phase === 'reel' ? 18 : 9, dt);
    const reach = ROD_LENGTH * anim.deploy;
    const cosE = Math.cos(anim.elevation);
    tip.set(
      base.x + cosE * Math.cos(anim.azimuth) * reach,
      base.y + Math.sin(anim.elevation) * reach,
      base.z + cosE * Math.sin(anim.azimuth) * reach,
    );
    rodMesh.visible = true;
    rodMesh.position.copy(base);
    rodMesh.rotation.set(0, -anim.azimuth, anim.elevation);
    rodMesh.scale.setScalar(Math.max(anim.deploy, 0.001));

    // Bouchon.
    let floatVisible = false;
    let sag = 0.4;
    let lineToFish = false;
    if (phase === 'cast') {
      const u = clamp01((now - game.phaseAt) / CAST_SECONDS);
      const v = clamp01((u - 0.2) / 0.8);
      floatAt.lerpVectors(tip, target, v);
      floatAt.y += Math.sin(v * Math.PI) * 2.6;
      floatVisible = true;
      sag = 0.12;
    } else if (phase === 'wait') {
      const dip = nibble >= 0 ? Math.sin(((now - nibble) / 0.32) * Math.PI) * 0.13 : 0;
      floatAt.set(tx, surface + 0.02 + (reduced ? 0 : Math.sin(time * 2.6) * 0.035) - dip, tz);
      floatVisible = true;
      sag = 0.6;
    } else if (phase === 'bite') {
      const age = now - game.biteAt;
      const shake = reduced ? 0 : 0.07;
      floatAt.set(
        tx + Math.sin(age * 23) * shake,
        surface - 0.2 - Math.abs(Math.sin(age * 15)) * 0.09,
        tz + Math.cos(age * 19) * shake,
      );
      floatVisible = true;
      sag = 0.03;
    } else if (phase === 'reel') {
      floatAt.set(tx, surface - 0.32, tz);
      floatVisible = reelU < 0.2;
      lineToFish = reelU >= 0.2 && reelU < 0.86;
      sag = 0.02;
    } else if (phase === 'missed') {
      const u = clamp01((now - game.phaseAt) / 0.8);
      floatAt.lerpVectors(target, tip, u * u);
      floatAt.y += Math.sin(u * Math.PI) * 0.9;
      floatVisible = u < 1;
      sag = 0.3;
    }
    floatMesh.visible = floatVisible;
    gear.floatVisible = floatVisible && (phase === 'wait' || phase === 'bite' || phase === 'cast');
    gear.float.copy(floatAt);
    if (floatVisible) {
      floatMesh.position.copy(floatAt);
      floatMesh.rotation.set(Math.sin(time * 2.1) * 0.12, 0, Math.cos(time * 1.7) * 0.12 + (phase === 'bite' ? 0.35 : 0));
      floatMesh.scale.setScalar(1.15);
    }

    // Poisson : il se débat en surface, jaillit, décrit son arc et retombe sur le pont.
    const result = game.result;
    const showFish = result !== null && (phase === 'reel' || phase === 'caught');
    fishMesh.visible = showFish;
    if (showFish && result) {
      const key = `${result.zone}:${result.name}:${game.casts}`;
      if (anim.catchKey !== key) {
        anim.catchKey = key;
        fishMesh.setColorAt(0, fishTint.set(skillZoneById[result.zone].accent));
        if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
      }
      landing.set(bx - fx * 1.45, deckY + 0.52, bz - fz * 1.45);
      const towardBoat = Math.atan2(landing.z - tz, landing.x - tx);
      dummy.rotation.order = 'YZX';
      if (phase === 'reel' && reelU < 0.22) {
        fishAt.set(tx, surface - 0.08 + (reduced ? 0 : Math.sin(time * 28) * 0.08), tz);
        dummy.rotation.set(reduced ? 0 : Math.sin(time * 30) * 0.5, -towardBoat, 0.25);
      } else if (phase === 'reel') {
        const v = clamp01((reelU - 0.22) / 0.66);
        const arc = 3.1;
        fishAt.lerpVectors(target, landing, v);
        fishAt.y += 4 * v * (1 - v) * arc;
        if (!anim.leapt) {
          anim.leapt = true;
          seaFx.splash(tx, tz, 0.7, surface);
        }
        const rise = 4 * arc * (1 - 2 * v) + (landing.y - surface);
        const run = Math.hypot(landing.x - tx, landing.z - tz);
        dummy.rotation.set(reduced ? 0 : v * Math.PI * 3, -towardBoat, Math.atan2(rise, Math.max(run, 0.001)));
      } else {
        const age = now - game.phaseAt;
        const flop = reduced ? 0 : Math.exp(-age * 1.4);
        fishAt.copy(landing);
        fishAt.y += Math.abs(Math.sin(age * 9)) * 0.22 * flop;
        dummy.rotation.set(Math.PI / 2 + Math.sin(age * 13) * 0.45 * flop, -towardBoat + 0.6, 0);
      }
      dummy.position.copy(fishAt);
      dummy.scale.setScalar(1.2);
      dummy.updateMatrix();
      fishMesh.setMatrixAt(0, dummy.matrix);
      fishMesh.instanceMatrix.needsUpdate = true;
      // La bouche du poisson (l'avant, +X local) tient la ligne pendant le vol.
      mouth.set(0.62, 0, 0).applyMatrix4(dummy.matrix);
    }

    // Ligne : courbe de Bézier du scion au bouchon (ou à la gueule du poisson).
    const end = lineToFish ? mouth : floatAt;
    const visibleLine = anim.deploy > 0.4 && (floatVisible || lineToFish);
    LINE.visible = visibleLine;
    if (visibleLine) {
      const span = tip.distanceTo(end);
      control.addVectors(tip, end).multiplyScalar(0.5);
      control.y -= sag * span * 0.32;
      const positions = LINE_GEOMETRY.getAttribute('position') as BufferAttribute;
      for (let index = 0; index < LINE_POINTS; index++) {
        const t = index / (LINE_POINTS - 1);
        const a = (1 - t) * (1 - t);
        const b = 2 * t * (1 - t);
        const c = t * t;
        positions.setXYZ(
          index,
          a * tip.x + b * control.x + c * end.x,
          a * tip.y + b * control.y + c * end.y,
          a * tip.z + b * control.z + c * end.z,
        );
      }
      positions.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={rod} geometry={ROD_GEOMETRY} material={GEAR_MATERIAL} visible={false} castShadow={false} raycast={() => null} />
      <mesh ref={bobber} geometry={FLOAT_GEOMETRY} material={GEAR_MATERIAL} visible={false} castShadow={false} raycast={() => null} />
      <instancedMesh
        ref={fish}
        args={[FISH_GEOMETRY, FISH_MATERIAL, 1]}
        visible={false}
        frustumCulled={false}
        castShadow={false}
        raycast={() => null}
      />
      <primitive object={LINE} />
    </group>
  );
}
