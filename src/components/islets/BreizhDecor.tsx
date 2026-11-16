'use client';

import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { addClearing, ClearingContext } from '@/components/islands/clearings';
import { groundAt } from '@/components/islands/terrain-shape';
import { festLayout, type V3 } from '@/components/world/night/festnoz-build';
import { FestNozSetup } from '@/components/world/night/FestNozSetup';
import { GlowWord } from '@/components/world/night/GlowWord';
import { useNightGate } from '@/components/world/night/night-gate';
import { SweepBeam, type BeamControl } from '@/components/world/night/SweepBeam';
import { wordRockGroup } from '@/components/world/night/word-rock';
import { ambience } from '@/lib/audio/ambience';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { IsletDecorProps } from './types';

/**
 * Breizh : phare blanc à lanterne rouge (son faisceau balaie la mer la nuit), Gwenn-ha-Du
 * au vent, alignement de menhirs et blocs de granit rose sur la grève. Sur le replat à l'est
 * du phare, tout est prêt pour le fest-noz : estrade, mâts, guirlandes de lampions, bûcher.
 * À la nuit tombée, les lampions s'allument un à un, le feu prend, les sonneurs montent sur
 * l'estrade et la ronde se forme (night/FestNoz, chargé seulement la nuit). Au large, une
 * dalle porte « Mor » (la mer) peint à la peinture phosphorescente, que le faisceau révèle.
 */

/** La nuit seulement : le fest-noz et sa musique sont chargés à part. */
const FestNoz = lazy(() => import('@/components/world/night/FestNoz'));

/** Dalle du « Mor », côté large (ouest) de l'îlot (repère de l'îlot). */
const SEA_WORD = { x: -10.4, z: 2.6, yaw: Math.PI / 2, length: 3.4, width: 1.8, top: 0.55 };
const PINK_GRANITE = new MeshStandardMaterial({ color: '#e0a296', roughness: 0.9, flatShading: true });

