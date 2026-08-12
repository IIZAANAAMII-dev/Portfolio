import type { SkillGroup } from '@/types';

export const skillGroups: SkillGroup[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    context: 'Interfaces performantes, animées et accessibles.',
    items: ['TypeScript', 'React', 'Next.js', 'Angular', 'Three.js', 'GSAP', 'Tailwind CSS', 'Shopify'],
  },
  {
    id: 'backend',
    label: 'Backend',
    context: 'APIs robustes et bases de données pensées pour durer.',
    items: ['Node.js', 'Express', 'NestJS', 'PHP', 'SQL', 'PostgreSQL', 'Prisma', 'REST', 'Redis'],
  },
  {
    id: 'devops',
    label: 'DevOps',
    context: 'Mise en production fluide et infrastructures reproductibles.',
    items: ['Docker', 'Git', 'GitHub Actions', 'Vercel', 'Traefik', 'Turborepo'],
  },
  {
    id: 'design',
    label: 'Design',
    context: 'Conception d’interface avant une ligne de code.',
    items: ['Figma', 'Adobe XD', 'Photoshop', 'Lottie', 'Design system', 'Prototypage', 'Accessibilité'],
  },
];
