'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  TorusGeometry,
} from 'three';
import { site } from '@/data/site';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { addHull, Builder, flatMaterial, paintMaterial } from './build';
import { YARD } from './layout';
import { Merged, Windows, type WindowSpec } from './parts';
import { girderLettersTexture, useSansFont } from './textures';

/**
 * Le chantier naval de La Ciotat : le grand portique blanc (sa silhouette domine l'île),
 * son chariot qui va et vient le long de la poutre, le crochet qui balance, un yacht en
 * carénage sur son ber et un soudeur dont les étincelles crépitent. La nuit : feux
 * d'obstacle rouges qui clignotent et projecteurs qui éclairent le chantier.
 */

const WHITE = '#f2efe8';
const WHITE_SHADE = '#e2dccf';
const STEEL = '#3b4048';
const RED = '#df5236';
const CONCRETE = '#cec7b9';

/** Hauteur du dessous de la poutre et du dessus des rails du chariot (repère du portique). */
const GIRDER_BOTTOM = 12.35;
const TROLLEY_RAIL = 13.66;
const LEGS = YARD.legs;
const CENTER_U = (YARD.span[0] + YARD.span[1]) / 2;

function structureGeometry() {
  const b = new Builder();
  const { apron } = YARD;
  const apronCenter = (apron.from + apron.to) / 2 - CENTER_U;
  // Dalle bétonnée, joints de dilatation et chemins de roulement.
  b.box([apron.to - apron.from, 0.06, apron.half * 2], CONCRETE, [apronCenter, 0.03, 0]);
  for (let k = -2; k <= 2; k++) b.box([0.04, 0.065, apron.half * 2], '#b9b1a3', [apronCenter + k * 1.4, 0.035, 0]);
  for (const z of [-LEGS, LEGS]) {
    b.box([apron.to - apron.from, 0.05, 0.72], '#aaa293', [apronCenter, 0.07, z]);
    b.box([apron.to - apron.from, 0.1, 0.12], STEEL, [apronCenter, 0.13, z]);
  }
  // Jambes en A, sur leurs bogies.
  for (const z of [-LEGS, LEGS]) {
    for (const x of [-1.55, 1.55]) {
      b.box([1.15, 0.5, 0.62], STEEL, [x, 0.43, z]);
      for (const dx of [-0.32, 0.32]) b.cylinder(0.2, 0.2, 0.68, 10, '#23262b', [x + dx, 0.27, z], [Math.PI / 2, 0, 0]);
      b.beam([x, 0.62, z], [Math.sign(x) * 0.52, GIRDER_BOTTOM - 0.2, z], 0.44, WHITE, 0.52);
    }
    b.box([3.7, 0.38, 0.58], WHITE, [0, 0.86, z]);
    b.box([2.3, 0.32, 0.46], WHITE, [0, 6.4, z]);
    b.beam([-1.3, 1.05, z], [1.02, 6.25, z], 0.17, WHITE_SHADE, 0.2);
    b.beam([1.3, 1.05, z], [-1.02, 6.25, z], 0.17, WHITE_SHADE, 0.2);
    b.beam([-0.98, 6.56, z], [0.6, 11.9, z], 0.15, WHITE_SHADE, 0.18);
    b.box([1.6, 0.6, 0.86], WHITE, [0, GIRDER_BOTTOM - 0.25, z]);
    // Échelle d'accès le long de la jambe côté terre.
    b.beam([-1.55 - 0.32, 1.1, z + 0.18], [-0.52 - 0.32, GIRDER_BOTTOM - 0.4, z + 0.18], 0.05, STEEL, 0.05);
  }
  // Poutre-caisson, semelles et rails du chariot.
  b.box([1.3, 1.2, 11.8], WHITE, [0, GIRDER_BOTTOM + 0.6, 0]);
  b.box([1.38, 0.12, 11.9], WHITE_SHADE, [0, TROLLEY_RAIL - 0.06, 0]);
  b.box([1.38, 0.12, 11.9], WHITE_SHADE, [0, GIRDER_BOTTOM + 0.06, 0]);
  for (const x of [-0.42, 0.42]) b.box([0.08, 0.08, 11.4], STEEL, [x, TROLLEY_RAIL + 0.04, 0]);
  // Garde-corps de la passerelle.
  for (const x of [-0.66, 0.66]) {
    b.rod([x, TROLLEY_RAIL + 0.55, -5.85], [x, TROLLEY_RAIL + 0.55, 5.85], 0.025, '#d6d0c4');
    for (let k = 0; k <= 8; k++) {
      const z = -5.85 + k * (11.7 / 8);
      b.rod([x, TROLLEY_RAIL, z], [x, TROLLEY_RAIL + 0.55, z], 0.022, '#d6d0c4');
    }
  }
  // Salle des machines au bout sud, cabine du grutier côté terre.
  b.box([1.5, 1.0, 1.5], WHITE, [0, TROLLEY_RAIL + 0.5, -5.05]);
  b.box([1.62, 0.1, 1.62], '#99a2ad', [0, TROLLEY_RAIL + 1.05, -5.05]);
  b.box([0.5, 0.12, 0.9], STEEL, [-0.9, GIRDER_BOTTOM - 0.06, 2.7]);
  b.box([1.1, 1.0, 1.1], WHITE, [-1.25, GIRDER_BOTTOM - 0.62, 2.7]);
  b.box([1.2, 0.12, 1.2], RED, [-1.25, GIRDER_BOTTOM - 0.06, 2.7]);
  // Corps des projecteurs sous la poutre.
  for (const z of [-1.7, 1.7]) b.box([0.4, 0.22, 0.4], STEEL, [0, GIRDER_BOTTOM - 0.11, z]);
  // Bandes rouges et blanches aux extrémités (balisage).
  for (const z of [-5.75, 5.75]) b.box([1.32, 1.22, 0.24], RED, [0, GIRDER_BOTTOM + 0.6, z]);
  // Bollards au bord du quai.
  for (const z of [-2.4, 2.4]) {
    b.cylinder(0.13, 0.15, 0.36, 8, STEEL, [apron.to - CENTER_U - 0.35, 0.21, z]);
    b.cylinder(0.19, 0.19, 0.07, 8, STEEL, [apron.to - CENTER_U - 0.35, 0.42, z]);
  }
  // Cale de halage bétonnée, qui plonge dans l'eau.
  const { slip } = YARD;
  const run = slip.to - slip.from;
  const drop = slip.y0 - slip.y1;
  const slope = Math.atan2(drop, run);
  b.box([Math.hypot(run, drop), 0.08, slip.half * 2], '#bdb5a6', [slip.from - CENTER_U + run / 2, -drop / 2 + 0.03, 0], [0, 0, -slope]);
  return b.build();
}

