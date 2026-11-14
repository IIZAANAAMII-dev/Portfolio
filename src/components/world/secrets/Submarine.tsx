'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { ripple } from '@/components/world/Flotsam';
import { Hotspot } from '@/components/islands/kit';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { damp, hash, shortestAngle, smoothstep } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { emitBubbles } from './Bubbles';
import { exposeForDebug } from './debug';
import { SUBMARINE_LOOP } from './layout';
import { bloops, diveKlaxon } from './sfx';
import { at, inSight, merge, paintMaterial, piece } from './shared';

/**
 * Le mini sous-marin jaune : la plupart du temps, seul son périscope dépasse et file en
 * boucle entre l'îlot de départ, Projets et Expériences, en laissant de petits ronds dans
 * l'eau. De temps en temps il fait surface dans un bouillon de bulles, regarde autour de
 * lui, puis replonge. Le périscope se tourne vers le bateau quand il passe près. Au clic :
 * klaxon de plongée, gerbe de bulles, et il file au fond.
 */

const LENGTH = 4.2;
const RADIUS = 0.72;
/** Profondeur du centre de la coque selon l'état. */
const DEPTH_CRUISE = -1.5;
const DEPTH_SURFACE = -0.18;
const DEPTH_DIVE = -3.3;
const SPEED = 1.5;

/** Coque : profil tourné (nez rond, corps cylindrique, queue effilée), couché le long de +X. */
function hullGeometry() {
  const profile: [number, number][] = [
    [0, -LENGTH / 2], [0.22, -LENGTH / 2 + 0.06], [0.42, -LENGTH / 2 + 0.38], [0.6, -LENGTH / 2 + 0.95],
    [RADIUS, -0.6], [RADIUS, 0.7], [0.68, 1.25], [0.55, 1.65], [0.32, 1.95], [0, LENGTH / 2],
  ];
  const lathe = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 18);
  // Axe du tour (Y) couché sur +X : le nez (y max) devient l'avant.
  lathe.rotateZ(-Math.PI / 2);
  const flat = lathe.toNonIndexed();
  lathe.dispose();
  const position = flat.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const yellow = new Color('#ffc02e');
  const orange = new Color('#f2852b');
  const stripe = new Color('#d9452f');
  const color = new Color();
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    const y = (position.getY(vertex) + position.getY(vertex + 1) + position.getY(vertex + 2)) / 3;
    const x = (position.getX(vertex) + position.getX(vertex + 1) + position.getX(vertex + 2)) / 3;
    // Dessus jaune, ventre orangé, liseré rouge à la ligne de flottaison et nez rouge.
    if (x > LENGTH / 2 - 0.3) color.copy(stripe);
    else if (Math.abs(y + 0.12) < 0.07) color.copy(stripe);
    else color.copy(y > -0.12 ? yellow : orange);
    color.multiplyScalar(0.95 + hash(vertex * 0.31) * 0.08);
    for (let corner = 0; corner < 3; corner++) color.toArray(colors, (vertex + corner) * 3);
  }
  flat.deleteAttribute('uv');
  flat.setAttribute('color', new Float32BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  return flat;
}

/** Kiosque, gouvernails, ailerons de plongée, hublot de nez : fusionnés. */
function fittings() {
  const parts: BufferGeometry[] = [
    // Kiosque ovale et sa couronne rouge.
    piece(new CylinderGeometry(0.42, 0.48, 0.72, 12), '#ffc02e', at([0.35, RADIUS + 0.28, 0], [0, 0, 0], [1.25, 1, 0.75]), 0.04, 1),
    piece(new CylinderGeometry(0.44, 0.44, 0.08, 12), '#d9452f', at([0.35, RADIUS + 0.66, 0], [0, 0, 0], [1.25, 1, 0.75])),
    piece(new CylinderGeometry(0.2, 0.2, 0.06, 10), '#3b4650', at([0.18, RADIUS + 0.71, 0])),
    // Ailerons de plongée avant et barres arrière.
    piece(new BoxGeometry(0.42, 0.04, 1.9), '#d9452f', at([1.15, -0.05, 0])),
    piece(new BoxGeometry(0.5, 0.04, 1.7), '#d9452f', at([-1.6, 0, 0])),
    piece(new BoxGeometry(0.55, 1.15, 0.04), '#d9452f', at([-1.7, 0.05, 0])),
    // Garde du périscope.
    piece(new CylinderGeometry(0.09, 0.11, 0.18, 8), '#9aa4ab', at([0.52, RADIUS + 0.77, 0])),
  ];
  return merge(parts);
}

