# Workflow Blender

## Configuration de la scène

- **Unités** : Metric, Unit Scale `1.0`, Length `Meters`.
- **Échelle de travail** : le bateau principal fait ~3 m de long, une île ~40 m de large.
- **Orientation** : Blender est Z-up, glTF est Y-up. L'exporteur convertit automatiquement
  — modéliser normalement, l'avant de l'objet tourné vers **-Y dans Blender**
  (= -Z dans Three.js).
- **Origine** : `Object > Set Origin > Origin to 3D Cursor`, curseur placé au sol,
  centré sur l'empreinte de l'objet.
- **Transforms** : `Ctrl+A > All Transforms` avant export. Aucune échelle ≠ 1.

## Nommage

```
boat_main            objet racine
  boat_hull
  boat_mast
  boat_sail
mat_boat_wood        matériaux préfixés mat_
```

Pas d'espaces, pas d'accents, pas de `.001`.

## Matériaux

- Principled BSDF uniquement.
- Base Color en couleur unie (les couleurs viennent de `docs/DESIGN.md`).
- Roughness ~0.8, Metallic 0 sauf métal explicite.
- Pas de node procédural : glTF ne les exporte pas. Baker si nécessaire.
- Idéalement **un seul matériau par pack d'objets** → un seul draw call après merge.

## Géométrie

- Budget : bateau < 3 000 tris, arbre < 400, rocher < 200, île < 8 000.
- Flat shading (`Shade Flat`) ou Auto Smooth à 30° pour le rendu facetté.
- Supprimer les faces invisibles (dessous des îles, intérieur des coques).
- Appliquer les modificateurs (Mirror, Subdivision, Array) avant export.

## Textures

Éviter. Si nécessaire : atlas de couleurs 64×64 partagé par tout le pack, filtrage
`Closest`, format PNG puis conversion KTX2 si le poids devient un problème.

## Animations

- Une seule action par objet, nommée `idle`, `open`, `sail`.
- 24 fps, boucle parfaite (première frame = dernière frame).
- Pas d'armature si une simple rotation suffit : l'animer dans le code coûte moins cher.

## Export glTF

`File > Export > glTF 2.0 (.glb)`

| Option                | Valeur                            |
| --------------------- | --------------------------------- |
| Format                | glTF Binary (`.glb`)              |
| Include               | Selected Objects                  |
| Transform             | +Y Up ✔                           |
| Data > Mesh           | Apply Modifiers ✔, UVs ✔, Normals ✔ |
| Data > Mesh           | Tangents ✘, Vertex Colors si utilisées |
| Data > Material       | Export                            |
| Compression (Draco)   | ✔ si > 500 Ko, quantization par défaut |
| Animation             | uniquement si l'objet en a        |

## Optimisation post-export

```bash
npx gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp
npx gltf-transform inspect out.glb   # vérifier tris, matériaux, taille
```

## Intégration

1. Placer le `.glb` dans `public/models/<catégorie>/`.
2. Générer le composant typé : `npx gltfjsx public/models/boat/boat.glb --types --transform`.
3. Remplacer le corps du composant placeholder correspondant (voir `docs/ASSETS.md`).
4. Vérifier : échelle, orientation, ombres, nombre de draw calls, FPS.
5. Documenter la source et la licence dans `docs/ASSETS.md`.
