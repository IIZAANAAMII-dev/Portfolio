'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ClearingContext, type Clearing } from './clearings';
import type { HeightSampler } from './terrain-shape';

/**
 * Arbres tropicaux : des flamboyants à large ombrelle corail et quelques arbres verts.
 * Le houppier est fait de centaines de petites feuilles instanciées dont la normale est
 * celle de la sphère qui les porte : le feuillage s'éclaire en volume (sommet lumineux,
 * dessous dans l'ombre violette) tout en gardant une silhouette découpée. Deux draw calls
 * par île (feuilles + troncs). Les arbres évitent les clairières des bâtiments.
 */

/** Feuille : un losange. Sa normale réelle vient de l'attribut d'instance. */
function leafGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, -0.5, 0, 0.42, 0, 0, 0, 0.5, 0, -0.42, 0, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

const LEAF = leafGeometry();
const TRUNK = new CylinderGeometry(0.13, 0.26, 1, 6, 1).translate(0, 0.5, 0);

const shared = {
  uTime: { value: 0 },
  uWind: { value: new Vector3(0.84, 0, 0.54) },
};

const LEAF_VERTEX_PARS = /* glsl */ `
attribute vec3 aSphereNormal;
attribute float aSway;
uniform float uTime;
uniform vec3 uWind;
`;

const LEAF_NORMAL = /* glsl */ `
vec3 transformedNormal = normalMatrix * normalize( aSphereNormal );
`;

