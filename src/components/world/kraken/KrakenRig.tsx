'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedBufferAttribute,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
  type Mesh,
  type Points,
} from 'three';
import { BoatModel } from '@/components/boat/BoatModel';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { krakenDemo } from './demo';
import {
  DRIP_COUNT,
  SPRAY_COUNT,
  dripGeometry,
  dripMaterial,
  dripUniforms,
  inkMaterial,
  inkUniforms,
  ringGeometry,
  ringMaterial,
  shadowMaterial,
  shadowUniforms,
  sprayGeometry,
  sprayMaterial,
  sprayUniforms,
  veilMaterial,
  veilUniforms,
} from './effects';
import { eyeFrame, eyeGeometry, headGeometry, lidGeometry, suckerGeometry, tentacleGeometry } from './geometry';
import { krakenMaterials, krakenUniforms } from './materials';
import { armSurfacePoint, arms, buildArms } from './rig';
import { stepKraken } from './sequence';
import { ARMS, BURSTS, HEAD, burstParams, burstPosition, krakenState } from './state';

const noRaycast = () => null;

/* ------------------------------------------------------------------ Assets (une fois) */

type Assets = ReturnType<typeof createAssets>;
let cache: Assets | null = null;

function createAssets() {
  const suckers = suckerGeometry();
  return {
    tentacles: tentacleGeometry(),
    suckers: suckers.geometry,
    suckerCount: suckers.count,
    head: headGeometry(),
    eye: eyeGeometry(),
    lid: lidGeometry(),
    rings: ringGeometry(),
    drips: dripGeometry(),
    spray: sprayGeometry(),
    ink: new PlaneGeometry(84, 84, 1, 1),
    plane: new PlaneGeometry(1, 1, 1, 1),
    veil: new PlaneGeometry(2, 2, 1, 1),
    materials: {
      ...krakenMaterials(),
      ring: ringMaterial(),
      drip: dripMaterial(),
      spray: sprayMaterial(),
      ink: inkMaterial(),
      shadow: shadowMaterial(),
      veil: veilMaterial(),
    },
    eyes: [eyeFrame(-1), eyeFrame(1)],
  };
}

function krakenAssets() {
  cache ??= createAssets();
  return cache;
}

/* ------------------------------------------------------------------ Scratch (zéro allocation) */

const matrix = new Matrix4();
const axisX = new Vector3();
const axisY = new Vector3();
const axisZ = new Vector3();
const gaze = new Vector3();
const local = new Vector3();
const UP = new Vector3(0, 1, 0);
const projected = new Vector3();
const surface = { x: 0, z: 0, radius: 0 };
const eyeWorld = new Vector3();
const MAX_GAZE = 0.62;

/** Photo libre (`?cam=`) : la démo « eye » ne place alors pas sa propre caméra. */
const photoCamera = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cam');

function setBasisMatrix(target: InstancedMesh, index: number, center: Vector3, forward: Vector3, scale: number) {
  axisZ.copy(forward).normalize();
  axisX.crossVectors(UP, axisZ);
  if (axisX.lengthSq() < 1e-6) axisX.set(1, 0, 0);
  axisX.normalize();
  axisY.crossVectors(axisZ, axisX);
  matrix.makeBasis(axisX, axisY, axisZ);
  matrix.scale(local.setScalar(scale));
  matrix.setPosition(center);
  target.setMatrixAt(index, matrix);
}

/** Cible du regard ramenée dans le repère de la tête (lacet seul, roulis négligeable). */
function headLocal(x: number, y: number, z: number, out: Vector3) {
  const head = krakenState.head;
  const dx = x - head.x;
  const dy = y - head.y;
  const dz = z - head.z;
  const c = Math.cos(-head.yaw);
  const s = Math.sin(-head.yaw);
  return out.set(dx * c + dz * s, dy, -dx * s + dz * c);
}

/**
 * Le kraken : 8 bras (1 draw call), ventouses (1), tête-manteau, yeux et paupières (3),
 * collerettes, gouttes, gerbes, encre, ombre et voile (6), plus la doublure du bateau lancé.
 * Rien n'est dessiné hors de la séquence et des pointes d'avertissement.
 */
