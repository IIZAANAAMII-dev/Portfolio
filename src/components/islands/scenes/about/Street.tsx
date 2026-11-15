'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { skyState } from '@/lib/sky';
import { villageMaterials } from './materials';
import { Mesher, pose, type Vec3 } from './mesher';

/**
 * Mobilier du hameau, dans la langue commune de l'archipel : réverbères en fonte vert
 * sombre coiffés d'une lanterne à quatre pans (éteinte le jour ; la nuit, un globe chaud
 * et une flaque de lumière sur les pavés) et bancs de bois sur pieds de fonte.
 */

const CAST_IRON = '#27302c';
const WOOD = '#9b6b45';
const WOOD_DARK = '#86593a';
/** Hauteur du collier qui porte la lanterne. */
const POST = 2.45;
const LANTERN_Y = POST + 0.24;

export interface BenchSpot {
  /** Milieu du banc, au sol. */
  at: Vec3;
  /** Orientation : le dossier est en −Z local, on s'assoit face à +Z. */
  yaw: number;
}

function buildFurniture(lamps: Vec3[], benches: BenchSpot[]) {
  const mesh = new Mesher(true, false);
  const base = new CylinderGeometry(0.13, 0.19, 0.32, 8);
  const shaft = new CylinderGeometry(0.042, 0.06, POST - 0.3, 8);
  const collar = new CylinderGeometry(0.1, 0.06, 0.1, 8);
  const cap = new ConeGeometry(0.25, 0.2, 4);
  const finial = new SphereGeometry(0.04, 8, 6);
  for (const [x, y, z] of lamps) {
    mesh.add(base, pose([x, y + 0.16, z], [0, Math.PI / 8, 0]), CAST_IRON);
    mesh.add(shaft, pose([x, y + 0.3 + (POST - 0.3) / 2, z]), CAST_IRON);
    // Bague décorative à mi-hauteur, collier sous la lanterne.
    mesh.add(collar, pose([x, y + 1.1, z], [0, 0, 0], [0.75, 0.8, 0.75]), CAST_IRON);
    mesh.add(collar, pose([x, y + POST + 0.04, z]), CAST_IRON);
    // Cage de la lanterne : quatre montants évasés, toit en pyramide, fleuron.
    for (let corner = 0; corner < 4; corner++) {
      const angle = Math.PI / 4 + (corner * Math.PI) / 2;
      mesh.rod(
        [x + Math.cos(angle) * 0.11, y + POST + 0.06, z + Math.sin(angle) * 0.11],
        [x + Math.cos(angle) * 0.17, y + POST + 0.44, z + Math.sin(angle) * 0.17],
        0.013,
        CAST_IRON,
        4,
      );
    }
    mesh.add(cap, pose([x, y + POST + 0.54, z], [0, Math.PI / 4, 0]), CAST_IRON);
    mesh.add(finial, pose([x, y + POST + 0.68, z]), CAST_IRON);
  }
  for (const { at, yaw } of benches) {
    const frame = pose(at, [0, yaw, 0]);
    const local = mesh.within(frame);
    // Assise de trois lattes, dossier de deux lattes légèrement renversé.
    for (const dz of [-0.13, 0, 0.13]) local.box([1.3, 0.045, 0.11], [0, 0.45, dz], [0, 0, 0], dz === 0 ? WOOD_DARK : WOOD);
    for (const dy of [0.66, 0.84]) local.box([1.3, 0.1, 0.035], [0, dy, -0.22 - (dy - 0.66) * 0.18], [-0.18, 0, 0], WOOD);
    // Pieds de fonte : un flanc de chaque côté, accoudoir compris.
    for (const side of [-0.55, 0.55]) {
      local.box([0.05, 0.43, 0.06], [side, 0.215, 0.15], [0, 0, 0], CAST_IRON);
      local.box([0.05, 0.86, 0.06], [side, 0.43, -0.2], [-0.12, 0, 0], CAST_IRON);
      local.box([0.05, 0.05, 0.42], [side, 0.62, -0.02], [0, 0, 0], CAST_IRON);
    }
    mesh.within(null);
  }
  for (const geometry of [base, shaft, collar, cap, finial]) geometry.dispose();
  return mesh.build();
}

/** Flaque de lumière : dégradé radial chaud, posé à plat (fondu additif). */
function poolTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 205, 140, 0.85)');
  gradient.addColorStop(0.4, 'rgba(255, 180, 110, 0.32)');
  gradient.addColorStop(1, 'rgba(255, 160, 90, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const LANTERN = new CylinderGeometry(0.15, 0.11, 0.36, 4).rotateY(Math.PI / 4);
const POOL = new CircleGeometry(1, 24).rotateX(-Math.PI / 2);

export function Street({ lamps, benches }: { lamps: Vec3[]; benches: BenchSpot[] }) {
  const geometry = useMemo(() => buildFurniture(lamps, benches), [benches, lamps]);
  const pool = useMemo(() => poolTexture(), []);
  const materials = villageMaterials();
  const lanterns = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const glass = useRef<MeshStandardMaterial>(null);
  const light = useRef<MeshBasicMaterial>(null);
  useEffect(() => () => {
    geometry?.dispose();
    pool.dispose();
  }, [geometry, pool]);
  useLayoutEffect(() => {
    const matrix = new Matrix4();
    lamps.forEach(([x, y, z], index) => {
      lanterns.current?.setMatrixAt(index, matrix.makeTranslation(x, y + LANTERN_Y, z));
      pools.current?.setMatrixAt(index, matrix.makeScale(1.7, 1, 1.7).setPosition(x, y + 0.03, z));
    });
    for (const mesh of [lanterns.current, pools.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [lamps]);
  useFrame((state) => {
    const night = skyState.dayNight;
    const time = state.clock.elapsedTime;
    // Lueur de flamme : un vacillement à peine perceptible.
    const flicker = 1 + Math.sin(time * 9.1) * 0.04 + Math.sin(time * 13.7) * 0.03;
    if (glass.current) glass.current.emissiveIntensity = (0.12 + night * 2.4) * flicker;
    if (light.current) light.current.opacity = Math.min(1, night * 1.25) * 0.5 * flicker;
    if (pools.current) pools.current.visible = night > 0.08;
  });
  return (
    <>
      {geometry && <mesh geometry={geometry} material={materials.paint} castShadow receiveShadow raycast={() => null} />}
      <instancedMesh ref={lanterns} args={[LANTERN, undefined, lamps.length]} raycast={() => null}>
        <meshStandardMaterial ref={glass} color="#fff1d0" emissive="#ffc46b" emissiveIntensity={0.12} roughness={0.3} />
      </instancedMesh>
      {/* Flaques de lumière : disques à plat sous chaque lanterne, la nuit seulement. */}
      <instancedMesh ref={pools} args={[POOL, undefined, lamps.length]} raycast={() => null} renderOrder={4} visible={false}>
        <meshBasicMaterial ref={light} map={pool} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
