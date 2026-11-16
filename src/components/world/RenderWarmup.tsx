'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Material,
  PointLight,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { perfOff, QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';

/*
 * Préparation du rendu, invisible : aucun pixel ne change, seules les saccades disparaissent.
 *
 * 1. Nombre de lumières ponctuelles constant. three.js compile une variante de chaque
 *    matériau éclairé par nombre de lumières : une lumière qui apparaît ou disparaît (île
 *    encore invisible pendant l'ouverture, bateau qui tombe à l'eau, orage qui se lève…)
 *    fait recompiler TOUS les matériaux visibles d'un coup (à-coup de plusieurs centaines
 *    de millisecondes, des secondes sur certains pilotes). Des lumières de réserve, éteintes
 *    (intensité nulle), prennent la place de celles qu'un parent invisible cache : le compte
 *    ne bouge plus. (Aucune en qualité basse : il n'y a alors aucune lumière ponctuelle.)
 * 2. Préchauffage pendant l'écran d'accueil : tous les matériaux de la scène, îles encore
 *    invisibles comprises, sont compilés en tâche de fond (KHR_parallel_shader_compile) et
 *    les textures envoyées au GPU avant le clic : l'ouverture n'a plus rien à compiler.
 */

const SPARES = 6;

/** Lumières ponctuelles de la scène (hors réserves), relevées de temps en temps. */
function collectLights(scene: Scene, spares: PointLight[], out: PointLight[]) {
  out.length = 0;
  scene.traverse((object) => {
    const light = object as PointLight;
    if (light.isPointLight && !spares.includes(light)) out.push(light);
  });
}

function LightCountKeeper() {
  const getState = useThree((state) => state.get);
  const spares = useMemo(
    () =>
      Array.from({ length: SPARES }, () => {
        const light = new PointLight(0x000000, 0, 1, 2);
        light.visible = false;
        light.castShadow = false;
        light.position.set(0, -4000, 0);
        return light;
      }),
    [],
  );

  useEffect(() => {
    const scene = getState().scene;
    const lights: PointLight[] = [];
    collectLights(scene, spares, lights);
    let tick = 0;
    const previous = scene.onBeforeRender;
    // Juste avant le rendu (tous les useFrame sont passés) : la visibilité est définitive.
    scene.onBeforeRender = function keepLightCount(...args) {
      tick += 1;
      if (tick % 45 === 0) collectLights(scene, spares, lights);
      let pending = 0;
      for (let index = 0; index < lights.length; index++) {
        const light = lights[index];
        if (!light.visible || light.castShadow) continue;
        let node: Object3D | null = light.parent;
        let hidden = false;
        let attached = false;
        while (node) {
          if (!node.visible) hidden = true;
          if (node === scene) {
            attached = true;
            break;
          }
          node = node.parent;
        }
        if (attached && hidden) pending += 1;
      }
      for (let index = 0; index < spares.length; index++) spares[index].visible = index < pending;
      previous.apply(this, args);
    };
    return () => {
      scene.onBeforeRender = previous;
    };
  }, [getState, spares]);

  return (
    <group>
      {spares.map((light, index) => (
        <primitive key={index} object={light} />
      ))}
    </group>
  );
}

const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'emissiveMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'gradientMap',
  'specularMap',
  'displacementMap',
] as const;

function isReady(texture: Texture) {
  const image = texture.image as { complete?: boolean } | null | undefined;
  return Boolean(image) && image?.complete !== false && texture.version > 0;
}

/** Envoie au GPU les textures pas encore transmises (une fois chacune). */
function uploadTextures(gl: WebGLRenderer, scene: Object3D) {
  const seen = new Set<Texture>();
  const consider = (value: unknown) => {
    const texture = value as Texture | null;
    if (!texture || !texture.isTexture || seen.has(texture)) return;
    seen.add(texture);
    if (!isReady(texture) || (texture as { isRenderTargetTexture?: boolean }).isRenderTargetTexture) return;
    const properties = gl.properties.get(texture) as { __version?: number };
    if (properties.__version === texture.version) return;
    try {
      gl.initTexture(texture);
    } catch {
      // Texture exotique : elle partira au premier rendu, comme avant.
    }
  };
  scene.traverse((object) => {
    const material = (object as { material?: Material | Material[] }).material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) {
      const record = item as unknown as Record<string, unknown>;
      for (const slot of TEXTURE_SLOTS) consider(record[slot]);
      const uniforms = record.uniforms as Record<string, { value: unknown }> | undefined;
      if (uniforms) for (const key in uniforms) consider(uniforms[key]?.value);
    }
  });
}

