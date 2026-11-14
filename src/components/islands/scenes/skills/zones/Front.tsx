'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  Euler,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Shape,
  Vector3,
} from 'three';
import { hash } from '@/lib/utils/math';
import { bump, easeInOut, easeOutBack, mix, span } from '../anim';
import { Merger, pose, type Vec3 } from '../geometry';
import { glowMaterial, labState, paintMaterial, screenMaterial, uiMaterial } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * ATELIER FRONT-END — un chevalet porte une fenêtre de navigateur. Les composants
 * d'interface (barre de navigation, bloc héros, cartes, bouton, interrupteur, curseur
 * de réglage) volent depuis l'établi et s'emboîtent dans la page, qui s'assemble ; un
 * gros pointeur de souris vient cliquer le bouton, basculer l'interrupteur, glisser le
 * curseur… puis tout se disperse et se remélange. Boucle de 12 s.
 */

const CYCLE = 12;
const WOOD = '#a8774a';
const WOOD_DARK = '#7d5534';

const BOARD_AT: Vec3 = [0, 0.36, -0.55];
const BOARD_TILT = -0.32;
const BOARD = pose(BOARD_AT, [BOARD_TILT, 0, 0]);
const BOARD_QUAT = new Quaternion().setFromEuler(new Euler(BOARD_TILT, 0, 0));
/** Face avant de la page, dans le repère du chevalet. */
const PAGE_Z = 0.012;
const DEPTH = 0.034;

interface PieceSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  lift?: number;
}

/** La page, dans l'ordre où elle s'assemble (repère du chevalet, en mètres). */
const PIECES: PieceSpec[] = [
  { x: 0, y: 1.27, w: 2.22, h: 0.11, color: '#34506e' },
  { x: -0.56, y: 1.03, w: 1.0, h: 0.25, color: 'accent' },
  { x: -0.63, y: 0.84, w: 0.86, h: 0.07, color: '#9fb0c4' },
  { x: 0.6, y: 0.93, w: 0.98, h: 0.44, color: '#ffd27a' },
  { x: -0.8, y: 0.6, w: 0.42, h: 0.14, color: '#ff7a59' },
  { x: 0.17, y: 0.6, w: 0.3, h: 0.13, color: '#c5cfdb' },
  { x: 0.09, y: 0.6, w: 0.11, h: 0.11, color: '#ffffff', lift: 0.022 },
  { x: 0.78, y: 0.6, w: 0.56, h: 0.04, color: '#c5cfdb' },
  { x: 0.54, y: 0.6, w: 0.09, h: 0.09, color: 'accent', lift: 0.022 },
  { x: -0.75, y: 0.27, w: 0.62, h: 0.38, color: '#ffffff' },
  { x: 0, y: 0.27, w: 0.62, h: 0.38, color: '#ffffff' },
  { x: 0.75, y: 0.27, w: 0.62, h: 0.38, color: '#ffffff' },
  { x: -0.75, y: 0.33, w: 0.5, h: 0.17, color: '#9be7c4', lift: 0.02 },
  { x: 0, y: 0.33, w: 0.5, h: 0.17, color: '#ff9fb8', lift: 0.02 },
  { x: 0.75, y: 0.33, w: 0.5, h: 0.17, color: '#b9a6ff', lift: 0.02 },
  { x: -0.75, y: 0.17, w: 0.42, h: 0.035, color: '#c9d1db', lift: 0.02 },
  { x: 0, y: 0.17, w: 0.42, h: 0.035, color: '#c9d1db', lift: 0.02 },
  { x: 0.75, y: 0.17, w: 0.42, h: 0.035, color: '#c9d1db', lift: 0.02 },
];

const BUTTON = 4;
const TOGGLE_TRACK = 5;
const TOGGLE_KNOB = 6;
const SLIDER_KNOB = 8;
const TOGGLE_ON = new Color('#7bd88f');
const WHITE = new Color('#ffffff');

/** Temps forts de la boucle. */
const CLICK_BUTTON = 4.3;
const CLICK_TOGGLE = 5.55;
const DRAG_START = 6.45;
const DRAG_END = 7.25;
const SCATTER = 8.6;

/* Objets de travail réutilisés à chaque image (aucune allocation dans la boucle). */
const dummy = new Object3D();
const slot = new Vector3();
const loose = new Vector3();
const looseQuat = new Quaternion();
const spin = new Euler();
const tint = new Color();
const cursorPoint = new Vector3();

