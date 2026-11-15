'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CylinderGeometry, DoubleSide, type Group, type MeshBasicMaterial } from 'three';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { windowMaterial } from '@/lib/windows';
import type { Project } from '@/types';
import { Hotspot } from '../../kit';
import { Maquette } from './builder';
import { TOWN, sitePosition, siteRotation } from './layout';
import { glass, glow, paint } from './materials';
import { Screen } from './Screens';
import { Plaque, SignText, signFrame } from './signs';
import { CURB } from './Town';

/**
 * 03 — CLARTEN MÉDICAL, le centre médical futuriste : une rotonde blanche à bandeaux
 * vitrés, une croix verte qui tourne sur le toit, et devant, une salle de démonstration
 * en verre — un scanner dont le lit glisse lentement, un moniteur qui affiche le site,
 * et une petite interface en hologramme (elle s'emballe quand on la survole).
 */

const TEAL = '#3fd0b0';
const GREEN = '#2bb673';
const WHITE = '#f6f8f8';
const FRAME = '#dfe7ea';

const [SX, SZ] = sitePosition('medical');
const RY = siteRotation('medical');

const R = 2.2;
/** Salle de démonstration vitrée (devant la rotonde, côté place). */
const ROOM = { x0: -2.6, x1: 0.2, z0: 1.25, z1: 3.25, h: 2.3 };
const SCANNER = { x: -1.55, z: 2.05 };
const HOLO = { x: -0.4, z: 2.75 };

function buildMedical() {
  const m = new Maquette();
  const lights = new Maquette();
  const panes = new Maquette();

  // Parvis rond et allée vers la salle vitrée.
  m.cylinder(R + 0.9, R + 0.9, CURB - 0.012, [0, (CURB - 0.012) / 2, 0], '#e9e1d0', 32, [0, 0, 0], 0.03);
  m.block(ROOM.x0 - 0.35, 0, ROOM.z0 - 0.4, ROOM.x1 + 0.35, CURB - 0.01, ROOM.z1 + 0.45, '#e9e1d0', 0.03);

  // Rotonde : socle, rez-de-chaussée, bandeau de dalle teal, étage en retrait, toit.
  m.cylinder(R + 0.12, R + 0.18, 0.18, [0, 0.09, 0], '#cfd8db', 32);
  m.cylinder(R, R, 1.75, [0, 0.18 + 0.875, 0], WHITE, 32);
  m.cylinder(R + 0.1, R + 0.1, 0.16, [0, 2.0, 0], TEAL, 32);
  m.cylinder(R - 0.18, R - 0.18, 1.6, [0, 2.08 + 0.8, 0], WHITE, 32);
  m.cylinder(R, R - 0.05, 0.18, [0, 3.77, 0], WHITE, 32);
  lights.torus(R + 0.005, 0.03, [0, 3.69, 0], TEAL, [Math.PI / 2, 0, 0], 48);
  // Coupole vitrée et mât de la croix.
  m.cylinder(1.0, 1.05, 0.12, [0, 3.92, 0], '#cfd8db', 24);
  panes.dome(0.9, [0, 3.98, 0], '#ffffff', 20);
  m.rod([1.25, 3.86, -0.6], [1.25, 5.0, -0.6], 0.05, '#b8c4c8');
  // Entrée : auvent courbe et porte vitrée, côté place.
  m.box([1.5, 0.08, 0.9], [0.85, 1.95, R + 0.3], WHITE, [0, 0.35, 0]);
  lights.box([1.3, 0.025, 0.05], [0.85, 1.9, R + 0.72], '#e6fffa', [0, 0.35, 0]);

  // Salle de démonstration : sol, ossature blanche, verre, toit vitré.
  const { x0, x1, z0, z1, h } = ROOM;
  m.block(x0, 0.08, z0, x1, 0.2, z1, '#f0f3f3');
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) m.block(px - 0.06, 0.2, pz - 0.06, px + 0.06, h, pz + 0.06, FRAME);
  m.block(x0 - 0.08, h, z0 - 0.08, x1 + 0.08, h + 0.12, z1 + 0.08, WHITE);
  lights.block(x0 - 0.08, h + 0.02, z1 + 0.08, x1 + 0.08, h + 0.08, z1 + 0.1, TEAL);
  panes.box([x1 - x0, h - 0.2, 0.02], [(x0 + x1) / 2, (h + 0.2) / 2, z1], '#ffffff');
  panes.box([0.02, h - 0.2, z1 - z0], [x0, (h + 0.2) / 2, (z0 + z1) / 2], '#ffffff');
  panes.box([0.02, h - 0.2, z1 - z0], [x1, (h + 0.2) / 2, (z0 + z1) / 2], '#ffffff');

  // Scanner : anneau vertical sur son socle, rail du lit.
  m.block(SCANNER.x - 0.32, 0.2, SCANNER.z - 0.28, SCANNER.x + 0.32, 0.45, SCANNER.z + 0.28, '#d5dee2');
  m.torus(0.5, 0.17, [SCANNER.x, 0.98, SCANNER.z], '#fbfdfd', [0, Math.PI / 2, 0], 28);
  lights.torus(0.33, 0.025, [SCANNER.x + 0.18, 0.98, SCANNER.z], TEAL, [0, Math.PI / 2, 0], 28);
  m.block(SCANNER.x - 0.95, 0.2, SCANNER.z - 0.12, SCANNER.x + 0.95, 0.62, SCANNER.z + 0.12, '#c7d2d6');
  // Moniteur sur pied et socle de l'hologramme.
  m.block(-0.5, 0.2, z0 + 0.12, -0.44, 1.05, z0 + 0.18, '#b8c4c8');
  m.box([1.12, 0.72, 0.06], [-0.47, 1.4, z0 + 0.2], '#2b3036');
  m.cylinder(0.26, 0.32, 0.75, [HOLO.x, 0.2 + 0.375, HOLO.z], WHITE, 16);
  lights.torus(0.22, 0.025, [HOLO.x, 0.97, HOLO.z], TEAL, [Math.PI / 2, 0, 0], 20);

  // Petit jardin : jardinières teal, banc.
  for (const [bx, bz] of [[1.9, 2.6], [2.5, 1.6]]) {
    m.box([0.9, 0.38, 0.45], [bx, 0.19, bz], TEAL, [0, 0.6, 0]);
    m.sphere(0.32, [bx, 0.55, bz], '#5c9a4c', 1, [1.3, 0.7, 0.8]);
  }
  return { body: m.build(), lights: lights.build(), panes: panes.build() };
}

