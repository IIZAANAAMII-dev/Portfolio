'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { ambience } from '@/lib/audio/ambience';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { Hotspot } from '../../kit';
import type { HeightSampler } from '../../terrain-shape';
import { LIGHTHOUSE, polar } from './layout';
import { villageMaterials } from './materials';
import { Mesher, meterCylinder, pebble, pose, type Vec3 } from './mesher';

/**
 * Le grand phare, sur son rocher de granit au bout de la pointe — à la manière des phares
 * en mer du Morbihan : soubassement de granit, tour blanche dont le haut est peint en
 * rouge, encorbellement de consoles sous la galerie, garde-corps noir, lanterne vitrée
 * et coupole rouge. La nuit, deux faisceaux opposés balaient lentement la mer ; quand l'un
 * d'eux passe face à la caméra, la lanterne éclate. Un clic : il tourne à toute vitesse.
 */

const WHITE = '#f4f0e7';
const RED = '#c8382f';
const BLACK = '#24262b';
const GRANITE = '#d6cec1';

/** Hauteurs (repère du phare : 0 = dessus du soubassement). */
const TOWER = { bottom: 0.45, top: 7.6, radiusBottom: 0.98, radiusTop: 0.7, redFrom: 6.25 };
const GALLERY = 8.0;
const LANTERN = { bottom: 8.45, top: 9.55, radius: 0.58 };
export const LIGHTHOUSE_LAMP_Y = (LANTERN.bottom + LANTERN.top) / 2;

