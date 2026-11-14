'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import type { Project } from '@/types';
import { Hotspot } from '../../kit';
import { Maquette, type V3 } from './builder';
import { ROAD, TOWN, sitePosition, siteRotation } from './layout';
import { glass, glow, paint } from './materials';
import { Screen } from './Screens';
import { Plaque, SignText, signFrame } from './signs';
import { CURB } from './Town';
import { Windows, windowRow, type WindowSpec } from './Windows';

/**
 * 01 — FEEDER.FR, le centre technique : une tour vitrée (écrans, baies de serveurs), un
 * entrepôt sous verrière et une petite boutique. Toutes les quelques secondes, une
 * commande part de la boutique : le colis monte sur le convoyeur, entre dans l'entrepôt,
 * passe sur la table de tri, glisse jusqu'à la camionnette garée devant la porte — qui
 * démarre, fait le tour de la ville et revient.
 */

const ORANGE = '#ff8a3d';
const WALL = '#eef0f1';
const STEEL = '#3d4552';
const ROOF = '#5b6370';

const [SX, SZ] = sitePosition('tech-center');
const RY = siteRotation('tech-center');
const ORIGIN = new Matrix4().compose(
  new Vector3(SX, TOWN.level, SZ),
  new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), RY),
  new Vector3(1, 1, 1),
);
const toIsland = (p: V3) => new Vector3(p[0], p[1], p[2]).applyMatrix4(ORIGIN);

/* ------------------------------------------------------------ plan (repère local) */

/** Entrepôt, tour et boutique (x vers la droite en regardant la façade, +z = façade). */
const WH = { x0: -4.1, x1: -0.7, z0: -2.0, z1: 1.4, h: 3.0 };
const TW = { x0: -0.3, x1: 2.5, z0: -1.9, z1: 0.6, floor: 1.85 };
const SHOP = { x0: 2.85, x1: 4.35, z0: -0.25, z1: 1.35, h: 2.15 };
const CONVEYOR_Y = 2.25;
const CONVEYOR_Z = 1.15;
const DOOR = { x0: -3.3, x1: -1.7, h: 2.3 };
const TURNTABLE: V3 = [-2.05, 0.88, 0.15];
const PARCEL = 0.44;

/* ------------------------------------------------------------ horaire d'une tournée */

/** Une tournée : la camionnette arrive, charge quatre colis, repart pour un tour de ville. */
const PERIOD = 26;
const ARRIVE = 1.4;
const DOOR_OPEN: [number, number] = [1.4, 2.0];
const DOOR_CLOSE: [number, number] = [13.0, 13.6];
const DEPART = 13.6;
/** Durée du trajet d'un colis, de la boutique au chargement. */
const STORY = 7;
const SPAWNS = [-2.5, 0, 2.5, 5];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
function ease(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Accélère, roule, freine : profil trapézoïdal (0 → 1) avec rampes de durée `ramp`. */
function trapezoid(u: number, ramp = 0.18) {
  const t = clamp01(u);
  const v = 1 / (1 - ramp);
  if (t < ramp) return (v * t * t) / (2 * ramp);
  if (t > 1 - ramp) return 1 - (v * (1 - t) * (1 - t)) / (2 * ramp);
  return v * (t - ramp / 2);
}

/* ------------------------------------------------------------------- parcours */

/** Points clés du parcours d'un colis (centre du colis), en repère de l'île. */
function parcelKeys(vanDoor: Vector3) {
  const lift = PARCEL / 2;
  const local = {
    counter: [3.6, 1.0 + lift, 1.62] as V3,
    start: [2.62, 1.0 + lift, CONVEYOR_Z] as V3,
    top: [1.85, CONVEYOR_Y + lift, CONVEYOR_Z] as V3,
    wall: [-0.95, CONVEYOR_Y + lift, CONVEYOR_Z] as V3,
    table: [TURNTABLE[0] + 0.55, TURNTABLE[1] + 0.06 + lift, TURNTABLE[2]] as V3,
    door: [-2.5, 0.82 + lift, 1.5] as V3,
    chute: [-2.5, 0.6 + lift, 2.4] as V3,
  };
  const island = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, toIsland(value)])) as Record<
    keyof typeof local,
    Vector3
  >;
  return { island, local, vanDoor };
}

const scratch = { a: new Vector3(), b: new Vector3(), table: new Vector3() };

