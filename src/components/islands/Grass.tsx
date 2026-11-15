'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { CLOUD_SHADOW_GLSL, cloudClock } from '@/lib/materials/cloud-shadow';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import { ClearingContext, MAX_CLEARINGS } from './clearings';
import { createFlowerMaterial, PETALS, wildflowerGeometry } from './props/Flowers';
import { tickWind, WIND_GLSL, windUniforms } from './props/wind';
import type { HeightSampler } from './terrain-shape';

/**
 * Herbe en lames : des touffes de lames épaisses, effilées et arquées, couchées par le vent,
 * qui donnent aux plateaux leur matière de « jouet peint ». Trois sortes de touffes (éventail,
 * herbes folles dorées, coussin ras), des taches d'herbe sèche et d'herbe grasse, et quelques
 * fleurs sauvages. Le vent est le champ partagé (`props/wind`) : chaque rafale couche l'herbe
 * et l'éclaircit en passant, comme une vague qui traverse l'île.
 * Deux InstancedMesh par île (lames, fleurs sauvages), sans ombre portée ; vent et
 * clairières calculés sur le GPU.
 */

/** Une lame arquée : 7 sommets sur trois étages, pointe effilée qui se courbe vers +z. */
function bladeGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0,
      -0.42, 0.34, 0.03, 0.42, 0.34, 0.03,
      -0.27, 0.68, 0.1, 0.27, 0.68, 0.1,
      0, 1, 0.22,
    ]), 3),
  );
  // Normales vers le ciel : la lame prend la lumière du sol, sans facettes sombres.
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(7 * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  // Dégradé de la lame : pied sombre et froid (occlusion), pointe claire et chaude.
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Float32Array([
      0.38, 0.45, 0.5, 0.38, 0.45, 0.5,
      0.7, 0.76, 0.72, 0.7, 0.76, 0.72,
      0.98, 1.0, 0.86, 0.98, 1.0, 0.86,
      1.28, 1.2, 0.86,
    ]), 3),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  return geometry;
}

const BLADE = bladeGeometry();
const WILDFLOWER = wildflowerGeometry();
const WILDFLOWER_MATERIAL = createFlowerMaterial('wildflowers');

/** Palette des touffes : herbe fraîche, herbe grasse, herbe brûlée par le soleil. */
const TUFTS = [new Color('#6f9a3c'), new Color('#4f7f33'), new Color('#93a646'), new Color('#c3a94e')];
const GOLDEN = new Color('#d8bf62');

const VERTEX_PARS = /* glsl */ `
varying vec2 vGrassWorld;
uniform vec3 uClearings[ ${MAX_CLEARINGS} ];
uniform int uClearingCount;
${WIND_GLSL}

float grassPatch( vec2 p ) {
  return sin( p.x * 0.19 + sin( p.y * 0.23 ) * 1.7 ) * sin( p.y * 0.17 + sin( p.x * 0.13 ) * 2.1 ) * 0.5 + 0.5;
}
`;

