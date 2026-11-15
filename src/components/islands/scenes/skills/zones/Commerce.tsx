'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { windowMaterial } from '@/lib/windows';
import { bump, easeInOut, mix, span } from '../anim';
import { Merger, pose, type Vec3 } from '../geometry';
import { glowMaterial, labState, paintMaterial, vivid } from '../materials';
import { addPad, noRaycast, ZoneShell, type ZoneProps } from '../Zone';

/**
 * QUAI E-COMMERCE — une petite grue de quai prend les colis sur la palette et les pose
 * sur un tapis roulant qui les avale dans l'entrepôt-boutique (auvent rayé). Au premier
 * plan, une carte vient se poser sur le terminal de paiement (éclair vert, onde sans
 * contact) et l'imprimante crache un ticket de commande qu'on arrache. Boucles
 * désynchronisées : grue 4,4 s, paiement 5 s, ticket 4,2 s.
 */

const WAREHOUSE: Vec3 = [-0.62, 0, -0.62];
/** Échelle de l'entrepôt-boutique (dessiné pour 1). */
const WS = 1.15;
const BELT_Z = -0.62;
const BELT_TOP = 0.46;
/** Échelle des colis (dessinés pour 1). */
const PS = 1.3;
const PARCEL_HALF = 0.11 * PS;
const CRANE: Vec3 = [1.25, 0, 0.02];
/** Hauteur de la flèche (zone du premier rang : haute, sans masquer le Centre Back-end). */
const JIB_Y = 2.65;
/** Hauteur du crochet pendant les déplacements de la flèche. */
const CARRY_Y = JIB_Y - 0.7;
const PALLET: Vec3 = [1.18, 0, 0.74];
const PALLET_W = 0.78;
const STACK = 0.19;
const LAYER = 0.1 + PARCEL_HALF;
const PICK: Vec3 = [PALLET[0] + STACK, LAYER + PARCEL_HALF * 2 - 0.02, PALLET[2] + STACK];
const DROP: Vec3 = [1.45, BELT_TOP + PARCEL_HALF + 0.01, BELT_Z];
const TERMINAL: Vec3 = [0.45, 0, 1.32];
/** Échelle du terminal de paiement et de l'imprimante. */
const TS = 1.35;
const TERM_Y = 0.78 * TS;
const PRINTER: Vec3 = [-0.36, 0, 1.0];
const PRS = 1.3;

const CRANE_CYCLE = 4.4;
const RELEASE = 1.5;
const BELT_SPEED = 0.42;
const BELT_PARCELS = 3;
const PAY_CYCLE = 5;
const PRINT_CYCLE = 4.2;
const PAPER_LENGTH = 0.4;

/** Angle de flèche (rotation Y de la tête de grue) et portée vers un point du sol. */
function aim(target: Vec3) {
  const dx = target[0] - CRANE[0];
  const dz = target[2] - CRANE[2];
  return { angle: Math.atan2(-dz, dx), reach: Math.hypot(dx, dz) };
}
const AIM_PICK = aim(PICK);
const AIM_DROP = aim(DROP);

/** Colis : carton, bande adhésive, étiquette. Centré à l'origine. */
function addParcel(merger: Merger, at: Vec3, turn = 0) {
  merger.group(pose(at, [0, turn, 0]), () => {
    merger.box([0.28 * PS, 0.22 * PS, 0.26 * PS], '#d48b4a', [0, 0, 0], undefined, 0.12);
    merger.box([0.284 * PS, 0.224 * PS, 0.07 * PS], '#f3dca4', [0, 0, 0], undefined, 0.12);
    merger.box([0.08 * PS, 0.004, 0.06 * PS], '#ffffff', [0.07 * PS, PARCEL_HALF + 0.002, 0.07 * PS], undefined, 0);
  });
}

function parcelGeometry() {
  const merger = new Merger();
  addParcel(merger, [0, 0, 0]);
  return merger.build();
}

