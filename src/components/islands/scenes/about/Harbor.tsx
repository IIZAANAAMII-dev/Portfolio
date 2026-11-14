'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  TorusGeometry,
} from 'three';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import type { IslandConfig } from '@/types';
import type { HeightSampler } from '../../terrain-shape';
import { Rowboat, Sinagot } from './Boats';
import { clothMaterial } from './cloth';
import { BASIN_FLOOR, DOCK_YAW, HARBOR, QUAY_Y, fromDock } from './layout';
import { villageMaterials } from './materials';
import { Mesher, meterCylinder, pebble, pose, type Vec3 } from './mesher';
import { netTexture } from './textures';

/**
 * Le petit port, dessiné dans le repère du ponton (x = s vers le large, z = t sur le côté) :
 * quai de granit pavé, jetée et son feu rouge, cale de mise à l'eau, enrochements, et
 * toute la vie du quai — casiers, caisses, bouées, cordages, filets qui sèchent, le
 * Gwenn-ha-Du, un sinagot amarré le long de la jetée, une plate tirée sur la cale.
 */

const IRON = '#30353d';
const ROPE = '#c9a66b';
const COPING = '#d8d1c3';
const WICKER = '#c49a5a';
const WICKER_DARK = '#8a6638';
const CRATE = '#b98a55';
const FLOATS = ['#f28c38', '#f2efe6', '#d8433b', '#f2c14e'];

/** Pente de la cale (dans le plan s, y). */
const SLIP = { from: 12.7, to: 16.9, top: QUAY_Y - 0.05, bottom: -0.75, half: 0.72 };
export function slipHeight(s: number) {
  const t = (s - SLIP.from) / (SLIP.to - SLIP.from);
  return SLIP.top + (SLIP.bottom - SLIP.top) * t;
}

const JETTY = { from: 10.9, to: HARBOR.jettyEnd, t: HARBOR.jettyT, half: HARBOR.jettyHalf, top: QUAY_Y + 0.12 };
/** Feu de la jetée (repère du port). */
export const JETTY_LIGHT: Vec3 = [JETTY.to, JETTY.top + 0.35, JETTY.t];

