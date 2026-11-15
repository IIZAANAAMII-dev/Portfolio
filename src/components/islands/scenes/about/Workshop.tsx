'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { ambience } from '@/lib/audio/ambience';
import { logbook, useLogbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { damp, smoothstep } from '@/lib/utils/math';
import { ClearingAt, Hotspot, PaintedSign, useHandFont } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { Glass, Smoke } from './Glass';
import { buildHouse, WALL, type GlassSpec, type HouseParts } from './houses';
import { buildInterior } from './interior';
import { WORKSHOP, polar } from './layout';
import { graniteTexture, mainScreenTexture, sideScreenTexture, slateTexture, corkTexture } from './textures';
import { villageMaterials } from './materials';
import { Mesher } from './mesher';
import { housePose } from './Village';

/**
 * L'atelier de Kyliann : une maison de granit comme les autres… jusqu'au clic. Alors le
 * toit se soulève et glisse en arrière, la façade s'abat comme un pont-levis et s'efface,
 * et l'on découvre l'intérieur : bureau et deux écrans de code, lampe, tasse fumante,
 * bibliothèque, tableau de liège des projets, maquette de sinagot, feu de cheminée.
 * Un second clic referme la maison. La première visite tamponne le carnet de bord.
 */

const FRONT = WORKSHOP.depth / 2;
const PANE = new PlaneGeometry(1, 1);

function sections() {
  const make = (): HouseParts => ({ walls: new Mesher(false, true), roof: new Mesher(false, true), details: new Mesher(true, false), glass: [] });
  return { body: make(), front: make(), roof: make() };
}

function finish(parts: HouseParts) {
  return { walls: parts.walls.build(), roof: parts.roof.build(), details: parts.details.build(), glass: parts.glass };
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 214, 150, 0.9)');
  gradient.addColorStop(0.45, 'rgba(255, 180, 110, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 160, 90, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Vitres de la façade : leur propre matériau (lueur chaude, effacement avec le mur). */
function FrontGlass({ specs, material }: { specs: GlassSpec[]; material: (instance: MeshStandardMaterial | null) => void }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    const scale = new Matrix4();
    specs.forEach((spec, index) => {
      matrix.copy(spec.matrix).multiply(scale.makeScale(spec.width, spec.height, 1));
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [specs]);
  return (
    <instancedMesh ref={mesh} args={[PANE, undefined, specs.length]} raycast={() => null}>
      <meshStandardMaterial ref={material} color="#3b5670" emissive="#ffc16b" emissiveIntensity={0.5} roughness={0.3} transparent />
    </instancedMesh>
  );
}

/** Tableau de liège : attend la police manuscrite du site. */
function CorkBoard({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const family = useHandFont();
  const texture = useMemo(() => (family ? corkTexture(family) : null), [family]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={position} raycast={() => null}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} roughness={0.95} />
    </mesh>
  );
}

export function Workshop({ sampler }: { sampler: HeightSampler }) {
  const placement = useMemo(() => housePose(sampler, WORKSHOP), [sampler]);
  const built = useMemo(() => {
    const parts = sections();
    const info = buildHouse(WORKSHOP, (section) => parts[section], { door: -1.25, hinged: true });
    const interior = buildInterior({ halfWidth: WORKSHOP.width / 2 - WALL, halfDepth: WORKSHOP.depth / 2 - WALL, wall: WORKSHOP.wall });
    return { body: finish(parts.body), front: finish(parts.front), roof: finish(parts.roof), info, interior };
  }, []);
  const screens = useMemo(() => ({ main: mainScreenTexture(), side: sideScreenTexture(), glow: glowTexture() }), []);
  useEffect(() => () => {
    for (const section of [built.body, built.front, built.roof]) {
      section.walls?.dispose();
      section.roof?.dispose();
      section.details?.dispose();
    }
    built.interior.paint.dispose();
    built.interior.glowing.dispose();
    screens.main.dispose();
    screens.side.dispose();
    screens.glow.dispose();
  }, [built, screens]);

  const materials = villageMaterials();
  const visited = useLogbook((state) => state.stamps.includes('workshop'));
  const open = useRef(false);
  const progress = useRef(0);
  const frontPivot = useRef<Group>(null);
  const roofGroup = useRef<Group>(null);
  const interior = useRef<Group>(null);
  const frontStone = useRef<MeshStandardMaterial>(null);
  const frontPaint = useRef<MeshStandardMaterial>(null);
  const frontGlass = useRef<MeshStandardMaterial | null>(null);
  const roofSlate = useRef<MeshStandardMaterial>(null);
  const roofPaint = useRef<MeshStandardMaterial>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  const screenMain = useRef<MeshBasicMaterial>(null);
  const embers = useRef<MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const p = (progress.current = damp(progress.current, open.current ? 1 : 0, 2.4, dt));
    // La façade tombe vers l'avant puis s'efface ; le toit monte, recule et s'efface.
    const swing = smoothstep(0, 0.62, p);
    const wallFade = 1 - smoothstep(0.38, 0.86, p);
    const lift = smoothstep(0.1, 0.5, p);
    const slide = smoothstep(0.35, 1, p);
    const roofFade = 1 - smoothstep(0.62, 0.98, p);
    if (frontPivot.current) {
      // Petit rebond à l'arrivée : la façade « touche » le sol.
      const bounce = Math.sin(smoothstep(0.55, 0.75, p) * Math.PI) * 0.05;
      frontPivot.current.rotation.x = swing * (Math.PI / 2) - bounce;
      frontPivot.current.visible = wallFade > 0.01;
    }
    for (const material of [frontStone.current, frontPaint.current, frontGlass.current]) {
      if (material) material.opacity = wallFade;
    }
    if (roofGroup.current) {
      roofGroup.current.position.set(0, lift * 2.2 + slide * 0.6, -slide * 3.2);
      roofGroup.current.rotation.x = -slide * 0.3;
      roofGroup.current.visible = roofFade > 0.01;
    }
    for (const material of [roofSlate.current, roofPaint.current]) {
      if (material) material.opacity = roofFade;
    }
    if (interior.current) interior.current.visible = p > 0.015;
    // Vitres : lueur chaude qui respire tant que l'atelier n'a pas été visité, pleine la nuit.
    if (frontGlass.current) {
      const breath = visited ? 0 : 0.22 + Math.sin(time * 1.8) * 0.18;
      frontGlass.current.emissiveIntensity = 0.35 + breath + night * 1.9;
    }
    if (glow.current) glow.current.opacity = p * (0.25 + night * 0.65);
    if (screenMain.current) screenMain.current.color.setScalar(0.85 + Math.sin(time * 3.1) * 0.03 + Math.sin(time * 0.7) * 0.04);
    if (embers.current) embers.current.color.setRGB(1, 0.75 + Math.sin(time * 9) * 0.1 + Math.sin(time * 5.3) * 0.08, 0.6);
  });

  const toggle = () => {
    open.current = !open.current;
    if (open.current) {
      if (!logbook.has('workshop')) {
        logbook.stamp('workshop');
        ambience.chime([523, 659, 784, 1047], 0.09);
      } else {
        ambience.cue(660, 0.22);
      }
    } else {
      ambience.bump('wood', 0.5);
    }
  };

  const { anchors } = built.interior;
  const smoke = built.info.chimneys.map((chimney) => chimney.top);
  const [x, z] = polar(WORKSHOP.angle, WORKSHOP.radius);

  return (
    <>
      <ClearingAt x={x} z={z} radius={3.6} />
      <group position={placement.position} rotation-y={placement.yaw}>
        <Hotspot hoverScale={1.025} onActivate={toggle}>
          {/* Volume de clic généreux : toute la maison. */}
          <mesh position={[0, 2.2, 0]} visible={false}>
            <boxGeometry args={[WORKSHOP.width + 0.4, 4.6, WORKSHOP.depth + 0.6]} />
          </mesh>
          {built.body.walls && <mesh geometry={built.body.walls} material={materials.granite} castShadow receiveShadow />}
          {built.body.details && <mesh geometry={built.body.details} material={materials.paint} castShadow receiveShadow />}
          <Glass specs={built.body.glass} />
          <group ref={frontPivot} position={[0, 0, FRONT]}>
            <group position={[0, 0, -FRONT]}>
              {built.front.walls && (
                <mesh geometry={built.front.walls} castShadow receiveShadow>
                  <meshStandardMaterial ref={frontStone} map={graniteTexture()} roughness={0.95} transparent />
                </mesh>
              )}
              {built.front.details && (
                <mesh geometry={built.front.details} castShadow>
                  <meshStandardMaterial ref={frontPaint} vertexColors roughness={0.85} transparent />
                </mesh>
              )}
              <FrontGlass specs={built.front.glass} material={(instance) => { frontGlass.current = instance; }} />
            </group>
          </group>
          <group ref={roofGroup}>
            {built.roof.roof && (
              <mesh geometry={built.roof.roof} castShadow receiveShadow>
                <meshStandardMaterial ref={roofSlate} map={slateTexture()} roughness={0.72} transparent />
              </mesh>
            )}
            {built.roof.details && (
              <mesh geometry={built.roof.details} castShadow>
                <meshStandardMaterial ref={roofPaint} vertexColors roughness={0.85} transparent />
              </mesh>
            )}
          </group>
          <group ref={interior} visible={false}>
            <mesh geometry={built.interior.paint} material={materials.paint} receiveShadow castShadow />
            <mesh geometry={built.interior.glowing} raycast={() => null}>
              <meshBasicMaterial ref={embers} vertexColors toneMapped={false} />
            </mesh>
            <mesh position={anchors.mainScreen.position} rotation={anchors.mainScreen.rotation} raycast={() => null}>
              <planeGeometry args={anchors.mainScreen.size} />
              <meshBasicMaterial ref={screenMain} map={screens.main} toneMapped={false} />
            </mesh>
            <mesh position={anchors.sideScreen.position} rotation={anchors.sideScreen.rotation} raycast={() => null}>
              <planeGeometry args={anchors.sideScreen.size} />
              <meshBasicMaterial map={screens.side} toneMapped={false} color="#d9d9d9" />
            </mesh>
            <CorkBoard position={anchors.cork.position} size={anchors.cork.size} />
            <mesh position={anchors.glow} rotation-x={-Math.PI / 2} raycast={() => null} renderOrder={6}>
              <planeGeometry args={[3.2, 2.4]} />
              <meshBasicMaterial ref={glow} map={screens.glow} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
            </mesh>
            <Smoke sources={[anchors.mugSteam]} size={0.11} />
          </group>
        </Hotspot>
        <Smoke sources={smoke} />
        <PaintedSign lines={['Atelier']} position={[-WORKSHOP.width / 2 - 0.55, 0, FRONT - 0.15]} rotation={0.25} accent="#f0b27a" width={1.25} post={1.05} />
      </group>
    </>
  );
}
