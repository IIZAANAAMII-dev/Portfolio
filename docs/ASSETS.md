# Assets 3D

## État actuel

**Aucun asset externe n'est utilisé pour le moment.** L'intégralité du monde
(île, bateau, ponton, arbres, rochers, océan) est générée proceduralement avec des
primitives Three.js dans `src/components/`. Cela garantit que le projet fonctionne sans
dépendance de licence et qu'aucun développement n'est bloqué par un modèle manquant.

| Asset  | Auteur | Source | Licence | Attribution |
| ------ | ------ | ------ | ------- | ----------- |
| _(aucun)_ | — | — | — | — |

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
  boat/          bateau principal, barque secondaire
  environment/   îles, terrain, pontons
  nature/        arbres, buissons, rochers, herbe
  buildings/     phare, cabanes, structures projets
  props/         caisses, bancs, lampadaires, panneaux
```

Format : `.glb` uniquement, Draco ou Meshopt si > 500 Ko.

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

## Remplacement d'un placeholder

Chaque objet procédural est isolé dans son propre composant. Pour passer au modèle réel,
seul le corps du composant change :

```tsx
// avant
<mesh geometry={hullGeometry} material={hullMaterial} />
// après
const { scene } = useGLTF('/models/boat/boat.glb')
<primitive object={scene} />
```

La logique (navigation, oscillation, sillage) reste inchangée. Si le chargement échoue,
le composant retombe sur sa version procédurale via une `ErrorBoundary`.
