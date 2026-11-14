'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { ripple } from '@/components/world/Flotsam';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { damp, hash, shortestAngle } from '@/lib/utils/math';
import { waveHeight } from '@/lib/waves';
import { emitBubbles } from './Bubbles';
import { exposeForDebug } from './debug';
import { SERPENT_ARC } from './layout';
import { at, inSight, merge, paintMaterial, piece } from './shared';

/**
 * Le serpent de mer du bout du monde, là où la pancarte flottante prévient « ici vivent
 * des monstres ». Ses bosses montent et plongent dans une onde lente pendant qu'il longe
 * l'arc de la mer interdite ; au bout de son territoire il sonde, fait demi-tour sous
 * l'eau et réapparaît. Il est timide : si le bateau s'approche trop, il plonge. Le corps
 * entier est déformé sur le GPU (un seul dessin) ; la nuit, ses flancs s'illuminent de
 * points bioluminescents. Tampon « serpent » quand le bateau passe à moins de 35 m.
 */

const LENGTH = 26;
const RINGS = 84;
const SIDES = 8;
const SPEED = 1.35;
const SPOT_RANGE = 35;
const SHY_RANGE = 13;

/** Rayon du corps le long de l'abscisse s (0 = nuque, LENGTH = bout de la queue). */
function radiusAt(s: number) {
  if (s < 2.2) return 0.52 + (s / 2.2) * 0.3;
  if (s < 11) return 0.82 + Math.sin(((s - 2.2) / 8.8) * Math.PI) * 0.06;
  return Math.max(0.05, 0.82 * (1 - Math.pow((s - 11) / (LENGTH - 11), 1.35)));
}

