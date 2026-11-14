'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedBufferAttribute, InstancedMesh, Vector2 } from 'three';
import { TURTLE_LAGOONS, type TurtleLagoon } from '@/data/zones';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { hash, smoothstep } from '@/lib/utils/math';
import { WAVE_GLSL, waveHeight } from '@/lib/waves';
import { loft, MeshBuilder, tone, type Vec3 } from './geometry';
import { creatureMaterial, crossed, faunaClock } from './shared';
import { emitRing } from './Splashes';

/**
 * TORTUES MARINES — elles glissent dans les lagons turquoise, juste au-delà du haut-fond de
 * chaque île : de grands battements lents des nageoires avant, les arrière qui gouvernent,
 * la tête qui oscille. Toutes les ~45 s une tortue remonte respirer (la carapace affleure,
 * petit rond dans l'eau) ; si le bateau passe au-dessus, elle plonge et accélère.
 * Tout le mouvement est analytique et calculé sur le GPU : un draw call, aucune matrice.
 */

/* ------------------------------------------------------------------------- modèle */

/** Parties : 0 carapace/plastron, 1 tête, 2-3 nageoires avant (G, D), 4-5 arrière (G, D). */
function turtleGeometry() {
  const builder = new MeshBuilder(['aPart']);
  builder.set('aPart', 0);
  // Dôme de carapace : contour ovale un peu pointu à l'arrière, écailles en aplats mouchetés.
  const segments = 12;
  const rings = [0, 0.42, 0.74, 0.92, 1.0];
  const heights = [0.29, 0.25, 0.16, 0.07, 0.0];
  const outline = (angle: number) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const rx = c > 0 ? 0.5 : 0.62;
    return [c * rx, s * 0.46] as const;
  };
  const point = (ring: number, segment: number): Vec3 => {
    const angle = (segment / segments) * Math.PI * 2;
    const [ox, oz] = outline(angle);
    const rho = rings[ring];
    return [ox * rho - 0.04, heights[ring], oz * rho];
  };
  const scutes = ['#5f6f3a', '#6e7a40', '#7a6a3a', '#66733c'];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = point(ring, segment);
      const b = point(ring + 1, segment);
      const c = point(ring + 1, next);
      const d = point(ring, next);
      let color = tone(scutes[Math.floor(hash(ring * 13.1 + segment * 3.7) * scutes.length)]);
      if (ring === 2) color = tone(segment % 2 ? '#8a7a45' : '#7b6c3c');
      if (ring === 3) color = tone('#a99a63');
      // Contour orienté vers l'extérieur (dôme vu du dessus).
      if (ring === 0) builder.tri(a, c, b, color);
      else builder.quad(a, d, c, b, color);
    }
  }
  // Plastron : disque clair, légèrement plus petit, sous la carapace.
  const plastron = tone('#d9cf9e');
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    const [ax, az] = outline((segment / segments) * Math.PI * 2);
    const [bx, bz] = outline((next / segments) * Math.PI * 2);
    builder.tri([-0.04, -0.06, 0], [ax * 0.9 - 0.04, -0.02, az * 0.9], [bx * 0.9 - 0.04, -0.02, bz * 0.9], plastron);
    // Bord de la carapace (marginales) : rejoint le plastron.
    const rim = tone('#9c8c57');
    builder.quad(
      [ax - 0.04, 0, az], [bx - 0.04, 0, bz],
      [bx * 0.9 - 0.04, -0.02, bz * 0.9], [ax * 0.9 - 0.04, -0.02, az * 0.9], rim,
    );
  }

  // Tête et cou : petit corps lofté, peau olive tachetée.
  builder.set('aPart', 1);
  loft(builder, [
    { x: 0.82, w: 0.04, h: 0.035, y: 0.0 },
    { x: 0.74, w: 0.1, h: 0.08, y: 0.01 },
    { x: 0.6, w: 0.12, h: 0.1, y: 0.01 },
    { x: 0.44, w: 0.1, h: 0.08, y: 0.0 },
  ], 8, ({ up, ring }) => {
    if (up < -0.3) return tone('#d8d3a6');
    return tone(ring === 1 ? '#6f6c40' : '#9a9a62');
  });
  const eye = tone('#141a12');
  for (const side of [1, -1]) {
    builder.sheet([0.73, 0.05, 0.085 * side], [0.69, 0.07, 0.09 * side], [0.67, 0.04, 0.09 * side], eye);
  }

  // Nageoires : avant longues, en aile ; arrière courtes, en palette.
  const flipperTop = tone('#7f7c4c');
  const flipperEdge = tone('#c9c493');
  for (const side of [1, -1]) {
    builder.set('aPart', side > 0 ? 2 : 3);
    const root: Vec3 = [0.3, -0.02, 0.3 * side];
    const rootBack: Vec3 = [0.12, -0.03, 0.32 * side];
    const mid: Vec3 = [0.18, -0.03, 0.66 * side];
    const tip: Vec3 = [-0.12, -0.05, 1.02 * side];
    const lead: Vec3 = [0.32, -0.02, 0.6 * side];
    builder.sheet(root, lead, mid, flipperTop);
    builder.sheet(root, mid, rootBack, flipperTop);
    builder.sheet(lead, tip, mid, flipperEdge);
    builder.sheet(rootBack, mid, tip, flipperTop);

    builder.set('aPart', side > 0 ? 4 : 5);
    const hip: Vec3 = [-0.46, -0.03, 0.2 * side];
    const hipBack: Vec3 = [-0.56, -0.03, 0.15 * side];
    const paddle: Vec3 = [-0.72, -0.04, 0.36 * side];
    builder.sheet(hip, paddle, hipBack, flipperTop);
  }
  // Petite queue.
  builder.set('aPart', 0);
  builder.sheet([-0.6, -0.02, 0.04], [-0.6, -0.02, -0.04], [-0.76, -0.03, 0], tone('#7f7c4c'));
  return builder.build();
}