function buildHarbor(sampleAt: (s: number, t: number) => number) {
  const granite = new Mesher(false, true);
  const cobbles = new Mesher(false, true);
  const paint = new Mesher(true, false);
  const rocks = new Mesher(true, false);

  // --- Le quai : un bloc de granit, pavé dessus, une rangée de pierres de rive.
  const quayDepth = HARBOR.quayFront - HARBOR.quayBack + 0.6;
  const quayCenter = HARBOR.quayFront - quayDepth / 2;
  const width = HARBOR.quayHalf * 2;
  granite.box([quayDepth, QUAY_Y - BASIN_FLOOR + 0.4, width], [quayCenter, (QUAY_Y + BASIN_FLOOR - 0.4) / 2, 0]);
  cobbles.box([quayDepth - 0.3, 0.05, width - 0.1], [quayCenter - 0.15, QUAY_Y + 0.02, 0]);
  for (let index = 0; index < 11; index++) {
    const t = -HARBOR.quayHalf + 0.4 + (index / 10) * (HARBOR.quayHalf + JETTY.t - JETTY.half - 0.75);
    paint.box([0.34, 0.14, 0.78], [HARBOR.quayFront - 0.16, QUAY_Y + 0.05, t], [0, 0, 0], index % 3 === 1 ? '#cbc3b4' : COPING);
  }

  // --- La jetée : longue digue de blocs, musoir arrondi, feu rouge.
  const jettyLength = JETTY.to - JETTY.from;
  const jettyCenter = (JETTY.to + JETTY.from) / 2;
  granite.box([jettyLength, JETTY.top + 2.4, JETTY.half * 2], [jettyCenter, (JETTY.top - 2.4) / 2, JETTY.t]);
  const head = meterCylinder(JETTY.half + 0.2, JETTY.half + 0.35, JETTY.top + 2.4, 18);
  granite.add(head, pose([JETTY.to, (JETTY.top - 2.4) / 2, JETTY.t]));
  head.dispose();
  cobbles.box([jettyLength, 0.05, JETTY.half * 2 - 0.12], [jettyCenter, JETTY.top + 0.02, JETTY.t]);
  for (let index = 0; index < 9; index++) {
    const s = JETTY.from + 0.6 + (index / 8) * (jettyLength - 1.0);
    for (const side of [-1, 1]) {
      paint.box([0.62, 0.16, 0.26], [s, JETTY.top + 0.06, JETTY.t + side * (JETTY.half - 0.12)], [0, 0, 0], index % 2 ? '#cbc3b4' : COPING);
    }
  }
  // Feu de jetée : socle de granit, fût blanc, lanterne (animée à part), chapeau rouge.
  const [lightS, , lightT] = JETTY_LIGHT;
  paint.add(new CylinderGeometry(0.46, 0.5, 0.3, 12), pose([lightS, JETTY.top + 0.15, lightT]), COPING);
  paint.add(new CylinderGeometry(0.2, 0.26, 1.5, 12), pose([lightS, JETTY.top + 1.0, lightT]), '#f4f1ea');
  paint.add(new CylinderGeometry(0.2, 0.22, 0.32, 12), pose([lightS, JETTY.top + 0.62, lightT]), '#d8433b');
  paint.add(new CylinderGeometry(0.31, 0.31, 0.05, 12), pose([lightS, JETTY.top + 1.77, lightT]), IRON);
  paint.add(new CylinderGeometry(0.0, 0.23, 0.24, 12), pose([lightS, JETTY.top + 2.25, lightT]), '#d8433b');

  // --- La cale : rampe de granit qui descend dans le bassin.
  const slipLength = Math.hypot(SLIP.to - SLIP.from, SLIP.top - SLIP.bottom);
  const slipAngle = Math.atan2(SLIP.top - SLIP.bottom, SLIP.to - SLIP.from);
  granite.box(
    [slipLength, 0.5, SLIP.half * 2],
    [(SLIP.from + SLIP.to) / 2, (SLIP.top + SLIP.bottom) / 2 - 0.25, HARBOR.slipT],
    [0, 0, -slipAngle],
  );
  for (let index = 0; index < 10; index++) {
    const s = SLIP.from + 0.25 + index * 0.42;
    paint.box([0.07, 0.04, SLIP.half * 2 - 0.1], [s, slipHeight(s) + 0.01, HARBOR.slipT], [0, 0, -slipAngle], '#a89f91');
  }

  // --- Bittes d'amarrage et échelle de quai.
  const bollards: [number, number, number][] = [
    [HARBOR.quayFront - 0.45, QUAY_Y, -1.55],
    [HARBOR.quayFront - 0.45, QUAY_Y, 1.55],
    [HARBOR.quayFront - 0.45, QUAY_Y, -4.6],
    [13.9, JETTY.top, JETTY.t - 0.42],
    [16.3, JETTY.top, JETTY.t - 0.42],
  ];
  for (const [s, y, t] of bollards) {
    paint.add(new CylinderGeometry(0.1, 0.13, 0.34, 8), pose([s, y + 0.17, t]), IRON);
    paint.add(new CylinderGeometry(0.16, 0.16, 0.07, 8), pose([s, y + 0.36, t]), IRON);
  }
  for (const side of [-1, 1]) {
    paint.rod([HARBOR.quayFront + 0.05, QUAY_Y + 0.35, 2.6 + side * 0.2], [HARBOR.quayFront + 0.05, -0.7, 2.6 + side * 0.2], 0.025, IRON, 5);
  }
  for (let rung = 0; rung < 6; rung++) {
    const y = QUAY_Y - 0.1 - rung * 0.3;
    paint.rod([HARBOR.quayFront + 0.05, y, 2.4], [HARBOR.quayFront + 0.05, y, 2.8], 0.018, IRON, 4);
  }

  // --- Casiers à homards en osier, empilés en pyramide.
  const pot = new CylinderGeometry(0.27, 0.27, 0.6, 10, 1, false, 0, Math.PI);
  pot.rotateX(Math.PI / 2);
  pot.rotateZ(-Math.PI / 2);
  const hoop = new TorusGeometry(0.275, 0.022, 4, 12, Math.PI);
  const stack: [number, number, number][] = [[0, 0, 0], [0, 0, 0.64], [0, 0, 1.28], [0, 1, 0.32], [0, 1, 0.96], [0, 2, 0.64]];
  const potBase: [number, number] = [HARBOR.quayBack + 0.55, -4.2];
  stack.forEach(([, level, offset], index) => {
    const s = potBase[0] + hash(index * 3.3) * 0.08;
    const t = potBase[1] + offset;
    const y = QUAY_Y + 0.04 + level * 0.3;
    const yaw = (hash(index * 1.7) - 0.5) * 0.25;
    const tone = index % 4 === 3 ? '#6f8fa8' : WICKER;
    paint.add(pot, pose([s, y, t], [0, Math.PI / 2 + yaw, 0]), tone);
    paint.box([0.56, 0.03, 0.58], [s, y + 0.01, t], [0, yaw, 0], WICKER_DARK);
    for (const ring of [-0.2, 0.2]) {
      paint.add(hoop, pose([s + ring * Math.cos(yaw), y, t - ring * Math.sin(yaw)], [0, Math.PI / 2 + yaw, 0]), WICKER_DARK);
    }
  });
  pot.dispose();
  hoop.dispose();

  // --- Caisses à poissons, cordages lovés, bouées en vrac.
  const crates: [number, number, number, number][] = [
    [HARBOR.quayBack + 0.6, 0, -2.1, 0.1],
    [HARBOR.quayBack + 0.62, 1, -2.07, -0.05],
    [HARBOR.quayBack + 1.25, 0, -2.25, 0.35],
  ];
  for (const [s, level, t, yaw] of crates) {
    const y = QUAY_Y + 0.04 + level * 0.27 + 0.13;
    paint.box([0.44, 0.26, 0.64], [s, y, t], [0, yaw, 0], CRATE);
    paint.box([0.46, 0.05, 0.66], [s, y + 0.06, t], [0, yaw, 0], '#9a6d40');
    if (level === 1) {
      for (let fish = 0; fish < 3; fish++) {
        paint.box([0.1, 0.06, 0.34], [s - 0.12 + fish * 0.12, y + 0.14, t], [0, yaw + 0.15 * fish, 0], '#9fb6c4');
      }
    }
  }
  const coil = new TorusGeometry(0.2, 0.05, 6, 16);
  coil.rotateX(Math.PI / 2);
  const coils: [number, number, number][] = [[HARBOR.quayFront - 0.75, QUAY_Y, 0.95], [15.2, JETTY.top, JETTY.t + 0.15], [HARBOR.quayBack + 0.5, QUAY_Y, 3.25]];
  coils.forEach(([s, y, t], index) => {
    paint.add(coil, pose([s, y + 0.06, t], [0, index, 0], [1.15, 1.1, 1.15]), ROPE);
    paint.add(coil, pose([s, y + 0.15, t], [0, index + 1, 0], [0.85, 1.1, 0.85]), ROPE);
  });
  coil.dispose();
  const float = new IcosahedronGeometry(0.15, 1);
  const pile: [number, number][] = [[0, 0], [0.26, 0.08], [0.1, 0.27], [0.36, 0.33]];
  pile.forEach(([ds, dt], index) => {
    paint.add(float, pose([HARBOR.quayBack + 0.45 + ds, QUAY_Y + 0.17, 1.9 + dt], [0, 0, 0], [1, 0.85, 1]), FLOATS[index % FLOATS.length]);
  });

  // --- Perches pour faire sécher les filets (le filet lui-même ondule à part).
  const netPoles: [number, number][] = [[HARBOR.quayBack + 0.35, 0.95], [HARBOR.quayBack + 0.35, 3.35]];
  for (const [s, t] of netPoles) {
    paint.rod([s, QUAY_Y, t], [s, QUAY_Y + 2.25, t], 0.05, '#7a5034', 6);
  }
  paint.rod([netPoles[0][0], QUAY_Y + 2.15, netPoles[0][1]], [netPoles[1][0], QUAY_Y + 2.15, netPoles[1][1]], 0.015, ROPE, 4);
  for (let index = 0; index < 6; index++) {
    const t = netPoles[0][1] + 0.2 + index * 0.4;
    paint.add(float, pose([netPoles[0][0] + 0.02, QUAY_Y + 2.08, t], [0, 0, 0], [0.42, 0.5, 0.42]), index % 2 ? '#f2efe6' : '#f28c38');
  }
  float.dispose();

  // --- Enrochements de granit : côté droit du bassin et pied de la jetée, côté large.
  const boulders: [number, number, number][] = [];
  for (let index = 0; index < 8; index++) boulders.push([13.1 + index * 0.55, -HARBOR.basinHalf - 0.75 - hash(index * 2.1) * 0.35, 0.5 + hash(index * 5.3) * 0.35]);
  for (let index = 0; index < 7; index++) boulders.push([12.4 + index * 0.85, JETTY.t + JETTY.half + 0.45 + hash(index * 4.4) * 0.3, 0.55 + hash(index * 1.9) * 0.4]);
  boulders.push([JETTY.to + 0.95, JETTY.t + 0.9, 0.7], [JETTY.to + 0.6, JETTY.t - 0.95, 0.55]);
  boulders.forEach(([s, t, size], index) => {
    const ground = Math.max(sampleAt(s, t), BASIN_FLOOR);
    const rock = pebble(index * 3.7 + 1.3, 1, 0.68);
    const tone = new Color('#b4a79d').multiplyScalar(0.85 + hash(index * 9.1) * 0.25);
    rocks.add(rock, pose([s, Math.max(ground, -0.9) + size * 0.25, t], [hash(index) * 0.5, index * 1.3, 0], [size * 1.2, size, size]), tone);
    rock.dispose();
  });

  return {
    granite: granite.build(),
    cobbles: cobbles.build(),
    paint: paint.build(),
    rocks: rocks.build(),
  };
}

