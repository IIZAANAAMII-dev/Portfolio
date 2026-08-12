import type { Project } from '@/types';

// TODO Kyliann : remplacer par tes vrais projets. L'ancien site ne contenait que des
// placeholders ("Projet 1", "Projet 2"), rien de réel n'a pu être récupéré.
// La structure ci-dessous est celle attendue par l'île PROJECTS : garde les champs,
// change le contenu. `offset` = position de la structure sur l'île, relative au centre.

export const projects: Project[] = [
  {
    id: 'archipelago',
    title: 'Portfolio Archipel',
    year: '2026',
    summary:
      'Un portfolio conçu comme une petite expérience 3D navigable plutôt que comme une page à scroller.',
    problem:
      "Un portfolio classique se parcourt en dix secondes et ne démontre rien de la capacité à construire une interface complexe.",
    solution:
      "Une scène React Three Fiber pilotée par une machine à états : révélation cinématique du monde, navigation au clic, contenu data-driven, et une Quick View DOM complète pour les visiteurs pressés.",
    role: 'Conception, direction artistique et développement.',
    stack: ['Next.js', 'TypeScript', 'React Three Fiber', 'Three.js', 'GSAP', 'Tailwind CSS'],
    outcomes: [
      'Fallback complet sans WebGL',
      'Respect de prefers-reduced-motion',
      'Aucun contenu prisonnier du canvas',
    ],
    links: { github: 'https://github.com/IIZAANAAMII-dev/Portfolio' },
    offset: [-6, -4],
  },
  {
    id: 'project-two',
    title: 'Projet à renseigner',
    year: '—',
    summary: 'Remplace cette entrée par un projet réel dans src/data/projects.ts.',
    problem: 'Quel problème concret le projet résolvait-il ?',
    solution: 'Quelle approche technique as-tu choisie, et pourquoi celle-là ?',
    role: 'Ton rôle exact sur le projet.',
    stack: ['—'],
    offset: [7, -2],
  },
  {
    id: 'project-three',
    title: 'Projet à renseigner',
    year: '—',
    summary: 'Remplace cette entrée par un projet réel dans src/data/projects.ts.',
    problem: 'Quel problème concret le projet résolvait-il ?',
    solution: 'Quelle approche technique as-tu choisie, et pourquoi celle-là ?',
    role: 'Ton rôle exact sur le projet.',
    stack: ['—'],
    offset: [1, 6],
  },
];
