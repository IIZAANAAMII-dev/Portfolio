# Publication GitHub Pages

Site : https://iizaanaamii-dev.github.io/Portfolio/

## Une seule branche

Tout le code est sur la branche principale du dépôt, `Portfolio`. Elle regroupe le
travail de toutes les anciennes branches (`claude/happy-lovelace-foxref`,
`codex/archipel-navigation-20261114`, `codex/archipel-art-direction`, la préparation
GitHub Pages, `dev`), qui ont été supprimées une fois fusionnées : leurs commits font
partie de l'historique de `Portfolio`.

## Publication automatique

À chaque push sur `Portfolio`, le workflow `.github/workflows/deploy-pages.yml` installe
les dépendances, lance `npm run build` et publie le dossier `out/` sur la branche
`codex/github-pages`, celle que GitHub Pages sert (Settings → Pages). Rien à faire à la
main. Si la construction échoue, rien n'est publié : le site en ligne reste sur la
version précédente.

`codex/github-pages` ne contient que le site compilé, réécrit à chaque publication. Ce
n'est pas une branche de travail.

## Construire en local

```sh
npm ci
npm run build
```

Le site utilise le préfixe `/Portfolio/` pour les images, modèles, textures et sons.

## Contact

GitHub Pages n'exécute pas de serveur. Sur l'île Contact, la « bouteille à la mer »
ouvre donc la messagerie du visiteur avec son message déjà rédigé.

L'envoi direct existe toujours dans le code, en sommeil :

- `src/lib/server/contact-route.ts` : la route serveur (e-mail via Resend ou webhook),
  à brancher sur un hébergement avec serveur — la marche à suivre est en tête du fichier.
- `NEXT_PUBLIC_CONTACT_ENDPOINT` : si cette variable est définie à la construction, le
  formulaire envoie le message en JSON à cette adresse au lieu d'ouvrir la messagerie.
