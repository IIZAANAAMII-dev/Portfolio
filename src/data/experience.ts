import type { ExperienceEntry } from '@/types';

export const experiences: ExperienceEntry[] = [
  {
    id: 'feeder',
    role: 'Développeur web',
    company: 'Feeder',
    period: 'mai 2026 — aujourd’hui',
    location: 'Marseille, France',
    missions: [
      'Conception et développement de feeder.fr, la plateforme B2B de distribution de solutions technologiques.',
      'Mise en place d’un espace revendeurs complet : tarifs, devis, commandes et achats en autonomie.',
      'Livraison de sites vitrines internationaux et sectoriels (feeder.ae, clarten.fr).',
      'Intégration Shopify et expérimentations Three.js pour des vitrines interactives.',
    ],
    stack: ['React.js', 'TypeScript', 'Node.js', 'Next.js', 'Shopify', 'Three.js', 'WordPress'],
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
