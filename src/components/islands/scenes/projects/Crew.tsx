'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type InstancedMesh } from 'three';
import { Maquette, type V3 } from './builder';
import { paint } from './materials';

/**
 * Les travailleurs de la ville : de petits personnages de jouet (casque, gilet, pantalon de
 * travail). Le corps d'un personnage immobile est fusionné dans la maquette de son
 * bâtiment ; seuls les bras droits bougent — tous ceux d'une équipe dans UN maillage
 * instancié (un draw call par équipe, aucune allocation par image).
 */

export interface Outfit {
  shirt: string;
  pants?: string;
  /** Casque de chantier (ou coiffe) ; absent : tête nue. */
  hat?: string;
  skin?: string;
}

/** Épaule droite, dans le repère du personnage (face +Z). */
const SHOULDER: V3 = [0.17, 0.66, 0];
const SKIN = '#f2c9a0';

/** Ajoute le corps d'un personnage (sans le bras droit) debout en `at`, face +Z tournée de `ry`. */
export function addFigure(m: Maquette, at: V3, ry: number, outfit: Outfit, rightArm = false) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const p = (x: number, y: number, z: number): V3 => [at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c];
  const pants = outfit.pants ?? '#34405a';
  const skin = outfit.skin ?? SKIN;
  m.cylinder(0.055, 0.062, 0.27, p(-0.065, 0.135, 0), pants, 6);
  m.cylinder(0.055, 0.062, 0.27, p(0.065, 0.135, 0), pants, 6);
  m.cylinder(0.125, 0.15, 0.42, p(0, 0.47, 0), outfit.shirt, 8);
  m.rod(p(-0.17, 0.66, 0), p(-0.21, 0.37, 0.03), 0.038, outfit.shirt, 5);
  m.sphere(0.045, p(-0.21, 0.35, 0.03), skin, 0);
  if (rightArm) {
    m.rod(p(0.17, 0.66, 0), p(0.21, 0.37, 0.03), 0.038, outfit.shirt, 5);
    m.sphere(0.045, p(0.21, 0.35, 0.03), skin, 0);
  }
  m.sphere(0.13, p(0, 0.83, 0), skin, 1);
  if (outfit.hat) {
    m.dome(0.145, p(0, 0.87, 0), outfit.hat, 10);
    m.cylinder(0.17, 0.17, 0.022, p(0, 0.872, 0.025), outfit.hat, 10);
  }
}

/** Bras droit qui pend de l'épaule (pivot à l'origine), un outil à la main (pointé vers +Z). */
function armGeometry(sleeve: string, tool: string) {
  const m = new Maquette();
  m.cylinder(0.04, 0.036, 0.3, [0, -0.15, 0], sleeve, 6);
  m.sphere(0.045, [0, -0.31, 0], SKIN, 0);
  m.rod([0, -0.31, -0.04], [0, -0.31, 0.24], 0.016, '#7a5236', 4);
  m.box([0.07, 0.07, 0.12], [0, -0.31, 0.27], tool);
  return m.build();
}

export type Gesture = 'hammer' | 'paint' | 'weld' | 'wave';

export interface CrewMember {
  at: V3;
  ry: number;
  gesture: Gesture;
  phase?: number;
}

const body = new Object3D();
const arm = new Object3D();

/** Levée lente, frappe sèche. */
function hammer(beat: number) {
  if (beat < 0.68) {
    const u = beat / 0.68;
    return -0.55 - 1.85 * u * u * (3 - 2 * u);
  }
  return -2.4 + 1.85 * Math.sqrt((beat - 0.68) / 0.32);
}

/** Bras droits animés d'une équipe (tous les gestes, un seul maillage). */
export function CrewArms({ members, sleeve, tool = '#5d646e' }: { members: CrewMember[]; sleeve: string; tool?: string }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => armGeometry(sleeve, tool), [sleeve, tool]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const target = mesh.current;
    if (!target) return;
    const t = state.clock.elapsedTime;
    members.forEach((member, index) => {
      const phase = member.phase ?? index * 0.37;
      let pitch = 0;
      let roll = 0;
      if (member.gesture === 'hammer') pitch = hammer((t * 1.35 + phase) % 1);
      else if (member.gesture === 'paint') pitch = -2.0 + Math.sin(t * 2.3 + phase * 6) * 0.45;
      else if (member.gesture === 'weld') pitch = -1.3 + Math.sin(t * 13 + phase) * 0.025;
      else {
        // Salut : bras levé qui balance de côté, puis repos quelques secondes.
        const cycle = (t * 0.22 + phase) % 1;
        const up = cycle < 0.4 ? Math.sin((cycle / 0.4) * Math.PI) : 0;
        pitch = -0.15 - up * 2.75;
        roll = up * (0.35 + Math.sin(t * 7) * 0.35);
      }
      body.position.set(member.at[0], member.at[1], member.at[2]);
      body.rotation.set(0, member.ry, 0);
      body.updateMatrix();
      arm.position.set(SHOULDER[0], SHOULDER[1], SHOULDER[2]);
      arm.rotation.set(pitch, 0, roll);
      arm.updateMatrix();
      arm.matrix.premultiply(body.matrix);
      target.setMatrixAt(index, arm.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, paint, members.length]} castShadow frustumCulled={false} raycast={() => null} />;
}

/** Personnage entier (deux bras) centré à l'origine, pour ceux qui se déplacent. */
export function figureGeometry(outfit: Outfit, extra?: (m: Maquette) => void) {
  const m = new Maquette();
  addFigure(m, [0, 0, 0], 0, outfit, true);
  extra?.(m);
  return m.build();
}
