'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Camera,
  type Intersection,
  type Raycaster,
} from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { ambience } from '@/lib/audio/ambience';
import { useWorld } from '@/lib/store';
import { clamp, smoothstep } from '@/lib/utils/math';
import { SKY_LAYER_GLSL, SKY_RADIUS, skyLayerUniforms, skyParams, skyPlaceCPU } from './sky-layer';

/**
 * Étoiles filantes, de temps en temps la nuit : une traînée pailletée, une étoile à quatre
 * branches en tête. Elles naissent dans la part du ciel que la caméra voit — directement si
 * elle regarde en l'air, dans le reflet de la mer sinon. Un clic (ou un toucher) sur l'une
 * d'elles fait un vœu : un arpège, une couronne d'étincelles, et les constellations brillent
 * un instant.
 */
const vertexShader = /* glsl */ `
${SKY_LAYER_GLSL}
uniform vec3 uHead;
uniform vec3 uTail;
uniform float uMeteor;
uniform float uBurst;
varying vec2 vCorner;
varying float vKind;
varying float vFade;

void hide() {
  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
  vFade = 0.0;
}

void main() {
  float kind = position.z;
  bool sea = uPass > 0.5;
  vCorner = position.xy;
  vKind = kind;
  float fadeHead;
  vec4 head = skyClip(skyPlace(uHead, fadeHead));
  if (uMeteor + uBurst <= 0.001 || head.w < 0.5) {
    hide();
    return;
  }
  if (kind < 0.5) {
    // Traînée : fine à la queue, plus épaisse et plus claire à la tête.
    float fadeTail;
    vec4 tail = skyClip(skyPlace(uTail, fadeTail));
    if (tail.w < 0.5 || uMeteor <= 0.001) {
      hide();
      return;
    }
    vec2 sh = head.xy / head.w * uViewport * 0.5;
    vec2 st = tail.xy / tail.w * uViewport * 0.5;
    vec2 along = normalize(sh - st + vec2(1e-4, 0.0));
    vec2 normal = vec2(-along.y, along.x);
    float end = position.x;
    vec4 clip = end < 0.5 ? tail : head;
    float width = mix(0.35, 2.4, end) * (sea ? 0.8 : 1.0);
    skyClipOffset(clip, normal * position.y * (width + 1.2));
    vFade = uMeteor * min(fadeHead, fadeTail) * (sea ? 0.62 : 1.0);
    gl_Position = clip;
    return;
  }
  // Tête (et couronne du vœu : le quad s'agrandit pendant l'éclat).
  vec4 clip = head;
  float size = (uBurst > 0.001 ? 81.0 : 11.0) * (sea ? 0.85 : 1.0);
  skyClipOffset(clip, position.xy * size * vec2(1.0, sea ? 1.5 : 1.0));
  vFade = fadeHead * (sea ? 0.68 : 1.0);
  gl_Position = clip;
}
`;

