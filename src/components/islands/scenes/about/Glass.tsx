'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry } from 'three';
import { hash } from '@/lib/utils/math';
import { windowMaterial } from '@/lib/windows';
import type { GlassSpec } from './houses';
import type { Vec3 } from './mesher';

/**
 * Vitres du village. Même matériau que `<WindowPane>` (lib/windows : chaque fenêtre
 * s'allume à SON heure au crépuscule), mais regroupées par heure d'allumage dans une
 * InstancedMesh : une trentaine de fenêtres pour une poignée de draw calls.
 */
const PANE = new PlaneGeometry(1, 1);

function GlassGroup({ material, specs }: { material: MeshStandardMaterial; specs: GlassSpec[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    const scale = new Matrix4();
    specs.forEach((spec, index) => {
      matrix.copy(spec.matrix).multiply(scale.makeScale(spec.width, spec.height, 1));
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [specs]);
  return <instancedMesh ref={mesh} args={[PANE, material, specs.length]} raycast={() => null} />;
}

export function Glass({ specs }: { specs: GlassSpec[] }) {
  const groups = useMemo(() => {
    const byMaterial = new Map<MeshStandardMaterial, GlassSpec[]>();
    for (const spec of specs) {
      const material = windowMaterial(spec.seed);
      const list = byMaterial.get(material) ?? [];
      list.push(spec);
      byMaterial.set(material, list);
    }
    return [...byMaterial.entries()];
  }, [specs]);
  return (
    <>
      {groups.map(([material, list]) => (
        <GlassGroup key={material.uuid} material={material} specs={list} />
      ))}
    </>
  );
}

/* --------------------------------------------------------------------- fumée */

const PUFFS = 7;
const puff = new Object3D();

/**
 * Fumée de toutes les cheminées du village en une seule InstancedMesh : un filet de
 * petites bouffées qui montent haut, gonflent à peine, se couchent sous le vent d'ouest
 * et s'effacent. Des bouffées trop grosses, trop serrées, se liraient comme un tas de
 * rochers blancs posé sur le toit : on garde une colonne fine, aérée et translucide.
 */
export function Smoke({ sources, size = 1 }: { sources: Vec3[]; size?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const count = sources.length * PUFFS;
  const seeds = useMemo(() => sources.map(([x, , z]) => hash(x * 3.1 + z * 7.7) * 10), [sources]);

  // Avant la première image, les bouffées attendent repliées (pas de boule à l'origine).
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    puff.position.set(0, 0, 0);
    puff.rotation.set(0, 0, 0);
    puff.scale.setScalar(0);
    puff.updateMatrix();
    for (let index = 0; index < count; index++) target.setMatrixAt(index, puff.matrix);
    target.instanceMatrix.needsUpdate = true;
  }, [count]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    sources.forEach(([x, y, z], source) => {
      for (let index = 0; index < PUFFS; index++) {
        const life = (time * 0.16 + index / PUFFS + seeds[source]) % 1;
        const wobble = Math.sin(time * 1.3 + index * 2.1 + source) * 0.12 * life;
        puff.position.set(
          x + (life * life * 1.9 + wobble) * size,
          y + (0.05 + life * 3.3) * size,
          z + (life * life * 1.2 - wobble) * size,
        );
        const grow = (0.07 + life * 0.3) * size;
        const fade = life > 0.62 ? 1 - (life - 0.62) / 0.38 : Math.min(1, life * 8);
        puff.scale.setScalar(grow * fade);
        puff.rotation.set(index, time * 0.3 + index, 0);
        puff.updateMatrix();
        target.setMatrixAt(source * PUFFS + index, puff.matrix);
      }
    });
    target.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#f6f3ee" emissive="#f6f3ee" emissiveIntensity={0.25} roughness={1} transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
