'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointsMaterial,
  Vector3,
  type Mesh,
} from 'three';
import { gwennHaDu } from '@/components/islets/BreizhDecor';
import { clothClock } from '@/lib/substance-models';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { boatMotion } from '../motion';
import { animateCaptain, buildCaptain, type CaptainRig } from './captain';
import { ANCHORS, buildBoatGeometries } from './parts';
import { glassTexture, haloTexture, hullTexture, nameDecal, nameTexture } from './textures';

/**
 * Le bateau de pêche breton, entièrement procédural (aucun fichier sous licence) : coque
 * loftée, pont en planches, timonerie blanche, patron à la barre. Repère de navigation :
 * +X proue, Y = 0 flottaison, +Z tribord — Boat le place, le fait tanguer et rouler.
 */

/* ------------------------------------------------------------------ Matériaux partagés */

const HULL = new MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
HULL.name = 'boat-hull';
/** Tout le statique peint par sommet (et le patron, articulé) : un seul programme. */
const PAINT = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
PAINT.name = 'boat-paint';
const GLASS = new MeshStandardMaterial({ roughness: 0.2, metalness: 0.05, emissive: new Color('#ffb85e'), emissiveIntensity: 0 });
GLASS.name = 'boat-glass';
/** Verres des feux : non éclairés, poussés au-delà de 1 la nuit (bloom). */
const LAMPS = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
LAMPS.name = 'boat-lamps';
const HALOS = new PointsMaterial({
  size: 1.15,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
});
HALOS.name = 'boat-halos';
const NAME = new MeshStandardMaterial({ roughness: 0.7, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
NAME.name = 'boat-name';
/**
 * Masque d'eau : profondeur seule, dessiné après les opaques mais avant l'océan (ordre 1 < 2) :
 * la houle n'apparaît jamais à l'intérieur de la coque.
 */
const WATER_MASK = new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });
WATER_MASK.name = 'boat-water-mask';

/** Vent apparent sur le pavillon (0 calme → 1 en route). */
const flagWind = { value: 0.3 };
const FLAG_WIDTH = 0.95;
const FLAG_HEIGHT = 0.62;
const FLAG = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.9 });
FLAG.name = 'boat-flag';
FLAG.onBeforeCompile = (shader) => {
  shader.uniforms.uClothTime = clothClock;
  shader.uniforms.uWind = flagWind;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uClothTime;\nuniform float uWind;')
    .replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
      // Le pavillon claque depuis la drisse (x = 0), libre au bout ; plus vite et plus fort en route.
      float flagFree = clamp(position.x / ${FLAG_WIDTH.toFixed(2)}, 0.0, 1.0);
      float flagSpeed = 5.0 + uWind * 7.0;
      float flagA = 0.035 + 0.075 * uWind;
      float flagB = 0.012 + 0.02 * uWind;
      float flagP1 = position.x * 5.5 - uClothTime * flagSpeed;
      float flagP2 = position.x * 10.0 + position.y * 3.0 - uClothTime * flagSpeed * 1.6;
      float flagWave = (sin(flagP1) * flagA + sin(flagP2) * flagB) * flagFree;
      float flagSlope = (cos(flagP1) * 5.5 * flagA + cos(flagP2) * 10.0 * flagB) * flagFree;
      vec3 objectNormal = normalize(vec3(-flagSlope, 0.0, 1.0));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif`,
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      transformed.z += flagWave;
      // Sans vent, il retombe un peu le long du mât.
      float flagDroop = (1.0 - uWind) * flagFree * flagFree;
      transformed.y -= flagDroop * 0.26;
      transformed.x -= flagDroop * 0.1;`,
    );
};
FLAG.customProgramCacheKey = () => 'breton-boat-flag-v1';

/* ------------------------------------------------------------------ Assets (une fois) */

type Assets = ReturnType<typeof createAssets>;
let cache: Assets | null = null;

function createAssets() {
  const geometries = buildBoatGeometries();
  HULL.map = hullTexture();
  GLASS.map = glassTexture();
  HALOS.map = haloTexture();
  NAME.map = nameTexture();
  FLAG.map = gwennHaDu();
  [HULL, GLASS, HALOS, NAME, FLAG].forEach((material) => {
    material.needsUpdate = true;
  });

  const halos = new BufferGeometry();
  const positions = new Float32Array(geometries.halos.length * 3);
  const colors = new Float32Array(geometries.halos.length * 3);
  const swatch = new Color();
  geometries.halos.forEach(({ at, color }, index) => {
    positions.set(at, index * 3);
    swatch.set(color);
    colors.set([swatch.r, swatch.g, swatch.b], index * 3);
  });
  halos.setAttribute('position', new BufferAttribute(positions, 3));
  halos.setAttribute('color', new BufferAttribute(colors, 3));

  const flag = new PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, 14, 5).translate(FLAG_WIDTH / 2, -FLAG_HEIGHT / 2, 0);
  return { ...geometries, haloPoints: halos, name: nameDecal(), flag };
}

