# Architecture

## Vue d'ensemble

Le portfolio n'est pas un site avec une scène 3D : c'est **une expérience 3D qui contient
le portfolio**. L'application est donc structurée autour d'une machine à états unique
(`worldStore`) qui pilote à la fois la scène WebGL et l'interface DOM.

```
Loading  ->  Intro  ->  Reveal  ->  Sailing  <->  Docked
                                       ^            |
                                       +------------+
```

| Phase      | Scène 3D                                   | UI                          |
| ---------- | ------------------------------------------ | --------------------------- |
| `loading`  | assets / première frame                    | écran « Preparing the world » |
| `intro`    | caméra proche, brouillard dense, 1 île      | « Click to start »          |
| `reveal`   | caméra recule, brouillard se dissipe        | rien                        |
| `sailing`  | monde complet, bateau libre                 | nav discrète                |
| `docked`   | caméra cadrée sur une île                   | panneau de contenu          |

## Stack

| Choix                     | Raison                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| **Next.js 16 (App Router)** | SEO/metadata natifs, rendu serveur du contenu texte, déploiement Vercel |
| **TypeScript**            | contenu data-driven fortement typé                                      |
| **React Three Fiber**     | la scène devient déclarative et se synchronise avec l'état React        |
| **drei**                  | helpers éprouvés (Environment, Float, Html, useGLTF, PerfMonitor)       |
| **Zustand**               | store minuscule, lisible hors React (utile dans `useFrame`)             |
| **Tailwind v4**           | UI premium sans dette CSS, tokens centralisés dans `globals.css`        |
| **GSAP**                  | timelines cinématiques (world reveal) — sequencing précis               |

> Le canvas est chargé via `next/dynamic` avec `ssr: false` : WebGL n'existe pas côté
> serveur, et cela garde le HTML initial (contenu SEO) léger.

## Arborescence

```
src/
  app/
    layout.tsx           metadata, fonts, providers
    page.tsx             Server Component : contenu SEO + monte l'expérience
  components/
    experience/          point d'entrée client (Canvas, fallback, DPR)
    world/               océan, ciel, brouillard, archipel
    islands/             une île générique pilotée par la data
    boat/                bateau + sillage
    camera/              rig caméra (lerp, cadrage, parallax)
    transitions/         world reveal, fades
    ui/                  loader, intro, nav, panneaux, sound, quick view
  data/                  projects / skills / experience / journey / islands / site
  hooks/                 useBoatNavigation, useWorldReveal, useInteraction, ...
  lib/
    store.ts             machine à états zustand
    animations/          easings, helpers gsap
    audio/               gestionnaire audio (respect autoplay policy)
    utils/               math, device, webgl detection
  types/
public/
  models/  textures/  audio/  fonts/
docs/
```

## Principes

1. **Data-driven** — aucun texte de contenu n'est écrit dans un composant 3D.
   Tout vient de `src/data/*`. Changer un projet = éditer un objet TypeScript.
2. **Un seul `useFrame` par responsabilité** — bateau, caméra, océan. Pas de state
   React modifié à 60 fps : les valeurs continues vivent dans des `useRef`.
3. **Dégradation garantie** — pas de WebGL, `prefers-reduced-motion`, mobile faible ou
   erreur d'asset : l'expérience bascule sur **Quick View**, une version DOM complète.
4. **Aucune information n'est prisonnière du canvas** — le contenu est aussi rendu en
   HTML (visuellement masqué mais lisible par les crawlers et lecteurs d'écran).
5. **Placeholders procéduraux** — le monde fonctionne sans un seul `.glb`. Les modèles
   Blender viendront remplacer des composants isolés (`<Boat/>`, `<IslandMesh/>`), sans
   toucher à la logique.

## Flux d'une interaction

```
clic sur une île
  -> useInteraction : raycast R3F (onClick du mesh)
  -> worldStore.sailTo(islandId)
  -> useBoatNavigation : cible = dock de l'île, courbe de Bézier, rotation progressive
  -> CameraRig : suit le bateau (offset lerpé)
  -> arrivée : worldStore.dock(islandId)
  -> CameraRig cadre l'île ; le panneau DOM apparaît
  -> fermeture : worldStore.undock() -> retour en phase sailing
```

## Deep linking

`/?section=projects` — lu au montage, l'expérience saute la révélation et démarre en
phase `docked` sur l'île concernée. La navigation met à jour l'URL sans rechargement
(`history.replaceState`) pour que l'utilisateur puisse partager une section.

## Performance

- DPR plafonné (`[1, 2]` desktop, `[1, 1.5]` mobile)
- une seule directionnelle avec shadow map, le reste en lumières non-ombrées
- océan = 1 plan + shader vertex (pas de géométrie lourde ni de simulation CPU)
- végétation instanciée (`InstancedMesh`) par île
- `frameloop="demand"` non utilisé (monde vivant) mais `PerformanceMonitor` ajuste le DPR
- pas de post-processing tant que le budget 60 fps n'est pas confortable