const VERTEX_MAIN = /* glsl */ `
#include <begin_vertex>
{
  vec3 grassRoot = vec3( instanceMatrix[ 3 ][ 0 ], instanceMatrix[ 3 ][ 1 ], instanceMatrix[ 3 ][ 2 ] );
  // Clairières : pas d'herbe sous les bâtiments, lisière progressive.
  float grassKeep = 1.0;
  for ( int i = 0; i < ${MAX_CLEARINGS}; i ++ ) {
    if ( i >= uClearingCount ) break;
    vec3 clearing = uClearings[ i ];
    grassKeep *= smoothstep( clearing.z * 0.8, clearing.z, distance( grassRoot.xz, clearing.xy ) );
  }
  transformed *= grassKeep;
  vGrassWorld = ( modelMatrix * vec4( grassRoot, 1.0 ) ).xz;

  // Vent : la pointe se couche, le pied reste ancré ; les rafales traversent l'île.
  float grassBend = position.y * position.y;
  float gust = windGust( vGrassWorld );
  float flutter = windFlutter( vGrassWorld * 1.7, 4.3 );
  float breathe = sin( uWindTime * 1.1 + dot( vGrassWorld, vec2( 0.31, 0.23 ) ) ) * 0.5 + 0.5;
  vec3 push = uWindDir * ( 0.07 + breathe * 0.05 + gust * 0.38 + flutter * 0.04 );
  // Poussée exprimée dans le repère de la lame (inverse de la matrice d'instance).
  vec3 axisX = instanceMatrix[ 0 ].xyz;
  vec3 axisY = instanceMatrix[ 1 ].xyz;
  vec3 axisZ = instanceMatrix[ 2 ].xyz;
  vec3 localPush = vec3(
    dot( axisX, push ) / dot( axisX, axisX ),
    dot( axisY, push ) / dot( axisY, axisY ),
    dot( axisZ, push ) / dot( axisZ, axisZ )
  );
  transformed += localPush * grassBend * grassKeep;
  transformed.y -= grassBend * gust * 0.16 * grassKeep;

  // Taches d'herbe sèche (dorée) et d'herbe grasse ; la rafale éclaircit les pointes couchées.
  float patchy = grassPatch( vGrassWorld );
  vColor.rgb *= mix( vec3( 0.9, 0.97, 0.92 ), vec3( 1.1, 1.04, 0.8 ), smoothstep( 0.35, 0.85, patchy ) );
  vColor.rgb *= 1.0 + gust * 0.26 * position.y;
}
`;

