'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { Vec3 } from '../../docks/parts';

/**
 * Guirlande de fanions (couleurs des pavillons de signalisation) tendue du balcon du phare à
 * la cheminée du gardien. Un seul maillage ; les pointes battent au vent dans le vertex
 * shader (la corde, elle, ne bouge pas).
 */

const COLORS = ['#d9483b', '#f2c14e', '#3b7fc4', '#f5efe3', '#ec7f3a', '#4fae7a'].map((hex) => new Color(hex));
const ROPE = new Color('#e9dcc0');
const flutterTime = { value: 0 };

const MATERIAL = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9, flatShading: true });
MATERIAL.onBeforeCompile = (shader) => {
  shader.uniforms.uFlutterTime = flutterTime;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uFlutterTime;\nattribute float aFlutter;\nattribute float aPhase;')
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      // Seules les pointes des fanions battent ; la corde reste tendue.
      float flutterWave = sin(uFlutterTime * 6.3 + aPhase) * 0.6 + sin(uFlutterTime * 10.1 + aPhase * 1.7) * 0.4;
      transformed.x += flutterWave * 0.08 * aFlutter;
      transformed.z += flutterWave * 0.06 * aFlutter;
      transformed.y += abs(flutterWave) * 0.025 * aFlutter;`,
    );
};
MATERIAL.customProgramCacheKey = () => 'contact-bunting-v1';

function buntingGeometry(from: Vec3, to: Vec3, sag: number, spacing: number) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const count = Math.max(4, Math.round(length / spacing));
  const point = (t: number): Vec3 => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t),
    from[2] + (to[2] - from[2]) * t,
  ];
  const positions: number[] = [];
  const colors: number[] = [];
  const flutter: number[] = [];
  const phases: number[] = [];
  const push = (p: Vec3, color: Color, free: number, phase: number) => {
    positions.push(p[0], p[1], p[2]);
    colors.push(color.r, color.g, color.b);
    flutter.push(free);
    phases.push(phase);
  };
  // Corde : un mince ruban.
  const steps = count * 2;
  for (let index = 0; index < steps; index++) {
    const a = point(index / steps);
    const b = point((index + 1) / steps);
    const a2: Vec3 = [a[0], a[1] + 0.03, a[2]];
    const b2: Vec3 = [b[0], b[1] + 0.03, b[2]];
    for (const p of [a, b, b2, a, b2, a2]) push(p, ROPE, 0, 0);
  }
  // Fanions : triangles pendus à la corde.
  for (let index = 0; index < count; index++) {
    const t0 = (index + 0.12) / count;
    const t1 = (index + 0.88) / count;
    const a = point(t0);
    const b = point(t1);
    const mid = point((t0 + t1) / 2);
    const tip: Vec3 = [mid[0], mid[1] - 0.34, mid[2]];
    const color = COLORS[index % COLORS.length];
    const phase = index * 1.31;
    push(a, color, 0, phase);
    push(b, color, 0, phase);
    push(tip, color, 1, phase);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('aFlutter', new BufferAttribute(new Float32Array(flutter), 1));
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function Bunting({ from, to, sag = 0.7, spacing = 0.5 }: { from: Vec3; to: Vec3; sag?: number; spacing?: number }) {
  const geometry = useMemo(() => buntingGeometry(from, to, sag, spacing), [from, sag, spacing, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    flutterTime.value = state.clock.elapsedTime;
  });
  return <mesh geometry={geometry} material={MATERIAL} castShadow raycast={() => null} />;
}
