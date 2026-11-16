'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Sprite, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { gangwayDeploy, mooring } from '@/components/boat/mooring';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { bevelBox, Pieces, pose } from './parts';
import {
  BOLLARD_INSET,
  BOLLARD_SPREAD,
  DOCK_END_OFFSET,
  DOCK_HALF,
  GANGWAY_HINGE_X,
  GANGWAY_HINGE_Y,
  GANGWAY_LENGTH,
  GANGWAY_THICK,
  GANGWAY_WIDTH,
} from './layout';
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
 * blanche, deux bittes d'amarrage au bout et lanterne qui s'allume à la nuit.
 *
 * Ponton d'île : le bateau s'amarre de flanc au bout, à quelques mètres ; un passavant
 * (planche de coupée rangée sur le plancher) bascule par-dessus sa charnière et se pose sur
 * son plat-bord, puis se relève quand il repart. Port de départ : le bateau touche le
 * ponton, une échelle de bain descend à l'eau. Le ponton encaisse chaque contact (il plonge
 * de quelques centimètres et revient).
 *
 * Même convention que l'ancien `Dock` : le groupe est tourné de `-angle`, le plancher
 * court le long de +X de `reach × 0,74` jusqu'à `end`, son dessus à 0,78 m de l'eau.
 * Coût : 5 draw calls (bois fusionné, passavant, vitre, flaque de lumière, halo — les deux
 * derniers seulement la nuit).
 */

const HALF = DOCK_HALF;

/** Centre de la vitre de la lanterne, dans le repère du ponton. */
function lanternSpot(end: number): [number, number, number] {
  return [end - 0.18, DECK + 1.62, -(HALF + 0.03)];
}

