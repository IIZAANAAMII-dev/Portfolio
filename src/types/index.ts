export type IslandId =
  | 'about'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'journey'
  | 'contact';

/** Phases de l'expérience. Voir docs/ARCHITECTURE.md */
export type WorldPhase = 'loading' | 'intro' | 'transitioning' | 'playing' | 'docked';

export type Vec2 = [x: number, z: number];

export interface IslandConfig {
  id: IslandId;
  label: string;
  /** Sous-titre manuscrit affiché au survol. */
  tagline: string;
  /** Position au sol dans le monde (le plan XZ). */
  position: Vec2;
  /** Rayon approximatif de la masse terrestre, utilisé pour les hauts-fonds et le dock. */
  radius: number;
  /** Hauteur du relief central. */
  elevation: number;
  /** Couleur d'accent unique de l'île. */
  accent: string;
  /** Teinte de la végétation / du sol. */
  ground: string;
  /** Angle (radians) où se trouve le ponton, mesuré depuis le centre de l'île. */
  dockAngle: number;
  /** Direction depuis laquelle la caméra cadre l'île une fois accosté. */
  cameraAngle: number;
  /** Silhouette : ce qui pousse ou se construit sur l'île. */
  silhouette: 'nature' | 'grid' | 'monoliths' | 'towers' | 'path' | 'beacon';
}

export interface Project {
  id: string;
  title: string;
  year: string;
  summary: string;
  problem: string;
  solution: string;
  role: string;
  stack: string[];
  outcomes?: string[];
  links?: { github?: string; demo?: string };
  /** Position relative au centre de l'île PROJECTS. */
  offset: Vec2;
}

export interface SkillGroup {
  id: string;
  label: string;
  context: string;
  items: string[];
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  period: string;
  location?: string;
  missions: string[];
  stack: string[];
}

export interface JourneyStep {
  id: string;
  year: string;
  title: string;
  description: string;
}
