'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  RingGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { BOAT_FRAME } from '@/components/boat/BoatModel';
import { boatMotion } from '@/components/boat/motion';
import { homeIsland } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION, SPLASH_SECONDS } from '@/lib/cinematic';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';
import { WAVE_GLSL, waveHeight } from '@/lib/waves';
import { INTRO_POP_SLOTS, setIntroPopClock, setIntroPopSlot } from './pop';
import { riseSchedule, sweepBearing, SWEEP_FROM, SWEEP_SPAN, type RiseSlot } from './rise';
import { introSfx } from './sfx';

/**
 * Effets de la cinématique d'ouverture, en coordonnées monde (cinq appels de dessin, visibles
 * seulement le temps de l'intro) : faisceau de la lanterne qui balaie la mer, anneaux d'écume
 * autour des îles qui surgissent, gerbes d'eau, toux du moteur (bouffées sombres, remous
 * d'hélice, avant qui se lève), mouettes qui s'envolent du ponton de départ. Le « metteur en
 * scène » tient aussi l'horloge du pop GPU (pop.ts) et les bruitages.
 */

/** Toux du moteur (s depuis le clic) : « teuf… teuf-teuf ». */
const COUGHS = [SPLASH_SECONDS + 0.32, SPLASH_SECONDS + 0.6, SPLASH_SECONDS + 0.76];
/** Souffles des grands mouvements de caméra : [début, durée] (s). */
const WHOOSHES: readonly (readonly [number, number])[] = [[1.65, 1.7], [4.4, 1.6]];
const BELL_AT = 6.45;

function isRunning() {
  const { phase, reducedMotion } = useWorld.getState();
  return phase === 'transitioning' && !reducedMotion;
}

function introClock() {
  return useWorld.getState().gameTransition * INTRO_DURATION;
}

function currentSchedule() {
  const { introCenter } = useWorld.getState();
  return riseSchedule(introCenter[0], introCenter[1], boatState.heading);
}

/** Horloge du pop GPU, toux du moteur et bruitages. */
function Director() {
  const last = useRef(-1);
  useFrame(() => {
    const running = isRunning();
    const clock = introClock();
    setIntroPopClock(clock, running);
    if (!running) {
      last.current = -1;
      return;
    }
    const { introCenter } = useWorld.getState();
    const schedule = currentSchedule();
    for (let index = 1; index < INTRO_POP_SLOTS; index++) {
      const slot = schedule.slots[index - 1];
      if (slot) setIntroPopSlot(index, slot.x, slot.z, slot.footprint, slot.start);
      else setIntroPopSlot(index, 0, 0, 0, 0);
    }
    const previous = last.current;
    last.current = clock;
    const crossed = (at: number) => previous < at && clock >= at;
    // Le moteur toussote : l'avant se lève et la cheminée crache (StackSmoke lit la poussée).
    COUGHS.forEach((at, index) => {
      const hold = index === COUGHS.length - 1 ? 0.34 : 0.13;
      if (clock >= at && clock < at + hold) boatMotion.accel = Math.max(boatMotion.accel, 15);
      if (crossed(at)) introSfx.cough(index === 0 ? 0.75 : 1);
    });
    for (const [at, length] of WHOOSHES) if (crossed(at)) introSfx.whoosh(length, at < 3 ? 1 : 0.75);
    for (const slot of schedule.slots) {
      if (slot.rises && crossed(slot.start + 0.12)) {
        introSfx.rise(Math.hypot(slot.x - introCenter[0], slot.z - introCenter[1]));
      }
    }
    if (crossed(BELL_AT)) introSfx.bell();
  });
  return null;
}

/* --- Anneaux d'écume ----------------------------------------------------- */

const RING_LIFE = 2.2;
const RING_SLOTS = 12;

const ringVertex = /* glsl */ `
${WAVE_GLSL}
attribute vec4 aRing;
uniform float uClock;
uniform float uTime;
uniform vec3 uEye;
varying float vAlpha;
varying float vEdge;
varying float vAngle;
void main() {
  float age = uClock - aRing.w;
  float k = clamp(age / ${RING_LIFE.toFixed(2)}, 0.0, 1.0);
  float grow = 1.0 - exp(-max(age, 0.0) * 1.7);
  vec2 dir = position.xy;
  vec2 p = aRing.xy + dir * aRing.z * (1.0 + grow * 0.95);
  float alive = step(0.0, age) * step(age, ${RING_LIFE.toFixed(2)});
  vAlpha = alive * (1.0 - k) * (1.0 - k) * smoothstep(0.0, 0.16, age)
    * (1.0 - smoothstep(130.0, 220.0, distance(uEye.xz, p)));
  vEdge = (length(position.xy) - 0.86) / 0.14;
  vAngle = atan(dir.y, dir.x);
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, waveHeight(p, uTime) + 0.14, p.y, 1.0);
}
`;

