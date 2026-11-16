'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAINTED } from '@/components/islands/docks/planks';
import { Hotspot, useClearing, useHandFont } from '@/components/islands/kit';
import { groundAt, type HeightSampler } from '@/components/islands/terrain-shape';
import { atelier, FLAGS, LIVERIES, useLivery } from '@/lib/livery';
import { useLogbook, type StampId } from '@/lib/logbook';
import { useWorld } from '@/lib/store';
import { clamp, damp, smoothstep } from '@/lib/utils/math';
import {
  BENCH_TOP,
  canGeometry,
  dipBrushGeometry,
  FLAG_H,
  FLAG_W,
  padlockGeometry,
  paintGeometry,
  PLATFORM_TOP,
  POLE_HEIGHT,
  poleX,
  POT_HEIGHT,
  POT_Z,
  potX,
  rackFlagsGeometry,
  RACK_Z,
  shedGeometry,
  signGeometry,
  tagGeometry,
} from './geometry';
import { ATELIER, ATELIER_YAW } from './layout';
import { orderPaint, toggleFocus, updateOrders } from './orders';
import { flagAtlas, signAtlas } from './textures';

/**
 * L'atelier de peinture du port de départ : on y choisit, dans le monde, la livrée du bateau
 * (un pot par livrée sur l'établi) et son pavillon (râtelier). Un clic : le pot saute, son
 * couvercle s'envole ; le bateau rentre au port s'il est au large, puis un grand pinceau
 * repeint sa coque de l'étrave à la poupe (ou son pavillon est amené puis hissé). Les objets
 * qui se méritent restent sous cadenas, l'étiquette donne l'indice réel du carnet.
 *
 * Coût : 7 appels de dessin (appentis fusionné, bidons, peinture, cadenas, pinceau,
 * pavillons, écriteaux), rien au-delà de ~90 m de la caméra.
 */

const LIVERY_COUNT = LIVERIES.length;
/** Hauteur du haut du pavillon : hissé en tête de hampe, ou à mi-hampe. */
const FLAG_HIGH = 0.1 + POLE_HEIGHT - 0.04;
const FLAG_HALF = 0.1 + POLE_HEIGHT * 0.62;
/** Au-delà, l'atelier n'est qu'un point : on ne le dessine plus. */
const VISIBLE_RANGE = 90;

const PAINT_MATERIAL = new MeshStandardMaterial({ roughness: 0.42, metalness: 0 });
PAINT_MATERIAL.name = 'atelier-paint';
const LOCKED_PAINT = new Color('#8d9298');

const dummy = new Object3D();
const matrix = new Matrix4();
const lift = new Vector3();
const lockScale = new Vector3(1.25, 1.25, 1.25);
const spin = new Quaternion();
const AXIS_Z = new Vector3(0, 0, 1);
const eye = new Vector3();
const swatch = new Color();

type Hit = { kind: 'livery' | 'flag'; index: number };

/** Hissage des pavillons du râtelier (0 mi-hampe → 1 en tête) et horloge du vent. */
const HOIST = FLAGS.map(() => 0.5);
const FLAG_CLOCK = { value: 0 };

