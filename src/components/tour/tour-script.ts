import { experiences } from '@/data/experience';
import { islandById } from '@/data/islands';
import { journey } from '@/data/journey';
import { projects } from '@/data/projects';
import { site } from '@/data/site';
import { skillZones } from '@/data/skills';
import type { IslandId } from '@/types';

/**
 * Le fil de la visite guidée : l'ordre du récit et, pour chaque escale, une accroche d'une
 * ligne. Aucune phrase n'est écrite ici : tout vient de src/data — on choisit une phrase,
 * on la coupe à une ponctuation naturelle, ou on énumère des noms réels.
 */

export interface TourStop {
  id: IslandId;
  /** Nom peint de l'île. */
  label: string;
  /** Sous-titre de l'île (« qui je suis »…). */
  tagline: string;
  accent: string;
  /** Accroche du sous-titre, tirée des données. */
  hook: string;
}

/** Le récit : qui, d'où il vient, où il travaille, ce qu'il construit, avec quoi, et on se parle. */
const ROUTE: IslandId[] = ['about', 'journey', 'experience', 'projects', 'skills', 'contact'];

/** Outils mis en avant à l'escale Compétences (seuls ceux présents dans data/skills.ts s'affichent). */
const SKILL_PICKS = ['React', 'Next.js', 'TypeScript', 'Node.js', 'Prisma', 'Shopify', 'Three.js'];

/** Typographie française : espace fine insécable avant ? ! ; », insécable avant les deux-points. */
function french(text: string) {
  return text
    .replace(/[   ]+([?!;»])/g, ' $1')
    .replace(/«[   ]*/g, '« ')
    .replace(/[   ]+:(?=\s|$)/g, ' :');
}

/** Première phrase d'un texte. */
function firstSentence(text: string) {
  const end = text.search(/[.!?…](\s|$)/);
  return end >= 0 ? text.slice(0, end + 1) : text;
}

/** La proposition principale d'une phrase, coupée à son deux-points (point final rétabli). */
function mainClause(text: string) {
  const cut = text.search(/[   ]:/);
  return cut > 0 ? `${text.slice(0, cut)}.` : firstSentence(text);
}

function hookFor(id: IslandId): string {
  switch (id) {
    case 'about':
      return firstSentence(site.about);
    case 'journey': {
      const step = journey.find((entry) => entry.id === 'marseille') ?? journey[0];
      return step ? mainClause(step.description) : '';
    }
    case 'experience': {
      const current = experiences[0];
      if (!current) return '';
      return [`${current.role} chez ${current.company}`, current.contract, current.location]
        .filter(Boolean)
        .join(' · ');
    }
    case 'projects':
      return projects
        .filter((project) => project.status === 'live')
        .slice(0, 4)
        .map((project) => project.title)
        .join(' · ');
    case 'skills': {
      const names = new Set(skillZones.flatMap((zone) => zone.items.map((item) => item.name)));
      return SKILL_PICKS.filter((name) => names.has(name)).join(' · ');
    }
    case 'contact':
      return `Basé à ${site.location} · ${site.email}`;
  }
}

export const TOUR_STOPS: TourStop[] = ROUTE.map((id) => {
  const island = islandById[id];
  return {
    id,
    label: island.label,
    tagline: french(island.tagline),
    accent: island.accent,
    hook: french(hookFor(id)),
  };
});

export const TOUR_LENGTH = TOUR_STOPS.length;

/** Prénom du capitaine (bouton de contact de la carte de fin). */
export const FIRST_NAME = site.name.split(' ')[0];
export const CONTACT_EMAIL = site.email;
