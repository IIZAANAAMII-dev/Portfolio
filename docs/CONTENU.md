# Modifier le contenu de l'archipel

Tout le texte du portfolio vit dans `src/data/`. Les îles 3D, les panneaux, la version
rapide (recruteurs) et la page HTML lue par les moteurs de recherche lisent les mêmes
fichiers : une modification se répercute partout.

| Fichier | Contenu |
| --- | --- |
| `src/data/site.ts` | Nom, rôle, ville, origine, alternance, texte « À propos », liens (GitHub, LinkedIn, CV). |
| `src/data/journey.ts` | Les 5 étapes de l'île Parcours (repère, titre, texte, côté Bretagne / passage / Marseille). |
| `src/data/skills.ts` | Les 6 zones du labo de l'île Compétences. Chaque technologie est `pro` (utilisée au travail) ou `exploration` (en apprentissage). |
| `src/data/projects.ts` | Les 6 projets de la ville de l'île Projets (statut réel, liens, captures), et le projet caché dans le coffre au trésor. |
| `src/data/experience.ts` | Les expériences de l'île Expériences. |
| `src/data/yellow-static.ts` | L'île secrète et le dossier du jeu Yellow Static. |

Règle d'or : rien n'est inventé. Pas de chiffres, de résultats, de dates ou de
diplômes qui ne viennent pas de toi.

## À vérifier ou compléter

- **CV** : dépose le PDF dans `public/` (ex. `public/cv-kyliann-le-garrec.pdf`) puis
  renseigne `site.links.cv = '/cv-kyliann-le-garrec.pdf'`. Tant que le champ est vide,
  aucun bouton « CV » n'est affiché (pas de lien cassé).
- **Feeder Graphic / Industrie / Défense** : le statut précis de chaque site est à
  indiquer dans `projects.ts` (`parts[].status` : `'in-progress'` ou `'planned'`).
- **Compétences** : vérifie le classement `pro` / `exploration` de chaque technologie.

## Captures des projets

Les écrans 3D de la ville et les panneaux affichent les images listées dans
`projects[].screenshots` (chemins sous `public/`). Les captures actuelles viennent des
pages publiques des sites (feeder.fr, la page « Les Rencontres EIZO 2026 » d'eizo.fr,
clarten-medical.com, cyber.feeder.fr). Pour en ajouter : déposer une image 16:10
(1280 × 800 conseillé, JPEG ~100 Ko) dans `public/projects/<id>/` et l'ajouter au tableau.

## Formulaire « bouteille à la mer »

Le formulaire envoie réellement le message via la route `src/app/api/contact/route.ts`.
La bouteille ne s'éloigne et la confirmation ne s'affiche qu'après un envoi réussi.
Il faut configurer UN fournisseur dans les variables d'environnement (Vercel → Project →
Settings → Environment Variables), jamais dans le code :

- **Resend** (e-mail) : `RESEND_API_KEY` (clé de resend.com). Facultatif :
  `CONTACT_TO_EMAIL` (destinataire, par défaut `site.email`) et `CONTACT_FROM_EMAIL`
  (expéditeur sur un domaine vérifié chez Resend ; par défaut l'adresse de test
  `onboarding@resend.dev`, qui ne livre qu'à l'adresse du compte Resend).
- **ou un webhook** : `CONTACT_WEBHOOK_URL` (Formspree, Slack, Discord, n8n, Make…). Le
  corps JSON contient `name`, `email`, `message`, `subject`, plus `text` (Slack) et
  `content` (Discord).

Sans fournisseur, la route répond 503 et le visiteur voit clairement que le message n'est
pas parti, avec un lien pour l'envoyer depuis sa messagerie. Protection : champ piège
anti-robots, validation, 5 messages / 10 min par adresse IP.

## Aperçus (captures, réglages)

Paramètres d'URL utiles pendant le développement :

- `?section=projects` : accoste directement une île et ouvre son panneau.
- `?solo=projects` : n'affiche que cette île (`solo=static` : l'île secrète, `solo=sea` : la mer).
- `?time=0.75` : fige l'heure (0.45 jour, 0.72 heure dorée, 0.78 crépuscule, 0.9 nuit).
- `?cam=x,y,z,tx,ty,tz` : fige la caméra (position et cible, coordonnées du monde).
- `?quality=high|medium|low` : fige la qualité graphique.

## Où sont les décors

Chaque île a son dossier `src/components/islands/scenes/<île>/` :
`Scene.tsx` (le décor, chargé à part) et `config.ts` (relief, herbe, arbres). Le kit
commun (`src/components/islands/kit.tsx`) pose les objets sur le relief, crée les
panneaux peints, les fenêtres qui s'allument au crépuscule et les objets cliquables.
L'île secrète est dans `src/components/secret/`, les surprises du monde dans
`src/components/world/secrets/` et la vie du port dans `src/components/world/harbor/`.
