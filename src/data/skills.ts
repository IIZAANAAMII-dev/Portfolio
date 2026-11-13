import type { SkillZone } from '@/types';

/**
 * Le laboratoire de l'île Compétences : six zones, chacune avec son décor.
 * Pas de pourcentages. Chaque technologie est marquée :
 *  - 'pro'         : utilisée dans mon travail (alternance, sites en ligne) ;
 *  - 'exploration' : ce que j'apprends, teste et pousse dans mes projets personnels.
 * Ajuster un niveau ici met à jour l'île et les panneaux.
 */
export const skillZones: SkillZone[] = [
  {
    id: 'front',
    label: 'Atelier Front-end',
    place: 'des composants d’interface qui s’assemblent',
    context: 'Interfaces rapides, responsives et animées.',
    accent: '#5ec8ff',
    items: [
      { name: 'HTML', level: 'pro' },
      { name: 'CSS', level: 'pro' },
      { name: 'JavaScript', level: 'pro' },
      { name: 'TypeScript', level: 'pro' },
      { name: 'React', level: 'pro' },
      { name: 'Next.js', level: 'pro' },
      { name: 'UI / UX', level: 'pro' },
      { name: 'Responsive', level: 'pro' },
      { name: 'Animations web', level: 'pro' },
      { name: 'GSAP', level: 'pro' },
    ],
  },
  {
    id: 'back',
    label: 'Centre Back-end',
    place: 'des serveurs, des câbles lumineux et une base de données',
    context: 'APIs, données et logique métier qui tiennent la route.',
    accent: '#ff9f43',
    items: [
      { name: 'Node.js', level: 'pro' },
      { name: 'APIs & intégrations', level: 'pro' },
      { name: 'Prisma', level: 'pro' },
      { name: 'PostgreSQL', level: 'pro' },
      { name: 'Architecture full stack', level: 'pro' },
      { name: 'Authentification & logique métier', level: 'pro' },
    ],
  },
  {
    id: 'commerce',
    label: 'Quai E-commerce',
    place: 'des colis, des produits, des paiements et des commandes',
    context: 'Boutiques, catalogues et parcours d’achat.',
    accent: '#7bd88f',
    items: [
      { name: 'Shopify', level: 'pro' },
      { name: 'PrestaShop', level: 'pro' },
      { name: 'Stripe', level: 'pro' },
      { name: 'Catalogues produits', level: 'pro' },
      { name: 'Parcours clients', level: 'pro' },
      { name: 'Processus de commande', level: 'pro' },
    ],
  },
  {
    id: 'lab3d',
    label: 'Laboratoire 3D',
    place: 'des hologrammes, des modèles animés et un bassin d’eau',
    context: 'La 3D temps réel au service de l’expérience.',
    accent: '#c58bff',
    items: [
      { name: 'Three.js', level: 'pro' },
      { name: 'React Three Fiber', level: 'exploration' },
      { name: 'WebGL & shaders', level: 'exploration' },
      { name: 'Blender', level: 'exploration' },
      { name: 'Assets 3D', level: 'exploration' },
    ],
  },
  {
    id: 'ai',
    label: 'Station IA',
    place: 'des petits agents qui travaillent ensemble',
    context: 'L’IA comme copilote, et les agents comme terrain d’expérimentation.',
    accent: '#ff6fa8',
    items: [
      { name: 'Claude Code', level: 'pro' },
      { name: 'ChatGPT', level: 'pro' },
      { name: 'Agents de développement', level: 'exploration' },
      { name: 'MCP', level: 'exploration' },
      { name: 'Automatisations', level: 'exploration' },
    ],
  },
  {
    id: 'tower',
    label: 'Tour de contrôle',
    place: 'une tour, un radar et des fusées de déploiement',
    context: 'Versionner, déployer, mesurer, être trouvé.',
    accent: '#ffd23f',
    items: [
      { name: 'Git', level: 'pro' },
      { name: 'GitHub', level: 'pro' },
      { name: 'Vercel', level: 'pro' },
      { name: 'Déploiements', level: 'pro' },
      { name: 'SEO', level: 'pro' },
      { name: 'GA4', level: 'pro' },
      { name: 'GTM', level: 'pro' },
      { name: 'Semrush', level: 'pro' },
    ],
  },
];

export const skillZoneById = Object.fromEntries(skillZones.map((zone) => [zone.id, zone])) as Record<
  SkillZone['id'],
  SkillZone
>;
