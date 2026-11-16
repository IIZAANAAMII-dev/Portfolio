'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, CircleGeometry, Color, Fog, Mesh, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { dawnMorning, dawnPresence, dawnSunLift } from './dawn';

/**
 * L'aube de la cinématique d'ouverture. Au moment où la carte marine se dissout, le ciel
 * passait par des gris et des mauves ternes (mélange direct de la nuit et du jour) : ici, une
 * vraie aube de livre d'images prend le relais le temps de la révélation.
 *  - Un dôme centré sur la caméra, peint par-dessus le ciel ordinaire : bande d'horizon
 *    dorée, rose, lavande puis bleu franc au zénith ; le soleil perce l'horizon visible
 *    (la mer le masque à moitié) avec son halo et des rayons doux ; de longs cirrus au bord
 *    net, dorés par en dessous.
 *  - Le large (au-delà de l'onde de lumière) reflète cette aube : l'horizon embrasé se
 *    prolonge dans l'eau, un chemin de paillettes file vers le soleil.
 *  - La brume prend une teinte de pêche : les îles lointaines baignent dans le matin.
 * Deux appels de dessin, montés de l'écran-titre à la fin de la cinématique ; l'aube se
 * retire quand la caméra plonge vers le bateau et le ciel de jour reprend sa place.
 */

const DAWN_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSunLift;
uniform float uHorizon;
uniform float uMorning;
uniform float uTime;
uniform float uStrength;

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

float dawnHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float dawnNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dawnHash(i), dawnHash(i + vec2(1.0, 0.0)), f.x),
             mix(dawnHash(i + vec2(0.0, 1.0)), dawnHash(i + 1.0), f.x), f.y);
}

// Dégradé de l'aube, ancré sur l'horizon VISIBLE (le bout de la mer) : s = hauteur au-dessus
// de cette ligne (rad), facing = 1 face au soleil, -1 dos au soleil. Chaque palier reste
// lumineux : un orange et un bleu mélangés à mi-teinte donneraient du gris.
vec3 dawnRamp(float s, float facing) {
  float toward = smoothstep(-0.35, 1.0, facing);
  float m = uMorning;
  vec3 c0 = mix(mix(vec3(0.98, 0.62, 0.6), vec3(1.0, 0.76, 0.42), toward),
                mix(vec3(1.0, 0.86, 0.78), vec3(1.0, 0.9, 0.66), toward), m);
  vec3 c1 = mix(mix(vec3(0.95, 0.58, 0.66), vec3(1.0, 0.6, 0.47), toward),
                mix(vec3(1.0, 0.84, 0.8), vec3(1.0, 0.82, 0.66), toward), m);
  vec3 c2 = mix(vec3(0.95, 0.68, 0.78), vec3(1.0, 0.93, 0.87), m);
  vec3 c3 = mix(vec3(0.7, 0.62, 0.9), vec3(0.76, 0.89, 0.97), m);
  vec3 c4 = mix(vec3(0.36, 0.48, 0.84), vec3(0.46, 0.73, 0.93), m);
  vec3 c5 = mix(vec3(0.2, 0.32, 0.66), vec3(0.26, 0.56, 0.87), m);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.045, s));
  c = mix(c, c2, smoothstep(0.035, 0.12, s));
  c = mix(c, c3, smoothstep(0.1, 0.26, s));
  c = mix(c, c4, smoothstep(0.22, 0.55, s));
  c = mix(c, c5, smoothstep(0.5, 1.1, s));
  return lin(c);
}

// Lueur du soleil levant le long de l'horizon (aussi reflétée dans l'eau).
float dawnBand(float s, float facing) {
  return exp(-pow(s / 0.032, 2.0)) * (0.18 + 0.82 * pow(max(facing, 0.0), 4.0));
}
`;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const skyFragment = /* glsl */ `
${DAWN_GLSL}
varying vec3 vDir;

float cirrus(float u, float v) {
  return dawnNoise(vec2(u, v)) * 0.62 + dawnNoise(vec2(u * 2.6 + 7.3, v * 1.8 - 2.1)) * 0.38;
}