const uniforms = {
  uTime: { value: 0 },
  uWaveTime: { value: 0 },
  uStorm: { value: 0 },
  uBoat: { value: new Vector2() },
  uPresence: { value: 0 },
};

const PARS = /* glsl */ `
attribute float aPart;
attribute vec4 aOrbit;
attribute vec4 aSwim;
uniform float uTime;
uniform float uWaveTime;
uniform vec2 uBoat;
uniform float uPresence;
${WAVE_GLSL}

vec3 turtleRotX(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}
vec3 turtleRotY(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}
vec3 turtleRotZ(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}

// Respiration : une remontée toutes les ~45 s (même formule que côté CPU).
float turtleBreath(float t, float seed) {
  return smoothstep(0.84, 0.95, 0.5 + 0.5 * sin(t * 0.14 + seed * 3.0));
}
`;

const DEFORM = /* glsl */ `
// aOrbit : centre (x, z), rayon, phase ; aSwim : sens, vitesse angulaire, taille, graine.
float turtleAngle = aOrbit.w + uTime * aSwim.y * aSwim.x;
float turtleRadius = aOrbit.z + sin(uTime * 0.13 + aSwim.w) * 1.0 + sin(uTime * 0.31 + aSwim.w * 2.0) * 0.35;
vec2 turtlePos = aOrbit.xy + vec2(cos(turtleAngle), sin(turtleAngle)) * turtleRadius;
vec2 turtleTangent = vec2(-sin(turtleAngle), cos(turtleAngle)) * aSwim.x;
// Le bateau au-dessus : elle s'écarte, plonge et bat plus vite.
vec2 turtleAway = turtlePos - uBoat;
float turtleFear = 1.0 - smoothstep(3.5, 9.0, length(turtleAway));
turtlePos += normalize(turtleAway + 1e-4) * turtleFear * 1.6;
float turtleYaw = atan(turtleTangent.y, turtleTangent.x);
float turtleBreathing = turtleBreath(uTime, aSwim.w) * (1.0 - turtleFear);
float turtleStroke = uTime * (1.15 + turtleFear * 1.4) + aSwim.w * 5.0;

vec3 transformed = vec3(position);
// Nageoires avant : grand battement en aile (haut/bas) et balayage vers l'arrière.
if (aPart > 1.5 && aPart < 3.5) {
  float side = aPart < 2.5 ? 1.0 : -1.0;
  vec3 pivot = vec3(0.24, -0.02, 0.3 * side);
  vec3 rel = transformed - pivot;
  rel = turtleRotX(rel, side * (0.15 + sin(turtleStroke) * 0.55));
  rel = turtleRotY(rel, side * sin(turtleStroke - 1.3) * 0.32);
  transformed = pivot + rel;
}
// Nageoires arrière : petits coups de gouvernail.
if (aPart > 3.5) {
  float side = aPart < 4.5 ? 1.0 : -1.0;
  vec3 pivot = vec3(-0.48, -0.03, 0.18 * side);
  transformed = pivot + turtleRotY(transformed - pivot, side * sin(turtleStroke * 0.8 + 1.0) * 0.35);
}
// Tête : hoche doucement, se lève pour respirer.
if (aPart > 0.5 && aPart < 1.5) {
  vec3 pivot = vec3(0.44, 0.0, 0.0);
  vec3 rel = turtleRotY(transformed - pivot, sin(uTime * 0.6 + aSwim.w) * 0.18);
  transformed = pivot + turtleRotZ(rel, turtleBreathing * 0.35 + sin(turtleStroke) * 0.04);
}
// Profondeur : glisse sous la surface, remonte respirer, plonge si on l'effraie.
float turtleSurface = waveHeight(turtlePos, uWaveTime);
float turtleDepth = mix(-1.02, turtleSurface - 0.3, turtleBreathing)
  - turtleFear * 0.45 + sin(turtleStroke) * 0.035;
transformed *= aSwim.z * uPresence;
transformed = turtleRotZ(transformed, turtleBreathing * 0.22 - turtleFear * 0.18 + sin(turtleStroke) * 0.025);
transformed = turtleRotY(transformed, -turtleYaw);
transformed += vec3(turtlePos.x, turtleDepth, turtlePos.y);
`;

