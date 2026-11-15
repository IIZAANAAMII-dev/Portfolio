'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RingGeometry, ShaderMaterial, Vector3, type Mesh } from 'three';
import { rainbow } from './weather';

/**
 * Arc-en-ciel d'après le grain : arc primaire (rouge dehors, violet dedans), arc secondaire
 * pâle aux couleurs inversées, ciel un peu plus clair sous l'arc. Le plan de l'arc fait face
 * à la caméra et ses pieds plongent dans la mer (rien n'est dessiné sous la surface) ; les
 * îles placées devant le masquent. Un seul appel de dessin, seulement pendant l'apparition.
 */
const vertexShader = /* glsl */ `
uniform vec3 uDir;
uniform float uDistance;
uniform float uRadius;
varying vec2 vLocal;
varying float vHeight;

void main() {
  vec3 center = cameraPosition + uDir * uDistance;
  vec3 right = normalize(cross(uDir, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, uDir);
  vec3 world = center + (right * position.x + up * position.y) * uRadius;
  vLocal = position.xy;
  vHeight = world.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uAlpha;
varying vec2 vLocal;
varying float vHeight;

vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  if (vHeight < 0.05) discard;
  float r = length(vLocal);
  float t = (r - 0.86) / 0.14;
  float primary = smoothstep(0.0, 0.24, t) * (1.0 - smoothstep(0.76, 1.0, t));
  vec3 primaryColor = mix(vec3(1.0), hue(mix(0.76, 0.0, clamp(t, 0.0, 1.0))), 0.78);
  float s = (r - 1.12) / 0.12;
  float secondary = smoothstep(0.0, 0.26, s) * (1.0 - smoothstep(0.74, 1.0, s)) * 0.3;
  vec3 secondaryColor = mix(vec3(1.0), hue(mix(0.0, 0.76, clamp(s, 0.0, 1.0))), 0.7);
  float inner = smoothstep(0.58, 0.86, r) * (1.0 - smoothstep(0.86, 0.9, r)) * 0.08;
  float alpha = primary * 0.52 + secondary * 0.52 + inner;
  vec3 color = (primaryColor * primary * 0.52 + secondaryColor * secondary * 0.52 + vec3(1.0) * inner) / max(alpha, 1e-4);
  // Les pieds se fondent dans la mer.
  alpha *= uAlpha * smoothstep(0.0, 5.0, vHeight);
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const uniforms = {
  uDir: { value: new Vector3(0, -0.6, 0.8) },
  uDistance: { value: 60 },
  uRadius: { value: 40 },
  uAlpha: { value: 0 },
};

export function Rainbow() {
  const mesh = useRef<Mesh>(null);
  const resources = useMemo(
    () => ({
      geometry: new RingGeometry(0.6, 1.3, 96, 1, 0, Math.PI),
      material: new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    }),
    [],
  );
  useEffect(() => () => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);

  useFrame(() => {
    const visible = rainbow.active && rainbow.alpha > 0.003;
    if (mesh.current) mesh.current.visible = visible;
    if (!visible) return;
    uniforms.uDir.value.copy(rainbow.dir);
    uniforms.uDistance.value = rainbow.distance;
    uniforms.uRadius.value = rainbow.radius;
    uniforms.uAlpha.value = rainbow.alpha;
  });

  return (
    <mesh
      ref={mesh}
      geometry={resources.geometry}
      material={resources.material}
      frustumCulled={false}
      renderOrder={7}
      raycast={() => null}
    />
  );
}