/** Bandeaux vitrés courbes (ils s'allument au crépuscule, comme les fenêtres). */
function ribbonGeometry(radius: number, height: number) {
  return new CylinderGeometry(radius, radius, height, 40, 1, true, -0.6, Math.PI * 2 - 1.2);
}

const HOLO_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function Medical({ project }: { project: Project }) {
  const parts = useMemo(() => buildMedical(), []);
  const ribbons = useMemo(() => ({ low: ribbonGeometry(R + 0.012, 0.7), high: ribbonGeometry(R - 0.168, 0.75) }), []);
  const ribbonMaterial = useMemo(() => windowMaterial(31, '#e6fff9', '#5fa8c2'), []);
  const sign = useMemo(() => {
    const m = new Maquette();
    const text = signFrame(m, [1.0, CURB, 3.35], 0.2, 1.9, 1.05);
    return { geometry: m.build(), text };
  }, []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.lights.dispose();
      parts.panes.dispose();
      ribbons.low.dispose();
      ribbons.high.dispose();
      sign.geometry.dispose();
    },
    [parts, ribbons, sign],
  );

  const cross = useRef<Group>(null);
  const bed = useRef<Group>(null);
  const holo = useRef<Group>(null);
  const holoMaterial = useRef<MeshBasicMaterial>(null);
  const hovered = useRef(false);
  const spin = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    if (cross.current) cross.current.rotation.y = t * 0.6;
    // Le lit entre dans l'anneau, marque une pause, ressort.
    if (bed.current) {
      const cycle = (t % 9) / 9;
      const slide = cycle < 0.35 ? cycle / 0.35 : cycle < 0.6 ? 1 : cycle < 0.95 ? 1 - (cycle - 0.6) / 0.35 : 0;
      const eased = slide * slide * (3 - 2 * slide);
      bed.current.position.x = SCANNER.x - 0.55 + eased * 0.95;
    }
    if (holo.current) {
      spin.current += dt * (hovered.current ? 3.2 : 0.8);
      holo.current.rotation.y = spin.current;
      holo.current.position.y = 1.45 + Math.sin(t * 1.6) * 0.04;
    }
    if (holoMaterial.current) holoMaterial.current.opacity = (0.5 + skyState.dayNight * 0.35) * (hovered.current ? 1.4 : 1);
  });

  return (
    <Hotspot onActivate={() => focusItem('projects', project.id)} hoverScale={1.04} position={[SX, TOWN.level, SZ]} rotation={[0, RY, 0]}>
      <group
        onPointerOver={() => {
          hovered.current = true;
        }}
        onPointerOut={() => {
          hovered.current = false;
        }}
      >
        <mesh geometry={parts.body} material={paint} castShadow receiveShadow />
        <mesh geometry={parts.lights} material={glow} />
        <mesh geometry={parts.panes} material={glass} />
        <mesh geometry={ribbons.low} material={ribbonMaterial} position-y={1.15} raycast={() => null} />
        <mesh geometry={ribbons.high} material={ribbonMaterial} position-y={2.95} raycast={() => null} />
        {/* Écran de la salle : la page d'accueil du site. */}
        <Screen width={1.02} height={0.64} url={project.screenshots?.[0]} fallback="clinic" position={[-0.47, 1.4, ROOM.z0 + 0.235]} />
        {/* Lit du scanner. */}
        <group ref={bed} position={[SCANNER.x - 0.55, 0.66, SCANNER.z]}>
          <mesh castShadow>
            <boxGeometry args={[1.25, 0.08, 0.36]} />
            <meshStandardMaterial color="#fbfdfd" roughness={0.5} />
          </mesh>
          <mesh position={[-0.5, 0.07, 0]}>
            <boxGeometry args={[0.22, 0.06, 0.3]} />
            <meshStandardMaterial color={TEAL} roughness={0.6} />
          </mesh>
        </group>
        {/* Hologramme : un objet en fil de fer qui tourne et trois panneaux d'interface. */}
        <group ref={holo} position={[HOLO.x, 1.45, HOLO.z]}>
          <mesh raycast={() => null}>
            <icosahedronGeometry args={[0.24, 1]} />
            <meshBasicMaterial ref={holoMaterial} color={TEAL} wireframe transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {[0, 1, 2].map((index) => (
            <mesh key={index} position={[Math.cos((index * Math.PI * 2) / 3) * 0.48, 0.05, Math.sin((index * Math.PI * 2) / 3) * 0.48]} rotation-y={-((index * Math.PI * 2) / 3) + Math.PI / 2} raycast={() => null}>
              <planeGeometry args={[0.32, 0.22]} />
              <shaderMaterial
                vertexShader={HOLO_VERTEX}
                fragmentShader={HOLO_PANEL}
                transparent
                depthWrite={false}
                blending={AdditiveBlending}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
        <mesh position={[HOLO.x, 1.0, HOLO.z]} raycast={() => null}>
          <cylinderGeometry args={[0.32, 0.2, 0.42, 20, 1, true]} />
          <meshBasicMaterial color={TEAL} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
        {/* Croix verte qui tourne sur le toit. */}
        <group ref={cross} position={[1.25, 5.35, -0.6]}>
          <CrossMesh />
        </group>
        <Plaque index={project.index} accent={project.accent} size={0.72} position={[-1.2, ROOM.h + 0.55, ROOM.z1 + 0.02]} />
        <mesh position={[-1.2, ROOM.h + 0.36, ROOM.z1 - 0.02]} raycast={() => null}>
          <boxGeometry args={[0.1, 0.4, 0.06]} />
          <meshStandardMaterial color={FRAME} roughness={0.6} />
        </mesh>
        <mesh geometry={sign.geometry} material={paint} castShadow />
        <SignText lines={[project.title]} accent={project.accent} width={1.9} position={sign.text} rotation={[0, 0.2, 0]} />
      </group>
    </Hotspot>
  );
}

/** Interface holographique : cadre, barres et courbe (aucun texte ni chiffre). */
const HOLO_PANEL = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv;
  float frame = step(p.x, 0.04) + step(0.96, p.x) + step(p.y, 0.06) + step(0.94, p.y);
  float bars = step(0.15, p.x) * step(p.x, 0.55) * step(0.5, fract(p.y * 5.0)) * step(p.y, 0.8) * step(0.2, p.y);
  float curve = 1.0 - smoothstep(0.0, 0.05, abs(p.y - (0.45 + 0.25 * sin(p.x * 9.0))));
  curve *= step(0.6, p.x) * step(p.x, 0.92);
  float a = clamp(frame * 0.9 + bars * 0.5 + curve * 0.9 + 0.12, 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.35, 1.0, 0.85) * a, a * 0.85);
  #include <colorspace_fragment>
}
`;

function CrossMesh() {
  const geometry = useMemo(() => {
    const m = new Maquette();
    m.box([0.24, 0.72, 0.16], [0, 0, 0], GREEN);
    m.box([0.72, 0.24, 0.16], [0, 0, 0], GREEN);
    return m.build();
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={glow} castShadow />;
}
