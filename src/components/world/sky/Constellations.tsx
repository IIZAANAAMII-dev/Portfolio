'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ShaderMaterial,
  Vector3,
  type Mesh,
  type Texture,
} from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { useWorld } from '@/lib/store';
import { clamp, smoothstep } from '@/lib/utils/math';
import { BACKGROUND, FIGURES, buildConstellationGeometry, labelDirections } from './constellations';
import { SKY_LAYER_GLSL, skyLayerUniforms, skyParams } from './sky-layer';

/**
 * Constellations de l'archipel : sur la voûte (plans bas, regard levé) et, surtout, dans
 * leur reflet sur la mer de nuit — la caméra de navigation regarde l'eau. Chaque figure se
 * trace à son tour, trait après trait, une étoile s'allumant quand la plume l'atteint ;
 * puis tout scintille doucement. Les noms (police du site) n'apparaissent que si la caméra
 * regarde vers le ciel.
 *
 * Coût : deux appels de dessin (voûte, reflet) + un pour les noms, seulement la nuit.
 */
const FIGURE_COUNT = FIGURES.length + 1;

const vertexShader = /* glsl */ `
${SKY_LAYER_GLSL}
uniform float uDraw[${FIGURE_COUNT}];
uniform float uAlpha;
uniform float uTime;
uniform float uMotion;
uniform float uWish;

attribute vec3 aDir;
attribute vec3 aDirB;
attribute vec3 aSea;
attribute vec3 aSeaB;
attribute vec4 aInfo;
attribute vec2 aSeed;

varying vec2 vCorner;
varying float vKind;
varying float vAlpha;
varying float vTip;
varying float vTint;
varying float vFlare;

void hide() {
  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
  vAlpha = 0.0;
}

void main() {
  float kind = position.z;
  int figure = int(aInfo.x + 0.5);
  float draw = uDraw[figure];
  bool sea = uPass > 0.5;
  vec3 a = sea ? aSea : aDir;
  vec3 b = sea ? aSeaB : aDirB;
  vCorner = position.xy;
  vKind = kind;
  vTint = aSeed.y;
  vTip = 1.0;
  vFlare = 0.0;

  if (kind < 0.5) {
    // Étoile : s'allume quand la plume l'atteint (petit éclat), puis scintille.
    if (!sea && aInfo.x > ${BACKGROUND - 0.5}) {
      hide();
      return;
    }
    float fade;
    vec3 world = skyPlace(a, fade);
    vec4 clip = skyClip(world);
    if (clip.w < 0.5) {
      hide();
      return;
    }
    float appear = smoothstep(aInfo.y, aInfo.y + 0.05, draw);
    float twinkle = mix(1.0, 0.6 + 0.4 * sin(uTime * (1.1 + aSeed.x * 2.6) + aSeed.x * 40.0), uMotion);
    float pop = 1.0 + sin(appear * 3.14159) * 0.9;
    float size = aInfo.w * 3.2 * pop * (1.0 + uWish * 0.45) * (sea ? 0.78 : 1.0);
    // Reflet : traînée verticale qui tremble avec la houle.
    vec2 corner = position.xy * vec2(1.0, sea ? 3.0 : 1.0);
    float wobble = sea ? sin(uTime * 1.4 + world.z * 0.35 + world.x * 0.12) * 0.7 * uMotion : 0.0;
    skyClipOffset(clip, corner * size + vec2(wobble, 0.0));
    vAlpha = appear * twinkle * fade * uAlpha * (1.0 + uWish * 1.2) * (sea ? 0.52 : 1.0);
    vFlare = sea ? 0.0 : smoothstep(0.55, 1.0, aInfo.w / 5.2);
    gl_Position = clip;
    if (vAlpha < 0.001) hide();
    return;
  }

  // Trait : de l'étoile de départ jusqu'à la plume.
  float progress = clamp((draw - aInfo.y) / max(aInfo.z - aInfo.y, 1e-3), 0.0, 1.0);
  vec3 tip = normalize(mix(a, b, progress));
  float fadeA;
  float fadeB;
  vec4 ca = skyClip(skyPlace(a, fadeA));
  vec4 cb = skyClip(skyPlace(tip, fadeB));
  if (progress <= 0.0 || ca.w < 0.5 || cb.w < 0.5 || uAlpha < 0.001) {
    hide();
    return;
  }
  vec2 sa = ca.xy / ca.w * uViewport * 0.5;
  vec2 sb = cb.xy / cb.w * uViewport * 0.5;
  float len = length(sb - sa);
  vec2 along = (sb - sa) / max(len, 1e-3);
  vec2 normal = vec2(-along.y, along.x);
  float end = position.x;
  vec4 clip = end < 0.5 ? ca : cb;
  // Le trait s'arrête avant les étoiles ; la plume, elle, reste à la pointe.
  float gap = min(5.5 * (sea ? 0.7 : 1.0), len * 0.4);
  vec2 shift = along * gap * (end < 0.5 ? 1.0 : -step(0.999, progress));
  float width = sea ? 1.1 : 1.35;
  skyClipOffset(clip, shift + normal * position.y * (width + 1.0));
  vCorner = vec2(end * progress, position.y);
  vTip = progress;
  float breathe = mix(1.0, 0.86 + 0.14 * sin(uTime * 0.7 + aInfo.x * 1.7), uMotion);
  vAlpha = min(fadeA, fadeB) * uAlpha * breathe * (sea ? 0.36 : 0.72) * (1.0 + uWish * 0.8);
  gl_Position = clip;
}
`;

