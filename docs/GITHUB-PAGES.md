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
les dépendances, lance `npm run build` avec `PAGES=1` (export statique sous `/Portfolio`) et publie le dossier `out/` sur la branche
`codex/github-pages`, celle que GitHub Pages sert (Settings → Pages). Rien à faire à la
main. Si la construction échoue, rien n'est publié : le site en ligne reste sur la
version précédente.

`codex/github-pages` ne contient que le site compilé, réécrit à chaque publication. Ce
n'est pas une branche de travail.

## Deux constructions

`next.config.ts` lit deux variables d'environnement :

| Construction | Commande | Résultat |
| ------------ | -------- | -------- |
| Développement, Vercel, tout hébergement avec serveur | `npm run dev`, `npm run build` | site servi à la racine `/`, route serveur `/api/contact` |
| GitHub Pages (le workflow les définit) | `PAGES=1 PAGES_BASE_PATH=/Portfolio npm run build` | export statique dans `out/`, servi sous `/Portfolio/` |

Avec `PAGES=1` : `output: 'export'`, `basePath`, `trailingSlash` et `images.unoptimized`.
Les fichiers `*.server.ts` de `src/app` (la route `/api/contact`) ne sont reconnus qu'en
dehors de cet export (`pageExtensions`).

## Chemins des fichiers de `public/`

Next préfixe ses liens et ses fichiers `/_next/`, jamais les chaînes écrites à la main.
Toute adresse vers `public/` passe donc par `asset()` (`src/lib/asset.ts`) :
`asset('/models/x.glb')` donne `/Portfolio/models/x.glb` sur GitHub Pages et
`/models/x.glb` ailleurs. Le lint (`no-restricted-syntax`) refuse une adresse
`/models/…`, `/audio/…`, `/textures/…`, `/projects/…` écrite en dur dans `src/` ; les
données de `src/data/` gardent des chemins bruts, que leurs consommateurs passent à
`asset()`. Les `url(...)` des fichiers CSS ne sont pas vérifiés : n'y mettre aucune
adresse vers `public/`.

## Fichiers sous licence absents du dépôt

Les modèles Bell Island (`public/models/bell-island/`) et les textures Adobe
(`public/textures/substance-adobe/`) sont sous licence Adobe Substance 3D : ils restent
hors du dépôt public (voir docs/ASSETS.md), donc hors du site publié. Le build GitHub Pages
relève ceux qui sont réellement présents et ne demande jamais les autres : les pontons
prennent leur version en planches, les matériaux leur jeu procédural (`textures/substance/`).

## Contact

GitHub Pages n'exécute pas de serveur. Sur l'île Contact, la « bouteille à la mer »
confie donc le message à la messagerie du visiteur (bouton « Envoyer depuis ma
messagerie », message déjà rédigé) : le site ne prétend jamais l'avoir envoyé.

Pour un envoi direct sur GitHub Pages, définir la variable de dépôt `CONTACT_ENDPOINT`
(Settings → Secrets and variables → Actions → Variables), par exemple une adresse
Formspree : le workflow la passe à la construction (`NEXT_PUBLIC_CONTACT_ENDPOINT`) et le
formulaire y envoie le message en JSON.

Avec un serveur (`npm run dev`, Vercel), le formulaire utilise la route `/api/contact`
(`src/app/api/contact/route.server.ts` → `src/lib/server/contact-route.ts` : e-mail via
Resend ou webhook, selon les variables d'environnement décrites en tête du fichier).
