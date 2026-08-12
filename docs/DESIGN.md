# Design

## Intention

> Calme, précision, qualité.

L'utilisateur doit d'abord penser « c'est simple », puis remarquer que tout respire,
puis comprendre que le bateau l'emmène quelque part, puis être surpris par l'échelle du
monde. La progression émotionnelle prime sur la densité d'effets.

## Direction artistique

Low-poly stylisé, matériaux mats, pas de textures photoréalistes. Silhouettes lisibles à
petite taille. Le ciel et le brouillard portent l'ambiance ; les objets restent sobres.

## Palette

| Token            | Valeur    | Usage                                  |
| ---------------- | --------- | -------------------------------------- |
| `--abyss`        | `#05080f` | fond de l'intro, vignette              |
| `--deep`         | `#0b1a2b` | océan profond                          |
| `--shallow`      | `#1d5f74` | hauts-fonds près des îles              |
| `--foam`         | `#dff3f5` | écume, sillage                         |
| `--sand`         | `#e8d9b8` | plages                                 |
| `--moss`         | `#5c8c5a` | végétation                             |
| `--stone`        | `#6b6f76` | rochers, pontons                       |
| `--dawn`         | `#f6c99f` | lumière chaude directionnelle          |
| `--ink`          | `#0a0e14` | texte sur fond clair                   |
| `--paper`        | `#f4f1ea` | texte sur fond sombre, panneaux        |

Une seule couleur d'accent par île (voir `src/data/islands.ts`), jamais plus de deux
couleurs vives à l'écran simultanément.

## Typographie

- **Primaire** : *Inter* (variable) — interface, contenu, chiffres tabulaires.
- **Signature** : *Caveat* — uniquement pour les indications manuscrites
  (« Click to start », noms d'îles gravés). Jamais pour du contenu.

Échelle : 12 / 14 / 16 / 20 / 28 / 44 px. Interlignage généreux (1.6 pour le corps).
Lettrage légèrement espacé (`0.08em`) pour les labels en capitales.

## Mouvement

| Type                  | Durée      | Easing                     |
| --------------------- | ---------- | -------------------------- |
| Micro (hover, bouton) | 180–240 ms | `power2.out`               |
| UI (panneau)          | 500–700 ms | `expo.out`                 |
| Caméra                | continu    | lerp exponentiel (damping) |
| World reveal          | ~9 s       | timeline GSAP, `power2.inOut` |

Règles : jamais de bounce, jamais de rotation gratuite, jamais deux animations qui
demandent l'attention en même temps. Toute animation supérieure à 300 ms doit pouvoir
être interrompue.

## Interface

L'UI occupe les marges, jamais le centre. Trois éléments permanents seulement :

```
KYLIANN                                          ⏻ sound   ▤ quick view

                         [ le monde ]

        ABOUT   SKILLS   PROJECTS   EXPERIENCE   JOURNEY   CONTACT
```

- Aucun HUD de jeu, aucune barre de progression, aucune minimap.
- Les panneaux de contenu sont des feuilles `--paper` translucides, coin bas-gauche sur
  desktop, plein écran glissant sur mobile.
- Le curseur change de forme sur les cibles cliquables ; c'est la seule affordance.

## Son

Nappe d'ambiance (océan + vent) à -24 dB, jamais lancée avant un geste utilisateur.
Trois sons d'interaction courts : clic, accostage, ouverture de panneau. Le bouton
sound est visible dès la première frame et l'état est mémorisé (`localStorage`).

## Accessibilité

- `prefers-reduced-motion` : plus de world reveal cinématique (fondu court), caméra fixe
  par île, océan quasi statique.
- Toute île est atteignable au clavier via la barre de navigation (`Tab` + `Enter`).
- Quick View est accessible en un clic depuis n'importe quel état.
- Contraste minimum AA sur tous les textes de panneau.