/* ---------------------------------------------------------- feu de jetée */

function JettyLantern() {
  const material = useRef<MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!material.current) return;
    const night = skyState.dayNight;
    // Feu rouge à occultations : deux éclats, puis une pause.
    const cycle = state.clock.elapsedTime % 4;
    const flash = cycle < 0.5 || (cycle > 0.9 && cycle < 1.4) ? 1 : 0.12;
    material.current.emissiveIntensity = 0.3 + night * 3.2 * flash;
  });
  const [s, y, t] = JETTY_LIGHT;
  return (
    <mesh position={[s, y + 1.45, t]} raycast={() => null}>
      <cylinderGeometry args={[0.15, 0.15, 0.3, 10]} />
      <meshStandardMaterial ref={material} color="#ffb0a0" emissive="#ff3b2e" emissiveIntensity={0.3} roughness={0.3} />
    </mesh>
  );
}

/* --------------------------------------------------------------- filets */

function DryingNet() {
  const material = useMemo(() => {
    const map = netTexture().clone();
    map.repeat.set(2.4 / 0.16, 1.5 / 0.16);
    map.needsUpdate = true;
    return clothMaterial({ color: '#3f7a78', map, mode: 'belly', amplitude: 0.16, speed: 0.7, alphaTest: 0.45 });
  }, []);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(2.4, 1.55, 12, 8);
    // Le filet pend entre ses perches : le milieu s'affaisse.
    const positions = plane.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const sag = (1 - (x / 1.2) ** 2) * 0.28 * (0.6 + (0.775 - y) / 1.55);
      positions.setY(index, y - sag);
    }
    plane.computeVertexNormals();
    return plane;
  }, []);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
    geometry.dispose();
  }, [geometry, material]);
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[HARBOR.quayBack + 0.38, QUAY_Y + 1.33, 2.15]}
      rotation-y={Math.PI / 2}
      castShadow
      raycast={() => null}
    />
  );
}