/** Corps : tube + crête dorsale en dents de scie, repère (s, haut, côté). */
function bodyGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const top = new Color('#25786b');
  const flank = new Color('#3fae95');
  const belly = new Color('#ecdca3');
  const band = new Color('#1f6a5f');
  const color = new Color();
  for (let ring = 0; ring <= RINGS; ring++) {
    const s = (ring / RINGS) * LENGTH;
    const r = radiusAt(s);
    const striped = Math.floor(s / 1.6) % 2 === 0;
    for (let side = 0; side < SIDES; side++) {
      const angle = (side / SIDES) * Math.PI * 2;
      const up = Math.cos(angle);
      positions.push(s, up * r, Math.sin(angle) * r);
      if (up < -0.35) color.copy(belly);
      else if (up > 0.45) color.copy(striped ? band : top);
      else color.copy(flank).lerp(top, Math.max(0, up));
      color.multiplyScalar(0.94 + hash(ring * 3.7 + side) * 0.1);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let side = 0; side < SIDES; side++) {
      const a = ring * SIDES + side;
      const b = ring * SIDES + ((side + 1) % SIDES);
      const c = (ring + 1) * SIDES + side;
      const d = (ring + 1) * SIDES + ((side + 1) % SIDES);
      index.push(a, b, c, b, d, c);
    }
  }
  // Bouchon de la queue.
  const tip = positions.length / 3;
  positions.push(LENGTH + 0.3, 0, 0);
  colors.push(top.r, top.g, top.b);
  for (let side = 0; side < SIDES; side++) {
    index.push(RINGS * SIDES + side, RINGS * SIDES + ((side + 1) % SIDES), tip);
  }
  // Crête : un coin fin par anneau, pointes alternées hautes et basses.
  const crest = new Color('#f2733a');
  for (let ring = 2; ring < RINGS - 6; ring++) {
    const s = (ring / RINGS) * LENGTH;
    const r = radiusAt(s);
    const h = (ring % 2 === 0 ? 0.5 : 0.22) * Math.min(1, r / 0.5);
    const next = ((ring + 1) / RINGS) * LENGTH;
    const base = positions.length / 3;
    positions.push(s, r * 0.82, 0.07, s, r * 0.82, -0.07, (s + next) / 2, r + h, 0, next, radiusAt(next) * 0.82, 0.07, next, radiusAt(next) * 0.82, -0.07);
    for (let k = 0; k < 5; k++) colors.push(crest.r, crest.g, crest.b);
    index.push(base, base + 3, base + 2, base + 1, base + 2, base + 4, base, base + 2, base + 1, base + 3, base + 4, base + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Tête : museau rond, grands yeux, collerette de piquants orange, petites cornes. Avant = +X. */
function headGeometry() {
  const parts: BufferGeometry[] = [
    piece(new SphereGeometry(1, 12, 9), '#2f8f7f', at([0.15, 0.05, 0], [0, 0, -0.12], [0.95, 0.6, 0.66]), 0.05, 1),
    piece(new SphereGeometry(1, 10, 7), '#3fae95', at([0.75, -0.05, 0], [0, 0, -0.08], [0.55, 0.36, 0.48]), 0.05, 2),
    piece(new SphereGeometry(1, 10, 6), '#ecdca3', at([0.55, -0.27, 0], [0, 0, 0.1], [0.62, 0.17, 0.42])),
    piece(new SphereGeometry(0.035, 5, 4), '#123', at([1.22, 0.07, 0.15])),
    piece(new SphereGeometry(0.035, 5, 4), '#123', at([1.22, 0.07, -0.15])),
  ];
  for (const side of [1, -1]) {
    parts.push(piece(new SphereGeometry(0.2, 10, 8), '#fbfbf2', at([0.42, 0.4, side * 0.38])));
    parts.push(piece(new SphereGeometry(0.11, 8, 6), '#141a20', at([0.55, 0.43, side * 0.47])));
    parts.push(piece(new SphereGeometry(0.035, 5, 4), '#ffffff', at([0.6, 0.5, side * 0.53])));
    parts.push(piece(new ConeGeometry(0.07, 0.36, 5), '#f6c35a', at([-0.05, 0.62, side * 0.22], [side * -0.3, 0, 0.55])));
  }
  for (let spine = 0; spine < 5; spine++) {
    const angle = -0.9 + spine * 0.45;
    parts.push(piece(
      new ConeGeometry(0.09, 0.75, 4).translate(0, 0.37, 0),
      spine % 2 === 0 ? '#f2733a' : '#f79a4a',
      at([-0.45, 0.12, Math.sin(angle) * 0.42], [angle * 0.9, 0, 0.95]),
      0.05,
      spine,
    ));
  }
  return merge(parts);
}

/* --------------------------------------------------------- déformation GPU */

const uniforms = {
  uSerpHead: { value: SERPENT_ARC.from },
  uSerpDir: { value: 1 },
  uSerpRadius: { value: SERPENT_ARC.radius },
  uSerpSubmerge: { value: 1 },
  uSerpWave: { value: 0 },
  uSerpTime: { value: 0 },
  uSerpNight: { value: 0 },
};

const CENTER_GLSL = /* glsl */ `
uniform float uSerpHead;
uniform float uSerpDir;
uniform float uSerpRadius;
uniform float uSerpSubmerge;
uniform float uSerpWave;
uniform float uSerpTime;
varying float vSerpS;
varying float vSerpSide;

vec3 serpCenter(float s) {
  float theta = uSerpHead - uSerpDir * s / uSerpRadius;
  float sway = sin(s * 0.31 - uSerpTime * 0.7) * 0.8 * smoothstep(0.0, 5.0, s);
  float radius = uSerpRadius + sway;
  float hump = sin(uSerpWave - s * 0.84) * 1.25 - 1.0;
  float neck = 1.0 - smoothstep(0.0, 4.5, s);
  float lift = neck * neck * (1.25 + sin(uSerpTime * 0.9) * 0.2);
  float y = mix(hump, 0.55, neck) + lift;
  y = mix(y, -3.6, uSerpSubmerge);
  return vec3(cos(theta) * radius, y, sin(theta) * radius);
}
`;

/** Miroir CPU de `serpCenter` (tête, écume, distances). */
function serpCenter(s: number, out: Vector3) {
  const theta = uniforms.uSerpHead.value - (uniforms.uSerpDir.value * s) / SERPENT_ARC.radius;
  const sway = Math.sin(s * 0.31 - uniforms.uSerpTime.value * 0.7) * 0.8 * smooth(0, 5, s);
  const radius = SERPENT_ARC.radius + sway;
  const hump = Math.sin(uniforms.uSerpWave.value - s * 0.84) * 1.25 - 1;
  const neck = 1 - smooth(0, 4.5, s);
  const lift = neck * neck * (1.25 + Math.sin(uniforms.uSerpTime.value * 0.9) * 0.2);
  let y = hump + (0.55 - hump) * neck + lift;
  y += (-3.6 - y) * uniforms.uSerpSubmerge.value;
  return out.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function serpentMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${CENTER_GLSL}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        float serpS = position.x;
        vec3 serpC0 = serpCenter(serpS);
        vec3 serpT = normalize(serpCenter(serpS + 0.15) - serpC0);
        vec3 serpSide = normalize(cross(serpT, vec3(0.0, 1.0, 0.0)));
        vec3 serpUp = normalize(cross(serpSide, serpT));
        vec3 transformed = serpC0 + serpUp * position.y + serpSide * position.z;
        vSerpS = serpS;
        vSerpSide = position.z;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSerpNight;\nvarying float vSerpS;\nvarying float vSerpSide;')
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // Points bioluminescents sur les flancs, la nuit.
        float serpDots = smoothstep(0.2, 0.06, abs(fract(vSerpS * 0.72) - 0.5));
        float serpFlank = smoothstep(0.22, 0.5, abs(vSerpSide));
        totalEmissiveRadiance += vec3(0.25, 0.95, 0.85) * serpDots * serpFlank * uSerpNight * 1.7;`,
      );
  };
  material.customProgramCacheKey = () => 'sea-serpent-v1';
  return material;
}

/* ------------------------------------------------------------------ écume */

const FOAM = 10;

function foamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 6, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(0.75, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalCompositeOperation = 'destination-out';
  for (let index = 0; index < 18; index++) {
    ctx.beginPath();
    ctx.arc(hash(index * 3.3) * 64, hash(index * 7.7) * 64, 2 + hash(index) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  return texture;
}

const _a = new Vector3();
const _b = new Vector3();
const _dummy = new Object3D();
const _white = new Color();

type Mode = 'swim' | 'dive' | 'hidden' | 'rise';

export function SeaSerpent() {
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  const foam = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => bodyGeometry(), []);
  const material = useMemo(() => serpentMaterial(), []);
  const headShape = useMemo(() => headGeometry(), []);
  const foamGeometry = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const foamMaterial = useMemo(
    () => new MeshBasicMaterial({ map: foamTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [],
  );
  const sim = useRef({
    mode: 'rise' as Mode,
    since: 0,
    arc: 0,
    submerge: 1,
    look: 0,
    spotted: false,
    lastRipple: 0,
    lastBubbles: 0,
  });

  useEffect(() => exposeForDebug('serpent', { sim: sim.current, uniforms }), []);

  useEffect(() => () => {
    material.dispose();
    foamMaterial.map?.dispose();
    foamMaterial.dispose();
  }, [foamMaterial, material]);

  useFrame((state, delta) => {
    const group = body.current;
    const headGroup = head.current;
    if (!group || !headGroup) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const s = sim.current;
    serpCenter(LENGTH / 2, _a);
    const visible = inSight(state.camera, _a.x, _a.z, 170);
    group.visible = visible;
    if (!visible) return;

    // Distance du bateau au corps (quelques points le long du serpent).
    let nearest = Infinity;
    for (let k = 0; k <= 6; k++) {
      serpCenter((k / 6) * LENGTH, _b);
      nearest = Math.min(nearest, Math.hypot(boatState.position.x - _b.x, boatState.position.z - _b.z));
    }

    // Territoire : l'arc entre `from` et `to`. Au bout, il sonde et revient en sens inverse.
    const dir = uniforms.uSerpDir.value;
    const head0 = uniforms.uSerpHead.value;
    const shy = nearest < SHY_RANGE;
    if (s.mode === 'swim' || s.mode === 'rise') {
      const beyond = dir > 0 ? head0 > SERPENT_ARC.to : head0 < SERPENT_ARC.from;
      if (beyond || shy) {
        s.mode = 'dive';
        s.since = time;
        ambience.splash(shy ? 0.45 : 0.25);
        serpCenter(0, _b);
        emitBubbles(_b.x, -0.5, _b.z, shy ? 26 : 12, 1.4, 1.3);
      } else if (s.mode === 'rise' && s.submerge < 0.05) {
        s.mode = 'swim';
      }
    } else if (s.mode === 'dive' && s.submerge > 0.97) {
      s.mode = 'hidden';
      s.since = time;
    } else if (s.mode === 'hidden' && time - s.since > 5 && nearest > 30) {
      // Demi-tour sous l'eau : la tête repart du bout où il a plongé (ou de l'autre bout).
      const turn = head0 > SERPENT_ARC.to - 0.05 || head0 < SERPENT_ARC.from + 0.05;
      if (turn) uniforms.uSerpDir.value = -dir;
      uniforms.uSerpHead.value = uniforms.uSerpDir.value > 0
        ? Math.min(head0, SERPENT_ARC.to - 0.12)
        : Math.max(head0, SERPENT_ARC.from + 0.12);
      s.mode = 'rise';
      s.since = time;
    }
    const target = s.mode === 'dive' || s.mode === 'hidden' ? 1 : 0;
    s.submerge = damp(s.submerge, target, s.mode === 'dive' ? 1.1 : 0.7, dt);
    if (s.mode !== 'hidden') uniforms.uSerpHead.value += (uniforms.uSerpDir.value * SPEED * dt) / SERPENT_ARC.radius;
    s.arc += SPEED * dt;
    uniforms.uSerpSubmerge.value = s.submerge;
    // Les bosses restent presque fixes dans l'eau : le corps glisse à travers.
    uniforms.uSerpWave.value = s.arc * 0.84 * 0.88 + time * 0.25;
    uniforms.uSerpTime.value = time;
    uniforms.uSerpNight.value = skyState.dayNight;

    // Tampon : le bateau l'a vu d'assez près.
    if (!s.spotted && nearest < SPOT_RANGE && s.submerge < 0.6) {
      s.spotted = true;
      if (!logbook.has('serpent')) {
        logbook.stamp('serpent');
        ambience.whale();
      }
    }

    // Tête : posée sur la nuque, orientée vers l'avant ; elle tourne la tête vers le bateau.
    serpCenter(0, _a);
    serpCenter(0.3, _b);
    const fx = _a.x - _b.x;
    const fy = _a.y - _b.y;
    const fz = _a.z - _b.z;
    const yaw = Math.atan2(fz, fx);
    const toBoat = Math.atan2(boatState.position.z - _a.z, boatState.position.x - _a.x);
    const curious = nearest < 45 ? Math.max(-0.9, Math.min(0.9, shortestAngle(yaw, toBoat))) : Math.sin(time * 0.6) * 0.35;
    s.look = damp(s.look, curious, 2, dt);
    const bob = Math.sin(time * 1.8) * 0.06;
    headGroup.position.set(_a.x + Math.cos(yaw) * 0.25, _a.y + 0.18 + bob, _a.z + Math.sin(yaw) * 0.25);
    headGroup.rotation.set(0, -(yaw + s.look), Math.atan2(fy, Math.hypot(fx, fz)) * 0.5 + Math.sin(time * 1.3) * 0.08, 'YZX');

    // Écume là où les bosses percent la surface, ronds dans l'eau autour de la tête.
    const foamMesh = foam.current;
    if (foamMesh) {
      let used = 0;
      let previous = 0;
      for (let step = 0; step <= 52 && used < FOAM; step++) {
        const along = (step / 52) * LENGTH;
        serpCenter(along, _b);
        const water = waveHeight(_b.x, _b.z, time);
        const level = _b.y + radiusAt(along) * 0.35 - water;
        if (step > 0 && Math.sign(level) !== Math.sign(previous) && radiusAt(along) > 0.2) {
          serpCenter(Math.min(LENGTH, along + 0.3), _a);
          _dummy.position.set(_b.x, water + 0.04, _b.z);
          _dummy.rotation.set(0, -Math.atan2(_a.z - _b.z, _a.x - _b.x), 0);
          const size = radiusAt(along) * 2.6;
          _dummy.scale.set(size * 1.5, 1, size);
          _dummy.updateMatrix();
          foamMesh.setMatrixAt(used, _dummy.matrix);
          foamMesh.setColorAt(used, _white.setScalar(0.75 * (1 - s.submerge)));
          used += 1;
        }
        previous = level;
      }
      for (let k = used; k < FOAM; k++) {
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        foamMesh.setMatrixAt(k, _dummy.matrix);
      }
      foamMesh.instanceMatrix.needsUpdate = true;
      if (foamMesh.instanceColor) foamMesh.instanceColor.needsUpdate = true;
    }
    if (s.submerge < 0.5 && time - s.lastRipple > 1.4) {
      s.lastRipple = time;
      serpCenter(1.5, _b);
      ripple(_b.x, _b.z, time, 1.2);
    }
    if (s.mode === 'hidden' && time - s.lastBubbles > 0.7) {
      // Sous l'eau, quelques bulles trahissent sa présence.
      s.lastBubbles = time;
      serpCenter(hash(time) * LENGTH * 0.6, _b);
      emitBubbles(_b.x, -1.2, _b.z, 3, 0.8);
    }
  });

  return (
    <group ref={body} visible={false}>
      <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      <group ref={head}>
        <mesh geometry={headShape} material={paintMaterial()} raycast={() => null} />
      </group>
      <instancedMesh ref={foam} args={[foamGeometry, foamMaterial, FOAM]} frustumCulled={false} renderOrder={3} raycast={() => null} />
    </group>
  );
}
