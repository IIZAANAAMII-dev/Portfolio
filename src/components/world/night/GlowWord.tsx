'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Color, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector2 } from 'three';
import { loadHandFont } from '@/components/islands/kit';
import { skyState } from '@/lib/sky';
import { smoothstep } from '@/lib/utils/math';
import { beams } from './beams';

/**
 * Un mot breton peint en mer à la peinture phosphorescente, sur une dalle de granit : invisible
 * de jour, il s'écrit en lumière derrière le faisceau du phare qui le balaie, lettre après
 * lettre dans le sens de la rotation, puis s'éteint doucement en quelques secondes — jusqu'au
 * passage suivant. Calcul par pixel (temps écoulé depuis le dernier passage d'un faisceau sur
 * ce point), sans état : un appel de dessin, monté seulement la nuit.
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uLamp;
uniform float uBearing;
uniform float uSpin;
uniform float uCount;
uniform float uSpread;
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 paint = texture2D(uMap, vUv);
  if (paint.a < 0.01) discard;
  vec2 rel = vWorld.xz - uLamp;
  float sector = 6.2831853 / uCount;
  // Angle parcouru par le faisceau depuis son dernier passage sur ce point → temps écoulé.
  float swept = mod((uBearing - atan(rel.y, rel.x)) * sign(uSpin), sector);
  float since = swept / max(abs(uSpin), 0.05);
  float charge = exp(-since / 2.4);
  float inBeam = exp(-pow(min(swept, sector - swept) / max(uSpread, 0.02), 2.0));
  float shimmer = 0.92 + 0.08 * sin(uTime * 3.1 + vWorld.x * 1.7 + vWorld.z * 1.3);
  float glow = clamp(charge * 0.9 * shimmer + inBeam * 0.55, 0.0, 1.3) * uStrength;
  // Cœur des lettres plus blanc, halo doré.
  vec3 color = mix(uColor, vec3(1.0, 0.98, 0.92), smoothstep(0.75, 1.0, paint.a) * (0.35 + 0.5 * inBeam));
  gl_FragColor = vec4(color, paint.a * glow);
  #include <colorspace_fragment>
}
`;

/** Texture du mot : lettres manuscrites (police du site) cerclées d'un halo flou. */
function wordTexture(text: string, family: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Graisse 500 : celle que charge loadHandFont (une autre retomberait sur une police de secours).
  let size = 200;
  ctx.font = `500 ${size}px ${family}`;
  const width = ctx.measureText(text).width;
  if (width > 880) size = Math.floor((size * 880) / width);
  ctx.font = `500 ${size}px ${family}`;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 10;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = 34;
  ctx.fillText(text, 512, 136);
  ctx.shadowBlur = 12;
  ctx.strokeText(text, 512, 136);
  ctx.shadowBlur = 0;
  // Trait épaissi au pinceau : une écriture de peintre, lisible de loin.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.strokeText(text, 512, 136);
  ctx.fillText(text, 512, 136);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function GlowWord({
  text,
  beam,
  position,
  rotation = 0,
  width,
  color = '#ffd98c',
}: {
  text: string;
  /** Identifiant du faisceau qui le révèle (SweepBeam). */
  beam: string;
  /** Centre du mot, posé sur la dalle (repère local du décor). */
  position: [number, number, number];
  /** Orientation (rotation.y) : le haut des lettres regarde vers -Z local tourné. */
  rotation?: number;
  width: number;
  color?: string;
}) {
  const mesh = useRef<Mesh>(null);
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadHandFont().then((name) => {
      if (!cancelled) setFamily(name);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const texture = useMemo(() => (family ? wordTexture(text, family) : null), [family, text]);
  const geometry = useMemo(() => new PlaneGeometry(width, width / 4).rotateX(-Math.PI / 2), [width]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uMap: { value: null },
          uLamp: { value: new Vector2() },
          uBearing: { value: 0 },
          uSpin: { value: 0.5 },
          uCount: { value: 1 },
          uSpread: { value: 0.1 },
          uStrength: { value: 0 },
          uTime: { value: 0 },
          uColor: { value: new Color(color) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [color],
  );
  useEffect(() => () => texture?.dispose(), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const source = beams.get(beam);
    // Jamais de jour, même si le phare tourne après un clic.
    const strength = source ? source.strength * smoothstep(0.3, 0.7, skyState.dayNight) : 0;
    target.visible = strength > 0.01 && texture !== null;
    if (!target.visible || !source) return;
    const uniforms = (target.material as ShaderMaterial).uniforms;
    uniforms.uMap.value = texture;
    uniforms.uLamp.value.set(source.x, source.z);
    uniforms.uBearing.value = source.bearing;
    uniforms.uSpin.value = source.spin;
    uniforms.uCount.value = source.count;
    uniforms.uSpread.value = source.spread;
    uniforms.uStrength.value = strength;
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      position={position}
      rotation-y={rotation}
      renderOrder={6}
      visible={false}
      raycast={() => null}
    />
  );
}