/** Matériau des pavillons du râtelier : ils claquent au vent, hissés ou à mi-hampe. */
const FLAGS_MATERIAL = (() => {
  const material = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.9, alphaTest: 0.5 });
  material.name = 'atelier-flags';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHoist = { value: HOIST };
    shader.uniforms.uFlagTime = FLAG_CLOCK;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aFree;\nattribute float aFlag;\nuniform float uHoist[ 4 ];\nuniform float uFlagTime;',
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float flagHoist = uHoist[ 0 ];
        if ( aFlag > 0.5 && aFlag < 1.5 ) flagHoist = uHoist[ 1 ];
        else if ( aFlag > 1.5 && aFlag < 2.5 ) flagHoist = uHoist[ 2 ];
        else if ( aFlag > 2.5 ) flagHoist = uHoist[ 3 ];
        transformed.y += ${FLAG_HALF.toFixed(3)} + flagHoist * ${(FLAG_HIGH - FLAG_HALF).toFixed(3)};
        float flagPhase = aFree * 6.5 - uFlagTime * ( 4.2 + aFlag * 0.35 ) + aFlag * 1.7;
        transformed.z += ( sin( flagPhase ) * 0.035 + sin( flagPhase * 1.9 + position.y * 9.0 ) * 0.012 ) * aFree;
        transformed.y -= aFree * aFree * 0.025;`,
      );
  };
  material.customProgramCacheKey = () => 'atelier-flags-v1';
  return material;
})();

export function Atelier({ sampler }: { sampler: HeightSampler }) {
  const quality = useWorld((state) => state.quality);
  const stamps = useLogbook((state) => state.stamps);
  const family = useHandFont();
  const clock = useThree((state) => state.clock);
  const group = useRef<Group>(null);
  const cans = useRef<InstancedMesh>(null);
  const paint = useRef<InstancedMesh>(null);
  const locks = useRef<InstancedMesh>(null);
  const brush = useRef<Mesh>(null);
  /** Animation des pots : survol, saut au clic (horloge three) ; jeu de couleurs appliqué. */
  const motion = useRef({
    hovered: -1,
    hoveredFlag: -1,
    clickAt: Array.from({ length: LIVERY_COUNT }, () => -10),
    lift: new Array<number>(LIVERY_COUNT).fill(0),
    painted: '',
  });

  useClearing(ATELIER.x, ATELIER.z, 2.3);

  // Le décor se pose sur le replat (le plus haut point de son emprise : rien ne flotte dessous).
  const ground = useMemo(() => groundAt(sampler, ATELIER.x, ATELIER.z, 1.1) + 0.02, [sampler]);

  const locked = useMemo(() => {
    const ids = new Set<string>();
    LIVERIES.forEach((livery) => {
      if (livery.lock && !stamps.includes(livery.lock)) ids.add(livery.id);
    });
    FLAGS.forEach((flag) => {
      if (flag.lock && !stamps.includes(flag.lock)) ids.add(flag.id);
    });
    return ids;
  }, [stamps]);

  const colorKey = useMemo(() => [...locked].join(','), [locked]);

  /** Emplacements sous cadenas : pots et pavillons dont le tampon manque. */
  const lockedSlots = useMemo(() => {
    const slots: { kind: 'livery' | 'flag'; index: number; stamp: StampId }[] = [];
    LIVERIES.forEach((livery, index) => {
      if (livery.lock && locked.has(livery.id)) slots.push({ kind: 'livery', index, stamp: livery.lock });
    });
    FLAGS.forEach((flag, index) => {
      if (flag.lock && locked.has(flag.id)) slots.push({ kind: 'flag', index, stamp: flag.lock });
    });
    return slots;
  }, [locked]);

  // L'appentis s'allège en qualité basse ; les pièces animées (instanciées) ne changent jamais :
  // les reconstruire recréerait les maillages instanciés (et perdrait leurs couleurs).
  const shed = useMemo(() => shedGeometry(quality === 'low'), [quality]);
  useEffect(() => () => shed.dispose(), [shed]);
  const geometries = useMemo(() => ({
    can: canGeometry(),
    paint: paintGeometry(),
    padlock: padlockGeometry(),
    brush: dipBrushGeometry(),
    flags: rackFlagsGeometry(),
  }), []);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  // Atlas des pavillons (les pavillons sous cadenas y sont délavés) : refait quand un tampon tombe.
  useEffect(() => {
    const texture = flagAtlas(locked);
    FLAGS_MATERIAL.map = texture;
    FLAGS_MATERIAL.needsUpdate = true;
    return () => texture.dispose();
  }, [locked]);

  // Écriteaux : enseigne sur la sablière, étiquettes pendues sous les objets sous cadenas.
  const signs = useMemo(() => {
    if (!family) return null;
    const parts: BufferGeometry[] = [signGeometry().translate(-0.1, PLATFORM_TOP + 1.84, 0.62)];
    lockedSlots.forEach((slot, order) => {
      if (slot.kind === 'livery') parts.push(tagGeometry(order, potX(slot.index, LIVERY_COUNT), BENCH_TOP - 0.13, POT_Z + 0.23));
      else parts.push(tagGeometry(order, poleX(slot.index) + 0.02, 0.32, RACK_Z + 0.1));
    });
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach((part) => part.dispose());
    const material = new MeshStandardMaterial({ map: signAtlas(family, lockedSlots.map((slot) => slot.stamp)), roughness: 0.85, alphaTest: 0.5 });
    material.name = 'atelier-signs';
    return { geometry, material };
  }, [family, lockedSlots]);
  useEffect(() => () => {
    if (!signs) return;
    signs.geometry.dispose();
    signs.material.map?.dispose();
    signs.material.dispose();
  }, [signs]);

  // Aide de capture (développement) : passer commande, ouvrir le plan de l'atelier.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as Record<string, unknown>;
    target.__atelier = {
      order: (kind: 'livery' | 'flag', id: string) => orderPaint(kind, id, clock.elapsedTime),
      focus: () => toggleFocus(clock.elapsedTime),
      state: atelier,
    };
    return () => {
      delete target.__atelier;
    };
  }, [clock]);

  useFrame((state, delta) => {
    const root = group.current;
    if (!root) return;
    const time = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    updateOrders(time);
    // Loin de la caméra (ou îlot pas encore surgi), l'atelier n'est pas dessiné.
    root.getWorldPosition(eye);
    const near = state.camera.position.distanceTo(eye) < VISIBLE_RANGE || atelier.focus;
    root.visible = near;
    if (!near) return;

    const { livery: currentLivery, flag: currentFlag } = useLivery.getState();
    const job = atelier.job;
    const memo = motion.current;
    FLAG_CLOCK.value = time;

    // Pots : survol (le pot se soulève), clic (il saute, son couvercle s'envole), cadenas
    // (il secoue la tête), commande en attente (il trépigne doucement).
    const canMesh = cans.current;
    const paintMesh = paint.current;
    // Couleurs des pots : la teinte de coque de chaque livrée (grise sous cadenas).
    if (paintMesh && (paintMesh.instanceColor === null || memo.painted !== colorKey)) {
      memo.painted = colorKey;
      LIVERIES.forEach((livery, index) => {
        swatch.set(locked.has(livery.id) ? LOCKED_PAINT : livery.colors.hull);
        paintMesh.setColorAt(index, swatch);
      });
      if (paintMesh.instanceColor) paintMesh.instanceColor.needsUpdate = true;
    }
    if (canMesh && paintMesh) {
      LIVERIES.forEach((livery, index) => {
        const hovered = memo.hovered === index;
        memo.lift[index] = damp(memo.lift[index], hovered ? 1 : 0, 12, dt);
        const sinceClick = time - memo.clickAt[index];
        const hop = sinceClick >= 0 && sinceClick < 0.7 ? Math.sin((sinceClick / 0.7) * Math.PI) * 0.16 : 0;
        const squash = sinceClick >= 0 && sinceClick < 0.9 ? Math.sin(sinceClick * 22) * Math.exp(-sinceClick * 6) * 0.12 : 0;
        const deniedAt = atelier.denied.id === `livery:${livery.id}` ? time - atelier.denied.at : 10;
        const shake = deniedAt >= 0 && deniedAt < 0.6 ? Math.sin(deniedAt * 40) * (1 - deniedAt / 0.6) * 0.22 : 0;
        const waiting = atelier.queue.some((order) => order.kind === 'livery' && order.id === livery.id) ? Math.abs(Math.sin(time * 6)) * 0.04 : 0;
        const y = BENCH_TOP + memo.lift[index] * 0.035 + hop + waiting;
        dummy.position.set(potX(index, LIVERY_COUNT), y, POT_Z);
        dummy.rotation.set(0, 0, shake);
        dummy.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
        dummy.updateMatrix();
        canMesh.setMatrixAt(index, dummy.matrix);
        // Couvercle : il décolle au clic (plus haut que le pot), tournoie et retombe.
        const pop = sinceClick >= 0 && sinceClick < 0.75 ? Math.sin((sinceClick / 0.75) * Math.PI) * 0.22 : 0;
        dummy.position.y = y + pop;
        dummy.rotation.set(pop * 1.4, 0, shake + pop * 0.6);
        dummy.updateMatrix();
        paintMesh.setMatrixAt(index, dummy.matrix);
      });
      canMesh.instanceMatrix.needsUpdate = true;
      paintMesh.instanceMatrix.needsUpdate = true;
    }

    // Le pinceau trempe dans le pot de la livrée en cours (il est sur le bateau pendant un travail).
    const dip = brush.current;
    if (dip) {
      const painting = job?.kind === 'livery';
      dip.visible = !painting;
      const index = Math.max(0, LIVERIES.findIndex((livery) => livery.id === currentLivery));
      const sinceDone = time - atelier.doneAt;
      const back = atelier.doneAt >= 0 && sinceDone < 0.5 ? 1 - smoothstep(0, 0.5, sinceDone) : 0;
      dip.position.set(potX(index, LIVERY_COUNT) + 0.03, BENCH_TOP + POT_HEIGHT - 0.06 + memo.lift[index] * 0.035 + back * 0.4, POT_Z - 0.02);
      dip.rotation.set(-0.25, 0, -0.32 + Math.sin(time * 1.3) * 0.03);
    }

    // Pavillons : celui de la livrée en cours est hissé, les autres à mi-hampe ; pendant un
    // changement, le nouveau monte quand celui du bateau redescend.
    const flying = job?.kind === 'flag' ? job.id : currentFlag;
    FLAGS.forEach((flag, index) => {
      const goal = flag.id === flying ? 1 : 0;
      const nudge = memo.hoveredFlag === index ? 0.12 : 0;
      HOIST[index] = damp(HOIST[index], clamp(goal + nudge, 0, 1.08), 3.5, dt);
    });

    // Cadenas : posés sur le couvercle des pots, ou au pied des hampes ; ils sursautent au refus.
    const lockMesh = locks.current;
    if (lockMesh) {
      lockedSlots.forEach((slot, order) => {
        const id = slot.kind === 'livery' ? LIVERIES[slot.index].id : FLAGS[slot.index].id;
        const deniedAt = atelier.denied.id === `${slot.kind}:${id}` ? time - atelier.denied.at : 10;
        const jolt = deniedAt >= 0 && deniedAt < 0.5 ? Math.sin(deniedAt * 34) * (1 - deniedAt / 0.5) : 0;
        if (slot.kind === 'livery') {
          lift.set(potX(slot.index, LIVERY_COUNT), BENCH_TOP + POT_HEIGHT * 0.52, POT_Z + 0.15);
        } else {
          lift.set(poleX(slot.index), 0.7, RACK_Z + 0.04);
        }
        lift.y += Math.abs(jolt) * 0.05;
        spin.setFromAxisAngle(AXIS_Z, jolt * 0.5);
        matrix.compose(lift, spin, lockScale);
        lockMesh.setMatrixAt(order, matrix);
      });
      lockMesh.count = lockedSlots.length;
      lockMesh.instanceMatrix.needsUpdate = true;
    }
  });

  const activate = (hit: Hit) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const now = clock.elapsedTime;
    if (hit.kind === 'livery') {
      const result = orderPaint('livery', LIVERIES[hit.index].id, now);
      if (result !== 'locked') motion.current.clickAt[hit.index] = now;
    } else {
      orderPaint('flag', FLAGS[hit.index].id, now);
    }
  };
  const over = (hit: Hit) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
    if (hit.kind === 'livery') motion.current.hovered = hit.index;
    if (hit.kind === 'flag') motion.current.hoveredFlag = hit.index;
  };
  const out = (hit: Hit) => () => {
    document.body.style.cursor = '';
    if (hit.kind === 'livery' && motion.current.hovered === hit.index) motion.current.hovered = -1;
    if (hit.kind === 'flag' && motion.current.hoveredFlag === hit.index) motion.current.hoveredFlag = -1;
  };

  return (
    <group ref={group} position={[ATELIER.x, ground, ATELIER.z]} rotation-y={ATELIER_YAW}>
      <mesh geometry={shed} material={PAINTED} castShadow={quality !== 'low'} receiveShadow raycast={() => null} />
      <instancedMesh ref={cans} args={[geometries.can, PAINTED, LIVERY_COUNT]} castShadow={quality === 'high'} raycast={() => null} />
      <instancedMesh ref={paint} args={[geometries.paint, PAINT_MATERIAL, LIVERY_COUNT]} raycast={() => null} />
      <instancedMesh ref={locks} args={[geometries.padlock, PAINTED, 4]} raycast={() => null} />
      <mesh ref={brush} geometry={geometries.brush} material={PAINTED} raycast={() => null} />
      <mesh geometry={geometries.flags} material={FLAGS_MATERIAL} castShadow={quality === 'high'} raycast={() => null} />
      {signs && <mesh geometry={signs.geometry} material={signs.material} raycast={() => null} />}

      {/* Volumes de clic (invisibles) : l'appentis (éclat doré commun), chaque pot, chaque pavillon. */}
      <Hotspot onActivate={() => toggleFocus(clock.elapsedTime)} hoverScale={1}>
        <mesh position={[-0.1, 1.1, -0.2]} visible={false}>
          <boxGeometry args={[2.7, 2.2, 1.5]} />
        </mesh>
      </Hotspot>
      {LIVERIES.map((livery, index) => (
        <mesh
          key={livery.id}
          position={[potX(index, LIVERY_COUNT), BENCH_TOP + 0.17, POT_Z]}
          visible={false}
          onClick={activate({ kind: 'livery', index })}
          onPointerOver={over({ kind: 'livery', index })}
          onPointerOut={out({ kind: 'livery', index })}
        >
          <boxGeometry args={[0.33, 0.46, 0.4]} />
        </mesh>
      ))}
      {FLAGS.map((flag, index) => (
        <mesh
          key={flag.id}
          position={[poleX(index) + FLAG_W * 0.42, 0.95, RACK_Z]}
          visible={false}
          onClick={activate({ kind: 'flag', index })}
          onPointerOver={over({ kind: 'flag', index })}
          onPointerOut={out({ kind: 'flag', index })}
        >
          <boxGeometry args={[FLAG_W + 0.08, FLAG_H + 0.75, 0.3]} />
        </mesh>
      ))}
    </group>
  );
}
