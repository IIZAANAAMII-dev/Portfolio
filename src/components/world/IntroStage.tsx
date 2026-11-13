'use client';

import { useMemo, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import { placeIntroCamera } from '@/components/camera/CameraRig';
import { boatState } from '@/lib/boat-state';
import { INTRO_RING_RADIUS } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';

/**
 * Le seuil du monde : une mer de nuit quadrillée comme une carte marine, et un anneau de
 * lanterne qui se remplit avec le chargement réel des modèles et des textures. Une fois
 * complet, il pulse ; au clic, il part en onde de choc et dévoile l'archipel (le trou
 * transparent suit `introRadius`, la même valeur qui fait surgir les îles).
 *
 * Rendu hors du Suspense de la scène : il est visible dès la première image, pendant que
 * le reste se charge.
 */
const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform vec2 uCenter;
uniform float uRing;
uniform float uHole;
uniform float uProgress;
uniform float uStart;
uniform float uReady;
uniform float uWave;
uniform float uTime;
uniform float uOpacity;
varying vec3 vWorld;

// Distance (en mètres) à la ligne la plus proche d'une grille de pas « step », anticrénelée.
float gridLine(vec2 p, float step, float width) {
  vec2 cell = abs(fract(p / step - 0.5) - 0.5) * step;
  vec2 aa = fwidth(p) * 1.2;
  vec2 line = 1.0 - smoothstep(vec2(width), vec2(width) + aa, cell);
  return max(line.x, line.y);
}

void main() {
  vec2 d = vWorld.xz - uCenter;
  float r = length(d);

  // Mer de nuit, un peu plus claire autour de l'anneau.
  vec3 color = mix(vec3(0.01, 0.018, 0.034), vec3(0.026, 0.048, 0.085), exp(-r * 0.05));

  // Carte marine : méridiens et parallèles fins, croix de relèvement aux intersections.
  float fade = exp(-r * 0.018);
  float lines = gridLine(vWorld.xz, 8.0, 0.025) * 0.22;
  vec2 cell = abs(fract(vWorld.xz / 8.0 - 0.5) - 0.5) * 8.0;
  vec2 aa = fwidth(vWorld.xz) * 1.2;
  float crossArm = max(
    (1.0 - smoothstep(0.035, 0.035 + aa.x, cell.x)) * (1.0 - smoothstep(0.45, 0.45 + aa.y, cell.y)),
    (1.0 - smoothstep(0.035, 0.035 + aa.y, cell.y)) * (1.0 - smoothstep(0.45, 0.45 + aa.x, cell.x))
  );
  // Rose des vents en filigrane : 16 rhumbs autour de l'anneau. sin(8θ) est continu à la
  // coupure de atan, et le seuil 0,24/r donne des traits de largeur constante en mètres.
  float angle = atan(d.y, d.x);
  float spoke = abs(sin(angle * 8.0));
  float rhumb = 1.0 - smoothstep(0.24 / max(r, 1.0), 0.24 / max(r, 1.0) + fwidth(spoke) * 1.2, spoke);
  rhumb *= smoothstep(uRing + 1.5, uRing + 4.0, r) * exp(-r * 0.04) * 0.18;
  vec3 chart = vec3(0.32, 0.5, 0.72);
  color += chart * (lines + crossArm * 0.55 + rhumb) * fade;

  // Anneau de lanterne : l'arc part du haut de l'écran (côté opposé à la caméra) et tourne
  // dans le sens horaire ; sa tête est adoucie, la piste restante reste devinable.
  float around = fract((angle - uStart) / 6.28318);
  float drawn = (1.0 - smoothstep(uProgress - 0.012, uProgress, around))
    * (uProgress >= 1.0 ? 1.0 : smoothstep(0.0, 0.012, around));
  float ringDistance = abs(r - uRing);
  float core = 1.0 - smoothstep(0.03, 0.12 + fwidth(r), ringDistance);
  float halo = exp(-ringDistance * 1.6);
  float pulse = 1.0 + uReady * 0.45 * sin(uTime * 2.6);
  vec3 lantern = vec3(1.0, 0.82, 0.52);
  vec3 white = vec3(1.0, 0.97, 0.9);
  color += mix(lantern, white, core) * (core * mix(0.08, 1.4, drawn) + halo * drawn * 0.32 * pulse);
  // Onde de choc du dévoilement : plus large, plus vive.
  color += lantern * exp(-ringDistance * 0.55) * uWave * 0.45;

  // Au loin, la carte se fond dans la nuit (la couleur du fond de scène) : pas d'horizon.
  color = mix(color, vec3(0.0006, 0.0012, 0.0024), smoothstep(28.0, 150.0, r));

  // Le monde apparaît dans le cercle ; dehors, la carte reste.
  float alpha = smoothstep(uHole - 3.5, uHole, r) * uOpacity;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const center = new Vector3();
const edge = new Vector3();
const right = new Vector3();

export function IntroStage({ mobile }: { mobile: boolean }) {
  const mesh = useRef<Mesh>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const anchorKey = useRef('');
  const material = useRef<ShaderMaterial>(null);
  const shownProgress = useRef(0);
  const size = useThree((state) => state.size);

  const uniforms = useMemo(
    () => ({
      uCenter: { value: new Vector2() },
      uRing: { value: INTRO_RING_RADIUS },
      uHole: { value: 0 },
      uProgress: { value: 0 },
      uStart: { value: 0 },
      uReady: { value: 0 },
      uWave: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { phase, sceneReady, introCenter, introRadius, gameTransition } = useWorld.getState();
    const target = mesh.current;
    const shader = material.current;
    if (!target || !shader) return;
    const visible = phase === 'loading' || phase === 'intro' || phase === 'transitioning';
    target.visible = visible;
    if (!visible) return;

    // Tant que la scène n'est pas montée, c'est ce plan qui tient la caméra d'intro.
    if (!sceneReady) placeIntroCamera(state.camera, mobile, size.width / Math.max(size.height, 1));

    // Lu dans le store de drei sans s'y abonner : aucun rendu React par fichier chargé.
    const loaded = sceneReady ? 1 : Math.min(useProgress.getState().progress / 100, 0.94);
    shownProgress.current = damp(shownProgress.current, loaded, 3.2, dt);
    const u = shader.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCenter.value.set(introCenter[0], introCenter[1]);
    target.position.set(introCenter[0], 0.06, introCenter[1]);
    u.uProgress.value = shownProgress.current > 0.995 ? 1.02 : shownProgress.current;
    u.uStart.value = boatState.heading;
    u.uReady.value = damp(u.uReady.value, phase === 'intro' ? 1 : 0, 3, dt);
    u.uRing.value = Math.max(INTRO_RING_RADIUS, introRadius);
    u.uHole.value = phase === 'transitioning' ? introRadius : 0;
    u.uWave.value = phase === 'transitioning' ? Math.sin(Math.min(gameTransition * 1.6, 1) * Math.PI) : 0;
    // La carte s'efface à la fin du dévoilement.
    u.uOpacity.value = phase === 'transitioning' ? 1 - Math.max(0, (gameTransition - 0.82) / 0.18) : 1;

    // Ancre DOM : le texte d'intro se place au centre de l'anneau, quel que soit l'écran.
    if (phase === 'transitioning') return;
    if (!anchor.current?.isConnected) anchor.current = document.getElementById('intro-anchor');
    if (!anchor.current) return;
    state.camera.updateMatrixWorld();
    center.set(introCenter[0], 0.06, introCenter[1]).project(state.camera);
    right.setFromMatrixColumn(state.camera.matrixWorld, 0).setY(0).normalize().multiplyScalar(INTRO_RING_RADIUS);
    edge.set(introCenter[0] + right.x, 0.06, introCenter[1] + right.z).project(state.camera);
    const x = (center.x * 0.5 + 0.5) * size.width;
    const y = (-center.y * 0.5 + 0.5) * size.height;
    const rx = Math.abs(edge.x - center.x) * 0.5 * size.width;
    const key = `${x.toFixed(1)}|${y.toFixed(1)}|${rx.toFixed(1)}`;
    if (key === anchorKey.current) return;
    anchorKey.current = key;
    anchor.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    anchor.current.style.setProperty('--ring-rx', `${rx.toFixed(1)}px`);
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={20} frustumCulled={false}>
      <planeGeometry args={[1600, 1600]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
