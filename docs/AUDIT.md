# Audit de l'expérience — novembre 2026

Revue complète du portfolio 3D (intro, navigation, îles, eau, ciel, faune, interface,
performances), à partir de captures de chaque vue et d'une relecture du code. Chaque
constat est suivi de la décision prise ; la colonne « Lot » renvoie au plan en fin de page.

## 1. Ce qui fonctionne

- **Intro** : seuil cartographique, anneau de chargement réel, chute du bateau, onde de
  dévoilement. Identité forte, originale, cohérente avec le thème marin.
- **Direction artistique** : cel-shading, ombres violettes, relief peint (sable, strates,
  herbe), herbe en lames, arbres à feuillage, mer turquoise. Lisible et chaleureux.
- **Îlots de personnalité** (Breizh, High-tech, Design) : la meilleure idée du site ;
  chaque élément raconte quelque chose de Kyliann.
- **Couche de jeu** : carnet de bord, étoiles d'or, carte de voyage téléchargeable,
  bouteille à la mer. Donne une raison d'explorer et un souvenir à emporter.
- **Son** : moteur, chocs, cloche, motifs, tout en procédural (zéro fichier audio ajouté).

## 2. Constats et décisions

| # | Constat | Gravité | Décision | Lot |
|---|---|---|---|---|
| 1 | Cliquer sur la mer ne montre ni cible ni trajet : le geste principal n'a pas de retour visuel. | Haute | Repère de destination sur l'eau (anneau qui pulse, petite bouée) et tracé pointillé de la route prévue. | A |
| 2 | Lien direct vers une île : le bateau reste au port de départ, l'île est à quai sans bateau. | Haute | Le bateau est amarré au ponton de l'île visée. | A |
| 3 | Les îles Compétences, Projets, Expériences et Parcours se ressemblent (plateau vert, arbres) et leurs décors ne disent rien de leur contenu. | Haute | Une métaphore par île, construite depuis les données : l'Atelier (4 totems de compétences), le Chantier naval (un bateau par projet), les Phares (un phare par poste), le Sentier (un panneau par étape). | B |
| 4 | Libellés du HUD (nom, navigation) peu lisibles sur l'eau claire. | Moyenne | Ombre portée et voile dégradé discret derrière la navigation. | A |
| 5 | Eau : belle couleur, mais peu « dessin animé » au large. | Moyenne | Remous blancs stylisés qui apparaissent et s'effacent, écume de rivage plus franche, ombres de nuages qui glissent sur la mer et les îles. Les couleurs actuelles, appréciées, ne changent pas. | C |
| 6 | Ciel rarement visible, nuit peu marquée. | Moyenne | Nuit étoilée (étoiles qui scintillent, lune), nuages cotonneux à l'horizon. | C |
| 7 | Bateau : textures bois réalistes, en décalage avec le reste plus « peint ». | Moyenne | Matériaux du bateau plus peints (couleurs franches, grain très adouci). | C |
| 8 | Bancs de poissons : 3 draw calls par banc, flocking sur le CPU, peu visibles. | Moyenne | Poissons de récif animés entièrement sur le GPU, colorés, visibles dans les lagons, qui s'écartent du bateau. | D |
| 9 | Pas d'indicateur du cycle jour/nuit. | Basse | Cadran soleil/lune dans le HUD. | D |
| 10 | Performances : beaucoup de systèmes, mais presque tous instanciés et animés sur le GPU ; le gouverneur de qualité reste le garde-fou. | Info | Toute nouveauté doit tenir en 1 à 3 draw calls, sans boucle CPU par instance. | — |

## 3. Plan

- **Lot A — Retours de navigation** : repère de destination, route prévue, bateau au
  ponton en lien direct, lisibilité du HUD.
- **Lot B — Îles-métaphores** : l'Atelier, le Chantier naval, les Phares, le Sentier,
  générés depuis `data/skills.ts`, `data/projects.ts`, `data/experience.ts`,
  `data/journey.ts` (modifier les données met à jour les îles).
- **Lot C — Ambiance** : eau stylisée, ombres de nuages, nuit étoilée, bateau peint.
- **Lot D — Vie et cycle** : poissons de récif GPU, cadran du cycle.

## 4. Règles de la direction artistique

- Couleurs franches et peu nombreuses par objet ; le détail vient de la lumière (rampe
  cel-shading, ombres violettes), pas du bruit des textures.
- Formes rondes ou facettées nettes, jamais réalistes ; échelle « jouet ».
- Tout ce qui bouge est animé sur le GPU quand c'est possible ; aucun nouveau fichier
  lourd (modèles et sons sont procéduraux).
- Chaque élément de décor doit raconter quelque chose du contenu ou de Kyliann.
