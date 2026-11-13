import type { Experiment, Project } from '@/types';

/**
 * La ville de l'île Projets : un bâtiment par projet.
 * Règles : statut réel, aucun chiffre ni résultat inventé, aucun lien deviné.
 * Pour ajouter des captures réelles : déposer les images dans /public/projects/<id>/
 * puis lister leurs chemins dans `screenshots` (elles s'affichent sur les écrans 3D
 * et dans le panneau).
 */
export const projects: Project[] = [
  {
    id: 'feeder',
    index: '01',
    title: 'Feeder.fr',
    kind: 'Plateforme e-commerce B2B',
    context: 'Alternance — Feeder SAS',
    status: 'live',
    summary:
      'La plateforme de Feeder : catalogues, commandes et paiements, avec les interfaces d’administration qui font tourner le tout.',
    highlights: [
      'Développement full stack avec Next.js, React, Prisma et PostgreSQL',
      'Catalogues produits et imports de données',
      'Paiement Stripe',
      'Interfaces d’administration',
      'Gestion des commandes',
      'UX et SEO',
    ],
    stack: ['Next.js', 'React', 'TypeScript', 'Prisma', 'PostgreSQL', 'Stripe'],
    url: 'https://feeder.fr',
    screenshots: ['/projects/feeder/accueil.jpg'],
    building: 'tech-center',
    accent: '#ff8a3d',
  },
  {
    id: 'eizo',
    index: '02',
    title: 'EIZO France',
    kind: 'Boutique Shopify',
    context: 'Alternance — EIZO France',
    status: 'live',
    summary:
      'Développement et personnalisation de la boutique Shopify d’EIZO France, de la page produit aux pages événementielles.',
    highlights: [
      'Développement et personnalisation Shopify',
      'Pages produits et collections',
      'Intégration de nouvelles marques',
      'Landing pages',
      'Responsive',
      'Formulaires personnalisés',
    ],
    feature: {
      title: 'La page « Les Rencontres EIZO »',
      url: 'https://eizo.fr/pages/rencontre-2026',
      points: [
        'Hero en bento',
        'Animations et identité visuelle',
        'Présentation des solutions EIZO',
        'Formulaire de prise de rendez-vous',
        'Suivi analytics',
      ],
    },
    stack: ['Shopify', 'HTML / CSS', 'JavaScript', 'Analytics'],
    url: 'https://eizo.fr',
    screenshots: ['/projects/eizo/rencontres-2026.jpg', '/projects/eizo/rencontres-2026-suite.jpg'],
    building: 'gallery',
    accent: '#3f8cff',
  },
  {
    id: 'clarten',
    index: '03',
    title: 'Clarten Médical',
    kind: 'Expérience web pour des solutions médicales',
    context: 'Alternance — Feeder SAS',
    status: 'live',
    summary:
      'Un site qui présente des solutions médicales : produits, visuels, présentation 3D et un vrai travail de référencement.',
    highlights: [
      'Présentation des produits et des visuels',
      'Présentation et configuration en 3D',
      'SEO, performance et analyse du positionnement',
      'Conversion et expérience utilisateur',
    ],
    stack: ['3D', 'SEO', 'Performance', 'UX'],
    url: 'https://clarten-medical.com',
    screenshots: ['/projects/clarten/accueil.jpg'],
    building: 'medical',
    accent: '#3fd0b0',
  },
  {
    id: 'cyber',
    index: '04',
    title: 'Feeder Cyber',
    kind: 'Expérience immersive',
    badge: 'Nouveau site',
    context: 'Alternance — Feeder SAS',
    status: 'live',
    summary:
      'Une traversée spatiale : les marques deviennent des étoiles et des planètes, autour d’un trou noir et de particules.',
    highlights: [
      'Expérience immersive en Three.js et GSAP',
      'Transitions cinématiques',
      'Marques présentées comme des étoiles et des planètes',
      'Trou noir, particules et traversée de l’espace',
      'Animations et design',
      'Optimisation des performances mobiles',
    ],
    stack: ['Three.js', 'GSAP'],
    url: 'https://cyber.feeder.fr',
    screenshots: ['/projects/cyber/accueil.jpg'],
    building: 'cyber',
    accent: '#8b6bff',
  },
  {
    id: 'feeder-sites',
    index: '05',
    title: 'Feeder Graphic · Industrie · Défense',
    kind: 'Sites sectoriels',
    context: 'Alternance — Feeder SAS',
    status: 'in-progress',
    statusLabel: 'En cours de réalisation ou en préparation',
    summary:
      'Trois sites sectoriels pour Feeder, chacun avec son univers : création graphique, industrie et défense.',
    highlights: [
      'Un univers visuel par secteur',
      'Présentés ici avec leur état d’avancement réel : ils ne sont pas encore terminés',
    ],
    parts: [
      // Statut précis de chacun à renseigner (status: 'in-progress' | 'planned').
      { name: 'Feeder Graphic', note: 'atelier créatif' },
      { name: 'Feeder Industrie', note: 'machines industrielles' },
      { name: 'Feeder Défense', note: 'centre de défense et radar' },
    ],
    stack: ['Web design', 'Développement web'],
    building: 'workshops',
    accent: '#ffc83d',
  },
  {
    id: 'portfolio',
    index: '06',
    title: 'Portfolio 3D',
    kind: 'Projet personnel',
    context: 'Projet personnel',
    status: 'live',
    statusLabel: 'En ligne, toujours en chantier',
    summary:
      'Cet archipel : un monde à explorer en bateau, où chaque île raconte une partie de mon histoire.',
    highlights: [
      'Direction artistique de l’archipel',
      'Expérimentations 3D et shaders (océan, végétation, ciel)',
      'Navigation au clic et caméra cinématique',
      'Animations, faune et cycle jour/nuit',
      'Travail de l’océan',
    ],
    stack: ['Next.js', 'React Three Fiber', 'Three.js', 'GLSL', 'GSAP', 'Zustand'],
    building: 'shipyard',
    accent: '#e2553f',
  },
];

export const projectById = Object.fromEntries(projects.map((project) => [project.id, project])) as Record<
  string,
  Project
>;

/** Expériences personnelles, cachées dans le coffre au trésor. */
export const experiments: Experiment[] = [
  {
    id: 'cinebot',
    title: 'Cinebot',
    kind: 'Bot Discord',
    summary:
      'Un bot pour proposer un film ou une vidéo à son serveur et fixer une séance de visionnage entre amis. Conçu et développé en solo.',
    stack: ['Node.js', 'Discord.js', 'JavaScript'],
  },
];

export const STATUS_LABEL: Record<Project['status'], string> = {
  live: 'En ligne',
  'in-progress': 'En cours',
  planned: 'En préparation',
};
