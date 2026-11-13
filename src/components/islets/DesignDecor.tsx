'use client';

import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BackSide,
  Color,
  CubicBezierCurve3,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Object3D,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three';
import { addClearing, ClearingContext } from '@/components/islands/clearings';
import { groundAt } from '@/components/islands/terrain-shape';
import type { IsletDecorProps } from './types';

/**
 * Design : un crayon géant planté dans la prairie, un nuancier en éventail qui s'ouvre et
 * se referme, le curseur de souris qui flotte au-dessus, et une courbe de Bézier avec ses
 * poignées, comme dans un outil de dessin.
 */

/** Les couleurs du nuancier reprennent la palette du portfolio. */
const SWATCHES = ['#e2553f', '#ec7f3a', '#f2c14e', '#9cc35a', '#20b8c4', '#3f5fb5', '#8f7fd6'];

function Pencil({ position }: { position: [number, number, number] }) {
  return (
    // Planté pointe en bas, légèrement penché.
    <group position={position} rotation={[0.32, 0.6, -0.18]}>
      <mesh castShadow position-y={2.15}>
        <cylinderGeometry args={[0.34, 0.34, 3.3, 6]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.55} flatShading />
      </mesh>
      <mesh castShadow position-y={3.98}>
        <cylinderGeometry args={[0.35, 0.35, 0.36, 12]} />
        <meshStandardMaterial color="#c4ccd4" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh castShadow position-y={4.38}>
        <cylinderGeometry args={[0.34, 0.34, 0.44, 12]} />
        <meshStandardMaterial color="#f19bb0" roughness={0.8} />
      </mesh>
      <mesh castShadow position-y={0.15} rotation-x={Math.PI}>
        <coneGeometry args={[0.34, 0.7, 6]} />
        <meshStandardMaterial color="#efcfa4" roughness={0.85} flatShading />
      </mesh>
      <mesh position-y={-0.27} rotation-x={Math.PI}>
        <coneGeometry args={[0.12, 0.24, 6]} />
        <meshStandardMaterial color="#3a3a46" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Nuancier : sept lames de couleur qui pivotent autour d'un axe, en respiration lente. */
function SwatchFan({ position }: { position: [number, number, number] }) {
  const cards = useRef<InstancedMesh>(null);
  const labels = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = SWATCHES.length;

  useLayoutEffect(() => {
    const target = cards.current;
    if (!target) return;
    const color = new Color();
    SWATCHES.forEach((swatch, index) => target.setColorAt(index, color.set(swatch)));
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const cardMesh = cards.current;
    const labelMesh = labels.current;
    if (!cardMesh || !labelMesh) return;
    const open = 0.55 + Math.sin(state.clock.elapsedTime * 0.6) * 0.45;
    for (let index = 0; index < count; index++) {
      const angle = (index - (count - 1) / 2) * 0.2 * open;
      // Lame pivotant autour de son pied (z local), décalée en profondeur pour ne pas se toucher.
      dummy.position.set(Math.sin(angle) * 1.1, Math.cos(angle) * 1.1, index * 0.035);
      dummy.rotation.set(0, 0, -angle);
      dummy.scale.set(0.52, 2.2, 0.035);
      dummy.updateMatrix();
      cardMesh.setMatrixAt(index, dummy.matrix);
      // Pied blanc de la lame (où s'inscrit la référence de la couleur).
      dummy.position.set(Math.sin(angle) * 0.2, Math.cos(angle) * 0.2, index * 0.035 + 0.004);
      dummy.scale.set(0.52, 0.42, 0.036);
      dummy.updateMatrix();
      labelMesh.setMatrixAt(index, dummy.matrix);
    }
    cardMesh.instanceMatrix.needsUpdate = true;
    labelMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={position} rotation-y={-0.5}>
      <mesh castShadow position-y={0.04}>
        <cylinderGeometry args={[0.09, 0.09, 0.4, 10]} />
        <meshStandardMaterial color="#2f3440" roughness={0.4} metalness={0.6} />
      </mesh>
      <group position-y={0.15}>
        <instancedMesh ref={cards} args={[undefined, undefined, count]} castShadow frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.5} />
        </instancedMesh>
        <instancedMesh ref={labels} args={[undefined, undefined, count]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f7f4ee" roughness={0.6} />
        </instancedMesh>
      </group>
    </group>
  );
}

/** Le curseur de souris, avec son contour noir (coque inversée), qui flotte et pivote. */
function Cursor({ position }: { position: [number, number, number] }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    const arrow = new Shape();
    arrow.moveTo(0, 0);
    arrow.lineTo(0, -1.45);
    arrow.lineTo(0.36, -1.1);
    arrow.lineTo(0.62, -1.66);
    arrow.lineTo(0.86, -1.55);
    arrow.lineTo(0.6, -1.0);
    arrow.lineTo(1.05, -1.0);
    arrow.closePath();
    const extruded = new ExtrudeGeometry(arrow, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    extruded.center();
    return extruded;
  }, []);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = position[1] + Math.sin(t * 1.4) * 0.25;
    group.current.rotation.y = Math.sin(t * 0.5) * 0.8;
  });
  return (
    <group ref={group} position={position}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color="#fbfbf7" roughness={0.35} />
      </mesh>
      <mesh geometry={geometry} scale={1.08}>
        <meshBasicMaterial color="#14161c" side={BackSide} />
      </mesh>
    </group>
  );
}

