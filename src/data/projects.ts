import type { Project } from '@/types';

export const projects: Project[] = [
  {
    id: 'feeder',
    title: 'Feeder.fr',
    year: '2026',
    summary:
      'Plateforme B2B qui connecte distributeurs technologiques et revendeurs en un seul espace.',
    problem:
      "Les revendeurs perdaient du temps à jongler entre catalogues, devis et commandes sans outil centralisé.",
    solution:
      "J'ai construit une application React / TypeScript avec un espace revendeurs complet : tarifs personnalisés, devis, commandes et achats, plus un site sectoriel dynamique et une vitrine internationale.",
    role: 'Développement full stack, intégration métier et expérience utilisateur.',
    stack: ['React.js', 'TypeScript', 'Node.js', 'Next.js', 'Three.js'],
    outcomes: [
      'Parcours revendeur clair et autonome',
      'Site sectoriel connecté au back en temps réel',
      'Déploiement d’une vitrine internationale Feeder.ae',
    ],
    links: { demo: 'https://feeder.fr' },
    offset: [-6, -4],
  },
  {
    id: 'psyme',
    title: 'PsyMe',
    year: '2024 — 2026',
    summary:
      'Doctolib des psychologues : prise de rendez-vous, suivi patient et visibilité en ligne.',
    problem:
      "Les psychologues manquaient d'une solution dédiée pour gérer leur cabinet et attirer de nouveaux patients.",
    solution:
      "Direction UX/UI et développement front-end d'une plateforme fluide : design system, animations Lottie et parcours patient pensé pour rassurer dès le premier clic.",
    role: 'Conception web, branding et développement front-end chez RG Design.',
    stack: ['React', 'Figma', 'Lottie', 'UX Design', 'Branding'],
    outcomes: [
      'Identité visuelle cohérente sur desktop et mobile',
      'Parcours de prise de rendez-vous optimisé',
      'Micro-animations qui guident l’utilisateur',
    ],
    offset: [7, -2],
  },
  {
    id: 'cinebot',
    title: 'Cinebot',
    year: '2025',
    summary:
      'Bot Discord pour partager et synchroniser des séances de visionnage entre amis.',
    problem:
      "Aucun outil ne permettait simplement de proposer un film ou une vidéo YouTube à son serveur et de fixer une séance.",
    solution:
      "Développement d’un bot Node.js performant avec des commandes claires, un hébergement optimisé et une expérience utilisateur réduite à l’essentiel.",
    role: 'Conception et développement complet en solo, de l’idée au déploiement.',
    stack: ['Node.js', 'Discord.js', 'JavaScript', 'UX Design'],
    outcomes: [
      'Partage de séances en quelques commandes',
      'Hébergement gratuit et fiable',
      'Expérience instantanée sans friction',
    ],
    offset: [1, 6],
  },
];
