'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedBufferAttribute, InstancedMesh, Object3D } from 'three';
import { skyState } from '@/lib/sky';
import { lampionGeometry, setupGeometry, type FestLayout } from './festnoz-build';
import { fireLitMaterial, lampionMaterial, lampionUniforms } from './festnoz-materials';

/**
 * Le décor du fest-noz, là de jour comme de nuit : l'estrade des sonneurs, les mâts, les fils
 * des guirlandes, le bûcher dans son cercle de pierres, la barrique de cidre… et les lampions
 * de papier, éteints le jour, qui s'allument un à un à la tombée de la nuit, du phare vers
 * les mâts. Deux appels de dessin.
 */

const SETUP = fireLitMaterial('setup');
const LAMPION = lampionMaterial();

export function FestNozSetup({ layout }: { layout: FestLayout }) {
  const lampions = useRef<InstancedMesh>(null);
  const setup = useMemo(() => setupGeometry(layout), [layout]);
  const lantern = useMemo(() => {
    const geometry = lampionGeometry();
    geometry.setAttribute('aOn', new InstancedBufferAttribute(new Float32Array(layout.lampions.map((item) => item.on)), 1));
    return geometry;
  }, [layout]);
  useEffect(() => () => setup.dispose(), [setup]);
  useEffect(() => () => lantern.dispose(), [lantern]);

  useLayoutEffect(() => {
    const mesh = lampions.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const color = new Color();
    layout.lampions.forEach((item, index) => {
      dummy.position.set(item.at[0], item.at[1], item.at[2]);
      dummy.rotation.set(0, index * 1.3, 0);
      dummy.scale.setScalar(0.9 + ((index * 7) % 5) * 0.06);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layout]);

  useFrame((state) => {
    lampionUniforms.uNight.value = skyState.dayNight;
    lampionUniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      <mesh geometry={setup} material={SETUP} castShadow receiveShadow raycast={() => null} />
      <instancedMesh ref={lampions} args={[lantern, LAMPION, layout.lampions.length]} raycast={() => null} />
    </group>
  );
}