/** Yacht en carénage sur son ber : œuvres vives rouges, liseré marine, superstructure blanche. */
function yachtGeometry() {
  const b = new Builder();
  const keelY = 0.62;
  addHull(b, {
    length: 7.4,
    beam: 2.3,
    depth: 1.6,
    sheer: 0.35,
    transom: 0.78,
    bands: [[0.4, '#c8412e'], [0.49, '#233a66'], [2, '#f5f2ea']],
    deck: '#c99b68',
    deckDrop: 0.03,
  }, [0.15, keelY, 0]);
  const deck = keelY + 1.6;
  b.box([4.1, 0.86, 1.95], '#f5f2ea', [-0.55, deck + 0.43, 0]);
  b.box([4.14, 0.3, 1.99], '#2a3442', [-0.55, deck + 0.5, 0]);
  b.box([2.4, 0.5, 1.6], '#f5f2ea', [-0.9, deck + 1.1, 0]);
  b.box([0.5, 0.36, 1.5], '#2a3442', [0.42, deck + 1.04, 0], [0, 0, -0.6]);
  b.box([2.1, 0.08, 1.75], '#f5f2ea', [-1.15, deck + 1.82, 0]);
  for (const [x, z] of [[-2.0, 0.75], [-2.0, -0.75], [-0.3, 0.75], [-0.3, -0.75]] as const) {
    b.rod([x, deck + 1.35, z], [x, deck + 1.8, z], 0.035, '#f5f2ea');
  }
  b.sphere(0.22, '#e9e6df', [-1.3, deck + 1.95, 0], [1, 0.55, 1]);
  b.rod([-1.9, deck + 1.86, 0], [-1.9, deck + 2.6, 0], 0.025, '#d6d0c4');
  // Rambarde de proue.
  for (const side of [-1, 1]) b.rod([1.5, deck + 0.42, side * 0.9], [3.4, deck + 0.6, side * 0.32], 0.025, '#d9dde2');
  // Ber : tins de bois sous la quille, béquilles d'acier contre la coque.
  for (const x of [-2.6, -1.1, 0.4, 1.9]) b.box([0.5, keelY, 0.55], '#8a5d3b', [x, keelY / 2, 0]);
  for (const x of [-1.8, 1.0]) {
    for (const side of [-1, 1]) b.beam([x, 0, side * 1.45], [x, 1.25, side * 1.02], 0.12, '#5d636b');
  }
  return b.build();
}