/** Une moucheture d'hermine : trois points et une queue évasée en trois pointes. */
function ermine(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = '#121212';
  for (const [dx, dy] of [[0, -0.44], [-0.21, -0.3], [0.21, -0.3]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - 0.24 * s);
  ctx.quadraticCurveTo(x + 0.09 * s, y + 0.1 * s, x + 0.27 * s, y + 0.46 * s);
  ctx.lineTo(x + 0.1 * s, y + 0.35 * s);
  ctx.lineTo(x, y + 0.52 * s);
  ctx.lineTo(x - 0.1 * s, y + 0.35 * s);
  ctx.lineTo(x - 0.27 * s, y + 0.46 * s);
  ctx.quadraticCurveTo(x - 0.09 * s, y + 0.1 * s, x, y - 0.24 * s);
  ctx.fill();
}

/** Gwenn-ha-Du : neuf bandes (cinq noires, quatre blanches) et un canton à onze hermines. */
export function gwennHaDu() {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const stripe = canvas.height / 9;
  for (let index = 0; index < 9; index++) {
    ctx.fillStyle = index % 2 === 0 ? '#121212' : '#f6f2ea';
    ctx.fillRect(0, index * stripe, canvas.width, stripe + 1);
  }
  const cantonWidth = canvas.width * 0.42;
  const cantonHeight = stripe * 5;
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, cantonWidth, cantonHeight);
  [4, 3, 4].forEach((count, row) => {
    for (let column = 0; column < count; column++) {
      const x = cantonWidth * (count === 4 ? (column + 0.5) / 4 : (column + 1) / 4);
      const y = cantonHeight * (row + 0.52) / 3;
      ermine(ctx, x, y, cantonHeight * 0.26);
    }
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const FLAG_WIDTH = 2.1;
const FLAG_HEIGHT = 1.4;

function flagMaterial(map: CanvasTexture) {
  const material = new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.92 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = flagTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // Le drapeau ondule à partir de la hampe (x = 0), libre au bout.
        float flagFree = clamp(position.x / ${FLAG_WIDTH.toFixed(2)}, 0.0, 1.0);
        float flagWave = sin(position.x * 3.4 - uTime * 4.6) * 0.16 + sin(position.x * 6.1 - uTime * 7.3 + position.y * 2.0) * 0.05;
        transformed.z += flagWave * flagFree;
        transformed.y -= flagFree * flagFree * 0.1;`,
      );
  };
  material.customProgramCacheKey = () => 'gwenn-ha-du-v1';
  return material;
}

const flagTime = { value: 0 };

function Lighthouse({ position }: { position: [number, number, number] }) {
  const beam = useRef<BeamControl>({ strength: 0, speed: 0.7, angle: 2.4 });
  const lamp = useRef<Mesh>(null);
  const flashAt = useRef(-10);
  const clock = useThree((state) => state.clock);

  useFrame((state) => {
    const night = skyState.dayNight;
    // Après un clic, le phare s'allume et balaie vite pendant quelques secondes, même de jour.
    const flash = Math.max(0, 1 - (state.clock.elapsedTime - flashAt.current) / 4.5);
    const control = beam.current;
    control.strength = Math.max(night * 0.8, flash * 0.75);
    control.speed = 0.7 + flash * 3.2;
    if (lamp.current) {
      (lamp.current.material as MeshStandardMaterial).emissiveIntensity = 0.6 + Math.max(night, flash) * 3.2
        + Math.sin(state.clock.elapsedTime * 2.2) * 0.15;
    }
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    flashAt.current = clock.elapsedTime;
    ambience.chime([523, 659, 784, 1047], 0.09);
    logbook.stamp('lighthouse');
  };

  return (
    <group position={position} onClick={onClick}>
      {/* Tour blanche légèrement conique, bandeau noir, galerie, lanterne, dôme rouge. */}
      <mesh castShadow receiveShadow position-y={2.6}>
        <cylinderGeometry args={[0.62, 0.92, 5.2, 14]} />
        <meshStandardMaterial color="#f3eee4" roughness={0.75} />
      </mesh>
      <mesh castShadow position-y={3.9}>
        <cylinderGeometry args={[0.71, 0.75, 0.62, 14]} />
        <meshStandardMaterial color="#1b1d22" roughness={0.6} />
      </mesh>
      <mesh castShadow position-y={5.26}>
        <cylinderGeometry args={[1.02, 1.02, 0.14, 14]} />
        <meshStandardMaterial color="#2a2c33" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh ref={lamp} position-y={5.78}>
        <cylinderGeometry args={[0.5, 0.5, 0.86, 10]} />
        <meshStandardMaterial color="#fff2cf" emissive="#ffc76e" emissiveIntensity={0.6} roughness={0.2} />
      </mesh>
      <mesh castShadow position-y={6.5}>
        <coneGeometry args={[0.66, 0.66, 10]} />
        <meshStandardMaterial color="#c8382f" roughness={0.55} />
      </mesh>
      <mesh position-y={6.92}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color="#2a2c33" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Faisceau tournant (et son reflet sur l'eau), visible la nuit seulement. */}
      <SweepBeam id="breizh" controlRef={beam} count={1} length={28} radius={2.6} tilt={0.08} position={[0, 5.78, 0]} />
    </group>
  );
}

function Flag({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const material = useMemo(() => flagMaterial(gwennHaDu()), []);
  const cloth = useMemo(() => new PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, 16, 6).translate(FLAG_WIDTH / 2, 0, 0), []);
  useFrame((state) => {
    flagTime.value = state.clock.elapsedTime;
  });
  return (
    <group position={position} rotation-y={rotation}>
      <mesh castShadow position-y={2}>
        <cylinderGeometry args={[0.05, 0.07, 4, 6]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.6} />
      </mesh>
      <mesh position-y={4.04}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color="#d4a74a" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh geometry={cloth} material={material} castShadow position={[0.05, 3.25, 0]} />
    </group>
  );
}

/** Alignement de menhirs, du plus grand au plus petit (à la manière de Carnac). */
function Menhirs({ sampler, start, direction }: Pick<IsletDecorProps, 'sampler'> & { start: [number, number]; direction: number }) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(0.85, 1, 0.55, 2, 4, 2);
    const positions = box.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const y = positions.getY(index);
      const taper = 1 - (y + 0.5) * 0.35;
      positions.setX(index, positions.getX(index) * taper + (hash(index * 1.7) - 0.5) * 0.08);
      positions.setZ(index, positions.getZ(index) * taper + (hash(index * 2.9) - 0.5) * 0.08);
      // Sommet arrondi et irrégulier.
      if (y > 0.4) positions.setY(index, y - Math.abs(positions.getX(index)) * 0.4);
    }
    box.translate(0, 0.5, 0);
    box.computeVertexNormals();
    return box;
  }, []);
  const stones = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const x = start[0] + Math.cos(direction) * index * 1.25;
    const z = start[1] + Math.sin(direction) * index * 1.25;
    return {
      position: [x, groundAt(sampler, x, z, 0.4) - 0.15, z] as [number, number, number],
      height: 2.5 - index * 0.32,
      tilt: (hash(index * 4.1 + 2) - 0.5) * 0.12,
      yaw: hash(index * 3.3) * Math.PI,
    };
  }), [direction, sampler, start]);
  return (
    <group>
      {stones.map((stone, index) => (
        <mesh
          key={index}
          geometry={geometry}
          position={stone.position}
          rotation={[stone.tilt, stone.yaw, stone.tilt * 0.6]}
          scale={[1, stone.height, 1]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#a19d96" roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Blocs de granit rose arrondis, posés sur la grève. */
function PinkGranite({ sampler, radius, seed }: Pick<IsletDecorProps, 'sampler'> & { radius: number; seed: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const rock = new IcosahedronGeometry(1, 1);
    const positions = rock.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const factor = 0.82 + hash(Math.round(positions.getX(index) * 7 + positions.getY(index) * 13 + positions.getZ(index) * 17)) * 0.3;
      positions.setXYZ(index, positions.getX(index) * factor, positions.getY(index) * factor * 0.72, positions.getZ(index) * factor);
    }
    rock.computeVertexNormals();
    return rock;
  }, []);
  const material = useMemo(() => new MeshStandardMaterial({ color: '#e0a296', roughness: 0.9, flatShading: true }), []);
  const count = 9;

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new Object3D();
    const tint = new Color();
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + hash(seed + index) * 0.5;
      const distance = radius * (0.92 + hash(seed + index * 2.1) * 0.16);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const size = 0.55 + hash(seed + index * 3.7) * 0.75;
      dummy.position.set(x, sampler(x, z) - size * 0.25, z);
      dummy.rotation.set(0, hash(seed + index * 5.1) * Math.PI * 2, (hash(seed + index * 6.3) - 0.5) * 0.4);
      dummy.scale.set(size * 1.25, size, size);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
      target.setColorAt(index, tint.set('#ffffff').multiplyScalar(0.85 + hash(seed + index * 7.7) * 0.25));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [radius, sampler, seed]);

  return <instancedMesh ref={mesh} args={[geometry, material, count]} castShadow receiveShadow />;
}

export function BreizhDecor({ islet, sampler, features }: IsletDecorProps) {
  const clearings = useContext(ClearingContext);
  const quality = useWorld((state) => state.quality);
  const night = useNightGate();
  const { hillX, hillZ } = features;
  const towerY = groundAt(sampler, hillX, hillZ, 1) - 0.1;
  const lighthouse: V3 = [hillX, towerY, hillZ];
  const flagX = hillX + 2.1;
  const flagZ = hillZ + 1.2;
  const menhirStart: [number, number] = [-islet.radius * 0.5, islet.radius * 0.12];
  const fest = useMemo(() => festLayout(sampler, [hillX, towerY, hillZ], quality), [hillX, hillZ, quality, sampler, towerY]);
  const seaRock = useMemo(() => wordRockGroup(islet.seed + 0.7, SEA_WORD.length, SEA_WORD.width, SEA_WORD.top), [islet.seed]);
  useEffect(() => () => seaRock.dispose(), [seaRock]);

  useLayoutEffect(() => {
    const removeTower = addClearing(clearings, hillX, hillZ, 1.4);
    const removeFlag = addClearing(clearings, flagX, flagZ, 0.4);
    // Piste de danse et estrade : pas d'herbe haute sous les pieds.
    const removeRing = addClearing(clearings, fest.center[0], fest.center[2], fest.radius + 0.55);
    const removeStage = addClearing(clearings, fest.stage.x, fest.stage.z, 1.0);
    return () => {
      removeTower?.();
      removeFlag?.();
      removeRing?.();
      removeStage?.();
    };
  }, [clearings, fest, flagX, flagZ, hillX, hillZ]);

  return (
    <group>
      <Lighthouse position={lighthouse} />
      <Flag position={[flagX, groundAt(sampler, flagX, flagZ, 0.3) - 0.05, flagZ]} rotation={-0.6} />
      <Menhirs sampler={sampler} start={menhirStart} direction={-0.95} />
      <PinkGranite sampler={sampler} radius={islet.radius} seed={islet.seed} />
      <FestNozSetup layout={fest} />
      <mesh
        geometry={seaRock}
        material={PINK_GRANITE}
        position={[SEA_WORD.x, 0, SEA_WORD.z]}
        rotation-y={SEA_WORD.yaw}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      {night && (
        <>
          <GlowWord
            text="Mor"
            beam="breizh"
            position={[SEA_WORD.x, SEA_WORD.top + 0.015, SEA_WORD.z]}
            rotation={SEA_WORD.yaw}
            width={SEA_WORD.length * 0.8}
          />
          <Suspense fallback={null}>
            <FestNoz layout={fest} isletX={islet.position[0]} isletZ={islet.position[1]} />
          </Suspense>
        </>
      )}
    </group>
  );
}
