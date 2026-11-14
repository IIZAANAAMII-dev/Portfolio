'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
} from 'three';
import { ecologyState } from '@/lib/ecology';
import { hash } from '@/lib/utils/math';
import { WAVE_GLSL } from '@/lib/waves';
import { faunaClock } from './shared';

/**
 * Éclaboussures de la faune : gouttelettes balistiques et ronds d'écume, entièrement animés
 * sur le GPU. Une créature « émet » en écrivant quelques valeurs dans un tampon circulaire
 * (instant de départ compris) : aucune matrice n'est recalculée par image, deux draw calls
 * pour tout l'océan, et rien n'est dessiné quand plus rien ne vole.
 * La nuit, gouttes et anneaux s'allument du cyan du plancton.
 */

const DROPS = 240;
const RINGS = 48;

const dropOrigin = new Float32Array(DROPS * 3);
/** vx, vy, vz, traînée de l'air (brume du souffle de baleine : grossit et ralentit). */
const dropVelocity = new Float32Array(DROPS * 4);
/** départ, durée, taille, gravité relative. */
const dropLife = new Float32Array(DROPS * 4);
/** x, z, départ, rayon final. */
const ringPlace = new Float32Array(RINGS * 4);
/** durée, épaisseur relative, opacité, inutilisé. */
const ringShape = new Float32Array(RINGS * 4);
for (let index = 0; index < DROPS; index++) dropLife[index * 4] = -1e5;
for (let index = 0; index < RINGS; index++) ringPlace[index * 4 + 2] = -1e5;

const pool = { drop: 0, ring: 0, dropsDirty: false, ringsDirty: false, dropsUntil: -1e5, ringsUntil: -1e5, seed: 0 };

/** Aléa déterministe (captures figées reproductibles). */
function random() {
  pool.seed += 1;
  return hash(pool.seed * 12.9898 + 4.1);
}

/** Une gouttelette. Gravité relative : 1 = eau, ~0.1 = brume portée par l'air. */
export function emitDrop(
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  start: number, duration: number, size: number,
  gravity = 1, drag = 0,
) {
  const index = pool.drop;
  pool.drop = (pool.drop + 1) % DROPS;
  dropOrigin[index * 3] = x;
  dropOrigin[index * 3 + 1] = y;
  dropOrigin[index * 3 + 2] = z;
  dropVelocity[index * 4] = vx;
  dropVelocity[index * 4 + 1] = vy;
  dropVelocity[index * 4 + 2] = vz;
  dropVelocity[index * 4 + 3] = drag;
  dropLife[index * 4] = start;
  dropLife[index * 4 + 1] = duration;
  dropLife[index * 4 + 2] = size;
  dropLife[index * 4 + 3] = gravity;
  pool.dropsDirty = true;
  pool.dropsUntil = Math.max(pool.dropsUntil, start + duration);
}

/** Rond d'écume qui s'élargit. `thickness` : 0.18 anneau fin, 1 disque d'écume plein. */
export function emitRing(
  x: number, z: number, start: number, size: number,
  duration = 1.5, thickness = 0.2, strength = 1,
) {
  const index = pool.ring;
  pool.ring = (pool.ring + 1) % RINGS;
  ringPlace[index * 4] = x;
  ringPlace[index * 4 + 1] = z;
  ringPlace[index * 4 + 2] = start;
  ringPlace[index * 4 + 3] = size;
  ringShape[index * 4] = duration;
  ringShape[index * 4 + 1] = thickness;
  ringShape[index * 4 + 2] = strength;
  pool.ringsDirty = true;
  pool.ringsUntil = Math.max(pool.ringsUntil, start + duration);
}

/**
 * Gerbe d'entrée ou de sortie d'eau : couronne de gouttes + anneau. `dirX/dirZ` penchent la
 * gerbe dans le sens du mouvement (un dauphin qui file projette l'eau vers l'avant).
 */
