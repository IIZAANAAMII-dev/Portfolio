'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';

/**
 * Accès aux modèles du Kenney Pirate Kit (CC0 — voir docs/ASSETS.md).
 *
 * Tout le kit partage un seul atlas de couleurs (`Textures/colormap.png`) et donc un
 * seul matériau : les modèles restent groupés dans un même dossier pour que la texture
 * ne soit téléchargée et téléversée au GPU qu'une seule fois.
 */
const BASE = '/models/pirate-kit';

export const MODEL = {
  ship: 'ship-small',
  rowBoat: 'boat-row-small',
  dock: 'structure-platform-dock',
  dockSmall: 'structure-platform-dock-small',
  platform: 'platform',
  palm: 'palm-detailed-straight',
  palmBend: 'palm-detailed-bend',
  grass: 'grass-plant',
  grassPatch: 'patch-grass',
  sandPatch: 'patch-sand',
  rockA: 'rocks-a',
  rockB: 'rocks-b',
  rockC: 'rocks-c',
  shoreRockA: 'rocks-sand-a',
  shoreRockB: 'rocks-sand-b',
  pennant: 'flag-pennant',
  paddle: 'tool-paddle',
  lighthouse: 'tower-complete-small',
  watchtower: 'tower-watch',
  towerBase: 'tower-base',
  house: 'structure',
  roof: 'structure-roof',
  fence: 'structure-fence',
  barrel: 'barrel',
  crate: 'crate',
  chest: 'chest',
  flag: 'flag',
} as const;

export type ModelName = (typeof MODEL)[keyof typeof MODEL];

function url(name: ModelName) {
  return `${BASE}/${name}.glb`;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

/**
 * Renvoie la géométrie et le matériau du premier mesh du fichier. Les modèles du kit
 * sont mono-mesh : cela permet de les instancier directement (voir Scatter).
 */
export function useModelPart(name: ModelName): {
  geometry: BufferGeometry;
  material: Material;
} {
  const { scene } = useGLTF(url(name));
  // grass-plant porte le même atlas que le reste du kit et sert de matériau canonique.
  // useGLTF met cette scène en cache : tous les composants reçoivent donc le même objet.
  const { scene: atlasScene } = useGLTF(url(MODEL.grass));
  const mesh = useMemo(() => {
    let result: Mesh | null = null;
    scene.traverse((child) => {
      if (!result && isMesh(child)) result = child;
    });
    return result;
  }, [scene]);
  const atlasMesh = useMemo(() => {
    let result: Mesh | null = null;
    atlasScene.traverse((child) => {
      if (!result && isMesh(child)) result = child;
    });
    return result;
  }, [atlasScene]);
  if (!mesh) throw new Error(`Aucun mesh dans ${name}.glb`);
  if (!atlasMesh) throw new Error(`Aucun matériau partagé dans ${MODEL.grass}.glb`);
  const found = mesh as Mesh;
  const atlas = atlasMesh as Mesh;
  // Les fichiers Kenney utilisent tous le même atlas. Réutiliser réellement le premier
  // matériau empêche chaque GLB d'envoyer une copie identique de la texture au GPU.
  return { geometry: found.geometry, material: atlas.material as Material };
}

/** Scène complète, pour les modèles multi-mesh (le bateau et ses voiles). */
export function useModelScene(name: ModelName) {
  const { scene } = useGLTF(url(name));
  return scene;
}

export function preloadModels(names: ModelName[]) {
  names.forEach((name) => useGLTF.preload(url(name)));
}