/** Pose « en vrac » d'une pièce pour un cycle donné : chaque cycle remélange l'établi. */
function loosePose(cycle: number, index: number, time: number) {
  const key = cycle * 13.7 + index * 7.31;
  loose.set(-1.05 + hash(key) * 2.1, 0.6 + hash(key + 1.3) * 0.85, 0.1 + hash(key + 2.9) * 0.85);
  loose.y += Math.sin(time * 1.7 + index * 1.9) * 0.05;
  spin.set((hash(key + 4.1) - 0.5) * 0.9, (hash(key + 5.3) - 0.5) * 1.6 + Math.sin(time * 0.6 + index) * 0.15, (hash(key + 6.7) - 0.5) * 0.7);
  looseQuat.setFromEuler(spin);
}

/** Position de la pointe du curseur (repère du chevalet) à l'instant `t` du cycle. */
function cursorAt(t: number, out: Vector3) {
  const rest: Vec3 = [1.28, 1.42, 0.3];
  const button: Vec3 = [-0.74, 0.56, 0.14];
  const toggle: Vec3 = [0.13, 0.56, 0.14];
  const sliderStart: Vec3 = [0.56, 0.56, 0.14];
  const sliderEnd: Vec3 = [1.0, 0.56, 0.14];
  const lerpTo = (a: Vec3, b: Vec3, k: number) => out.set(mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k));
  if (t < 3.3) lerpTo(rest, rest, 0);
  else if (t < 4.05) lerpTo(rest, button, easeInOut(span(t, 3.3, 0.75)));
  else if (t < 4.7) lerpTo(button, button, 0);
  else if (t < 5.3) lerpTo(button, toggle, easeInOut(span(t, 4.7, 0.6)));
  else if (t < 5.85) lerpTo(toggle, toggle, 0);
  else if (t < 6.3) lerpTo(toggle, sliderStart, easeInOut(span(t, 5.85, 0.45)));
  else if (t < DRAG_START) lerpTo(sliderStart, sliderStart, 0);
  else if (t < DRAG_END) lerpTo(sliderStart, sliderEnd, easeInOut(span(t, DRAG_START, DRAG_END - DRAG_START)));
  else if (t < 7.45) lerpTo(sliderEnd, sliderEnd, 0);
  else lerpTo(sliderEnd, rest, easeInOut(span(t, 7.45, 0.9)));
  // Clics : la pointe plonge vers la page puis remonte.
  out.z -= (bump(t, CLICK_BUTTON - 0.12, 0.3) + bump(t, CLICK_TOGGLE - 0.12, 0.3)) * 0.09;
  if (t > 6.3 && t < 7.4) out.z -= 0.08 * span(t, 6.3, 0.12) * (1 - span(t, 7.3, 0.1));
  if (t < 3.3 || t > 8.35) out.y += Math.sin(t * 2.1) * 0.04;
  return out;
}

function brick(merger: Merger, color: string, at: Vec3, turn: number, columns: number, rows: number) {
  const width = columns * 0.1;
  const depth = rows * 0.1;
  merger.group(pose(at, [0, turn, 0]), () => {
    merger.box([width, 0.12, depth], color, [0, 0.06, 0]);
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        merger.cylinder(0.032, 0.032, 0.04, 8, color, [(column - (columns - 1) / 2) * 0.1, 0.14, (row - (rows - 1) / 2) * 0.1]);
      }
    }
  });
}

