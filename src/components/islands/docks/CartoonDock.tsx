'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three';
import { skyState } from '@/lib/sky';
import { hash } from '@/lib/utils/math';
import { bevelBox, glowTexture, Pieces, pose } from './parts';

/**
 * Ponton « dessin animé » : planches peintes de largeurs inégales (miel, ambre, une planche
 * grisée par le sel, une autre toute neuve), jours sombres entre elles, pieux trapus cerclés
 * de cordage avec leur ligne d'algues et de balanes, bollard en fonte, bouée rouge et
 * blanche, échelle de bain et lanterne au bout, qui s'allume à la nuit.
 *
 * Même convention que l'ancien `Dock` : le groupe est tourné de `-angle`, le plancher
 * court le long de +X de `reach × 0,74` jusqu'à `end`, son dessus à 0,78 m de l'eau.
 * Coût : 4 draw calls (bois fusionné, vitre, flaque de lumière, halo — les deux derniers
 * seulement la nuit).
 */

const DECK = 0.78;
const HALF = 1.0;
const THICK = 0.1;

const WOODS = ['#c98d55', '#b97a48', '#d49f66', '#bf8450', '#ad7145'].map((hex) => new Color(hex));
const WEATHERED = new Color('#b9a88e');
const FRESH = new Color('#e3b57c');
const POST = new Color('#7a4e33');
const POST_TOP = new Color('#95633f');
const WET = new Color('#4a392b');
const ALGAE = new Color('#3f6d4e');
const ROPE = '#e4c88f';
const IRON = '#36444e';
const BEAM = '#5f3d29';

/** Position de la lanterne, dans le repère du ponton. */
function lanternSpot(end: number): [number, number, number] {
  return [end - 0.17, DECK + 1.62, -(HALF + 0.07)];
}

