'use client';

import { useMemo, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import { placeIntroCamera } from '@/components/camera/CameraRig';
import { boatState } from '@/lib/boat-state';
import { INTRO_RADIUS_END, INTRO_RING_RADIUS } from '@/lib/cinematic';
import { useWorld } from '@/lib/store';
import { damp } from '@/lib/utils/math';

/**
 * Le seuil du monde : une mer de nuit quadrillée comme une carte marine, et un anneau de
 * lanterne cerclé d'un cadran de compas (graduations tous les 5°, plus longues tous les 30°,
 * cardinaux au-delà ; les lettres N, E, S, O sont posées en DOM par l'intro). L'anneau se
 * remplit avec le chargement réel des modèles et des textures, du nord dans le sens des
 * aiguilles d'une montre, et les graduations s'allument à son passage. Une fois complet, il
 * pulse ; au clic, le cadran s'efface et l'anneau part en onde de choc pour dévoiler
 * l'archipel (le trou transparent suit `introRadius`, la même valeur qui fait surgir les îles).
 *
 * Rendu hors du Suspense de la scène : il est visible dès la première image, pendant que
 * le reste se charge. Avant le clic, il couvre tout (pas de test de profondeur) : rien de la
 * scène ne doit percer la carte ni entamer l'anneau.
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
uniform float uScale;
uniform float uHole;
uniform float uProgress;
uniform float uStart;
uniform float uReady;
uniform float uWave;
uniform float uTime;
uniform float uOpacity;
uniform float uBezel;
uniform float uTicks;
varying vec3 vWorld;

const float TAU = 6.2831853;

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
  float aaR = fwidth(r);
  float s = uScale;

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
  // Rose des vents en filigrane : 16 rhumbs alignés sur le nord du cadran. sin(8θ) est
  // continu à la coupure de atan, et le seuil 0,24/r donne des traits de largeur constante.
  float angle = atan(d.y, d.x);
  float spoke = abs(sin((angle - uStart) * 8.0));
  float rhumb = 1.0 - smoothstep(0.24 / max(r, 1.0), 0.24 / max(r, 1.0) + fwidth(spoke) * 1.2, spoke);
  rhumb *= smoothstep(uRing + 1.6 * s, uRing + 4.2 * s, r) * exp(-r * 0.04) * 0.18;
  vec3 chart = vec3(0.32, 0.5, 0.72);
  color += chart * (lines + crossArm * 0.55 + rhumb) * fade;

  // Progression : l'arc part du nord du cadran (haut de l'écran, côté opposé à la caméra)
  // et tourne dans le sens horaire. Complet, il est fermé partout (aucune couture au nord).
  float around = fract((angle - uStart) / TAU);
  float drawn = uProgress >= 1.0
    ? 1.0
    : (1.0 - smoothstep(uProgress - 0.008, uProgress, around)) * smoothstep(0.0, 0.004, around);
  float ringDistance = abs(r - uRing);
  vec3 lantern = vec3(1.0, 0.82, 0.52);
  vec3 white = vec3(1.0, 0.97, 0.9);

  // Anneau de lanterne : cœur blanc, halo chaud ; la piste restante reste devinable.
  float core = 1.0 - smoothstep(0.03 * s, 0.1 * s + aaR, ringDistance);
  float halo = exp(-ringDistance * 1.6 / max(s, 0.3));
  float pulse = 1.0 + uReady * 0.35 * sin(uTime * 2.4);
  color += mix(lantern, white, core) * (core * mix(0.12, 1.4, drawn) + halo * drawn * 0.3 * pulse);
  // Tête de l'arc pendant le chargement : une étincelle qui avance.
  float headArc = (around - uProgress) * TAU * uRing;
  float head = uProgress < 1.0 ? exp(-headArc * headArc * 3.0 / (s * s)) * exp(-ringDistance * 2.4 / max(s, 0.3)) : 0.0;
  color += mix(lantern, white, 0.6) * head * 1.3;

  // Cadran gravé : uTicks graduations (tous les 5°, ou 10° sur un petit anneau), plus
  // longues tous les 30°, cardinaux au-delà et dorés. Largeurs en mètres (constantes à
  // l'écran quel que soit le rayon) ; les traits s'éclairent au passage de l'arc.
  float rel = around * uTicks;
  float nearest = floor(rel + 0.5);
  float along = abs(rel - nearest) * (TAU / uTicks) * r;
  float mark = mod(nearest, uTicks);
  float major = 1.0 - step(0.05, abs(fract(mark / (uTicks / 12.0) + 0.5) - 0.5));
  float cardinal = 1.0 - step(0.02, abs(fract(mark / (uTicks / 4.0) + 0.5) - 0.5));
  float r0 = uRing + 0.24 * s;
  float r1 = uRing + mix(mix(0.52, 0.74, major), 0.98, cardinal) * s;
  float halfWidth = mix(0.016, 0.026, major) * s;
  float tick = (1.0 - smoothstep(halfWidth, halfWidth + fwidth(along) + 0.0001, along))
    * smoothstep(r0 - aaR, r0 + aaR, r)
    * (1.0 - smoothstep(r1 - aaR, r1 + aaR, r));
  float baseLine = 1.0 - smoothstep(0.008 * s, 0.008 * s + aaR, abs(r - r0));
  float innerLine = 1.0 - smoothstep(0.01 * s, 0.01 * s + aaR, abs(r - (uRing - 0.45 * s)));
  vec3 ink = mix(vec3(0.42, 0.58, 0.78), vec3(0.86, 0.9, 0.95), drawn);
  color += ink * (tick * mix(0.2, 0.6, drawn) * mix(1.0, 1.35, major) + baseLine * mix(0.06, 0.22, drawn) + innerLine * 0.12) * uBezel;
  color += lantern * tick * cardinal * drawn * 0.7 * uBezel;

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
const probe = new Vector3();
const right = new Vector3();
const forward = new Vector3();

/** Débord du cadran au-delà de l'anneau (graduations cardinales), en part du rayon. */
const BEZEL_OVERHANG = 0.98 / INTRO_RING_RADIUS;
/** Place des lettres E et O au-delà des graduations (px), et marge au bord de l'écran. */
const LETTER_ROOM_PX = 20;
const EDGE_MIN_PX = 18;
const EDGE_RATIO = 0.05;

/**
 * Rayon affiché pour un rayon « monde » de la cinématique. Sur un écran étroit (téléphone
 * en portrait), l'anneau est réduit d'un facteur `fit` pour tenir dans la largeur ; pendant
 * le dévoilement, l'écart se résorbe progressivement jusqu'au rayon final (le trou
 * rejoint exactement le cercle qui fait surgir les îles, loin du bateau).
 */
function displayedRadius(radius: number, fit: number) {
  if (fit >= 0.999) return radius;
  if (radius <= INTRO_RING_RADIUS) return radius * fit;
  const start = INTRO_RING_RADIUS * fit;
  return start + ((radius - INTRO_RING_RADIUS) * (INTRO_RADIUS_END - start)) / (INTRO_RADIUS_END - INTRO_RING_RADIUS);
}

export function IntroStage({ mobile }: { mobile: boolean }) {
  const mesh = useRef<Mesh>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const anchorKey = useRef('');
  const material = useRef<ShaderMaterial>(null);
  const shownProgress = useRef(0);
  const fit = useRef(1);
  const size = useThree((state) => state.size);

  const uniforms = useMemo(
    () => ({
      uCenter: { value: new Vector2() },
      uRing: { value: INTRO_RING_RADIUS },
      uScale: { value: 1 },
      uHole: { value: 0 },
      uProgress: { value: 0 },
      uStart: { value: 0 },
      uReady: { value: 0 },
      uWave: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uBezel: { value: 1 },
      uTicks: { value: 72 },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { phase, sceneReady, introCenter, introRadius, gameTransition, reducedMotion } = useWorld.getState();
    const target = mesh.current;
    const shader = material.current;
    if (!target || !shader) return;
    const visible = phase === 'loading' || phase === 'intro' || phase === 'transitioning';
    target.visible = visible;
    if (!visible) return;
    const camera = state.camera;
    const revealing = phase === 'transitioning';

    // Avant le clic, la carte est un écran-titre : elle passe devant tout. Au dévoilement,
    // la profondeur compte de nouveau (le bateau qui tombe passe devant la carte).
    if (shader.depthTest === !revealing) shader.depthTest = revealing;
    target.renderOrder = revealing ? 20 : 1000;

    // Tant que la scène n'est pas montée, c'est ce plan qui tient la caméra d'intro.
    if (!sceneReady) placeIntroCamera(camera, mobile, size.width / Math.max(size.height, 1));

    // Ajustement à l'écran, caméra immobile (hors dévoilement) : l'anneau, son cadran et les
    // lettres E et O gardent une marge de chaque côté, même en portrait où ils déborderaient
    // de la largeur. Le point « à droite » du cercle est à la même profondeur que son
    // centre : sa projection est linéaire en rayon, d'où un simple facteur d'échelle.
    let baseRx = 0;
    if (!revealing) {
      camera.updateMatrixWorld();
      right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      center.set(introCenter[0], 0.06, introCenter[1]).project(camera);
      probe.set(introCenter[0] + right.x * INTRO_RING_RADIUS, 0.06, introCenter[1] + right.z * INTRO_RING_RADIUS).project(camera);
      baseRx = Math.abs(probe.x - center.x) * 0.5 * size.width;
      const room = size.width * 0.5 - Math.max(EDGE_MIN_PX, size.width * EDGE_RATIO) - LETTER_ROOM_PX;
      const maxRx = room / (1 + BEZEL_OVERHANG);
      fit.current = baseRx > 1 ? Math.min(1, Math.max(0.45, maxRx / baseRx)) : 1;
      // Petit anneau (téléphone) : une graduation tous les 10°, sinon le cadran grésille.
      shader.uniforms.uTicks.value = baseRx * fit.current < 230 ? 36 : 72;
    }
    const ring = displayedRadius(introRadius, fit.current);
    const ringRest = INTRO_RING_RADIUS * fit.current;

    // Lu dans le store de drei sans s'y abonner : aucun rendu React par fichier chargé.
    // La jauge avance avec le temps réel (borné) : même à quelques images par seconde
    // (appareil modeste, rendu logiciel), l'anneau se referme bien une fois prêt.
    const loaded = sceneReady ? 1 : Math.min(useProgress.getState().progress / 100, 0.94);
    shownProgress.current = damp(shownProgress.current, loaded, sceneReady ? 7 : 3.2, Math.min(delta, 0.25));
    const u = shader.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCenter.value.set(introCenter[0], introCenter[1]);
    target.position.set(introCenter[0], 0.06, introCenter[1]);
    u.uProgress.value = shownProgress.current > 0.995 ? 1 : shownProgress.current;
    u.uStart.value = boatState.heading;
    // L'anneau prêt respire doucement (immobile si le visiteur réduit les animations).
    u.uReady.value = damp(u.uReady.value, phase === 'intro' && !reducedMotion ? 1 : 0, 3, dt);
    u.uBezel.value = damp(u.uBezel.value, revealing ? 0 : 1, revealing ? 9 : 3, dt);
    u.uScale.value = fit.current;
    u.uRing.value = Math.max(ringRest, ring);
    u.uHole.value = revealing ? ring : 0;
    u.uWave.value = revealing ? Math.sin(Math.min(gameTransition * 1.6, 1) * Math.PI) : 0;
    // La carte s'efface à la fin du dévoilement.
    u.uOpacity.value = revealing ? 1 - Math.max(0, (gameTransition - 0.82) / 0.18) : 1;

    // Ancre DOM : le texte d'intro se place au centre VISUEL de l'ellipse (milieu entre
    // ses bords proche et lointain, pas le centre projeté du cercle), avec ses deux
    // demi-axes en variables CSS pour que le texte et les lettres du cadran suivent.
    if (revealing) return;
    if (!anchor.current?.isConnected) {
      anchor.current = document.getElementById('intro-anchor');
      anchorKey.current = '';
    }
    if (!anchor.current) return;
    forward.setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize().negate();
    probe.set(introCenter[0] + forward.x * ringRest, 0.06, introCenter[1] + forward.z * ringRest).project(camera);
    const far = (-probe.y * 0.5 + 0.5) * size.height;
    probe.set(introCenter[0] - forward.x * ringRest, 0.06, introCenter[1] - forward.z * ringRest).project(camera);
    const near = (-probe.y * 0.5 + 0.5) * size.height;
    const x = (center.x * 0.5 + 0.5) * size.width;
    const y = (far + near) * 0.5;
    const rx = baseRx * fit.current;
    const ry = Math.abs(near - far) * 0.5;
    const key = `${x.toFixed(1)}|${y.toFixed(1)}|${rx.toFixed(1)}|${ry.toFixed(1)}`;
    if (key === anchorKey.current) return;
    anchorKey.current = key;
    anchor.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    anchor.current.style.setProperty('--ring-rx', `${rx.toFixed(1)}px`);
    anchor.current.style.setProperty('--ring-ry', `${ry.toFixed(1)}px`);
    anchor.current.setAttribute('data-placed', '');
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[1600, 1600]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
