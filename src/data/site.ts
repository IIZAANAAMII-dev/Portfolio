// TODO Kyliann : vérifier l'URL LinkedIn, déposer le CV dans /public et confirmer
// l'intitulé de poste. Tout le contenu textuel du portfolio vit dans src/data/.

export const site = {
  name: 'Kyliann Le Garrec',
  shortName: 'KYLIANN',
  role: 'Développeur Full Stack',
  location: 'Marseille, France',
  intro:
    "Je conçois et développe des produits web complets, de l'interface à l'API. " +
    "Ce portfolio est un petit archipel : chaque île est une partie de mon travail.",
  bio: [
    "Développeur full stack basé à Marseille, je travaille autant sur l'expérience " +
      "utilisateur que sur ce qui la fait tourner. Ce qui m'intéresse : les interfaces " +
      'précises, les bases de code lisibles et les détails que personne ne remarque ' +
      'consciemment.',
    "Je viens du design d'interface, ce qui influence ma façon de coder : je pense en " +
      'états, en transitions et en cas limites avant de penser en fichiers.',
  ],
  email: 'lgkyliann@gmail.com',
  links: {
    github: 'https://github.com/IIZAANAAMII-dev',
    linkedin: 'https://www.linkedin.com/in/kyliann-le-garrec',
    cv: '/cv-kyliann-le-garrec.pdf',
  },
  url: 'https://kyliann.dev',
} as const;