/* ------------------------------------------------------------- drapeau */

const FLAG = { width: 1.25, height: 0.82 };

function Flag({ position }: { position: Vec3 }) {
  const material = useMemo(() => clothMaterial({ map: gwennHaDu(), mode: 'flag', amplitude: 0.13, speed: 1.4, roughness: 0.9 }), []);
  const cloth = useMemo(() => new PlaneGeometry(FLAG.width, FLAG.height, 14, 6).translate(FLAG.width / 2, 0, 0), []);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
    cloth.dispose();
  }, [cloth, material]);
  return (
    <group position={position} rotation-y={0.4}>
      <mesh castShadow position-y={1.75} raycast={() => null}>
        <cylinderGeometry args={[0.035, 0.05, 3.5, 6]} />
        <meshStandardMaterial color="#f1ede4" roughness={0.6} />
      </mesh>
      <mesh position-y={3.55} raycast={() => null}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh geometry={cloth} material={material} position={[0.04, 3.05, 0]} castShadow raycast={() => null} />
    </group>
  );
}

/* --------------------------------------------------- bouées de corps-mort */

const BUOYS: [number, number, string][] = [
  [17.3, -1.9, '#f28c38'],
  [18.6, -6.4, '#f2efe6'],
  [17.6, 7.2, '#d8433b'],
  [15.9, 6.7, '#f2c14e'],
];
const buoy = new Object3D();

