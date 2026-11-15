'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial } from 'three';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';

/**
 * Papillons : quelques ailes colorées qui volettent au-dessus des fleurs, le jour. Tout le
 * vol est calculé sur le GPU (boucle autour d'un point, montées et descentes, battements
 * irréguliers, planés) : un draw call, aucune matrice réécrite par image. Ils se posent
 * (disparaissent) au crépuscule.
 */

/** Papillon : corps fin le long de +x (la tête), deux paires d'ailes ; `aWing` = côté. */
function butterflyGeometry() {
  const positions: number[] = [];
  const wings: number[] = [];
  const shades: number[] = [];
  const push = (points: number[][], side: number, shade: number) => {
    for (const point of points) {
      positions.push(...point);
      wings.push(side);
      shades.push(shade);
    }
  };
  for (const side of [1, -1]) {
    // Aile avant (grande) et aile arrière (plus ronde), à plat dans le plan xz.
    push([[0.02, 0, 0.01 * side], [0.13, 0, 0.17 * side], [-0.03, 0, 0.2 * side]], side, 1);
    push([[0.02, 0, 0.01 * side], [-0.03, 0, 0.2 * side], [-0.06, 0, 0.03 * side]], side, 0.85);
    push([[-0.02, 0, 0.01 * side], [-0.06, 0, 0.13 * side], [-0.14, 0, 0.08 * side]], side, 0.75);
  }
  // Corps.
  push([[0.07, 0.008, 0], [-0.09, 0.008, 0.012], [-0.09, 0.008, -0.012]], 0, 0.25);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(positions.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geometry.setAttribute('aWing', new BufferAttribute(new Float32Array(wings), 1));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(shades.flatMap((shade) => [shade, shade, shade])), 3));
  return geometry;
}

const FLIGHT_PARS = /* glsl */ `
attribute float aWing;
attribute vec4 aPath;
attribute vec4 aMotion;
attribute vec3 aTint;
uniform float uTime;
uniform float uPresence;
`;

const FLIGHT_VERTEX = /* glsl */ `
vec3 transformed = vec3( position );
{
  float t = uTime * aMotion.x + aMotion.y;
  // Boucle irrégulière autour du massif de fleurs, montées et descentes.
  vec2 loop = vec2( cos( t ) + 0.35 * cos( t * 2.3 + 1.0 ), sin( t * 1.1 ) + 0.3 * sin( t * 2.9 ) ) * aPath.z;
  float height = aPath.w + sin( t * 3.1 ) * 0.25 + sin( t * 7.3 ) * 0.06;
  vec2 ahead = vec2( - sin( t ) - 0.8 * sin( t * 2.3 + 1.0 ), 1.1 * cos( t * 1.1 ) + 0.87 * cos( t * 2.9 ) );
  float yaw = atan( ahead.y, ahead.x );
  // Battements rapides, entrecoupés de courts planés.
  float glide = smoothstep( 0.6, 0.95, sin( uTime * 0.9 + aMotion.y * 3.0 ) );
  float flap = mix( sin( uTime * aMotion.z + aMotion.y * 5.0 ) * 1.05, 0.35, glide );
  if ( aWing != 0.0 ) {
    float reach = abs( transformed.z );
    transformed.y = sin( flap ) * reach;
    transformed.z = aWing * cos( flap ) * reach;
  }
  transformed *= aMotion.w * uPresence;
  float c = cos( yaw );
  float s = sin( yaw );
  transformed = vec3( transformed.x * c - transformed.z * s, transformed.y, transformed.x * s + transformed.z * c );
  transformed += vec3( aPath.x + loop.x, height, aPath.y + loop.y );
}
`;

const FLAT_FACES = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createButterflyMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.8, metalness: 0, side: DoubleSide });
  material.name = 'butterflies';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, flight);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLIGHT_PARS}`)
      .replace('#include <begin_vertex>', FLIGHT_VERTEX)
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb *= aTint;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', FLAT_FACES);
  };
  material.customProgramCacheKey = () => 'butterflies-v1';
  return material;
}

const flight = { uTime: { value: 0 }, uPresence: { value: 1 } };
const GEOMETRY = butterflyGeometry();
const MATERIAL = createButterflyMaterial();
const COLORS = ['#f29a3c', '#f7f1e3', '#f2d24f', '#86bbe8', '#e8789a'];

export function Butterflies({
  spots,
  seed = 1,
}: {
  /** Massifs survolés : [x, hauteur du sol, z] dans le repère de l'île. */
  spots: [number, number, number][];
  seed?: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useWorld((state) => state.quality);
  const key = JSON.stringify(spots);
  const geometry = useMemo(() => {
    const list = JSON.parse(key) as [number, number, number][];
    const result = GEOMETRY.clone();
    const path = new Float32Array(Math.max(1, list.length) * 4);
    const motion = new Float32Array(Math.max(1, list.length) * 4);
    const colors = new Float32Array(Math.max(1, list.length) * 3);
    const tint = new Color();
    list.forEach(([x, y, z], index) => {
      const k = seed + index * 7.31;
      path.set([x, z, 0.9 + hash(k) * 1.1, y + 0.7 + hash(k + 1.3) * 0.7], index * 4);
      motion.set([(0.35 + hash(k + 2.1) * 0.25) * (hash(k + 2.9) > 0.5 ? 1 : -1), hash(k + 3.7) * 6.28, 15 + hash(k + 4.3) * 7, 0.85 + hash(k + 5.9) * 0.4], index * 4);
      tint.set(COLORS[Math.floor(hash(k + 6.6) * COLORS.length) % COLORS.length]);
      colors.set([tint.r, tint.g, tint.b], index * 3);
    });
    result.setAttribute('aPath', new InstancedBufferAttribute(path, 4));
    result.setAttribute('aMotion', new InstancedBufferAttribute(motion, 4));
    result.setAttribute('aTint', new InstancedBufferAttribute(colors, 3));
    return result;
  }, [key, seed]);
  const count = quality === 'low' ? 0 : JSON.parse(key).length as number;

  useFrame((state) => {
    flight.uTime.value = state.clock.elapsedTime;
    // Ils disparaissent au crépuscule.
    flight.uPresence.value = 1 - Math.min(1, Math.max(0, (skyState.dayNight - 0.15) * 3));
    if (mesh.current) mesh.current.visible = flight.uPresence.value > 0.02;
  });

  if (count === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, MATERIAL, count]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  );
}
