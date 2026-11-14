'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { flicker } from './signal';
import { wallpaperTexture } from './textures';

/**
 * LA FAILLE — une déchirure verticale dans la façade, là où était la porte. Derrière :
 * un couloir des Backrooms (papier peint jaune, moquette humide, dalles de néons) qui
 * file loin dans la maison puis tourne à droite.
 *
 * Le couloir n'est pas une image : c'est un volume calculé dans le shader (« interior
 * mapping »). Pour chaque pixel de la déchirure, le rayon de la caméra entre dans des
 * boîtes (le couloir, le virage, une pièce latérale) et l'on peint la face touchée. La
 * parallaxe est donc exacte sous tous les angles, pour un seul draw call, sans rendu
 * supplémentaire ni texture d'écran (le pochoir n'existe pas dans le tampon du composer).
 *
 * Les bords de la déchirure vacillent : dents irrégulières, frange chromatique, bandes
 * qui glissent et blocs de parasites pendant les bouffées de « static ».
 */

const VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vCamLocal;
#include <fog_pars_vertex>
void main() {
  vLocal = position;
  vCamLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uLight;
uniform float uGlitch;
uniform float uFigure;
uniform float uMotion;
uniform float uNight;
uniform sampler2D uPaper;
varying vec3 vLocal;
varying vec3 vCamLocal;
#include <common>
#include <fog_pars_fragment>

// Déchirure : 2,5 m de haut. Couloir : largeur, hauteur sous plafond, longueur jusqu'au
// virage ; puis le couloir de droite (largeur, longueur) ; une pièce derrière une porte.
#define TEAR_H 2.5
#define CW 2.3
#define CH 2.65
#define CL 8.6
#define TW 2.0
#define TL 7.5

float rh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float rh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh2(i), rh2(i + vec2(1.0, 0.0)), f.x), mix(rh2(i + vec2(0.0, 1.0)), rh2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Axe de la déchirure : un éclair, segments brisés tous les 32 cm (droit au pied).
float tearAxis(float y) {
  float k = y / 0.32;
  float i = floor(k);
  float a = (rh(i + 3.0) - 0.5) * 0.24;
  float b = (rh(i + 4.0) - 0.5) * 0.24;
  return mix(a, b, fract(k)) * smoothstep(0.0, 0.5, y);
}

// Distance signée au bord (mètres, > 0 dedans), mesurée à l'horizontale.
float tearDist(vec2 p, float wobble) {
  if (p.y < -0.03) return -1.0;
  float h = clamp(p.y / TEAR_H, 0.0, 1.0);
  float body = max(0.0, 0.6 * (1.0 - pow(abs(h - 0.36) / 0.64, 2.0)));
  float axis = tearAxis(p.y);
  float row = p.y * 9.0 + wobble;
  float jl = (rh(floor(row) + 11.0) - 0.5) * 0.13 + (fract(row) - 0.5) * 0.06;
  float jr = (rh(floor(row) + 37.0) - 0.5) * 0.13 - (fract(row) - 0.5) * 0.06;
  float scale = 0.35 + 0.65 * body / 0.6;
  float left = axis - body - jl * scale;
  float right = axis + body + jr * scale;
  return min(p.x - left, right - p.x);
}

// Sortie d'une boîte depuis l'intérieur : distance, et normale (tournée vers le rayon).
float boxExit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out vec3 n) {
  vec3 t1 = (bmin - ro) / rd;
  vec3 t2 = (bmax - ro) / rd;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  if (t == tf.x) n = vec3(-sign(rd.x), 0.0, 0.0);
  else if (t == tf.y) n = vec3(0.0, -sign(rd.y), 0.0);
  else n = vec3(0.0, 0.0, -sign(rd.z));
  return max(t, 0.0);
}

vec3 paper(vec2 uv, float y) {
  vec3 c = texture2D(uPaper, uv / 0.8).rgb;
  // Plinthe brune, pied du mur sali, auréoles d'humidité qui montent du sol.
  c = mix(c, vec3(0.2, 0.15, 0.07), 1.0 - step(0.11, y));
  c *= 0.8 + 0.2 * smoothstep(0.0, 0.7, y);
  float damp = smoothstep(0.6, 0.78, vnoise(uv * vec2(1.4, 0.8) + 4.0)) * (1.0 - smoothstep(0.3, 1.5, y));
  c = mix(c, c * vec3(0.62, 0.54, 0.36), damp * 0.75);
  return c;
}

vec3 carpet(vec2 xz) {
  vec3 c = vec3(0.47, 0.4, 0.24);
  float n = vnoise(xz * 6.0) * 0.55 + vnoise(xz * 21.0) * 0.45;
  c *= 0.84 + n * 0.24;
  float stain = smoothstep(0.56, 0.74, vnoise(xz * 0.85 + 9.0));
  return mix(c, c * vec3(0.55, 0.5, 0.36), stain * 0.85);
}

