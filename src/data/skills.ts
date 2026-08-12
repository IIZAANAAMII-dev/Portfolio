import type { SkillGroup } from '@/types';

// Aucun pourcentage : uniquement les technologies réellement utilisées et leur contexte.
// TODO Kyliann : ajuster la liste à ce que tu utilises vraiment aujourd'hui.

export const skillGroups: SkillGroup[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    context: 'Interfaces produit, animation et rendu temps réel.',
    items: ['TypeScript', 'React', 'Next.js', 'Angular', 'Three.js', 'GSAP', 'Tailwind CSS'],
  },
  {
    id: 'backend',
    label: 'Backend',
    context: 'APIs, modélisation de données et logique métier.',
    items: ['Node.js', 'Express', 'PHP', 'SQL', 'REST', 'Authentification'],
  },
  {
    id: 'devops',
    label: 'DevOps',
    context: 'Environnements reproductibles et mise en production.',
    items: ['Docker', 'Git', 'GitHub Actions', 'Vercel'],
  },
  {
    id: 'design',
    label: 'Design',
    context: 'Conception d’interface avant écriture du code.',
    items: ['Figma', 'Design system', 'Prototypage', 'Accessibilité'],
  },
];