function buildTower() {
  const masonry = new Mesher(false, true);
  const paint = new Mesher(true, false);
  // Soubassement de granit à pans (octogone), fondations plongées dans le rocher.
  masonry.add(meterCylinder(1.5, 1.72, 1.9, 8), pose([0, -0.5, 0], [0, Math.PI / 8, 0]));
  paint.add(new CylinderGeometry(1.58, 1.58, 0.1, 8), pose([0, TOWER.bottom - 0.03, 0], [0, Math.PI / 8, 0]), GRANITE);
  // Fût blanc puis tête rouge, légèrement conique.
  const span = TOWER.top - TOWER.bottom;
  const radiusAt = (y: number) => TOWER.radiusBottom + (TOWER.radiusTop - TOWER.radiusBottom) * ((y - TOWER.bottom) / span);
  const white = TOWER.redFrom - TOWER.bottom;
  paint.add(new CylinderGeometry(radiusAt(TOWER.redFrom), TOWER.radiusBottom, white, 20), pose([0, TOWER.bottom + white / 2, 0]), WHITE);
  const red = TOWER.top - TOWER.redFrom;
  paint.add(new CylinderGeometry(TOWER.radiusTop, radiusAt(TOWER.redFrom), red, 20), pose([0, TOWER.redFrom + red / 2, 0]), RED);
  // Encorbellement : une corniche évasée et ses consoles de granit.
  paint.add(new CylinderGeometry(1.0, TOWER.radiusTop, 0.4, 20), pose([0, TOWER.top + 0.2, 0]), GRANITE);
  for (let index = 0; index < 14; index++) {
    const angle = (index / 14) * Math.PI * 2;
    const r = TOWER.radiusTop + 0.1;
    paint.box([0.16, 0.42, 0.26], [Math.cos(angle) * r, TOWER.top - 0.12, Math.sin(angle) * r], [0, -angle, 0], GRANITE);
  }
  // Galerie et garde-corps.
  paint.add(new CylinderGeometry(1.12, 1.06, 0.12, 20), pose([0, GALLERY + 0.0, 0]), '#5a5d66');
  const posts = 18;
  for (let index = 0; index < posts; index++) {
    const angle = (index / posts) * Math.PI * 2;
    paint.rod([Math.cos(angle) * 1.06, GALLERY, Math.sin(angle) * 1.06], [Math.cos(angle) * 1.06, GALLERY + 0.58, Math.sin(angle) * 1.06], 0.022, BLACK, 4);
  }
  for (const y of [0.3, 0.58]) {
    const rail = new TorusGeometry(1.06, y > 0.5 ? 0.035 : 0.02, 4, 28);
    rail.rotateX(Math.PI / 2);
    paint.add(rail, pose([0, GALLERY + y, 0]), BLACK);
    rail.dispose();
  }
  // Chambre de veille (socle de la lanterne).
  paint.add(new CylinderGeometry(0.66, 0.7, 0.4, 16), pose([0, GALLERY + 0.25, 0]), RED);
  // Montants de la lanterne et ceinture haute.
  const bars = 10;
  for (let index = 0; index < bars; index++) {
    const angle = (index / bars) * Math.PI * 2;
    paint.rod(
      [Math.cos(angle) * (LANTERN.radius + 0.02), LANTERN.bottom, Math.sin(angle) * (LANTERN.radius + 0.02)],
      [Math.cos(angle) * (LANTERN.radius + 0.02), LANTERN.top, Math.sin(angle) * (LANTERN.radius + 0.02)],
      0.028,
      BLACK,
      4,
    );
  }
  const ring = new TorusGeometry(LANTERN.radius + 0.03, 0.035, 4, 20);
  ring.rotateX(Math.PI / 2);
  paint.add(ring, pose([0, LANTERN.top, 0]), BLACK);
  paint.add(ring, pose([0, LANTERN.bottom + 0.02, 0]), BLACK);
  ring.dispose();
  // Coupole rouge, boule de ventilation, paratonnerre et girouette.
  const dome = new SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  paint.add(dome, pose([0, LANTERN.top, 0], [0, 0, 0], [1, 0.72, 1]), RED);
  dome.dispose();
  paint.add(new SphereGeometry(0.13, 10, 8), pose([0, LANTERN.top + 0.6, 0]), BLACK);
  paint.rod([0, LANTERN.top + 0.6, 0], [0, LANTERN.top + 1.35, 0], 0.018, BLACK, 4);
  paint.box([0.42, 0.1, 0.02], [0.1, LANTERN.top + 1.12, 0], [0, 0.6, 0], BLACK);
  // Porte et petites fenêtres qui montent en spirale (l'escalier intérieur).
  paint.box([0.7, 1.35, 0.2], [0, TOWER.bottom + 0.68, TOWER.radiusBottom - 0.04], [0, 0, 0], '#2f5f4f');
  paint.box([0.9, 0.18, 0.24], [0, TOWER.bottom + 1.42, TOWER.radiusBottom - 0.02], [0, 0, 0], GRANITE);
  for (let index = 0; index < 4; index++) {
    const y = 2.0 + index * 1.2;
    const angle = Math.PI / 2 - 0.9 + index * 1.15;
    const r = TOWER.radiusBottom + (TOWER.radiusTop - TOWER.radiusBottom) * ((y - TOWER.bottom) / span) - 0.02;
    paint.box([0.22, 0.42, 0.1], [Math.cos(angle) * r, y, Math.sin(angle) * r], [0, Math.PI / 2 - angle, 0], '#2a3443');
  }
  return { masonry: masonry.build(), paint: paint.build() };
}

