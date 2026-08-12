'use client';

import { useMemo } from 'react';
import { Color, CylinderGeometry, RingGeometry } from 'three';
import { hash } from '@/lib/utils/math';

interface TerrainProps {
  radius: number;
  elevation: number;
  ground: string;
  seed: number;
}

type Layer = {
  radius: number;
  height: number;
  color: string;
  segments: number;
  y: number;
  offsetX: number;
  offsetZ: number;
  seed: number;
};

function makeIslandLayer(layer: Layer) {
  const geometry = new CylinderGeometry(
    layer.radius * 0.84,
    layer.radius,
    layer.height,
    layer.segments,
    2,
    false,
  );
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const distance = Math.hypot(x, z);
    if (distance < 0.001) continue;

    const angle = Math.atan2(z, x);
    const coast =
      1 +
      Math.sin(angle * 3 + layer.seed * 1.7) * 0.075 +
      Math.sin(angle * 7 - layer.seed * 0.9) * 0.045 +
      Math.sin(angle * 11 + layer.seed * 0.31) * 0.018;
    const terrace = y > 0 ? 0.97 : 1.03;
    positions.setXYZ(index, x * coast * terrace, y, z * coast * terrace);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makeReef(radius: number, seed: number, inner: number, outer: number) {
  const geometry = new RingGeometry(radius * inner, radius * outer, 40, 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const distance = Math.hypot(x, y);
    if (distance < 0.001) continue;
    const angle = Math.atan2(y, x);
    const breakup = 1
      + Math.sin(angle * 3 + seed) * 0.075
      + Math.sin(angle * 7 - seed * 0.7) * 0.04
      + Math.sin(angle * 13 + seed * 1.9) * 0.018;
    positions.setXY(index, x * breakup, y * breakup);
  }
  positions.needsUpdate = true;
  return geometry;
}

/** Falaises facettées irrégulières et plateaux légèrement décentrés. */
export function Terrain({ radius, elevation, ground, seed }: TerrainProps) {
  const groundColors = useMemo(() => {
    const base = new Color(ground);
    return {
      low: `#${base.clone().offsetHSL(-0.01, 0.02, -0.055).getHexString()}`,
      mid: `#${base.clone().offsetHSL(0.01, 0.035, 0.015).getHexString()}`,
      crown: `#${base.clone().offsetHSL(0.015, 0.055, 0.075).getHexString()}`,
    };
  }, [ground]);
  const layers = useMemo<Layer[]>(() => {
    const sandHeight = 1.25;
    const lowHeight = Math.max(1.7, elevation * 0.34);
    const midHeight = Math.max(1.4, elevation * 0.28);
    const crownHeight = Math.max(0.9, elevation * 0.18);

    return [
      {
        radius: radius * 1.03,
        height: 1.05,
        color: '#cfba8f',
        segments: 18,
        y: -1.35,
        offsetX: 0,
        offsetZ: 0,
        seed: seed + 0.3,
      },
      {
        radius,
        height: sandHeight,
        color: '#ead8ad',
        segments: 18,
        y: -0.42,
        offsetX: 0,
        offsetZ: 0,
        seed: seed + 1.7,
      },
      {
        radius: radius * 0.83,
        height: lowHeight,
        color: groundColors.low,
        segments: 17,
        y: 0.55 + lowHeight * 0.5,
        offsetX: (hash(seed * 2.1) - 0.5) * radius * 0.08,
        offsetZ: (hash(seed * 3.7) - 0.5) * radius * 0.08,
        seed: seed + 4.2,
      },
      {
        radius: radius * 0.57,
        height: midHeight,
        color: groundColors.mid,
        segments: 15,
        y: 0.55 + lowHeight * 0.82 + midHeight * 0.5,
        offsetX: (hash(seed * 5.3) - 0.5) * radius * 0.2,
        offsetZ: (hash(seed * 7.9) - 0.5) * radius * 0.2,
        seed: seed + 8.4,
      },
      {
        radius: radius * 0.31,
        height: crownHeight,
        color: groundColors.crown,
        segments: 13,
        y: 0.55 + lowHeight * 0.82 + midHeight * 0.76 + crownHeight * 0.5,
        offsetX: (hash(seed * 11.1) - 0.5) * radius * 0.22,
        offsetZ: (hash(seed * 13.7) - 0.5) * radius * 0.22,
        seed: seed + 13.8,
      },
    ];
  }, [radius, elevation, ground, groundColors, seed]);

  const geometries = useMemo(() => layers.map(makeIslandLayer), [layers]);
  const reefs = useMemo(
    () => [makeReef(radius, seed + 2.4, 1.03, 1.28), makeReef(radius, seed + 8.1, 1.18, 1.48)],
    [radius, seed],
  );

  return (
    <group>
      <mesh geometry={reefs[1]} rotation-x={-Math.PI / 2} position-y={-1.55} receiveShadow>
        <meshStandardMaterial color="#68c7b0" roughness={1} transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <mesh geometry={reefs[0]} rotation-x={-Math.PI / 2} position-y={-1.05} receiveShadow>
        <meshStandardMaterial color="#d9d29b" roughness={1} transparent opacity={0.58} depthWrite={false} />
      </mesh>
      {layers.map((layer, index) => (
        <mesh
          key={index}
          geometry={geometries[index]}
          position={[layer.offsetX, layer.y, layer.offsetZ]}
          rotation-y={hash(seed + index * 7.13) * Math.PI}
          castShadow={index > 0}
          receiveShadow
        >
          <meshStandardMaterial
            color={layer.color}
            roughness={index < 2 ? 0.92 : 1}
            flatShading
          />
        </mesh>
      ))}
      {/* Deux bancs de sable décalés prolongent la silhouette sous l'eau. */}
      {[0, 1, 2].map((bank) => {
        const angle = hash(seed * 17.3 + bank * 5.2) * Math.PI * 2;
        const reach = radius * (0.76 + bank * 0.12);
        const size = radius * (0.24 - bank * 0.025);
        return (
          <mesh
            key={`bank-${bank}`}
            position={[Math.cos(angle) * reach, -0.7 - bank * 0.13, Math.sin(angle) * reach]}
            rotation={[-Math.PI / 2, 0, angle]}
            scale={[1.45 + hash(seed + bank) * 0.55, 0.62 + hash(seed * 2 + bank) * 0.24, 1]}
            receiveShadow
          >
            <circleGeometry args={[size, 13]} />
            <meshStandardMaterial color={bank === 0 ? '#ead7a5' : '#c5cf99'} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}