// Une dalle de néon : quelques-unes vacillent, une est morte (le noir au fond).
float panel(float k, float region) {
  float id = k + region * 13.0;
  float dead = step(0.5, abs(id - 2.0)) ;
  float shaky = step(0.93, rh(id * 7.3 + floor(uTime * 3.0))) * uMotion;
  return dead * mix(1.0, 0.3, shaky);
}

// Lumière reçue en un point : dalle la plus proche le long de l'axe du couloir.
float lighting(float along, float region, out float k) {
  k = floor(along / 2.4 + 0.5);
  float d = along - k * 2.4;
  return 0.3 + 0.7 * exp(-d * d * 0.5) * panel(k, region);
}

// Silhouette élancée (tête, buste, jambes), pieds en (0, 0).
float figure(vec2 q) {
  float head = length(q - vec2(0.0, 1.95)) - 0.13;
  vec2 pa = q - vec2(0.0, 0.98);
  vec2 ba = vec2(0.0, 0.66);
  float body = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - 0.19;
  float legs = max(max(abs(q.x) - 0.14, q.y - 1.0), -q.y);
  return min(min(head, body), legs);
}

vec3 corridor(vec3 ro, vec3 rd) {
  vec3 n;
  float t = boxExit(ro, rd, vec3(-CW * 0.5, 0.0, -CL), vec3(CW * 0.5, CH, 0.0), n);
  vec3 p = ro + rd * t;
  float region = 0.0;
  if (n.x < -0.5 && p.z < -CL + TW) {
    // Le virage : le couloir continue vers la droite, au bout.
    float t2 = boxExit(p, rd, vec3(CW * 0.5, 0.0, -CL), vec3(CW * 0.5 + TL, CH, -CL + TW), n);
    p += rd * t2;
    t += t2;
    region = 1.0;
  } else if (n.x > 0.5 && p.z < -3.9 && p.z > -4.9 && p.y < 2.05) {
    // Une porte à gauche, sur une pièce sans fenêtre.
    float t3 = boxExit(p, rd, vec3(-CW * 0.5 - 2.6, 0.0, -5.9), vec3(-CW * 0.5, CH, -2.9), n);
    p += rd * t3;
    t += t3;
    region = 2.0;
  }

  // Position le long de l'axe du couloir (pour l'éclairage) et coordonnée transverse.
  float along = region == 1.0 ? p.x - CW * 0.5 - 1.0 : region == 2.0 ? 0.0 : -p.z - 1.2;
  float across = region == 1.0 ? p.z + CL - TW * 0.5 : region == 2.0 ? p.z + 4.4 : p.x;
  float k;
  float light = lighting(along, region, k);
  if (region == 2.0) light = 0.22 + 0.25 * step(0.4, rh(floor(uTime * 2.0) + 5.0) * uMotion + 0.5 * (1.0 - uMotion));

  vec3 c;
  if (n.y > 0.5) {
    c = carpet(p.xz);
    c *= 0.82 + 0.18 * smoothstep(0.0, 0.5, CW * 0.5 - abs(across));
  } else if (n.y < -0.5) {
    // Plafond : dalles de 60 cm, néons tous les 2,4 m.
    vec2 g = abs(fract(p.xz / 0.6) - 0.5);
    c = mix(vec3(0.6, 0.57, 0.46), vec3(0.32, 0.3, 0.23), step(0.46, max(g.x, g.y)));
    float lamp = step(abs(across), 0.3) * step(abs(along - k * 2.4), 0.62) * step(region, 1.5);
    c = mix(c, vec3(1.0, 0.96, 0.8) * 3.2 * panel(k, region), lamp);
  } else {
    float u = abs(n.x) > 0.5 ? p.z : p.x;
    c = paper(vec2(u, p.y), p.y);
    c *= 0.82 + 0.18 * (p.y / CH);
    // Chambranle de la porte latérale.
    float jamb = step(abs(abs(p.z + 4.4) - 0.53), 0.05) * step(p.y, 2.1) + step(abs(p.y - 2.09), 0.05) * step(abs(p.z + 4.4), 0.58);
    c = mix(c, vec3(0.3, 0.24, 0.12), clamp(jamb, 0.0, 1.0) * step(0.5, n.x) * step(region, 0.5));
  }
  c *= light;

  // Une silhouette, au coin, quand la lumière flanche.
  if (uFigure > 0.01 && rd.z < -0.05) {
    float tf = (-CL + TW * 0.55 - ro.z) / rd.z;
    if (tf < t) {
      vec3 q = ro + rd * tf;
      if (q.x > CW * 0.5 && figure(vec2(q.x - CW * 0.5 - 1.2, q.y)) < 0.0) {
        c = mix(c, vec3(0.025, 0.02, 0.015), uFigure);
      }
    }
  }

  // Brume jaunâtre au loin : la profondeur se lit d'un coup d'œil.
  vec3 haze = vec3(0.6, 0.5, 0.22) * (0.55 + 0.45 * uLight);
  c = mix(c, haze, 1.0 - exp(-t * 0.08));
  return c * (0.5 + 0.75 * uLight);
}

