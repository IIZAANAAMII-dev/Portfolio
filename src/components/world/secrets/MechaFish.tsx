'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { ripple } from '@/components/world/Flotsam';
import { Hotspot } from '@/components/islands/kit';
import { islets } from '@/data/islets';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { damp, hash, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { emitBubbles } from './Bubbles';
import { exposeForDebug } from './debug';
import { LAGOON_SPOT } from './layout';
import { springBoing } from './sfx';
import { at, inSight, merge, paintMaterial, piece, rockGeometry, sandbankGeometry } from './shared';

/**
 * Le poisson à remontoir : un poisson mécanique en laiton, clé dans le dos, qui fait des
 * huit dans une piscine de rochers adossée à l'îlot High-tech. Ses engrenages tournent,
 * sa clé avance cran par cran, ses yeux-hublots s'allument la nuit. Au clic, on le
 * « remonte » : tic-tac, la clé s'emballe, il bondit hors de l'eau et replonge.
 */

const POOL = 3.5;
const SWIM = 2.2;

/** Orientation de la piscine : l'îlot ferme le côté ouvert du croissant de rochers. */
const tech = islets.find((islet) => islet.id === 'tech');
const TOWARD_ISLET = tech ? Math.atan2(tech.position[1] - LAGOON_SPOT.z, tech.position[0] - LAGOON_SPOT.x) : 0;

/* --------------------------------------------------------------- poisson */

const BRASS = '#c99a3e';
const BRASS_DARK = '#9b6f2a';
const COPPER = '#c4683c';

/** Avant du corps (tête et ventre) : lentille de laiton à plaques rivetées. Avant = +X. */
function frontGeometry() {
  const body = new SphereGeometry(1, 14, 10).toNonIndexed();
  body.scale(0.62, 0.34, 0.21);
  body.translate(0.12, 0, 0);
  const position = body.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const x = (position.getX(vertex) + position.getX(vertex + 1) + position.getX(vertex + 2)) / 3;
    const y = (position.getY(vertex) + position.getY(vertex + 1) + position.getY(vertex + 2)) / 3;
    // Plaques alternées, ventre plus clair, liseré cuivré de l'opercule.
    const plate = Math.floor((x + 0.6) / 0.22) % 2;
    if (Math.abs(x - 0.42) < 0.04) color.set(COPPER);
    else if (y < -0.18) color.set('#e0c070');
    else color.set(plate === 0 ? BRASS : '#b8893a');
    color.multiplyScalar(0.94 + hash(vertex * 0.17) * 0.1);
    for (let corner = 0; corner < 3; corner++) color.toArray(colors, (vertex + corner) * 3);
  }
  body.deleteAttribute('uv');
  body.setAttribute('color', new BufferAttribute(colors, 3));
  body.computeVertexNormals();
  const parts: BufferGeometry[] = [body];
  // Rivets le long des jointures.
  for (let index = 0; index < 7; index++) {
    const x = -0.32 + index * 0.12;
    const k = 1 - Math.pow((x - 0.12) / 0.62, 2);
    const y = Math.sqrt(Math.max(k, 0)) * 0.34 * 0.55;
    const z = Math.sqrt(Math.max(k, 0)) * 0.21 * 0.83;
    for (const side of [1, -1]) parts.push(piece(new SphereGeometry(0.022, 5, 4), BRASS_DARK, at([x, y, side * z])));
  }
  // Bouche, nageoires pectorales et dorsale.
  parts.push(piece(new BoxGeometry(0.1, 0.02, 0.12), '#3a2a18', at([0.72, -0.04, 0])));
  for (const side of [1, -1]) {
    parts.push(piece(new BoxGeometry(0.26, 0.02, 0.18), COPPER, at([0.22, -0.12, side * 0.22], [side * 0.5, side * 0.4, -0.25])));
  }
  parts.push(piece(new ConeGeometry(0.16, 0.34, 3), COPPER, at([-0.22, 0.38, 0], [0, 0, 0.45], [1, 1, 0.2])));
  return merge(parts);
}

/** Queue articulée : cône effilé et nageoire caudale fourchue (pivot à l'origine). */
function tailGeometry() {
  return merge([
    piece(new ConeGeometry(0.24, 0.62, 10), BRASS, at([-0.29, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.75]), 0.06, 3),
    piece(new BoxGeometry(0.34, 0.03, 0.03), BRASS_DARK, at([-0.3, 0.11, 0.06], [0, 0, -0.2])),
    piece(new ConeGeometry(0.2, 0.42, 3), COPPER, at([-0.72, 0.17, 0], [0, 0, -2.3], [1, 1, 0.18])),
    piece(new ConeGeometry(0.2, 0.42, 3), COPPER, at([-0.72, -0.17, 0], [0, 0, -0.84], [1, 1, 0.18])),
  ]);
}