function dockGeometry(start: number, end: number) {
  const seed = start * 3.17 + end * 1.31;
  const r = (k: number) => hash(seed + k * 12.9898);
  const span = end - start;
  const mid = (start + end) / 2;
  const wood = new Pieces();

  // Fond sombre sous le plancher : les jours entre les planches restent bien noirs.
  wood.add(new BoxGeometry(span + 0.04, 0.02, HALF * 2 - 0.12), '#2a1d15', pose([mid, DECK - THICK - 0.04, 0]));

  // Lambourdes : deux longues poutres sous les planches.
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(span + 0.1, 0.13, 0.15), BEAM, pose([mid, DECK - THICK - 0.065, side * (HALF - 0.3)]), 0.18);
  }

  // Planches : largeurs inégales, légers défauts d'alignement, bouts plus foncés.
  let x = start;
  let index = 0;
  while (x < end - 0.1) {
    let width = 0.24 + r(index) * 0.14;
    if (end - (x + width) < 0.18) width = end - x;
    const pick = r(index + 0.41);
    const base = index % 11 === 6 ? WEATHERED : index % 13 === 9 ? FRESH : WOODS[Math.floor(pick * WOODS.length)];
    const tone = 0.93 + r(index + 0.77) * 0.12;
    const color = base.clone().multiplyScalar(tone);
    const length = HALF * 2 + (r(index + 0.3) - 0.5) * 0.22;
    const lift = (r(index + 0.63) - 0.5) * 0.022;
    const matrix = pose(
      [x + width / 2, DECK - THICK / 2 + lift, (r(index + 0.52) - 0.5) * 0.09],
      [(r(index + 0.91) - 0.5) * 0.02, (r(index + 0.13) - 0.5) * 0.035, (r(index + 0.27) - 0.5) * 0.02],
    );
    wood.add(bevelBox(width - 0.045, THICK, length, 0.022), (_x, _y, z, _ny, out) => {
      // Les bouts, plus exposés aux embruns, foncent un peu.
      out.copy(color).multiplyScalar(1 - Math.max(0, Math.abs(z) - HALF * 0.55) * 0.32);
    }, matrix, 0.2);
    // Têtes de clous au-dessus des lambourdes.
    for (const side of [-1, 1]) {
      for (const dx of [-0.25, 0.25]) {
        const nail = pose([dx * (width - 0.06), THICK / 2 + 0.004, side * (HALF - 0.3)]);
        wood.add(new BoxGeometry(0.035, 0.012, 0.035), '#3a3330', matrix.clone().multiply(nail));
      }
    }
    x += width;
    index += 1;
  }

  // Pieux par paires, traverses et croix de Saint-André.
  const bents = Math.max(2, Math.round(span / 1.75) + 1);
  const postXs: number[] = [];
  for (let bent = 0; bent < bents; bent++) {
    const px = start + 0.5 + (bent / (bents - 1)) * (span - 0.68);
    postXs.push(px);
    for (const side of [-1, 1]) {
      const k = bent * 2 + (side > 0 ? 1 : 0);
      const radius = 0.15 + r(k + 5.1) * 0.045;
      const top = DECK + 0.2 + r(k + 5.7) * 0.32;
      const bottom = -1.95;
      const pz = side * (HALF + 0.03);
      const tilt: [number, number, number] = [(r(k + 6.3) - 0.5) * 0.07, r(k + 6.9) * Math.PI, (r(k + 7.5) - 0.5) * 0.07];
      const shaft = pose([px, (top + bottom) / 2, pz], tilt);
      wood.add(new CylinderGeometry(radius * 0.93, radius, top - bottom, 7, 4), (_x, y, _z, _ny, out) => {
        // Algues sous l'eau, bois mouillé à la ligne de flottaison, bois clair au-dessus.
        if (y < -0.32) out.copy(ALGAE);
        else if (y < 0.16) out.copy(WET);
        else out.copy(POST).multiplyScalar(0.95 + Math.min(1, (y - 0.16) * 0.6) * 0.12);
      }, shaft);
      // Tête arrondie.
      const cap = pose([0, (top - bottom) / 2, 0]);
      wood.add(new SphereGeometry(radius * 0.97, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), POST_TOP, shaft.clone().multiply(cap));
      // Cordage enroulé sur un pieu sur deux (environ).
      if (r(k + 8.2) > 0.4) {
        for (const drop of [0.2, 0.3]) {
          const coil = pose([0, (top - bottom) / 2 - drop, 0], [Math.PI / 2, 0, 0]);
          wood.add(new TorusGeometry(radius + 0.018, 0.034, 4, 10), ROPE, shaft.clone().multiply(coil));
        }
      }
      // Balanes à la ligne de flottaison.
      for (let barnacle = 0; barnacle < 3; barnacle++) {
        const around = r(k + 9 + barnacle) * Math.PI * 2;
        const height = -0.15 + r(k + 9.5 + barnacle) * 0.32 - (top + bottom) / 2;
        const spot = pose([Math.cos(around) * radius, height, Math.sin(around) * radius], [0, 0, 0], 0.045 + r(k + barnacle) * 0.03);
        wood.add(new IcosahedronGeometry(1, 0), '#ece6d6', shaft.clone().multiply(spot));
      }
    }
    // Traverse sous les lambourdes.
    wood.add(new BoxGeometry(0.17, 0.13, HALF * 2 + 0.36), BEAM, pose([px, DECK - THICK - 0.2, 0]), 0.18);
    // Contreventement en diagonale (alterné).
    const dir = bent % 2 === 0 ? 1 : -1;
    const dz = HALF * 2;
    const dy = 0.95;
    wood.add(
      new BoxGeometry(0.06, 0.1, Math.hypot(dz, dy)),
      '#6a442d',
      pose([px + 0.12, DECK - THICK - 0.75, 0], [Math.atan2(dy, dz) * dir, 0, 0]),
      0.15,
    );
  }

  // Bouée de sauvetage accrochée à un pieu du milieu, côté large.
  const buoyPost = postXs[Math.min(postXs.length - 1, Math.max(0, Math.floor(postXs.length / 2)))];
  const buoyCenter: [number, number, number] = [buoyPost - 0.02, DECK + 0.02, HALF + 0.32];
  wood.add(new TorusGeometry(0.3, 0.085, 6, 16), (bx, by, _z, _ny, out) => {
    const turn = Math.atan2(by - buoyCenter[1], bx - buoyCenter[0]) + Math.PI;
    out.set(Math.floor(turn / (Math.PI / 4)) % 2 === 0 ? '#e0533d' : '#f5efe3');
  }, pose(buoyCenter, [0.12, 0, 0.18]));
  // Sa cordelette, de la tête du pieu à la bouée.
  wood.add(new CylinderGeometry(0.014, 0.014, 0.36, 4), ROPE, pose([buoyPost, DECK + 0.38, HALF + 0.3], [0.5, 0, 0]));

  // Bollard en fonte, avec sa boucle d'amarre, et un rouleau de cordage sur le plancher.
  const bx = end - 0.85;
  const bz = HALF - 0.32;
  wood.add(new CylinderGeometry(0.13, 0.15, 0.27, 10), IRON, pose([bx, DECK + 0.135, bz]), 0.15);
  wood.add(new CylinderGeometry(0.2, 0.17, 0.07, 10), IRON, pose([bx, DECK + 0.3, bz]), 0.15);
  wood.add(new SphereGeometry(0.12, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2), '#4b5a64', pose([bx, DECK + 0.335, bz]));
  wood.add(new TorusGeometry(0.165, 0.036, 5, 14), ROPE, pose([bx, DECK + 0.17, bz], [Math.PI / 2, 0, 0.12]));
  wood.add(new TorusGeometry(0.21, 0.045, 5, 16), ROPE, pose([bx - 0.62, DECK + 0.045, bz - 0.06], [Math.PI / 2, 0, 0]));
  wood.add(new TorusGeometry(0.12, 0.045, 5, 12), ROPE, pose([bx - 0.62, DECK + 0.1, bz - 0.06], [Math.PI / 2, 0, 0]));

  // Échelle de bain au bout du ponton.
  for (const side of [-1, 1]) {
    wood.add(new BoxGeometry(0.06, 2.05, 0.06), '#6b4a33', pose([end + 0.07, DECK + 0.35 - 1.02, side * 0.27]), 0.12);
  }
  for (let rung = 0; rung < 5; rung++) {
    wood.add(new BoxGeometry(0.05, 0.04, 0.54), '#7c5639', pose([end + 0.07, DECK - 0.22 - rung * 0.3, 0]), 0.12);
  }

  // Poteau de la lanterne (bois carré), lanterne en fer et petit toit rouge.
  const [lx, ly, lz] = lanternSpot(end);
  const postHeight = ly - 0.17 - (DECK - 0.45);
  wood.add(bevelBox(0.15, postHeight, 0.15, 0.02), '#5d3c28', pose([lx, DECK - 0.45 + postHeight / 2, lz]), 0.18);
  wood.add(new BoxGeometry(0.34, 0.05, 0.34), IRON, pose([lx, ly - 0.17, lz]), 0.1);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      wood.add(new BoxGeometry(0.035, 0.34, 0.035), IRON, pose([lx + cx * 0.135, ly, lz + cz * 0.135]));
    }
  }
  wood.add(new BoxGeometry(0.34, 0.04, 0.34), IRON, pose([lx, ly + 0.18, lz]));
  wood.add(new ConeGeometry(0.29, 0.24, 4), '#c8553d', pose([lx, ly + 0.32, lz], [0, Math.PI / 4, 0]), 0.12);
  wood.add(new TorusGeometry(0.045, 0.014, 4, 8), IRON, pose([lx, ly + 0.47, lz]));

  return wood.build()!;
}

