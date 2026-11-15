'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import { useWorld } from '@/lib/store';
import { clamp } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { DROPS, drops, POPS, pops, RIPPLES, ripples } from './effects';
import { starGeometry } from './models';

/** Ronds dans l'eau, gouttes et paillettes, étoiles d'impact : trois draw calls en tout. */

const matrix = new Matrix4();
const position = new Vector3();
const size = new Vector3();
const facing = new Quaternion();
const spin = new Quaternion();
const tint = new Color();
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const FACING_AXIS = new Vector3(0, 0, 1);
const IDENTITY = new Quaternion();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const POP_LIFE = 0.34;
const noRaycast = () => null;

export function ToyFx() {
  const rings = useRef<InstancedMesh>(null);
  const droplets = useRef<InstancedMesh>(null);
  const stars = useRef<InstancedMesh>(null);
  const assets = useMemo(() => ({
    ring: new RingGeometry(0.82, 1, 40),
    drop: new IcosahedronGeometry(1, 0),
    star: starGeometry(),
    ringMaterial: new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: AdditiveBlending }),
    dropMaterial: new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    starMaterial: new MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, depthWrite: false, side: DoubleSide }),
  }), []);

  // Couleurs par instance créées d'emblée : pas de recompilation de shader au premier plouf.
  useLayoutEffect(() => {
    tint.setScalar(1);
    for (let index = 0; index < RIPPLES; index++) rings.current?.setColorAt(index, tint);
    for (let index = 0; index < DROPS; index++) droplets.current?.setColorAt(index, tint);
  }, []);

  useFrame((state) => {
    const ringMesh = rings.current;
    const dropMesh = droplets.current;
    const starMesh = stars.current;
    if (!ringMesh || !dropMesh || !starMesh) return;
    const { phase } = useWorld.getState();
    const visible = phase === 'playing' || phase === 'docked';
    ringMesh.visible = visible;
    dropMesh.visible = visible;
    starMesh.visible = visible;
    if (!visible) return;
    const time = state.clock.elapsedTime;

    for (let index = 0; index < RIPPLES; index++) {
      const ring = ripples[index];
      const age = time - ring.start;
      if (age < 0 || age >= 1.3) {
        ringMesh.setMatrixAt(index, HIDDEN);
        continue;
      }
      const life = age / 1.3;
      const radius = ring.size * (0.6 + life * 2.6);
      position.set(ring.x, waveHeight(ring.x, ring.z, time) + 0.07, ring.z);
      size.set(radius, radius, radius);
      matrix.compose(position, FLAT, size);
      ringMesh.setMatrixAt(index, matrix);
      ringMesh.setColorAt(index, tint.setScalar((1 - life) * 0.7));
    }
    ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;

    for (let index = 0; index < DROPS; index++) {
      const age = time - drops.born[index];
      const life = drops.life[index];
      if (age < 0 || age >= life) {
        dropMesh.setMatrixAt(index, HIDDEN);
        continue;
      }
      const y = drops.y[index] + drops.vy[index] * age - 0.5 * drops.gravity[index] * age * age;
      if (y < drops.floor[index]) {
        drops.born[index] = -100;
        dropMesh.setMatrixAt(index, HIDDEN);
        continue;
      }
      const u = age / life;
      const scale = drops.kind[index] === 0
        ? drops.size[index] * (1 - u * u)
        : drops.size[index] * Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(age * 40 + index));
      position.set(drops.x[index] + drops.vx[index] * age, y, drops.z[index] + drops.vz[index] * age);
      size.setScalar(Math.max(scale, 0.001));
      matrix.compose(position, IDENTITY, size);
      dropMesh.setMatrixAt(index, matrix);
      dropMesh.setColorAt(index, tint.setRGB(drops.color[index * 3], drops.color[index * 3 + 1], drops.color[index * 3 + 2]));
    }
    dropMesh.instanceMatrix.needsUpdate = true;
    if (dropMesh.instanceColor) dropMesh.instanceColor.needsUpdate = true;

    for (let index = 0; index < POPS; index++) {
      const age = time - pops.born[index];
      if (age < 0 || age >= POP_LIFE) {
        starMesh.setMatrixAt(index, HIDDEN);
        continue;
      }
      const u = age / POP_LIFE;
      const scale = pops.size[index] * Math.pow(Math.sin(u * Math.PI), 0.6) * (1.15 - 0.3 * u);
      facing.copy(state.camera.quaternion).multiply(spin.setFromAxisAngle(FACING_AXIS, pops.spin[index] + age * 2.5));
      position.set(pops.x[index], pops.y[index] + u * 0.3, pops.z[index]);
      size.setScalar(clamp(scale, 0.001, 4));
      matrix.compose(position, facing, size);
      starMesh.setMatrixAt(index, matrix);
    }
    starMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={rings} args={[assets.ring, assets.ringMaterial, RIPPLES]} frustumCulled={false} renderOrder={7} raycast={noRaycast} />
      <instancedMesh ref={droplets} args={[assets.drop, assets.dropMaterial, DROPS]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={stars} args={[assets.star, assets.starMaterial, POPS]} frustumCulled={false} renderOrder={9} raycast={noRaycast} />
    </>
  );
}
