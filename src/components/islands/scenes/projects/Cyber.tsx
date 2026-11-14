'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  Mesh,
  Object3D,
  PerspectiveCamera,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { hash } from '@/lib/utils/math';
import type { Project } from '@/types';
import { Hotspot, useHandFont } from '../../kit';
import { Maquette, type V3 } from './builder';
import { DAIS, PLAZA, ROAD, SITES, STAIRS, TOWN, VIEWPOINT, WALK, faceToward, type SiteId } from './layout';
import { glow, paint } from './materials';
import { Screen } from './Screens';
import { Plaque, SignText, signFrame } from './signs';
import { TOP } from './Town';

/**
 * 04 — FEEDER CYBER, le nouveau site, au cœur de la ville.
 *
 * Une plateforme sombre au milieu de la place, gardée par six bornes de sécurité, et
 * au-dessus d'elle une bulle d'espace qui reprend le design du site : fond noir, étoile
 * centrale éclatante, étoiles reliées par de fines lignes de constellation, grandes
 * orbites elliptiques, quelques planètes, des particules en spirale — et un trou noir
 * avec son disque d'accrétion. Un bandeau (le badge du projet, « Nouveau site ») tourne
 * autour de la bulle et, de temps en temps, une gerbe d'étincelles salue le lancement.
 * Des lignes de lumière relient la plateforme à tous les bâtiments de la ville.
 */

const ACCENT = '#8b6bff';
const BASE = TOP + DAIS.height;
/** Centre de la bulle d'espace. */
const ORB_Y = BASE + 3.35;
const ORB_RADIUS = 2.35;
const GALAXY_RADIUS = 1.95;
/** Direction (depuis le centre) de la console de présentation : vers le ponton. */
const CONSOLE_ANGLE = 2.75;

/* ------------------------------------------------------------------ shaders */

const POINTS_VERTEX = /* glsl */ `
attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
uniform float uSpin;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  // Rotation différentielle : le cœur tourne plus vite que les bras.
  float angle = aAngle + uTime * uSpin / (0.55 + aRadius);
  vec3 p = vec3(cos(angle) * aRadius, aHeight, sin(angle) * aRadius);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vTwinkle = 0.72 + 0.28 * sin(uTime * (1.3 + aPhase * 2.4) + aPhase * 40.0);
  gl_PointSize = clamp(aSize * uScale * vTwinkle / max(0.5, -mv.z), 1.0, 26.0);
  vColor = aColor;
}
`;

const POINTS_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float core = smoothstep(0.5, 0.0, d);
  float alpha = core * core * uOpacity * vTwinkle;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor * (0.7 + core * 0.8), alpha);
  #include <colorspace_fragment>
}
`;

/** Étoiles brillantes : cœur, halo et aigrettes en croix (comme sur le site). */
const STARS_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aFlare;
uniform float uTime;
uniform float uScale;
varying float vFlare;
varying float vPulse;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vPulse = 0.8 + 0.2 * sin(uTime * (1.7 + aPhase) + aPhase * 12.0);
  vFlare = aFlare;
  gl_PointSize = clamp(aSize * uScale * vPulse / max(0.5, -mv.z), 2.0, 80.0);
}
`;

const STARS_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFlare;
varying float vPulse;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float halo = exp(-d * d * 22.0) * 0.55;
  float core = exp(-d * d * 260.0);
  float spikes = max(0.0, 1.0 - abs(q.x) * 22.0) * max(0.0, 1.0 - abs(q.y) * 2.1)
    + max(0.0, 1.0 - abs(q.y) * 22.0) * max(0.0, 1.0 - abs(q.x) * 2.1);
  float alpha = (halo + core + spikes * 0.55 * vFlare) * vPulse * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), core), min(alpha, 1.0));
  #include <colorspace_fragment>
}
`;

const ORB_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** Intérieur de la bulle : nuit profonde au centre, bord violet. */
const ORB_BACK_FRAGMENT = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uEdge;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = 1.0 - facing;
  vec3 color = mix(uDeep, uEdge, smoothstep(0.35, 1.0, rim));
  float alpha = mix(0.88, 0.4, rim * rim) * uOpacity;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

/** Surface de la bulle : liseré lumineux (Fresnel) et un reflet. */
const ORB_FRONT_FRAGMENT = /* glsl */ `
uniform vec3 uRim;
uniform float uStrength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.6);
  float glint = smoothstep(0.86, 0.96, dot(n, normalize(vec3(-0.5, 0.75, 0.35)))) * 0.35;
  gl_FragColor = vec4(uRim * (rim * uStrength + glint), 1.0);
  #include <colorspace_fragment>
}
`;

const UV_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Faisceau du projecteur : fondu vers le haut, lignes de balayage qui montent. */
const BEAM_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.1) * smoothstep(0.0, 0.1, vUv.y) + smoothstep(0.7, 1.0, vUv.y) * 0.25;
  float scan = 0.7 + 0.3 * sin(vUv.y * 48.0 - uTime * 5.0);
  float ribs = 0.65 + 0.35 * pow(abs(sin(vUv.x * 3.14159 * 8.0)), 8.0);
  gl_FragColor = vec4(uColor * scan * ribs, fade * uOpacity);
  #include <colorspace_fragment>
}
`;

