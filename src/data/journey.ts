import type { JourneyStep } from '@/types';

export const journey: JourneyStep[] = [
  {
    id: 'start',
    year: '2022',
    title: 'Premiers pas',
    description: 'Premiers projets graphiques : le design et le code deviennent un même langage.',
  },
  {
    id: 'training',
    year: '2023',
    title: 'Concepteur Designer UI',
    description: 'Diplôme Bac+3 au GRETA Occitanie. Entre Figma, Photoshop et prototypage, j’apprends à penser l’interface.',
  },
  {
    id: 'design',
    year: '2024',
    title: 'Design d’interface',
    description: 'Stages UI/UX : de la maquette à la page web, je passe du design au développement.',
  },
  {
    id: 'fullstack',
    year: '2025',
    title: 'Full stack',
    description: 'Produits complets en solo ou en équipe : React en front, Node.js en back, et un goût pour les détails.',
  },
  {
    id: 'next',
    year: 'Aujourd’hui',
    title: 'Master & Freelance',
    description: 'Master Web/Multimedia Management à l’ISCOD et missions chez Feeder. Je cherche à monter en responsabilité.',
  },
];