void main() {
  vec2 p = vLocal.xy;
  float burst = uGlitch * uMotion;

  // Bandes horizontales qui glissent pendant les bouffées de parasites.
  float band = floor(p.y * 16.0);
  float slide = step(0.7, rh(band * 1.7 + floor(uTime * 9.0))) * burst;
  p.x += (rh(band + floor(uTime * 18.0) * 3.7) - 0.5) * 0.32 * slide;
  float wobble = floor(uTime * 7.0) * 0.37 * burst;

  float d = tearDist(p, wobble);
  float fringe = 0.022 + 0.04 * burst;
  float dR = tearDist(p + vec2(fringe, 0.0), wobble);
  float dB = tearDist(p - vec2(fringe, 0.0), wobble);

  vec3 color;
  float alpha;
  vec3 warm = vec3(1.0, 0.82, 0.32);
  if (d > 0.0) {
    vec3 rd = normalize(vLocal - vCamLocal);
    rd = mix(rd, vec3(1e-4), step(abs(rd), vec3(1e-4)));
    color = rd.z < -0.01 ? corridor(vec3(p, 0.0), rd) : vec3(0.6, 0.5, 0.22);
    // Bord intérieur brûlant.
    color += vec3(1.0, 0.9, 0.55) * exp(-d * 24.0) * 2.4 * uLight;
    alpha = 1.0;
  } else {
    // Liseré éblouissant, frangé de couleurs, et halo doux sur la façade.
    vec3 rim = vec3(
      smoothstep(-0.05, 0.0, dR),
      smoothstep(-0.05, 0.0, d),
      smoothstep(-0.05, 0.0, dB)
    );
    float edge = max(max(rim.r, rim.g), rim.b);
    float halo = exp(d * 4.2) * (0.32 + 0.4 * uNight) * uLight;
    color = mix(warm * 1.4, vec3(1.0, 0.95, 0.8) * 3.0, edge) * mix(vec3(1.0), rim * 1.2 + 0.2, 0.6 * edge);
    alpha = max(edge * (0.7 + 0.3 * uLight), halo);
  }

  // Blocs de parasites accrochés aux bords.
  vec2 cell = floor(vLocal.xy / vec2(0.14, 0.07));
  float near = 1.0 - smoothstep(0.0, 0.32, abs(d));
  float on = step(0.88, rh2(cell + floor(uTime * 11.0) * 1.37)) * near * (0.18 + burst) * uMotion;
  float pick = rh2(cell * 3.1 + floor(uTime * 11.0));
  vec3 block = pick < 0.3 ? vec3(1.0, 0.85, 0.2) : pick < 0.55 ? vec3(0.3, 1.0, 1.0) : pick < 0.75 ? vec3(1.0, 0.3, 0.85) : vec3(1.0);
  color = mix(color, block * 2.0, on);
  alpha = max(alpha, on * 0.92);

  // Lignes de balayage, grain de cassette.
  color *= 0.93 + 0.07 * sin(gl_FragCoord.y * 1.7 + uTime * 30.0 * uMotion);
  color += (rh2(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5) * 0.06 * alpha;

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Uniformes partagés de la faille (une seule île secrète). */
const riftUniforms = UniformsUtils.merge([
  UniformsLib.fog,
  {
    uTime: { value: 0 },
    uLight: { value: 1 },
    uGlitch: { value: 0 },
    uFigure: { value: 0 },
    uMotion: { value: 1 },
    uNight: { value: 0 },
    uPaper: { value: null },
  },
]);

/* ------------------------------------------------------------------ fissures */

/** Fissures lumineuses qui partent de la déchirure (repère de la faille, en mètres). */
const CRACKS: [number, number][][] = [
  [[0.02, 2.46], [0.13, 2.72], [0.03, 2.94], [0.16, 3.18], [0.1, 3.42]],
  [[-0.4, 1.86], [-0.62, 2.02], [-0.7, 2.3], [-0.96, 2.42], [-1.06, 2.7], [-1.0, 2.86]],
  [[0.5, 1.3], [0.74, 1.4], [0.84, 1.7], [1.02, 1.8], [1.1, 2.02]],
  [[0.42, 0.24], [0.66, 0.17], [0.82, 0.34], [1.02, 0.36]],
  [[-0.46, 0.7], [-0.7, 0.62], [-0.84, 0.8]],
];

function crackGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let base = 0;
  for (const line of CRACKS) {
    let travelled = 0;
    for (let index = 0; index < line.length; index++) {
      const [x, y] = line[index];
      const [px, py] = line[Math.max(0, index - 1)];
      const [nx, ny] = line[Math.min(line.length - 1, index + 1)];
      if (index > 0) travelled += Math.hypot(x - px, y - py);
      let dx = nx - px;
      let dy = ny - py;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const width = 0.075 * (1 - (index / (line.length - 1)) * 0.65);
      positions.push(x - dy * width, y + dx * width, 0, x + dy * width, y - dx * width, 0);
      uvs.push(travelled, 0, travelled, 1);
      if (index > 0) indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
      base += 2;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

const crackUniforms = { uTime: riftUniforms.uTime, uLight: riftUniforms.uLight, uNight: riftUniforms.uNight };

const CRACK_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CRACK_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uLight;
uniform float uNight;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float core = pow(across, 3.0);
  float pulse = 0.65 + 0.35 * sin(vUv.x * 9.0 - uTime * 3.5);
  float strength = (0.9 + uNight * 1.6) * uLight * pulse;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.42) * core * strength * 1.6, 1.0);
}
`;

/* ------------------------------------------------------------- lumière au sol */

const POOL_FRAGMENT = /* glsl */ `
uniform float uLight;
uniform float uNight;
varying vec2 vUv;
void main() {
  // vUv : x en travers (-1 → 1), y en avant (0 au pied de la faille → 1 au loin).
  vec2 q = vec2(vUv.x * 2.0 - 1.0, vUv.y);
  float spread = 0.32 + q.y * 0.9;
  float wedge = 1.0 - smoothstep(spread * 0.55, spread, abs(q.x));
  float fall = exp(-q.y * 2.6);
  float glow = exp(-dot(q * vec2(1.6, 2.4), q * vec2(1.6, 2.4)));
  float strength = (wedge * fall * 0.85 + glow * 0.4) * (0.22 + uNight * 0.85) * uLight;
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.34) * strength, 1.0);
}
`;

const RIFT_COLOR = new Color('#ffd25a');

let materials: { rift: ShaderMaterial; cracks: ShaderMaterial; pool: ShaderMaterial } | null = null;

/** Matériaux de la faille, créés une seule fois (la texture du papier peint aussi). */
function riftMaterials() {
  if (materials) return materials;
  riftUniforms.uPaper.value = wallpaperTexture();
  materials = {
    rift: new ShaderMaterial({
      uniforms: riftUniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      fog: true,
      depthWrite: true,
    }),
    cracks: new ShaderMaterial({
      uniforms: crackUniforms,
      vertexShader: CRACK_VERTEX,
      fragmentShader: CRACK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
    pool: new ShaderMaterial({
      uniforms: { uLight: riftUniforms.uLight, uNight: riftUniforms.uNight },
      vertexShader: CRACK_VERTEX,
      fragmentShader: POOL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  };
  return materials;
}

export function Rift({ position }: { position: [number, number, number] }) {
  const light = useRef<PointLight>(null);
  const quality = useWorld((state) => state.quality);
  const geometry = useMemo(() => new PlaneGeometry(3.4, 3.3).translate(0, 3.3 / 2 - 0.06, 0), []);
  const cracks = useMemo(() => crackGeometry(), []);
  const pool = useMemo(() => new PlaneGeometry(4.4, 4.2).rotateX(-Math.PI / 2).translate(0, 0, 2.1), []);
  const { rift: material, cracks: crackMaterial, pool: poolMaterial } = useMemo(() => riftMaterials(), []);

  useFrame((state) => {
    riftUniforms.uTime.value = state.clock.elapsedTime;
    riftUniforms.uLight.value = flicker.rift;
    riftUniforms.uGlitch.value = flicker.glitch;
    riftUniforms.uFigure.value = flicker.figure;
    riftUniforms.uMotion.value = flicker.motion;
    riftUniforms.uNight.value = skyState.dayNight;
    if (light.current) light.current.intensity = (1.2 + skyState.dayNight * 9) * flicker.rift;
  });

  return (
    <group position={position}>
      <mesh geometry={geometry} material={material} renderOrder={3} />
      <mesh geometry={cracks} material={crackMaterial} position-z={0.02} renderOrder={4} raycast={() => null} />
      <mesh geometry={pool} material={poolMaterial} position-y={0.03} renderOrder={2} raycast={() => null} />
      {quality === 'high' && (
        <pointLight ref={light} color={RIFT_COLOR} position={[0, 1.3, 1.1]} distance={11} decay={1.6} intensity={2} />
      )}
    </group>
  );
}