function buildStatic(accent: string) {
  const paint = new Merger();
  const glow = new Merger();
  const screen = new Merger();
  addPad(paint, glow, 2.1, accent);
  paint.group(BOARD, () => {
    // Cadre de la fenêtre, pieds du chevalet, tablette.
    paint.box([2.46, 1.74, 0.09], '#2e3a52', [0, 0.8, -0.045]);
    paint.box([0.07, 2.32, 0.06], WOOD, [-1.02, 0.76, -0.125]);
    paint.box([0.07, 2.32, 0.06], WOOD, [1.02, 0.76, -0.125]);
    paint.box([2.52, 0.05, 0.17], WOOD, [0, -0.03, 0.06]);
    paint.box([2.52, 0.07, 0.025], WOOD_DARK, [0, 0.0, 0.14]);
    paint.box([0.18, 0.12, 0.08], WOOD_DARK, [0, 1.74, -0.12]);
  });
  const top = new Vector3(0, 1.7, -0.13).applyMatrix4(BOARD);
  paint.rod([0, -0.04, -1.72], [top.x, top.y, top.z], 0.035, WOOD);
  screen.group(BOARD, () => {
    screen.box([2.36, 1.34, 0.01], '#f2ebdd', [0, 0.72, 0.006], undefined, 0);
    screen.box([2.36, 0.2, 0.012], '#dbe3ee', [0, 1.52, 0.007], undefined, 0);
    screen.box([1.3, 0.085, 0.01], '#ffffff', [0.22, 1.52, 0.016], undefined, 0);
  });
  glow.group(BOARD, () => {
    ['#ff6159', '#ffbd2e', '#28c941'].forEach((color, index) => {
      glow.cylinder(0.036, 0.036, 0.02, 10, color, [-1.04 + index * 0.1, 1.52, 0.02], [Math.PI / 2, 0, 0], 0);
    });
  });
  // Établi : des briques à tenons, les « composants » en attente.
  brick(paint, '#e2553f', [1.2, 0, 0.85], 0.25, 4, 2);
  brick(paint, '#ffc94a', [1.14, 0.12, 0.82], -0.35, 2, 2);
  brick(paint, '#4f8fe0', [1.48, 0, 0.42], 1.15, 4, 2);
  brick(paint, '#7bd88f', [0.92, 0, 1.25], 0.6, 2, 2);
  return { paint: paint.build(), glow: glow.build(), screen: screen.build() };
}

function pieceGeometry() {
  return new Merger().box([1, 1, 1], '#ffffff', [0, 0, 0], undefined, 0).build();
}

