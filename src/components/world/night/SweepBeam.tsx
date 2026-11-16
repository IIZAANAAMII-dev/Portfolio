'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { beams, type BeamSource } from './beams';

/**
 * Faisceau tournant d'un phare, la nuit : un cône de lumière au bord adouci, traversé d'embruns
 * qui dérivent (effet de volume, sans lumière réelle), légèrement incliné vers la mer, et son
 * reflet sur l'eau — une traînée de paillettes qui balaie les vagues sous le cône. Le phare
 * pilote l'intensité et la vitesse (`controlRef`) ; le faisceau tourne, publie son cap (beams.ts :
 * bateau pris dans le faisceau, mots de lumière) et rend son angle au phare (éclats, lentille).
 * Deux appels de dessin, cachés de jour.
 */
export interface BeamControl {
  /** Intensité voulue (0..1), écrite par le phare. */
  strength: number;
  /** Vitesse de rotation (rad/s), écrite par le phare. */
  speed: number;
  /** Rotation courante (rad, repère du phare) : écrite ici, lue par le phare. */
  angle: number;
}

const NOISE_GLSL = /* glsl */ `
float beamHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float beamNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(beamHash(i), beamHash(i + vec2(1.0, 0.0)), f.x),
             mix(beamHash(i + vec2(0.0, 1.0)), beamHash(i + 1.0), f.x), f.y);
}
`;

const coneVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormalView;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vView = -mv.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

const coneFragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormalView;
${NOISE_GLSL}
void main() {
  // uv.y = 1 à la lanterne, 0 au bout du cône.
  float along = vUv.y;
  float body = smoothstep(0.0, 0.6, along) * (0.45 + 0.55 * along);
  // Vu de biais, le bord du cône s'efface : un volume de lumière, pas un cornet.
  float facing = abs(dot(normalize(vNormalView), normalize(vView)));
  float soft = smoothstep(0.06, 0.7, facing);
  // Embruns qui dérivent dans le faisceau : il balaie une brume vivante.
  float mist = beamNoise(vWorld.xz * 0.3 + vec2(uTime * 0.32, uTime * 0.11)) * 0.6
    + beamNoise(vWorld.xz * 0.85 - vec2(uTime * 0.21, -uTime * 0.17)) * 0.4;
  float aboveSea = smoothstep(0.15, 1.3, vWorld.y);
  float alpha = body * soft * (0.45 + 0.75 * mist) * aboveSea * uStrength * 0.4;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

const wedgeVertex = /* glsl */ `
attribute vec2 aBeam;
varying vec2 vBeam;
varying vec3 vWorld;
void main() {
  vBeam = aBeam;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const wedgeFragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vBeam;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  // x : 0 au pied du phare → 1 au bout ; y : -1..1 d'un bord à l'autre.
  float across = exp(-vBeam.y * vBeam.y * 2.6);
  float reach = smoothstep(0.02, 0.3, vBeam.x) * (1.0 - smoothstep(0.62, 1.0, vBeam.x));
  float glint = beamNoise(vWorld.xz * 0.8 + vec2(uTime * 0.7, -uTime * 0.4))
    * beamNoise(vWorld.xz * 1.7 - vec2(uTime * 0.5, uTime * 0.6));
  glint = smoothstep(0.34, 0.6, glint);
  float alpha = across * reach * (0.12 + glint * 0.75) * uStrength;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

function coneGeometry(count: number, length: number, radius: number, tilt: number) {
  const parts: BufferGeometry[] = [];
  for (let index = 0; index < count; index++) {
    parts.push(
      new ConeGeometry(radius, length, 24, 1, true)
        .rotateZ(Math.PI / 2)
        .translate(length / 2, 0, 0)
        .rotateZ(-tilt)
        .rotateY((index / count) * Math.PI * 2),
    );
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

function wedgeGeometry(count: number, inner: number, outer: number, half: number) {
  const parts: BufferGeometry[] = [];
  for (let index = 0; index < count; index++) {
    const ring = new RingGeometry(inner, outer, 20, 6, -half, half * 2);
    const positions = ring.attributes.position;
    const beam = new Float32Array(positions.count * 2);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      beam[vertex * 2] = (Math.hypot(x, y) - inner) / (outer - inner);
      beam[vertex * 2 + 1] = Math.atan2(y, x) / half;
    }
    ring.setAttribute('aBeam', new BufferAttribute(beam, 2));
    ring.deleteAttribute('uv');
    ring.deleteAttribute('normal');
    parts.push(ring.rotateX(-Math.PI / 2).rotateY((index / count) * Math.PI * 2));
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

const lamp = new Vector3();
const axis = new Vector3();
const turn = new Quaternion();

export function SweepBeam({
  id,
  controlRef,
  count = 2,
  length = 32,
  radius = 2.8,
  tilt = 0.06,
  color = '#ffe2a8',
  position,
}: {
  id: string;
  /** Réglages écrits par le phare (intensité, vitesse) ; l'angle y est rendu. */
  controlRef: RefObject<BeamControl>;
  count?: number;
  length?: number;
  radius?: number;
  /** Inclinaison vers la mer (rad) : le faisceau rase les vagues au loin. */
  tilt?: number;
  color?: string;
  position?: [number, number, number];
}) {
  const group = useRef<Group>(null);
  const cone = useRef<Mesh>(null);
  const wedge = useRef<Mesh>(null);
  const source = useRef<BeamSource>({ x: 0, y: 0, z: 0, bearing: 0, count, spin: 0, spread: 0, reach: 0, strength: 0 });
  const spread = Math.atan2(radius, length);
  const geometries = useMemo(
    () => ({
      cone: coneGeometry(count, length, radius, tilt),
      wedge: wedgeGeometry(count, 1.2, length * 1.08, spread * 1.25),
    }),
    [count, length, radius, spread, tilt],
  );
  const materials = useMemo(() => {
    const tint = new Color(color);
    const make = (vertexShader: string, fragmentShader: string) =>
      new ShaderMaterial({
        uniforms: { uStrength: { value: 0 }, uTime: { value: 0 }, uColor: { value: tint.clone() } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      });
    return { cone: make(coneVertex, coneFragment), wedge: make(wedgeVertex, wedgeFragment) };
  }, [color]);
  useEffect(() => () => {
    geometries.cone.dispose();
    geometries.wedge.dispose();
  }, [geometries]);
  useEffect(() => () => {
    materials.cone.dispose();
    materials.wedge.dispose();
  }, [materials]);

  useEffect(() => {
    const entry = source.current;
    beams.set(id, entry);
    return () => {
      if (beams.get(id) === entry) beams.delete(id);
    };
  }, [id]);

  useFrame((state, delta) => {
    const target = group.current;
    const settings = controlRef.current;
    const entry = source.current;
    if (!target || !settings) return;
    const dt = Math.min(delta, 1 / 30);
    settings.angle = (settings.angle + dt * settings.speed) % (Math.PI * 2);
    target.rotation.y = settings.angle;
    const strength = settings.strength;
    const shown = strength > 0.02;
    target.visible = shown;
    entry.strength = shown ? strength : 0;
    if (!shown) return;

    target.getWorldPosition(lamp);
    axis.set(1, 0, 0).applyQuaternion(target.getWorldQuaternion(turn));
    entry.x = lamp.x;
    entry.y = lamp.y;
    entry.z = lamp.z;
    entry.bearing = Math.atan2(axis.z, axis.x);
    entry.count = count;
    // rotation.y croissante : le cap (atan2(z, x)) décroît.
    entry.spin = -settings.speed;
    entry.spread = spread;
    entry.reach = length * 1.05;

    const time = state.clock.elapsedTime;
    for (const mesh of [cone.current, wedge.current]) {
      const material = mesh?.material as ShaderMaterial | undefined;
      if (!material) continue;
      material.uniforms.uStrength.value = strength;
      material.uniforms.uTime.value = time;
    }
    // Le reflet reste posé sur la mer, quelle que soit la hauteur de la lanterne.
    if (wedge.current) wedge.current.position.y = 0.32 - lamp.y;
  });

  return (
    <group ref={group} position={position} visible={false}>
      <mesh ref={cone} geometry={geometries.cone} material={materials.cone} renderOrder={7} raycast={() => null} />
      <mesh ref={wedge} geometry={geometries.wedge} material={materials.wedge} renderOrder={5} raycast={() => null} />
    </group>
  );
}