/** Position d'un colis au temps `t` (secondes depuis sa création). Renvoie l'échelle. */
function parcelAt(t: number, keys: ReturnType<typeof parcelKeys>, out: Vector3) {
  const k = keys.island;
  if (t < 0 || t > STORY) return 0;
  if (t < 0.5) {
    out.copy(k.counter);
    const s = t / 0.5;
    return Math.min(1.15, s * 1.3) - Math.max(0, s - 0.8) * 0.75;
  }
  if (t < 1.0) {
    out.lerpVectors(k.counter, k.start, ease((t - 0.5) / 0.5));
    return 1;
  }
  if (t < 2.0) {
    out.lerpVectors(k.start, k.top, (t - 1.0) / 1.0);
    return 1;
  }
  if (t < 3.6) {
    out.lerpVectors(k.top, k.wall, (t - 2.0) / 1.6);
    return 1;
  }
  if (t < 4.2) {
    // Toboggan intérieur, de la trappe jusqu'à la table de tri.
    const u = (t - 3.6) / 0.6;
    out.lerpVectors(k.wall, k.table, ease(u));
    return 1;
  }
  if (t < 5.4) {
    // Un demi-tour sur la table de tri (elle tourne en même temps).
    const u = ease((t - 4.2) / 1.2);
    const angle = u * Math.PI;
    const center = scratch.table.set(TURNTABLE[0], TURNTABLE[1] + 0.06 + PARCEL / 2, TURNTABLE[2]);
    const local = scratch.a.set(center.x + Math.cos(angle) * 0.55, center.y, center.z - Math.sin(angle) * 0.55);
    out.copy(local.applyMatrix4(ORIGIN));
    return 1;
  }
  if (t < 6.2) {
    const u = (t - 5.4) / 0.8;
    if (u < 0.5) {
      const from = scratch.b.set(TURNTABLE[0] - 0.55, TURNTABLE[1] + 0.06 + PARCEL / 2, TURNTABLE[2]).applyMatrix4(ORIGIN);
      out.lerpVectors(from, k.door, u / 0.5);
    } else {
      out.lerpVectors(k.door, k.chute, (u - 0.5) / 0.5);
    }
    return 1;
  }
  // Petit saut jusque dans la porte latérale de la camionnette.
  const u = (t - 6.2) / 0.8;
  out.lerpVectors(k.chute, keys.vanDoor, u);
  out.y += Math.sin(u * Math.PI) * 0.45;
  return u > 0.85 ? (1 - u) / 0.15 : 1;
}

/* ------------------------------------------------------------------- camionnette */

/** Rayon de la voie extérieure (côté trottoir : la porte latérale donne sur la bordure). */
const LANE = ROAD.outer - 0.52;

function wrap(time: number) {
  return ((time % PERIOD) + PERIOD) % PERIOD;
}

/** La camionnette se gare en face du bout du toboggan. */
function parkAngle() {
  const chute = toIsland([-2.5, 0, 2.45]);
  return Math.atan2(chute.z, chute.x);
}

/** Ouverture de la porte latérale (repère de l'île), quand la camionnette est à quai. */
function vanDoorPoint(park: number) {
  const angle = park + 0.1 / LANE;
  const r = LANE + 0.45;
  return new Vector3(Math.cos(angle) * r, TOWN.level + 0.8, Math.sin(angle) * r);
}

/**
 * Angle de la camionnette sur l'anneau au temps t. Elle roule à droite (θ décroissant :
 * sens antihoraire sur la carte, comme dans un rond-point), à quai entre ARRIVE et DEPART.
 */
function vanAngle(time: number, park: number) {
  const t = wrap(time);
  if (t >= ARRIVE && t < DEPART) return park;
  const loop = PERIOD - DEPART + ARRIVE;
  const elapsed = t >= DEPART ? t - DEPART : t + PERIOD - DEPART;
  return park - trapezoid(elapsed / loop, 0.2) * Math.PI * 2;
}