const LEAF_PROJECT = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  // Le houppier ondule d'un bloc, chaque feuille frémit en plus.
  vec3 leafAt = instanceMatrix[ 3 ].xyz;
  float sway = sin( uTime * 1.05 + leafAt.x * 0.16 + leafAt.z * 0.12 ) * 0.6 + sin( uTime * 1.85 + leafAt.z * 0.27 ) * 0.25;
  float flutter = sin( uTime * 6.3 + dot( leafAt, vec3( 12.9, 7.3, 4.1 ) ) );
  mvPosition.xyz += uWind * ( 0.05 + sway * 0.14 ) * aSway;
  mvPosition.y += flutter * 0.035 * aSway;
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const NORMAL_BEGIN = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createLeafMaterial() {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, side: DoubleSide });
  material.name = 'tree-leaves';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${LEAF_VERTEX_PARS}`)
      .replace('#include <defaultnormal_vertex>', LEAF_NORMAL)
      .replace('#include <project_vertex>', LEAF_PROJECT);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'tree-leaves-v1';
  return material;
}

const LEAF_MATERIAL = createLeafMaterial();
const TRUNK_MATERIAL = new MeshStandardMaterial({ color: '#7a5034', roughness: 1, metalness: 0, flatShading: true });

const FORWARD = new Vector3(0, 0, 1);
const GREEN = new Color('#5e9a44');
const GREEN_LIGHT = new Color('#9cc35a');

interface Leaf {
  offset: Vector3;
  normal: Vector3;
  rotation: Quaternion;
  size: number;
  sway: number;
  color: Color;
}

interface TreeDesign {
  height: number;
  girth: number;
  tilt: Vector3;
  leaves: Leaf[];
}

/** Un arbre : tronc légèrement penché, houppier en ombrelle fait de 3 à 4 masses. */
function designTree(seed: number, flame: Color): TreeDesign {
  const green = hash(seed * 1.9) < 0.3;
  const base = green ? GREEN : flame;
  const light = green ? GREEN_LIGHT : flame.clone().lerp(new Color('#ffc36b'), 0.45);
  const height = 2.6 + hash(seed * 2.3) * 1.4;
  const crown = 1.7 + hash(seed * 3.1) * 0.7;
  const lean = (hash(seed * 4.7) - 0.5) * 0.22;
  const leanAngle = hash(seed * 5.3) * Math.PI * 2;
  const tilt = new Vector3(Math.cos(leanAngle) * lean, 0, Math.sin(leanAngle) * lean);
  const top = new Vector3(tilt.x * height, height, tilt.z * height);

  // Masses du houppier : une centrale, deux ou trois autour, aplaties (ombrelle).
  const blobs = [{ center: top.clone().add(new Vector3(0, crown * 0.32, 0)), radius: crown }];
  const extra = 2 + Math.floor(hash(seed * 6.1) * 2);
  for (let index = 0; index < extra; index++) {
    const angle = (index / extra) * Math.PI * 2 + hash(seed * 7.7) * 2;
    blobs.push({
      center: top.clone().add(new Vector3(Math.cos(angle) * crown * 0.78, crown * (0.05 + hash(seed + index * 3.3) * 0.25), Math.sin(angle) * crown * 0.78)),
      radius: crown * (0.58 + hash(seed + index * 4.1) * 0.2),
    });
  }
  const volume = blobs.reduce((sum, blob) => sum + blob.radius ** 3, 0);

  const leaves: Leaf[] = [];
  const count = Math.round(380 + crown * 120);
  for (let index = 0; index < count; index++) {
    const key = seed * 13.1 + index * 1.618;
    // Masse choisie au prorata de son volume.
    let pick = hash(key) * volume;
    let blob = blobs[0];
    for (const candidate of blobs) {
      pick -= candidate.radius ** 3;
      if (pick <= 0) {
        blob = candidate;
        break;
      }
    }
    const u = hash(key + 0.37) * 2 - 1;
    const phi = hash(key + 0.71) * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const direction = new Vector3(ring * Math.cos(phi), u, ring * Math.sin(phi));
    // Surtout en surface : la silhouette reste nette, le cœur n'est pas gaspillé.
    const distance = blob.radius * (0.6 + 0.4 * Math.cbrt(hash(key + 1.13)));
    const offset = blob.center.clone().addScaledVector(direction, distance);
    // Dessous aplati : le houppier forme une ombrelle.
    offset.y = blob.center.y + direction.y * distance * (direction.y < 0 ? 0.42 : 0.72);
    const shell = distance / blob.radius;
    const tone = 0.86 + shell * 0.2 + (hash(key + 2.3) - 0.5) * 0.14;
    // La feuille fait face à l'extérieur du houppier (avec un peu de désordre) : la surface
    // est couverte sans trous, comme des écailles.
    const facing = direction.clone().add(
      new Vector3(hash(key + 3.1) - 0.5, hash(key + 3.7) - 0.5, hash(key + 4.3) - 0.5).multiplyScalar(0.9),
    ).normalize();
    const rotation = new Quaternion()
      .setFromUnitVectors(FORWARD, facing)
      .multiply(new Quaternion().setFromAxisAngle(FORWARD, hash(key + 4.9) * Math.PI * 2));
    leaves.push({
      offset,
      normal: direction,
      rotation,
      size: 0.3 + hash(key + 5.9) * 0.2,
      sway: Math.min(1, Math.max(0, offset.y / (height + crown))),
      color: base.clone().lerp(light, Math.max(0, direction.y) * 0.55 + hash(key + 6.7) * 0.2).multiplyScalar(tone),
    });
  }
  return { height, girth: 0.85 + hash(seed * 8.3) * 0.35, tilt, leaves };
}

interface Spot {
  x: number;
  y: number;
  z: number;
}

function slope(sampler: HeightSampler, x: number, z: number) {
  const dx = sampler(x + 0.5, z) - sampler(x - 0.5, z);
  const dz = sampler(x, z + 0.5) - sampler(x, z - 0.5);
  const gradient = Math.hypot(dx, dz);
  return gradient / Math.sqrt(1 + gradient * gradient);
}

function angleGap(a: number, b: number) {
  return Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
}

/** Emplacements possibles : sur le plateau, loin du ponton et du sommet (le monument). */
function candidateSpots(sampler: HeightSampler, radius: number, plateau: number, avoidAngle: number | undefined, seed: number) {
  const spots: Spot[] = [];
  for (let attempt = 1; spots.length < 14 && attempt < 260; attempt++) {
    const angle = hash(seed + attempt * 2.17) * Math.PI * 2;
    if (avoidAngle !== undefined && angleGap(angle, avoidAngle) < 0.6) continue;
    const spread = radius * (0.34 + hash(seed + attempt * 3.43) * 0.42);
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const y = sampler(x, z);
    if (y < plateau - 0.2 || slope(sampler, x, z) > 0.3) continue;
    spots.push({ x, y: y - 0.1, z });
  }
  return spots;
}

/** Premiers emplacements hors clairières, espacés d'au moins 4,2 m. */
function chooseSpots(spots: Spot[], wanted: number, clearings: Clearing[]) {
  const chosen: Spot[] = [];
  for (const spot of spots) {
    if (chosen.length >= wanted) break;
    if (clearings.some((c) => Math.hypot(spot.x - c.x, spot.z - c.z) < c.radius + 1.4)) continue;
    if (chosen.some((other) => Math.hypot(spot.x - other.x, spot.z - other.z) < 4.2)) continue;
    chosen.push(spot);
  }
  return chosen;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const position = new Vector3();
const scale = new Vector3();
const up = new Vector3(0, 1, 0);

export function Trees({
  sampler,
  radius,
  plateau,
  avoidAngle,
  seed,
  flame,
  count,
}: {
  sampler: HeightSampler;
  radius: number;
  plateau: number;
  /** Direction du ponton, laissée libre (absent : aucun secteur réservé). */
  avoidAngle?: number;
  seed: number;
  /** Couleur des flamboyants de cette île. */
  flame: string;
  count: number;
}) {
  const leaves = useRef<InstancedMesh>(null);
  const trunks = useRef<InstancedMesh>(null);
  const clearings = useContext(ClearingContext);
  const seenVersion = useRef(-1);
  const quality = useWorld((state) => state.quality);
  const wanted = quality === 'low' ? Math.max(1, count - 1) : count;

  const designs = useMemo(() => {
    const color = new Color(flame);
    return Array.from({ length: wanted }, (_, index) => designTree(seed * 7.3 + index * 19.1, color));
  }, [flame, seed, wanted]);
  const spots = useMemo(() => candidateSpots(sampler, radius, plateau, avoidAngle, seed), [avoidAngle, plateau, radius, sampler, seed]);
  const leafCount = designs.reduce((sum, design) => sum + design.leaves.length, 0);

  // Normales sphériques et amplitude du vent : fixées par feuille, une fois pour toutes.
  const geometry = useMemo(() => {
    const result = LEAF.clone();
    const normals = new Float32Array(leafCount * 3);
    const sway = new Float32Array(leafCount);
    let cursor = 0;
    for (const design of designs) {
      for (const leaf of design.leaves) {
        leaf.normal.toArray(normals, cursor * 3);
        sway[cursor] = leaf.sway;
        cursor += 1;
      }
    }
    result.setAttribute('aSphereNormal', new InstancedBufferAttribute(normals, 3));
    result.setAttribute('aSway', new InstancedBufferAttribute(sway, 1));
    return result;
  }, [designs, leafCount]);

  const layout = (clearingList: Clearing[]) => {
    const leafMesh = leaves.current;
    const trunkMesh = trunks.current;
    if (!leafMesh || !trunkMesh) return;
    const chosen = chooseSpots(spots, designs.length, clearingList);
    let cursor = 0;
    designs.forEach((design, index) => {
      const spot = chosen[index];
      // Pas de place : l'arbre est replié à l'échelle zéro (ni rendu, ni ombre).
      const visible = spot ? 1 : 0;
      const root = spot ?? { x: 0, y: 0, z: 0 };
      quaternion.setFromUnitVectors(up, position.set(design.tilt.x, 1, design.tilt.z).normalize());
      matrix.compose(position.set(root.x, root.y, root.z), quaternion, scale.set(design.girth * visible, design.height * visible, design.girth * visible));
      trunkMesh.setMatrixAt(index, matrix);
      for (const leaf of design.leaves) {
        quaternion.copy(leaf.rotation);
        matrix.compose(
          position.set(root.x + leaf.offset.x, root.y + leaf.offset.y, root.z + leaf.offset.z),
          quaternion,
          scale.setScalar(leaf.size * visible),
        );
        leafMesh.setMatrixAt(cursor, matrix);
        cursor += 1;
      }
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    leafMesh.computeBoundingSphere();
  };

  useLayoutEffect(() => {
    const leafMesh = leaves.current;
    if (!leafMesh) return;
    let cursor = 0;
    for (const design of designs) {
      for (const leaf of design.leaves) leafMesh.setColorAt(cursor++, leaf.color);
    }
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    seenVersion.current = -1;
  }, [designs]);

  useFrame((state) => {
    shared.uTime.value = state.clock.elapsedTime;
    const version = clearings?.version ?? 0;
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    layout(clearings?.list() ?? []);
  });

  if (designs.length === 0) return null;
  return (
    <>
      {/* Pas d'ombres reçues : l'auto-ombrage des feuilles ferait des taches ; le volume
          vient des normales sphériques et de la rampe cel-shading. */}
      <instancedMesh
        ref={leaves}
        args={[geometry, LEAF_MATERIAL, leafCount]}
        castShadow
        receiveShadow={false}
        raycast={() => null}
      />
      <instancedMesh ref={trunks} args={[TRUNK, TRUNK_MATERIAL, designs.length]} castShadow receiveShadow raycast={() => null} />
    </>
  );
}
