'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { skillZoneById, skillZones } from '@/data/skills';
import { skyState } from '@/lib/sky';
import type { SkillZoneId } from '@/types';
import type { SceneProps } from '../../kit';
import { Grounds } from './Grounds';
import { Hub } from './Hub';
import { zoneSpot } from './layout';
import { labState, updateLabMaterials } from './materials';
import { AIZone } from './zones/AI';
import { BackZone } from './zones/Back';
import { CommerceZone } from './zones/Commerce';
import { FrontZone } from './zones/Front';
import { Lab3DZone } from './zones/Lab3D';
import { TowerZone } from './zones/Tower';

/**
 * ÎLE COMPÉTENCES — le laboratoire technologique.
 *
 * Six zones-dioramas en couronne (une par domaine de `data/skills.ts`), chacune sur sa
 * dalle à sa couleur, avec son panneau et ses boucles animées ; un clic sur une zone
 * ouvre le carnet directement sur elle. Au centre, le Noyau relie tout par des allées
 * parcourues de lignes de lumière. Plan et relief : layout.ts / config.ts.
 */
export default function Scene({ island, sampler }: SceneProps) {
  const accents = useMemo(
    () => Object.fromEntries(skillZones.map((zone) => [zone.id, zone.accent])) as Record<SkillZoneId, string>,
    [],
  );

  useFrame((state) => {
    updateLabMaterials(state.clock.elapsedTime, skyState.dayNight);
    // Loin de l'île, les boucles des zones se figent (rien ne se voit à cette distance).
    const dx = state.camera.position.x - island.position[0];
    const dz = state.camera.position.z - island.position[1];
    labState.awake = dx * dx + dz * dz < 135 * 135;
  });

  return (
    <>
      <Hub accent={island.accent} accents={accents} />
      <Grounds sampler={sampler} accents={accents} islandAccent={island.accent} />
      <FrontZone zone={skillZoneById.front} spot={zoneSpot.front} />
      <BackZone zone={skillZoneById.back} spot={zoneSpot.back} />
      <CommerceZone zone={skillZoneById.commerce} spot={zoneSpot.commerce} />
      <Lab3DZone zone={skillZoneById.lab3d} spot={zoneSpot.lab3d} />
      <AIZone zone={skillZoneById.ai} spot={zoneSpot.ai} />
      <TowerZone zone={skillZoneById.tower} spot={zoneSpot.tower} />
    </>
  );
}