export function splash(
  x: number, z: number, start: number, strength = 1,
  dirX = 0, dirZ = 0, rings = true,
) {
  const count = Math.round(5 + strength * 9);
  const root = Math.sqrt(strength);
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + random() * 0.6;
    const radial = (0.8 + random() * 1.6) * root;
    const lift = (2.6 + random() * 3.2) * root;
    emitDrop(
      x + Math.cos(angle) * 0.25 * strength, 0.05, z + Math.sin(angle) * 0.25 * strength,
      Math.cos(angle) * radial + dirX * 1.6, lift, Math.sin(angle) * radial + dirZ * 1.6,
      start + random() * 0.05, 0.7 + random() * 0.45 * root,
      (0.06 + random() * 0.08) * (0.7 + strength * 0.45),
    );
  }
  if (rings) {
    emitRing(x, z, start, 1.1 + strength * 1.4, 1.2 + strength * 0.5, 0.22, 0.9);
    if (strength > 0.9) emitRing(x, z, start + 0.18, 1.6 + strength * 2.2, 1.7 + strength * 0.4, 0.14, 0.7);
  }
}

/** Souffle de baleine : colonne de brume qui monte, s'évase et s'effiloche. */
export function spout(x: number, y: number, z: number, start: number, strength = 1) {
  const count = Math.round(24 * strength);
  for (let index = 0; index < count; index++) {
    const angle = random() * Math.PI * 2;
    const spread = 0.3 + random() * 1.1;
    const lift = (6.5 + random() * 4.5) * strength;
    emitDrop(
      x, y, z,
      Math.cos(angle) * spread, lift, Math.sin(angle) * spread,
      start + random() * 0.35, 1.7 + random() * 1.0,
      0.18 + random() * 0.16, 0.12, 1.7,
    );
  }
}

/** Gouttes qui ruissellent d'un bord (nageoire caudale levée). */
export function drips(x: number, y: number, z: number, start: number, count: number, spread = 1) {
  for (let index = 0; index < count; index++) {
    emitDrop(
      x + (random() - 0.5) * spread, y - random() * 0.2, z + (random() - 0.5) * spread,
      (random() - 0.5) * 0.3, -random() * 0.4, (random() - 0.5) * 0.3,
      start + random() * 0.6, 0.9, 0.05 + random() * 0.04,
    );
  }
}

/* --------------------------------------------------------------------------- GPU */

const uniforms = {
  uTime: { value: 0 },
  uWaveTime: { value: 0 },
  uStorm: { value: 0 },
};

