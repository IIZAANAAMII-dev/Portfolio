# Publication GitHub Pages

Source : `codex/github-pages`, adaptée depuis `claude/happy-lovelace-foxref` au commit `161db90`.
Site prévu : https://iizaanaamii-dev.github.io/Portfolio/

La branche `gh-pages` contient uniquement l'export compilé. Dans Settings → Pages, sélectionner **Deploy from a branch**, branche **gh-pages**, dossier **/(root)**, puis Save.

## Construire

```sh
npm ci
npm run build
```

Le dossier `out/` contient le site à publier à la racine de `gh-pages`, y compris `.nojekyll` et `_next/`.
Les mises à jour de Claude ne sont pas publiées automatiquement : reporter ses changements sur cette branche, reconstruire puis mettre à jour `gh-pages`.

Le site utilise le préfixe `/Portfolio/` pour les images, modèles, textures et sons. GitHub Pages n'exécute pas de serveur : le contact ouvre la messagerie du visiteur. La route serveur est conservée sur la branche de Claude.