/** Soudeur en combinaison orange, casque blanc, chalumeau tendu vers la coque. */
function welderGeometry() {
  const b = new Builder();
  for (const z of [-0.09, 0.09]) b.box([0.13, 0.5, 0.13], '#2b3f6b', [0, 0.25, z]);
  b.box([0.24, 0.42, 0.34], '#ef7d32', [0, 0.71, 0]);
  b.sphere(0.12, '#e8b48a', [0, 1.02, 0]);
  b.sphere(0.135, '#f4f1ea', [0, 1.07, 0], [1, 0.62, 1], [10, 6]);
  b.box([0.07, 0.07, 0.2], '#1f2328', [0.1, 1.02, 0]);
  b.beam([0, 0.86, 0.12], [0.06, 0.82, 0.42], 0.08, '#ef7d32');
  b.beam([0.06, 0.82, 0.42], [0.05, 0.86, 0.6], 0.04, STEEL);
  return b.build();
}

/** Chariot du portique (rouge) : il porte le palan, ses câbles et le crochet. */
function trolleyGeometry() {
  const b = new Builder();
  b.box([1.9, 0.95, 1.7], RED, [0, 0.6, 0]);
  b.box([2.0, 0.1, 1.8], '#b03d28', [0, 1.12, 0]);
  b.box([0.55, 0.34, 0.55], WHITE, [0.45, 1.34, -0.35]);
  b.box([1.92, 0.12, 0.08], WHITE, [0, 0.5, 0.86]);
  b.box([1.92, 0.12, 0.08], WHITE, [0, 0.5, -0.86]);
  for (const x of [-0.42, 0.42]) for (const z of [-0.6, 0.6]) b.cylinder(0.11, 0.11, 0.1, 8, '#23262b', [x, 0.12, z], [0, 0, Math.PI / 2]);
  return b.build();
}

const HOOK_DROP = 5.6;

function hookGeometry() {
  const b = new Builder();
  for (const x of [-0.18, 0.18]) b.rod([x, 0, 0], [x * 0.7, -HOOK_DROP + 0.35, 0], 0.025, '#2a2d33', 4);
  b.box([0.62, 0.5, 0.42], '#f2c14e', [0, -HOOK_DROP + 0.1, 0]);
  b.box([0.64, 0.12, 0.44], '#2a2d33', [0, -HOOK_DROP + 0.05, 0]);
  b.cylinder(0.05, 0.05, 0.35, 6, '#2a2d33', [0, -HOOK_DROP - 0.3, 0]);
  // Crochet : arc de tore ouvert.
  b.add(new TorusGeometry(0.2, 0.05, 6, 12, Math.PI * 1.4), '#2a2d33', [0, -HOOK_DROP - 0.62, 0], [0, 0, -Math.PI * 0.2]);
  return b.build();
}

/* ------------------------------------------------------------------ lumières */

const beamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const beamFragment = /* glsl */ `
uniform float uStrength;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float along = smoothstep(0.0, 1.0, vUv.y);
  gl_FragColor = vec4(uColor * uStrength, along * along * 0.42 * uStrength);
  #include <colorspace_fragment>
}
`;