const fragmentShader = /* glsl */ `
uniform float uPass;
uniform float uTime;
uniform float uMotion;
varying vec2 vCorner;
varying float vKind;
varying float vAlpha;
varying float vTip;
varying float vTint;
varying float vFlare;

void main() {
  if (vAlpha < 0.001) discard;
  vec3 color;
  float alpha;
  if (vKind < 0.5) {
    float d = length(vCorner);
    float core = exp(-d * d * 22.0);
    float glow = exp(-d * d * 4.5) * 0.3;
    vec2 c = abs(vCorner);
    float spikes = (exp(-c.x * 26.0) * (1.0 - smoothstep(0.0, 1.0, c.y))
      + exp(-c.y * 26.0) * (1.0 - smoothstep(0.0, 1.0, c.x))) * 0.55 * vFlare;
    alpha = (core + glow + spikes) * vAlpha;
    color = mix(vec3(0.86, 0.92, 1.0), vec3(1.0, 0.82, 0.52), vTint) * (1.0 + core * 0.6);
  } else {
    float soft = 1.0 - smoothstep(0.35, 1.0, abs(vCorner.y));
    // La pointe du trait en cours brille un peu plus : on voit la plume avancer.
    float pen = (1.0 - step(0.999, vTip)) * smoothstep(vTip - 0.2, vTip, vCorner.x);
    alpha = soft * vAlpha * (1.0 + pen * 1.6);
    color = mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.9, 0.7), 0.55 + pen * 0.45);
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

const labelVertexShader = /* glsl */ `
${SKY_LAYER_GLSL}
uniform float uDraw[${FIGURE_COUNT}];
uniform float uLabel;
attribute vec3 aDir;
attribute vec2 aLabel;
varying vec2 vUv;
varying float vAlpha;

void main() {
  float fade;
  vec4 clip = skyClip(skyPlace(aDir, fade));
  int figure = int(aLabel.x + 0.5);
  vAlpha = uLabel * fade * smoothstep(0.9, 1.0, uDraw[figure]) * step(0.5, clip.w);
  skyClipOffset(clip, position.xy * vec2(104.0, 13.0));
  vUv = vec2(position.x * 0.5 + 0.5, 1.0 - (aLabel.y + 0.5 - position.y * 0.5) / ${FIGURES.length}.0);
  gl_Position = clip;
}
`;

const labelFragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;

void main() {
  float alpha = texture2D(uMap, vUv).a * vAlpha * 0.78;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(0.96, 0.91, 0.8, alpha);
  #include <colorspace_fragment>
}
`;

// État partagé hors React : un seul exemplaire, muté une fois par image.
const draw = new Array<number>(FIGURE_COUNT).fill(0);
const drawUniform = { value: draw };
const alphaUniform = { value: 0 };
const skyPass = { value: 0 };
const seaPass = { value: 1 };
const labelUniforms = {
  uMap: { value: null as Texture | null },
  uLabel: { value: 0 },
};
const nightClock = { seconds: 0 };
const look = new Vector3();

