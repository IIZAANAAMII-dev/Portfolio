import type { SubstanceId } from '@/lib/materials/substances';

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
  /** Matériaux Substance du relief : roche des falaises et couvert des plateaux. */
  terrain: { cliff: SubstanceId; top: SubstanceId };
}

export type ProjectStatus = 'live' | 'in-progress' | 'planned';

/** Bâtiment qui représente le projet dans la ville de l'île PROJETS. */
export type ProjectBuilding = 'tech-center' | 'gallery' | 'medical' | 'cyber' | 'workshops' | 'shipyard';

export interface SubProject {
  name: string;
  /** Statut propre, s'il diffère de celui du groupe. */
  status?: ProjectStatus;
  /** Ce que représente le petit bâtiment (atelier créatif, machines, radar…). */
  note: string;
}

export interface Project {
  id: string;
  /** Numéro affiché sur le bâtiment : « 01 », « 02 »… */
  index: string;
  title: string;
  /** Nature du projet en quelques mots. */
  kind: string;
  /** Cadre : alternance, projet personnel… */
  context: string;
  status: ProjectStatus;
  /** Libellé de statut libre, quand le statut seul ne suffit pas. */
  statusLabel?: string;
  summary: string;
  /** Ce que j'ai réellement fait (pas de chiffres inventés). */
  highlights: string[];
  stack: string[];
  /** Zoom sur une réalisation précise (ex. la page « Rencontre EIZO »). */
  feature?: { title: string; points: string[] };
  /** Sous-projets présentés ensemble (Feeder Graphic / Industrie / Défense). */
  parts?: SubProject[];
  /** Site public. Jamais inventé : absent si inconnu. */
  url?: string;
  /** Captures réelles (chemins dans /public). Vide tant qu'aucune capture n'est fournie. */
  screenshots?: string[];
  building: ProjectBuilding;
  accent: string;
}

export interface Experiment {
  id: string;
  title: string;
  kind: string;
  summary: string;
  stack: string[];
}

export type SkillLevel = 'pro' | 'exploration';

export interface SkillItem {
  name: string;
  /** « pro » : utilisé dans mon travail. « exploration » : ce que j'apprends et teste. */
  level: SkillLevel;
}

export type SkillZoneId = 'front' | 'back' | 'commerce' | 'lab3d' | 'ai' | 'tower';

export interface SkillZone {
  id: SkillZoneId;
  label: string;
  /** Ce qu'on voit sur l'île (le décor de la zone). */
  place: string;
  context: string;
  accent: string;
  items: SkillItem[];
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  period: string;
  location?: string;
  contract?: string;
  missions: string[];
  stack: string[];
}

export interface JourneyStep {
  id: string;
  /** Repère court affiché à la place d'une date (aucune date inventée). */
  marker: string;
  title: string;
  description: string;
  /** Côté de l'île Parcours où l'étape est posée. */
  side: 'bretagne' | 'passage' | 'marseille';
}
