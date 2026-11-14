'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  OctahedronGeometry,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ambience } from '@/lib/audio/ambience';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { glowTexture } from '../../docks/parts';
import type { LighthouseFrame } from './build';

/**
 * Lanterne du phare : vitre chaude, lentille à facettes qui tourne derrière, deux faisceaux
 * qui balaient la mer à la nuit tombée, halo, et une girouette en forme de poisson. Un clic
 * sur la tour fait tourner le feu à toute vitesse quelques secondes, même en plein jour.
 */

const beamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const beamFragment = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
void main() {
  // Le faisceau s'éteint en s'éloignant de la lanterne (uv.y = 1 au sommet du cône).
  float along = smoothstep(0.0, 1.0, vUv.y);
  gl_FragColor = vec4(vec3(1.0, 0.88, 0.62), along * along * 0.55 * uStrength);
}
`;

function beamGeometry() {
  // Deux cônes opposés, sommet sur la lampe.
  const length = 30;
  const one = new ConeGeometry(2.6, length, 20, 1, true).rotateZ(Math.PI / 2).translate(length / 2, 0, 0);
  const two = one.clone().rotateY(Math.PI);
  return mergeGeometries([one, two])!;
}

function vaneGeometry() {
  // Girouette : un petit poisson (corps en amande, queue fourchue) et sa flèche.
  const fish = new Shape();
  fish.moveTo(0.34, 0);
  fish.quadraticCurveTo(0.12, 0.13, -0.12, 0.03);
  fish.lineTo(-0.26, 0.12);
  fish.lineTo(-0.22, 0);
  fish.lineTo(-0.26, -0.12);
  fish.lineTo(-0.12, -0.03);
  fish.quadraticCurveTo(0.12, -0.13, 0.34, 0);
  const body = new ShapeGeometry(fish, 6);
  const rod = new CylinderGeometry(0.012, 0.012, 0.3, 4).rotateZ(Math.PI / 2).translate(0.05, 0, 0);
  rod.deleteAttribute('uv');
  body.deleteAttribute('uv');
  return mergeGeometries([body.toNonIndexed(), rod.toNonIndexed()])!;
}

const GLASS = new MeshStandardMaterial({
  color: '#fff1cf',
  emissive: '#ffcf7a',
  emissiveIntensity: 0.5,
  roughness: 0.15,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});
const LENS = new MeshStandardMaterial({ color: '#fff8e6', emissive: '#ffd98f', emissiveIntensity: 1.2, roughness: 0.2, flatShading: true });
const VANE = new MeshStandardMaterial({ color: '#2f343c', roughness: 0.5, metalness: 0.3, side: DoubleSide });
const BEAM = new ShaderMaterial({
  uniforms: { uStrength: { value: 0 } },
  vertexShader: beamVertex,
  fragmentShader: beamFragment,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
});
const HALO = new SpriteMaterial({ map: glowTexture(), color: '#ffd391', transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });

export function LighthouseLamp({ frame }: { frame: LighthouseFrame }) {
  const beam = useRef<Group>(null);
  const lens = useRef<Group>(null);
  const vane = useRef<Group>(null);
  const halo = useRef<Sprite>(null);
  const flashAt = useRef(-100);
  const clock = useThree((state) => state.clock);
  const beamShape = useMemo(() => beamGeometry(), []);
  const vaneShape = useMemo(() => vaneGeometry(), []);
  const glassShape = useMemo(() => new CylinderGeometry(0.64, 0.64, 1.0, 10, 1, true), []);
  const lensShape = useMemo(() => new OctahedronGeometry(0.3, 0).scale(1, 1.25, 1), []);

  useEffect(
    () => () => [beamShape, vaneShape, glassShape, lensShape].forEach((item) => item.dispose()),
    [beamShape, glassShape, lensShape, vaneShape],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const flash = Math.max(0, 1 - (time - flashAt.current) / 4.5);
    const strength = Math.max(night, flash * 0.85);
    if (beam.current) {
      beam.current.rotation.y += dt * (0.55 + flash * 3.4);
      beam.current.visible = strength > 0.03;
    }
    if (lens.current) lens.current.rotation.y = beam.current ? beam.current.rotation.y : 0;
    BEAM.uniforms.uStrength.value = strength * (0.85 + Math.sin(time * 1.7) * 0.06);
    GLASS.emissiveIntensity = 0.5 + Math.max(night, flash) * 2.4 + Math.sin(time * 2.2) * 0.08;
    LENS.emissiveIntensity = 1.1 + Math.max(night, flash) * 2.6;
    HALO.opacity = strength * 0.75;
    if (halo.current) halo.current.visible = strength > 0.03;
    // Girouette : elle cherche le vent, avec de petites hésitations.
    if (vane.current) vane.current.rotation.y = 0.6 + Math.sin(time * 0.31) * 0.5 + Math.sin(time * 1.9) * 0.06;
  });

  // À quai sur l'île, un clic sur la tour fait tourner le feu ; de loin, le clic laisse
  // le bateau partir vers l'île (pas d'arrêt de propagation).
  const flashLamp = (event: ThreeEvent<MouseEvent>) => {
    if (useWorld.getState().activeIsland !== 'contact') return;
    event.stopPropagation();
    flashAt.current = clock.elapsedTime;
    ambience.chime([523, 659, 784, 1047], 0.09);
  };

  const { x, z, glassCenter, towerBase, roofBase } = frame;
  return (
    <group position={[x, 0, z]}>
      <group position-y={glassCenter}>
        <group ref={lens}>
          <mesh geometry={lensShape} material={LENS} raycast={() => null} />
        </group>
        <mesh geometry={glassShape} material={GLASS} renderOrder={6} raycast={() => null} />
        <group ref={beam} visible={false}>
          <mesh geometry={beamShape} material={BEAM} renderOrder={7} raycast={() => null} />
        </group>
        <sprite ref={halo} material={HALO} scale={5.5} visible={false} raycast={() => null} />
      </group>
      <group ref={vane} position-y={roofBase + 1.5}>
        <mesh geometry={vaneShape} material={VANE} castShadow raycast={() => null} />
      </group>
      {/* Volume de clic de la tour (invisible). */}
      <mesh position-y={(towerBase + roofBase) / 2} visible={false} onClick={flashLamp}>
        <cylinderGeometry args={[1.2, 1.3, roofBase - towerBase + 1, 8]} />
      </mesh>
    </group>
  );
}