/** Rocher de granit : gros blocs arrondis empilés, dont certains baignent dans l'eau. */
function buildOutcrop(sampler: HeightSampler, center: [number, number], base: number) {
  const rocks = new Mesher(true, false);
  const tone = new Color();
  const blocks: [number, number, number, number][] = [
    [1.9, 0.2, 1.5, 0.15],
    [2.2, 1.1, 1.25, -0.25],
    [1.7, 2.1, 1.05, 0.05],
    [2.4, -0.9, 1.35, -0.45],
    [1.6, -1.9, 1.1, 0.0],
    [2.9, 0.6, 0.9, -0.95],
    [3.0, -0.2, 0.75, -1.2],
    [1.5, 3.0, 0.8, 0.2],
    [1.4, -2.8, 0.85, 0.25],
  ];
  const outward = Math.atan2(center[1], center[0]);
  blocks.forEach(([distance, angleOffset, size, lift], index) => {
    const angle = outward + angleOffset;
    const x = center[0] + Math.cos(angle) * distance * 0.9;
    const z = center[1] + Math.sin(angle) * distance * 0.9;
    const ground = Math.min(sampler(x, z), base);
    const rock = pebble(index * 5.1 + 2.2, 1, 0.66);
    tone.set('#b8aaa0').multiplyScalar(0.82 + hash(index * 7.3) * 0.28);
    rocks.add(rock, pose([x, Math.max(ground, -0.6) + size * 0.3 + lift * 0.4, z], [hash(index) * 0.4, index * 1.9, hash(index * 3) * 0.3], [size * 1.25, size, size * 1.1]), tone);
    rock.dispose();
  });
  // Dalles du sentier sur la pointe, du plateau au phare.
  const slab = new CylinderGeometry(1, 1.06, 1, 7);
  for (let index = 0; index < 9; index++) {
    const along = LIGHTHOUSE.spurFrom + 0.4 + index * 0.52;
    const [x, z] = polar(LIGHTHOUSE.angle + (hash(index * 2.7) - 0.5) * 0.03, along);
    const size = 0.24 + hash(index * 4.1) * 0.08;
    tone.set('#cfc6b6').multiplyScalar(0.92 + hash(index * 1.3) * 0.12);
    rocks.add(slab, pose([x, sampler(x, z) + 0.02, z], [0, index, 0], [size, 0.1, size * 0.85]), tone);
  }
  slab.dispose();
  return rocks.build();
}

/* --------------------------------------------------------------- faisceaux */

const beamVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormalView;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

