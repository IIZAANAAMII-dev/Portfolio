import type { ExperienceEntry } from '@/types';

// TODO Kyliann : renseigner tes expériences réelles (poste, entreprise, période,
// missions, stack). Les entrées ci-dessous sont un gabarit.

export const experiences: ExperienceEntry[] = [
  {
    id: 'exp-1',
    role: 'Poste à renseigner',
    company: 'Entreprise',
    period: '20XX — 20XX',
    location: 'Marseille, France',
    missions: [
      'Mission principale et son impact.',
      'Une réalisation technique concrète.',
      'Ce que tu as appris ou mis en place durablement.',
    ],
    stack: ['—'],
  },
  {
    id: 'exp-2',
    role: 'Poste à renseigner',
    company: 'Entreprise',
    period: '20XX — 20XX',
    missions: ['Mission principale et son impact.'],
    stack: ['—'],
  },
];