function dropGeometry() {
  const geometry = new IcosahedronGeometry(1, 0);
  geometry.setAttribute('aOrigin', new InstancedBufferAttribute(dropOrigin, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aVelocity', new InstancedBufferAttribute(dropVelocity, 4).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aLife', new InstancedBufferAttribute(dropLife, 4).setUsage(DynamicDrawUsage));
  return geometry;
}

function ringGeometry() {
  const geometry = new RingGeometry(0.82, 1, 36, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('aRing', new InstancedBufferAttribute(ringPlace, 4).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aRingShape', new InstancedBufferAttribute(ringShape, 4).setUsage(DynamicDrawUsage));
  return geometry;
}

const DROP_GEOMETRY = dropGeometry();
const RING_GEOMETRY = ringGeometry();

const DROP_MATERIAL = new MeshStandardMaterial({
  color: '#f3fbfa',
  roughness: 0.4,
  metalness: 0,
  flatShading: true,
  emissive: new Color('#38e8e0'),
  emissiveIntensity: 0,
});
DROP_MATERIAL.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec3 aOrigin;
attribute vec4 aVelocity;
attribute vec4 aLife;
uniform float uTime;`)
    .replace('#include <begin_vertex>', `
float dropAge = uTime - aLife.x;
float dropK = dropAge / max(aLife.y, 0.001);
float dropAlive = step(0.0, dropAge) * step(dropK, 1.0);
float dropDrag = 1.0 + aVelocity.w * max(dropAge, 0.0) * 0.6;
vec3 dropPos = aOrigin + aVelocity.xyz * dropAge / dropDrag;
dropPos.y -= 4.9 * aLife.w * dropAge * dropAge;
vec3 dropVel = aVelocity.xyz / (dropDrag * dropDrag) + vec3(0.0, -9.8 * aLife.w * dropAge, 0.0);
// La brume grossit en s'effilochant ; tout rapetisse en fin de vie.
float dropSize = aLife.z * (1.0 + aVelocity.w * dropK) * (1.0 - dropK * dropK * 0.8);
// Une goutte qui retombe dans l'eau disparaît.
dropSize *= dropAlive * smoothstep(-0.3, 0.02, dropPos.y);
float dropSpeed = length(dropVel);
vec3 dropDir = dropSpeed > 0.001 ? dropVel / dropSpeed : vec3(0.0, 1.0, 0.0);
vec3 transformed = position * dropSize;
// Étirement le long de la trajectoire : des traits d'eau, pas des billes.
transformed += dropDir * dot(position, dropDir) * dropSize
  * clamp(dropSpeed * 0.09, 0.0, 1.2) * max(1.0 - aVelocity.w * 0.3, 0.0);
transformed += dropPos;`);
};
DROP_MATERIAL.customProgramCacheKey = () => 'fauna-drops-v1';

const RING_DAY = new Color('#f5fcfa');
const RING_NIGHT = new Color('#7ef6ec');
const RING_MATERIAL = new MeshBasicMaterial({
  color: '#f5fcfa',
  transparent: true,
  depthWrite: false,
  side: DoubleSide,
});
RING_MATERIAL.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec4 aRing;
attribute vec4 aRingShape;
uniform float uTime;
uniform float uWaveTime;
varying float vRingAlpha;
${WAVE_GLSL}`)
    .replace('#include <begin_vertex>', `
float ringAge = uTime - aRing.z;
float ringK = clamp(ringAge / max(aRingShape.x, 0.001), 0.0, 1.0);
float ringAlive = step(0.0, ringAge) * step(ringAge, aRingShape.x);
float ringR = length(position.xz);
float ringT = clamp((ringR - 0.82) / 0.18, 0.0, 1.0);
float ringRadius = mix(1.0 - aRingShape.y, 1.0, ringT);
vec2 ringDir = ringR > 0.0001 ? position.xz / ringR : vec2(0.0);
// Départ vif, arrivée lente.
float ringGrow = aRing.w * (0.3 + (1.0 - pow(1.0 - ringK, 2.4)) * 0.85);
vec2 ringWorld = aRing.xy + ringDir * ringRadius * ringGrow * ringAlive;
vec3 transformed = vec3(ringWorld.x, waveHeight(ringWorld, uWaveTime) + 0.08, ringWorld.y);
vRingAlpha = ringAlive * pow(1.0 - ringK, 1.5) * aRingShape.z;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying float vRingAlpha;`)
    .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
diffuseColor.a *= vRingAlpha;`);
};
RING_MATERIAL.customProgramCacheKey = () => 'fauna-rings-v1';

/** Monté une seule fois (SeaLife) : publie les tampons et éteint ce qui ne vit plus. */
export function Splashes() {
  const dropsMesh = useRef<InstancedMesh>(null);
  const ringsMesh = useRef<InstancedMesh>(null);

  useFrame((state) => {
    const time = faunaClock(state.clock.elapsedTime);
    uniforms.uTime.value = time;
    uniforms.uWaveTime.value = state.clock.elapsedTime;
    uniforms.uStorm.value = ecologyState.stormWaves;
    const night = ecologyState.plankton;
    DROP_MATERIAL.emissiveIntensity = night * 1.3;
    DROP_MATERIAL.color.setScalar(1 - night * 0.55);
    RING_MATERIAL.color.copy(RING_DAY).lerp(RING_NIGHT, night);
    RING_MATERIAL.opacity = 0.78 + night * 0.22;

    if (pool.dropsDirty) {
      pool.dropsDirty = false;
      DROP_GEOMETRY.getAttribute('aOrigin').needsUpdate = true;
      DROP_GEOMETRY.getAttribute('aVelocity').needsUpdate = true;
      DROP_GEOMETRY.getAttribute('aLife').needsUpdate = true;
    }
    if (pool.ringsDirty) {
      pool.ringsDirty = false;
      RING_GEOMETRY.getAttribute('aRing').needsUpdate = true;
      RING_GEOMETRY.getAttribute('aRingShape').needsUpdate = true;
    }
    if (dropsMesh.current) dropsMesh.current.visible = time < pool.dropsUntil + 0.1;
    if (ringsMesh.current) ringsMesh.current.visible = time < pool.ringsUntil + 0.1;
  });

  return (
    <>
      <instancedMesh
        ref={dropsMesh}
        args={[DROP_GEOMETRY, DROP_MATERIAL, DROPS]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
        raycast={() => null}
        visible={false}
      />
      <instancedMesh
        ref={ringsMesh}
        args={[RING_GEOMETRY, RING_MATERIAL, RINGS]}
        frustumCulled={false}
        renderOrder={7}
        raycast={() => null}
        visible={false}
      />
    </>
  );
}
