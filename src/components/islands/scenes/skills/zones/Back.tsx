'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Merger, pose, topAndSides, flatRing, type Vec3 } from '../geometry';
import { createCableMaterial, glowMaterial, labNight, labState, labTime, paintMaterial } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * CENTRE BACK-END — trois baies de serveurs aux LED qui clignotent (bandes magnétiques
 * qui tournent dans celle du milieu, ventilateur sur le toit), des câbles gainés où
 * courent des impulsions lumineuses, et une base de données (trois disques empilés)
 * dont les joints respirent la lumière. Un câble file vers le noyau central.
 */

const RACK_Z = -0.78;
const RACK_FRONT = RACK_Z + 0.311;
const RACKS = [-0.84, 0, 0.84];
const DB: Vec3 = [0.95, 0, 0.62];
const SPOOL: Vec3 = [-1.45, 0, -0.08];
const REELS = [1.12, 0.66];

const ledVertex = /* glsl */ `
attribute vec2 aGrid;
attribute float aSeed;
varying vec2 vUv;
varying vec2 vGrid;
varying float vSeed;
void main() {
  vUv = uv;
  vGrid = aGrid;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ledFragment = /* glsl */ `
uniform float uTime;
uniform float uNight;
varying vec2 vUv;
varying vec2 vGrid;
varying float vSeed;
float cellHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 grid = vUv * vGrid;
  vec2 cell = floor(grid);
  vec2 f = fract(grid) - 0.5;
  // Façade sombre striée en tiroirs (une rangée = un serveur).
  vec3 panel = vec3(0.06, 0.075, 0.11) + smoothstep(0.4, 0.5, abs(f.y)) * vec3(0.07, 0.08, 0.1);
  float led = 1.0 - smoothstep(0.16, 0.26, length(f));
  float rate = 0.6 + cellHash(cell + vSeed) * 3.4;
  float on = step(0.42, cellHash(cell + vSeed * 3.7 + floor(uTime * rate)));
  float kind = cellHash(cell * 1.31 + vSeed * 0.7);
  vec3 color = kind < 0.55 ? vec3(1.0, 0.55, 0.12) : (kind < 0.86 ? vec3(0.3, 1.0, 0.45) : vec3(0.25, 0.75, 1.0));
  vec3 rgb = panel + color * led * on * (1.15 + uNight * 1.7);
  gl_FragColor = vec4(rgb, 1.0);
  #include <colorspace_fragment>
}
`;

function ledGeometry() {
  const panels: { at: Vec3; size: [number, number]; grid: [number, number] }[] = [
    { at: [RACKS[0], 0.84, RACK_FRONT], size: [0.58, 1.22], grid: [4, 11] },
    { at: [RACKS[2], 0.84, RACK_FRONT], size: [0.58, 1.22], grid: [4, 11] },
    { at: [RACKS[1], 0.27, RACK_FRONT], size: [0.58, 0.2], grid: [7, 2] },
  ];
  const parts = panels.map(({ at, size, grid }, index) => {
    const plane = new PlaneGeometry(size[0], size[1]);
    plane.translate(at[0], at[1], at[2]);
    const count = plane.attributes.position.count;
    const grids = new Float32Array(count * 2);
    const seeds = new Float32Array(count);
    for (let vertex = 0; vertex < count; vertex++) {
      grids.set(grid, vertex * 2);
      seeds[vertex] = index * 17.3 + 4.1;
    }
    plane.setAttribute('aGrid', new BufferAttribute(grids, 2));
    plane.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    plane.deleteAttribute('normal');
    return plane;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Bobine de bande magnétique, axe selon Z, centrée à l'origine. */
function reelGeometry() {
  const merger = new Merger();
  merger.cylinder(0.17, 0.17, 0.02, 22, '#d7dce5', [0, 0, 0], [Math.PI / 2, 0, 0], 0);
  merger.cylinder(0.125, 0.125, 0.03, 22, '#5a4535', [0, 0, 0.004], [Math.PI / 2, 0, 0], 0);
  merger.cylinder(0.045, 0.045, 0.04, 10, '#2b3142', [0, 0, 0.01], [Math.PI / 2, 0, 0], 0);
  for (let index = 0; index < 3; index++) {
    const angle = (index / 3) * Math.PI * 2;
    merger.box([0.05, 0.075, 0.034], '#1c2130', [Math.cos(angle) * 0.085, Math.sin(angle) * 0.085, 0.006], [0, 0, angle + Math.PI / 2], 0);
  }
  return merger.build();
}

function fanGeometry() {
  const merger = new Merger();
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2;
    merger.box([0.17, 0.012, 0.065], '#c9d0dc', [Math.cos(angle) * 0.1, 0, -Math.sin(angle) * 0.1], [0.35, angle, 0], 0);
  }
  merger.cylinder(0.045, 0.045, 0.05, 10, '#3a4258', [0, 0, 0], undefined, 0);
  return merger.build();
}

function cableGeometry(toHub: number, pad: number) {
  const end: Vec3 = [Math.sin(toHub) * (pad - 0.08), 0.05, Math.cos(toHub) * (pad - 0.08)];
  const bend: Vec3 = [(DB[0] + end[0]) / 2 + 0.1, 0.05, (DB[2] + end[2]) / 2 + 0.1];
  const routes: Vec3[][] = [
    [[RACKS[0], 0.06, RACK_FRONT + 0.05], [-0.75, 0.05, 0.05], [0.1, 0.05, 0.45], [0.58, 0.07, 0.6]],
    [[RACKS[1], 0.06, RACK_FRONT + 0.05], [0.25, 0.05, 0.05], [0.7, 0.07, 0.3]],
    [[RACKS[2], 0.06, RACK_FRONT + 0.05], [0.98, 0.05, -0.05], [1.05, 0.07, 0.24]],
    [[-1.0, 1.6, -0.95], [-0.65, 1.98, -0.97], [-0.3, 1.6, -0.95]],
    [[0.3, 1.6, -0.6], [0.65, 2.02, -0.58], [1.0, 1.6, -0.6]],
    [[DB[0] + 0.25, 0.06, DB[2] + 0.3], bend, end],
  ];
  const tubes = routes.map((route) => {
    const curve = new CatmullRomCurve3(route.map(([x, y, z]) => new Vector3(x, y, z)));
    const tube = new TubeGeometry(curve, 28, 0.045, 6, false);
    const length = curve.getLength();
    const uv = tube.attributes.uv;
    const flow = new Float32Array(uv.count);
    for (let index = 0; index < uv.count; index++) flow[index] = uv.getX(index) * length;
    tube.setAttribute('aFlow', new BufferAttribute(flow, 1));
    tube.deleteAttribute('uv');
    return tube;
  });
  const merged = mergeGeometries(tubes, false);
  tubes.forEach((tube) => tube.dispose());
  return merged;
}

function buildStatic(accent: string) {
  const paint = new Merger();
  const glow = new Merger();
  addPad(paint, glow, 2.1, accent);
  for (const x of RACKS) {
    paint.box([0.74, 1.5, 0.62], '#2d3550', [x, 0.79, RACK_Z]);
    paint.box([0.78, 0.06, 0.66], '#48526e', [x, 0.03, RACK_Z]);
    paint.box([0.8, 0.07, 0.68], '#48526e', [x, 1.575, RACK_Z]);
    paint.box([0.03, 0.22, 0.03], '#aeb6c4', [x + 0.31, 0.84, RACK_FRONT + 0.01]);
  }
  // Baie du milieu : logements des bobines, ventilateur sur le toit.
  for (const y of REELS) {
    paint.cylinder(0.205, 0.205, 0.02, 22, '#1a1f2d', [0, y, RACK_FRONT + 0.005], [Math.PI / 2, 0, 0], 0);
  }
  paint.torus(0.22, 0.03, '#5d6883', [0, 1.63, RACK_Z], [Math.PI / 2, 0, 0]);
  paint.cylinder(0.24, 0.24, 0.02, 16, '#1d2230', [0, 1.615, RACK_Z], undefined, 0);
  // Base de données : socle, trois disques, couvercle clair.
  paint.octagon(0.52, 0.55, 0.06, '#cfc6b6', [DB[0], 0.03, DB[2]]);
  for (const y of [0.2, 0.52, 0.84]) {
    paint.cylinder(0.4, 0.4, 0.26, 22, topAndSides('#fbf8f1', '#e6dfd0'), [DB[0], y, DB[2]], undefined, 0.05);
  }
  paint.add(flatRing(0.2, 0.33, 22), '#f0c58f', pose([DB[0], 0.972, DB[2]]), 0);
  glow.cylinder(0.05, 0.05, 0.03, 10, accent, [DB[0], 0.985, DB[2]], undefined, 0);
  // Touret de câble couché, câble orange enroulé.
  paint.group(pose(SPOOL, [0, 0.5, 0]), () => {
    for (const side of [-0.17, 0.17]) paint.cylinder(0.3, 0.3, 0.05, 14, '#b07a48', [side, 0.3, 0], [0, 0, Math.PI / 2], 0.05);
    paint.cylinder(0.21, 0.21, 0.3, 14, (point, _normal, out) => {
      out.set(Math.sin(point.x * 90) > 0 ? '#ff9f43' : '#e4832c');
    }, [0, 0.3, 0], [0, 0, Math.PI / 2], 0);
  });
  // Diodes d'état au-dessus des baies.
  RACKS.forEach((x, index) => glow.box([0.05, 0.03, 0.02], index === 1 ? '#5ef2a0' : accent, [x - 0.24, 1.5, RACK_FRONT + 0.012], undefined, 0));
  return { paint: paint.build(), glow: glow.build() };
}

const dummy = new Object3D();
const bandColor = new Color();

export function BackZone({ zone, spot }: ZoneProps) {
  const reels = useRef<InstancedMesh>(null);
  const fan = useRef<Mesh>(null);
  const bands = useRef<MeshBasicMaterial>(null);
  const built = useMemo(() => buildStatic(zone.accent), [zone.accent]);
  const leds = useMemo(() => ledGeometry(), []);
  const reel = useMemo(() => reelGeometry(), []);
  const blades = useMemo(() => fanGeometry(), []);
  const cables = useMemo(() => cableGeometry(spot.toHub, spot.pad), [spot.pad, spot.toHub]);
  const cableMaterial = useMemo(() => createCableMaterial(zone.accent), [zone.accent]);
  const ledMaterial = useMemo(
    () => new ShaderMaterial({ uniforms: { uTime: labTime, uNight: labNight }, vertexShader: ledVertex, fragmentShader: ledFragment }),
    [],
  );
  const bandGeometry = useMemo(() => {
    const parts = [0.36, 0.68].map((y) => new CylinderGeometry(0.393, 0.393, 0.06, 22, 1, true).translate(DB[0], y, DB[2]));
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged as BufferGeometry;
  }, []);
  const accent = useMemo(() => new Color(zone.accent), [zone.accent]);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      leds.dispose();
      reel.dispose();
      blades.dispose();
      cables.dispose();
      cableMaterial.dispose();
      ledMaterial.dispose();
      bandGeometry.dispose();
    },
    [bandGeometry, blades, built, cableMaterial, cables, ledMaterial, leds, reel],
  );

  useLayoutEffect(() => {
    const mesh = reels.current;
    if (!mesh) return;
    REELS.forEach((y, index) => {
      dummy.position.set(0, y, RACK_FRONT + 0.02);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state) => {
    if (!labState.awake) return;
    const t = state.clock.elapsedTime;
    const mesh = reels.current;
    if (mesh) {
      // Les deux bobines défilent en sens opposés, par à-coups (lecture, pause, avance).
      const jog = t * 1.6 + Math.sin(t * 0.7) * 1.2;
      for (let index = 0; index < REELS.length; index++) {
        dummy.position.set(0, REELS[index], RACK_FRONT + 0.02);
        dummy.rotation.set(0, 0, index === 0 ? jog * 1.4 : -jog);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (fan.current) fan.current.rotation.y = t * 9;
    // Joints de la base de données : respiration lente.
    if (bands.current) {
      const breath = 0.5 + 0.5 * Math.sin(t * 1.5);
      bandColor.copy(accent).multiplyScalar(0.55 + breath * 0.9 + labNight.value * 1.2);
      bands.current.color.copy(bandColor);
    }
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[-1.12, 1.3]}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <mesh geometry={leds} material={ledMaterial} raycast={noRaycast} />
      <mesh geometry={cables} material={cableMaterial} castShadow raycast={noRaycast} />
      <instancedMesh ref={reels} args={[reel, paintMaterial, 2]} raycast={noRaycast} />
      <mesh ref={fan} geometry={blades} material={paintMaterial} position={[0, 1.64, RACK_Z]} raycast={noRaycast} />
      <mesh geometry={bandGeometry} raycast={noRaycast}>
        <meshBasicMaterial ref={bands} color={zone.accent} toneMapped={false} />
      </mesh>
    </ZoneShell>
  );
}