/** Bitte d'amarrage en fonte : pied évasé, collet (l'œil de l'amarre s'y capelle), tête ronde. */
function addBollard(wood: Pieces, x: number, z: number) {
  wood.add(new CylinderGeometry(0.1, 0.13, 0.16, 10), IRON, pose([x, DECK + 0.08, z]), 0.15);
  wood.add(new CylinderGeometry(0.072, 0.08, 0.1, 10), IRON, pose([x, DECK + 0.21, z]), 0.12);
  wood.add(new CylinderGeometry(0.125, 0.09, 0.06, 10), IRON, pose([x, DECK + 0.28, z]), 0.15);
  wood.add(new SphereGeometry(0.11, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#4b5a64', pose([x, DECK + 0.3, z]));
}

function dockGeometry(start: number, end: number, gangway: boolean) {
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

  // Bittes d'amarrage aux deux coins du bout : l'amarre du bateau vient s'y capeler.
  for (const side of [-1, 1]) addBollard(wood, end - BOLLARD_INSET, side * BOLLARD_SPREAD);

  if (gangway) {
    // Charnière du passavant : deux pattes de fer au bout du plancher.
    for (const side of [-1, 1]) {
      wood.add(new BoxGeometry(0.1, 0.06, 0.05), IRON, pose([end - 0.02, DECK + 0.03, side * (GANGWAY_WIDTH / 2 + 0.03)]), 0.1);
    }
  } else {
    // Échelle de bain au bout du ponton.
    for (const side of [-1, 1]) {
      wood.add(new BoxGeometry(0.06, 2.05, 0.06), '#6b4a33', pose([end + 0.07, DECK + 0.35 - 1.02, side * 0.27]), 0.12);
    }
    for (let rung = 0; rung < 5; rung++) {
      wood.add(new BoxGeometry(0.05, 0.04, 0.54), '#7c5639', pose([end + 0.07, DECK - 0.22 - rung * 0.3, 0]), 0.12);
    }
  }

  // Deux pare-battages blancs à bande bleue, pendus au bout du ponton (côté bateau).
  for (const side of [-1, 1]) {
    const fz = side * 0.66;
    wood.add(new CylinderGeometry(0.012, 0.012, 0.3, 4), ROPE, pose([end + 0.1, DECK - 0.12, fz]));
    wood.addLocal(new CylinderGeometry(0.11, 0.11, 0.34, 10, 3), (_x, y, _z, _ny, out) => {
      out.set(Math.abs(y) < 0.06 ? '#3b7fc4' : '#f5efe3');
    }, pose([end + 0.13, DECK - 0.45, fz], [0, 0, 0.08 * side]), 0.08);
    for (const cap of [-1, 1]) {
      wood.add(new SphereGeometry(0.11, 10, 4, 0, Math.PI * 2, cap > 0 ? 0 : Math.PI / 2, Math.PI / 2), '#f5efe3', pose([end + 0.13 - 0.08 * side * cap * 0.17, DECK - 0.45 + cap * 0.17, fz]));
    }
  }

  // Grand pieu de la lanterne, au bout, côté gauche.
  const [lx, ly, lz] = lanternSpot(end);
  addLanternPost(wood, { x: lx, y: ly, z: lz, seed });

  return wood.build()!;
}

let gangwayCache: BufferGeometry | null = null;

/**
 * Passavant (une géométrie partagée par tous les pontons) : planche claire, deux limons,
 * tasseaux antidérapants, rouleau au bout qui repose sur le plat-bord. Origine sur la
 * charnière, la planche court le long de +X, centrée sur son épaisseur.
 */
function gangwayGeometry() {
  if (gangwayCache) return gangwayCache;
  const wood = new Pieces();
  const half = GANGWAY_THICK / 2;
  wood.add(bevelBox(GANGWAY_LENGTH, GANGWAY_THICK * 0.6, GANGWAY_WIDTH - 0.08, 0.015), '#d9a86c', pose([GANGWAY_LENGTH / 2, 0, 0]), 0.2);
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(GANGWAY_LENGTH, GANGWAY_THICK, 0.05), '#8a5a36', pose([GANGWAY_LENGTH / 2, 0, side * (GANGWAY_WIDTH / 2 - 0.025)]), 0.18);
  }
  for (let cleat = 0; cleat < 8; cleat++) {
    const x = 0.25 + cleat * ((GANGWAY_LENGTH - 0.45) / 7);
    wood.add(new BoxGeometry(0.035, 0.022, GANGWAY_WIDTH - 0.1), '#b9874f', pose([x, half * 0.6 + 0.011, 0]), 0.15);
  }
  // Rouleau du bout (il roule sur le plat-bord quand le bateau bouge) et poignée de cordage.
  wood.add(new CylinderGeometry(0.04, 0.04, GANGWAY_WIDTH + 0.02, 8), IRON, pose([GANGWAY_LENGTH - 0.04, -half, 0], [Math.PI / 2, 0, 0]));
  wood.add(new TorusGeometry(0.07, 0.016, 4, 10, Math.PI), ROPE, pose([GANGWAY_LENGTH - 0.12, half * 0.6, 0], [Math.PI / 2, 0, Math.PI / 2]));
  gangwayCache = wood.build()!;
  return gangwayCache;
}

const landingLocal = new Vector3();

/** Angle (autour de Z) du passavant : rangé à plat (π), dressé (π/2), posé sur le bateau (cible). */
function gangwayAngle(deploy: number, target: number, retracting: boolean) {
  if (deploy <= 0) return Math.PI;
  if (retracting) {
    // Relevé d'un geste, puis rabattu sur le plancher.
    const k = 1 - deploy;
    return target + (Math.PI - target) * (k * k * (3 - 2 * k));
  }
  if (deploy < 0.45) return Math.PI - (Math.PI / 2) * Math.sin((deploy / 0.45) * (Math.PI / 2));
  if (deploy < 0.86) {
    // Il tombe : lent au sommet, de plus en plus vite jusqu'au plat-bord.
    const k = (deploy - 0.45) / 0.41;
    return Math.PI / 2 - (Math.PI / 2 - target) * (1 - Math.cos(k * (Math.PI / 2)));
  }
  // Petit rebond sur le plat-bord.
  const k = (deploy - 0.86) / 0.14;
  return target + Math.sin(Math.min(k, 1) * Math.PI) * 0.06 * (1 - k * 0.5);
}