const fragmentShader = /* glsl */ `
uniform float uMeteor;
uniform float uBurst;
uniform float uTime;
uniform float uPass;
uniform float uMotion;
varying vec2 vCorner;
varying float vKind;
varying float vFade;

void main() {
  if (vFade < 0.001) discard;
  vec3 color;
  float alpha;
  if (vKind < 0.5) {
    float along = vCorner.x;
    float soft = 1.0 - smoothstep(0.3, 1.0, abs(vCorner.y));
    float glitter = smoothstep(0.7, 1.0, sin(along * 46.0 - uTime * 18.0)) * along * 0.8;
    alpha = soft * (pow(along, 1.8) + glitter) * vFade;
    color = mix(vec3(0.6, 0.78, 1.0), vec3(1.0, 0.97, 0.9), along);
  } else {
    float burst = step(0.001, uBurst);
    vec2 h = vCorner * mix(1.0, 7.36, burst);
    vec2 ah = abs(h);
    float core = exp(-dot(h, h) * 16.0);
    float rays = exp(-ah.x * 13.0) * exp(-ah.y * 2.2) + exp(-ah.y * 13.0) * exp(-ah.x * 2.2);
    float star = (core + rays * 0.7) * max(uMeteor, uBurst);
    // Couronne d'étincelles qui s'élargit en s'effaçant.
    float d = length(vCorner);
    float ringRadius = 0.16 + 0.78 * (1.0 - uBurst);
    float sparks = pow(abs(cos(atan(vCorner.y, vCorner.x) * 4.0 + uTime * 0.6)), 10.0);
    float ring = exp(-pow((d - ringRadius) / 0.035, 2.0)) * (0.35 + sparks) * uBurst * burst;
    float halo = exp(-d * d * 7.0) * uBurst * 0.22 * burst;
    alpha = (star + ring + halo) * vFade;
    color = mix(vec3(0.95, 0.97, 1.0), vec3(1.0, 0.86, 0.55), clamp(ring * 1.5 + halo * 2.0, 0.0, 1.0));
  }
  // Reflet : l'image se brise en bandes horizontales, comme sur une eau ridée.
  if (uPass > 0.5) {
    float ripple = 0.6 + 0.4 * sin(gl_FragCoord.y * 0.45 + uTime * 2.2 + sin(gl_FragCoord.x * 0.05 + uTime * 0.7) * 2.0);
    alpha *= mix(0.8, ripple, uMotion);
  }
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const meteorUniforms = {
  uHead: { value: new Vector3(0, 1, 0) },
  uTail: { value: new Vector3(0, 1, 0) },
  uMeteor: { value: 0 },
  uBurst: { value: 0 },
};
const skyPass = { value: 0 };
const seaPass = { value: 1 };

/** `?sky=meteor` : une étoile filante tenue à mi-course (captures). */
const hold = skyParams.sky?.includes('meteor') === true;

/** Étoile filante courante (une seule à la fois) ; état hors React. */
const meteor = {
  active: false,
  progress: 0,
  duration: 2.4,
  wait: hold ? 0 : 9 + Math.random() * 10,
  wished: false,
  caught: false,
  hovered: false,
  start: new Vector3(),
  end: new Vector3(),
};
const forward = new Vector3();
const DEG = Math.PI / 180;

/** Naît dans la part du ciel que la caméra voit : en l'air, ou dans le reflet de la mer. */
function spawn(camera: Camera) {
  camera.getWorldDirection(forward);
  const azimuth = Math.atan2(forward.z, forward.x);
  const pitch = Math.asin(clamp(-forward.y, -1, 1));
  const vfov = (camera instanceof PerspectiveCamera ? camera.fov : 42) * DEG;
  // Hauteur visée : celle que voit le reflet (plongée) ou le regard (contre-plongée).
  const center = pitch > 0.2 ? pitch : Math.max(-pitch, 0.4);
  const spread = Math.max(vfov * 0.5 - 0.1, 0.08);
  const startEl = clamp(center + spread * (0.15 + Math.random() * 0.45), 0.3, 1.25);
  const endEl = clamp(startEl - (0.18 + Math.random() * 0.14), 0.22, 1.2);
  const startAz = azimuth + (Math.random() - 0.5) * 0.7;
  const endAz = startAz + (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.16) / Math.max(Math.cos(startEl), 0.3);
  meteor.start.set(Math.cos(startEl) * Math.cos(startAz), Math.sin(startEl), Math.cos(startEl) * Math.sin(startAz));
  meteor.end.set(Math.cos(endEl) * Math.cos(endAz), Math.sin(endEl), Math.cos(endEl) * Math.sin(endAz));
  meteor.duration = 2.1 + Math.random() * 0.7;
  meteor.progress = 0;
  meteor.active = true;
  meteor.wished = false;
  meteor.caught = false;
}

function clickable() {
  return meteor.active && !meteor.wished && meteor.progress > 0.04;
}

/** Zone cliquable : seulement pendant le passage d'une étoile filante. */
function meteorRaycast(this: Mesh, raycaster: Raycaster, intersects: Intersection[]) {
  if (!clickable()) return;
  Mesh.prototype.raycast.call(this, raycaster, intersects);
}

function wish() {
  if (!clickable()) return;
  meteor.wished = true;
  meteor.caught = true;
  meteor.progress = Math.max(meteor.progress, 0.72);
  meteorUniforms.uBurst.value = 1;
  skyLayerUniforms.uWish.value = 1;
  ambience.chime([1175, 1568, 1976, 2349], 0.085);
}

function setCursor(on: boolean) {
  if (meteor.hovered === on) return;
  meteor.hovered = on;
  document.body.style.cursor = on ? 'pointer' : '';
}

export function ShootingStars() {
  const skyMesh = useRef<Mesh>(null);
  const seaMesh = useRef<Mesh>(null);
  const skyHit = useRef<Mesh>(null);
  const seaHit = useRef<Mesh>(null);
  const resources = useMemo(() => {
    // Traînée (x = queue → tête, y = côté) puis tête (coins ±1) ; position.z = nature.
    const corners = [0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0, -1, -1, 1, 1, -1, 1, -1, 1, 1, 1, 1, 1];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(corners), 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
    const make = (pass: { value: number }) =>
      new ShaderMaterial({
        uniforms: { ...skyLayerUniforms, ...meteorUniforms, uPass: pass },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      });
    return {
      geometry,
      sky: make(skyPass),
      sea: make(seaPass),
      hitGeometry: new SphereGeometry(1, 10, 8),
      hitMaterial: new MeshBasicMaterial({ visible: false }),
    };
  }, []);
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.sky.dispose();
    resources.sea.dispose();
    resources.hitGeometry.dispose();
    resources.hitMaterial.dispose();
    if (meteor.hovered) setCursor(false);
  }, [resources]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { reveal, reducedMotion } = useWorld.getState();
    const night = skyState.dayNight > 0.72 && reveal > 0.95 && ecologyState.stormCover < 0.15;

    if (!meteor.active) {
      if (night && (!reducedMotion || hold)) meteor.wait -= dt;
      if (meteor.wait <= 0) spawn(state.camera);
    }
    if (meteor.active) {
      if (!(hold && !meteor.wished)) meteor.progress += dt / meteor.duration;
      else meteor.progress = 0.55;
      if (meteor.progress >= 1 || !night) {
        meteor.active = false;
        meteor.wait = hold ? 1.5 : 22 + Math.random() * 34;
      }
    }

    const u = meteorUniforms;
    if (meteor.active) {
      const p = meteor.progress;
      if (!meteor.caught) {
        const eased = 1 - (1 - p) * (1 - p);
        u.uHead.value.copy(meteor.start).lerp(meteor.end, eased).normalize();
        u.uTail.value.copy(meteor.start).lerp(meteor.end, Math.max(0, eased - 0.3 * (1 - p * 0.4))).normalize();
      } else {
        // Attrapée : la tête s'arrête là où on l'a touchée, la traînée s'y résorbe.
        u.uTail.value.lerp(u.uHead.value, 1 - Math.exp(-dt * 10)).normalize();
      }
      u.uMeteor.value = smoothstep(0, 0.1, p) * (1 - smoothstep(0.72, 1, p));
    } else {
      u.uMeteor.value = 0;
    }
    u.uBurst.value = Math.max(0, u.uBurst.value - dt / 1.5);

    const drawn = u.uMeteor.value + u.uBurst.value > 0.001;
    if (skyMesh.current) skyMesh.current.visible = drawn;
    if (seaMesh.current) seaMesh.current.visible = drawn;

    // Zones cliquables sur la tête, dans le ciel et dans son reflet (~60 px de rayon).
    const camera = state.camera;
    if (seaHit.current) {
      skyPlaceCPU(u.uHead.value, 1, camera, seaHit.current.position);
      seaHit.current.scale.setScalar(Math.max(seaHit.current.position.distanceTo(camera.position), 1) * 0.06);
    }
    if (skyHit.current) {
      skyPlaceCPU(u.uHead.value, 0, camera, skyHit.current.position);
      skyHit.current.scale.setScalar(SKY_RADIUS * 0.06);
    }
    if (meteor.hovered && !clickable()) setCursor(false);
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (!clickable()) return;
    event.stopPropagation();
    wish();
    setCursor(false);
  };
  const onOver = (event: ThreeEvent<PointerEvent>) => {
    if (!clickable()) return;
    event.stopPropagation();
    setCursor(true);
  };
  const onOut = () => setCursor(false);

  return (
    <>
      <mesh ref={skyMesh} geometry={resources.geometry} material={resources.sky} frustumCulled={false} renderOrder={1} raycast={() => null} />
      <mesh ref={seaMesh} geometry={resources.geometry} material={resources.sea} frustumCulled={false} renderOrder={4} raycast={() => null} />
      <mesh
        ref={skyHit}
        geometry={resources.hitGeometry}
        material={resources.hitMaterial}
        raycast={meteorRaycast}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
      <mesh
        ref={seaHit}
        geometry={resources.hitGeometry}
        material={resources.hitMaterial}
        raycast={meteorRaycast}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
    </>
  );
}
