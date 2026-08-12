'use client';

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, DoubleSide, ShaderMaterial, Vector3, Vector4 } from 'three';
import { homeIsland, islands } from '@/data/islands';
import { useWorld } from '@/lib/store';
import { WAVE_GLSL } from '@/lib/waves';

const OCEAN_SIZE = 420;
/** 6 îles + l'îlot de départ. Fixe pour éviter une boucle dynamique dans le shader. */
const SHOAL_COUNT = 7;

const vertexShader = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vHeight;
${WAVE_GLSL}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float h = waveHeight(world.xz, uTime);
  world.y += h;
  vWorld = world.xyz;
  vHeight = h;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSun;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uCameraPos;
uniform float uSparkle;
uniform vec4 uShoals[${SHOAL_COUNT}];
varying vec3 vWorld;
varying float vHeight;

void main() {
  // Facette franche : on reçoit la normale du triangle entier.
  vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (normal.y < 0.0) normal = -normal;

  // Distance au bord de l'île la plus proche.
  float edge = 1e4;
  for (int i = 0; i < ${SHOAL_COUNT}; i++) {
    edge = min(edge, distance(vWorld.xz, uShoals[i].xy) - uShoals[i].z);
  }

  // Passage du grand fond vers l'eau turquoise des hauts-fonds.
  float shallow = 1.0 - smoothstep(0.0, 22.0, max(edge, 0.0));
  vec3 water = mix(uDeep, uShallow, shallow * 0.9);

  // Indice de vue : plus l'onde est vue de travers, plus elle renvoie le ciel.
  vec3 viewDir = normalize(uCameraPos - vWorld);
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  fresnel = pow(fresnel, 2.4);

  // Reflet du ciel : bleu azur à l'horizon, plus profond au zénith.
  float up = max(normal.y, 0.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.8, up));
  water = mix(water, sky, fresnel * 0.45);

  // Éclairage stylisé, quantifié, avec éclat du soleil en crête.
  float lambert = max(dot(normal, normalize(uSun)), 0.0);
  float lit = floor(lambert * 4.0) / 4.0;

  // Spéculaire : un petit coup de lumière sur les faces en face du soleil.
  vec3 halfDir = normalize(normalize(uSun) + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 18.0);
  spec = floor(spec * 3.0) / 3.0;
  water += vec3(1.0, 0.94, 0.82) * spec * 0.7;

  water *= 0.78 + lit * 0.52;

  // Scintillement sur les crêtes d'onde, surtout quand on regarde vers le soleil.
  float sparkle = step(0.32, vHeight) * step(0.5, spec) * uSparkle;
  sparkle *= 0.5 + 0.5 * sin(vWorld.x * 0.9 - uTime * 1.2);
  water = mix(water, vec3(0.95, 0.98, 1.0), step(0.55, sparkle) * 0.75);

  // Écume des crêtes et ressac.
  float crest = step(0.38, vHeight) * 0.16;
  float surf = smoothstep(4.2, 0.0, max(edge, 0.0)) * (0.5 + 0.5 * sin(edge * 1.4 - uTime * 1.7));
  float foamAmt = crest + step(0.35, surf) * 0.7;
  water = mix(water, uFoam, foamAmt);

  gl_FragColor = vec4(water, 1.0);
  #include <colorspace_fragment>
}
`;

export function Ocean() {
  const material = useRef<ShaderMaterial>(null);
  const sailToPoint = useWorld((s) => s.sailToPoint);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new Color('#0b3148') },
      uShallow: { value: new Color('#35a0b0') },
      uFoam: { value: new Color('#f7f8e8') },
      uSun: { value: new Vector3(60, 70, 40).normalize() },
      uSkyTop: { value: new Color('#4a8ab0') },
      uSkyHorizon: { value: new Color('#a7d2e6') },
      uCameraPos: { value: new Vector3() },
      uSparkle: { value: 1.0 },
      uShoals: {
        value: [
          new Vector4(homeIsland.position[0], homeIsland.position[1], homeIsland.radius, 0),
          ...islands.map((i) => new Vector4(i.position[0], i.position[1], i.radius, 0)),
        ],
      },
    }),
    [],
  );

  useFrame((state, dt) => {
    if (material.current) {
      material.current.uniforms.uTime.value += dt;
      material.current.uniforms.uCameraPos.value.copy(state.camera.position);
    }
  });

  const onOceanClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    sailToPoint([event.point.x, event.point.z]);
  };

  return (
    <mesh rotation-x={-Math.PI / 2} onClick={onOceanClick} receiveShadow={false}>
      {/* Facettes d'environ 4 mètres : assez grandes pour être lisibles, assez fines
          pour que la houle reste crédible sous le bateau. */}
      <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 104, 104]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={DoubleSide}
      />
    </mesh>
  );
}
