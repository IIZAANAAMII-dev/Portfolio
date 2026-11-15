import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector4,
} from 'three';
import { hash } from '@/lib/utils/math';
import { spineTexture } from './rig';
import { ARMS, BURSTS, SPINE, SPINE_ROWS } from './state';

/**
 * Effets d'eau du kraken, tous en shaders (un draw call chacun, aucune allocation par image) :
 * collerettes d'écume là où les bras percent la surface, gouttes qui ruissellent, gerbes,
 * nappe d'encre, ombre géante sous le bateau et voile d'encre plein écran du retour au port.
 */

const NOISE = /* glsl */ `
float krHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float krNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(krHash(i), krHash(i + vec2(1.0, 0.0)), u.x),
    mix(krHash(i + vec2(0.0, 1.0)), krHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float krFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += krNoise(p) * a;
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

/** Lecture du squelette (version allégée pour les gouttes : centre linéaire, repère). */
const SPINE_LITE = /* glsl */ `
uniform sampler2D uSpine;
void krSpine(float arm, float s, out vec3 C, out float R, out vec3 N, out vec3 T, out float wet) {
  float fi = clamp(s, 0.0, 1.0) * ${(SPINE - 1).toFixed(1)};
  int k1 = int(min(floor(fi), ${(SPINE - 2).toFixed(1)}));
  float f = fi - float(k1);
  int row = int(arm + 0.5) * ${SPINE_ROWS};
  vec4 a1 = texelFetch(uSpine, ivec2(k1, row), 0);
  vec4 a2 = texelFetch(uSpine, ivec2(k1 + 1, row), 0);
  C = mix(a1.xyz, a2.xyz, f);
  R = mix(a1.w, a2.w, f);
  N = normalize(mix(texelFetch(uSpine, ivec2(k1, row + 1), 0).xyz, texelFetch(uSpine, ivec2(k1 + 1, row + 1), 0).xyz, f) + vec3(1e-5, 0.0, 0.0));
  vec4 t = mix(texelFetch(uSpine, ivec2(k1, row + 2), 0), texelFetch(uSpine, ivec2(k1 + 1, row + 2), 0), f);
  T = normalize(t.xyz + vec3(0.0, 1e-5, 0.0));
  wet = t.w;
}
`;

const fogUniforms = () => UniformsUtils.clone(UniformsLib.fog);

/* ------------------------------------------------------------------ Collerettes d'écume */

export const RING_SLOTS = ARMS + 1;

export function ringGeometry() {
  const quad = new PlaneGeometry(2, 2, 1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', quad.getAttribute('position'));
  if (quad.index) geometry.setIndex(quad.index);
  geometry.setAttribute('aRing', new InstancedBufferAttribute(new Float32Array(RING_SLOTS * 4), 4));
  geometry.setAttribute('aRingFx', new InstancedBufferAttribute(new Float32Array(RING_SLOTS * 4), 4));
  geometry.instanceCount = RING_SLOTS;
  quad.dispose();
  return geometry;
}

export function ringMaterial() {
  return new ShaderMaterial({
    uniforms: { ...fogUniforms(), uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aRing;
      attribute vec4 aRingFx;
      varying vec2 vLocal;
      varying vec2 vFx;
      #include <fog_pars_vertex>
      void main() {
        float radius = max(aRing.w, 0.05);
        float stretch = max(aRingFx.z, 1.0);
        float extent = 4.4;
        vec2 local = position.xy * extent;
        // Ellipse orientée (tête) : étirée selon son cap.
        float c = cos(aRingFx.w);
        float s = sin(aRingFx.w);
        vec2 stretched = vec2(local.x * stretch, local.y);
        vec2 world = vec2(stretched.x * c - stretched.y * s, stretched.x * s + stretched.y * c) * radius;
        vLocal = local;
        vFx = aRingFx.xy;
        vec4 mvPosition = modelViewMatrix * vec4(aRing.x + world.x, aRing.y, aRing.z + world.y, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec2 vLocal;
      varying vec2 vFx;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        float d = length(vLocal);
        float a = atan(vLocal.y, vLocal.x);
        float n = krNoise(vec2(a * 2.6 + vFx.y * 10.0, uTime * 0.7 + vFx.y * 3.0));
        // Collerette serrée contre le bras, déchiquetée.
        float collar = smoothstep(0.86, 1.0, d) * (1.0 - smoothstep(1.25, 2.0 + n * 0.9, d));
        // Rides qui s'éloignent.
        float ripples = 0.0;
        for (int i = 0; i < 3; i++) {
          float life = fract(uTime * 0.42 + vFx.y + float(i) / 3.0);
          float r = 1.25 + life * 2.9;
          ripples += (1.0 - smoothstep(0.0, 0.16 + life * 0.1, abs(d - r))) * (1.0 - life) * (1.0 - life);
        }
        float breakup = smoothstep(0.28, 0.62, krNoise(vLocal * 2.4 + vFx.y * 7.0 + uTime * 0.3));
        float foam = max(collar * (0.75 + n * 0.5), ripples * 0.7 * breakup) * vFx.x;
        foam *= 1.0 - smoothstep(3.6, 4.4, d);
        if (foam < 0.01) discard;
        vec3 color = mix(vec3(0.88, 0.97, 0.95), vec3(0.42, 0.95, 0.86), uNight * 0.55);
        gl_FragColor = vec4(color, clamp(foam, 0.0, 0.92));
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

/* ------------------------------------------------------------------ Gouttes */

export const DRIP_COUNT = 420;

export function dripGeometry() {
  const data = new Float32Array(DRIP_COUNT * 4);
  for (let i = 0; i < DRIP_COUNT; i++) {
    // Un quart des gouttes ruisselle de la tête (bras n° 8).
    const head = i % 4 === 3;
    data[i * 4] = head ? ARMS : i % ARMS;
    data[i * 4 + 1] = head ? hash(i * 3.3 + 1) : 0.12 + hash(i * 1.7 + 4) * 0.84;
    data[i * 4 + 2] = hash(i * 5.9 + 2);
    data[i * 4 + 3] = hash(i * 9.1 + 7) * Math.PI * 2;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(DRIP_COUNT * 3), 3));
  geometry.setAttribute('aDrip', new BufferAttribute(data, 4));
  return geometry;
}

export const dripUniforms = {
  uSpine: { value: spineTexture },
  uTime: { value: 0 },
  uPointScale: { value: 400 },
  uHead: { value: new Vector4(0, -30, 0, 0) },
  uHeadYaw: { value: 0 },
  uNight: { value: 0 },
};

export function dripMaterial() {
  return new ShaderMaterial({
    uniforms: dripUniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aDrip;
      uniform float uTime;
      uniform float uPointScale;
      uniform vec4 uHead;
      uniform float uHeadYaw;
      varying float vAlpha;
      ${SPINE_LITE}
      void main() {
        float period = 0.8 + aDrip.z * 0.7;
        float life = fract(uTime / period + aDrip.z * 13.7);
        vec3 spawn;
        float wet;
        if (aDrip.x < ${(ARMS - 0.5).toFixed(1)}) {
          vec3 C; float R; vec3 N; vec3 T;
          krSpine(aDrip.x, aDrip.y, C, R, N, T, wet);
          vec3 B = cross(T, N);
          spawn = C + (cos(aDrip.w) * N + sin(aDrip.w) * B) * R;
          wet *= step(0.06, R);
        } else {
          // Tête : un point du dôme émergé (repère tourné par le cap).
          float az = aDrip.y * 6.2832;
          float el = 0.1 + fract(aDrip.w * 0.37) * 1.1;
          vec3 local = vec3(cos(az) * cos(el) * 7.0, sin(el) * 6.0, sin(az) * cos(el) * 7.4);
          float c = cos(uHeadYaw);
          float s = sin(uHeadYaw);
          spawn = uHead.xyz + vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
          wet = uHead.w;
        }
        float t = life * period;
        vec3 p = spawn + vec3(0.0, -5.2 * t * t, 0.0);
        float alive = step(0.0, p.y) * step(0.35, spawn.y) * step(0.02, wet);
        vAlpha = alive * (1.0 - life * 0.55) * min(1.0, wet * 1.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = alive > 0.0 ? clamp(uPointScale * (0.16 + aDrip.z * 0.14) / max(1.0, -mv.z), 1.0, 8.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.y *= 0.7;
        float drop = 1.0 - smoothstep(0.22, 0.5, length(q));
        float alpha = drop * vAlpha;
        if (alpha < 0.02) discard;
        vec3 color = mix(vec3(0.8, 0.93, 0.96), vec3(0.45, 0.95, 0.9), uNight * 0.5);
        gl_FragColor = vec4(color, alpha * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/* ------------------------------------------------------------------ Gerbes */

export const SPRAY_COUNT = 720;

export function sprayGeometry() {
  const data = new Float32Array(SPRAY_COUNT * 4);
  for (let i = 0; i < SPRAY_COUNT; i++) {
    data[i * 4] = i % BURSTS;
    data[i * 4 + 1] = hash(i * 2.31 + 3) * Math.PI * 2;
    data[i * 4 + 2] = hash(i * 7.77 + 1);
    data[i * 4 + 3] = hash(i * 4.13 + 9);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(SPRAY_COUNT * 3), 3));
  geometry.setAttribute('aSpray', new BufferAttribute(data, 4));
  return geometry;
}

export const sprayUniforms = {
  uBurst: { value: Array.from({ length: BURSTS }, () => new Vector4(0, 0, 0, 99)) },
  uBurstFx: { value: Array.from({ length: BURSTS }, () => new Vector4()) },
  uPointScale: { value: 400 },
  uNight: { value: 0 },
};

export function sprayMaterial() {
  return new ShaderMaterial({
    uniforms: sprayUniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aSpray;
      uniform vec4 uBurst[${BURSTS}];
      uniform vec4 uBurstFx[${BURSTS}];
      uniform float uPointScale;
      varying float vAlpha;
      void main() {
        int slot = int(aSpray.x + 0.5);
        vec4 b = uBurst[slot];
        vec4 fx = uBurstFx[slot];
        float t = b.w - aSpray.w * 0.28;
        float span = 1.0 + fx.z * 0.5;
        float life = t / span;
        float alive = step(0.0, t) * step(life, 1.0) * step(0.01, fx.x);
        vec2 dir = vec2(cos(aSpray.y), sin(aSpray.y));
        float speed = (1.6 + aSpray.z * 5.5) * (0.55 + fx.x * 0.45);
        vec3 velocity = vec3(dir.x * speed, (4.5 + aSpray.z * 10.0) * fx.z, dir.y * speed);
        vec3 p = b.xyz + vec3(dir.x, 0.0, dir.y) * fx.y * (0.6 + aSpray.w * 0.6)
          + velocity * t + vec3(0.0, -9.0, 0.0) * t * t * 0.5;
        alive *= step(-0.4, p.y);
        vAlpha = alive * (1.0 - life) * (1.0 - life * 0.3) * min(1.0, fx.x * 1.3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = (0.28 + aSpray.z * 0.5) * (0.7 + fx.y * 0.12) * (1.0 + life * 0.8);
        gl_PointSize = alive > 0.0 ? clamp(uPointScale * size / max(1.0, -mv.z), 1.0, 22.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float puff = 1.0 - smoothstep(0.18, 0.5, d);
        float alpha = puff * vAlpha;
        if (alpha < 0.015) discard;
        vec3 color = mix(vec3(0.9, 0.97, 0.98), vec3(0.5, 0.92, 0.88), uNight * 0.45);
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
}

/* ------------------------------------------------------------------ Nappe d'encre */

export const inkUniforms = {
  ...fogUniforms(),
  uAmount: { value: 0 },
  uFade: { value: 0 },
  uTime: { value: 0 },
  uSeed: { value: 0 },
};

export function inkMaterial() {
  return new ShaderMaterial({
    uniforms: inkUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      #include <fog_pars_vertex>
      void main() {
        vLocal = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform float uFade;
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vLocal;
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        float radius = 5.0 + 31.0 * uAmount;
        vec2 p = vLocal;
        float n = krFbm(p * 0.07 + uSeed + vec2(uTime * 0.02, -uTime * 0.015));
        float edge = length(p) / radius + (n - 0.5) * 0.55;
        float body = 1.0 - smoothstep(0.72, 1.0, edge);
        if (body < 0.01) discard;
        float swirl = krFbm(p * 0.16 + vec2(n * 4.0, uTime * 0.04));
        vec3 color = mix(vec3(0.02, 0.004, 0.04), vec3(0.15, 0.035, 0.22), swirl);
        // Lisière bioluminescente violette : l'encre se lit même sur l'eau noire.
        float rim = smoothstep(0.55, 0.92, edge) * body;
        color += vec3(0.42, 0.13, 0.72) * rim * 0.7;
        gl_FragColor = vec4(color, body * 0.9 * uFade);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

/* ------------------------------------------------------------------ Ombre */

export const shadowUniforms = {
  uStrength: { value: 0 },
  uTime: { value: 0 },
  uSize: { value: new Vector2(52, 25) },
};

export function shadowMaterial() {
  return new ShaderMaterial({
    uniforms: shadowUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform float uTime;
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        // En mètres, +x = avant : manteau devant, huit bras qui traînent en ondulant derrière.
        vec2 p = (vUv - 0.5) * uSize;
        vec2 m = (p - vec2(uSize.x * 0.2, 0.0)) / vec2(uSize.x * 0.24, uSize.y * 0.24);
        float body = 1.0 - smoothstep(0.55, 1.0, length(m));
        float arms = 0.0;
        float t = clamp((uSize.x * 0.08 - p.x) / (uSize.x * 0.56), 0.0, 1.0);
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float spread = (fi - 3.5) / 3.5;
          float centre = spread * uSize.y * 0.34 * (0.3 + t)
            + sin(t * 7.0 - uTime * 1.7 + fi * 1.3) * uSize.y * 0.05 * t;
          float halfWidth = uSize.y * 0.055 * (1.0 - t * 0.85) + 0.3;
          float d = abs(p.y - centre);
          arms = max(arms, (1.0 - smoothstep(halfWidth * 0.5, halfWidth, d)) * (1.0 - smoothstep(0.82, 1.0, t)));
        }
        arms *= step(p.x, uSize.x * 0.12);
        float shape = max(body, arms * 0.85);
        float core = 1.0 - smoothstep(0.0, 1.2, length(m));
        float alpha = shape * (0.3 + core * 0.4) * uStrength;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(0.004, 0.006, 0.012, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

/* ------------------------------------------------------------------ Voile d'encre */

export const veilUniforms = {
  uVeil: { value: 0 },
  uMode: { value: 0 },
  uOrigin: { value: new Vector2(0.5, 0.5) },
  uAspect: { value: 1.6 },
  uTime: { value: 0 },
  uTint: { value: new Color('#b04cff') },
};

export function veilMaterial() {
  return new ShaderMaterial({
    uniforms: veilUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uVeil;
      uniform float uMode;
      uniform vec2 uOrigin;
      uniform float uAspect;
      uniform float uTime;
      uniform vec3 uTint;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = (vUv - uOrigin) * vec2(uAspect, 1.0);
        float d = length(p);
        float a = atan(p.y, p.x);
        // Tache qui s'étend depuis le kraken (bords en volutes)…
        float n = krFbm(vec2(a * 1.9, d * 2.6 - uTime * 0.5));
        float reach = uVeil * 2.6;
        float edge = d + (n - 0.5) * 0.5 * (0.35 + d);
        float grow = 1.0 - smoothstep(reach - 0.05, reach, edge);
        float growRim = smoothstep(reach - 0.24, reach - 0.02, edge) * grow;
        // … puis se dissout en lambeaux sur le port retrouvé.
        vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
        float field = krFbm(c * 2.4 + 3.1 + uTime * 0.06) * 0.78 + length(c) * 0.3;
        float threshold = uVeil * 1.3 - 0.05;
        float dissolve = 1.0 - smoothstep(threshold - 0.1, threshold, field);
        float dissolveRim = smoothstep(threshold - 0.16, threshold - 0.02, field) * dissolve;
        float cover = mix(grow, dissolve, uMode);
        float rim = mix(growRim, dissolveRim, uMode);
        if (cover < 0.003) discard;
        float swirl = krFbm(p * 2.8 + vec2(uTime * 0.08, 0.0));
        vec3 ink = mix(vec3(0.012, 0.004, 0.026), vec3(0.09, 0.025, 0.14), swirl);
        ink += uTint * rim * 0.42;
        gl_FragColor = vec4(ink, cover);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