/** Pointeur de souris : flèche blanche cernée de sombre, la pointe à l'origine. */
function cursorGeometry() {
  const outline: [number, number][] = [
    [0, 0], [0, -0.62], [0.15, -0.48], [0.27, -0.73], [0.37, -0.68], [0.25, -0.44], [0.45, -0.44],
  ];
  const shape = (scale: number, grow: number) => {
    const path = new Shape();
    outline.forEach(([x, y], index) => {
      // Contour élargi depuis le centre de la flèche.
      const px = (0.17 + (x - 0.17) * grow) * scale;
      const py = (-0.4 + (y + 0.4) * grow) * scale;
      if (index === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
    return path;
  };
  const merger = new Merger();
  merger.add(new ExtrudeGeometry(shape(0.42, 1.2), { depth: 0.022, bevelEnabled: false }), '#1f2533', pose([0.012, 0.016, 0]), 0);
  merger.add(new ExtrudeGeometry(shape(0.42, 1), { depth: 0.022, bevelEnabled: false }), '#ffffff', pose([0, 0, 0.012]), 0);
  return merger.build();
}

export function FrontZone({ zone, spot }: ZoneProps) {
  const pieces = useRef<InstancedMesh>(null);
  const cursor = useRef<Group>(null);
  const ripple = useRef<Mesh>(null);
  const rippleMaterial = useRef<MeshBasicMaterial>(null);
  const built = useMemo(() => buildStatic(zone.accent), [zone.accent]);
  const piece = useMemo(() => pieceGeometry(), []);
  const arrow = useMemo(() => cursorGeometry(), []);
  const colors = useMemo(() => PIECES.map((spec) => new Color(spec.color === 'accent' ? zone.accent : spec.color)), [zone.accent]);

  // Première pose : les pièces attendent en vrac (et les couleurs d'instance existent
  // avant la première compilation du matériau).
  useLayoutEffect(() => {
    const mesh = pieces.current;
    if (!mesh) return;
    PIECES.forEach((spec, index) => {
      loosePose(0, index, 0);
      dummy.position.copy(loose);
      dummy.quaternion.copy(looseQuat);
      dummy.scale.set(spec.w * 0.72, spec.h * 0.72, DEPTH);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, colors[index]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colors]);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      built.screen.dispose();
      piece.dispose();
      arrow.dispose();
    },
    [arrow, built, piece],
  );

  useFrame((state) => {
    const mesh = pieces.current;
    if (!mesh || !labState.awake) return;
    const time = state.clock.elapsedTime;
    const cycle = Math.floor(time / CYCLE);
    const t = time - cycle * CYCLE;
    const toggled = span(t, CLICK_TOGGLE + 0.05, 0.25);
    const dragged = easeInOut(span(t, DRAG_START, DRAG_END - DRAG_START));

    for (let index = 0; index < PIECES.length; index++) {
      const spec = PIECES[index];
      // Emplacement dans la page (les boutons bougent quand on les actionne).
      let x = spec.x;
      let z = PAGE_Z + DEPTH / 2 + (spec.lift ?? 0);
      let depth = DEPTH;
      if (index === TOGGLE_KNOB) x += toggled * 0.16;
      if (index === SLIDER_KNOB) x += dragged * 0.44;
      if (index === BUTTON) {
        const press = bump(t, CLICK_BUTTON, 0.28);
        depth *= 1 - press * 0.6;
        z -= press * 0.01;
      }
      slot.set(x, spec.y, z).applyMatrix4(BOARD);

      const arrive = span(t, 0.2 + index * 0.13, 0.75);
      const leave = span(t, SCATTER + index * 0.06, 0.8);
      let amount: number;
      if (leave > 0) {
        loosePose(cycle + 1, index, time);
        amount = 1 - easeInOut(leave);
      } else {
        loosePose(cycle, index, time);
        amount = easeOutBack(arrive);
      }
      const flight = Math.sin(Math.min(Math.max(leave > 0 ? leave : arrive, 0), 1) * Math.PI);
      dummy.position.lerpVectors(loose, slot, amount);
      dummy.position.y += flight * 0.16;
      dummy.position.z += flight * 0.22;
      dummy.quaternion.slerpQuaternions(looseQuat, BOARD_QUAT, Math.min(Math.max(amount, 0), 1));
      const grow = mix(0.72, 1, Math.min(Math.max(amount, 0), 1));
      dummy.scale.set(spec.w * grow, spec.h * grow, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      // Couleur : éclair blanc à l'emboîtement, interrupteur qui passe au vert.
      tint.copy(colors[index]);
      if (index === TOGGLE_TRACK) tint.lerp(TOGGLE_ON, toggled * (1 - leave));
      if (index === BUTTON) tint.multiplyScalar(1 - bump(t, CLICK_BUTTON, 0.28) * 0.25);
      const landed = t - (0.2 + index * 0.13 + 0.75);
      if (landed > 0 && landed < 0.4 && leave === 0) tint.lerp(WHITE, (1 - landed / 0.4) * 0.65);
      mesh.setColorAt(index, tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Pointeur de souris et onde du clic.
    const pointer = cursor.current;
    if (pointer) {
      cursorAt(t, cursorPoint).applyMatrix4(BOARD);
      pointer.position.copy(cursorPoint);
    }
    const ring = ripple.current;
    const ringMaterial = rippleMaterial.current;
    if (ring && ringMaterial) {
      const sinceButton = t - CLICK_BUTTON;
      const sinceToggle = t - CLICK_TOGGLE;
      const since = sinceToggle > 0 ? sinceToggle : sinceButton;
      const active = since > 0 && since < 0.6;
      ring.visible = active;
      if (active) {
        const atToggle = sinceToggle > 0;
        cursorPoint.set(atToggle ? 0.17 + toggled * 0.08 : -0.8, 0.6, PAGE_Z + 0.06).applyMatrix4(BOARD);
        ring.position.copy(cursorPoint);
        ring.scale.setScalar(0.4 + since * 3.2);
        ringMaterial.opacity = (1 - since / 0.6) * 0.9;
      }
    }
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[-1.2, 1.32]}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.screen} material={screenMaterial} receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      <instancedMesh
        ref={pieces}
        args={[piece, uiMaterial, PIECES.length]}
        castShadow
        frustumCulled={false}
        raycast={noRaycast}
      />
      <group ref={cursor} rotation={[BOARD_TILT, 0, 0]}>
        <mesh geometry={arrow} material={uiMaterial} castShadow raycast={noRaycast} />
      </group>
      <mesh ref={ripple} rotation={[BOARD_TILT, 0, 0]} visible={false} raycast={noRaycast}>
        <torusGeometry args={[0.12, 0.014, 6, 28]} />
        <meshBasicMaterial ref={rippleMaterial} color="#ffffff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </ZoneShell>
  );
}