const ringFragment = /* glsl */ `
uniform float uClock;
varying float vAlpha;
varying float vEdge;
varying float vAngle;
void main() {
  float profile = sin(clamp(vEdge, 0.0, 1.0) * 3.14159);
  float lace = 0.55 + 0.45 * sin(vAngle * 29.0 + uClock * 2.1) * sin(vAngle * 11.0 - uClock * 1.3 + 1.7);
  float alpha = vAlpha * profile * lace;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(0.94, 0.99, 0.97, alpha);
  #include <colorspace_fragment>
}
`;

function RiseRings() {
  const mesh = useRef<InstancedMesh>(null);
  const filled = useRef('');
  const geometry = useMemo(() => {
    const ring = new RingGeometry(0.86, 1, 96, 1);
    ring.setAttribute('aRing', new InstancedBufferAttribute(new Float32Array(RING_SLOTS * 2 * 4), 4));
    return ring;
  }, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uClock: { value: 0 }, uTime: { value: 0 }, uEye: { value: new Vector3() }, uStorm: { value: 0 } },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    target.visible = isRunning();
    if (!target.visible) return;
    const schedule = currentSchedule();
    if (filled.current !== schedule.key) {
      filled.current = schedule.key;
      const data = target.geometry.getAttribute('aRing') as InstancedBufferAttribute;
      const array = data.array as Float32Array;
      array.fill(0);
      let index = 0;
      for (const slot of schedule.slots) {
        if (slot.id === 'home' || index >= RING_SLOTS * 2) continue;
        array.set([slot.x, slot.z, slot.radius * 1.06, slot.start + 0.1], index * 4);
        array.set([slot.x, slot.z, slot.radius * 0.94, slot.start + 0.46], index * 4 + 4);
        index += 2;
      }
      for (; index < RING_SLOTS * 2; index++) array[index * 4 + 3] = -99;
      data.needsUpdate = true;
    }
    const shader = target.material as ShaderMaterial;
    shader.uniforms.uClock.value = introClock();
    shader.uniforms.uTime.value = state.clock.elapsedTime;
    shader.uniforms.uStorm.value = Math.min(1, Math.max(0, ecologyState.stormWaves));
    (shader.uniforms.uEye.value as Vector3).copy(state.camera.position);
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, RING_SLOTS * 2]}
      frustumCulled={false}
      renderOrder={7}
      visible={false}
      raycast={() => null}
    />
  );
}

/* --- Gerbes d'eau, remous d'hélice et bouffées de la cheminée ------------ */

const DROPS_PER_ISLAND = 16;
const DROP_SLOTS = 10;
const WASH = 12;
const DROPS = DROP_SLOTS * DROPS_PER_ISLAND + WASH;
const PUFFS = COUGHS.length * 3;
const DROP_LIFE = 1.7;
const PUFF_LIFE = 1.6;
const WASH_LIFE = 1.15;
const dummy = new Object3D();
const hidden = new Matrix4().makeScale(0, 0, 0);
const SMOKE_DARK = new Color('#3f3b39');
const SMOKE_LIGHT = new Color('#a29d97');
const smokeTint = new Color();

/** Sortie de cheminée dans le monde (le bateau ne bouge pas pendant l'intro). */
function stackTip(time: number, out: Vector3) {
  const [ex, ey, ez] = BOAT_FRAME.exhaust;
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  // Tribord (+Z du bateau) est en (−sin, cos) dans le monde.
  const x = boatState.position.x + forwardX * ex - forwardZ * ez;
  const z = boatState.position.z + forwardZ * ex + forwardX * ez;
  return out.set(x, waveHeight(boatState.position.x, boatState.position.z, time) + ey, z);
}

const tip = new Vector3();