/** Branches de la scène d'au plus `limit` maillages (compilation en plusieurs fois). */
function branches(root: Object3D, limit = 60) {
  const out: Object3D[] = [];
  const visit = (node: Object3D) => {
    let meshes = 0;
    let light = false;
    node.traverse((object) => {
      if ((object as Drawable).isMesh) meshes += 1;
      if ((object as { isLight?: boolean }).isLight) light = true;
    });
    // Une branche qui porte une lumière se compile avec la scène entière (sinon la lumière
    // serait comptée deux fois et le programme ne servirait pas).
    if (light && node.children.length === 0) return;
    if ((meshes <= limit && !light) || node.children.length === 0) {
      if (meshes > 0) out.push(node);
      return;
    }
    for (const child of node.children) visit(child);
  };
  for (const child of root.children) visit(child);
  return out;
}

function ShaderWarmup() {
  const getState = useThree((state) => state.get);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let seen = -1;
    let timer = 0;
    let queue: Object3D[] = [];
    // Lueurs (haute qualité) : la scène est rendue dans une cible du post-traitement, ses
    // programmes sont ceux d'une cible (sans tone mapping, espace linéaire).
    const target = new WebGLRenderTarget(1, 1);
    const pass = () => {
      if (cancelled) return;
      const { phase, quality } = useWorld.getState();
      // Après le clic, la cinématique compile elle-même ce qui manquerait encore.
      if (phase !== 'loading' && phase !== 'intro') return;
      const { gl, scene, camera } = getState();
      let materials = 0;
      scene.traverse((object) => {
        const material = (object as { material?: Material | Material[] }).material;
        if (material) materials += Array.isArray(material) ? material.length : 1;
      });
      if (materials !== seen && queue.length === 0) {
        seen = materials;
        // Compilation parallèle disponible : tout part en tâche de fond d'un coup. Sinon,
        // une branche par passage (des à-coups courts plutôt qu'un long gel de l'accueil),
        // puis la scène entière pour ce qui reste.
        queue = gl.extensions.has('KHR_parallel_shader_compile') ? [scene] : [...branches(scene), scene];
      }
      const next = busy ? undefined : queue.shift();
      if (next) {
        busy = true;
        const bloom = QUALITY_LEVELS[quality].bloom;
        const previous = gl.getRenderTarget();
        let compiling: Promise<unknown> = Promise.resolve();
        try {
          if (bloom) gl.setRenderTarget(target);
          compiling = gl.compileAsync(next, camera, scene);
        } catch {
          // Un matériau mal formé n'empêche pas les autres de se compiler au premier rendu.
        } finally {
          if (bloom) gl.setRenderTarget(previous);
        }
        uploadTextures(gl, next);
        compiling.catch(() => undefined).finally(() => {
          busy = false;
        });
      }
      timer = window.setTimeout(pass, queue.length > 0 ? 260 : 900);
    };
    timer = window.setTimeout(pass, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      target.dispose();
    };
  }, [getState]);

  return null;
}

/*
 * 3. Un programme par matériau. three.js garde un programme courant par matériau : quand le
 *    même matériau sert à des objets de « signatures » différentes (maillage simple ou
 *    instancié, avec ou sans couleurs d'instance, squelette…), le programme bascule à chaque
 *    draw qui alterne et le moteur recalcule tous les paramètres du shader (des dizaines de
 *    fois par image, allocations comprises). Une passe périodique donne à chaque signature
 *    minoritaire sa propre variante du matériau : même greffe de shader, couleurs et textures
 *    partagées par référence, valeurs animées (émission, opacité, visibilité) lues et écrites
 *    sur l'original. L'image ne change pas ; seules les bascules disparaissent.
 */

const DEFAULT_PATCH = Material.prototype.onBeforeCompile;
/** Greffes connues pour ne lire que des uniformes partagés (sûres à partager). */
const SAFE_PATCHES = /^skills-ui$/;
const SHARED_REFS = ['color', 'emissive', 'specularColor', 'sheenColor', 'map', 'alphaMap', 'aoMap', 'bumpMap', 'emissiveMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap', 'gradientMap'] as const;
const LIVE_VALUES = ['emissiveIntensity', 'opacity', 'visible'] as const;

