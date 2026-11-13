'use client';

import { lazy, type ComponentType } from 'react';
import type { IslandId } from '@/types';
import type { SceneProps } from '../kit';
import type { IslandSceneConfig } from './types';
import about from './about/config';
import contact from './contact/config';
import experience from './experience/config';
import journey from './journey/config';
import projects from './projects/config';
import skills from './skills/config';

/** Réglages légers, connus dès la création de l'île (relief, végétation). */
export const sceneConfigs: Record<IslandId, IslandSceneConfig> = {
  about,
  contact,
  experience,
  journey,
  projects,
  skills,
};

/**
 * Décor de chaque île, chargé à part (un chunk par île). Une erreur dans un décor
 * n'affecte que son île : la boundary de Silhouette la remplace par rien.
 */
export const sceneComponents: Record<IslandId, ComponentType<SceneProps>> = {
  about: lazy(() => import('./about/Scene')),
  contact: lazy(() => import('./contact/Scene')),
  experience: lazy(() => import('./experience/Scene')),
  journey: lazy(() => import('./journey/Scene')),
  projects: lazy(() => import('./projects/Scene')),
  skills: lazy(() => import('./skills/Scene')),
};
