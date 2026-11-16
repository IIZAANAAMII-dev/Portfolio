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
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { boatMotion } from '../motion';
import { mooring, THROW_TIME } from '../mooring';
import { animateCaptain, buildCaptain, handPosition, pipeBowl, type CaptainRig } from './captain';
import { ANCHORS, buildBoatGeometries } from './parts';
import { glassGlowTexture, glassTexture, haloTexture, hullTexture, nameDecal, nameTexture } from './textures';

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
/** Vitres : reflets de ciel le jour ; la nuit, la timonerie s'allume (carte émissive chaude). */
const GLASS = new MeshStandardMaterial({ roughness: 0.2, metalness: 0.05, emissive: new Color('#ffffff'), emissiveIntensity: 0 });
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
// Un diamètre par feu (attribut aSize) : feux de côté plus larges, feu de poupe plus discret.
HALOS.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aSize;')
    .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
};
HALOS.customProgramCacheKey = () => 'breton-boat-halos-v1';
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
/**
 * Phase des ondulations, intégrée image par image (phase += vitesse × dt) : quand le vent
 * forcit, le pavillon accélère sans sauter (temps × vitesse ferait bondir la phase).
 */
const flagPhase = { value: 0 };
const FLAG_WIDTH = 0.95;
const FLAG_HEIGHT = 0.62;
const FLAG = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.9 });
FLAG.name = 'boat-flag';
FLAG.onBeforeCompile = (shader) => {
  shader.uniforms.uFlagPhase = flagPhase;
  shader.uniforms.uWind = flagWind;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uFlagPhase;\nuniform float uWind;')
    .replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
      // Le pavillon claque depuis la drisse (x = 0), libre au bout ; plus vite et plus fort en route.
      float flagFree = clamp(position.x / ${FLAG_WIDTH.toFixed(2)}, 0.0, 1.0);
      float flagA = 0.035 + 0.075 * uWind;
      float flagB = 0.012 + 0.02 * uWind;
      float flagP1 = position.x * 5.5 - uFlagPhase;
      float flagP2 = position.x * 10.0 + position.y * 3.0 - uFlagPhase * 1.6;
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
FLAG.customProgramCacheKey = () => 'breton-boat-flag-v2';

/* ------------------------------------------------------------------ Assets (une fois) */

type Assets = ReturnType<typeof createAssets>;
let cache: Assets | null = null;

function createAssets() {
  const geometries = buildBoatGeometries();
  HULL.map = hullTexture();
  GLASS.map = glassTexture();
  GLASS.emissiveMap = glassGlowTexture();
  HALOS.map = haloTexture();
  NAME.map = nameTexture();
  FLAG.map = gwennHaDu();
  [HULL, GLASS, HALOS, NAME, FLAG].forEach((material) => {
    material.needsUpdate = true;
  });

  const halos = new BufferGeometry();
  const positions = new Float32Array(geometries.halos.length * 3);
  const colors = new Float32Array(geometries.halos.length * 3);
  const sizes = new Float32Array(geometries.halos.length);
  const swatch = new Color();
  geometries.halos.forEach(({ at, color, size }, index) => {
    positions.set(at, index * 3);
    swatch.set(color);
    colors.set([swatch.r, swatch.g, swatch.b], index * 3);
    sizes[index] = size;
  });
  halos.setAttribute('position', new BufferAttribute(positions, 3));
  halos.setAttribute('color', new BufferAttribute(colors, 3));
  halos.setAttribute('aSize', new BufferAttribute(sizes, 1));

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
  /** Régime de l'hélice (rad/s) : elle s'emballe et ralentit avec le moteur, sans à-coup. */
  const spin = useRef(0);

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
    const { phase, quality: level, reducedMotion } = useWorld.getState();
    const running = phase === 'playing' || phase === 'docked' || (phase === 'transitioning' && boatMotion.splashAt >= 0);

    // Feux, vitres et halos s'allument avec la nuit.
    LAMPS.color.setScalar(0.85 + night * 1.9);
    GLASS.emissiveIntensity = night * 1.55;
    HALOS.opacity = Math.max(0, Math.min(1, (night - 0.12) * 1.6));
    flagWind.value += (0.3 + boatMotion.throttle * 0.7 - flagWind.value) * Math.min(1, dt * 1.5);
    flagPhase.value = (flagPhase.value + dt * (5 + flagWind.value * 7)) % (Math.PI * 2000);

    if (radar.current) radar.current.rotation.y += dt * 2.3;
    spin.current += ((running ? 5 + boatMotion.throttle * 32 : 0) - spin.current) * Math.min(1, dt * 2.5);
    if (propeller.current) propeller.current.rotation.x += dt * spin.current;
    if (rudder.current) rudder.current.rotation.y = boatMotion.steer;

    const rig = captain.current;
    const holder = captainHolder.current;
    if (rig && holder) {
      rig.mesh.castShadow = level !== 'low';
      holder.worldToLocal(cameraLocal.copy(state.camera.position));
      const sinceSplash = time - boatMotion.splashAt;
      // Il salue après l'amarrage (l'amarre capelée, le passavant posé), pas avant.
      const waving = (boatMotion.splashAt >= 0 && sinceSplash > 0.9 && sinceSplash < 4.4)
        || (mooring.waveFrom >= 0 && time > mooring.waveFrom && time < mooring.waveTo);
      const docking = mooring.phase === 'arriving' || mooring.phase === 'moored';
      const throwPhase = docking && mooring.throwAt >= 0 ? (time - mooring.throwAt) / THROW_TIME : -1;
      const dockSide = mooring.berth?.side ?? 1;
      animateCaptain(rig, {
        time,
        dt,
        camera: cameraLocal,
        wave: waving ? 1 : 0,
        whoa: boatMotion.bumpAt >= 0 && time - boatMotion.bumpAt < 0.8 ? 1 : 0,
        fall: phase === 'transitioning' && boatMotion.splashAt < 0 ? 1 : 0,
        steer: boatMotion.steer,
        roll: boatMotion.roll,
        accel: boatMotion.accel,
        turn: boatMotion.turn,
        calm: reducedMotion ? 1 : 0,
        throw: throwPhase >= 0 && throwPhase <= 1 ? throwPhase : -1,
        throwSide: dockSide,
      });
      // Fourneau de la pipe (monde) : la fumée en tire de petites volutes (Smoke).
      pipeBowl(rig, boatMotion.pipe);
      boatMotion.pipeAt = time;
      // Main qui lance l'amarre (la corde en part pendant l'élan).
      if (docking && mooring.line) handPosition(rig, dockSide, mooring.hand);
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