function MooringBuoys({ island }: { island: IslandConfig }) {
  const mesh = useRef<InstancedMesh>(null);
  const world = useMemo(
    () => BUOYS.map(([s, t]) => {
      const [x, z] = fromDock(s, t);
      return [island.position[0] + x, island.position[1] + z] as const;
    }),
    [island.position],
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const tint = new Color();
    BUOYS.forEach(([, , color], index) => target.setColorAt(index, tint.set(color)));
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const time = state.clock.elapsedTime;
    BUOYS.forEach(([s, t], index) => {
      buoy.position.set(s, waveHeight(world[index][0], world[index][1], time) * 0.6 + 0.05, t);
      buoy.rotation.set(Math.sin(time * 1.3 + index) * 0.18, 0, Math.cos(time * 1.1 + index * 2) * 0.18);
      buoy.scale.set(0.3, 0.26, 0.3);
      buoy.updateMatrix();
      target.setMatrixAt(index, buoy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BUOYS.length]} castShadow frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.55} flatShading />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------------- le port */

export function Harbor({ island, sampler }: { island: IslandConfig; sampler: HeightSampler }) {
  const built = useMemo(() => buildHarbor((s, t) => sampler(...fromDock(s, t))), [sampler]);
  const materials = villageMaterials();
  useEffect(() => () => {
    built.granite?.dispose();
    built.cobbles?.dispose();
    built.paint?.dispose();
    built.rocks?.dispose();
  }, [built]);
  const sinagotAt = useMemo(() => {
    const [x, z] = fromDock(15.3, 2.3);
    return [island.position[0] + x, island.position[1] + z] as [number, number];
  }, [island.position]);
  const rowboatS = 14.0;
  return (
    <group rotation-y={DOCK_YAW}>
      {built.granite && <mesh geometry={built.granite} material={materials.granite} castShadow receiveShadow />}
      {built.cobbles && <mesh geometry={built.cobbles} material={materials.cobbles} receiveShadow />}
      {built.paint && <mesh geometry={built.paint} material={materials.paint} castShadow receiveShadow />}
      {built.rocks && <mesh geometry={built.rocks} material={materials.rock} castShadow receiveShadow />}
      <JettyLantern />
      <DryingNet />
      <Flag position={[HARBOR.quayBack + 0.3, QUAY_Y, 4.45]} />
      <MooringBuoys island={island} />
      <Sinagot position={[15.3, 0, 2.3]} rotation={0} world={sinagotAt} />
      <Rowboat position={[rowboatS, slipHeight(rowboatS) + 0.2, HARBOR.slipT]} rotation={Math.PI} tilt={0.38} />
    </group>
  );
}
