'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { Hotspot } from '@/components/islands/kit';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { logbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { damp, hash, smoothstep } from '@/lib/utils/math';
import { FestNozAudio } from './festnoz-audio';
import { DANCER_BOTTOMS, DANCER_TOPS, dancerGeometry, playerGeometry, type FestLayout } from './festnoz-build';
import { danceUniforms, dancerMaterial, fireLitMaterial, fireUniforms } from './festnoz-materials';

/**
 * Le fest-noz de l'îlot breton, la nuit : une ronde d'an-dro (petits doigts accrochés, bras
 * qui balancent, pas chassés vers la gauche) autour d'un feu de joie, deux sonneurs sur leur
 * estrade (bombarde et biniou), les halos des lampions. Les danseurs entrent dans la ronde
 * un à un au crépuscule et s'en vont à l'aube. Un clic sur la ronde : elle s'emballe quelques
 * secondes (tampon « Fest-noz »). Avec le son, l'air s'entend à l'approche du bateau.
 * Monté seulement la nuit (et chargé à part) : rien de tout cela n'existe de jour.
 */

const BPM = 124;
/** La ronde fait un tour en 40 s environ ; emballée, quatre fois plus vite. */
const RING_SPEED = 0.16;

const flameVertex = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aFlame;
uniform float uFire;
uniform float uTime;
varying vec2 vCorner;
varying float vPhase;
void main() {
  vCorner = aCorner;
  vPhase = aFlame.w;
  float height = aFlame.z * uFire * (0.86 + 0.14 * sin(uTime * 6.0 + aFlame.w * 5.0));
  vec3 base = position + vec3(aFlame.x, 0.0, aFlame.y);
  vec4 world = modelMatrix * vec4(base, 1.0);
  // Panneau tourné vers la caméra autour de la verticale.
  vec2 toCamera = normalize(cameraPosition.xz - world.xz + vec2(1e-4, 0.0));
  // (Sens choisi pour que le panneau présente sa face avant à la caméra.)
  vec3 right = vec3(toCamera.y, 0.0, -toCamera.x);
  world.xyz += right * aCorner.x * height * 0.36 + vec3(0.0, aCorner.y * height, 0.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const flameFragment = /* glsl */ `
uniform float uTime;
uniform float uFire;
varying vec2 vCorner;
varying float vPhase;
float flameHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float flameNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(flameHash(i), flameHash(i + vec2(1.0, 0.0)), f.x), mix(flameHash(i + vec2(0.0, 1.0)), flameHash(i + 1.0), f.x), f.y);
}
void main() {
  // Langue de feu de dessin animé : trois couches nettes (rouge, orange, cœur jaune pâle).
  float y = vCorner.y;
  float wobble = sin(y * 5.0 - uTime * 7.5 + vPhase * 3.0) * 0.16 * y;
  float width = (1.0 - y) * (0.55 + 0.45 * sqrt(max(1.0 - y, 0.0))) * smoothstep(0.0, 0.12, y + 0.06);
  float n = flameNoise(vec2(vCorner.x * 2.0 + vPhase, y * 3.0 - uTime * 3.2));
  float d = abs(vCorner.x + wobble) / max(width, 0.001) + (n - 0.5) * 0.45 * y;
  float body = 1.0 - smoothstep(0.9, 1.0, d);
  if (body < 0.01) discard;
  vec3 color = vec3(1.0, 0.36, 0.12);
  color = mix(color, vec3(1.0, 0.66, 0.2), smoothstep(0.7, 0.62, d));
  color = mix(color, vec3(1.0, 0.94, 0.66), smoothstep(0.4, 0.32, d + y * 0.25));
  gl_FragColor = vec4(color, body * uFire);
  #include <colorspace_fragment>
}
`;

const emberVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uFire;
varying float vLife;
void main() {
  float life = fract(uTime * (0.32 + aSeed * 0.25) + aSeed * 7.3);
  vLife = life;
  vec3 p = position;
  p.x += sin(aSeed * 40.0 + uTime * 1.3) * 0.22 * life;
  p.z += cos(aSeed * 23.0 + uTime * 1.1) * 0.22 * life;
  p.y += 0.25 + life * 1.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.0 - life) * uFire * 90.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const emberFragment = /* glsl */ `
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 color = mix(vec3(1.0, 0.86, 0.45), vec3(1.0, 0.35, 0.1), vLife);
  gl_FragColor = vec4(color, (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vLife));
  #include <colorspace_fragment>
}
`;

const poolVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const poolFragment = /* glsl */ `
uniform float uFire;
varying vec2 vLocal;
void main() {
  float r = length(vLocal) / 3.6;
  float glow = exp(-r * r * 2.4) * (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vec3(1.0, 0.6, 0.26), glow * uFire * 0.9);
  #include <colorspace_fragment>
}
`;

const haloVertex = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aTint;
attribute float aOn;
uniform float uNight;
uniform float uTime;
varying vec2 vUv;
varying vec3 vTint;
varying float vLit;
void main() {
  vUv = uv;
  vTint = aTint;
  vLit = smoothstep(aOn, aOn + 0.05, uNight) * (0.85 + 0.15 * sin(uTime * 5.3 + aOn * 97.0));
  vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
  mv.xy += position.xy * 1.15;
  gl_Position = projectionMatrix * mv;
}
`;

const haloFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
varying float vLit;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float glow = exp(-dot(p, p) * 4.5);
  if (glow * vLit < 0.01) discard;
  gl_FragColor = vec4(mix(vTint, vec3(1.0, 0.92, 0.75), 0.45), glow * vLit * 0.85);
  #include <colorspace_fragment>
}
`;

/** Langues de feu : quelques panneaux (x, z, hauteur, phase), un seul maillage. */
function flameGeometry() {
  const tongues: [number, number, number, number][] = [
    [0, 0, 1.35, 0.1], [0.14, 0.08, 0.95, 1.7], [-0.13, 0.06, 0.88, 3.1], [0.04, -0.14, 1.0, 4.4],
    [-0.07, -0.03, 0.72, 5.6], [0.09, -0.04, 0.6, 2.4],
  ];
  const corners = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
  const position = new Float32Array(tongues.length * 12);
  const corner = new Float32Array(tongues.length * 8);
  const flame = new Float32Array(tongues.length * 16);
  const index: number[] = [];
  tongues.forEach((tongue, i) => {
    corners.forEach((c, k) => {
      corner.set(c, (i * 4 + k) * 2);
      flame.set(tongue, (i * 4 + k) * 4);
    });
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aCorner', new BufferAttribute(corner, 2));
  geometry.setAttribute('aFlame', new BufferAttribute(flame, 4));
  geometry.setIndex(index);
  return geometry;
}

function emberGeometry(count: number) {
  const geometry = new BufferGeometry();
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    position.set([(hash(i * 3.1) - 0.5) * 0.3, 0, (hash(i * 5.7) - 0.5) * 0.3], i * 3);
    seed[i] = hash(i * 9.3 + 1.1);
  }
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
  return geometry;
}

function haloGeometry(layout: FestLayout) {
  const plane = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('uv', plane.getAttribute('uv'));
  const count = layout.lampions.length;
  const offset = new Float32Array(count * 3);
  const tint = new Float32Array(count * 3);
  const on = new Float32Array(count);
  const color = new Color();
  layout.lampions.forEach((item, i) => {
    offset.set(item.at, i * 3);
    color.set(item.color).toArray(tint, i * 3);
    on[i] = item.on;
  });
  geometry.setAttribute('aOffset', new InstancedBufferAttribute(offset, 3));
  geometry.setAttribute('aTint', new InstancedBufferAttribute(tint, 3));
  geometry.setAttribute('aOn', new InstancedBufferAttribute(on, 1));
  geometry.instanceCount = count;
  return geometry;
}

/** Danseurs : géométrie instanciée et attributs propres à chacun (place, allure, couleurs). */
function dancersGeometry(count: number) {
  const geometry = dancerGeometry();
  const dancer = new Float32Array(count * 4);
  const top = new Float32Array(count * 3);
  const bottom = new Float32Array(count * 3);
  const color = new Color();
  for (let i = 0; i < count; i++) {
    // Place, graine, genre ; ils rejoignent la ronde l'un après l'autre (ordre mélangé).
    dancer.set([i, hash(i * 4.7 + 0.3), i % 2, 0.34 + (((i * 7) % count) / count) * 0.24], i * 4);
    color.set(DANCER_TOPS[i % DANCER_TOPS.length]).toArray(top, i * 3);
    color.set(DANCER_BOTTOMS[i % DANCER_BOTTOMS.length]).toArray(bottom, i * 3);
  }
  geometry.setAttribute('aDancer', new InstancedBufferAttribute(dancer, 4));
  geometry.setAttribute('aTop', new InstancedBufferAttribute(top, 3));
  geometry.setAttribute('aBottom', new InstancedBufferAttribute(bottom, 3));
  return geometry;
}

const PLAYER = fireLitMaterial('players');
const DANCER = dancerMaterial();
const fireWorld = new Vector3();
const identity = new Matrix4();

export default function FestNoz({ layout, isletX, isletZ }: { layout: FestLayout; isletX: number; isletZ: number }) {
  const quality = useWorld((state) => state.quality);
  const clock = useThree((state) => state.clock);
  const root = useRef<Group>(null);
  const dancers = useRef<InstancedMesh>(null);
  const players = useRef<(Group | null)[]>([]);
  const flames = useRef<Mesh>(null);
  const embers = useRef<Points>(null);
  const pool = useRef<Mesh>(null);
  const halos = useRef<Mesh>(null);
  const motion = useRef({ beat: 0, ring: 0, spinUntil: -10, fire: 0, audioClock: 0 });
  const audio = useRef<FestNozAudio | null>(null);
  const count = quality === 'low' ? 8 : 10;

  const geometries = useMemo(
    () => ({
      dancers: dancersGeometry(count),
      bombarde: playerGeometry('bombarde'),
      biniou: playerGeometry('biniou'),
      flames: flameGeometry(),
      embers: emberGeometry(18),
      pool: new CircleGeometry(3.6, 32).rotateX(-Math.PI / 2),
      halos: haloGeometry(layout),
    }),
    [count, layout],
  );
  const materials = useMemo(() => {
    const additive = (vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
    return {
      flames: additive(flameVertex, flameFragment, { uFire: { value: 0 }, uTime: { value: 0 } }),
      embers: additive(emberVertex, emberFragment, { uFire: { value: 0 }, uTime: { value: 0 } }),
      pool: additive(poolVertex, poolFragment, { uFire: { value: 0 } }),
      halos: additive(haloVertex, haloFragment, { uNight: { value: 0 }, uTime: { value: 0 } }),
    };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useEffect(() => {
    const mesh = dancers.current;
    if (!mesh) return;
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, identity);
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);

  useEffect(() => {
    const player = new FestNozAudio();
    audio.current = player;
    return () => {
      player.dispose();
      audio.current = null;
      fireUniforms.uFireGlow.value = 0;
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const { reducedMotion } = useWorld.getState();
    const m = motion.current;
    // Emballement après un clic : quatre secondes, retombée en douceur.
    const spinning = smoothstep(0, 1.2, m.spinUntil - time);
    const hurry = 1 + spinning * 0.55;
    if (!reducedMotion) {
      m.beat += dt * (BPM / 60) * hurry;
      m.ring += dt * RING_SPEED * (1 + spinning * 3);
    }
    m.fire = damp(m.fire, smoothstep(0.25, 0.45, night), 2.5, dt);
    const flicker = 0.82 + 0.1 * Math.sin(time * 11.3) + 0.08 * Math.sin(time * 17.9 + 1.3);

    danceUniforms.uBeat.value = m.beat;
    danceUniforms.uRing.value = m.ring;
    danceUniforms.uPresence.value = night;
    danceUniforms.uCenter.value.set(0, 0, 0);
    danceUniforms.uRadius.value = layout.radius;
    danceUniforms.uCount.value = count;
    danceUniforms.uMotion.value = reducedMotion ? 0 : 1;

    // Lueur du feu (repère vue) pour les danseurs, les sonneurs et le décor.
    const group = root.current;
    if (group) {
      fireWorld.set(layout.center[0], layout.center[1] + 0.45, layout.center[2]);
      group.localToWorld(fireWorld).applyMatrix4(state.camera.matrixWorldInverse);
      fireUniforms.uFireView.value.copy(fireWorld);
    }
    fireUniforms.uFireGlow.value = m.fire * flicker * 2.6;

    const fire = m.fire * (reducedMotion ? 1 : flicker);
    for (const mesh of [flames.current, embers.current, pool.current]) {
      const material = mesh?.material as ShaderMaterial | undefined;
      if (!material) continue;
      material.uniforms.uFire.value = fire;
      if (material.uniforms.uTime) material.uniforms.uTime.value = reducedMotion ? 0 : time;
    }
    if (flames.current) flames.current.visible = m.fire > 0.01;
    if (embers.current) embers.current.visible = m.fire > 0.01 && !reducedMotion;
    if (pool.current) pool.current.visible = m.fire > 0.01;
    const haloMaterial = halos.current?.material as ShaderMaterial | undefined;
    if (haloMaterial) {
      haloMaterial.uniforms.uNight.value = night;
      haloMaterial.uniforms.uTime.value = time;
    }

    // Sonneurs : ils entrent sur l'estrade les premiers, battent la mesure du corps.
    const presence = smoothstep(0.28, 0.4, night);
    players.current.forEach((player, index) => {
      if (!player) return;
      const beat = m.beat * Math.PI + index * 0.7;
      const pop = presence < 1 ? Math.min(1, presence * 1.15) : 1;
      player.visible = presence > 0.01;
      player.scale.setScalar(pop);
      const sway = reducedMotion ? 0 : 1;
      player.position.y = layout.players[index].at[1] + Math.abs(Math.sin(beat)) * 0.025 * sway;
      player.rotation.set(
        (index === 0 ? -0.08 - Math.sin(m.beat * 0.25 * Math.PI) * 0.06 : 0.03) * sway,
        layout.players[index].yaw + Math.sin(beat * 0.5) * 0.08 * sway,
        Math.sin(beat * 0.5) * 0.05 * sway,
      );
    });

    // Musique (son activé) : le bateau s'approche, l'air monte ; la ronde s'emballe, lui aussi.
    m.audioClock += dt;
    if (m.audioClock > 0.2 && audio.current) {
      m.audioClock = 0;
      const distance = Math.hypot(
        boatState.position.x - (isletX + layout.center[0]),
        boatState.position.z - (isletZ + layout.center[2]),
      );
      audio.current.hurry = hurry;
      audio.current.update((1 - smoothstep(12, 50, distance)) * presence);
    }
  });

  const spin = () => {
    motion.current.spinUntil = clock.elapsedTime + 4;
    ambience.chime([659, 784, 988, 1319], 0.08);
    logbook.stamp('festnoz');
  };

  const [cx, cy, cz] = layout.center;
  return (
    <group ref={root}>
      <Hotspot position={[cx, cy, cz]} hoverScale={1.04} onActivate={spin}>
        <instancedMesh
          ref={dancers}
          args={[geometries.dancers, DANCER, count]}
          frustumCulled={false}
          raycast={() => null}
        />
        {/* Volume de clic de la ronde (invisible). */}
        <mesh position-y={0.55} visible={false}>
          <cylinderGeometry args={[layout.radius + 0.45, layout.radius + 0.45, 1.1, 12]} />
        </mesh>
      </Hotspot>
      {layout.players.map((player, index) => (
        <group
          key={player.kind}
          ref={(element) => {
            players.current[index] = element;
          }}
          position={player.at}
          visible={false}
        >
          <mesh geometry={player.kind === 'bombarde' ? geometries.bombarde : geometries.biniou} material={PLAYER} raycast={() => null} />
        </group>
      ))}
      <mesh ref={flames} geometry={geometries.flames} material={materials.flames} position={[cx, cy + 0.04, cz]} renderOrder={8} frustumCulled={false} visible={false} raycast={() => null} />
      {quality !== 'low' && (
        <points ref={embers} geometry={geometries.embers} material={materials.embers} position={[cx, cy, cz]} renderOrder={8} frustumCulled={false} visible={false} raycast={() => null} />
      )}
      <mesh ref={pool} geometry={geometries.pool} material={materials.pool} position={[cx, cy + 0.06, cz]} renderOrder={4} visible={false} raycast={() => null} />
      {quality !== 'low' && (
        <mesh ref={halos} geometry={geometries.halos} material={materials.halos} renderOrder={9} frustumCulled={false} raycast={() => null} />
      )}
    </group>
  );
}
