/**
 * Identité et textes de présentation. Tout ce qui est affiché sur le site vient d'ici :
 * modifier ce fichier suffit, la 3D et les panneaux suivent.
 */
export const site = {
  name: 'Kyliann Le Garrec',
  shortName: 'KYLIANN',
  role: 'Développeur full stack',
  location: 'Marseille',
  origin: 'Morbihan, Bretagne',
  /** Poste actuel. */
  current: {
    company: 'Feeder SAS – EIZO France',
    place: 'La Ciotat',
    contract: 'Alternance',
    fields: ['Développement web', 'E-commerce', 'Design', 'SEO', 'Expériences digitales'],
  },
  intro:
    'Développeur full stack, je transforme mes idées en expériences web, en univers 3D et en projets interactifs.',
  /** Texte de l'île À propos, tel que Kyliann l'a écrit. */
  about:
    'Originaire du Morbihan, en Bretagne, j’ai grandi avec la mer comme horizon. ' +
    'Issu d’une famille de pêcheurs, j’ai finalement choisi une autre forme d’exploration : ' +
    'le développement et la création numérique. ' +
    'Aujourd’hui développeur full stack à Marseille, je transforme mes idées en expériences web, ' +
    'en univers 3D et en projets interactifs. ' +
    'J’aime comprendre comment les choses fonctionnent, expérimenter et repousser les limites de ce que je peux construire.',
  passions: [
    'Développement web',
    'Expériences interactives',
    'Création 3D',
    'Design',
    'Nouvelles technologies',
    'Intelligence artificielle',
  ],
  email: 'lgkyliann@gmail.com',
  links: {
    github: 'https://github.com/IIZAANAAMII-dev',
    linkedin: 'https://www.linkedin.com/in/kyliann-le-garrec-24401a255',
    /**
     * CV : déposer le PDF dans /public puis indiquer son chemin ici
     * (ex. '/cv-kyliann-le-garrec.pdf'). Tant que c'est vide, aucun bouton n'est affiché.
     */
    cv: '' as string,
  },
  url: 'https://kyliann.dev',
};