/** Clé de remontage : tige et anneau double (repère : base de la tige à l'origine). */
function keyGeometry() {
  const parts: BufferGeometry[] = [
    piece(new CylinderGeometry(0.035, 0.04, 0.32, 8), '#e6bb55', at([0, 0.16, 0])),
    piece(new CylinderGeometry(0.06, 0.06, 0.05, 8), '#c99a3e', at([0, 0.02, 0])),
    piece(new BoxGeometry(0.08, 0.1, 0.05), '#e6bb55', at([0, 0.36, 0])),
  ];
  for (const side of [1, -1]) {
    parts.push(piece(new TorusGeometry(0.13, 0.038, 6, 14), '#f0c75e', at([side * 0.15, 0.48, 0])));
  }
  return merge(parts);
}

/** Œil-hublot : couronne de laiton (le verre est à part, il s'allume la nuit). */
function eyeRingGeometry() {
  return merge([1, -1].map((side) => piece(new TorusGeometry(0.075, 0.022, 5, 12), BRASS_DARK, at([0.5, 0.07, side * 0.165]))));
}

function eyeGlassGeometry() {
  return merge([1, -1].flatMap((side) => [
    piece(new SphereGeometry(0.065, 8, 6), '#f4fbff', at([0.5, 0.07, side * 0.16], [0, 0, 0], [1, 1, 0.55])),
    piece(new SphereGeometry(0.03, 6, 4), '#101820', at([0.53, 0.075, side * 0.19], [0, 0, 0], [1, 1, 0.5])),
  ]));
}

/** Engrenage décoratif sur le flanc (axe Z). */
function gearGeometry() {
  const parts: BufferGeometry[] = [piece(new CylinderGeometry(0.1, 0.1, 0.03, 12), '#d8ac4a', at([0, 0, 0], [Math.PI / 2, 0, 0]))];
  for (let tooth = 0; tooth < 8; tooth++) {
    const angle = (tooth / 8) * Math.PI * 2;
    parts.push(piece(new BoxGeometry(0.05, 0.05, 0.03), '#d8ac4a', at([Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0], [0, 0, angle])));
  }
  parts.push(piece(new CylinderGeometry(0.03, 0.03, 0.04, 6), '#6b4a1c', at([0, 0, 0], [Math.PI / 2, 0, 0])));
  return merge(parts);
}

/* ---------------------------------------------------------------- piscine */

function lagoonFloor() {
  const parts: BufferGeometry[] = [];
  parts.push(sandbankGeometry({ rx: POOL + 0.6, rz: POOL + 0.6, top: -0.86, depth: 0.7, seed: 21 }));
  // Coraux branchus, algues, coquillages, et un engrenage perdu sur le sable.
  const corals = ['#ff8fa3', '#ffb067', '#b993ff', '#ff7b6b'];
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.4 + 0.6;
    const radius = 1.6 + hash(index * 3.9) * 1.7;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const color = corals[index % corals.length];
    for (let branch = 0; branch < 4; branch++) {
      const lean = (hash(index * 7.1 + branch) - 0.5) * 0.9;
      const height = 0.25 + hash(index + branch * 2.3) * 0.3;
      parts.push(piece(
        new CylinderGeometry(0.025, 0.045, height, 5).translate(0, height / 2, 0),
        color,
        at([x + (branch - 1.5) * 0.06, -0.9, z], [lean, branch * 1.6, lean * 0.6]),
        0.1,
        index * 4 + branch,
      ));
    }
  }
  for (let index = 0; index < 9; index++) {
    const angle = index * 1.37 + 0.2;
    const radius = 2.4 + hash(index * 5.1) * 1.2;
    const height = 0.5 + hash(index * 2.2) * 0.45;
    parts.push(piece(
      new ConeGeometry(0.06, height, 4).translate(0, height / 2, 0),
      index % 2 === 0 ? '#3f9b6b' : '#5bb37a',
      at([Math.cos(angle) * radius, -0.92, Math.sin(angle) * radius], [(hash(index) - 0.5) * 0.4, 0, (hash(index * 3) - 0.5) * 0.4]),
      0.08,
      index,
    ));
  }
  const lostGear = gearGeometry();
  lostGear.applyMatrix4(at([-0.8, -0.86, 1.3], [Math.PI / 2 - 0.1, 0, 0.3], 1.4));
  parts.push(lostGear);
  return merge(parts.map((part) => (part.index ? part.toNonIndexed() : part)));
}