/** Courbe de Bézier et ses poignées, comme l'outil plume. */
function BezierPen({ position }: { position: [number, number, number] }) {
  const group = useRef<Group>(null);
  const { tube, handles, anchors } = useMemo(() => {
    const a = new Vector3(-1.6, 0, 0);
    const b = new Vector3(1.6, 0.2, 0);
    const ca = new Vector3(-0.7, 1.7, 0);
    const cb = new Vector3(0.8, -1.4, 0);
    const curve = new CubicBezierCurve3(a, ca, cb, b);
    return {
      tube: new TubeGeometry(curve, 48, 0.07, 6, false),
      handles: [[a, ca], [b, cb]] as [Vector3, Vector3][],
      anchors: [a, b],
    };
  }, []);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.25;
    group.current.position.y = position[1] + Math.sin(t * 0.9 + 1) * 0.15;
  });
  return (
    <group ref={group} position={position}>
      <mesh geometry={tube} castShadow>
        <meshStandardMaterial color="#20b8c4" roughness={0.35} emissive="#20b8c4" emissiveIntensity={0.25} />
      </mesh>
      {handles.map(([anchor, control], index) => {
        const middle = anchor.clone().add(control).multiplyScalar(0.5);
        const length = anchor.distanceTo(control);
        const angle = Math.atan2(control.y - anchor.y, control.x - anchor.x);
        return (
          <group key={index}>
            <mesh position={middle} rotation-z={angle - Math.PI / 2}>
              <cylinderGeometry args={[0.018, 0.018, length, 4]} />
              <meshBasicMaterial color="#14161c" />
            </mesh>
            <mesh position={control}>
              <sphereGeometry args={[0.12, 10, 8]} />
              <meshStandardMaterial color="#fbfbf7" roughness={0.4} />
            </mesh>
          </group>
        );
      })}
      {anchors.map((anchor, index) => (
        <mesh key={index} position={anchor}>
          <boxGeometry args={[0.24, 0.24, 0.24]} />
          <meshStandardMaterial color="#fbfbf7" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

export function DesignDecor({ islet, sampler, features }: IsletDecorProps) {
  const clearings = useContext(ClearingContext);
  const { hillX, hillZ, summit } = features;
  const pencilX = hillX + 0.6;
  const pencilZ = hillZ - 0.4;
  const fanX = -islet.radius * 0.42;
  const fanZ = islet.radius * 0.18;

  useLayoutEffect(() => {
    const removePencil = addClearing(clearings, pencilX, pencilZ, 0.7);
    const removeFan = addClearing(clearings, fanX, fanZ, 1.2);
    return () => {
      removePencil?.();
      removeFan?.();
    };
  }, [clearings, fanX, fanZ, pencilX, pencilZ]);

  return (
    <group>
      <Pencil position={[pencilX, groundAt(sampler, pencilX, pencilZ, 0.4) + 0.1, pencilZ]} />
      <SwatchFan position={[fanX, groundAt(sampler, fanX, fanZ, 0.6) + 0.05, fanZ]} />
      <Cursor position={[hillX - 1.8, summit + 4.2, hillZ + 1.6]} />
      <BezierPen position={[islet.radius * 0.35, summit + 2.6, -islet.radius * 0.3]} />
    </group>
  );
}