function buildVan() {
  const m = new Maquette();
  const lights = new Maquette();
  // Caisse, cabine, capot (avant = +X, porte latérale côté +Z).
  m.block(-0.98, 0.32, -0.46, 0.38, 1.22, 0.46, '#f7f6f1');
  m.block(0.38, 0.32, -0.44, 0.92, 0.95, 0.44, '#f7f6f1');
  m.block(0.38, 0.95, -0.42, 0.68, 1.12, 0.42, '#f7f6f1');
  m.box([0.04, 0.3, 0.8], [0.78, 1.0, 0], '#2f5f98', [0, 0, -0.55]);
  m.block(0.6, 0.62, -0.47, 0.75, 0.86, 0.47, '#2f5f98');
  m.block(-0.98, 0.5, -0.47, 0.92, 0.6, 0.47, ORANGE);
  m.block(-1.0, 0.3, -0.4, -0.96, 1.16, 0.4, '#e8e6df');
  m.block(0.9, 0.28, -0.44, 0.98, 0.44, 0.44, '#4a505a');
  m.block(-1.02, 0.28, -0.44, -0.95, 0.4, 0.44, '#4a505a');
  for (const [x, z] of [[-0.6, -0.4], [-0.6, 0.4], [0.62, -0.4], [0.62, 0.4]]) {
    m.cylinder(0.19, 0.19, 0.16, [x, 0.2, z], '#262a31', 12, [Math.PI / 2, 0, 0]);
    m.cylinder(0.09, 0.09, 0.17, [x, 0.2, z], '#c9ced6', 8, [Math.PI / 2, 0, 0]);
  }
  lights.box([0.03, 0.1, 0.16], [0.985, 0.72, -0.3], '#fff4c9');
  lights.box([0.03, 0.1, 0.16], [0.985, 0.72, 0.3], '#fff4c9');
  lights.box([0.03, 0.12, 0.1], [-1.0, 0.7, -0.36], '#ff3b30');
  lights.box([0.03, 0.12, 0.1], [-1.0, 0.7, 0.36], '#ff3b30');
  lights.box([0.22, 0.06, 0.14], [0.0, 1.25, 0], ORANGE);
  const door = new Maquette();
  door.block(-0.5, 0.36, 0.0, 0.3, 1.16, 0.035, '#f1efe8');
  door.block(-0.5, 0.5, 0.0, 0.3, 0.6, 0.04, ORANGE);
  door.block(0.18, 0.78, 0.035, 0.26, 0.82, 0.06, '#3d4552');
  return { body: m.build(), lights: lights.build(), door: door.build() };
}