void main() {
  vec3 dir = normalize(vDir);
  float elev = asin(clamp(dir.y, -1.0, 1.0));
  float s = max(elev - uHorizon, 0.0);
  vec3 dirH = normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-5, 0.0, 0.0));
  vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-5, 0.0, 0.0));
  vec3 sunRight = vec3(-sunH.z, 0.0, sunH.x);
  float facing = dot(dirH, sunH);
  float toward = smoothstep(-0.35, 1.0, facing);
  vec3 sky = dawnRamp(s, facing);

  // Cirrus : longues nappes étirées le long de l'horizon, bord net (dessin animé), dessous
  // doré par le soleil encore bas. La couture de l'azimut est dans le dos du soleil.
  float phi = atan(dot(dirH, sunRight), facing);
  float cu = phi * 3.2 + uTime * 0.006;
  float cv = s * 38.0;
  float n = cirrus(cu, cv);
  float layer = smoothstep(0.018, 0.04, s) * (1.0 - smoothstep(0.1, 0.17, s));
  float cloud = smoothstep(0.6, 0.63, n) * layer;
  float rim = clamp((n - cirrus(cu, cv - 0.4)) * 7.0, 0.0, 1.0);
  vec3 cloudShade = lin(mix(vec3(0.8, 0.6, 0.8), vec3(0.93, 0.78, 0.84), uMorning));
  vec3 cloudLit = lin(mix(vec3(1.0, 0.75, 0.52), vec3(1.0, 0.95, 0.87), uMorning));
  sky = mix(sky, mix(cloudShade, cloudLit, clamp(rim + toward * 0.4, 0.0, 1.0)), cloud * 0.92);

  // Soleil : disque, halo, lueur d'horizon et rayons. Sous l'horizon visible, la mer (dessinée
  // après) masque le disque : il perce la ligne d'eau comme un vrai lever.
  float d = acos(clamp(dot(dir, uSunDir), -1.0, 1.0));
  vec3 glowColor = lin(vec3(1.0, 0.8, 0.52));
  float halo = exp(-d * d / 0.0016) * 0.85 + exp(-d * d / 0.02) * 0.38 + exp(-d * 3.5) * 0.18;
  sky += glowColor * (halo * 0.8 + dawnBand(s, facing) * 0.5) * (1.0 - cloud * 0.5);
  vec2 local = vec2(dot(dir, sunRight), dir.y - uSunDir.y);
  float angle = atan(local.y, local.x);
  vec2 spoke = vec2(cos(angle), sin(angle));
  float rays = dawnNoise(spoke * 4.0 + vec2(uTime * 0.05, 0.0)) * 0.6
    + dawnNoise(spoke * 9.0 - vec2(0.0, uTime * 0.04)) * 0.4;
  rays = smoothstep(0.52, 0.8, rays) * exp(-d * 3.0) * smoothstep(0.035, 0.12, d) * smoothstep(0.0, 0.02, s);
  sky += glowColor * rays * 0.3 * (1.0 - 0.55 * uMorning);
  float disc = 1.0 - smoothstep(0.0225, 0.0255, d);
  sky = mix(sky, lin(vec3(1.0, 0.97, 0.86)), disc);

  gl_FragColor = vec4(sky, uStrength);
  #include <colorspace_fragment>
}
`;

const seaVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const seaFragment = /* glsl */ `
${DAWN_GLSL}
uniform vec2 uCenter;
uniform float uFront;
varying vec3 vWorld;