/** Périscope : tube, tête coudée, lentille sombre (repère du tube, base à l'origine). */
function periscopeGeometry() {
  return merge([
    piece(new CylinderGeometry(0.055, 0.065, 1.5, 8), '#a5aeb5', at([0, 0.75, 0]), 0.05, 2),
    piece(new BoxGeometry(0.3, 0.15, 0.14), '#ffc02e', at([0.06, 1.55, 0])),
    piece(new CylinderGeometry(0.055, 0.055, 0.04, 8), '#1b2a33', at([0.22, 1.55, 0], [0, 0, Math.PI / 2])),
    piece(new CylinderGeometry(0.075, 0.075, 0.05, 8), '#d9452f', at([0, 1.47, 0])),
  ]);
}

/** Hélice tripale (axe X). */
function propellerGeometry() {
  const parts: BufferGeometry[] = [piece(new ConeGeometry(0.1, 0.22, 8), '#9aa4ab', at([0, 0, 0], [0, 0, Math.PI / 2]))];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI * 2;
    parts.push(piece(new BoxGeometry(0.05, 0.42, 0.13), '#c7a24a', at([0, Math.cos(angle) * 0.22, Math.sin(angle) * 0.22], [angle, 0, 0.35])));
  }
  return merge(parts);
}

// Laiton des hublots ; verre qui s'allume la nuit (quelqu'un est à bord).
const ringMaterial = new MeshStandardMaterial({ color: '#d7a44a', roughness: 0.4, metalness: 0.2, emissive: '#3d2a0a', emissiveIntensity: 0.3, flatShading: true });
const glassMaterial = new MeshStandardMaterial({ color: '#9fe0f0', roughness: 0.15, emissive: '#ffcf7a', emissiveIntensity: 0.15 });

const PORTHOLES: [number, number][] = [[0.95, 1], [0.15, 1], [-0.65, 1], [0.95, -1], [0.15, -1], [-0.65, -1]];

const _dummy = new Object3D();

type Mode = 'cruise' | 'surface' | 'dive';

