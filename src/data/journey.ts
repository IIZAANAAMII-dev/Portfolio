import type { JourneyStep } from '@/types';

/**
 * Les cinq étapes de l'île Parcours, de la Bretagne à Marseille.
 * Pas de dates : seulement des repères (aucune date n'est inventée).
 */
export const journey: JourneyStep[] = [
  {
    id: 'origines',
    marker: 'Morbihan',
    title: 'Origines bretonnes',
    description:
      'Je grandis dans le Morbihan, dans une famille de pêcheurs. La mer, les ports et les bateaux sont mon premier décor.',
    side: 'bretagne',
  },
  {
    id: 'apprentissage',
    marker: 'Premiers pas',
    title: 'Découvrir le code',
    description:
      'Plutôt que la pêche, je choisis une autre forme d’exploration : le développement et la création numérique. J’apprends en construisant.',
    side: 'bretagne',
  },
  {
    id: 'marseille',
    marker: 'Cap au sud',
    title: 'Arrivée à Marseille',
    description:
      'Je quitte la Bretagne pour Marseille afin de construire ma carrière : nouvelle lumière, nouvelle mer, nouveaux projets.',
    side: 'passage',
  },
  {
    id: 'feeder',
    marker: 'La Ciotat',
    title: 'Feeder – EIZO France',
    description:
      'En alternance chez Feeder SAS – EIZO France : développement web, e-commerce, design, SEO et expériences digitales, sur des sites en ligne.',
    side: 'marseille',
  },
  {
    id: 'horizon',
    marker: 'Aujourd’hui',
    title: 'Vers l’immersif',
    description:
      'Je pousse vers les expériences web immersives, la 3D temps réel et des projets personnels ambitieux. L’un d’eux est un jeu… qui se cache quelque part au large.',
    side: 'marseille',
  },
];