export function CartoonDock({
  angle,
  reach,
  end = reach + DOCK_END_OFFSET,
  gangway = true,
}: {
  angle: number;
  reach: number;
  end?: number;
  /** Passavant pour aller à bord (îles). Faux au port de départ, où le bateau touche le ponton. */
  gangway?: boolean;
}) {
  const start = reach * 0.74;
  const geometry = useMemo(() => dockGeometry(start, end, gangway), [start, end, gangway]);
  const plankGeometry = useMemo(() => gangwayGeometry(), []);
  const group = useRef<Group>(null);
  const plank = useRef<Group>(null);
  const pool = useRef<Mesh>(null);
  const glow = useRef<Sprite>(null);
  /** Plancher qui encaisse les contacts (ressort amorti) et dernier état connu du passavant. */
  const give = useRef({ dip: 0, velocity: 0, landed: false, touched: -1 });
  const quality = useWorld((state) => state.quality);
  const [lx, ly, lz] = lanternSpot(end);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const night = skyState.dayNight;
    const time = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    updateHarborLights(time, night);
    const lit = night > 0.04;
    if (pool.current) pool.current.visible = lit;
    if (glow.current) glow.current.visible = lit;

    const berth = mooring.berth;
    const mine = berth !== null && Math.abs(berth.dockAngle - angle) < 1e-6 && mooring.phase !== 'free';
    const spring = give.current;

    // Passavant : rangé, ou basculé jusqu'au plat-bord du bateau amarré ici.
    const node = plank.current;
    if (node && gangway) {
      const deploy = mine ? gangwayDeploy(time) : 0;
      let target = 0.04;
      let yaw = 0;
      if (deploy > 0 && group.current) {
        group.current.worldToLocal(landingLocal.copy(mooring.landing));
        const dx = landingLocal.x - (end + GANGWAY_HINGE_X);
        target = Math.atan2(landingLocal.y + 0.04 - GANGWAY_HINGE_Y, Math.max(dx, 0.5));
        yaw = Math.atan2(-landingLocal.z, Math.max(dx, 0.5)) * Math.min(deploy * 1.5, 1);
      }
      const retracting = mooring.castOffAt >= 0 && time >= mooring.castOffAt;
      node.rotation.set(0, yaw, gangwayAngle(deploy, target, retracting));
      const landed = deploy > 0.86 && !retracting;
      if (landed && !spring.landed && !mooring.calm) spring.velocity -= 0.2;
      spring.landed = landed;
    }

    // Au port de départ, la coque vient toucher les pare-battages : le ponton encaisse.
    if (mine && berth && !berth.gangway && mooring.stopAt !== spring.touched && time >= mooring.stopAt && time < mooring.stopAt + 0.5) {
      spring.touched = mooring.stopAt;
      if (!mooring.calm) spring.velocity -= 0.16;
    }
    spring.velocity += (-spring.dip * 70 - spring.velocity * 6) * dt;
    spring.dip += spring.velocity * dt;
    if (group.current) group.current.position.y = spring.dip;
  });

  return (
    <group ref={group} rotation-y={-angle}>
      <mesh geometry={geometry} material={PAINTED} castShadow receiveShadow />
      {gangway && (
        <group ref={plank} position={[end + GANGWAY_HINGE_X, GANGWAY_HINGE_Y, 0]} rotation-z={Math.PI}>
          <mesh geometry={plankGeometry} material={PAINTED} castShadow={quality !== 'low'} receiveShadow raycast={() => null} />
        </group>
      )}
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
