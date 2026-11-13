'use client';

import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial, Vector2 } from 'three';
import { CLEARING_ROOT, ClearingContext, ClearingStore } from '@/components/islands/clearings';
import { Grass } from '@/components/islands/Grass';
import { Terrain } from '@/components/islands/Terrain';
import { Trees } from '@/components/islands/Trees';
import { createHeightSampler, terrainFeatures, type TerrainShape } from '@/components/islands/terrain-shape';
import { islets, type IsletConfig } from '@/data/islets';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { damp, smoothstep } from '@/lib/utils/math';
import { BreizhDecor } from './BreizhDecor';
import { DesignDecor } from './DesignDecor';
import { TechDecor } from './TechDecor';
import { isletAwake, type IsletDecorProps } from './types';

/**
 * Îlot de personnalité : un petit relief, son herbe, son décor de facette. Il « dort »
 * tant que le bateau est loin ; quand on s'en approche (ou que le panneau « À propos » est
 * ouvert), un anneau de lumière s'allume sur l'eau, ses néons et lanternes s'animent et
 * son nom apparaît. Un clic y emmène le bateau.
 */

const auraVertex = /* glsl */ `
uniform vec2 uBounds;
varying float vRadial;
void main() {
  // 0 au bord intérieur de la couronne, 1 au bord extérieur.
  vRadial = (length(position.xy) - uBounds.x) / (uBounds.y - uBounds.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const auraFragment = /* glsl */ `
uniform float uAwake;
uniform float uTime;
uniform vec3 uColor;
varying float vRadial;
void main() {
  // Couronne douce qui respire, l'onde file vers le large.
  float band = sin(clamp(vRadial, 0.0, 1.0) * 3.14159);
  float pulse = 0.75 + 0.25 * sin(uTime * 2.2 - vRadial * 4.0);
  float alpha = band * band * uAwake * pulse * 0.55;
  gl_FragColor = vec4(uColor * alpha, alpha);
  #include <colorspace_fragment>
}
`;

function Decor(props: IsletDecorProps) {
  if (props.islet.id === 'breizh') return <BreizhDecor {...props} />;
  if (props.islet.id === 'tech') return <TechDecor {...props} />;
  return <DesignDecor {...props} />;
}

function Islet({ islet }: { islet: IsletConfig }) {
  const group = useRef<Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const aura = useRef<Mesh>(null);
  const sailToPoint = useWorld((state) => state.sailToPoint);
  const shape = useMemo<TerrainShape>(
    () => ({ radius: islet.radius, elevation: islet.elevation, seed: islet.seed }),
    [islet.elevation, islet.radius, islet.seed],
  );
  const sampler = useMemo(() => createHeightSampler(shape), [shape]);
  const features = useMemo(() => terrainFeatures(shape), [shape]);
  const clearings = useMemo(() => new ClearingStore(), []);
  const auraUniforms = useMemo(
    () => ({
      uAwake: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new Color('#ffd28a') },
      uBounds: { value: new Vector2(islet.radius * 1.18, islet.radius * 1.62) },
    }),
    [islet.radius],
  );

  useFrame((state, delta) => {
    const target = group.current;
    if (!target) return;
    const dt = Math.min(delta, 1 / 30);
    const { introCenter, introRadius, activeIsland } = useWorld.getState();

    // Révélation : même onde que les îles.
    const d = Math.hypot(islet.position[0] - introCenter[0], islet.position[1] - introCenter[1]);
    const raw = smoothstep(d - 4.5, d, introRadius);
    const scale = damp(target.scale.x, raw * (1 + 0.09 * Math.sin(raw * Math.PI) * (1 - raw)), 7.5, dt);
    target.scale.setScalar(scale);
    target.visible = scale > 0.006;

    // Réveil : bateau proche, ou panneau de l'île parente ouvert.
    const boatDistance = Math.hypot(boatState.position.x - islet.position[0], boatState.position.z - islet.position[1]);
    const near = 1 - smoothstep(islet.radius + 12, islet.radius + 26, boatDistance);
    const wanted = Math.max(near, activeIsland === islet.parent ? 1 : 0);
    const awake = isletAwake[islet.id];
    awake.value = damp(awake.value, wanted, 2.4, dt);
    if (near > 0.85 && scale > 0.9) logbook.stamp(`islet:${islet.id}`);

    const material = aura.current?.material as ShaderMaterial | undefined;
    if (material) {
      material.uniforms.uAwake.value = awake.value * scale;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (label.current) {
      const shown = awake.value > 0.45 && scale > 0.9;
      if (label.current.classList.contains('is-active') !== shown) label.current.classList.toggle('is-active', shown);
    }
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Le bateau vient mouiller au large de l'îlot, du côté où il se trouve.
    const dx = boatState.position.x - islet.position[0];
    const dz = boatState.position.z - islet.position[1];
    const length = Math.max(Math.hypot(dx, dz), 0.001);
    const reach = islet.radius + 6;
    sailToPoint([islet.position[0] + (dx / length) * reach, islet.position[1] + (dz / length) * reach]);
  };

  return (
    <group
      ref={group}
      position={[islet.position[0], 0, islet.position[1]]}
      scale={0}
      visible={false}
      userData={CLEARING_ROOT}
      onClick={onClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <ClearingContext.Provider value={clearings}>
        <Terrain shape={shape} sampler={sampler} cliff={islet.terrain.cliff} top={islet.terrain.top} cliffTint={islet.terrain.cliffTint} />
        <Grass sampler={sampler} radius={islet.radius} plateau={features.plateau} seed={islet.seed} palette={islet.grass} />
        {islet.id === 'design' && (
          <Trees sampler={sampler} radius={islet.radius} plateau={features.plateau} seed={islet.seed} flame="#e8668c" count={1} />
        )}
        <Decor islet={islet} sampler={sampler} features={features} awake={isletAwake[islet.id]} />
      </ClearingContext.Provider>

      {/* Anneau de réveil, posé sur l'eau autour de l'îlot. */}
      <mesh ref={aura} rotation-x={-Math.PI / 2} position-y={0.12} renderOrder={6} raycast={() => null}>
        <ringGeometry args={[islet.radius * 1.18, islet.radius * 1.62, 64, 1]} />
        <shaderMaterial
          uniforms={auraUniforms}
          vertexShader={auraVertex}
          fragmentShader={auraFragment}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <Html position={[0, islet.elevation + 6.5, 0]} center distanceFactor={44} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className="island-label">
          <span className="island-label__name">{islet.label}</span>
          <span className="island-label__tagline">{islet.tagline}</span>
        </div>
      </Html>
    </group>
  );
}

/** Les îlots de personnalité de l'archipel. */
export function PersonalityIslets() {
  return (
    <group>
      {islets.map((islet) => (
        <Islet key={islet.id} islet={islet} />
      ))}
    </group>
  );
}
