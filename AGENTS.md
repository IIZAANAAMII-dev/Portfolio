<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Une seule branche : `Portfolio`

Tout le code vit sur la branche principale du dépôt, `Portfolio` — pour Claude, Codex et
toute autre session. C'est une demande explicite du propriétaire du dépôt.

- Partir de `Portfolio` à jour et y pousser directement. Ne pas laisser de branche de
  travail : si une branche temporaire est indispensable, la fusionner dans `Portfolio`
  puis la supprimer dans la même session.
- Chaque push sur `Portfolio` construit le site et le publie tout seul
  (`.github/workflows/deploy-pages.yml`). Vérifier que la tâche est verte après un push.
- `codex/github-pages` n'est pas une branche de travail : elle contient le site compilé
  que GitHub Pages sert, réécrit à chaque publication. Ne jamais y pousser à la main.
- Si la branche principale est un jour renommée `main` dans GitHub, les workflows
  continuent de fonctionner (ils acceptent les deux noms) : mettre ce fichier à jour.

# Adresses des fichiers de `public/`

Le site publié vit sous `/Portfolio/` (GitHub Pages) mais `next dev` sert à la racine.
Toute adresse vers `public/` (modèles, textures, sons, captures…) passe par `asset()` de
`src/lib/asset.ts` — jamais `'/models/…'` écrit en dur (le lint le refuse). Vérifier un
changement de publication avec `PAGES=1 PAGES_BASE_PATH=/Portfolio npx next build`
(voir docs/GITHUB-PAGES.md).