void main() {
  // Seulement le large encore couvert par la carte : jamais l'eau déjà révélée.
  float r = length(vWorld.xz - uCenter);
  float mask = smoothstep(uFront + 10.0, uFront + 55.0, r) * uStrength;
  if (mask < 0.003) discard;
  vec3 view = normalize(vWorld - cameraPosition);
  float elev = asin(clamp(view.y, -1.0, 1.0));
  // Miroir de l'aube autour de la ligne d'horizon : continuité parfaite avec le ciel.
  float s = max(uHorizon - elev, 0.0);
  vec3 viewH = normalize(vec3(view.x, 0.0, view.z) + vec3(1e-5, 0.0, 0.0));
  vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-5, 0.0, 0.0));
  float facing = dot(viewH, sunH);
  vec3 water = lin(mix(vec3(0.17, 0.3, 0.46), vec3(0.2, 0.45, 0.6), uMorning));
  float grazing = 1.0 - smoothstep(0.0, 0.2, s);
  vec3 sea = mix(water, dawnRamp(s * 1.6, facing) * 0.8, 0.3 + 0.62 * grazing);
  vec3 glowColor = lin(vec3(1.0, 0.8, 0.52));
  sea += glowColor * dawnBand(s, facing) * 0.42;
  // Chemin de paillettes vers le soleil : large près de soi, fin à l'horizon.
  float off = acos(clamp(facing, -1.0, 1.0));
  float path = exp(-pow(off / (0.035 + s * 0.55), 2.0));
  float dist = length(vWorld.xz - cameraPosition.xz);
  float glint = dawnNoise(vWorld.xz * 0.45 + vec2(uTime * 0.9, -uTime * 0.5))
    * dawnNoise(vWorld.xz * 0.9 - vec2(uTime * 0.6, uTime * 0.7));
  glint = smoothstep(0.4, 0.6, glint) * (1.0 - smoothstep(220.0, 420.0, dist));
  float sunUp = smoothstep(-0.03, 0.0, uSunLift);
  sea += lin(vec3(1.0, 0.9, 0.66)) * path * (0.16 + glint * 1.2) * sunUp;
  gl_FragColor = vec4(sea, mask);
  #include <colorspace_fragment>
}
`;

/** Brume de pêche : les îles lointaines se fondent dans la lueur du matin. */
const DAWN_FOG = new Color('#efc2b2');
/** Le soleil se lève un peu à droite du cap du bateau : au centre du panoramique de la grue. */
const SUN_BEARING = 0.06;
/** Distance de l'horizon visible (bout de la mer, plan lointain de la caméra). */
const HORIZON_REACH = 610;
const DOME_RADIUS = 480;

const uniforms = {
  uSunDir: { value: new Vector3(1, 0, 0) },
  uSunLift: { value: -0.04 },
  uHorizon: { value: 0 },
  uMorning: { value: 0 },
  uTime: { value: 0 },
  uStrength: { value: 0 },
  uCenter: { value: new Vector2() },
  uFront: { value: 0 },
};

export function DawnSky() {
  const dome = useRef<Mesh>(null);
  const sea = useRef<Mesh>(null);
  /** Présence courante : elle décroît en douceur si l'ouverture est passée (clic, Échap). */
  const presence = useRef(0);
  const domeGeometry = useMemo(() => new SphereGeometry(DOME_RADIUS, 48, 24), []);
  const seaGeometry = useMemo(() => new CircleGeometry(800, 96).rotateX(-Math.PI / 2), []);
  const materials = useMemo(
    () => ({
      sky: new ShaderMaterial({
        uniforms,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
      sea: new ShaderMaterial({
        uniforms,
        vertexShader: seaVertex,
        fragmentShader: seaFragment,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    }),
    [],
  );
  useEffect(() => () => {
    domeGeometry.dispose();
    seaGeometry.dispose();
    materials.sky.dispose();
    materials.sea.dispose();
  }, [domeGeometry, materials, seaGeometry]);

  // Monté à l'écran-titre, donc après l'atmosphère : ce callback passe derrière le sien et
  // peut teinter la brume qu'elle vient d'écrire.
  useFrame((state, delta) => {
    const { phase, gameTransition, introCenter, introRadius } = useWorld.getState();
    const seconds = gameTransition * INTRO_DURATION;
    if (phase === 'transitioning') presence.current = dawnPresence(seconds);
    else presence.current = Math.max(0, presence.current - Math.min(delta, 1 / 30) / 0.6);
    const strength = presence.current;
    const shown = strength > 0.002;
    if (dome.current) dome.current.visible = shown;
    if (sea.current) sea.current.visible = shown;
    if (!shown) return;

    const camera = state.camera;
    const horizon = -Math.atan2(Math.max(camera.position.y, 0.5), HORIZON_REACH);
    const lift = dawnSunLift(seconds);
    const elevation = horizon + lift;
    const bearing = boatState.heading + SUN_BEARING;
    uniforms.uSunDir.value.set(
      Math.cos(bearing) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(bearing) * Math.cos(elevation),
    );
    uniforms.uSunLift.value = lift;
    uniforms.uHorizon.value = horizon;
    uniforms.uMorning.value = dawnMorning(seconds);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uStrength.value = strength;
    uniforms.uCenter.value.set(introCenter[0], introCenter[1]);
    uniforms.uFront.value = introRadius;
    dome.current?.position.copy(camera.position);
    sea.current?.position.set(introCenter[0], 0.1, introCenter[1]);

    const fog = state.scene.fog;
    if (fog instanceof Fog) fog.color.lerp(DAWN_FOG, strength * 0.78);
  });

  return (
    <>
      {/* Avant tout le reste du transparent : nuages, oiseaux et effets passent devant. */}
      <mesh ref={dome} geometry={domeGeometry} material={materials.sky} renderOrder={-50} frustumCulled={false} visible={false} raycast={() => null} />
      {/* Après la carte marine (ordre 20) : le large reflète l'aube. */}
      <mesh ref={sea} geometry={seaGeometry} material={materials.sea} renderOrder={25} frustumCulled={false} visible={false} raycast={() => null} />
    </>
  );
}
