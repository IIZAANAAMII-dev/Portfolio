'use client';

import { createContext } from 'react';
import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from 'three';

/**
 * Clairières : l'emprise au sol des bâtiments posés sur une île. L'herbe n'y pousse pas
 * (elle traverserait les planchers). Chaque `SubstanceProp` déclare la sienne à son
 * montage ; l'herbe lit la liste à chaque changement, sans reconstruire ses lames.
 */
export interface Clearing {
  x: number;
  z: number;
  radius: number;
}

export const MAX_CLEARINGS = 12;

export class ClearingStore {
  private items = new Map<number, Clearing>();
  private nextId = 0;
  version = 0;

  add(clearing: Clearing) {
    const id = this.nextId++;
    this.items.set(id, clearing);
    this.version += 1;
    return () => {
      this.items.delete(id);
      this.version += 1;
    };
  }

  /** Les plus grandes d'abord : si l'île en compte trop, les petites sont ignorées. */
  list() {
    return [...this.items.values()].sort((a, b) => b.radius - a.radius).slice(0, MAX_CLEARINGS);
  }
}

export const ClearingContext = createContext<ClearingStore | null>(null);

/** Marque posée sur le groupe racine d'une île (repère des clairières). */
export const CLEARING_ROOT = { clearingRoot: true };

const footprints = new WeakMap<Object3D, Box3>();

/** Boîte englobante d'un modèle dans son propre repère (avant toute pose sur l'île). */
function modelFootprint(model: Object3D) {
  const cached = footprints.get(model);
  if (cached) return cached;
  const box = new Box3();
  const part = new Box3();
  const matrix = new Matrix4();
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    matrix.identity();
    for (let node: Object3D | null = mesh; node; node = node === model ? null : node.parent) {
      node.updateMatrix();
      matrix.premultiply(node.matrix);
    }
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
    box.union(part);
  });
  footprints.set(model, box);
  return box;
}

/**
 * Emprise d'un objet dans le repère de son île : on remonte les parents jusqu'à la racine
 * marquée. Les transformations sont lues localement, ce qui reste juste pendant que l'île
 * est encore à l'échelle zéro (avant la révélation).
 */
export function clearingFor(holder: Object3D, model: Object3D): Clearing | null {
  const matrix = new Matrix4();
  let node: Object3D | null = holder;
  while (node && !node.userData.clearingRoot) {
    node.updateMatrix();
    matrix.premultiply(node.matrix);
    node = node.parent;
  }
  if (!node) return null;
  const box = modelFootprint(model);
  if (box.isEmpty()) return null;
  const center = new Vector3((box.min.x + box.max.x) * 0.5, 0, (box.min.z + box.max.z) * 0.5).applyMatrix4(matrix);
  const scale = new Vector3().setFromMatrixScale(matrix);
  const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * Math.max(scale.x, scale.z);
  return { x: center.x, z: center.z, radius: radius * 0.9 };
}

/**
 * Clairière fixe déclarée par un décor procédural (phare, plateforme…), en coordonnées de
 * l'île. À appeler depuis un effet de montage ; renvoie la fonction de retrait.
 */
export function addClearing(store: ClearingStore | null, x: number, z: number, radius: number) {
  return store ? store.add({ x, z, radius }) : undefined;
}
