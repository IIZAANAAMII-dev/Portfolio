'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh, Object3D } from 'three';
import { useWorld } from '@/lib/store';

/**
 * Goélands qui tournent entre le portique et le Bec de l'Aigle : quelques battements,
 * puis de longues glissades. Trois oiseaux, deux appels de dessin (corps, ailes).
 */

const GULLS = 3;

function wingGeometry() {
  // Aile en flèche, de l'épaule (z = 0) à la pointe (z = 1).
  const positions = new Float32Array([
    0.12, 0, 0, -0.14, 0, 0, 0.02, 0, 0.55,
    0.02, 0, 0.55, -0.14, 0, 0, -0.16, 0, 0.62,
    0.02, 0, 0.55, -0.16, 0, 0.62, -0.1, 0, 1,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const BODY = new IcosahedronGeometry(1, 0).scale(0.32, 0.11, 0.11);
const WING = wingGeometry();

export function Gulls({ center, radius = 6, height = 16 }: { center: [number, number]; radius?: number; height?: number }) {
  const bodies = useRef<InstancedMesh>(null);
  const wings = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const wing = useMemo(() => new Object3D(), []);
  const quality = useWorld((state) => state.quality);

  useFrame((state) => {
    const body = bodies.current;
    const wingMesh = wings.current;
    if (!body || !wingMesh) return;
    const t = state.clock.elapsedTime;
    for (let index = 0; index < GULLS; index++) {
      const speed = 0.32 + index * 0.05;
      const angle = t * speed + index * 2.1;
      const r = radius * (0.8 + index * 0.18);
      const x = center[0] + Math.cos(angle) * r;
      const z = center[1] + Math.sin(angle) * r;
      const y = height + index * 1.1 + Math.sin(t * 0.7 + index) * 0.5;
      // Cap tangent au cercle, légère inclinaison dans le virage.
      dummy.position.set(x, y, z);
      dummy.rotation.set(-0.3, -angle - Math.PI / 2, 0, 'YXZ');
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      // Quelques battements toutes les six secondes, sinon plané, ailes un peu relevées.
      const cycle = (t + index * 1.7) % 6;
      const flap = cycle < 1.4 ? Math.sin(cycle * 11) * 0.55 : 0.12 + Math.sin(t * 1.3 + index) * 0.04;
      for (const side of [-1, 1]) {
        wing.position.set(0, 0.02, 0);
        wing.rotation.set(-side * flap, 0, 0);
        wing.scale.set(1, 1, side);
        wing.updateMatrix();
        wing.matrix.premultiply(dummy.matrix);
        wingMesh.setMatrixAt(index * 2 + (side > 0 ? 1 : 0), wing.matrix);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    wingMesh.instanceMatrix.needsUpdate = true;
  });

  if (quality === 'low') return null;
  return (
    <>
      <instancedMesh ref={bodies} args={[BODY, undefined, GULLS]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#f7f5f0" roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={wings} args={[WING, undefined, GULLS * 2]} frustumCulled={false} raycast={() => null}>
        <meshStandardMaterial color="#e7e9ee" roughness={0.85} side={DoubleSide} />
      </instancedMesh>
    </>
  );
}
