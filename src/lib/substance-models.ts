'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FrontSide,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { MODEL_MATERIALS, type SlotSpec, type SubstanceModelName } from './materials/model-materials';
import { getSubstanceMaterial } from './materials/substance-material';

/**
 * Accès aux modèles Substance 3D (collection Bell Island + bateau), produits par
 * `npm run assets:models` dans public/models/bell-island/ (voir docs/ASSETS.md).
 *
 * Les fichiers sont compressés (EXT_meshopt_compression) : useGLTF de drei les décode
 * nativement. Les matériaux d'origine sont neutres ; chaque emplacement est remplacé ici
 * par son habillage défini dans `lib/materials/model-materials.ts`.
 */
const BASE = '/models/bell-island';

export function substanceModelUrl(name: SubstanceModelName) {
  return `${BASE}/${name}.glb`;
}

function isMesh(object: Object3D): object is Mesh {
  return (object as Mesh).isMesh === true;
}

const paintCache = new Map<string, MeshStandardMaterial>();

/**
 * Matériaux qui s'allument la nuit (vitres, lampes, écrans) : intensité émissive de jour
 * et de nuit. Un seul composant (NightGlow) les met à jour depuis le cycle du ciel.
 */
export const nightGlow = new Map<MeshStandardMaterial, { day: number; night: number }>();

function paintMaterial(spec: Extract<SlotSpec, { paint: string }>) {
  const key = JSON.stringify(spec);
  let material = paintCache.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color: spec.paint,
      roughness: spec.roughness ?? 0.85,
      metalness: spec.metalness ?? 0,
      emissive: spec.emissive ?? '#000000',
      emissiveIntensity: spec.emissiveIntensity ?? 1,
      transparent: spec.transparent ?? false,
      opacity: spec.opacity ?? 1,
      side: spec.double ? DoubleSide : FrontSide,
    });
    material.name = `paint:${spec.paint}`;
    paintCache.set(key, material);
    if (spec.night !== undefined) nightGlow.set(material, { day: spec.emissiveIntensity ?? 0, night: spec.night });
  }
  return material;
}

/** Matériau final d'un emplacement ; l'original reste intact (il est en cache dans useGLTF). */
export function resolveSlotMaterial(model: SubstanceModelName, source: Material): Material {
  const slot = (source.userData.slot as string | undefined) ?? source.name;
  const spec = MODEL_MATERIALS[model][slot];
  if (!spec) return source;
  if ('substance' in spec) {
    const uvDensity = source.userData.uvDensity as number | undefined;
    return getSubstanceMaterial(spec.substance, { ...spec.options, uvDensity });
  }
  return paintMaterial(spec);
}

/**
 * Scène complète et habillée, clonée pour pouvoir être posée plusieurs fois.
 * Géométries et matériaux restent partagés entre clones.
 */
export function useSubstanceModel(name: SubstanceModelName) {
  const { scene } = useGLTF(substanceModelUrl(name));
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!isMesh(child)) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => resolveSlotMaterial(name, material))
        : resolveSlotMaterial(name, child.material);
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene, name]);
}

export interface SubstancePiece {
  name: string;
  geometry: BufferGeometry;
  material: Material;
  /** Dimensions de la pièce, en mètres. */
  size: Vector3;
}

/**
 * Copie flottante d'une géométrie quantifiée (KHR_mesh_quantization), avec la transform du
 * nœud appliquée : indispensable pour instancier une pièce hors de sa hiérarchie.
 */
function bakedGeometry(mesh: Mesh) {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const attribute = source.getAttribute(name);
    if (!attribute) continue;
    const array = new Float32Array(attribute.count * attribute.itemSize);
    for (let index = 0; index < attribute.count; index++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        array[index * attribute.itemSize + component] = attribute.getComponent(index, component);
      }
    }
    geometry.setAttribute(name, new BufferAttribute(array, attribute.itemSize));
  }
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Pièces individuelles d'un modèle (lots de rochers, clôtures, touffes de fleurs…), prêtes
 * pour l'instanciation : une géométrie et un matériau par pièce.
 */
export function useSubstancePieces(name: SubstanceModelName): SubstancePiece[] {
  const { scene } = useGLTF(substanceModelUrl(name));
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const pieces: SubstancePiece[] = [];
    scene.traverse((child) => {
      if (!isMesh(child) || Array.isArray(child.material)) return;
      const geometry = bakedGeometry(child);
      const size = (geometry.boundingBox ?? new Box3()).getSize(new Vector3());
      pieces.push({ name: child.name, geometry, material: resolveSlotMaterial(name, child.material), size });
    });
    return pieces;
  }, [scene, name]);
}

export function preloadSubstanceModels(names: SubstanceModelName[]) {
  names.forEach((name) => useGLTF.preload(substanceModelUrl(name)));
}