export function KrakenRig() {
  const assets = krakenAssets();
  const root = useRef<Group>(null);
  const tentacles = useRef<Mesh>(null);
  const suckers = useRef<Mesh>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<InstancedMesh>(null);
  const lids = useRef<InstancedMesh>(null);
  const carry = useRef<Group>(null);
  const carryTilt = useRef<Group>(null);
  const rings = useRef<Mesh>(null);
  const drips = useRef<Points>(null);
  const spray = useRef<Points>(null);
  const ink = useRef<Mesh>(null);
  const shadow = useRef<Mesh>(null);
  const veil = useRef<Mesh>(null);
  // La doublure du bateau n'est montée qu'à l'approche (le patron est un maillage articulé).
  const [proxy, setProxy] = useState(false);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    stepKraken(delta, time);
    const visible = krakenState.visible;
    if (root.current) root.current.visible = visible;
    const stage = ecologyState.boundaryStage;
    if (!proxy && (stage === 'approach' || stage === 'stalk' || stage === 'coil' || stage === 'attack')) setProxy(true);
    if (!visible) return;

    const { quality, reducedMotion } = useWorld.getState();
    const { calm, night } = krakenState;
    const kraken = krakenAssets();

    /* --- Uniforms partagés --- */
    krakenUniforms.uTime.value = time;
    krakenUniforms.uWiggle.value = calm;
    krakenUniforms.uFlash.value = krakenState.flash * (reducedMotion ? 0.4 : 1);
    krakenUniforms.uNight.value = night;
    krakenUniforms.uWet.value = krakenState.head.wet;
    krakenUniforms.uLid.value = krakenState.eye.open;
    krakenUniforms.uPupil.value = krakenState.eye.pupil;
    krakenUniforms.uEyeGlow.value = krakenState.eye.glow;
    // Photophores : chapelets qui palpitent dans le noir de l'orage et de la nuit.
    const glow = (0.12 + night * 0.95 + ecologyState.stormCover * 0.18) * (0.62 + 0.38 * Math.sin(time * 1.6));
    kraken.materials.arm.emissiveIntensity = glow;
    kraken.materials.head.emissiveIntensity = glow * 0.8;
    kraken.materials.lid.emissiveIntensity = glow * 0.5;

    /* --- Bras et ventouses --- */
    let anyArm = false;
    for (let i = 0; i < ARMS; i++) anyArm ||= arms[i].visible > 0;
    if (anyArm) buildArms(time, calm);
    if (tentacles.current) tentacles.current.visible = anyArm;
    if (suckers.current) {
      suckers.current.visible = anyArm;
      const geometry = suckers.current.geometry as BufferGeometry & { instanceCount: number };
      geometry.instanceCount = quality === 'low' ? Math.floor(kraken.suckerCount / 2) : kraken.suckerCount;
    }

    /* --- Tête, yeux, paupières --- */
    const headState = krakenState.head;
    const showHead = headState.rise > 0.001;
    if (head.current) {
      head.current.visible = showHead;
      head.current.position.set(headState.x, headState.y, headState.z);
      head.current.rotation.set(headState.roll, headState.yaw, headState.pitch);
    }
    if (showHead && eyes.current && lids.current) {
      const target = krakenState.eye.target;
      for (let side = 0; side < 2; side++) {
        const frame = kraken.eyes[side];
        headLocal(target.x, target.y, target.z, gaze).sub(frame.center).normalize();
        // Le regard reste dans un cône autour de l'orbite.
        const cosine = gaze.dot(frame.normal);
        if (cosine < Math.cos(MAX_GAZE)) {
          gaze.addScaledVector(frame.normal, -cosine).normalize()
            .multiplyScalar(Math.sin(MAX_GAZE))
            .addScaledVector(frame.normal, Math.cos(MAX_GAZE));
        }
        setBasisMatrix(eyes.current, side, frame.center, gaze, HEAD.eyeRadius);
        setBasisMatrix(lids.current, side, frame.center, frame.normal, HEAD.eyeRadius);
      }
      eyes.current.instanceMatrix.needsUpdate = true;
      lids.current.instanceMatrix.needsUpdate = true;
    }

    /* --- Doublure du bateau --- */
    const carried = krakenState.carry;
    if (carry.current) {
      carry.current.visible = carried.visible;
      carry.current.position.set(carried.x, carried.y, carried.z);
      carry.current.rotation.set(0, carried.yaw, 0);
    }
    if (carryTilt.current) carryTilt.current.rotation.set(carried.roll, 0, carried.pitch);

    /* --- Collerettes d'écume --- */
    if (rings.current) {
      const geometry = rings.current.geometry;
      const ring = geometry.getAttribute('aRing') as InstancedBufferAttribute;
      const fx = geometry.getAttribute('aRingFx') as InstancedBufferAttribute;
      let anyRing = false;
      for (let i = 0; i < ARMS; i++) {
        const arm = arms[i];
        const pierced = arm.visible > 0 && armSurfacePoint(i, surface);
        const strength = pierced ? Math.min(1, surface.radius * 1.4) : 0;
        anyRing ||= pierced;
        ring.setXYZW(i, surface.x, waveHeight(surface.x, surface.z, time) + 0.06, surface.z, pierced ? surface.radius : 0.01);
        fx.setXYZW(i, strength, i * 0.137, 1, 0);
      }
      // Dôme de la tête : ellipse allongée selon son cap.
      const waterline = showHead ? Math.sqrt(Math.max(0, 1 - Math.pow(headState.y / HEAD.ry, 2))) : 0;
      ring.setXYZW(ARMS, headState.x, waveHeight(headState.x, headState.z, time) + 0.06, headState.z, Math.max(0.01, HEAD.rz * waterline * 0.98));
      fx.setXYZW(ARMS, waterline > 0.05 ? 0.9 : 0, 0.71, 1.35, -headState.yaw);
      anyRing ||= waterline > 0.05;
      ring.needsUpdate = true;
      fx.needsUpdate = true;
      rings.current.visible = anyRing;
      const material = kraken.materials.ring;
      material.uniforms.uTime.value = time;
      material.uniforms.uNight.value = night;
    }

    /* --- Gouttes et gerbes --- */
    const camera = state.camera as PerspectiveCamera;
    const pointScale = (state.size.height * state.viewport.dpr) / (2 * Math.tan(((camera.fov ?? 45) * Math.PI) / 360));
    dripUniforms.uTime.value = time;
    dripUniforms.uPointScale.value = pointScale;
    dripUniforms.uHead.value.set(headState.x, headState.y, headState.z, showHead ? headState.wet : 0);
    dripUniforms.uHeadYaw.value = headState.yaw;
    dripUniforms.uNight.value = night;
    if (drips.current) {
      drips.current.visible = anyArm || showHead;
      drips.current.geometry.setDrawRange(0, quality === 'high' ? DRIP_COUNT : quality === 'medium' ? 300 : 160);
    }
    let anyBurst = false;
    for (let i = 0; i < BURSTS; i++) {
      sprayUniforms.uBurst.value[i].fromArray(burstPosition, i * 4);
      sprayUniforms.uBurstFx.value[i].fromArray(burstParams, i * 4);
      anyBurst ||= burstParams[i * 4] > 0.01;
    }
    sprayUniforms.uPointScale.value = pointScale;
    sprayUniforms.uNight.value = night;
    if (spray.current) {
      spray.current.visible = anyBurst;
      spray.current.geometry.setDrawRange(0, quality === 'high' ? SPRAY_COUNT : quality === 'medium' ? 520 : 300);
    }

    /* --- Encre, ombre --- */
    const inkState = krakenState.ink;
    if (ink.current) {
      ink.current.visible = inkState.fade > 0.01;
      ink.current.position.set(inkState.x, 0.1, inkState.z);
      inkUniforms.uAmount.value = inkState.amount;
      inkUniforms.uFade.value = inkState.fade;
      inkUniforms.uTime.value = time;
      inkUniforms.uSeed.value = inkState.seed;
    }
    const shadowState = krakenState.shadow;
    if (shadow.current) {
      shadow.current.visible = shadowState.strength > 0.012;
      shadow.current.position.set(shadowState.x, -1.82, shadowState.z);
      shadow.current.rotation.z = -shadowState.heading;
      shadow.current.scale.set(shadowState.length, shadowState.width, 1);
      shadowUniforms.uStrength.value = shadowState.strength;
      shadowUniforms.uTime.value = time;
      shadowUniforms.uSize.value.set(shadowState.length, shadowState.width);
    }

    /* --- Voile d'encre : jaillit de la tête du kraken, se dissout au port --- */
    if (veil.current) {
      veil.current.visible = krakenState.veil > 0.001;
      if (veil.current.visible) {
        projected.set(headState.x, Math.max(headState.y, 1), headState.z).project(camera);
        if (stage !== 'respawn') {
          veilUniforms.uOrigin.value.set(
            Math.min(1.2, Math.max(-0.2, projected.x * 0.5 + 0.5)),
            Math.min(1.2, Math.max(-0.2, projected.y * 0.5 + 0.5)),
          );
        }
        veilUniforms.uVeil.value = krakenState.veil;
        veilUniforms.uMode.value = stage === 'respawn' ? 1 : 0;
        veilUniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
        veilUniforms.uTime.value = time;
      }
    }

    /* --- Démo « eye » : gros plan sur l'œil qui fixe le bateau (développement) --- */
    if (process.env.NODE_ENV !== 'production' && krakenDemo.pose === 'eye' && !photoCamera && showHead) {
      const frame = kraken.eyes[1];
      const c = Math.cos(headState.yaw);
      const s = Math.sin(headState.yaw);
      eyeWorld.set(
        headState.x + frame.center.x * c + frame.center.z * s,
        headState.y + frame.center.y,
        headState.z - frame.center.x * s + frame.center.z * c,
      );
      const nx = frame.normal.x * c + frame.normal.z * s;
      const nz = -frame.normal.x * s + frame.normal.z * c;
      camera.position.set(eyeWorld.x + nx * 9.5 + c * 3.5, eyeWorld.y + 1.6, eyeWorld.z + nz * 9.5 - s * 3.5);
      camera.lookAt(eyeWorld.x, eyeWorld.y - 0.3, eyeWorld.z);
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh ref={tentacles} geometry={assets.tentacles} material={assets.materials.arm} frustumCulled={false} raycast={noRaycast} />
      <mesh ref={suckers} geometry={assets.suckers} material={assets.materials.sucker} frustumCulled={false} raycast={noRaycast} />
      <group ref={head} visible={false}>
        <mesh geometry={assets.head} material={assets.materials.head} raycast={noRaycast} />
        <instancedMesh ref={eyes} args={[assets.eye, assets.materials.eye, 2]} frustumCulled={false} raycast={noRaycast} />
        <instancedMesh ref={lids} args={[assets.lid, assets.materials.lid, 2]} frustumCulled={false} raycast={noRaycast} />
      </group>
      <group ref={carry} visible={false}>
        <group ref={carryTilt}>{proxy && <BoatModel />}</group>
      </group>
      <mesh ref={rings} geometry={assets.rings} material={assets.materials.ring} frustumCulled={false} renderOrder={4} raycast={noRaycast} />
      <points ref={drips} geometry={assets.drips} material={assets.materials.drip} frustumCulled={false} renderOrder={6} raycast={noRaycast} />
      <points ref={spray} geometry={assets.spray} material={assets.materials.spray} frustumCulled={false} renderOrder={7} raycast={noRaycast} />
      <mesh ref={ink} geometry={assets.ink} material={assets.materials.ink} rotation-x={-Math.PI / 2} renderOrder={3} raycast={noRaycast} />
      <mesh ref={shadow} geometry={assets.plane} material={assets.materials.shadow} rotation-x={-Math.PI / 2} renderOrder={3} raycast={noRaycast} />
      <mesh ref={veil} geometry={assets.veil} material={assets.materials.veil} frustumCulled={false} renderOrder={10000} raycast={noRaycast} />
    </group>
  );
}
