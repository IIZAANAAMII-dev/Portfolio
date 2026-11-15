# Kyliann Le Garrec — Portfolio

**En ligne : https://iizaanaamii-dev.github.io/Portfolio/**

Un portfolio à explorer en bateau : un petit archipel en 3D où chaque île est une partie
de mon travail (À propos, Compétences, Projets, Expériences, Parcours, Contact), avec un
carnet de bord, des tampons à collectionner et quelques secrets cachés en mer. Une
« version rapide » en HTML classique est disponible à tout moment pour aller droit au
contenu.

## Technique

Next.js 16 (export statique) · TypeScript · React Three Fiber / three.js · drei ·
Zustand · GSAP · Tailwind CSS v4.

## Lancer le projet

```sh
npm ci
npm run dev      # http://localhost:3000/Portfolio/
npm run build    # site statique dans out/
```

## Une seule branche

Tout le code est sur la branche principale du dépôt, **`Portfolio`**. Il n'y a pas
d'autre branche de travail : chaque modification y est poussée directement.

À chaque push, GitHub construit le site et le publie tout seul (voir
[docs/GITHUB-PAGES.md](docs/GITHUB-PAGES.md)). La branche `codex/github-pages` n'est pas
une branche de travail : elle contient uniquement le site compilé servi par GitHub Pages.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Design](docs/DESIGN.md) · [Audit](docs/AUDIT.md)
- [Contenu](docs/CONTENU.md) · [Assets](docs/ASSETS.md) · [Blender](docs/BLENDER.md)
- [Feuille de route](docs/ROADMAP.md) · [Publication](docs/GITHUB-PAGES.md)