/** Normale non retournée sur la face arrière : les deux faces d'une lame sont éclairées pareil. */
const NORMAL_BEGIN = /* glsl */ `
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;

function createGrassMaterial() {
  const clearings = Array.from({ length: MAX_CLEARINGS }, () => new Vector3(0, 0, 0));
  const uniforms = {
    uClearings: { value: clearings },
    uClearingCount: { value: 0 },
  };
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    vertexColors: true,
  });
  material.name = 'grass-blades';
  material.userData.grass = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', VERTEX_MAIN);
    shader.uniforms.uCloudTime = cloudClock;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGrassWorld;\nuniform float uCloudTime;\n${CLOUD_SHADOW_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - cloudShadow(vGrassWorld, uCloudTime) * 0.2;')
      .replace('#include <normal_fragment_begin>', NORMAL_BEGIN);
  };
  material.customProgramCacheKey = () => 'grass-blades-v3';
  return material;
}

type GrassUniforms = ReturnType<typeof grassUniformsOf>;
function grassUniformsOf(material: MeshStandardMaterial) {
  return material.userData.grass as { uClearings: { value: Vector3[] }; uClearingCount: { value: number } };
}

interface Blade {
  x: number;
  y: number;
  z: number;
  rotation: number;
  lean: number;
  width: number;
  height: number;
  color: Color;
}

interface Bloom {
  x: number;
  y: number;
  z: number;
  yaw: number;
  size: number;
  key: number;
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

/** Touffes posées sur le plateau : hors plage, hors pente forte, hors secteur du ponton. */
function plant(
  sampler: HeightSampler,
  {
    radius,
    minHeight,
    avoidAngle,
    tufts,
    seed,
    palette,
    blooms: bloomRate,
  }: { radius: number; minHeight: number; avoidAngle?: number; tufts: number; seed: number; palette: Color[]; blooms: number },
) {
  const blades: Blade[] = [];
  const blooms: Bloom[] = [];
  let planted = 0;
  for (let attempt = 1; planted < tufts && attempt < tufts * 14; attempt++) {
    const angle = hash(seed + attempt * 1.37) * Math.PI * 2;
    if (avoidAngle !== undefined && angleGap(angle, avoidAngle) < 0.42) continue;
    const spread = radius * 0.86 * Math.sqrt(hash(seed + attempt * 3.71));
    const cx = Math.cos(angle) * spread;
    const cz = Math.sin(angle) * spread;
    if (sampler(cx, cz) < minHeight || slope(sampler, cx, cz) > 0.34) continue;
    planted += 1;

    const tone = hash(seed + attempt * 8.17);
    const base = palette[tone < 0.4 ? 0 : tone < 0.72 ? 1 : tone < 0.92 ? 2 : 3] ?? palette[0];
    // Trois sortes de touffes : éventail (courant), herbes folles hautes et dorées, coussin ras.
    const kind = hash(seed + attempt * 9.91);
    const wild = kind > 0.84;
    const cushion = kind < 0.16;
    const count = wild ? 4 + Math.floor(hash(seed + attempt * 4.91) * 3) : cushion ? 11 + Math.floor(hash(seed + attempt * 4.91) * 6) : 7 + Math.floor(hash(seed + attempt * 4.91) * 9);
    const tuftRadius = (cushion ? 0.34 : wild ? 0.22 : 0.28) + hash(seed + attempt * 6.29) * 0.36;
    const tuftHeight = wild ? 0.95 + hash(seed + attempt * 7.43) * 0.45 : cushion ? 0.32 + hash(seed + attempt * 7.43) * 0.18 : 0.55 + hash(seed + attempt * 7.43) * 0.5;
    const hue = (hash(seed + attempt * 2.71) - 0.5) * 0.12;
    for (let index = 0; index < count; index++) {
      const key = seed + attempt * 13.7 + index * 2.39;
      const a = hash(key) * Math.PI * 2;
      const d = tuftRadius * Math.sqrt(hash(key + 0.71));
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const centre = 1 - (d / tuftRadius) * 0.45;
      const color = (wild ? base.clone().lerp(GOLDEN, 0.45 + hash(key + 6.1) * 0.3) : base.clone()).multiplyScalar(0.84 + hash(key + 5.53) * 0.3);
      color.r *= 1 + hue;
      color.b *= 1 - hue;
      blades.push({
        x,
        y: sampler(x, z) - 0.04,
        z,
        // La lame se penche vers l'extérieur de la touffe (l'axe +Z local, après rotation,
        // pointe à l'opposé du centre) : les touffes s'ouvrent en éventail.
        rotation: Math.PI / 2 - a + (hash(key + 1.13) - 0.5) * 0.7,
        lean: (d / tuftRadius) * (cushion ? 0.55 : 0.34) + (hash(key + 2.21) - 0.5) * 0.16,
        width: (wild ? 0.11 : cushion ? 0.24 : 0.2) + hash(key + 3.37) * 0.13,
        height: tuftHeight * centre * (0.75 + hash(key + 4.19) * 0.4),
        color,
      });
    }
    // Fleurs sauvages : une ou deux au cœur de quelques touffes.
    if (hash(seed + attempt * 5.83) < bloomRate) {
      const flowers = 1 + Math.floor(hash(seed + attempt * 6.97) * 2);
      for (let index = 0; index < flowers; index++) {
        const key = seed + attempt * 7.1 + index * 3.9;
        const a = hash(key) * Math.PI * 2;
        const d = tuftRadius * 0.5 * hash(key + 0.5);
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        blooms.push({ x, y: sampler(x, z) - 0.03, z, yaw: hash(key + 1.7) * Math.PI * 2, size: 0.85 + hash(key + 2.9) * 0.5, key: hash(key + 4.1) });
      }
    }
  }
  return { blades, blooms };
}

const dummy = new Object3D();
const hidden = new Matrix4().makeScale(0, 0, 0);

export function Grass({
  sampler,
  radius,
  plateau,
  avoidAngle,
  seed,
  palette,
  amount = 1,
}: {
  sampler: HeightSampler;
  radius: number;
  /** Altitude du premier plateau : sous elle, c'est la plage ou la falaise. */
  plateau: number;
  /** Direction du ponton : l'herbe laisse le passage libre (absent : aucun secteur réservé). */
  avoidAngle?: number;
  seed: number;
  /** Quatre couleurs de touffes (de la plus courante à la plus rare). */
  palette?: string[];
  /** Multiplicateur de quantité (1 : normale). */
  amount?: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const flowerMesh = useRef<InstancedMesh>(null);
  const clearings = useContext(ClearingContext);
  const seenVersion = useRef(-1);
  const quality = useWorld((state) => state.quality);
  const density = QUALITY_LEVELS[quality].vegetationDensity;
  const material = useMemo(() => createGrassMaterial(), []);
  const paletteKey = palette?.join('|') ?? '';
  const { blades, blooms } = useMemo(
    () => plant(sampler, {
      radius,
      minHeight: plateau - 0.35,
      avoidAngle,
      tufts: Math.round(radius * radius * 1.9 * density * amount),
      seed,
      palette: paletteKey ? paletteKey.split('|').map((color) => new Color(color)) : TUFTS,
      blooms: quality === 'low' ? 0 : 0.1,
    }),
    [amount, avoidAngle, density, paletteKey, plateau, quality, radius, sampler, seed],
  );

  // Fleurs sauvages : couleurs de l'archipel, attribut d'exemplaire (couleur + phase).
  const flowerGeometry = useMemo(() => {
    const geometry = WILDFLOWER.clone();
    const data = new Float32Array(Math.max(1, blooms.length) * 4);
    const tint = new Color();
    blooms.forEach((bloom, index) => {
      tint.set(PETALS[Math.floor(hash(bloom.key * 17.3 + seed) * PETALS.length) % PETALS.length]);
      data.set([tint.r, tint.g, tint.b, bloom.key], index * 4);
    });
    geometry.setAttribute('aFlower', new InstancedBufferAttribute(data, 4));
    return geometry;
  }, [blooms, seed]);
  useLayoutEffect(() => () => flowerGeometry.dispose(), [flowerGeometry]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    blades.forEach((blade, index) => {
      dummy.position.set(blade.x, blade.y, blade.z);
      dummy.rotation.set(blade.lean, blade.rotation, 0, 'YXZ');
      dummy.scale.set(blade.width, blade.height, 1);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, blade.color);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
    seenVersion.current = -1;
  }, [blades]);

  useFrame((state) => {
    tickWind(state.clock.elapsedTime);
    const target = mesh.current;
    if (!target || !clearings || clearings.version === seenVersion.current) return;
    seenVersion.current = clearings.version;
    const uniforms: GrassUniforms = grassUniformsOf(target.material as MeshStandardMaterial);
    const list = clearings.list();
    list.forEach((clearing, index) => uniforms.uClearings.value[index].set(clearing.x, clearing.z, clearing.radius));
    uniforms.uClearingCount.value = list.length;
    // Les fleurs sauvages s'effacent aussi sous les bâtiments.
    const flowers = flowerMesh.current;
    if (!flowers) return;
    blooms.forEach((bloom, index) => {
      if (list.some((clearing) => Math.hypot(bloom.x - clearing.x, bloom.z - clearing.z) < clearing.radius)) {
        flowers.setMatrixAt(index, hidden);
        return;
      }
      dummy.position.set(bloom.x, bloom.y, bloom.z);
      dummy.rotation.set(0, bloom.yaw, 0);
      dummy.scale.setScalar(bloom.size);
      dummy.updateMatrix();
      flowers.setMatrixAt(index, dummy.matrix);
    });
    flowers.instanceMatrix.needsUpdate = true;
    flowers.computeBoundingSphere();
  });

  if (blades.length === 0) return null;
  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[BLADE, material, blades.length]}
        receiveShadow
        castShadow={false}
        // Des milliers de lames : jamais testées par le pointeur (le clic vise l'île).
        raycast={() => null}
      />
      {blooms.length > 0 && (
        <instancedMesh
          ref={flowerMesh}
          args={[flowerGeometry, WILDFLOWER_MATERIAL, blooms.length]}
          receiveShadow
          castShadow={false}
          raycast={() => null}
        />
      )}
    </>
  );
}
