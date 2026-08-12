import type { JourneyStep } from '@/types';

// TODO Kyliann : ajuster les dates et les étapes de ton parcours réel.
// L'île JOURNEY dessine un chemin physique : une étape = un point sur ce chemin.

export const journey: JourneyStep[] = [
  {
    id: 'start',
    year: '20XX',
    title: 'Premiers pas',
    description: 'Le moment où le code est passé de curiosité à intention.',
  },
  {
    id: 'training',
    year: '20XX',
    title: 'Formation',
    description: 'Diplôme, école ou apprentissage à renseigner.',
  },
  {
    id: 'design',
    year: '20XX',
    title: 'Design d’interface',
    description: 'Apprendre à penser une interface avant de l’écrire.',
  },
  {
    id: 'fullstack',
    year: '20XX',
    title: 'Full stack',
    description: 'Assumer la chaîne complète, de l’écran à la base de données.',
  },
  {
    id: 'next',
    year: 'Aujourd’hui',
    title: 'La suite',
    description: 'Le type de produit et d’équipe que je cherche maintenant.',
  },
];