function buildStatic(accent: string, pad: number) {
  const paint = new Merger();
  const glow = new Merger();
  addPad(paint, glow, pad, accent);

  // Entrepôt-boutique : murs crème, toit cintré en tôle verte, porte du tapis, auvent rayé.
  paint.group(pose(WAREHOUSE, [0, 0, 0], WS), () => {
    paint.box([1.4, 0.82, 1.1], '#f1e6cf', [0, 0.41, 0]);
    paint.add(
      new CylinderGeometry(0.58, 0.58, 1.5, 14, 1, false, 0, Math.PI),
      (point, normal, out) => {
        if (Math.abs(normal.x) > 0.9) out.set('#e9dcc0');
        else out.set(Math.sin(point.x * 34) > 0.2 ? '#36b25a' : '#27904a');
      },
      pose([0, 0.82, 0], [0, 0, Math.PI / 2]),
      0.05,
    );
    paint.box([0.03, 0.62, 0.64], '#3d4a3f', [0.705, 0.31, 0]);
    paint.box([0.035, 0.56, 0.56], '#1d2420', [0.712, 0.28, 0]);
    paint.box([0.04, 0.16, 0.6], '#b9bfc6', [0.715, 0.52, 0]);
    // Auvent rayé au-dessus de la vitrine.
    for (let index = 0; index < 6; index++) {
      paint.box([0.1, 0.02, 0.32], index % 2 ? '#ffffff' : vivid(accent, 0.85, 0.45), [-0.25 + index * 0.1, 0.72, 0.68], [0.5, 0, 0], 0.05);
    }
    paint.box([0.62, 0.04, 0.04], '#3d4a3f', [0, 0.65, 0.83]);
  });

  // Tapis roulant : pieds, rives, bande, rouleaux.
  const beltStart = 0.05;
  const beltEnd = 1.66;
  const beltMid = (beltStart + beltEnd) / 2;
  const beltLength = beltEnd - beltStart;
  for (const x of [0.3, 1.5]) {
    for (const side of [-0.22, 0.22]) paint.box([0.05, BELT_TOP - 0.02, 0.05], '#7d8794', [x, (BELT_TOP - 0.02) / 2, BELT_Z + side]);
  }
  for (const side of [-0.27, 0.27]) paint.box([beltLength, 0.07, 0.04], '#9aa3ae', [beltMid, BELT_TOP - 0.01, BELT_Z + side]);
  paint.box([beltLength, 0.04, 0.5], '#2d3036', [beltMid, BELT_TOP - 0.02, BELT_Z], undefined, 0.05);
  paint.cylinder(0.05, 0.05, 0.5, 10, '#b8c0ca', [beltEnd, BELT_TOP - 0.02, BELT_Z], [Math.PI / 2, 0, 0], 0);
  // Chevrons peints sur la bande : le sens du tapis.
  for (let index = 0; index < 5; index++) {
    paint.box([0.03, 0.004, 0.16], '#ffd23f', [0.3 + index * 0.3, BELT_TOP + 0.001, BELT_Z - 0.06], [0, -0.6, 0], 0);
    paint.box([0.03, 0.004, 0.16], '#ffd23f', [0.3 + index * 0.3, BELT_TOP + 0.001, BELT_Z + 0.06], [0, 0.6, 0], 0);
  }

  // Grue de quai : semelle, fût, et (animée à part) la tête.
  paint.box([0.36, 0.08, 0.36], '#5b6472', [CRANE[0], 0.04, CRANE[2]]);
  paint.box([0.18, JIB_Y - 0.08, 0.18], '#e8412c', [CRANE[0], (JIB_Y - 0.08) / 2 + 0.08, CRANE[2]]);
  // Croisillons du treillis, sur la face avant et sur le flanc.
  for (let index = 0; index < 7; index++) {
    const y = 0.28 + index * 0.31;
    paint.box([0.19, 0.016, 0.016], '#a92f22', [CRANE[0], y, CRANE[2] + 0.093], [0, 0, index % 2 ? 0.6 : -0.6], 0);
    paint.box([0.016, 0.016, 0.19], '#a92f22', [CRANE[0] + 0.093, y, CRANE[2]], [index % 2 ? 0.6 : -0.6, 0, 0], 0);
  }
  // Cabine du grutier, sous la flèche.
  paint.box([0.32, 0.26, 0.3], '#ffc21a', [CRANE[0] + 0.2, JIB_Y - 0.42, CRANE[2]]);
  glow.box([0.012, 0.12, 0.22], '#ffe9a8', [CRANE[0] + 0.362, JIB_Y - 0.4, CRANE[2]], undefined, 0);

  // Palette et sa pile de colis (la place avant droite attend le prochain).
  paint.box([PALLET_W, 0.06, PALLET_W], '#b07a48', [PALLET[0], 0.075, PALLET[2]]);
  for (const side of [-0.32, 0, 0.32]) paint.box([PALLET_W, 0.05, 0.09], '#8c5d36', [PALLET[0], 0.025, PALLET[2] + side]);
  for (const [dx, dz] of [[-STACK, -STACK], [STACK, -STACK], [-STACK, STACK], [STACK, STACK]]) addParcel(paint, [PALLET[0] + dx, LAYER, PALLET[2] + dz]);
  addParcel(paint, [PALLET[0] - STACK, LAYER + PARCEL_HALF * 2, PALLET[2] - STACK], 0.1);

  // Terminal de paiement.
  paint.group(pose(TERMINAL, [0, 0, 0], TS), () => {
    paint.cylinder(0.14, 0.15, 0.04, 14, '#5b6472', [0, 0.02, 0]);
    paint.cylinder(0.035, 0.035, 0.72, 8, '#5b6472', [0, 0.39, 0]);
    paint.group(pose([0, 0.78, 0], [-0.75, 0, 0]), () => {
      paint.box([0.2, 0.31, 0.06], '#2f343d', [0, 0.1, 0]);
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) paint.box([0.035, 0.025, 0.012], '#cfd5dd', [(column - 1) * 0.05, 0.045 - row * 0.04, 0.032], undefined, 0);
      }
    });
  });
  glow.group(pose([TERMINAL[0], TERM_Y, TERMINAL[2]], [-0.75, 0, 0], TS), () => {
    glow.box([0.15, 0.09, 0.006], '#2fb7a0', [0, 0.18, 0.031], undefined, 0);
  });

  // Imprimante à tickets sur son guéridon.
  paint.group(pose(PRINTER, [0, 0, 0], PRS), () => {
    for (const [dx, dz] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) paint.box([0.03, 0.48, 0.03], '#6e4a33', [dx, 0.24, dz]);
    paint.box([0.36, 0.03, 0.28], '#8a5d3b', [0, 0.495, 0]);
    paint.box([0.3, 0.15, 0.24], '#ece6db', [0, 0.585, 0]);
    paint.box([0.18, 0.012, 0.035], '#2a2d33', [0, 0.662, -0.03], undefined, 0);
  });
  glow.box([0.025 * PRS, 0.012, 0.025 * PRS], '#7bd88f', [PRINTER[0] + 0.1 * PRS, 0.663 * PRS, PRINTER[2] + 0.07 * PRS], undefined, 0);

  // Petits produits et sac de course devant la boutique.
  paint.box([0.24, 0.24, 0.24], '#ff3d8b', [-1.4, 0.12, 0.42], [0, 0.3, 0]);
  paint.box([0.21, 0.21, 0.21], '#1fa9ff', [-1.1, 0.105, 0.6], [0, -0.2, 0]);
  paint.box([0.2, 0.2, 0.2], '#ffc21a', [-1.36, 0.34, 0.44], [0, 0.9, 0]);
  paint.box([0.29, 0.34, 0.16], vivid(accent, 0.9, 0.48), [-0.86, 0.17, 0.42], [0, 0.4, 0]);
  paint.torus(0.072, 0.016, '#1f6b3a', [-0.86, 0.35, 0.42], [0, 0.4, 0], Math.PI, [4, 10]);
  return { paint: paint.build(), glow: glow.build() };
}

