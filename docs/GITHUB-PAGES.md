# Publication GitHub Pages

Branche principale : `main`. Elle regroupe tout le travail des anciennes branches
(`claude/happy-lovelace-foxref`, `codex/archipel-navigation-20261114`,
`codex/archipel-art-direction`, `codex/github-pages`, `dev`).

Site : https://iizaanaamii-dev.github.io/Portfolio/

## Publication automatique

À chaque push sur `main`, le workflow `.github/workflows/deploy-pages.yml`
installe les dépendances, lance `npm run build` et publie le dossier `out/`
sur la branche `gh-pages`. Rien à faire à la main.

Le site compilé est publié à la fois sur `gh-pages` et sur `codex/github-pages`
(la branche actuellement servie par GitHub Pages). Le code source est sur `main`.

## Construire en local

```sh
npm ci
npm run build
```

Le site utilise le préfixe `/Portfolio/` pour les images, modèles, textures et
sons. GitHub Pages n'exécute pas de serveur : le contact ouvre la messagerie du
visiteur.
