'use client';

import { useFrame } from '@react-three/fiber';
import { projects } from '@/data/projects';
import { focusItem } from '@/lib/focus';
import { skyState } from '@/lib/sky';
import { updateWindows } from '@/lib/windows';
import type { Project } from '@/types';
import { Hotspot, type SceneProps } from '../../kit';
import { CyberCenter } from './Cyber';
import { SITES, TOWN, sitePosition, siteRotation, type SiteId } from './layout';
import { Plaque } from './signs';
import { TechCenter } from './TechCenter';
import { Town } from './Town';

/**
 * ÎLE PROJETS — la ville : un bâtiment par projet autour d'une place, le centre cyber
 * (le nouveau site) en son cœur. Voir layout.ts pour le plan.
 */

function Placeholder({ project }: { project: Project }) {
  const id = project.building as SiteId;
  const [x, z] = sitePosition(id);
  const y = id === 'shipyard' ? 0.82 : TOWN.level;
  return (
    <Hotspot onActivate={() => focusItem('projects', project.id)} position={[x, y, z]} rotation={[0, siteRotation(id), 0]}>
      <mesh position-y={1.5} castShadow receiveShadow>
        <boxGeometry args={[4, 3, 3]} />
        <meshStandardMaterial color={project.accent} roughness={0.8} />
      </mesh>
      <Plaque index={project.index} accent={project.accent} position={[0, 2.2, 1.52]} />
    </Hotspot>
  );
}

export default function ProjectsScene({ island }: SceneProps) {
  // Les vitres partagées (kit WindowPane) s'allument au crépuscule.
  useFrame(() => updateWindows(skyState.dayNight));
  return (
    <>
      <Town elevation={island.elevation} />
      {projects.map((project) => {
        if (!(project.building in SITES)) return null;
        if (project.building === 'cyber') return <CyberCenter key={project.id} project={project} />;
        if (project.building === 'tech-center') return <TechCenter key={project.id} project={project} />;
        return <Placeholder key={project.id} project={project} />;
      })}
    </>
  );
}
