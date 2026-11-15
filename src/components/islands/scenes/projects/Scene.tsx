'use client';

import { useFrame } from '@react-three/fiber';
import { projects } from '@/data/projects';
import { skyState } from '@/lib/sky';
import { updateWindows } from '@/lib/windows';
import type { Project, ProjectBuilding } from '@/types';
import type { SceneProps } from '../../kit';
import { CyberCenter } from './Cyber';
import { Gallery } from './Gallery';
import { Medical } from './Medical';
import { Shipyard } from './Shipyard';
import { TechCenter } from './TechCenter';
import { Town } from './Town';
import { TownLife } from './TownLife';
import { Workshops } from './Workshops';

/**
 * ÎLE PROJETS — la ville : un bâtiment par projet autour d'une place ronde, le centre
 * cyber (le nouveau site, sa bulle-galaxie) en son cœur. Plan : layout.ts. Relief : config.ts.
 * Chaque bâtiment lit son projet dans data/projects.ts (numéro, titre, couleur, captures).
 */
const BUILDINGS: Record<ProjectBuilding, (props: { project: Project }) => React.ReactNode> = {
  'tech-center': TechCenter,
  gallery: Gallery,
  medical: Medical,
  cyber: CyberCenter,
  workshops: Workshops,
  shipyard: Shipyard,
};

export default function ProjectsScene({ island }: SceneProps) {
  // Les vitres partagées (kit WindowPane, lib/windows) s'allument au crépuscule.
  useFrame(() => updateWindows(skyState.dayNight));
  return (
    <>
      <Town elevation={island.elevation} />
      <TownLife />
      {projects.map((project) => {
        const Building = BUILDINGS[project.building];
        return Building ? <Building key={project.id} project={project} /> : null;
      })}
    </>
  );
}