/** Disque d'accrétion : anneau chaud qui tourne, anneau de photons au bord du trou. */
const DISK_FRAGMENT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float ring = smoothstep(0.38, 0.48, r) * (1.0 - smoothstep(0.76, 1.0, r));
  float swirl = 0.55 + 0.45 * sin(a * 3.0 - uTime * 3.2 + r * 9.0);
  vec3 hot = mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.58, 0.28), smoothstep(0.42, 0.68, r));
  hot = mix(hot, vec3(0.62, 0.38, 1.0), smoothstep(0.62, 0.95, r));
  float photon = exp(-pow((r - 0.4) * 28.0, 2.0)) * 1.3;
  float alpha = ring * swirl + photon;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(hot * (0.85 + photon), min(alpha, 1.0));
  #include <colorspace_fragment>
}
`;

/** Lignes de lumière au sol : des impulsions courent de la plateforme vers les bâtiments. */
const NET_VERTEX = /* glsl */ `
attribute float aDist;
varying float vDist;
varying float vAcross;
void main() {
  vDist = aDist;
  vAcross = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NET_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uA;
uniform vec3 uB;
varying float vDist;
varying float vAcross;
void main() {
  float pulse = fract(vDist * 0.22 - uTime * 0.55);
  float head = smoothstep(0.82, 0.98, pulse) * (1.0 - smoothstep(0.98, 1.0, pulse));
  float edge = 1.0 - abs(vAcross - 0.5) * 2.0;
  float base = mix(0.5, 0.8, uNight);
  vec3 color = mix(uA, uB, head) * (base + head * 2.2);
  gl_FragColor = vec4(color, smoothstep(0.0, 0.35, edge) * (0.6 + head * 0.4 + uNight * 0.2));
  #include <colorspace_fragment>
}
`;

/** Étincelles du lancement : une gerbe régulière qui retombe en s'éteignant. */
const SPARK_VERTEX = /* glsl */ `
attribute vec3 aVelocity;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
varying float vLife;
varying vec3 vColor;
void main() {
  float period = 6.5;
  float t = mod(uTime + aPhase * 0.25, period);
  float life = clamp(t / 2.2, 0.0, 1.0);
  vec3 p = aVelocity * t - vec3(0.0, 0.9 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vLife = life;
  vColor = aColor;
  float size = (1.0 - life) * step(t, 2.2);
  gl_PointSize = clamp(0.16 * uScale * size / max(0.5, -mv.z), 0.0, 12.0);
}
`;

const SPARK_FRAGMENT = /* glsl */ `
varying float vLife;
varying vec3 vColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float alpha = smoothstep(0.5, 0.0, length(q)) * (1.0 - vLife);
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(vColor * 1.6, alpha);
  #include <colorspace_fragment>
}
`;

/* ------------------------------------------------------------ données de la galaxie */

function galaxyData(count: number) {
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const core = new Color('#fff2e6');
  const lilac = new Color('#b7a2ff');
  const violet = new Color('#7a5cff');
  const cyan = new Color('#6fe6ff');
  const pink = new Color('#ff8fd8');
  const tint = new Color();
  for (let index = 0; index < count; index++) {
    const halo = index % 7 === 0;
    const arm = index % 2;
    const t = Math.pow(hash(index * 1.37 + 0.2), halo ? 0.6 : 0.85);
    const r = 0.08 + t * GALAXY_RADIUS;
    const spread = (hash(index * 4.11) - 0.5) * (halo ? Math.PI * 2 : 0.55 + t * 0.4);
    radius[index] = r;
    angle[index] = arm * Math.PI + r * 2.35 + spread;
    height[index] = (hash(index * 2.93) - 0.5) * (halo ? 0.7 : 0.16) * (1.1 - t);
    size[index] = 0.05 + hash(index * 5.7) * 0.07 + (1 - t) * 0.05;
    phase[index] = hash(index * 9.3);
    if (t < 0.18) tint.copy(core).lerp(lilac, t / 0.18);
    else tint.copy(lilac).lerp(hash(index * 3.3) > 0.55 ? cyan : violet, Math.min(1, (t - 0.18) * 1.6));
    if (hash(index * 6.1) > 0.94) tint.copy(pink);
    tint.toArray(colors, index * 3);
  }
  return { position: new Float32Array(count * 3), radius, angle, height, size, phase, colors };
}

/** Étoiles de la constellation [angle, rayon, hauteur] dans le disque, et leurs liens. */
const CONSTELLATION: [number, number, number][] = [
  [0.1, 1.55, 0.18],
  [1.0, 1.25, 0.35],
  [1.75, 1.6, 0.12],
  [2.55, 1.35, 0.42],
  [3.25, 1.7, 0.2],
  [4.0, 1.2, 0.3],
  [4.75, 1.6, 0.05],
  [5.5, 1.3, 0.38],
  [2.1, 0.7, 0.55],
  [5.0, 0.62, 0.5],
];
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [1, 8], [8, 3], [5, 9], [9, 7], [8, 9],
];

function starPosition([angle, radius, height]: [number, number, number]): V3 {
  return [Math.cos(angle) * radius, height, Math.sin(angle) * radius];
}

/** Ellipses d'orbite : demi-axes, inclinaison, vitesse et couleur de la planète. */
const ORBITS = [
  { a: 2.75, b: 2.25, tilt: [0.32, 0.4, 0.12] as V3, speed: 0.22, planet: '#ffb35c', size: 0.17 },
  { a: 2.15, b: 1.85, tilt: [-0.22, -0.6, 0.2] as V3, speed: -0.34, planet: '#5ee0ff', size: 0.13 },
  { a: 3.2, b: 2.7, tilt: [0.14, 1.4, -0.18] as V3, speed: 0.15, planet: '#ff7ab8', size: 0.2 },
];

function ellipsePoint(orbit: (typeof ORBITS)[number], t: number, out: Vector3, holder: Object3D) {
  out.set(Math.cos(t) * orbit.a, 0, Math.sin(t) * orbit.b);
  out.applyEuler(holder.rotation);
  return out;
}

/* ---------------------------------------------------------------- hologramme */

/** Taille des points en pixels pour un mètre vu à un mètre de distance. */
function pointScale(camera: PerspectiveCamera, height: number, dpr: number) {
  const fov = ((camera.fov ?? 45) * Math.PI) / 180;
  return (height * dpr) / (2 * Math.tan(fov / 2));
}

function tick(material: ShaderMaterial | null, time: number, scale: number) {
  if (!material) return;
  const { uniforms } = material;
  if (uniforms.uScale) uniforms.uScale.value = scale;
  if (uniforms.uTime) uniforms.uTime.value = time;
}

function useTicker(text: string | undefined) {
  const family = useHandFont();
  const texture = useMemo(() => {
    if (!family || !text) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(64, 40, 160, 0.82)';
    ctx.fillRect(0, 8, 1024, 48);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 8, 1024, 2);
    ctx.fillRect(0, 54, 1024, 2);
    ctx.font = `600 40px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let slot = 0; slot < 4; slot++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${text}  ✦`, 128 + slot * 256, 33, 240);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.wrapS = RepeatWrapping;
    result.repeat.set(2, 1);
    result.anisotropy = 8;
    return result;
  }, [family, text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function SpaceOrb({ badge, hovered }: { badge?: string; hovered: RefObject<boolean> }) {
  const quality = useWorld((state) => state.quality);
  const count = quality === 'high' ? 2600 : quality === 'medium' ? 1700 : 900;
  const galaxy = useMemo(() => galaxyData(count), [count]);
  const galaxyRef = useRef<ShaderMaterial>(null);
  const starsRef = useRef<ShaderMaterial>(null);
  const sparkRef = useRef<ShaderMaterial>(null);
  const beamRef = useRef<ShaderMaterial>(null);
  const diskRef = useRef<ShaderMaterial>(null);
  const frontRef = useRef<ShaderMaterial>(null);
  const spinner = useRef<Group>(null);
  const planets = useRef<InstancedMesh>(null);
  const ringed = useRef<Mesh>(null);
  const ticker = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      galaxy: { uTime: { value: 0 }, uScale: { value: 600 }, uSpin: { value: 0.45 }, uOpacity: { value: 0.9 } },
      stars: { uTime: { value: 0 }, uScale: { value: 600 }, uColor: { value: new Color('#d9d2ff') }, uOpacity: { value: 1 } },
      sparks: { uTime: { value: 0 }, uScale: { value: 600 } },
      back: { uDeep: { value: new Color('#05061a') }, uEdge: { value: new Color('#3a2a8a') }, uOpacity: { value: 1 } },
      front: { uRim: { value: new Color('#a990ff') }, uStrength: { value: 0.9 } },
      beam: { uColor: { value: new Color('#9d86ff') }, uTime: { value: 0 }, uOpacity: { value: 0.45 } },
      disk: { uTime: { value: 0 } },
    }),
    [],
  );

  // Étoiles brillantes : l'étoile centrale (grande, aigrettes) puis la constellation.
  const stars = useMemo(() => {
    const list = [[0, 0, 0] as V3, ...CONSTELLATION.map(starPosition)];
    const positions = new Float32Array(list.length * 3);
    const sizes = new Float32Array(list.length);
    const phases = new Float32Array(list.length);
    const flares = new Float32Array(list.length);
    list.forEach((point, index) => {
      positions.set(point, index * 3);
      sizes[index] = index === 0 ? 1.9 : 0.5 + hash(index * 3.3) * 0.32;
      phases[index] = hash(index * 7.7);
      flares[index] = index === 0 ? 1 : hash(index * 1.9) > 0.5 ? 0.7 : 0.25;
    });
    return { positions, sizes, phases, flares };
  }, []);

  const geometries = useMemo(() => {
    const links = new BufferGeometry();
    const linkPositions = new Float32Array(LINKS.length * 6);
    LINKS.forEach(([a, b], index) => {
      linkPositions.set(starPosition(CONSTELLATION[a]), index * 6);
      linkPositions.set(starPosition(CONSTELLATION[b]), index * 6 + 3);
    });
    links.setAttribute('position', new BufferAttribute(linkPositions, 3));

    // Grandes ellipses d'orbite (fines lignes), comme sur la page d'accueil du site.
    const holder = new Object3D();
    const point = new Vector3();
    const segments = 96;
    const orbitPositions = new Float32Array(ORBITS.length * segments * 6);
    let cursor = 0;
    ORBITS.forEach((orbit) => {
      holder.rotation.set(orbit.tilt[0], orbit.tilt[1], orbit.tilt[2]);
      for (let step = 0; step < segments; step++) {
        ellipsePoint(orbit, (step / segments) * Math.PI * 2, point, holder);
        orbitPositions.set([point.x, point.y, point.z], cursor);
        ellipsePoint(orbit, ((step + 1) / segments) * Math.PI * 2, point, holder);
        orbitPositions.set([point.x, point.y, point.z], cursor + 3);
        cursor += 6;
      }
    });
    const orbits = new BufferGeometry();
    orbits.setAttribute('position', new BufferAttribute(orbitPositions, 3));
    return { links, orbits };
  }, []);

  const sparks = useMemo(() => {
    const total = 70;
    const velocity = new Float32Array(total * 3);
    const phase = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    const palette = [new Color('#ffffff'), new Color('#c9b8ff'), new Color('#6fe6ff'), new Color('#ffd27a')];
    for (let index = 0; index < total; index++) {
      const a = hash(index * 3.7) * Math.PI * 2;
      const up = 0.5 + hash(index * 1.3) * 0.9;
      const out = 0.5 + hash(index * 5.1) * 0.9;
      velocity.set([Math.cos(a) * out, up * 1.4, Math.sin(a) * out], index * 3);
      phase[index] = hash(index * 8.1);
      palette[index % palette.length].toArray(colors, index * 3);
    }
    return { position: new Float32Array(total * 3), velocity, phase, colors, total };
  }, []);

  const lines = useMemo(
    () => ({
      links: new LineBasicMaterial({ color: '#efeaff', transparent: true, opacity: 0.75, depthWrite: false }),
      orbits: new LineBasicMaterial({ color: '#d2c9ff', transparent: true, opacity: 0.42, depthWrite: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      geometries.links.dispose();
      geometries.orbits.dispose();
      lines.links.dispose();
      lines.orbits.dispose();
    },
    [geometries, lines],
  );

  useLayoutEffect(() => {
    const mesh = planets.current;
    if (!mesh) return;
    ORBITS.forEach((orbit, index) => mesh.setColorAt(index, new Color(orbit.planet)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  const tickerTexture = useTicker(badge);
  const scratch = useMemo(() => ({ dummy: new Object3D(), holder: new Object3D(), point: new Vector3() }), []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    const night = skyState.dayNight;
    const boost = hovered.current ? 1.5 : 1;
    const scale = pointScale(state.camera as PerspectiveCamera, state.size.height, state.viewport.dpr);
    tick(galaxyRef.current, time, scale);
    tick(starsRef.current, time, scale);
    tick(sparkRef.current, time, scale);
    tick(beamRef.current, time, scale);
    tick(diskRef.current, time, scale);
    const galaxyUniforms = galaxyRef.current?.uniforms;
    if (galaxyUniforms) {
      galaxyUniforms.uSpin.value += ((hovered.current ? 1.3 : 0.45) - galaxyUniforms.uSpin.value) * Math.min(1, dt * 2);
      galaxyUniforms.uOpacity.value = 0.85 + night * 0.15;
    }
    if (starsRef.current) starsRef.current.uniforms.uOpacity.value = (0.85 + night * 0.3) * boost;
    if (beamRef.current) beamRef.current.uniforms.uOpacity.value = (0.3 + night * 0.4) * boost;
    if (frontRef.current) frontRef.current.uniforms.uStrength.value = (0.75 + night * 0.6) * boost;
    if (spinner.current) spinner.current.rotation.y = time * 0.07;
    if (ticker.current) ticker.current.rotation.y = -time * 0.22;
    const mesh = planets.current;
    if (mesh) {
      const { dummy, holder, point } = scratch;
      ORBITS.forEach((orbit, index) => {
        holder.rotation.set(orbit.tilt[0], orbit.tilt[1], orbit.tilt[2]);
        ellipsePoint(orbit, time * orbit.speed + index * 2.1, point, holder);
        dummy.position.copy(point);
        dummy.rotation.set(0, time * 0.8, 0.4);
        dummy.scale.setScalar(orbit.size);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        if (index === 2 && ringed.current) {
          ringed.current.position.copy(point);
          ringed.current.rotation.set(1.15, time * 0.3, 0.3);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const beamBottom = BASE + 0.58 - ORB_Y;
  const beamTop = -0.05;

  return (
    <group position-y={ORB_Y}>
      {/* Bulle d'espace : fond sombre (dessiné d'abord), liseré lumineux (en dernier). */}
      <mesh renderOrder={10} raycast={() => null}>
        <sphereGeometry args={[ORB_RADIUS, 40, 28]} />
        <shaderMaterial uniforms={uniforms.back} vertexShader={ORB_VERTEX} fragmentShader={ORB_BACK_FRAGMENT} transparent depthWrite={false} side={BackSide} />
      </mesh>

      {/* Faisceau du projecteur, de l'émetteur jusqu'au plan de la galaxie. */}
      <mesh position-y={(beamBottom + beamTop) / 2} renderOrder={11} raycast={() => null}>
        <cylinderGeometry args={[GALAXY_RADIUS * 0.85, 0.3, beamTop - beamBottom, 32, 1, true]} />
        <shaderMaterial
          ref={beamRef}
          uniforms={uniforms.beam}
          vertexShader={UV_VERTEX}
          fragmentShader={BEAM_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>

      {/* Galaxie en spirale (particules). */}
      <points renderOrder={12} frustumCulled={false} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[galaxy.position, 3]} />
          <bufferAttribute attach="attributes-aRadius" args={[galaxy.radius, 1]} />
          <bufferAttribute attach="attributes-aAngle" args={[galaxy.angle, 1]} />
          <bufferAttribute attach="attributes-aHeight" args={[galaxy.height, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[galaxy.size, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[galaxy.phase, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[galaxy.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={galaxyRef}
          uniforms={uniforms.galaxy}
          vertexShader={POINTS_VERTEX}
          fragmentShader={POINTS_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      <group ref={spinner}>
        {/* Constellation : étoiles reliées par de fines lignes, et l'étoile centrale. */}
        <group rotation-x={0.08}>
          <lineSegments geometry={geometries.links} material={lines.links} renderOrder={13} raycast={() => null} />
          <points renderOrder={14} frustumCulled={false} raycast={() => null}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
              <bufferAttribute attach="attributes-aSize" args={[stars.sizes, 1]} />
              <bufferAttribute attach="attributes-aPhase" args={[stars.phases, 1]} />
              <bufferAttribute attach="attributes-aFlare" args={[stars.flares, 1]} />
            </bufferGeometry>
            <shaderMaterial
              ref={starsRef}
              uniforms={uniforms.stars}
              vertexShader={STARS_VERTEX}
              fragmentShader={STARS_FRAGMENT}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </points>
        </group>
        {/* Trou noir et son disque d'accrétion, au bord de la galaxie. */}
        <group position={[-1.5, 0.32, 1.15]} rotation={[0.5, 0, -0.35]}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.19, 20, 14]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} renderOrder={13} raycast={() => null}>
            <planeGeometry args={[1.2, 1.2]} />
            <shaderMaterial
              ref={diskRef}
              uniforms={uniforms.disk}
              vertexShader={UV_VERTEX}
              fragmentShader={DISK_FRAGMENT}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>

      {/* Grandes orbites et leurs planètes. */}
      <lineSegments geometry={geometries.orbits} material={lines.orbits} renderOrder={13} raycast={() => null} />
      <instancedMesh ref={planets} args={[undefined, undefined, ORBITS.length]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.55} emissive="#3a2a6a" emissiveIntensity={0.6} flatShading />
      </instancedMesh>
      <mesh ref={ringed} scale={0.36} raycast={() => null}>
        <torusGeometry args={[1, 0.08, 4, 32]} />
        <meshBasicMaterial color="#ffd6ef" toneMapped={false} />
      </mesh>

      {/* Gerbe d'étincelles du lancement, au sommet de la bulle. */}
      <points position-y={ORB_RADIUS * 0.9} renderOrder={16} frustumCulled={false} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparks.position, 3]} />
          <bufferAttribute attach="attributes-aVelocity" args={[sparks.velocity, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[sparks.phase, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[sparks.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={sparkRef}
          uniforms={uniforms.sparks}
          vertexShader={SPARK_VERTEX}
          fragmentShader={SPARK_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      {/* Surface de la bulle (liseré). */}
      <mesh renderOrder={15} raycast={() => null}>
        <sphereGeometry args={[ORB_RADIUS, 40, 28]} />
        <shaderMaterial
          ref={frontRef}
          uniforms={uniforms.front}
          vertexShader={ORB_VERTEX}
          fragmentShader={ORB_FRONT_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={FrontSide}
        />
      </mesh>

      {/* Bandeau défilant (le badge du projet) autour de la bulle. */}
      {tickerTexture && (
        <mesh ref={ticker} position-y={-0.2} renderOrder={17} raycast={() => null}>
          <cylinderGeometry args={[ORB_RADIUS + 0.2, ORB_RADIUS + 0.2, 0.36, 64, 1, true]} />
          <meshStandardMaterial
            map={tickerTexture}
            emissive="#ffffff"
            emissiveMap={tickerTexture}
            emissiveIntensity={0.85}
            transparent
            alphaTest={0.05}
            side={FrontSide}
            roughness={0.6}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/* ---------------------------------------------------------- lignes du réseau */

function NetworkLines() {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uNight: { value: 0 }, uA: { value: new Color('#7b5cff') }, uB: { value: new Color('#7ff4ff') } }),
    [],
  );
  const geometry = useMemo(() => {
    const targets: SiteId[] = ['tech-center', 'gallery', 'medical', 'workshops'];
    const angles = [...targets.map((id) => SITES[id].angle), STAIRS.angle, SITES.shipyard.angle + 0.25];
    const positions: number[] = [];
    const uvs: number[] = [];
    const dists: number[] = [];
    const width = 0.09;
    const segment = (angle: number, r0: number, r1: number, y: number, bend = 0) => {
      const steps = 6;
      for (let step = 0; step < steps; step++) {
        const a0 = r0 + ((r1 - r0) * step) / steps;
        const a1 = r0 + ((r1 - r0) * (step + 1)) / steps;
        const t0 = angle + bend * ((a0 - r0) / (r1 - r0));
        const t1 = angle + bend * ((a1 - r0) / (r1 - r0));
        const p0 = [Math.cos(t0) * a0, Math.sin(t0) * a0];
        const p1 = [Math.cos(t1) * a1, Math.sin(t1) * a1];
        const dx = p1[0] - p0[0];
        const dz = p1[1] - p0[1];
        const length = Math.hypot(dx, dz) || 1;
        const nx = (-dz / length) * width;
        const nz = (dx / length) * width;
        const quad = [
          [p0[0] - nx, p0[1] - nz, a0, 0],
          [p0[0] + nx, p0[1] + nz, a0, 1],
          [p1[0] - nx, p1[1] - nz, a1, 0],
          [p1[0] + nx, p1[1] + nz, a1, 1],
        ];
        for (const index of [0, 2, 1, 1, 2, 3]) {
          const [x, z, d, v] = quad[index];
          positions.push(x, y, z);
          uvs.push(0, v);
          dists.push(d);
        }
      }
    };
    angles.forEach((angle, index) => {
      const bend = (index % 2 ? 1 : -1) * 0.12;
      segment(angle, DAIS.radius + 0.4, PLAZA.radius - 0.02, TOP + 0.006, bend);
      const roadAngle = angle + bend;
      segment(roadAngle, PLAZA.radius + 0.14, ROAD.outer - 0.05, TOWN.level + 0.046);
      segment(roadAngle, ROAD.outer + 0.1, WALK.outer + 0.3, TOP + 0.006);
    });
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    result.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    result.setAttribute('aDist', new BufferAttribute(new Float32Array(dists), 1));
    result.computeBoundingSphere();
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    const current = material.current;
    if (!current) return;
    current.uniforms.uTime.value = state.clock.elapsedTime;
    current.uniforms.uNight.value = skyState.dayNight;
  });
  return (
    <mesh geometry={geometry} renderOrder={3} raycast={() => null}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={NET_VERTEX}
        fragmentShader={NET_FRAGMENT}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

/* ---------------------------------------------------------------- plateforme */

const CONSOLE_TILT = 0.95;

function buildDais() {
  const m = new Maquette();
  const lights = new Maquette();
  // Marche basse puis plateforme.
  m.cylinder(DAIS.radius + 0.32, DAIS.radius + 0.38, 0.18, [0, TOP + 0.09, 0], '#4a4470', 40);
  m.cylinder(DAIS.radius, DAIS.radius + 0.06, DAIS.height - 0.18, [0, TOP + 0.18 + (DAIS.height - 0.18) / 2, 0], '#2d2950', 40);
  m.cylinder(DAIS.radius - 0.12, DAIS.radius - 0.12, 0.03, [0, BASE + 0.005, 0], '#3a3566', 40, [0, 0, 0], 0.15);
  lights.torus(DAIS.radius - 0.25, 0.035, [0, BASE + 0.02, 0], '#9d86ff', [Math.PI / 2, 0, 0], 64);
  lights.torus(DAIS.radius + 0.35, 0.03, [0, TOP + 0.185, 0], '#7ff4ff', [Math.PI / 2, 0, 0], 64);
  // Traces de circuit gravées dans la plateforme.
  for (let trace = 0; trace < 8; trace++) {
    const a = (trace / 8) * Math.PI * 2 + 0.2;
    const r0 = 0.75;
    const r1 = DAIS.radius - 0.35;
    lights.box([r1 - r0, 0.012, 0.045], [(Math.cos(a) * (r0 + r1)) / 2, BASE + 0.012, (Math.sin(a) * (r0 + r1)) / 2], trace % 2 ? '#7ff4ff' : '#9d86ff', [0, -a, 0]);
    lights.sphere(0.06, [Math.cos(a) * r1, BASE + 0.02, Math.sin(a) * r1], '#ffffff', 0);
  }
  // Émetteur central : socle, bague, lentille lumineuse.
  m.cylinder(0.5, 0.62, 0.36, [0, BASE + 0.18, 0], '#2a2647', 16);
  m.cylinder(0.38, 0.46, 0.16, [0, BASE + 0.44, 0], '#5d55a0', 16);
  lights.cylinder(0.3, 0.3, 0.05, [0, BASE + 0.54, 0], '#e6dcff', 16);
  lights.torus(0.42, 0.03, [0, BASE + 0.53, 0], '#7ff4ff', [Math.PI / 2, 0, 0], 24);
  // Bornes de sécurité autour de la plateforme.
  for (let pylon = 0; pylon < 6; pylon++) {
    const a = (pylon / 6) * Math.PI * 2 + 0.52;
    const r = DAIS.radius - 0.42;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    m.box([0.26, 0.86, 0.26], [x, BASE + 0.43, z], '#26223f', [0, -a, 0]);
    m.cone(0.19, 0.3, [x, BASE + 1.01, z], '#3d3770', 4, [0, -a + Math.PI / 4, 0]);
    lights.box([0.05, 0.5, 0.272], [x, BASE + 0.45, z], pylon % 2 ? '#9d86ff' : '#7ff4ff', [0, -a, 0]);
  }
  // Console de présentation, côté ponton : pupitre incliné vers les visiteurs.
  const c = Math.cos(CONSOLE_ANGLE);
  const s = Math.sin(CONSOLE_ANGLE);
  const cr = DAIS.radius - 0.55;
  const x = c * cr;
  const z = s * cr;
  const facing = Math.atan2(c, s);
  m.box([2.3, 0.8, 0.9], [x, BASE + 0.4, z], '#2a2647', [0, facing, 0]);
  const slab: V3 = [x - c * 0.12, BASE + 1.0, z - s * 0.12];
  m.box([2.42, 0.1, 1.5], slab, '#3f3a72', [CONSOLE_TILT, facing, 0]);
  lights.box([2.44, 0.03, 0.04], [x + c * 0.47, BASE + 0.8, z + s * 0.47], '#9d86ff', [0, facing, 0]);
  return { body: m.build(), lights: lights.build(), console: { x, z, facing, slab } };
}

export function CyberCenter({ project }: { project: Project }) {
  const hovered = useRef(false);
  const dais = useMemo(() => buildDais(), []);
  useEffect(
    () => () => {
      dais.body.dispose();
      dais.lights.dispose();
    },
    [dais],
  );

  // Panneau peint du titre, à l'ouest de la plateforme, face au ponton.
  const signAngle = 3.25;
  const signR = DAIS.radius + 0.95;
  const signX = Math.cos(signAngle) * signR;
  const signZ = Math.sin(signAngle) * signR;
  const signRotation = faceToward(signX, signZ, VIEWPOINT[0], VIEWPOINT[1]);
  const sign = useMemo(() => {
    const m = new Maquette();
    const text = signFrame(m, [signX, TOP, signZ], signRotation, 1.9, 1.05);
    return { geometry: m.build(), text };
  }, [signRotation, signX, signZ]);
  useEffect(() => () => sign.geometry.dispose(), [sign]);

  const { console: desk } = dais;
  const screenWidth = 2.1;
  const front: V3 = [desk.x + Math.cos(CONSOLE_ANGLE) * 0.47, BASE + 0.4, desk.z + Math.sin(CONSOLE_ANGLE) * 0.47];

  return (
    <group>
      <NetworkLines />
      <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.035}>
        <group
          onPointerOver={() => {
            hovered.current = true;
          }}
          onPointerOut={() => {
            hovered.current = false;
          }}
        >
          <mesh geometry={dais.body} material={paint} castShadow receiveShadow />
          <mesh geometry={dais.lights} material={glow} />
          {/* Grand écran du pupitre : la vraie page d'accueil du site. */}
          <group position={desk.slab} rotation={[0, desk.facing, 0]}>
            <group rotation-x={CONSOLE_TILT}>
              <Screen
                width={screenWidth}
                height={screenWidth / 1.6}
                url={project.screenshots?.[0]}
                fallback="space"
                position={[0, 0.056, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            </group>
          </group>
          <Plaque index={project.index} accent={project.accent} size={0.6} position={front} rotation={[0, desk.facing, 0]} />
          <SpaceOrb badge={project.badge} hovered={hovered} />
          {/* Volume de clic généreux autour de la bulle. */}
          <mesh position-y={ORB_Y} visible={false}>
            <sphereGeometry args={[ORB_RADIUS * 1.05, 12, 8]} />
          </mesh>
        </group>
      </Hotspot>
      <mesh geometry={sign.geometry} material={paint} castShadow raycast={() => null} />
      <SignText lines={[project.title]} accent={ACCENT} width={1.9} position={sign.text} rotation={[0, signRotation, 0]} />
    </group>
  );
}
