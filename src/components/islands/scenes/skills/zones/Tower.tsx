'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { windowMaterial } from '@/lib/windows';
import { easeOut, span } from '../anim';
import { flatRing, Merger, pose, topAndSides, type Vec3 } from '../geometry';
import { flowMaterial, glowMaterial, labState, labTime, paintMaterial } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * TOUR DE CONTRÔLE — la tour (cabine vitrée, radar qui tourne, feux d'obstacle, petit
 * Gwenn-ha-Du au balcon) veille sur une aire de lancement. Au sol, un graphe git en
 * lignes de lumière : deux branches partent de la ligne principale, y reviennent, et
 * les impulsions filent vers la fusée. Toutes les 18 s : compte à rebours, panache,
 * décollage (« deploy »), puis la fusée redescend se poser en douceur sur son aire.
 */

const TOWER: Vec3 = [-0.85, 0, -0.55];
const PAD: Vec3 = [0.75, 0, 0.42];
const PAD_TOP = 0.14;
const GANTRY: Vec3 = [1.38, 0, 0.08];
const CABIN_Y = 3.02;
const ROCKET_CYCLE = 18;
const APEX = 8.5;
const CHASE = 8;
const PUFFS = 18;

/** Graphe git : ligne principale vers la fusée, deux branches qui en partent et y reviennent. */
const GIT_LINES: { color: string; points: [number, number][]; start: number }[] = [
  { color: '#ffd23f', points: [[-1.55, 1.0], [-0.6, 1.02], [-0.05, 0.98], [0.33, 0.66]], start: 0 },
  { color: '#5ec8ff', points: [[-1.3, 1.0], [-1.12, 0.76], [-0.75, 0.72], [-0.52, 1.0]], start: 0.25 },
  { color: '#ff6fa8', points: [[-0.95, 1.0], [-0.8, 1.27], [-0.36, 1.3], [-0.16, 0.99]], start: 0.6 },
];
const COMMITS: [number, number][] = [
  [-1.5, 1.0], [-1.3, 1.0], [-0.95, 1.0], [-0.52, 1.01], [-0.16, 0.99], [0.12, 0.88],
  [-0.98, 0.73], [-0.75, 0.72], [-0.6, 1.3], [-0.4, 1.3],
];

