'use client';

import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial, Vector2 } from 'three';
import { CLEARING_ROOT, ClearingContext, ClearingStore } from '@/components/islands/clearings';
import { Grass } from '@/components/islands/Grass';
import { createDecorLod, updateDecorLod, type DecorLod } from '@/components/islands/lod';
import { Terrain } from '@/components/islands/Terrain';
import { Trees } from '@/components/islands/Trees';
import { createHeightSampler, terrainFeatures, type TerrainShape } from '@/components/islands/terrain-shape';
import { islets, type IsletConfig } from '@/data/islets';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { INTRO_DURATION } from '@/lib/cinematic';
import { damp, smoothstep } from '@/lib/utils/math';
import { RISE_SETTLE, risePose, riseSchedule, type RisePose } from '@/components/intro/rise';
import { WaterSkin } from '@/components/intro/WaterSkin';
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

/** Îlots déjà réveillés pendant cette visite (le motif ne se rejoue pas). */
const awakened = new Set<string>();

function Decor(props: IsletDecorProps) {
  if (props.islet.id === 'breizh') return <BreizhDecor {...props} />;
  if (props.islet.id === 'tech') return <TechDecor {...props} />;
  return <DesignDecor {...props} />;
}

function Islet({ islet }: { islet: IsletConfig }) {
  const group = useRef<Group>(null);
  const decor = useRef<Group>(null);
  const lod = useRef<DecorLod>(createDecorLod());
  const label = useRef<HTMLDivElement>(null);
  const aura = useRef<Mesh>(null);
  const pose = useRef<RisePose>({ visible: false, y: 0, sy: 1, sxz: 1, tiltX: 0, tiltZ: 0 });
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
    const { phase, gameTransition, introCenter, activeIsland, quality, reducedMotion } = useWorld.getState();

    // Révélation : l'îlot surgit de la mer comme les îles (intro/rise.ts), à son tour.
    // `scale` dit ensuite à quel point il est « là » (réveil, étiquette, anneau).
    let scale = 1;
    if (phase === 'transitioning' && !reducedMotion) {
      const slot = riseSchedule(introCenter[0], introCenter[1], boatState.heading).byId.get(`islet:${islet.id}`);
      const tau = gameTransition * INTRO_DURATION - (slot?.start ?? 0);
      const current = risePose(tau, islet.elevation + 3, islet.seed, pose.current);
      target.visible = current.visible;
      target.position.y = current.y;
      target.scale.set(current.sxz, current.sy, current.sxz);
      target.rotation.set(current.tiltX, 0, current.tiltZ);
      scale = current.visible ? Math.min(1, tau / RISE_SETTLE) : 0;
    } else if (phase === 'loading' || phase === 'intro') {
      target.visible = false;
      target.position.y = 0;
      target.scale.setScalar(1);
      target.rotation.set(0, 0, 0);
      scale = 0;
    } else {
      // Ouverture passée en cours de route : l'îlot finit de monter, vite et sans à-coup.
      target.visible = true;
      const rate = reducedMotion ? 1000 : 9;
      target.position.y = damp(target.position.y, 0, rate, dt);
      target.scale.setScalar(damp(target.scale.x, 1, rate, dt));
      target.rotation.set(damp(target.rotation.x, 0, rate, dt), 0, damp(target.rotation.z, 0, rate, dt));
    }
    if (decor.current) {
      updateDecorLod(
        decor.current,
        lod.current,
        state.camera,
        { x: islet.position[0], z: islet.position[1], radius: islet.radius, depth: islet.elevation + 7 },
        quality,
        // Les îlots de personnalité font partie du cadrage de leur île parente.
        activeIsland === islet.parent,
        activeIsland !== null,
        reducedMotion || !target.visible,
        dt,
      );
    }

    // Réveil : bateau proche, ou panneau de l'île parente ouvert.
    const boatDistance = Math.hypot(boatState.position.x - islet.position[0], boatState.position.z - islet.position[1]);
    const near = 1 - smoothstep(islet.radius + 12, islet.radius + 26, boatDistance);
    const wanted = Math.max(near, activeIsland === islet.parent ? 1 : 0);
    const awake = isletAwake[islet.id];
    awake.value = damp(awake.value, wanted, 2.4, dt);
    // Premier éveil de la visite : tampon au carnet et motif sonore de l'îlot.
    if (near > 0.85 && scale > 0.9 && !awakened.has(islet.id)) {
      awakened.add(islet.id);
      logbook.stamp(`islet:${islet.id}`);
      ambience.motif(islet.id);
    }

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
        {islet.id === 'design' && (
          <Trees sampler={sampler} radius={islet.radius} plateau={features.plateau} seed={islet.seed} flame="#e8668c" count={1} />
        )}
        {/* Herbe et décor : LOD de distance (qualité basse / moyenne). */}
        <group ref={decor}>
          <Grass sampler={sampler} radius={islet.radius} plateau={features.plateau} seed={islet.seed} palette={islet.grass} />
          <Decor islet={islet} sampler={sampler} features={features} awake={isletAwake[islet.id]} />
        </group>
        {/* Nappes d'eau qui ruissellent quand l'îlot crève la surface (ouverture seulement). */}
        <WaterSkin id={`islet:${islet.id}`} shape={shape} sampler={sampler} />
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
