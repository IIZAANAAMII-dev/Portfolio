'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  OctahedronGeometry,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GlowWord } from '@/components/world/night/GlowWord';
import { useNightGate } from '@/components/world/night/night-gate';
import { SweepBeam, type BeamControl } from '@/components/world/night/SweepBeam';
import { wordRockGroup } from '@/components/world/night/word-rock';
import { ambience } from '@/lib/audio/ambience';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { glowTexture } from '../../docks/parts';
import type { LighthouseFrame } from './build';

/**
 * Lanterne du phare : vitre chaude, lentille à facettes qui tourne derrière, deux faisceaux
 * qui balaient la mer à la nuit tombée (SweepBeam : cône de lumière et reflet sur l'eau),
 * halo, et une girouette en forme de poisson. Un clic sur la tour fait tourner le feu à toute
 * vitesse quelques secondes, même en plein jour. Au large, une dalle de granit porte
 * « Kenavo » (au revoir) peint à la peinture phosphorescente : invisible de jour, le mot
 * s'écrit en lumière derrière le faisceau — le dernier mot de l'archipel.
 */

/** Dalle du « Kenavo », au large, côté couchant de la jetée (repère de l'île). */
const FAREWELL = { x: 18.6, z: 3.8, yaw: -0.52, length: 5.2, width: 2.0, top: 0.6 };

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
const HALO = new SpriteMaterial({ map: glowTexture(), color: '#ffd391', transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
/** Granit gris rosé des rochers de l'île. */
const ROCK = new MeshStandardMaterial({ color: '#c2b2a6', roughness: 0.95, flatShading: true });

export function LighthouseLamp({ frame }: { frame: LighthouseFrame }) {
  const lens = useRef<Group>(null);
  const vane = useRef<Group>(null);
  const halo = useRef<Sprite>(null);
  const flashAt = useRef(-100);
  const beam = useRef<BeamControl>({ strength: 0, speed: 0.55, angle: 1.2 });
  const clock = useThree((state) => state.clock);
  const night = useNightGate();
  const vaneShape = useMemo(() => vaneGeometry(), []);
  const glassShape = useMemo(() => new CylinderGeometry(0.64, 0.64, 1.0, 10, 1, true), []);
  const lensShape = useMemo(() => new OctahedronGeometry(0.3, 0).scale(1, 1.25, 1), []);
  const rockShape = useMemo(() => wordRockGroup(11.4, FAREWELL.length, FAREWELL.width, FAREWELL.top), []);

  useEffect(
    () => () => [vaneShape, glassShape, lensShape, rockShape].forEach((item) => item.dispose()),
    [glassShape, lensShape, rockShape, vaneShape],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const dark = skyState.dayNight;
    const flash = Math.max(0, 1 - (time - flashAt.current) / 4.5);
    // Le feu s'allume au crépuscule ; les faisceaux ne balaient franchement qu'à la nuit.
    const dusk = Math.min(1, Math.max(0, (dark - 0.22) / 0.5));
    const strength = Math.max(dusk * dusk * (3 - 2 * dusk), flash * 0.85);
    const control = beam.current;
    control.strength = strength * (0.85 + Math.sin(time * 1.7) * 0.06);
    control.speed = 0.55 + flash * 3.4;
    if (lens.current) lens.current.rotation.y = control.angle;
    GLASS.emissiveIntensity = 0.5 + Math.max(dark, flash) * 2.4 + Math.sin(time * 2.2) * 0.08;
    LENS.emissiveIntensity = 1.1 + Math.max(dark, flash) * 2.6;
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
    <>
      <group position={[x, 0, z]}>
        <group position-y={glassCenter}>
          <group ref={lens}>
            <mesh geometry={lensShape} material={LENS} raycast={() => null} />
          </group>
          <mesh geometry={glassShape} material={GLASS} renderOrder={6} raycast={() => null} />
          <SweepBeam id="contact" controlRef={beam} count={2} length={34} radius={2.5} tilt={0.06} />
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
      {/* La dalle du « Kenavo », au large (repère de l'île). */}
      <mesh
        geometry={rockShape}
        material={ROCK}
        position={[FAREWELL.x, 0, FAREWELL.z]}
        rotation-y={FAREWELL.yaw}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      {night && (
        <GlowWord
          text="Kenavo"
          beam="contact"
          position={[FAREWELL.x, FAREWELL.top + 0.015, FAREWELL.z]}
          rotation={FAREWELL.yaw}
          width={FAREWELL.length * 0.84}
        />
      )}
    </>
  );
}