function gitGeometry() {
  const parts = GIT_LINES.map(({ color, points, start }) => {
    const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
    const samples = curve.getSpacedPoints(36);
    const positions: number[] = [];
    const flows: number[] = [];
    const tint = new Color(color);
    const colors: number[] = [];
    let travelled = start;
    for (let index = 0; index < samples.length - 1; index++) {
      const a = samples[index];
      const b = samples[index + 1];
      const length = a.distanceTo(b);
      const nx = (-(b.z - a.z) / (length || 1)) * 0.035;
      const nz = ((b.x - a.x) / (length || 1)) * 0.035;
      const quad = [
        [a.x + nx, a.z + nz, travelled], [b.x + nx, b.z + nz, travelled + length], [a.x - nx, a.z - nz, travelled],
        [a.x - nx, a.z - nz, travelled], [b.x + nx, b.z + nz, travelled + length], [b.x - nx, b.z - nz, travelled + length],
      ];
      for (const [x, z, flow] of quad) {
        positions.push(x, 0.012, z);
        flows.push(flow * 1.6);
        colors.push(tint.r, tint.g, tint.b);
      }
      travelled += length;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('aFlow', new BufferAttribute(new Float32Array(flows), 1));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    return geometry;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

function buildStatic(accent: string) {
  const paint = new Merger();
  const glow = new Merger();
  addPad(paint, glow, 2.1, accent);

  paint.group(pose(TOWER), () => {
    // Socle, fût crème cerclé de jaune, porte.
    paint.octagon(0.62, 0.68, 0.36, topAndSides('#ddd5c6', '#bfb4a2'), [0, 0.18, 0]);
    paint.cylinder(0.3, 0.36, 2.32, 14, '#f3ead8', [0, 0.36 + 1.16, 0], undefined, 0.06);
    for (const y of [1.1, 1.95]) paint.cylinder(0.333, 0.338, 0.12, 14, accent, [0, y, 0], undefined, 0);
    paint.box([0.26, 0.42, 0.06], '#3d4658', [0, 0.57, 0.335]);
    // Balcon, garde-corps, cabine, toit.
    paint.cylinder(0.78, 0.74, 0.07, 16, '#8d97a6', [0, 2.7, 0]);
    paint.add(new CylinderGeometry(0.76, 0.76, 0.14, 16, 1, true), '#d3dbe4', pose([0, 2.81, 0]), 0);
    paint.add(new CylinderGeometry(0.5, 0.46, 0.44, 8, 1, false, Math.PI / 8), '#2b3242', pose([0, CABIN_Y, 0]), 0);
    for (let index = 0; index < 8; index++) {
      const angle = Math.PI / 8 + (index / 8) * Math.PI * 2;
      paint.box([0.045, 0.46, 0.045], '#3d4658', [Math.sin(angle) * 0.5, CABIN_Y, Math.cos(angle) * 0.5], [0, angle, 0], 0);
    }
    paint.cylinder(0.66, 0.6, 0.08, 8, '#3d4658', [0, CABIN_Y - 0.25, 0]);
    paint.cylinder(0.7, 0.66, 0.08, 8, '#3d4658', [0, CABIN_Y + 0.26, 0]);
    paint.cylinder(0.08, 0.5, 0.2, 8, '#e2553f', [0, CABIN_Y + 0.4, 0]);
    paint.cylinder(0.05, 0.05, 0.2, 6, '#5b6472', [0, CABIN_Y + 0.58, 0]);
    // Mâts des feux d'obstacle et hampe du drapeau.
    for (const side of [-0.5, 0.5]) paint.rod([side, CABIN_Y + 0.28, -0.25], [side, CABIN_Y + 0.62, -0.25], 0.015, '#5b6472');
    paint.rod([0.66, 2.73, 0.3], [0.66, 3.55, 0.3], 0.016, '#e9e3d6');
  });

  // Aire de lancement : bord à chevrons jaunes et noirs, cible au centre.
  paint.add(
    new CylinderGeometry(0.55, 0.58, PAD_TOP, 24),
    (point, normal, out) => {
      if (normal.y > 0.5) out.set('#4b5263');
      else out.set(Math.sin(Math.atan2(point.x - PAD[0], point.z - PAD[2]) * 8) > 0 ? '#ffd23f' : '#2b2f38');
    },
    pose([PAD[0], PAD_TOP / 2, PAD[2]]),
    0,
  );
  paint.add(flatRing(0.3, 0.36, 24), '#ffd23f', pose([PAD[0], PAD_TOP + 0.003, PAD[2]]), 0);
  // Portique de service en treillis, et son bras.
  const corners: [number, number][] = [[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]];
  corners.forEach(([dx, dz]) => paint.rod([GANTRY[0] + dx, 0, GANTRY[2] + dz], [GANTRY[0] + dx, 1.35, GANTRY[2] + dz], 0.018, '#e2553f', 4));
  for (const y of [0.3, 0.65, 1.0, 1.32]) {
    corners.forEach(([dx, dz], index) => {
      const [ex, ez] = corners[(index + 1) % 4];
      paint.rod([GANTRY[0] + dx, y, GANTRY[2] + dz], [GANTRY[0] + ex, y - 0.25, GANTRY[2] + ez], 0.011, '#c9483a', 3);
    });
  }
  const armEnd = new Vector3(PAD[0] - GANTRY[0], 0, PAD[2] - GANTRY[2]).normalize().multiplyScalar(0.42);
  paint.rod([GANTRY[0], 0.95, GANTRY[2]], [GANTRY[0] + armEnd.x, 0.95, GANTRY[2] + armEnd.z], 0.025, '#5b6472', 4);
  // Commits : perles lumineuses sur les branches.
  COMMITS.forEach(([x, z]) => glow.cylinder(0.05, 0.05, 0.02, 10, '#ffffff', [x, 0.014, z], undefined, 0));
  return { paint: paint.build(), glow: glow.build() };
}

/** Bande vitrée de la cabine (s'allume au crépuscule) et deux hublots du fût. */
function windowsGeometry() {
  const parts: BufferGeometry[] = [new CylinderGeometry(0.515, 0.47, 0.34, 8, 1, true, Math.PI / 8).translate(TOWER[0], CABIN_Y + 0.02, TOWER[2])];
  for (const y of [1.5, 2.3]) parts.push(new PlaneGeometry(0.12, 0.2).translate(TOWER[0], y, TOWER[2] + 0.335));
  parts.forEach((part) => part.deleteAttribute('uv'));
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Fusée (repère : base des tuyères), blanche, nez rouge, ailerons jaunes. */
function rocketGeometry() {
  const merger = new Merger();
  merger.cylinder(0.07, 0.1, 0.08, 10, '#3b4154', [0, 0.04, 0]);
  merger.cylinder(0.13, 0.13, 0.55, 14, '#f7f3ea', [0, 0.355, 0], undefined, 0.08);
  merger.cylinder(0.134, 0.134, 0.06, 14, '#e2553f', [0, 0.52, 0], undefined, 0);
  merger.cylinder(0.0, 0.13, 0.3, 14, '#e2553f', [0, 0.78, 0], undefined, 0.08);
  merger.cylinder(0.045, 0.045, 0.02, 12, '#7fd7e8', [0, 0.42, 0.125], [Math.PI / 2, 0, 0], 0);
  for (let index = 0; index < 3; index++) {
    const angle = (index / 3) * Math.PI * 2;
    merger.box([0.025, 0.2, 0.15], '#ffd23f', [Math.sin(angle) * 0.17, 0.17, Math.cos(angle) * 0.17], [0, angle, 0], 0.05);
  }
  return merger.build();
}

function flameGeometry() {
  return new Merger()
    .add(new CylinderGeometry(0.085, 0.0, 0.55, 10), (point, _normal, out) => {
      out.set('#ffb03a').lerp(new Color('#fff4c2'), Math.min(1, Math.max(0, (point.y + 0.2) / 0.5)));
    }, pose([0, -0.27, 0]), 0)
    .build();
}

/** Tête de radar : antenne incurvée sur son axe. */
function radarGeometry() {
  const bar = new BoxGeometry(0.72, 0.15, 0.035, 8, 1, 1);
  const positions = bar.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    positions.setZ(index, positions.getZ(index) + x * x * 0.45);
  }
  bar.computeVertexNormals();
  return new Merger()
    .add(bar, '#eef2f6', pose([0, 0.12, -0.06]), 0.06)
    .box([0.05, 0.14, 0.05], '#5b6472', [0, 0.04, 0])
    .rod([0, 0.12, 0.02], [0, 0.12, 0.2], 0.012, '#5b6472')
    .build();
}

function flagMaterial() {
  const material = new MeshStandardMaterial({ map: gwennHaDu(), side: DoubleSide, roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabTime = labTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uLabTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float flagFree = clamp(position.x / 0.42, 0.0, 1.0);
        transformed.z += (sin(position.x * 14.0 - uLabTime * 7.0) * 0.035 + sin(position.x * 23.0 - uLabTime * 11.0) * 0.01) * flagFree;
        transformed.y -= flagFree * flagFree * 0.02;`,
      );
  };
  material.customProgramCacheKey = () => 'skills-flag-v1';
  return material;
}

const dummy = new Object3D();
const tint = new Color();
const CHASE_ON = new Color('#ffd23f');
const CHASE_OFF = new Color('#4a3f1c');

export function TowerZone({ zone, spot }: ZoneProps) {
  const radar = useRef<Group>(null);
  const beacons = useRef<MeshBasicMaterial>(null);
  const rocket = useRef<Group>(null);
  const flame = useRef<Mesh>(null);
  const chase = useRef<InstancedMesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const reducedMotion = useWorld((state) => state.reducedMotion);

  const built = useMemo(() => buildStatic(zone.accent), [zone.accent]);
  const git = useMemo(() => gitGeometry(), []);
  const windows = useMemo(() => windowsGeometry(), []);
  const cabinGlass = useMemo(() => windowMaterial(37, '#ffd98a', '#38566e', 2.4), []);
  const body = useMemo(() => rocketGeometry(), []);
  const fire = useMemo(() => flameGeometry(), []);
  const dish = useMemo(() => radarGeometry(), []);
  const flag = useMemo(() => flagMaterial(), []);
  const cloth = useMemo(() => new PlaneGeometry(0.42, 0.28, 8, 3).translate(0.21, 0, 0), []);
  const bulb = useMemo(() => new Merger().sphere(0.035, '#ffffff', [0, 0, 0], 1, [8, 6], 0).build(), []);
  const puff = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const lamps = useMemo(
    () => new Merger().sphere(0.045, '#ffffff', [-0.5, 0, 0], 1, [8, 6], 0).sphere(0.045, '#ffffff', [0.5, 0, 0], 1, [8, 6], 0).build(),
    [],
  );

  useEffect(
    () => () => {
      [built.paint, built.glow, git, windows, body, fire, dish, cloth, bulb, puff, lamps].forEach((geometry) => geometry.dispose());
      flag.map?.dispose();
      flag.dispose();
    },
    [body, built, bulb, cloth, dish, fire, flag, git, lamps, puff, windows],
  );

  useLayoutEffect(() => {
    const lights = chase.current;
    if (lights) {
      for (let index = 0; index < CHASE; index++) {
        const angle = (index / CHASE) * Math.PI * 2;
        dummy.position.set(PAD[0] + Math.sin(angle) * 0.5, PAD_TOP + 0.02, PAD[2] + Math.cos(angle) * 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        lights.setMatrixAt(index, dummy.matrix);
        lights.setColorAt(index, CHASE_OFF);
      }
      lights.instanceMatrix.needsUpdate = true;
      if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
    }
    const smoke = puffs.current;
    if (smoke) {
      dummy.position.set(0, -10, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      for (let index = 0; index < PUFFS; index++) smoke.setMatrixAt(index, dummy.matrix);
      smoke.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((state) => {
    if (!labState.awake) return;
    const t = state.clock.elapsedTime;
    if (radar.current) radar.current.rotation.y = t * 1.3;
    // Feux d'obstacle : un éclat rouge toutes les 1,6 s.
    if (beacons.current) beacons.current.color.setRGB(1, 0.18, 0.15).multiplyScalar((t % 1.6) < 0.35 ? 2.6 : 0.35);

    // --- Cycle de la fusée.
    const r = reducedMotion ? 0 : (t + 6) % ROCKET_CYCLE;
    let height = 0;
    let thrust = 0;
    if (r >= 10.0 && r < 10.4) thrust = 0.35 + Math.sin(t * 40) * 0.1;
    else if (r >= 10.4 && r < 13.0) {
      const s = span(r, 10.4, 2.6);
      height = APEX * s * s;
      thrust = 1;
    } else if (r >= 13.0 && r < 13.8) {
      height = APEX + Math.sin(span(r, 13.0, 0.8) * Math.PI) * 0.35;
    } else if (r >= 13.8 && r < 17.0) {
      const s = span(r, 13.8, 3.2);
      height = APEX * (1 - easeOut(s));
      thrust = 0.35 + s * 0.65;
    }
    if (rocket.current) {
      rocket.current.position.y = PAD_TOP + height;
      const shake = thrust > 0 && height < 0.5 ? Math.sin(t * 55) * 0.012 : 0;
      rocket.current.position.x = PAD[0] + shake;
      rocket.current.rotation.z = height > 0 ? Math.sin(t * 2.1) * 0.04 : 0;
    }
    if (flame.current) {
      flame.current.visible = thrust > 0.01;
      const flicker = 0.85 + Math.sin(t * 47) * 0.1 + Math.sin(t * 31) * 0.08;
      flame.current.scale.set(0.8 + thrust * 0.4, thrust * flicker * 1.25, 0.8 + thrust * 0.4);
    }

    // Feux de piste : un feu qui tourne au repos, clignotement au compte à rebours, tout
    // allumé pendant le vol.
    const lights = chase.current;
    if (lights) {
      const countdown = r >= 8.6 && r < 10.4;
      const flying = r >= 10.4 && r < 17.2;
      for (let index = 0; index < CHASE; index++) {
        let on = Math.max(0, 1 - (((t * 4 - index) % CHASE) + CHASE) % CHASE * 0.45);
        if (countdown) on = Math.sin(t * 18) > 0 ? 1 : 0.1;
        if (flying) on = 1;
        lights.setColorAt(index, tint.copy(CHASE_OFF).lerp(CHASE_ON, on).multiplyScalar(0.8 + on * 1.2));
      }
      if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
    }

    // Panaches : bouffées au décollage et à l'atterrissage, traînée pendant la montée.
    const smoke = puffs.current;
    if (smoke) {
      for (let index = 0; index < PUFFS; index++) {
        const burst = index < 12;
        let life = -1;
        let x = 0;
        let y = 0;
        let z = 0;
        let size = 0;
        if (burst) {
          const angle = (index / 12) * Math.PI * 2 + hash(index * 3.7) * 0.4;
          const sinceLaunch = r - 10.2;
          const sinceLanding = r - 16.6;
          const since = sinceLanding > 0 ? sinceLanding : sinceLaunch;
          life = since / 2.0;
          const spread = 0.3 + Math.sqrt(Math.max(life, 0)) * 0.95;
          x = PAD[0] + Math.sin(angle) * spread;
          z = PAD[2] + Math.cos(angle) * spread;
          y = PAD_TOP + 0.08 + Math.max(life, 0) * 0.35;
          size = 0.12 + Math.max(life, 0) * 0.28;
        } else {
          const trail = index - 12;
          const born = 10.5 + trail * 0.4;
          life = (r - born) / 2.2;
          const s = span(born, 10.4, 2.6);
          x = PAD[0] + (hash(index * 5.1) - 0.5) * 0.12;
          z = PAD[2] + (hash(index * 6.3) - 0.5) * 0.12;
          y = PAD_TOP + APEX * s * s + Math.max(life, 0) * 0.4;
          size = 0.1 + Math.max(life, 0) * 0.22;
        }
        const alive = life >= 0 && life < 1;
        dummy.position.set(x, alive ? y : -10, z);
        dummy.rotation.set(index, t * 0.4 + index, 0);
        dummy.scale.setScalar(alive ? size * (life > 0.7 ? (1 - life) / 0.3 : 1) : 0);
        dummy.updateMatrix();
        smoke.setMatrixAt(index, dummy.matrix);
      }
      smoke.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[1.02, -1.0]} reach={4.2}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={windows} material={cabinGlass} raycast={noRaycast} />
      <mesh geometry={git} material={flowMaterial} raycast={noRaycast} />

      <group ref={radar} position={[TOWER[0], CABIN_Y + 0.68, TOWER[2]]}>
        <mesh geometry={dish} material={paintMaterial} castShadow raycast={noRaycast} />
      </group>
      <mesh geometry={lamps} position={[TOWER[0], CABIN_Y + 0.64, TOWER[2] - 0.25]} raycast={noRaycast}>
        <meshBasicMaterial ref={beacons} color="#ff3b30" toneMapped={false} />
      </mesh>
      <mesh geometry={cloth} material={flag} position={[TOWER[0] + 0.67, 3.38, TOWER[2] + 0.3]} rotation-y={-0.5} raycast={noRaycast} />

      <group ref={rocket} position={[PAD[0], PAD_TOP, PAD[2]]}>
        <mesh geometry={body} material={paintMaterial} castShadow raycast={noRaycast} />
        <mesh ref={flame} geometry={fire} material={glowMaterial} visible={false} raycast={noRaycast} />
      </group>
      <instancedMesh ref={chase} args={[bulb, glowMaterial, CHASE]} frustumCulled={false} raycast={noRaycast} />
      <instancedMesh ref={puffs} args={[puff, undefined, PUFFS]} frustumCulled={false} raycast={noRaycast}>
        <meshStandardMaterial color="#f4f1ea" roughness={1} flatShading transparent opacity={0.82} depthWrite={false} />
      </instancedMesh>
    </ZoneShell>
  );
}