/* Matériaux partagés par tous les pontons (mis à jour une fois par image). */
const WOOD = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
const GLASS = new MeshStandardMaterial({ color: '#ffe7b3', emissive: '#ffb85c', emissiveIntensity: 0.3, roughness: 0.25 });
const GLASS_GEOMETRY = new BoxGeometry(0.24, 0.31, 0.24);
const POOL_GEOMETRY = new CircleGeometry(1.75, 28).rotateX(-Math.PI / 2);
const POOL = new ShaderMaterial({
  uniforms: { uStrength: { value: 0 }, uColor: { value: new Color('#ffb062') } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uStrength;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      // Flaque de lumière chaude au pied de la lanterne, qui s'éteint en douceur.
      float d = length(vUv - 0.5) * 2.0;
      float a = 1.0 - smoothstep(0.0, 1.0, d);
      gl_FragColor = vec4(uColor, a * a * uStrength);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
});
let halo: SpriteMaterial | null = null;
function haloMaterial() {
  halo ??= new SpriteMaterial({
    map: glowTexture(),
    color: '#ffc27a',
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0,
  });
  return halo;
}

let lastFrame = -1;

export function CartoonDock({ angle, reach, end = reach + 0.9 }: { angle: number; reach: number; end?: number }) {
  const start = reach * 0.74;
  const geometry = useMemo(() => dockGeometry(start, end), [start, end]);
  const haloShared = useMemo(() => haloMaterial(), []);
  const pool = useRef<Mesh>(null);
  const glow = useRef<Sprite>(null);
  const [lx, ly, lz] = lanternSpot(end);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const night = skyState.dayNight;
    // Matériaux partagés : un seul ponton les met à jour par image.
    if (lastFrame !== state.clock.elapsedTime) {
      lastFrame = state.clock.elapsedTime;
      const flicker = 1 + Math.sin(state.clock.elapsedTime * 7.3) * 0.03 + Math.sin(state.clock.elapsedTime * 13.1) * 0.02;
      GLASS.emissiveIntensity = (0.28 + night * 2.9) * flicker;
      POOL.uniforms.uStrength.value = night * 0.42 * flicker;
      if (halo) halo.opacity = night * 0.85 * flicker;
    }
    const lit = night > 0.04;
    if (pool.current) pool.current.visible = lit;
    if (glow.current) glow.current.visible = lit;
  });

  return (
    <group rotation-y={-angle}>
      <mesh geometry={geometry} material={WOOD} castShadow receiveShadow />
      <mesh geometry={GLASS_GEOMETRY} material={GLASS} position={[lx, ly + 0.005, lz]} raycast={() => null} />
      <mesh
        ref={pool}
        geometry={POOL_GEOMETRY}
        material={POOL}
        position={[lx - 0.55, DECK + 0.03, lz + 0.7]}
        visible={false}
        renderOrder={4}
        raycast={() => null}
      />
      <sprite ref={glow} material={haloShared} position={[lx, ly, lz]} scale={1.5} visible={false} raycast={() => null} />
    </group>
  );
}