function makeMaterial(pass: { value: number }) {
  return new ShaderMaterial({
    uniforms: { ...skyLayerUniforms, uPass: pass, uDraw: drawUniform, uAlpha: alphaUniform },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
}

function buildLabelGeometry() {
  const directions = labelDirections();
  const corners: number[] = [];
  const dirs: number[] = [];
  const labels: number[] = [];
  const index: number[] = [];
  directions.forEach((dir, row) => {
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corners.push(x, y, 0);
      dirs.push(dir.x, dir.y, dir.z);
      labels.push(row, row);
    }
    const v = row * 4;
    index.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(corners), 3));
  geometry.setAttribute('aDir', new BufferAttribute(new Float32Array(dirs), 3));
  geometry.setAttribute('aLabel', new BufferAttribute(new Float32Array(labels), 2));
  geometry.setIndex(index);
  return geometry;
}

/** Noms des figures, peints une fois (Fraunces italique, la voix du carnet). */
async function paintLabels() {
  const family = getComputedStyle(document.body).getPropertyValue('--font-serif').trim() || 'Georgia, serif';
  await document.fonts.load(`italic 400 38px ${family}`).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64 * FIGURES.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 400 38px ${family}`;
  FIGURES.forEach((figure, row) => ctx.fillText(figure.label, 256, row * 64 + 33));
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function Constellations() {
  const quality = useWorld((state) => state.quality);
  const sky = useRef<Mesh>(null);
  const sea = useRef<Mesh>(null);
  const labels = useRef<Mesh>(null);
  const geometry = useMemo(() => buildConstellationGeometry(quality === 'low' ? 60 : 150), [quality]);
  const labelGeometry = useMemo(() => buildLabelGeometry(), []);
  const materials = useMemo(
    () => ({
      sky: makeMaterial(skyPass),
      sea: makeMaterial(seaPass),
      label: new ShaderMaterial({
        uniforms: { ...skyLayerUniforms, uPass: skyPass, uDraw: drawUniform, ...labelUniforms },
        vertexShader: labelVertexShader,
        fragmentShader: labelFragmentShader,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => {
    labelGeometry.dispose();
    materials.sky.dispose();
    materials.sea.dispose();
    materials.label.dispose();
  }, [labelGeometry, materials]);

  useEffect(() => {
    let cancelled = false;
    let texture: CanvasTexture | null = null;
    void paintLabels().then((painted) => {
      if (cancelled || !painted) {
        painted?.dispose();
        return;
      }
      texture = painted;
      labelUniforms.uMap.value = painted;
    });
    return () => {
      cancelled = true;
      texture?.dispose();
      labelUniforms.uMap.value = null;
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { reveal, reducedMotion } = useWorld.getState();
    const night = smoothstep(0.6, 0.92, skyState.dayNight)
      * smoothstep(0.85, 1, reveal)
      * (1 - smoothstep(0.05, 0.3, ecologyState.stormCover));

    // Horloge de la nuit : le tracé recommence à chaque tombée de la nuit.
    if (night > 0.02) nightClock.seconds += dt;
    else if (skyState.dayNight < 0.35) nightClock.seconds = 0;
    const instant = reducedMotion || skyParams.sky?.includes('drawn') === true;
    for (let i = 0; i < FIGURES.length; i++) {
      draw[i] = instant ? 1.001 : clamp((nightClock.seconds - 1.5 - i * 4.2) / 9.5, 0, 1.001);
    }
    draw[BACKGROUND] = 1.001;
    alphaUniform.value = night;

    // Les noms ne se montrent que si l'on regarde vers le ciel.
    state.camera.getWorldDirection(look);
    labelUniforms.uLabel.value = night * smoothstep(0.08, 0.32, look.y);

    const visible = night > 0.003;
    // La voûte n'est dessinée que si le cadre peut atteindre l'horizon.
    if (sky.current) sky.current.visible = visible && look.y > -0.5;
    if (sea.current) sea.current.visible = visible;
    if (labels.current) {
      labels.current.visible = labelUniforms.uMap.value !== null && labelUniforms.uLabel.value > 0.003;
    }
  });

  return (
    <>
      <mesh ref={sky} geometry={geometry} material={materials.sky} frustumCulled={false} renderOrder={1} raycast={() => null} />
      <mesh ref={sea} geometry={geometry} material={materials.sea} frustumCulled={false} renderOrder={3} raycast={() => null} />
      <mesh
        ref={labels}
        geometry={labelGeometry}
        material={materials.label}
        frustumCulled={false}
        renderOrder={1}
        raycast={() => null}
      />
    </>
  );
}