/** Le bateau est unique et permanent : ses géométries et textures sont construites une fois. */
function boatAssets() {
  cache ??= createAssets();
  return cache;
}

/* ------------------------------------------------------------------ Composant */

const cameraLocal = new Vector3();

export function BretonBoat() {
  const assets = useMemo(() => boatAssets(), []);
  const quality = useWorld((state) => state.quality);
  const radar = useRef<Mesh>(null);
  const propeller = useRef<Mesh>(null);
  const rudder = useRef<Mesh>(null);
  const captainHolder = useRef<Group>(null);
  const captain = useRef<CaptainRig | null>(null);

  // Le patron (maillage articulé) est créé ici, hors rendu, et rattaché à son support.
  useEffect(() => {
    const holder = captainHolder.current;
    if (!holder) return;
    const rig = buildCaptain(PAINT, ANCHORS.wheel);
    holder.add(rig.mesh);
    captain.current = rig;
    return () => {
      holder.remove(rig.mesh);
      rig.mesh.geometry.dispose();
      rig.mesh.skeleton.dispose();
      captain.current = null;
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const { phase, quality: level } = useWorld.getState();
    const running = phase === 'playing' || phase === 'docked' || (phase === 'transitioning' && boatMotion.splashAt >= 0);

    // Feux, vitres et halos s'allument avec la nuit.
    LAMPS.color.setScalar(0.85 + night * 1.9);
    GLASS.emissiveIntensity = night * 1.55;
    HALOS.opacity = Math.max(0, Math.min(1, (night - 0.12) * 1.6));
    flagWind.value += (0.3 + boatMotion.throttle * 0.7 - flagWind.value) * Math.min(1, dt * 1.5);

    if (radar.current) radar.current.rotation.y += dt * 2.3;
    if (propeller.current && running) propeller.current.rotation.x += dt * (4 + boatMotion.throttle * 30);
    if (rudder.current) rudder.current.rotation.y = boatMotion.steer;

    const rig = captain.current;
    const holder = captainHolder.current;
    if (rig && holder) {
      rig.mesh.castShadow = level !== 'low';
      holder.worldToLocal(cameraLocal.copy(state.camera.position));
      const sinceSplash = time - boatMotion.splashAt;
      const sinceDock = time - boatMotion.dockedAt;
      const waving = (boatMotion.splashAt >= 0 && sinceSplash > 0.9 && sinceSplash < 4.4)
        || (boatMotion.dockedAt >= 0 && sinceDock > 0.4 && sinceDock < 4.2);
      animateCaptain(rig, {
        time,
        dt,
        camera: cameraLocal,
        wave: waving ? 1 : 0,
        whoa: boatMotion.bumpAt >= 0 && time - boatMotion.bumpAt < 0.8 ? 1 : 0,
        fall: phase === 'transitioning' && boatMotion.splashAt < 0 ? 1 : 0,
        steer: boatMotion.steer,
        roll: boatMotion.roll,
      });
    }
  });

  const shadows = quality !== 'low';
  const [mx, my, mz] = ANCHORS.masthead;
  return (
    <group>
      <mesh geometry={assets.hull} material={HULL} castShadow={shadows} receiveShadow />
      <mesh geometry={assets.paint} material={PAINT} castShadow={shadows} receiveShadow />
      <mesh geometry={assets.glass} material={GLASS} />
      <mesh geometry={assets.lamps} material={LAMPS} />
      <mesh geometry={assets.name} material={NAME} />
      <points geometry={assets.haloPoints} material={HALOS} renderOrder={8} frustumCulled={false} />
      <mesh geometry={assets.mask} material={WATER_MASK} renderOrder={1} />
      <mesh ref={radar} geometry={assets.radar} material={PAINT} position={ANCHORS.radar} castShadow={shadows} />
      <mesh ref={propeller} geometry={assets.propeller} material={PAINT} position={ANCHORS.propeller} />
      <mesh ref={rudder} geometry={assets.rudder} material={PAINT} position={ANCHORS.rudder} />
      {/* Gwenn-ha-Du en tête de mât, flottant vers l'arrière (−X). */}
      <mesh geometry={assets.flag} material={FLAG} position={[mx - 0.02, my - 0.03, mz]} rotation-y={Math.PI} castShadow={shadows} />
      <group ref={captainHolder} position={ANCHORS.captain} />
    </group>
  );
}
