import type { ExperienceEntry } from '@/types';

export const experiences: ExperienceEntry[] = [
  {
    id: 'feeder',
    role: 'Développeur full stack',
    company: 'Feeder SAS – EIZO France',
    period: 'mai 2026 — aujourd’hui',
    location: 'La Ciotat',
    contract: 'Alternance',
    missions: [
      'Développement web et e-commerce : la plateforme feeder.fr (Next.js, Prisma, Stripe) et la boutique Shopify d’EIZO France.',
      'Design et intégration : pages produits, collections, landing pages et parcours clients.',
      'SEO, analytics et suivi de la performance des sites.',
      'Expériences digitales immersives, comme cyber.feeder.fr (Three.js, GSAP).',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Prisma', 'PostgreSQL', 'Stripe', 'Shopify', 'Three.js', 'GSAP'],
  },
  {
    id: 'rgdesign',
    role: 'Développeur front-end / UI UX',
    company: 'RG Design Agence de Croissance Digitale',
    period: 'août 2024 — août 2026',
    location: 'Marseille, France',
    missions: [
      'Conception et développement de PsyMe, la plateforme de rendez-vous dédiée aux psychologues.',
      'Création d’un design system et d’une identité visuelle appliquée sur desktop et mobile.',
      'Animation Lottie, micro-interactions et UX writing pour guider les patients.',
    ],
    stack: ['React', 'Figma', 'Lottie', 'UX Design', 'Branding'],
  },
  {
    id: 'greta',
    role: 'Stagiaire UI UX Designer',
    company: 'GRETA Occitanie',
    period: 'sept. 2022 — mai 2023',
    location: 'Marseille, France',
    missions: [
      'Diplôme Bac+3 de Concepteur Designer UI, entre théorie et projets concrets.',
      'Conception d’interfaces, maquettes Figma et communication visuelle sous Photoshop / Adobe XD.',
    ],
    stack: ['Figma', 'Adobe Photoshop', 'Adobe XD', 'UI Design'],
  },
];
