'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { logbook, useLogbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { voyage } from '@/lib/voyage';
import { hash } from '@/lib/utils/math';

/**
 * Le guetteur du carnet (tampons « nuit » et « mer interdite ») et le feu d'artifice
 * tiré au-dessus du bateau quand le carnet est complet. Le feu d'artifice est un seul
 * nuage de points animé sur le GPU : fusées qui montent, gerbes qui éclatent, retombée
 * scintillante sous la gravité.
 */

const SHELLS = 9;
const SPARKS = 110;
const SHOW_LENGTH = 11;

const PALETTE: [number, number, number][] = [
  [1.0, 0.45, 0.32],
  [1.0, 0.82, 0.35],
  [0.42, 0.86, 1.0],
  [0.95, 0.5, 0.95],
  [0.55, 1.0, 0.6],
];

function fireworksGeometry() {
  const count = SHELLS * SPARKS;
  const shell = new Float32Array(count * 4);
  const direction = new Float32Array(count * 3);
  for (let s = 0; s < SHELLS; s++) {
    const angle = (s / SHELLS) * Math.PI * 2 + hash(s * 3.1) * 0.8;
    const reach = 6 + hash(s * 5.7) * 14;
    for (let p = 0; p < SPARKS; p++) {
      const index = s * SPARKS + p;
      // Départ (x, z), délai, rang de couleur.
      shell.set([Math.cos(angle) * reach, Math.sin(angle) * reach, s * 1.05 + hash(s * 7.9) * 0.5, s % PALETTE.length], index * 4);
      // Direction uniforme sur la sphère : la gerbe est ronde.
      const u = hash(index * 1.37) * 2 - 1;
      const phi = hash(index * 2.71) * Math.PI * 2;
      const ring = Math.sqrt(1 - u * u);
      const speed = 0.75 + hash(index * 4.13) * 0.25;
      direction.set([ring * Math.cos(phi) * speed, u * speed, ring * Math.sin(phi) * speed], index * 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aShell', new BufferAttribute(shell, 4));
  geometry.setAttribute('aDirection', new BufferAttribute(direction, 3));
  return geometry;
}

const vertexShader = /* glsl */ `
attribute vec4 aShell;
attribute vec3 aDirection;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uColors[5];
varying vec3 vColor;
varying float vAlpha;

void main() {
  float t = uTime - aShell.z;
  vec3 base = uCenter + vec3(aShell.x, 0.0, aShell.y);
  float burstHeight = 26.0 + fract(aShell.z * 3.7) * 10.0;
  vec3 position3;
  float size;
  vAlpha = 0.0;
  if (t < 0.0) {
    position3 = base;
    size = 0.0;
  } else if (t < 1.1) {
    // Montée de la fusée : toutes les étincelles de la gerbe groupées.
    float rise = 1.0 - pow(1.0 - t / 1.1, 2.0);
    position3 = base + vec3(0.0, burstHeight * rise, 0.0);
    size = 2.6;
    vAlpha = 0.9;
  } else {
    // Éclat puis retombée : freinage de l'air et gravité.
    float k = t - 1.1;
    float spread = (1.0 - exp(-k * 2.6)) * 13.0;
    position3 = base + vec3(0.0, burstHeight, 0.0) + aDirection * spread - vec3(0.0, k * k * 2.2, 0.0);
    float life = clamp(1.0 - k / 2.4, 0.0, 1.0);
    float twinkle = 0.65 + 0.35 * sin(k * 28.0 + aDirection.x * 40.0);
    size = 3.4 * life + 0.6;
    vAlpha = life * twinkle;
  }
  int colorIndex = int(aShell.w + 0.5);
  vColor = uColors[colorIndex];
  vec4 view = viewMatrix * vec4(position3, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = size * (220.0 / max(-view.z, 1.0));
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float glow = exp(-d * d * 18.0);
  if (glow * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor * glow * vAlpha * 2.2, glow * vAlpha);
  #include <colorspace_fragment>
}
`;

export function Celebration() {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const showStart = useRef(-100);
  const wasComplete = useRef<boolean | null>(null);
  const pops = useRef(0);
  const geometry = useMemo(() => fireworksGeometry(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: -100 },
      uCenter: { value: new Vector3() },
      uColors: { value: PALETTE.map(([r, g, b]) => new Vector3(r, g, b)) },
    }),
    [],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    const sailing = phase === 'playing' || phase === 'docked';

    // Journal de route (carte de voyage) et tampons d'exploration.
    if (sailing) voyage.record(boatState.position.x, boatState.position.z);
    if (sailing && skyState.dayNight > 0.6 && boatState.speed > 1.5) logbook.stamp('night');
    if (sailing && ecologyState.boundaryWarning > 0.35) logbook.stamp('edge');

    // Carnet complété pendant la visite : feu d'artifice au-dessus du bateau.
    const complete = logbook.complete();
    if (wasComplete.current === null) wasComplete.current = complete || !useLogbook.getState().hydrated;
    if (complete && !wasComplete.current) {
      showStart.current = time;
      pops.current = 0;
      material.current?.uniforms.uCenter.value.set(boatState.position.x, 0, boatState.position.z);
    }
    wasComplete.current = complete;

    const elapsed = time - showStart.current;
    const live = elapsed >= 0 && elapsed < SHOW_LENGTH;
    if (points.current) points.current.visible = live;
    if (!live || !material.current) return;
    material.current.uniforms.uTime.value = elapsed;
    // Un « pop » par gerbe, au moment de l'éclat.
    const due = Math.floor((elapsed - 1.1) / 1.05) + 1;
    if (due > pops.current && pops.current < SHELLS) {
      pops.current = due;
      ambience.bump('soft', 0.9);
      ambience.chime([392 + (pops.current % 3) * 98, 784], 0.04);
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false} renderOrder={12}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