const beamFragment = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormalView;
void main() {
  // Cône ouvert : uv.y = 1 côté lanterne. Bords du cône adoucis (vus de biais).
  float along = pow(vUv.y, 1.8);
  float facing = abs(dot(normalize(vNormalView), normalize(vView)));
  float soft = smoothstep(0.05, 0.6, facing);
  float alpha = along * soft * 0.32 * uStrength;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.68) * alpha, alpha);
  #include <colorspace_fragment>
}
`;

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 246, 220, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 220, 150, 0.75)');
  gradient.addColorStop(0.5, 'rgba(255, 190, 110, 0.18)');
  gradient.addColorStop(1, 'rgba(255, 180, 100, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const BEAM_LENGTH = 22;
const toCamera = new Vector3();
const lampWorld = new Vector3();
const beamAxis = new Vector3();
const beamTurn = new Quaternion();

export function Lighthouse({ sampler }: { sampler: HeightSampler }) {
  const center = useMemo(() => polar(LIGHTHOUSE.angle, LIGHTHOUSE.radius), []);
  const base = useMemo(() => Math.min(sampler(center[0], center[1]), LIGHTHOUSE.spurY), [center, sampler]);
  const tower = useMemo(() => buildTower(), []);
  const outcrop = useMemo(() => buildOutcrop(sampler, center, base), [base, center, sampler]);
  const materials = villageMaterials();
  const beam = useRef<Group>(null);
  const halo = useRef<Mesh>(null);
  const spinUntil = useRef(-10);
  const clock = useThree((state) => state.clock);
  const lamp = useRef<MeshStandardMaterial>(null);
  const beamMaterial = useRef<ShaderMaterial>(null);
  const haloMaterial = useRef<MeshBasicMaterial>(null);
  const beamUniforms = useMemo(() => ({ uStrength: { value: 0 } }), []);
  const haloMap = useMemo(() => haloTexture(), []);
  useEffect(() => () => {
    tower.masonry?.dispose();
    tower.paint?.dispose();
    outcrop?.dispose();
    haloMap.dispose();
  }, [haloMap, outcrop, tower]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const night = skyState.dayNight;
    const spinning = Math.max(0, Math.min(1, (spinUntil.current - time) / 1.5));
    const strength = Math.max(night, spinning * 0.85);
    const group = beam.current;
    if (group) {
      group.rotation.y += dt * (0.42 + spinning * 3.4);
      group.visible = strength > 0.03;
    }
    if (beamMaterial.current) beamMaterial.current.uniforms.uStrength.value = strength;
    // Éclat : un des deux faisceaux passe dans l'axe de la caméra.
    let flash = 0;
    const glow = halo.current;
    if (group && glow && haloMaterial.current) {
      glow.getWorldPosition(lampWorld);
      toCamera.subVectors(state.camera.position, lampWorld).setY(0).normalize();
      beamAxis.set(1, 0, 0).applyQuaternion(group.getWorldQuaternion(beamTurn)).setY(0).normalize();
      flash = Math.pow(Math.abs(beamAxis.dot(toCamera)), 18) * strength;
      glow.quaternion.copy(state.camera.quaternion);
      glow.scale.setScalar(2.2 + flash * 4.5);
      haloMaterial.current.opacity = Math.min(1, strength * 0.55 + flash * 0.9);
      glow.visible = haloMaterial.current.opacity > 0.01;
    }
    if (lamp.current) lamp.current.emissiveIntensity = 0.45 + strength * 2.6 + flash * 3 + Math.sin(time * 2.1) * 0.08;
  });

  return (
    <group>
      {outcrop && <mesh geometry={outcrop} material={materials.rock} castShadow receiveShadow />}
      <group position={[center[0], base, center[1]]}>
        <Hotspot
          hoverScale={1.02}
          onActivate={() => {
            // Le gardien fait tourner le feu : quelques secondes de balayage rapide.
            spinUntil.current = clock.elapsedTime + 4.5;
            ambience.chime([392, 523, 659, 784], 0.11);
          }}
        >
          {tower.masonry && <mesh geometry={tower.masonry} material={materials.granite} castShadow receiveShadow />}
          {tower.paint && <mesh geometry={tower.paint} material={materials.paint} castShadow receiveShadow />}
          <mesh position-y={LIGHTHOUSE_LAMP_Y}>
            <cylinderGeometry args={[LANTERN.radius, LANTERN.radius, LANTERN.top - LANTERN.bottom, 10]} />
            <meshStandardMaterial ref={lamp} color="#fff4d6" emissive="#ffc66e" emissiveIntensity={0.45} roughness={0.15} metalness={0.1} />
          </mesh>
        </Hotspot>
        <group ref={beam} position-y={LIGHTHOUSE_LAMP_Y}>
          {[0, Math.PI].map((angle) => (
            <mesh key={angle} rotation={[0, angle, Math.PI / 2]} position={[Math.cos(angle) * BEAM_LENGTH * 0.5, 0, -Math.sin(angle) * BEAM_LENGTH * 0.5]} raycast={() => null}>
              <coneGeometry args={[2.3, BEAM_LENGTH, 20, 1, true]} />
              <shaderMaterial
                ref={angle === 0 ? beamMaterial : undefined}
                uniforms={beamUniforms}
                vertexShader={beamVertex}
                fragmentShader={beamFragment}
                transparent
                depthWrite={false}
                blending={AdditiveBlending}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
        <mesh ref={halo} position-y={LIGHTHOUSE_LAMP_Y} raycast={() => null} renderOrder={10} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={haloMaterial} map={haloMap} transparent depthWrite={false} blending={AdditiveBlending} opacity={0} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Le haut du phare, perchoir d'un goéland (repère de l'île). */
export function lighthousePerch(sampler: HeightSampler): Vec3 {
  const [x, z] = polar(LIGHTHOUSE.angle, LIGHTHOUSE.radius);
  const base = Math.min(sampler(x, z), LIGHTHOUSE.spurY);
  const angle = Math.atan2(-z, -x) + 0.6;
  return [x + Math.cos(angle) * 1.06, base + GALLERY + 0.62, z + Math.sin(angle) * 1.06];
}