function Spray() {
  const water = useRef<InstancedMesh>(null);
  const smoke = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const drops = water.current;
    const puffs = smoke.current;
    if (!drops || !puffs) return;
    const running = isRunning();
    drops.visible = running;
    puffs.visible = running;
    if (!running) return;
    const clock = introClock();
    const time = state.clock.elapsedTime;
    const schedule = currentSchedule();

    // Gerbes : l'île crève la surface et jette de l'eau tout autour de son rivage.
    let island = 0;
    for (const slot of schedule.slots) {
      if (!slot.rises || island >= DROP_SLOTS) continue;
      placeDrops(drops, island, slot, clock);
      island += 1;
    }
    for (; island < DROP_SLOTS; island++) {
      for (let drop = 0; drop < DROPS_PER_ISLAND; drop++) drops.setMatrixAt(island * DROPS_PER_ISLAND + drop, hidden);
    }

    // Remous d'hélice : quand le moteur prend, l'eau bouillonne derrière le tableau arrière.
    const forwardX = Math.cos(boatState.heading);
    const forwardZ = Math.sin(boatState.heading);
    for (let index = 0; index < WASH; index++) {
      const seed = hash(index * 5.17 + 2.3);
      const born = COUGHS[index % COUGHS.length] + 0.04 + seed * 0.22 + (index >= COUGHS.length * 2 ? 0.25 : 0);
      const age = clock - born;
      const slotIndex = DROP_SLOTS * DROPS_PER_ISLAND + index;
      if (age < 0 || age > WASH_LIFE) {
        drops.setMatrixAt(slotIndex, hidden);
        continue;
      }
      const t = age / WASH_LIFE;
      const back = -3.15 - age * (1.4 + seed * 1.2);
      const across = (seed - 0.5) * (0.5 + age * 2.4);
      const x = boatState.position.x + forwardX * back - forwardZ * across;
      const z = boatState.position.z + forwardZ * back + forwardX * across;
      const size = (0.22 + seed * 0.18) * (1 + t * 1.4) * Math.min(1, age * 9) * (1 - t * t);
      dummy.position.set(x, waveHeight(x, z, time) + 0.06, z);
      dummy.rotation.set(0, seed * 6.28, 0);
      dummy.scale.set(size * 1.4, size * 0.4, size);
      dummy.updateMatrix();
      drops.setMatrixAt(slotIndex, dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;

    // Bouffées de la toux : elles naissent d'un « pop », gonflent et s'éclaircissent en montant.
    stackTip(time, tip);
    for (let index = 0; index < PUFFS; index++) {
      const cough = Math.floor(index / 3);
      const order = index % 3;
      const seed = hash(index * 3.91 + 0.7);
      const age = clock - (COUGHS[cough] + order * 0.055);
      if (age < 0 || age > PUFF_LIFE) {
        puffs.setMatrixAt(index, hidden);
        continue;
      }
      const t = age / PUFF_LIFE;
      // Ressort de naissance : dépassement franc, puis la bouffée enfle doucement.
      const pop = 1 - Math.exp(-9 * age) * (Math.cos(16 * age) + 0.56 * Math.sin(16 * age));
      const size = (0.17 + order * 0.04 + (cough === 2 ? 0.05 : 0)) * pop * (1 + t * 2.4) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      dummy.position.set(
        tip.x - forwardX * age * (0.55 + seed * 0.3) + (seed - 0.5) * 0.3 * age,
        tip.y + 0.1 + age * (1.5 + order * 0.25) * (1 - t * 0.35),
        tip.z - forwardZ * age * (0.55 + seed * 0.3) + (0.5 - seed) * 0.3 * age,
      );
      dummy.rotation.set(seed * 6.28, age * 0.9 + seed, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      puffs.setMatrixAt(index, dummy.matrix);
      puffs.setColorAt(index, smokeTint.copy(SMOKE_DARK).lerp(SMOKE_LIGHT, Math.min(1, t * 1.6)));
    }
    puffs.instanceMatrix.needsUpdate = true;
    if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={water} args={[geometry, undefined, DROPS]} frustumCulled={false} visible={false} castShadow={false} raycast={() => null}>
        <meshStandardMaterial color="#eefbf8" emissive="#a9e3dc" emissiveIntensity={0.42} roughness={0.35} flatShading />
      </instancedMesh>
      <instancedMesh ref={smoke} args={[geometry, undefined, PUFFS]} frustumCulled={false} visible={false} castShadow={false} raycast={() => null}>
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

/** Gouttes jetées autour du rivage d'une île qui surgit (trajectoires balistiques). */
function placeDrops(mesh: InstancedMesh, island: number, slot: RiseSlot, clock: number) {
  const scale = Math.sqrt(slot.radius / 14);
  for (let drop = 0; drop < DROPS_PER_ISLAND; drop++) {
    const index = island * DROPS_PER_ISLAND + drop;
    const a = hash(island * 37.1 + drop * 3.7);
    const b = hash(island * 11.3 + drop * 7.9);
    const c = hash(island * 5.9 + drop * 13.1);
    const age = clock - (slot.start + 0.05 + b * 0.32);
    if (age < 0 || age > DROP_LIFE) {
      mesh.setMatrixAt(index, hidden);
      continue;
    }
    const angle = a * Math.PI * 2;
    const reach = slot.radius * (0.84 + c * 0.22) + (2.6 + b * 3.8) * age;
    const rise = 6.5 + c * 7.5;
    const height = 0.4 + rise * age - 7.6 * age * age;
    if (height < -0.5) {
      mesh.setMatrixAt(index, hidden);
      continue;
    }
    const t = age / DROP_LIFE;
    // Gerbes lisibles de loin (les îles surgissent à 80-150 m de la caméra).
    const size = (0.42 + a * 0.5) * scale * (1 - t * t);
    const fall = Math.abs(rise - 15.2 * age);
    dummy.position.set(slot.x + Math.cos(angle) * reach, height, slot.z + Math.sin(angle) * reach);
    dummy.rotation.set(0, -angle, 0);
    dummy.scale.set(size, size * (1 + Math.min(fall * 0.07, 1.1)), size);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
}

/* --- Mouettes du ponton --------------------------------------------------- */

type V3 = [number, number, number];
const GULLS = 6;

/** Mouette basse définition (avant = +X, envergure selon Z), ailes repérées pour le battement. */
function gullGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const wings: number[] = [];
  const tri = (a: V3, b: V3, c: V3, color: V3, wing = false) => {
    for (const point of [a, b, c]) {
      positions.push(...point);
      colors.push(...color);
      wings.push(wing ? point[2] : 0);
    }
  };
  const white: V3 = [0.96, 0.96, 0.94];
  const grey: V3 = [0.68, 0.71, 0.74];
  const tipColor: V3 = [0.15, 0.16, 0.19];
  const beak: V3 = [0.98, 0.74, 0.2];
  const nose: V3 = [0.42, 0.03, 0];
  const tail: V3 = [-0.4, 0.04, 0];
  const top: V3 = [0.02, 0.12, 0];
  const bottom: V3 = [0.02, -0.08, 0];
  const left: V3 = [0.02, 0.02, -0.1];
  const right: V3 = [0.02, 0.02, 0.1];
  tri(nose, top, right, white);
  tri(nose, right, bottom, white);
  tri(nose, bottom, left, white);
  tri(nose, left, top, white);
  tri(tail, right, top, white);
  tri(tail, bottom, right, white);
  tri(tail, left, bottom, white);
  tri(tail, top, left, white);
  tri([0.41, 0.045, 0.025], [0.56, 0.02, 0], [0.41, 0.0, -0.025], beak);
  tri([-0.34, 0.05, 0.045], [-0.58, 0.05, 0.11], [-0.58, 0.05, -0.11], white);
  tri([-0.34, 0.05, -0.045], [-0.34, 0.05, 0.045], [-0.58, 0.05, -0.11], white);
  for (const side of [1, -1]) {
    const front: V3 = [0.12, 0.06, 0.07 * side];
    const back: V3 = [-0.1, 0.06, 0.07 * side];
    const wrist: V3 = [0.02, 0.06, 0.52 * side];
    const trailing: V3 = [-0.15, 0.06, 0.5 * side];
    const end: V3 = [-0.24, 0.06, 0.98 * side];
    tri(front, wrist, back, grey, true);
    tri(back, wrist, trailing, grey, true);
    tri(wrist, end, trailing, tipColor, true);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aWing', new Float32BufferAttribute(wings, 1));
  geometry.setAttribute('aFlap', new InstancedBufferAttribute(new Float32Array(GULLS), 1));
  return geometry;
}

const gullVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aWing;
attribute float aFlap;
varying vec3 vColor;
varying vec3 vView;
void main() {
  vec3 p = position;
  float side = sign(aWing);
  float angle = aFlap * side * (0.7 + 0.6 * smoothstep(0.35, 0.95, abs(aWing)));
  float c = cos(angle);
  float s = sin(angle);
  p.yz = vec2(p.y * c + p.z * s, -p.y * s + p.z * c);
  vColor = aColor;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const gullFragment = /* glsl */ `
uniform vec3 uLight;
uniform float uNight;
varying vec3 vColor;
varying vec3 vView;
void main() {
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  float d = dot(n, uLight);
  float lit = smoothstep(0.0, 0.08, d) * 0.5 + smoothstep(0.42, 0.48, d) * 0.32;
  vec3 color = vColor * (mix(vec3(0.62, 0.64, 0.78), vec3(0.2, 0.24, 0.36), uNight) + vec3(1.0, 0.95, 0.86) * lit * (1.0 - uNight * 0.7));
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

const SUN_DIRECTION = new Vector3(0.45, 0.8, 0.35).normalize();
const perch = new Vector3();
const p1 = new Vector3();
const p2 = new Vector3();
const p3 = new Vector3();
const point = new Vector3();
const ahead = new Vector3();

/** Perchoirs sur le ponton et la grève de l'îlot de départ (repère de l'îlot). */
function perchAt(index: number, out: Vector3) {
  const [hx, hz] = homeIsland.position;
  const dockX = Math.cos(homeIsland.dockAngle);
  const dockZ = Math.sin(homeIsland.dockAngle);
  if (index < 3) {
    const along = [8.3, 9.5, 10.6][index];
    const across = [0.42, -0.48, 0.3][index];
    return out.set(hx + dockX * along - dockZ * across, 0.9, hz + dockZ * along + dockX * across);
  }
  const angle = homeIsland.dockAngle + [0.55, -0.65, 1.15][index - 3];
  const radius = [6.4, 6.2, 6.5][index - 3];
  return out.set(hx + Math.cos(angle) * radius, 0.62, hz + Math.sin(angle) * radius);
}

function bezier(a: Vector3, b: Vector3, c: Vector3, d: Vector3, u: number, out: Vector3) {
  const v = 1 - u;
  return out
    .copy(a)
    .multiplyScalar(v * v * v)
    .addScaledVector(b, 3 * v * v * u)
    .addScaledVector(c, 3 * v * u * u)
    .addScaledVector(d, u * u * u);
}

/** Vol d'une mouette `age` secondes après l'envol : départ en chandelle, puis cap au large. */
function flightPoint(index: number, age: number, out: Vector3) {
  const seed = hash(index * 9.7 + 1.3);
  perchAt(index, perch);
  const [hx, hz] = homeIsland.position;
  let outX = perch.x - hx;
  let outZ = perch.z - hz;
  const length = Math.hypot(outX, outZ) || 1;
  outX /= length;
  outZ /= length;
  const forwardX = Math.cos(boatState.heading);
  const forwardZ = Math.sin(boatState.heading);
  const spread = (index / (GULLS - 1)) * 2 - 1;
  p1.set(perch.x + outX * 1.4, perch.y + 2.4, perch.z + outZ * 1.4);
  p2.set(perch.x + outX * 7 + forwardX * 7, perch.y + 8 + seed * 2, perch.z + outZ * 7 + forwardZ * 7);
  p3.set(hx + forwardX * 44 - forwardZ * spread * 20, 21 + seed * 6, hz + forwardZ * 44 + forwardX * spread * 20);
  const u = Math.min(1, age / 4.8);
  return bezier(perch, p1, p2, p3, u * u * (3 - 2 * u) * 0.35 + u * 0.65, out);
}

function Gulls() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => gullGeometry(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uLight: { value: new Vector3() }, uNight: { value: 0 } },
        vertexShader: gullVertex,
        fragmentShader: gullFragment,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    target.visible = isRunning();
    if (!target.visible) return;
    const clock = introClock();
    const time = state.clock.elapsedTime;
    const flaps = target.geometry.getAttribute('aFlap') as InstancedBufferAttribute;
    dummy.rotation.order = 'YZX';
    for (let index = 0; index < GULLS; index++) {
      const seed = hash(index * 4.3 + 0.9);
      const appear = 1.02 + seed * 0.14;
      const takeoff = SPLASH_SECONDS + 0.52 + index * 0.07 + seed * 0.1;
      const age = clock - takeoff;
      const born = clock - appear;
      if (born < 0 || age > 5.6) {
        target.setMatrixAt(index, hidden);
        continue;
      }
      // Apparition d'un « pop » avec l'îlot, disparition au loin.
      const pop = 1 - Math.exp(-10 * born) * (Math.cos(15 * born) + 0.67 * Math.sin(15 * born));
      const fade = age > 4.7 ? Math.max(0, 1 - (age - 4.7) / 0.9) : 1;
      let flap = 0.12;
      if (age < 0) {
        perchAt(index, point);
        point.y += Math.abs(Math.sin(time * 5 + seed * 9)) * 0.05;
        dummy.position.copy(point);
        dummy.rotation.set(0, -(boatState.heading + seed * 2.4), 0);
      } else {
        flightPoint(index, age, point);
        flightPoint(index, age + 0.05, ahead);
        dummy.position.copy(point);
        const dx = ahead.x - point.x;
        const dy = ahead.y - point.y;
        const dz = ahead.z - point.z;
        const climb = Math.atan2(dy, Math.hypot(dx, dz) || 0.001);
        dummy.rotation.set(Math.sin(age * 1.7 + seed * 5) * 0.22 * Math.min(1, age), -Math.atan2(dz, dx), climb * 0.55);
        // Battements serrés au décollage, puis plané entrecoupé de quelques coups d'ailes.
        const strength = age < 1.1 ? 0.95 : 0.25 + 0.45 * Math.max(0, Math.sin(age * 1.3 + seed * 4));
        flap = 0.08 + Math.sin(age * (age < 1.1 ? 17 : 11) + seed * 6) * strength;
      }
      dummy.scale.setScalar(0.78 * pop * fade);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      flaps.setX(index, flap);
    }
    target.instanceMatrix.needsUpdate = true;
    flaps.needsUpdate = true;
    const shader = target.material as ShaderMaterial;
    (shader.uniforms.uLight.value as Vector3).copy(SUN_DIRECTION).transformDirection(state.camera.matrixWorldInverse);
    shader.uniforms.uNight.value = skyState.dayNight;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, GULLS]} frustumCulled={false} visible={false} raycast={() => null} />;
}

/* --- Faisceau de la lanterne ---------------------------------------------- */

const beamVertex = /* glsl */ `
varying vec2 vPlane;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPlane = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const beamFragment = /* glsl */ `
uniform vec2 uCenter;
uniform float uAngle;
uniform float uStrength;
uniform float uTime;
varying vec2 vPlane;
void main() {
  vec2 d = vPlane - uCenter;
  float r = length(d);
  float delta = atan(sin(atan(d.y, d.x) - uAngle), cos(atan(d.y, d.x) - uAngle));
  float width = 0.085 + r * 0.00035;
  float core = exp(-pow(delta / width, 2.0)) * 0.62;
  float glow = exp(-pow(delta / (width * 3.5), 2.0)) * 0.22;
  // Sillage : la mer déjà balayée garde un instant un reflet chaud.
  float wake = delta < 0.0 ? exp(delta / 0.6) * 0.12 : 0.0;
  float radial = smoothstep(12.0, 30.0, r) * (1.0 - smoothstep(110.0, 175.0, r));
  float shimmer = 0.9 + 0.1 * sin(r * 0.32 - uTime * 4.0);
  float light = (core + glow + wake) * radial * shimmer * uStrength;
  if (light < 0.004) discard;
  gl_FragColor = vec4(1.0, 0.8, 0.5, light);
}
`;

/**
 * La lanterne du bateau balaie la mer d'un tour complet : là où son faisceau passe, les îles
 * surgissent (même balayage que intro/rise.ts). Une traînée chaude sur l'eau, additive.
 */
function SweepBeam() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uCenter: { value: new Vector2() }, uAngle: { value: 0 }, uStrength: { value: 0 }, uTime: { value: 0 } },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const clock = introClock();
    const strength = isRunning()
      ? smoothstep(SWEEP_FROM - 0.2, SWEEP_FROM + 0.25, clock) * (1 - smoothstep(SWEEP_FROM + SWEEP_SPAN - 0.25, SWEEP_FROM + SWEEP_SPAN + 0.15, clock))
      : 0;
    target.visible = strength > 0.002;
    if (!target.visible) return;
    const { introCenter } = useWorld.getState();
    target.position.set(introCenter[0], 0.32, introCenter[1]);
    const shader = target.material as ShaderMaterial;
    (shader.uniforms.uCenter.value as Vector2).set(introCenter[0], introCenter[1]);
    shader.uniforms.uAngle.value = sweepBearing(clock, boatState.heading);
    // Plus discret à mesure que le jour se lève : la lanterne s'efface devant le soleil.
    shader.uniforms.uStrength.value = strength * (1.05 - useWorld.getState().reveal * 0.45);
    shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={8} visible={false} frustumCulled={false} raycast={() => null}>
      <planeGeometry args={[360, 360, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Tous les effets de l'ouverture (montés par IntroStage, hors du Suspense de la scène). */
export function IntroFX() {
  return (
    <>
      <Director />
      <SweepBeam />
      <RiseRings />
      <Spray />
      <Gulls />
    </>
  );
}