const ROCK_COUNT = 10;

const brassMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.38,
  metalness: 0.2,
  emissive: '#5a3c0c',
  emissiveIntensity: 0.35,
  flatShading: true,
});
const eyeMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.2, emissive: '#5ef2ff', emissiveIntensity: 0 });

const _dummy = new Object3D();

/** Programme des tic-tac (identifiants de minuterie à annuler au démontage). */
const ticks: number[] = [];

function tickTock() {
  ticks.forEach((id) => window.clearTimeout(id));
  ticks.length = 0;
  for (let index = 0; index < 8; index++) {
    ticks.push(window.setTimeout(() => ambience.cue(index % 2 === 0 ? 2300 : 1700, 0.05), index * 190));
  }
}

export function MechaFish() {
  const root = useRef<Group>(null);
  const fish = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const key = useRef<Group>(null);
  const gears = useRef<Group>(null);
  const rocks = useRef<InstancedMesh>(null);
  const front = useMemo(() => frontGeometry(), []);
  const tailShape = useMemo(() => tailGeometry(), []);
  const keyShape = useMemo(() => keyGeometry(), []);
  const eyeRing = useMemo(() => eyeRingGeometry(), []);
  const eyeGlass = useMemo(() => eyeGlassGeometry(), []);
  const gear = useMemo(() => gearGeometry(), []);
  const floor = useMemo(() => lagoonFloor(), []);
  const rock = useMemo(() => rockGeometry(9, 1), []);
  const sim = useRef({ phase: 0, keyAngle: 0, keyTarget: 0, nextTick: 0, jumpAt: -100, pendingJump: false, splashed: true, wound: -100 });

  // Croissant de rochers du côté du large ; l'îlot ferme l'autre côté.
  useEffect(() => {
    const mesh = rocks.current;
    if (!mesh) return;
    const color = new Color();
    for (let index = 0; index < ROCK_COUNT; index++) {
      const k = index / (ROCK_COUNT - 1);
      const angle = TOWARD_ISLET + Math.PI * 0.42 + k * Math.PI * 1.16;
      const radius = POOL + 0.5 + hash(index * 2.3) * 0.5;
      const size = 0.7 + hash(index * 4.7) * 0.55;
      _dummy.position.set(Math.cos(angle) * radius, -0.55 + hash(index * 3.1) * 0.25, Math.sin(angle) * radius);
      _dummy.rotation.set(hash(index) * 0.5, index * 1.9, hash(index * 5.5) * 0.4);
      _dummy.scale.set(size * 1.25, size * (0.9 + hash(index * 6.1) * 0.5), size);
      _dummy.updateMatrix();
      mesh.setMatrixAt(index, _dummy.matrix);
      mesh.setColorAt(index, color.set(index % 3 === 1 ? '#8e96a5' : '#a9b1bf').multiplyScalar(0.88 + hash(index * 9.1) * 0.2));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => exposeForDebug('mechafish', sim.current), []);

  useEffect(() => () => {
    ticks.forEach((id) => window.clearTimeout(id));
    ticks.length = 0;
  }, []);

  const activate = () => {
    if (!root.current?.visible) return;
    sim.current.pendingJump = true;
    tickTock();
    window.setTimeout(() => springBoing(), 1450);
    logbook.stamp('mechafish');
  };

  useFrame((state, delta) => {
    const group = root.current;
    const body = fish.current;
    if (!group || !body) return;
    const visible = inSight(state.camera, LAGOON_SPOT.x, LAGOON_SPOT.z);
    group.visible = visible;
    if (!visible) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const s = sim.current;
    const reduced = useWorld.getState().reducedMotion;
    if (s.pendingJump) {
      s.pendingJump = false;
      s.wound = time;
      // Le saut part après le tic-tac (la clé est remontée).
      s.jumpAt = time + 1.5;
      s.splashed = false;
    }

    // Huit dans la piscine ; il accélère juste après avoir été remonté.
    const boost = 1 + smoothstep(0, 1.5, time - s.wound) * (1 - smoothstep(3, 7, time - s.wound)) * 1.2;
    s.phase += dt * 0.34 * boost;
    const u = s.phase;
    const lx = Math.sin(u) * SWIM;
    const lz = Math.sin(u) * Math.cos(u) * SWIM * 0.9;
    const tx = Math.cos(u) * SWIM;
    const tz = Math.cos(2 * u) * SWIM * 0.9;
    const heading = Math.atan2(tz, tx);
    const worldX = LAGOON_SPOT.x + lx;
    const worldZ = LAGOON_SPOT.z + lz;
    const wave = waveHeight(worldX, worldZ, time);

    // Saut : arc au-dessus de l'eau, nez qui suit la trajectoire, tonneau complet.
    const jump = time - s.jumpAt;
    let y = -0.13 + wave * 0.75 + Math.sin(time * 2.3) * 0.04;
    let pitch = Math.sin(time * 1.7) * 0.05;
    let roll = Math.sin(time * 1.3) * 0.06;
    if (jump >= 0 && jump < 1.25 && !reduced) {
      const k = jump / 1.25;
      y += Math.sin(k * Math.PI) * 2.1;
      pitch = Math.cos(k * Math.PI) * 0.9;
      roll = k * Math.PI * 2;
      if (k > 0.04 && k < 0.1 && s.splashed === false) {
        s.splashed = true;
        ripple(worldX, worldZ, time, 1.1);
        emitBubbles(worldX, -0.3, worldZ, 10, 0.6);
        ambience.splash(0.35);
      }
    } else if (jump >= 1.25 && jump < 1.4) {
      ripple(worldX, worldZ, time, 1.3);
      emitBubbles(worldX, -0.5, worldZ, 16, 0.8);
      s.jumpAt = -100;
    }
    body.position.set(lx, y, lz);
    body.rotation.set(roll, -heading + Math.sin(time * 7) * 0.06, pitch, 'YZX');

    // Queue qui godille, clé qui avance cran par cran (ou s'emballe une fois remontée).
    if (tail.current) tail.current.rotation.y = Math.sin(time * 7 * boost) * 0.42;
    if (key.current) {
      const wound = time - s.wound;
      if (wound >= 0 && wound < 2.6) s.keyTarget += dt * 14;
      else if (time > s.nextTick) {
        // Un cran toutes les 0,6 s : tic… tic…
        s.nextTick = time + 0.6;
        s.keyTarget += 0.5;
      }
      s.keyAngle = damp(s.keyAngle, s.keyTarget, 18, dt);
      key.current.rotation.y = s.keyAngle;
    }
    if (gears.current) {
      gears.current.children.forEach((child, index) => {
        child.rotation.z = time * (index === 0 ? 2.2 : -2.2) * boost;
      });
    }
    eyeMaterial.emissiveIntensity = 0.1 + skyState.dayNight * 1.6 + smoothstep(0, 0.3, time - s.wound) * (1 - smoothstep(2, 4, time - s.wound)) * 1.5;
  });

  return (
    <group ref={root} position={[LAGOON_SPOT.x, 0, LAGOON_SPOT.z]} visible={false}>
      <mesh geometry={floor} material={paintMaterial()} raycast={() => null} />
      <instancedMesh ref={rocks} args={[rock, undefined, ROCK_COUNT]} castShadow receiveShadow raycast={() => null}>
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      <group ref={fish}>
        <Hotspot onActivate={activate} hoverScale={1.08}>
          <mesh geometry={front} material={paintMaterial()} castShadow />
          <group ref={tail} position={[-0.42, 0, 0]}>
            <mesh geometry={tailShape} material={paintMaterial()} />
          </group>
          <mesh geometry={eyeRing} material={brassMaterial} raycast={() => null} />
          <mesh geometry={eyeGlass} material={eyeMaterial} raycast={() => null} />
          <group ref={gears}>
            <mesh geometry={gear} material={brassMaterial} position={[0.08, -0.02, 0.2]} raycast={() => null} />
            <mesh geometry={gear} material={brassMaterial} position={[0.08, -0.02, -0.2]} raycast={() => null} />
          </group>
          <group ref={key} position={[0.04, 0.3, 0]}>
            <mesh geometry={keyShape} material={brassMaterial} />
          </group>
          {/* Zone de clic : le dos et la clé qui dépassent de l'eau. */}
          <mesh visible={false} position={[0, 0.45, 0]}>
            <sphereGeometry args={[1.15, 8, 6]} />
          </mesh>
        </Hotspot>
      </group>
    </group>
  );
}