function DeliveryVan({ park }: { park: number }) {
  const van = useRef<Group>(null);
  const slider = useRef<Group>(null);
  const parts = useMemo(() => buildVan(), []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.lights.dispose();
      parts.door.dispose();
    },
    [parts],
  );
  useFrame((state) => {
    const group = van.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const angle = vanAngle(t, park);
    const x = Math.cos(angle) * LANE;
    const z = Math.sin(angle) * LANE;
    // Petit tangage en roulant, immobile à quai.
    const phase = wrap(t);
    const moving = phase < ARRIVE || phase > DEPART;
    group.position.set(x, TOWN.level + 0.04 + (moving ? Math.abs(Math.sin(t * 9)) * 0.015 : 0), z);
    // Avant du véhicule (+X) dans le sens de la marche (θ décroissant).
    group.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
    if (slider.current) {
      const open = ease((phase - DOOR_OPEN[0]) / (DOOR_OPEN[1] - DOOR_OPEN[0])) * (1 - ease((phase - DOOR_CLOSE[0]) / (DOOR_CLOSE[1] - DOOR_CLOSE[0])));
      slider.current.position.set(-open * 0.7, 0, 0.47 + open * 0.06);
    }
  });
  return (
    <group ref={van}>
      <mesh geometry={parts.body} material={paint} castShadow />
      <mesh geometry={parts.lights} material={glow} />
      <group ref={slider} position={[0, 0, 0.47]}>
        <mesh geometry={parts.door} material={paint} />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------- colis */

function parcelGeometry() {
  const m = new Maquette();
  m.box([PARCEL, PARCEL, PARCEL], [0, 0, 0], '#c9935a');
  m.box([PARCEL + 0.01, PARCEL + 0.01, 0.09], [0, 0, 0], ORANGE, [0, 0, 0], 0.05);
  m.box([0.09, PARCEL + 0.012, PARCEL + 0.012], [0, 0, 0], ORANGE, [0, 0, 0], 0.05);
  return m.build();
}

function Parcels({ park }: { park: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => parcelGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const keys = useMemo(() => parcelKeys(vanDoorPoint(park)), [park]);
  const helpers = useMemo(() => ({ dummy: new Object3D(), point: new Vector3() }), []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const phase = wrap(state.clock.elapsedTime);
    const { dummy, point } = helpers;
    SPAWNS.forEach((spawn, index) => {
      let t = phase - spawn;
      if (t < 0) t += PERIOD;
      if (t > PERIOD - 1) t -= PERIOD;
      const scale = parcelAt(t, keys, point);
      dummy.position.copy(point);
      dummy.rotation.set(0, RY + (t > 4.2 && t < 5.4 ? ease((t - 4.2) / 1.2) * Math.PI : t >= 5.4 ? Math.PI : 0), 0);
      dummy.scale.setScalar(Math.max(scale, 0.0001));
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, paint, SPAWNS.length]} castShadow frustumCulled={false} raycast={() => null} />;
}

/* ------------------------------------------------------------------ bâtiment */

function bagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(36, 50, 56, 46, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 50, 14, Math.PI, 0);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function buildTechCenter() {
  const m = new Maquette();
  const lights = new Maquette();
  const panes = new Maquette();

  // Parvis.
  m.block(-4.75, 0, -2.35, 4.75, CURB - 0.012, 2.7, '#e3d5ba', 0.04);

  /* Entrepôt sous verrière (creux : on voit le tri à travers le toit). */
  const { x0, x1, z0, z1, h } = WH;
  const t = 0.12;
  m.block(x0 - 0.05, 0.08, z0 - 0.05, x1 + 0.05, 0.38, z1 + 0.05, '#a3a9b2');
  m.block(x0 + t, 0.38, z0 + t, x1 - t, 0.42, z1 - t, '#bdb7ab');
  m.block(x0, 0.38, z0, x1, h, z0 + t, WALL);
  m.block(x0, 0.38, z0, x0 + t, h, z1, WALL);
  m.block(x0, 0.38, z1 - t, DOOR.x0, h, z1, WALL);
  m.block(DOOR.x1, 0.38, z1 - t, x1, h, z1, WALL);
  m.block(DOOR.x0, DOOR.h, z1 - t, DOOR.x1, h, z1, WALL);
  // Mur droit, percé pour le convoyeur.
  const hole = { y0: CONVEYOR_Y - 0.1, y1: CONVEYOR_Y + 0.62, z0: CONVEYOR_Z - 0.38, z1: CONVEYOR_Z + 0.38 };
  m.block(x1 - t, 0.38, z0, x1, hole.y0, z1, WALL);
  m.block(x1 - t, hole.y1, z0, x1, h, z1, WALL);
  m.block(x1 - t, hole.y0, z0, x1, hole.y1, hole.z0, WALL);
  m.block(x1 - t, hole.y0, hole.z1, x1, hole.y1, z1, WALL);
  m.block(x1 - 0.02, hole.y0 - 0.06, hole.z0 - 0.06, x1 + 0.05, hole.y1 + 0.06, hole.z1 + 0.06, ORANGE);
  // Nervures de bardage et bandeau orange.
  for (let rib = 0; rib < 12; rib++) {
    const x = x0 + 0.2 + rib * 0.29;
    if (x > DOOR.x0 - 0.05 && x < DOOR.x1 + 0.05) continue;
    m.block(x - 0.025, 0.42, z1, x + 0.025, h - 0.05, z1 + 0.035, '#d9dde2', 0);
  }
  m.block(x0 - 0.02, h - 0.32, z1, x1 + 0.02, h - 0.12, z1 + 0.05, ORANGE);
  m.block(x0 - 0.04, h - 0.32, z0 - 0.02, x0, h - 0.12, z1 + 0.02, ORANGE);
  // Porte de quai : encadrement orange, rideau relevé, butoirs.
  m.block(DOOR.x0 - 0.12, 0.38, z1 - 0.02, DOOR.x0, DOOR.h + 0.12, z1 + 0.08, ORANGE);
  m.block(DOOR.x1, 0.38, z1 - 0.02, DOOR.x1 + 0.12, DOOR.h + 0.12, z1 + 0.08, ORANGE);
  m.block(DOOR.x0 - 0.12, DOOR.h, z1 - 0.02, DOOR.x1 + 0.12, DOOR.h + 0.12, z1 + 0.08, ORANGE);
  m.block(DOOR.x0, DOOR.h - 0.32, z1 - 0.1, DOOR.x1, DOOR.h, z1 - 0.02, '#c8cdd4');
  // Pignons et verrière à deux pans.
  const ridge = h + 0.75;
  const zc = (z0 + z1) / 2;
  const half = (z1 - z0) / 2 + 0.12;
  for (const x of [x0 + t / 2, x1 - t / 2]) {
    m.extrude(
      [
        [-half, 0],
        [half, 0],
        [0, ridge - h],
      ],
      t,
      [x, h, zc],
      WALL,
      [0, Math.PI / 2, 0],
    );
  }
  for (const side of [-1, 1]) {
    const slope = Math.atan2(ridge - h, half);
    const width = Math.hypot(half, ridge - h);
    const cz = zc + (side * half) / 2;
    const cy = (h + ridge) / 2;
    panes.box([x1 - x0 + 0.1, 0.02, width], [(x0 + x1) / 2, cy + 0.01, cz], '#ffffff', [side * slope, 0, 0]);
    // Montants de la verrière.
    for (let rafter = 0; rafter <= 6; rafter++) {
      const x = x0 + ((x1 - x0) * rafter) / 6;
      m.box([0.06, 0.07, width], [x, cy + 0.04, cz], STEEL, [side * slope, 0, 0]);
    }
    m.box([x1 - x0 + 0.14, 0.08, 0.08], [(x0 + x1) / 2, h + 0.02, zc + side * half], STEEL);
  }
  m.box([x1 - x0 + 0.14, 0.1, 0.1], [(x0 + x1) / 2, ridge + 0.02, zc], STEEL);
  // Intérieur : étagères de colis, table de tri (socle), toboggans.
  for (const sx of [x0 + 0.5, x0 + 1.55]) {
    m.block(sx - 0.45, 0.42, z0 + 0.16, sx + 0.45, 2.2, z0 + 0.5, '#8d6a4a', 0);
    for (const level of [0.95, 1.6]) m.block(sx - 0.47, level, z0 + 0.14, sx + 0.47, level + 0.05, z0 + 0.52, '#6e5139');
    for (let box = 0; box < 6; box++) {
      const bx = sx - 0.32 + (box % 3) * 0.32;
      const by = (box < 3 ? 0.42 : 1.0) + 0.14;
      m.box([0.26, 0.26, 0.26], [bx, by, z0 + 0.33], box % 2 ? '#c9935a' : '#d9a66a');
    }
  }
  m.cylinder(0.3, 0.38, TURNTABLE[1] - 0.42, [TURNTABLE[0], (TURNTABLE[1] + 0.42) / 2, TURNTABLE[2]], STEEL, 12);
  m.beam([-0.9, CONVEYOR_Y, CONVEYOR_Z], [TURNTABLE[0] + 0.6, TURNTABLE[1] + 0.02, TURNTABLE[2]], 0.3, '#9aa3ad');
  m.beam([TURNTABLE[0] - 0.55, TURNTABLE[1], TURNTABLE[2] + 0.1], [-2.5, 0.8, z1 - 0.05], 0.4, '#9aa3ad');
  m.beam([-2.5, 0.78, z1 + 0.05], [-2.5, 0.56, 2.45], 0.42, '#9aa3ad');
  m.beam([-2.72, 0.7, z1 + 0.05], [-2.72, 0.48, 2.45], 0.05, STEEL);
  m.beam([-2.28, 0.7, z1 + 0.05], [-2.28, 0.48, 2.45], 0.05, STEEL);
  m.beam([-2.5, 0.12, 2.3], [-2.5, 0.5, 2.3], 0.08, STEEL);

  /* Tour technique : rez-de-chaussée vitré (baies de serveurs), deux étages, toit équipé. */
  const T = TW;
  const g1 = T.floor;
  const top = g1 * 3;
  m.block(T.x0, 0.08, T.z0, T.x1, 0.2, T.z1, '#a3a9b2');
  m.block(T.x0, 0.2, T.z0, T.x1, g1, T.z0 + 0.12, WALL);
  m.block(T.x0, 0.2, T.z0, T.x0 + 0.12, g1, T.z1, WALL);
  m.block(T.x1 - 0.12, 0.2, T.z0, T.x1, g1, T.z1, WALL);
  m.block(T.x0, g1, T.z0, T.x1, top, T.z1, WALL);
  m.block(T.x0 - 0.06, g1 - 0.08, T.z0 - 0.06, T.x1 + 0.06, g1 + 0.06, T.z1 + 0.08, STEEL);
  m.block(T.x0 - 0.06, g1 * 2 - 0.05, T.z1, T.x1 + 0.06, g1 * 2 + 0.05, T.z1 + 0.08, STEEL);
  panes.box([T.x1 - T.x0 - 0.24, g1 - 0.25, 0.02], [(T.x0 + T.x1) / 2, (g1 + 0.2) / 2 + 0.05, T.z1 - 0.06], '#ffffff');
  for (const mx of [T.x0 + 0.7, T.x0 + 1.4, T.x0 + 2.1]) m.block(mx - 0.025, 0.2, T.z1 - 0.08, mx + 0.025, g1 - 0.08, T.z1 - 0.03, STEEL, 0);
  // Baies de serveurs et leurs voyants.
  for (const rx of [0.25, 0.85, 1.45, 2.05]) {
    m.block(rx - 0.24, 0.2, -1.1, rx + 0.24, 1.6, -0.55, '#232833');
    for (let row = 0; row < 6; row++) {
      for (let led = 0; led < 3; led++) {
        lights.box([0.05, 0.03, 0.02], [rx - 0.12 + led * 0.12, 0.42 + row * 0.2, -0.54], (row + led) % 3 === 0 ? '#5eff9a' : (row + led) % 3 === 1 ? '#5ee0ff' : ORANGE);
      }
    }
  }
  // Ailettes orange verticales, liseré de toit, acrotère.
  for (const fx of [T.x0 - 0.04, T.x1 + 0.04]) m.block(fx - 0.06, g1, T.z1 - 0.1, fx + 0.06, top + 0.3, T.z1 + 0.28, ORANGE);
  m.block(T.x0 - 0.08, top, T.z0 - 0.08, T.x1 + 0.08, top + 0.28, T.z1 + 0.1, '#dfe3e7');
  m.block(T.x0 + 0.1, top, T.z0 + 0.1, T.x1 - 0.1, top + 0.05, T.z1 - 0.1, ROOF, 0);
  lights.block(T.x0 - 0.08, top + 0.29, T.z1 + 0.06, T.x1 + 0.08, top + 0.32, T.z1 + 0.11, ORANGE);
  // Toit : groupe froid, mât d'antenne, support de la parabole, cadre de la plaque.
  m.block(T.x0 + 0.25, top, T.z0 + 0.2, T.x0 + 1.05, top + 0.55, T.z0 + 0.9, '#c3c8cf');
  m.cylinder(0.22, 0.22, 0.05, [T.x0 + 0.65, top + 0.58, T.z0 + 0.55], STEEL, 12);
  m.rod([T.x1 - 0.35, top, T.z0 + 0.35], [T.x1 - 0.35, top + 1.9, T.z0 + 0.35], 0.04, STEEL);
  m.rod([T.x1 - 0.55, top + 1.2, T.z0 + 0.35], [T.x1 - 0.15, top + 1.2, T.z0 + 0.35], 0.025, STEEL);
  m.rod([T.x1 - 0.5, top + 1.55, T.z0 + 0.35], [T.x1 - 0.2, top + 1.55, T.z0 + 0.35], 0.025, STEEL);
  m.cylinder(0.12, 0.16, 0.5, [1.3, top + 0.25, T.z0 + 1.0], STEEL, 8);
  m.block(0.35, top + 0.25, T.z1 - 0.12, 1.85, top + 1.55, T.z1 - 0.02, '#2b313b');
  m.block(0.5, top, T.z1 - 0.1, 0.58, top + 0.3, T.z1 - 0.04, STEEL);
  m.block(1.62, top, T.z1 - 0.1, 1.7, top + 0.3, T.z1 - 0.04, STEEL);

  /* Boutique (le site marchand) : vitrine, comptoir, store rayé. */
  const S = SHOP;
  m.block(S.x0, 0.08, S.z0, S.x1, S.h, S.z1, '#fbf7ef');
  m.block(S.x0 - 0.05, S.h, S.z0 - 0.05, S.x1 + 0.05, S.h + 0.16, S.z1 + 0.05, ORANGE);
  m.block(S.x0 + 0.15, 1.05, S.z1, S.x1 - 0.15, 1.95, S.z1 + 0.04, '#bcd9ef', 0);
  lights.block(S.x0 + 0.2, 1.1, S.z1 + 0.04, S.x1 - 0.2, 1.9, S.z1 + 0.05, '#fff1d6');
  m.block(S.x0 + 0.1, 0.08, S.z1, S.x1 - 0.1, 0.98, S.z1 + 0.5, '#9b6b45');
  m.block(S.x0 + 0.05, 0.98, S.z1 - 0.02, S.x1 - 0.05, 1.03, S.z1 + 0.56, '#b8875b');
  for (let stripe = 0; stripe < 6; stripe++) {
    const w = (S.x1 - S.x0 + 0.2) / 6;
    const sx = S.x0 - 0.1 + w * (stripe + 0.5);
    m.box([w, 0.05, 0.9], [sx, S.h - 0.05, S.z1 + 0.38], stripe % 2 ? '#ffffff' : ORANGE, [0.42, 0, 0]);
    m.box([w, 0.16, 0.04], [sx, S.h - 0.32, S.z1 + 0.8], stripe % 2 ? '#ffffff' : ORANGE);
  }
  m.cylinder(0.32, 0.32, 0.06, [(S.x0 + S.x1) / 2, S.h + 0.55, (S.z0 + S.z1) / 2], '#f3f3f3', 20, [Math.PI / 2, 0, 0]);
  m.rod([(S.x0 + S.x1) / 2, S.h + 0.16, (S.z0 + S.z1) / 2], [(S.x0 + S.x1) / 2, S.h + 0.25, (S.z0 + S.z1) / 2], 0.04, STEEL);

  /* Convoyeur aérien : de la boutique à l'entrepôt, devant la tour. */
  const path: V3[] = [
    [S.x0 - 0.2, 1.0, CONVEYOR_Z],
    [1.85, CONVEYOR_Y, CONVEYOR_Z],
    [WH.x1 + 0.02, CONVEYOR_Y, CONVEYOR_Z],
  ];
  for (let leg = 0; leg < path.length - 1; leg++) {
    const a = path[leg];
    const b = path[leg + 1];
    m.beam([a[0], a[1] - 0.08, a[2]], [b[0], b[1] - 0.08, b[2]], 0.16, '#59616d');
    for (const side of [-1, 1]) {
      m.beam([a[0], a[1] + 0.04, a[2] + side * 0.3], [b[0], b[1] + 0.04, b[2] + side * 0.3], 0.06, ORANGE);
    }
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const rollers = Math.floor(length / 0.22);
    for (let roller = 0; roller <= rollers; roller++) {
      const f = roller / rollers;
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      m.cylinder(0.035, 0.035, 0.56, [x, y, CONVEYOR_Z], '#c4cad2', 6, [Math.PI / 2, 0, 0], 0);
    }
  }
  for (const px of [2.15, 1.0, -0.15]) {
    const py = px > 1.85 ? 1.0 + ((S.x0 - 0.2 - px) / (S.x0 - 0.2 - 1.85)) * (CONVEYOR_Y - 1.0) : CONVEYOR_Y;
    for (const side of [-1, 1]) m.beam([px, 0.1, CONVEYOR_Z + side * 0.24], [px, py - 0.12, CONVEYOR_Z + side * 0.24], 0.07, '#59616d');
  }

  return { body: m.build(), lights: lights.build(), panes: panes.build() };
}

function techWindows() {
  const list: WindowSpec[] = [];
  const T = TW;
  const g1 = T.floor;
  for (const floor of [1, 2]) {
    const y = g1 * floor + g1 / 2 + 0.05;
    // Façade : deux fenêtres de part et d'autre du grand écran (au 1er étage).
    windowRow(list, { x0: T.x0 + 0.35, x1: T.x0 + 0.35, y, z: T.z1 + 0.012, count: 1, width: 0.42, height: 1.05, seeds: [3 + floor] });
    windowRow(list, { x0: T.x1 - 0.35, x1: T.x1 - 0.35, y, z: T.z1 + 0.012, count: 1, width: 0.42, height: 1.05, seeds: [5 + floor] });
    // Flanc droit (visible depuis le ponton).
    windowRow(list, { x0: -T.z0 - 2.2, x1: -T.z0 - 0.5, y, z: T.x1 + 0.012, count: 3, width: 0.5, height: 1.05, seeds: [3, 5, 7], rotationY: Math.PI / 2 });
  }
  return list;
}

export function TechCenter({ project }: { project: Project }) {
  const parts = useMemo(() => buildTechCenter(), []);
  const windows = useMemo(() => techWindows(), []);
  const bag = useMemo(() => bagTexture(), []);
  const bagMaterial = useMemo(() => new MeshStandardMaterial({ map: bag, transparent: true, alphaTest: 0.4, emissive: '#ffffff', emissiveMap: bag, emissiveIntensity: 0.6 }), [bag]);
  const sign = useMemo(() => {
    const m = new Maquette();
    const text = signFrame(m, [-4.15, CURB, 2.15], 0.18, 1.9, 1.15);
    return { geometry: m.build(), text };
  }, []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.lights.dispose();
      parts.panes.dispose();
      bag.dispose();
      bagMaterial.dispose();
      sign.geometry.dispose();
    },
    [bag, bagMaterial, parts, sign],
  );

  const table = useRef<Mesh>(null);
  const dish = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);
  const notify = useRef<Mesh>(null);
  const park = useMemo(() => parkAngle(), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const phase = wrap(time);
    if (table.current) {
      // La table de tri fait un demi-tour à chaque colis (angle continu d'une tournée à l'autre).
      let turns = 0;
      for (const spawn of SPAWNS) {
        const u = time - spawn - 4.2;
        const done = Math.floor(u / PERIOD);
        turns += done + ease((u - done * PERIOD) / 1.2);
      }
      table.current.rotation.y = turns * Math.PI;
    }
    if (dish.current) dish.current.rotation.y = Math.sin(time * 0.35) * 1.1;
    if (beacon.current) beacon.current.visible = Math.sin(time * 4.2) > 0.2 || skyState.dayNight < 0.05;
    if (notify.current) {
      // Notification de commande : la pastille « sac » saute au-dessus de la boutique.
      let pop = 0;
      for (const spawn of SPAWNS) {
        let t = phase - spawn;
        if (t < 0) t += PERIOD;
        if (t < 1.4) pop = Math.max(pop, Math.sin(Math.min(1, t / 1.4) * Math.PI));
      }
      notify.current.scale.setScalar(0.25 + pop * 0.85);
      notify.current.position.y = SHOP.h + 1.05 + pop * 0.35;
    }
  });

  const T = TW;
  const top = T.floor * 3;

  return (
    <group>
      <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.04} position={[SX, TOWN.level, SZ]} rotation={[0, RY, 0]}>
        <mesh geometry={parts.body} material={paint} castShadow receiveShadow />
        <mesh geometry={parts.lights} material={glow} />
        <mesh geometry={parts.panes} material={glass} />
        <Windows windows={windows} />
        {/* Grand écran en façade : la page d'accueil du site. */}
        <Screen
          width={1.62}
          height={1.01}
          url={project.screenshots?.[0]}
          fallback="grid"
          position={[(T.x0 + T.x1) / 2, T.floor * 1.5 + 0.12, T.z1 + 0.03]}
        />
        <Screen
          width={1.62}
          height={1.01}
          url={project.screenshots?.[0]}
          fallback="console"
          crop={[0, 0.2, 0.62, 0.79]}
          pan={[
            [0, 0.0, 0.62, 0.59],
            [0.38, 0.38, 1, 0.97],
          ]}
          panSpeed={0.05}
          position={[(T.x0 + T.x1) / 2, T.floor * 2.5 + 0.05, T.z1 + 0.03]}
        />
        <Plaque index={project.index} accent={project.accent} size={1.2} position={[1.1, top + 0.9, T.z1 + 0.01]} />
        {/* Table de tri tournante (sous la verrière). */}
        <mesh ref={table} position={TURNTABLE} castShadow raycast={() => null}>
          <cylinderGeometry args={[0.66, 0.66, 0.08, 20]} />
          <meshStandardMaterial color="#3d4552" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[TURNTABLE[0], TURNTABLE[1] + 0.05, TURNTABLE[2]]} rotation-x={-Math.PI / 2} raycast={() => null}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        {/* Parabole qui balaie le ciel, balise rouge en haut du mât. */}
        <group ref={dish} position={[T.x0 + 0.65, top + 0.62, T.z0 + 0.55]}>
          <mesh position={[0, 0.32, 0]} rotation={[-0.7, 0, 0]} castShadow>
            <sphereGeometry args={[0.42, 14, 6, 0, Math.PI * 2, 0, 1.0]} />
            <meshStandardMaterial color="#e9ecef" roughness={0.5} side={2} flatShading />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.34, 6]} />
            <meshStandardMaterial color={STEEL} roughness={0.6} />
          </mesh>
        </group>
        <mesh ref={beacon} position={[T.x1 - 0.35, top + 1.95, T.z0 + 0.35]} raycast={() => null}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color="#ff4b3a" emissive="#ff2a1a" emissiveIntensity={2.5} />
        </mesh>
        {/* Pastille de commande au-dessus de la boutique. */}
        <mesh ref={notify} position={[(SHOP.x0 + SHOP.x1) / 2, SHOP.h + 1.05, (SHOP.z0 + SHOP.z1) / 2 + 0.05]} material={bagMaterial} raycast={() => null}>
          <circleGeometry args={[0.36, 24]} />
        </mesh>
        <mesh geometry={sign.geometry} material={paint} castShadow />
        <SignText lines={[project.title]} accent={project.accent} width={1.9} position={sign.text} rotation={[0, 0.18, 0]} />
      </Hotspot>
      <Parcels park={park} />
      <DeliveryVan park={park} />
    </group>
  );
}