export function Submarine() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const periscope = useRef<Group>(null);
  const propeller = useRef<Group>(null);
  const rings = useRef<InstancedMesh>(null);
  const glass = useRef<InstancedMesh>(null);
  const hull = useMemo(() => hullGeometry(), []);
  const parts = useMemo(() => fittings(), []);
  const scope = useMemo(() => periscopeGeometry(), []);
  const prop = useMemo(() => propellerGeometry(), []);
  const ring = useMemo(() => new TorusGeometry(0.15, 0.04, 6, 14), []);
  const pane = useMemo(() => new SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const sim = useRef({
    angle: hash(3) * Math.PI * 2,
    mode: 'cruise' as Mode,
    since: 0,
    depth: DEPTH_CRUISE,
    nextSurface: 22,
    look: 0,
    lastRipple: 0,
    pendingDive: false,
    lastBubbles: 0,
    ready: false,
    /** Débogage : fige la boucle (captures d'écran). */
    paused: false,
  });

  useEffect(() => exposeForDebug('submarine', sim.current), []);

  const activate = () => {
    if (!root.current?.visible) return;
    sim.current.pendingDive = true;
    diveKlaxon();
    ambience.splash(0.5);
    window.setTimeout(() => bloops(5), 450);
    logbook.stamp('submarine');
  };

  useFrame((state, delta) => {
    const group = root.current;
    const hullGroup = body.current;
    if (!group || !hullGroup) return;
    const visible = inSight(state.camera, SUBMARINE_LOOP.x, SUBMARINE_LOOP.z, 165);
    group.visible = visible;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const s = sim.current;
    // La boucle avance même hors de vue (une addition par image) : il n'est jamais où on l'a laissé.
    const loop = Math.PI * (SUBMARINE_LOOP.rx + SUBMARINE_LOOP.rz);
    if (!s.paused) s.angle += (SPEED / loop) * Math.PI * 2 * dt;
    if (!visible) return;

    // Hublots : placés une fois (les maillages instanciés sont prêts au premier rendu).
    if (!s.ready && rings.current && glass.current) {
      s.ready = true;
      PORTHOLES.forEach(([x, side], index) => {
        _dummy.position.set(x, 0.12, side * (RADIUS - 0.02));
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        rings.current!.setMatrixAt(index, _dummy.matrix);
        _dummy.position.set(x, 0.12, side * (RADIUS - 0.04));
        _dummy.rotation.set(side * (Math.PI / 2), 0, 0);
        _dummy.updateMatrix();
        glass.current!.setMatrixAt(index, _dummy.matrix);
      });
      rings.current.instanceMatrix.needsUpdate = true;
      glass.current.instanceMatrix.needsUpdate = true;
    }

    // Trajectoire elliptique, cap tangent.
    const x = SUBMARINE_LOOP.x + Math.cos(s.angle) * SUBMARINE_LOOP.rx;
    const z = SUBMARINE_LOOP.z + Math.sin(s.angle) * SUBMARINE_LOOP.rz;
    const dx = -Math.sin(s.angle) * SUBMARINE_LOOP.rx;
    const dz = Math.cos(s.angle) * SUBMARINE_LOOP.rz;
    const heading = Math.atan2(dz, dx);

    // Machine à états : croisière, surface, plongée.
    const boatDistance = Math.hypot(boatState.position.x - x, boatState.position.z - z);
    if (s.pendingDive) {
      s.pendingDive = false;
      s.mode = 'dive';
      s.since = time;
      emitBubbles(x, -0.6, z, 34, 1.6, 1.2);
      ripple(x, z, time, 1.6);
    }
    if (s.mode === 'cruise' && time > s.nextSurface && boatDistance > 12) {
      s.mode = 'surface';
      s.since = time;
      emitBubbles(x, -1.4, z, 24, 1.4);
    } else if (s.mode === 'surface' && (time - s.since > 8 || boatDistance < 9)) {
      s.mode = 'dive';
      s.since = time;
      emitBubbles(x, -0.4, z, 20, 1.3);
    } else if (s.mode === 'dive' && time - s.since > 6 && boatDistance > 7) {
      s.mode = 'cruise';
      s.since = time;
      s.nextSurface = time + 26 + hash(time) * 22;
    }
    // Trop près du bateau en croisière : il passe dessous.
    const avoid = s.mode === 'cruise' && boatDistance < 5;
    const goal = s.mode === 'surface' ? DEPTH_SURFACE : s.mode === 'dive' || avoid ? DEPTH_DIVE : DEPTH_CRUISE;
    s.depth = damp(s.depth, goal, s.mode === 'dive' ? 1.3 : 0.9, dt);

    // Bulles pendant les changements de profondeur.
    const moving = Math.abs(goal - s.depth) > 0.15;
    if (moving && time - s.lastBubbles > 0.12) {
      s.lastBubbles = time;
      emitBubbles(x - Math.cos(heading) * 1.4, s.depth + 0.2, z - Math.sin(heading) * 1.4, 3, 0.9);
    }

    const wave = waveHeight(x, z, time);
    const surfaced = smoothstep(DEPTH_CRUISE, DEPTH_SURFACE, s.depth);
    hullGroup.position.set(x, s.depth + wave * (0.4 + surfaced * 0.6), z);
    hullGroup.rotation.set(
      Math.sin(time * 1.1) * 0.04 * surfaced,
      -heading,
      Math.sin(time * 0.8) * 0.03 + (goal - s.depth) * 0.05,
    );

    // Périscope : il balaie l'horizon, et se tourne vers le bateau quand il est près.
    const scopeGroup = periscope.current;
    if (scopeGroup) {
      const sweep = Math.sin(time * 0.45) * 1.2 + Math.sin(time * 0.17) * 0.6;
      const toBoat = Math.atan2(boatState.position.z - z, boatState.position.x - x);
      const curious = boatDistance < 22 ? 1 : 0;
      const local = curious ? shortestAngle(0, -toBoat + heading) : sweep;
      s.look = damp(s.look, local, 2.2, dt);
      scopeGroup.rotation.y = s.look;
      // Il rentre un peu en surface (le kiosque est dehors) et ressort en croisière.
      scopeGroup.position.y = RADIUS + 0.8 - surfaced * 0.55;
    }
    if (propeller.current) propeller.current.rotation.x = time * 9;

    // Petits ronds dans l'eau derrière le périscope (sillage de croisière).
    const scopeTop = s.depth + RADIUS + 0.8 + 1.5;
    if (scopeTop > wave + 0.2 && time - s.lastRipple > 0.75 && s.mode !== 'dive') {
      s.lastRipple = time;
      ripple(x + Math.cos(heading) * 0.5, z + Math.sin(heading) * 0.5, time, 0.45 + surfaced * 0.9);
    }

    glassMaterial.emissiveIntensity = 0.15 + skyState.dayNight * 1.4;
  });

  return (
    <group ref={root} visible={false}>
      <group ref={body}>
        <Hotspot onActivate={activate} hoverScale={1.04}>
          <mesh geometry={hull} material={paintMaterial()} castShadow />
          <mesh geometry={parts} material={paintMaterial()} />
          <instancedMesh ref={rings} args={[ring, ringMaterial, PORTHOLES.length]} raycast={() => null} />
          <instancedMesh ref={glass} args={[pane, glassMaterial, PORTHOLES.length]} raycast={() => null} />
          <group ref={periscope} position={[0.52, RADIUS + 0.8, 0]}>
            <mesh geometry={scope} material={paintMaterial()} />
            {/* Zone de clic autour du périscope : c'est souvent tout ce qui dépasse. */}
            <mesh visible={false} position={[0, 1.2, 0]}>
              <sphereGeometry args={[1.25, 8, 6]} />
            </mesh>
          </group>
          <group ref={propeller} position={[-LENGTH / 2 - 0.1, 0, 0]}>
            <mesh geometry={prop} material={paintMaterial()} raycast={() => null} />
          </group>
        </Hotspot>
      </group>
    </group>
  );
}
