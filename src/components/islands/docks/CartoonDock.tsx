'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Mesh, SphereGeometry, Sprite, TorusGeometry } from 'three';
import { skyState } from '@/lib/sky';
import { Pieces, pose } from './parts';
import {
  addDeck,
  addLanternPost,
  addPile,
  BEAM,
  DECK,
  IRON,
  LANTERN_GLASS,
  LANTERN_GLASS_GEOMETRY,
  LANTERN_HALO,
  LIGHT_POOL,
  LIGHT_POOL_GEOMETRY,
  PAINTED,
  ROPE,
  seeded,
  THICK,
  updateHarborLights,
} from './planks';

/**
 * Ponton « dessin animé » : planches peintes de largeurs inégales (miel, ambre, une planche
 * grisée par le sel, une autre toute neuve), jours sombres entre elles, pieux trapus cerclés
 * de cordage avec leur ligne d'algues et de balanes, bollard en fonte, bouée rouge et
 * blanche, échelle de bain et lanterne au bout, qui s'allume à la nuit.
 *
 * Même convention que l'ancien `Dock` : le groupe est tourné de `-angle`, le plancher
 * court le long de +X de `reach × 0,74` jusqu'à `end`, son dessus à 0,78 m de l'eau.
 * Coût : 4 draw calls (bois fusionné, vitre, flaque de lumière, halo — les deux derniers
 * seulement la nuit).
 */

const HALF = 1.0;

/** Centre de la vitre de la lanterne, dans le repère du ponton. */
function lanternSpot(end: number): [number, number, number] {
  return [end - 0.18, DECK + 1.62, -(HALF + 0.03)];
}

function dockGeometry(start: number, end: number) {
  const seed = start * 3.17 + end * 1.31;
  const r = seeded(seed);
  const span = end - start;
  const wood = new Pieces();

  addDeck(wood, { start, end, half: HALF, seed });

  // Pieux par paires, traverses et contreventement.
  const bents = Math.max(2, Math.round(span / 1.75) + 1);
  const postXs: number[] = [];
  for (let bent = 0; bent < bents; bent++) {
    const px = start + 0.5 + (bent / (bents - 1)) * (span - 0.68);
    postXs.push(px);
    for (const side of [-1, 1]) {
      // Le dernier pieu côté gauche porte la lanterne (voir plus bas).
      if (bent === bents - 1 && side < 0) continue;
      const k = bent * 2 + (side > 0 ? 1 : 0);
      addPile(wood, {
        x: px,
        z: side * (HALF + 0.03),
        top: DECK + 0.2 + r(k + 5.7) * 0.32,
        radius: 0.15 + r(k + 5.1) * 0.045,
        rope: r(k + 8.2) > 0.4,
        seed: seed + k * 7.7,
      });
    }
    wood.add(new BoxGeometry(0.17, 0.13, HALF * 2 + 0.36), BEAM, pose([px, DECK - THICK - 0.2, 0]), 0.18);
    const dir = bent % 2 === 0 ? 1 : -1;
    wood.add(
      new BoxGeometry(0.06, 0.1, Math.hypot(HALF * 2, 0.95)),
      '#6a442d',
      pose([px + 0.12, DECK - THICK - 0.75, 0], [Math.atan2(0.95, HALF * 2) * dir, 0, 0]),
      0.15,
    );
  }

  // Bouée de sauvetage accrochée à un pieu du milieu, côté large.
  const buoyPost = postXs[Math.min(postXs.length - 1, Math.floor(postXs.length / 2))];
  const center: [number, number, number] = [buoyPost - 0.02, DECK + 0.02, HALF + 0.32];
  wood.addLocal(new TorusGeometry(0.3, 0.085, 6, 16), (bx, by, _z, _ny, out) => {
    const turn = Math.atan2(by, bx) + Math.PI;
    out.set(Math.floor(turn / (Math.PI / 4)) % 2 === 0 ? '#e0533d' : '#f5efe3');
  }, pose(center, [0.12, 0, 0.18]));
  wood.add(new CylinderGeometry(0.014, 0.014, 0.36, 4), ROPE, pose([buoyPost, DECK + 0.38, HALF + 0.3], [0.5, 0, 0]));

  // Bollard en fonte avec sa boucle d'amarre, et un rouleau de cordage sur le plancher.
  const bx = end - 0.85;
  const bz = HALF - 0.32;
  wood.add(new CylinderGeometry(0.13, 0.15, 0.27, 10), IRON, pose([bx, DECK + 0.135, bz]), 0.15);
  wood.add(new CylinderGeometry(0.2, 0.17, 0.07, 10), IRON, pose([bx, DECK + 0.3, bz]), 0.15);
  wood.add(new SphereGeometry(0.12, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#4b5a64', pose([bx, DECK + 0.335, bz]));
  wood.add(new TorusGeometry(0.165, 0.036, 5, 14), ROPE, pose([bx, DECK + 0.17, bz], [Math.PI / 2, 0, 0.12]));
  wood.add(new TorusGeometry(0.21, 0.045, 5, 16), ROPE, pose([bx - 0.62, DECK + 0.045, bz - 0.06], [Math.PI / 2, 0, 0]));
  wood.add(new TorusGeometry(0.12, 0.045, 5, 12), ROPE, pose([bx - 0.62, DECK + 0.1, bz - 0.06], [Math.PI / 2, 0, 0]));

  // Échelle de bain au bout du ponton.
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(0.06, 2.05, 0.06), '#6b4a33', pose([end + 0.07, DECK + 0.35 - 1.02, side * 0.27]), 0.12);
  }
  for (let rung = 0; rung < 5; rung++) {
    wood.add(new BoxGeometry(0.05, 0.04, 0.54), '#7c5639', pose([end + 0.07, DECK - 0.22 - rung * 0.3, 0]), 0.12);
  }

  // Grand pieu de la lanterne, au bout, côté gauche.
  const [lx, ly, lz] = lanternSpot(end);
  addLanternPost(wood, { x: lx, y: ly, z: lz, seed });

  return wood.build()!;
}

export function CartoonDock({ angle, reach, end = reach + 0.9 }: { angle: number; reach: number; end?: number }) {
  const start = reach * 0.74;
  const geometry = useMemo(() => dockGeometry(start, end), [start, end]);
  const pool = useRef<Mesh>(null);
  const glow = useRef<Sprite>(null);
  const [lx, ly, lz] = lanternSpot(end);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const night = skyState.dayNight;
    updateHarborLights(state.clock.elapsedTime, night);
    const lit = night > 0.04;
    if (pool.current) pool.current.visible = lit;
    if (glow.current) glow.current.visible = lit;
  });

  return (
    <group rotation-y={-angle}>
      <mesh geometry={geometry} material={PAINTED} castShadow receiveShadow />
      <mesh geometry={LANTERN_GLASS_GEOMETRY} material={LANTERN_GLASS} position={[lx, ly + 0.005, lz]} raycast={() => null} />
      <mesh
        ref={pool}
        geometry={LIGHT_POOL_GEOMETRY}
        material={LIGHT_POOL}
        position={[lx - 0.55, DECK + 0.03, lz + 0.7]}
        visible={false}
        renderOrder={4}
        raycast={() => null}
      />
      <sprite ref={glow} material={LANTERN_HALO} position={[lx, ly, lz]} scale={1.5} visible={false} raycast={() => null} />
    </group>
  );
}