const TURTLE_GEOMETRY = turtleGeometry();
const TURTLE_MATERIAL = creatureMaterial('fauna-turtle-v1', uniforms, PARS, DEFORM, { roughness: 0.85 });

/** Même respiration que dans le shader, pour les ronds de surface. */
function breathAt(t: number, seed: number) {
  return smoothstep(0.84, 0.95, 0.5 + 0.5 * Math.sin(t * 0.14 + seed * 3));
}

function turtleSpeed(lagoon: TurtleLagoon) {
  // ≈ 0,55 m/s le long de l'orbite, un peu variable d'une tortue à l'autre.
  return (0.5 + hash(lagoon.seed * 1.7) * 0.15) / lagoon.radius;
}

export function SeaTurtles({ mobile }: { mobile: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const lagoons = useMemo(
    () => TURTLE_LAGOONS.filter((lagoon) => lagoon.mobile || (!mobile && quality !== 'low')),
    [mobile, quality],
  );
  const geometry = useMemo(() => {
    const result = TURTLE_GEOMETRY.clone();
    const orbit = new Float32Array(lagoons.length * 4);
    const swim = new Float32Array(lagoons.length * 4);
    lagoons.forEach((lagoon, index) => {
      orbit.set([lagoon.center[0], lagoon.center[1], lagoon.radius, hash(lagoon.seed * 2.3) * Math.PI * 2], index * 4);
      swim.set([lagoon.direction, turtleSpeed(lagoon), 1.05 + hash(lagoon.seed * 4.1) * 0.25, lagoon.seed], index * 4);
    });
    result.setAttribute('aOrbit', new InstancedBufferAttribute(orbit, 4));
    result.setAttribute('aSwim', new InstancedBufferAttribute(swim, 4));
    return result;
  }, [lagoons]);
  const memo = useRef({ prev: -1e9 });

  useFrame((state) => {
    const time = faunaClock(state.clock.elapsedTime);
    const { reveal } = useWorld.getState();
    uniforms.uTime.value = time;
    uniforms.uWaveTime.value = state.clock.elapsedTime;
    uniforms.uStorm.value = ecologyState.stormWaves;
    uniforms.uBoat.value.set(boatState.position.x, boatState.position.z);
    uniforms.uPresence.value = smoothstep(0.45, 1, reveal) * (0.35 + ecologyState.worldLife * 0.65);
    if (mesh.current) mesh.current.visible = uniforms.uPresence.value > 0.01;

    // Ronds de respiration : quand la carapace affleure.
    const prev = memo.current.prev;
    memo.current.prev = time;
    if (prev < 0 || reveal < 0.8) return;
    lagoons.forEach((lagoon) => {
      const before = breathAt(prev, lagoon.seed);
      const now = breathAt(time, lagoon.seed);
      if (crossed(before, now, 0.75) || (now > 0.9 && Math.floor(time / 1.6) !== Math.floor(prev / 1.6))) {
        const angle = hash(lagoon.seed * 2.3) * Math.PI * 2 + time * turtleSpeed(lagoon) * lagoon.direction;
        const radius = lagoon.radius + Math.sin(time * 0.13 + lagoon.seed) + Math.sin(time * 0.31 + lagoon.seed * 2) * 0.35;
        const x = lagoon.center[0] + Math.cos(angle) * radius;
        const z = lagoon.center[1] + Math.sin(angle) * radius;
        if (Math.hypot(x - boatState.position.x, z - boatState.position.z) < 9) return;
        emitRing(x + Math.cos(angle + Math.PI / 2 * lagoon.direction) * 0.6, z + Math.sin(angle + Math.PI / 2 * lagoon.direction) * 0.6, time, 1.4, 1.6, 0.2, 0.75);
        void waveHeight;
      }
    });
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, TURTLE_MATERIAL, lagoons.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  );
}
