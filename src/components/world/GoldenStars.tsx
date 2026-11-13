'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CylinderGeometry,
  ExtrudeGeometry,
  InstancedMesh,
  Object3D,
  Shape,
  ShaderMaterial,
} from 'three';
import { STAR_SPOTS } from '@/data/stars';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { STAR_COUNT, useLogbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { clamp } from '@/lib/utils/math';

/**
 * Étoiles d'or : sept étoiles de mer dorées cachées dans l'archipel. Une colonne de
 * lumière les signale de loin ; le bateau les repêche en passant dessus (gerbe dorée,
 * arpège, tampon au carnet quand la collection est complète).
 */

function starGeometry() {
  const shape = new Shape();
  for (let index = 0; index <= 10; index++) {
    const angle = (index / 10) * Math.PI * 2 + Math.PI / 2;
    const radius = index % 2 === 0 ? 1 : 0.46;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  geometry.center();
  // À plat sur l'eau : visible en entier depuis la caméra de jeu.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const pillarVertex = /* glsl */ `
varying float vHeight;
void main() {
  vHeight = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const pillarFragment = /* glsl */ `
uniform float uTime;
varying float vHeight;
void main() {
  // Colonne qui s'efface vers le ciel et pulse doucement.
  float fade = pow(1.0 - vHeight, 1.6);
  float pulse = 0.75 + 0.25 * sin(uTime * 2.4 - vHeight * 6.0);
  vec3 gold = vec3(1.0, 0.8, 0.38);
  gl_FragColor = vec4(gold * fade * pulse * 0.55, fade * pulse * 0.55);
  #include <colorspace_fragment>
}
`;

export function GoldenStars() {
  const stars = useRef<InstancedMesh>(null);
  const pillars = useRef<InstancedMesh>(null);
  const pillarMaterial = useRef<ShaderMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => starGeometry(), []);
  const pillarGeometry = useMemo(() => new CylinderGeometry(0.55, 0.9, 18, 14, 1, true).translate(0, 9, 0), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  /** Instant de la cueillette de chaque étoile (animation d'éclat), -1 si pas encore. */
  const bursts = useRef<number[]>(Array.from({ length: STAR_COUNT }, () => -1));

  useEffect(() => {
    useLogbook.getState().hydrate();
  }, []);

  useFrame((state) => {
    const starMesh = stars.current;
    const pillarMesh = pillars.current;
    if (!starMesh || !pillarMesh) return;
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    const playing = phase === 'playing' || phase === 'docked';
    starMesh.visible = playing;
    pillarMesh.visible = playing;
    if (!playing) return;
    if (pillarMaterial.current) pillarMaterial.current.uniforms.uTime.value = time;

    const collected = useLogbook.getState().stars;
    STAR_SPOTS.forEach(([x, z], index) => {
      const taken = collected.includes(index);
      const burstAge = bursts.current[index] < 0 ? -1 : time - bursts.current[index];
      // Cueillette : le bateau passe sur l'étoile.
      if (!taken && Math.hypot(boatState.position.x - x, boatState.position.z - z) < 4.6) {
        bursts.current[index] = time;
        useLogbook.getState().collectStar(index);
        const count = useLogbook.getState().stars.length;
        ambience.chime(count >= STAR_COUNT ? [784, 988, 1175, 1568, 1976] : [988, 1319, 1760]);
      }
      const wave = waveHeight(x, z, time);
      let scale = taken ? 0 : 1.15 + Math.sin(time * 2 + index) * 0.08;
      if (burstAge >= 0 && burstAge < 0.7) scale = 1.3 + burstAge * 2.4;
      if (burstAge >= 0.7) scale = 0;
      dummy.position.set(x, wave + 0.95 + Math.sin(time * 1.6 + index * 2) * 0.18 + clamp(burstAge, 0, 0.7) * 3, z);
      dummy.rotation.set(Math.sin(time * 0.9 + index) * 0.25, time * 0.8 + index, Math.cos(time * 0.7 + index) * 0.2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      starMesh.setMatrixAt(index, dummy.matrix);

      dummy.position.set(x, wave, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(taken && burstAge < 0 ? 0 : burstAge >= 0 ? Math.max(0, 1 - burstAge * 1.6) : 1);
      dummy.updateMatrix();
      pillarMesh.setMatrixAt(index, dummy.matrix);
    });
    starMesh.instanceMatrix.needsUpdate = true;
    pillarMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={stars} args={[geometry, undefined, STAR_COUNT]} frustumCulled={false} castShadow raycast={() => null}>
        <meshStandardMaterial color="#ffcf4a" emissive="#ffae2b" emissiveIntensity={0.85} roughness={0.32} metalness={0.25} />
      </instancedMesh>
      <instancedMesh ref={pillars} args={[pillarGeometry, undefined, STAR_COUNT]} frustumCulled={false} renderOrder={9} raycast={() => null}>
        <shaderMaterial
          ref={pillarMaterial}
          uniforms={uniforms}
          vertexShader={pillarVertex}
          fragmentShader={pillarFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
