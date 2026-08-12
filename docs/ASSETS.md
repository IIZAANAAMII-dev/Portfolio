# Assets 3D

## État actuel

Le décor s'appuie sur un seul pack externe, le **Kenney Pirate Kit**, en **CC0**.
Un seul auteur, un seul atlas de couleurs : la cohérence artistique est garantie par
construction et le coût GPU reste minimal.

Le terrain des îles, l'océan et les objets abstraits de l'île SKILLS restent
procéduraux. Chaque modèle importé possède un **repli procédural** : si un `.glb`
manque, la scène perd son habillage mais reste entièrement navigable
(`src/components/world/AssetBoundary.tsx`).

| Asset                                    | Auteur | Source                            | Licence | Attribution  |
| ---------------------------------------- | ------ | --------------------------------- | ------- | ------------ |
| Pirate Kit 2.1 — bateau `ship-small`     | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Pirate Kit 2.1 — pontons, plateformes    | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Pirate Kit 2.1 — palmiers, herbe         | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Pirate Kit 2.1 — rochers                 | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Pirate Kit 2.1 — tours, maisons, toits   | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Pirate Kit 2.1 — tonneaux, caisses, drapeaux | Kenney | https://kenney.nl/assets/pirate-kit | CC0 | Non requise  |
| Atlas `Textures/colormap.png`            | Kenney | https://kenney.nl/assets/pirate-kit | CC0     | Non requise  |
| Fishing Boat IV | gogiart | https://sketchfab.com/3d-models/fishing-boat-iv-8c5e9fbd3b614d3094ea781319ce6a61 | CC-BY 4.0 | Obligatoire |
| Full Low Poly Sea & Ships Pack | Muyaya Concept | https://sketchfab.com/3d-models/full-low-poly-sea-ships-pack-0a770f4c0a854c5ca805831cd5cb2bdd | CC-BY 4.0 | Obligatoire |
| Animated Fish Pack | Quaternius | https://opengameart.org/content/animated-fish | CC0 1.0 | Non requise |

Le crédit n'est pas obligatoire en CC0, mais Kenney est cité dans le README : c'est la
moindre des choses, et cela évite toute ambiguïté sur la provenance.

La licence d'origine est conservée telle quelle dans
`public/models/pirate-kit/LICENSE-kenney.txt`.

### Packs évalués et écartés

- **Quaternius Pirate Kit** (CC0) : excellent, mais mélanger deux auteurs sur les mêmes
  îles produirait deux niveaux de détail différents. À reconsidérer si un objet
  spécifique manque.
- **Kenney Nature Kit** (CC0) : arbres tempérés sans texture d'atlas. Introduirait un
  second matériau et une palette différente de celle du kit principal.

## Règle de licence

Avant d'intégrer un modèle externe :

1. vérifier que l'usage **commercial** est autorisé ;
2. vérifier si l'attribution est **obligatoire** ;
3. télécharger le fichier localement (jamais de hotlink) ;
4. ajouter une ligne au tableau ci-dessus **dans le même commit** ;
5. si la licence est inconnue ou ambiguë → ne pas utiliser.

Sources privilégiées (CC0 ou usage commercial explicite) : Quaternius, Kenney,
itch.io (licence lue au cas par cas), Sketchfab filtré sur CC0/CC-BY.

## Organisation

```
public/models/
  pirate-kit/            31 modèles .glb du Kenney Pirate Kit
    Textures/
      colormap.png       atlas partagé par tous les modèles du kit
    LICENSE-kenney.txt
```

Les modèles d'un même kit restent **groupés dans un seul dossier** : ils référencent
l'atlas en chemin relatif (`Textures/colormap.png`), qui n'est donc téléchargé et
téléversé au GPU qu'une seule fois. Les répartir par catégorie obligerait à dupliquer
la texture.

Un pack provenant d'un autre auteur aurait son propre dossier
(`public/models/<nom-du-kit>/`), jamais mélangé.

Format : `.glb` uniquement, Draco ou Meshopt si > 500 Ko. Le kit complet pèse 885 Ko,
compression inutile à ce stade.

Les noms de fichiers sont exposés via une constante typée, `MODEL` dans
`src/lib/models.ts` : aucun chemin d'asset n'est écrit en dur dans un composant.

## Convention d'intégration

| Règle       | Valeur                                                       |
| ----------- | ------------------------------------------------------------ |
| Unité       | 1 unité Three.js = 1 mètre                                    |
| Orientation | -Z vers l'avant, +Y vers le haut                              |
| Origine     | au sol, centrée (le pivot du bateau est au centre de la coque)|
| Échelle     | appliquée dans Blender, jamais dans le code                   |
| Matériaux   | un seul matériau par objet quand c'est possible               |
| Nommage     | `kebab-case.glb`, meshes en `snake_case`                      |

## Cohérence artistique

Un asset n'est intégré que s'il respecte : low-poly, faces planes (flat shading ou
normales dures), pas de texture photo, palette compatible avec `docs/DESIGN.md`,
proportions légèrement stylisées. Sinon, il est retravaillé dans Blender ou écarté.

## Intégrer ou remplacer un modèle

1. Ajouter le nom du fichier à `MODEL` dans `src/lib/models.ts`.
2. L'utiliser via `<Prop name={MODEL.x} />` (objet unique) ou via les helpers de
   `src/components/islands/decor.tsx` (végétation instanciée).
3. Envelopper le sous-arbre dans `<AssetBoundary fallback={…}>` pour garantir le repli.

L'orientation de l'asset est corrigée **à un seul endroit**. Exemple pour le bateau :
le modèle a sa proue vers +Z, la navigation raisonne en « avant = +X », la rotation d'un
quart de tour vit dans `BoatModel.tsx` et nulle part ailleurs. Aucun autre composant
n'a besoin de savoir comment le fichier a été exporté.

Pour un modèle multi-mesh (le bateau et ses voiles), utiliser `useModelScene` et cloner
la scène ; pour un modèle mono-mesh, `useModelPart` renvoie géométrie et matériau, ce
qui permet de l'instancier.