/** Uniforms d'un cône de lumière, à garder au niveau du module (mis à jour chaque image). */
export function coneUniforms(color: string) {
  return { uStrength: { value: 0 }, uColor: { value: new Color(color) } };
}

/** Cône de lumière additif (projecteur, faisceau) : invisible le jour. */
export function lightConeMaterial(uniforms: ReturnType<typeof coneUniforms>) {
  return new ShaderMaterial({
    uniforms,
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

const WARNING_POINTS: [number, number, number][] = [
  [0, TROLLEY_RAIL + 0.12, -5.95],
  [0, TROLLEY_RAIL + 0.12, 5.95],
  [0, TROLLEY_RAIL + 1.18, -5.05],
];

function WarningLights() {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const m = new Matrix4();
    WARNING_POINTS.forEach((point, index) => target.setMatrixAt(index, m.makeTranslation(point[0], point[1], point[2])));
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, []);
  useFrame((state) => {
    if (!material.current) return;
    const blink = Math.sin(state.clock.elapsedTime * 2.6) > 0.35 ? 1 : 0.12;
    material.current.emissiveIntensity = 0.35 + skyState.dayNight * 3.4 * blink;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, WARNING_POINTS.length]} raycast={() => null}>
      <sphereGeometry args={[0.13, 8, 6]} />
      <meshStandardMaterial ref={material} color="#ff4a3a" emissive="#ff2a1a" emissiveIntensity={0.35} roughness={0.4} />
    </instancedMesh>
  );
}

const FLOOD = coneUniforms('#ffe2b0');

function Floodlights() {
  const cones = useMemo(() => lightConeMaterial(FLOOD), []);
  const lens = useRef<MeshStandardMaterial>(null);
  useEffect(() => () => cones.dispose(), [cones]);
  useFrame(() => {
    const night = skyState.dayNight;
    FLOOD.uStrength.value = night * 0.75;
    if (lens.current) lens.current.emissiveIntensity = 0.2 + night * 3;
  });
  return (
    <>
      {[-1.7, 1.7].map((z) => (
        <group key={z} position={[0, GIRDER_BOTTOM - 0.23, z]}>
          <mesh rotation-x={Math.PI / 2} raycast={() => null}>
            <circleGeometry args={[0.16, 12]} />
            <meshStandardMaterial ref={z < 0 ? lens : undefined} color="#fff6e0" emissive="#ffe2b0" emissiveIntensity={0.2} side={DoubleSide} />
          </mesh>
          <mesh material={cones} position-y={-5.4} raycast={() => null}>
            <coneGeometry args={[2.3, 10.6, 18, 1, true]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ étincelles */

const SPARKS = 12;

function Sparks({ origin }: { origin: [number, number, number] }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const t = state.clock.elapsedTime;
    // Soudure par séquences : 2,6 s d'étincelles, 2 s de pause.
    const welding = (t % 4.6) < 2.6;
    for (let index = 0; index < SPARKS; index++) {
      const life = (t * 1.7 + index / SPARKS) % 1;
      const seed = Math.floor(t * 1.7 + index / SPARKS) * 13.1 + index * 7.7;
      const vx = (hash(seed) - 0.5) * 1.6;
      const vz = -0.4 - hash(seed + 1.3) * 0.9;
      const vy = 0.6 + hash(seed + 2.9) * 1.1;
      dummy.position.set(
        origin[0] + vx * life * 0.7,
        origin[1] + vy * life * 0.7 - 2.4 * life * life,
        origin[2] + vz * life * 0.7,
      );
      dummy.scale.setScalar(welding ? 0.05 * (1 - life) : 0);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPARKS]} frustumCulled={false} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#fff2b0" emissive="#ffb43a" emissiveIntensity={3.2} toneMapped={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ portique */

function Trolley() {
  const carriage = useRef<Group>(null);
  const pendulum = useRef<Group>(null);
  const reducedMotion = useWorld((state) => state.reducedMotion);
  const body = useMemo(() => trolleyGeometry(), []);
  const hook = useMemo(() => hookGeometry(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Cycle de 26 s : traversée lente, pause, retour, pause.
    const cycle = (t % 26) / 26;
    const leg = cycle < 0.5 ? cycle / 0.5 : (cycle - 0.5) / 0.5;
    const move = Math.min(1, leg / 0.62);
    const eased = move * move * (3 - 2 * move);
    const from = cycle < 0.5 ? -2.6 : 2.6;
    const to = -from;
    const z = reducedMotion ? 0.4 : from + (to - from) * eased;
    const speed = move < 1 ? 6 * move * (1 - move) * (to - from) / (0.62 * 13) : 0;
    if (carriage.current) carriage.current.position.z = z;
    if (pendulum.current) {
      pendulum.current.rotation.x = reducedMotion ? 0 : speed * 0.06 + Math.sin(t * 1.25) * 0.012;
      pendulum.current.rotation.z = reducedMotion ? 0 : Math.sin(t * 0.9 + 1.2) * 0.01;
    }
  });
  return (
    <group ref={carriage} position-y={TROLLEY_RAIL}>
      <Merged geometry={body} material={paintMaterial()} />
      <group ref={pendulum} position-y={GIRDER_BOTTOM - TROLLEY_RAIL}>
        <Merged geometry={hook} material={paintMaterial()} />
      </group>
    </group>
  );
}

const CABIN_WINDOWS: WindowSpec[] = [
  { seed: 41, at: [-1.81, GIRDER_BOTTOM - 0.6, 2.7], turn: -Math.PI / 2, width: 0.85, height: 0.5 },
  { seed: 43, at: [-1.25, GIRDER_BOTTOM - 0.6, 3.26], turn: 0, width: 0.85, height: 0.5 },
];

const YACHT_WINDOWS: WindowSpec[] = [
  { seed: 47, at: [-0.55, 2.22 + 0.5, 1.0], turn: 0, width: 3.8, height: 0.22 },
  { seed: 53, at: [-0.55, 2.22 + 0.5, -1.0], turn: Math.PI, width: 3.8, height: 0.22 },
];

export function Gantry() {
  const family = useSansFont();
  const structure = useMemo(() => structureGeometry(), []);
  const yacht = useMemo(() => yachtGeometry(), []);
  const welder = useMemo(() => welderGeometry(), []);
  const letters = useMemo(() => (family ? girderLettersTexture(site.current.place, family) : null), [family]);
  useEffect(() => () => letters?.dispose(), [letters]);
  const quality = useWorld((state) => state.quality);
  return (
    // Repère du chantier : x vers le large (u), z le long de la poutre (v), y depuis le quai.
    <group rotation-y={-Math.atan2(YARD.frame.az, YARD.frame.ax)}>
      <group position={[CENTER_U, YARD.apron.y, 0]}>
        <Merged geometry={structure} material={paintMaterial()} />
        <Trolley />
        <WarningLights />
        <Floodlights />
        <Windows specs={CABIN_WINDOWS} />
        {letters && (
          <>
            <mesh position={[-0.662, GIRDER_BOTTOM + 0.6, 0]} rotation-y={-Math.PI / 2} raycast={() => null}>
              <planeGeometry args={[7.2, 0.9]} />
              <meshStandardMaterial map={letters} roughness={0.8} />
            </mesh>
            <mesh position={[0.662, GIRDER_BOTTOM + 0.6, 0]} rotation-y={Math.PI / 2} raycast={() => null}>
              <planeGeometry args={[7.2, 0.9]} />
              <meshStandardMaterial map={letters} roughness={0.8} />
            </mesh>
          </>
        )}
        <group position={[0.15, 0.06, 0]}>
          <Merged geometry={yacht} material={flatMaterial()} />
          <Windows specs={YACHT_WINDOWS} lit="#ffe0a8" glass="#2a3442" />
        </group>
        <group position={[1.75, 0.06, -1.95]} rotation-y={Math.PI / 2 - 0.25}>
          <Merged geometry={welder} material={paintMaterial()} />
        </group>
        {quality !== 'low' && <Sparks origin={[1.85, 0.94, -1.38]} />}
      </group>
    </group>
  );
}