const variantsOf = new WeakMap<Material, Map<string, Material>>();
const baseOf = new WeakMap<Material, Material>();

type Drawable = Object3D & {
  material?: Material | Material[];
  geometry?: { attributes?: Record<string, { itemSize: number }>; morphAttributes?: Record<string, unknown[]> };
  isMesh?: boolean;
  isPoints?: boolean;
  isLine?: boolean;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
  isBatchedMesh?: boolean;
  instanceColor?: unknown;
};

function eligible(material: Material) {
  if ((material as { isShaderMaterial?: boolean }).isShaderMaterial) return false;
  return material.onBeforeCompile === DEFAULT_PATCH || SAFE_PATCHES.test(material.name);
}

function signatureOf(object: Drawable, material: Material) {
  const color = object.geometry?.attributes?.color;
  const morph = object.geometry?.morphAttributes;
  return [
    object.isInstancedMesh ? (object.instanceColor ? 'Ic' : 'I') : object.isBatchedMesh ? 'B' : 'M',
    object.isSkinnedMesh ? 'S' : '',
    material.vertexColors && color && color.itemSize === 4 ? 'a' : '',
    morph && Object.keys(morph).length > 0 ? 'm' : '',
  ].join('');
}

function variantOf(base: Material, signature: string) {
  let variants = variantsOf.get(base);
  if (!variants) {
    variants = new Map();
    variantsOf.set(base, variants);
  }
  const existing = variants.get(signature);
  if (existing) return existing;
  const variant = base.clone();
  variant.name = `${base.name}~${signature}`;
  variant.onBeforeCompile = base.onBeforeCompile;
  variant.customProgramCacheKey = base.customProgramCacheKey;
  const source = base as unknown as Record<string, unknown>;
  const target = variant as unknown as Record<string, unknown>;
  for (const key of SHARED_REFS) {
    if (source[key] !== undefined) target[key] = source[key];
  }
  for (const key of LIVE_VALUES) {
    if (!(key in source)) continue;
    Object.defineProperty(variant, key, {
      configurable: true,
      enumerable: true,
      get: () => source[key],
      set: (value: unknown) => {
        source[key] = value;
      },
    });
  }
  variants.set(signature, variant);
  baseOf.set(variant, base);
  return variant;
}

function separateSignatures(scene: Scene) {
  const users = new Map<Material, Map<string, Drawable[]>>();
  scene.traverse((node) => {
    const object = node as Drawable;
    if (!(object.isMesh || object.isPoints || object.isLine)) return;
    const material = object.material;
    if (!material || Array.isArray(material)) return;
    const base = baseOf.get(material) ?? material;
    if (!eligible(base)) return;
    const signature = signatureOf(object, base);
    let bySignature = users.get(base);
    if (!bySignature) {
      bySignature = new Map();
      users.set(base, bySignature);
    }
    const list = bySignature.get(signature);
    if (list) list.push(object);
    else bySignature.set(signature, [object]);
  });
  users.forEach((bySignature, base) => {
    if (bySignature.size < 2 && !variantsOf.has(base)) return;
    // L'original reste aux maillages simples (sinon à la signature la plus courante) :
    // une règle stable, pour ne jamais réattribuer en boucle.
    let keep = bySignature.has('M') ? 'M' : '';
    if (!keep) {
      let most = -1;
      bySignature.forEach((list, signature) => {
        if (list.length > most) {
          most = list.length;
          keep = signature;
        }
      });
    }
    bySignature.forEach((list, signature) => {
      const material = signature === keep ? base : variantOf(base, signature);
      for (const object of list) if (object.material !== material) object.material = material;
    });
  });
}

function MaterialSignatures() {
  const getState = useThree((state) => state.get);
  useEffect(() => {
    const run = () => {
      try {
        separateSignatures(getState().scene);
      } catch {
        // Passe d'optimisation : une erreur ne doit jamais toucher la scène.
      }
    };
    const first = window.setTimeout(run, 1500);
    const timer = window.setInterval(run, 2500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [getState]);
  return null;
}

/** À monter une fois dans la scène (voir PostFX). */
export function RenderWarmup() {
  if (perfOff) return null;
  return (
    <>
      <LightCountKeeper />
      <ShaderWarmup />
      <MaterialSignatures />
    </>
  );
}