/** Tête de grue (repère : pied du fût ; la flèche pointe vers +X). */
function craneHeadGeometry() {
  const merger = new Merger();
  merger.box([1.32, 0.1, 0.11], '#e8412c', [0.46, 0, 0]);
  merger.box([0.27, 0.22, 0.25], '#ffc21a', [0, 0.08, 0]);
  merger.box([0.32, 0.22, 0.22], '#5b6472', [-0.34, -0.02, 0]);
  // Mâture en A au-dessus du pivot, haubans vers la pointe et le contrepoids.
  merger.rod([0, 0.18, 0], [0, 0.52, 0], 0.03, '#e8412c', 6);
  merger.rod([0, 0.52, 0], [1.08, 0.04, 0], 0.014, '#9aa3ae');
  merger.rod([0, 0.52, 0], [-0.36, 0.09, 0], 0.014, '#9aa3ae');
  merger.sphere(0.035, '#ff5a3c', [0, 0.55, 0], 1, [6, 4], 0);
  return merger.build();
}

function receiptTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbf8f0';
  ctx.fillRect(0, 0, 64, 192);
  ctx.fillStyle = '#9aa0a8';
  // Lignes neutres (aucun texte) : un ticket stylisé.
  for (let row = 0; row < 11; row++) {
    const width = 18 + ((row * 37) % 26);
    ctx.fillRect(8, 14 + row * 12, width, 4);
    ctx.fillRect(48, 14 + row * 12, 8, 4);
  }
  ctx.fillStyle = '#4b5059';
  ctx.fillRect(8, 158, 48, 3);
  ctx.fillRect(8, 168, 30, 6);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function checkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#39d98a';
  ctx.fillRect(0, 0, 96, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(30, 33);
  ctx.lineTo(43, 46);
  ctx.lineTo(68, 18);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const dummy = new Object3D();

export function CommerceZone({ zone, spot }: ZoneProps) {
  const parcels = useRef<InstancedMesh>(null);
  const head = useRef<Group>(null);
  const cable = useRef<Mesh>(null);
  const hook = useRef<Group>(null);
  const carried = useRef<Mesh>(null);
  const card = useRef<Group>(null);
  const check = useRef<MeshBasicMaterial>(null);
  const wave = useRef<Mesh>(null);
  const waveMaterial = useRef<MeshBasicMaterial>(null);
  const paper = useRef<Mesh>(null);
  const paperMaterial = useRef<MeshBasicMaterial>(null);
  const printer = useRef<Group>(null);

  const built = useMemo(() => buildStatic(zone.accent, spot.pad), [spot.pad, zone.accent]);
  const parcel = useMemo(() => parcelGeometry(), []);
  const craneHead = useMemo(() => craneHeadGeometry(), []);
  const receipt = useMemo(() => receiptTexture(), []);
  const approved = useMemo(() => checkTexture(), []);
  const sheet = useMemo(() => new PlaneGeometry(0.15, 1).translate(0, 0.5, 0), []);
  const shopWindow = useMemo(() => windowMaterial(91, '#ffd9a0', '#3e5a62'), []);

  useEffect(
    () => () => {
      built.paint.dispose();
      built.glow.dispose();
      parcel.dispose();
      craneHead.dispose();
      receipt.dispose();
      approved.dispose();
      sheet.dispose();
    },
    [approved, built, craneHead, parcel, receipt, sheet],
  );

  useLayoutEffect(() => {
    const mesh = parcels.current;
    if (!mesh) return;
    dummy.position.set(0, -10, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let index = 0; index < BELT_PARCELS; index++) mesh.setMatrixAt(index, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state) => {
    if (!labState.awake) return;
    const time = state.clock.elapsedTime;

    // --- Grue : prise sur la palette, pose sur le tapis, retour.
    const c = time % CRANE_CYCLE;
    let swing: number;
    let drop: number;
    let loaded: boolean;
    if (c < 1.0) {
      swing = easeInOut(span(c, 0, 1.0));
      drop = 0;
      loaded = true;
    } else if (c < RELEASE) {
      swing = 1;
      drop = easeInOut(span(c, 1.0, 0.5));
      loaded = true;
    } else if (c < 1.9) {
      swing = 1;
      drop = 1 - easeInOut(span(c, RELEASE, 0.4));
      loaded = false;
    } else if (c < 2.9) {
      swing = 1 - easeInOut(span(c, 1.9, 1.0));
      drop = 0;
      loaded = false;
    } else if (c < 3.4) {
      swing = 0;
      drop = easeInOut(span(c, 2.9, 0.5));
      loaded = false;
    } else if (c < 3.65) {
      swing = 0;
      drop = 1;
      loaded = true;
    } else {
      swing = 0;
      drop = 1 - easeInOut(span(c, 3.65, 0.4));
      loaded = true;
    }
    const angle = mix(AIM_PICK.angle, AIM_DROP.angle, swing);
    const reach = mix(AIM_PICK.reach, AIM_DROP.reach, swing);
    const low = mix(PICK[1], DROP[1], swing) + PARCEL_HALF + 0.04;
    const hookY = mix(CARRY_Y, low, drop);
    if (head.current) head.current.rotation.y = angle;
    if (hook.current) {
      // Le crochet pend sous le chariot, avec un léger balancement après chaque arrêt.
      const sway = Math.sin(time * 3.1) * 0.025 * (1 - drop);
      hook.current.position.set(reach + sway, hookY - JIB_Y, 0);
    }
    if (cable.current) {
      cable.current.position.set(reach, (hookY - JIB_Y) / 2, 0);
      cable.current.scale.set(1, JIB_Y - hookY, 1);
    }
    if (carried.current) {
      carried.current.visible = loaded;
      carried.current.scale.setScalar(c >= 3.4 && c < 3.65 ? span(c, 3.4, 0.2) : 1);
    }

    // --- Tapis : chaque colis posé file vers l'entrepôt.
    const mesh = parcels.current;
    if (mesh) {
      const lastDrop = Math.floor((time - RELEASE) / CRANE_CYCLE);
      for (let slotIndex = 0; slotIndex < BELT_PARCELS; slotIndex++) {
        const k = lastDrop - slotIndex;
        const since = time - (k * CRANE_CYCLE + RELEASE);
        const x = DROP[0] - since * BELT_SPEED;
        const alive = k >= 0 && since >= 0 && x > 0.05;
        dummy.position.set(alive ? x : 0, alive ? DROP[1] : -10, BELT_Z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(alive ? 1 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(((k % BELT_PARCELS) + BELT_PARCELS) % BELT_PARCELS, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // --- Paiement sans contact : la carte se pose, l'écran valide, une onde part.
    const p = (time + 1.3) % PAY_CYCLE;
    const tap = easeInOut(span(p, 2.4, 0.35)) * (1 - easeInOut(span(p, 3.0, 0.45)));
    if (card.current) {
      card.current.position.set(0, 0.17, mix(0.26, 0.055, tap));
      card.current.rotation.z = Math.sin(time * 1.3) * 0.08 * (1 - tap);
    }
    const flash = bump(p, 2.72, 1.1);
    if (check.current) check.current.opacity = Math.min(1, flash * 1.6);
    if (wave.current && waveMaterial.current) {
      const since = p - 2.75;
      const active = since > 0 && since < 0.7;
      wave.current.visible = active;
      if (active) {
        wave.current.scale.setScalar(1 + since * 4);
        waveMaterial.current.opacity = (1 - since / 0.7) * 0.85;
      }
    }

    // --- Ticket : impression ligne à ligne, puis on l'arrache.
    const q = time % PRINT_CYCLE;
    const printed = span(q, 0.3, 2.4);
    const tear = span(q, 3.2, 0.5);
    if (paper.current && paperMaterial.current) {
      const length = Math.max(0.001, printed * PAPER_LENGTH);
      paper.current.scale.set(1, length, 1);
      paper.current.position.y = 0.665 + tear * 0.18;
      paper.current.rotation.x = -0.18 - tear * 0.5;
      paperMaterial.current.opacity = 1 - tear;
      const map = paperMaterial.current.map;
      if (map) {
        map.repeat.set(1, Math.max(0.01, printed));
        map.offset.set(0, 1 - Math.max(0.01, printed));
      }
    }
    if (printer.current) printer.current.position.y = printed > 0 && printed < 1 ? Math.sin(time * 60) * 0.004 : 0;
  });

  return (
    <ZoneShell zone={zone} spot={spot} sign={[-1.25, 1.36]} reach={3.4}>
      <mesh geometry={built.paint} material={paintMaterial} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={built.glow} material={glowMaterial} raycast={noRaycast} />
      {/* Vitrine de la boutique : s'allume au crépuscule. */}
      <mesh material={shopWindow} position={[WAREHOUSE[0], 0.47 * WS, WAREHOUSE[2] + 0.553 * WS]} scale={WS} raycast={noRaycast}>
        <planeGeometry args={[0.52, 0.26]} />
      </mesh>
      <instancedMesh ref={parcels} args={[parcel, paintMaterial, BELT_PARCELS]} castShadow frustumCulled={false} raycast={noRaycast} />

      <group ref={head} position={[CRANE[0], JIB_Y, CRANE[2]]}>
        <mesh geometry={craneHead} material={paintMaterial} castShadow raycast={noRaycast} />
        <mesh ref={cable} raycast={noRaycast}>
          <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
          <meshStandardMaterial color="#2a2d33" roughness={0.6} />
        </mesh>
        <group ref={hook}>
          <mesh position-y={0.03} raycast={noRaycast}>
            <boxGeometry args={[0.12, 0.08, 0.12]} />
            <meshStandardMaterial color="#ffc21a" roughness={0.6} />
          </mesh>
          <mesh ref={carried} geometry={parcel} material={paintMaterial} position-y={-PARCEL_HALF - 0.01} raycast={noRaycast} />
        </group>
      </group>

      {/* Carte bancaire et validation sur le terminal (repère incliné de l'écran). */}
      <group position={[TERMINAL[0], TERM_Y, TERMINAL[2]]} rotation={[-0.75, 0, 0]} scale={TS}>
        <group ref={card}>
          <mesh raycast={noRaycast}>
            <boxGeometry args={[0.17, 0.11, 0.008]} />
            <meshStandardMaterial color="#6c63ff" roughness={0.45} />
          </mesh>
          <mesh position={[-0.04, 0.012, 0.005]} raycast={noRaycast}>
            <boxGeometry args={[0.035, 0.028, 0.004]} />
            <meshStandardMaterial color="#e9c46a" roughness={0.35} metalness={0.4} />
          </mesh>
        </group>
        <mesh position={[0, 0.18, 0.036]} raycast={noRaycast}>
          <planeGeometry args={[0.15, 0.09]} />
          <meshBasicMaterial ref={check} map={approved} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={wave} position={[0, 0.18, 0.05]} visible={false} raycast={noRaycast}>
          <torusGeometry args={[0.07, 0.008, 4, 24]} />
          <meshBasicMaterial ref={waveMaterial} color="#7bf0b4" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      <group ref={printer} position={[PRINTER[0], 0, PRINTER[2]]} scale={PRS}>
        <mesh ref={paper} geometry={sheet} position={[0, 0.665, -0.03]} raycast={noRaycast}>
          <meshBasicMaterial ref={paperMaterial} map={receipt} transparent side={DoubleSide} />
        </mesh>
      </group>
    </ZoneShell>
  );
}
