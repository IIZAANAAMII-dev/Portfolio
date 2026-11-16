'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, MeshStandardMaterial, TorusGeometry, Vector3, type Mesh } from 'three';
import { clamp, smoothstep } from '@/lib/utils/math';
import { CAST_OFF_FLIGHT, LINE_FLIGHT, mooring, THROW_RELEASE } from './mooring';

/**
 * L'amarre : un cordage (tube de quelques anneaux recalculés à chaque image, un seul appel
 * de dessin) entre le taquet arrière du bateau et la bitte du ponton, et sa boucle (œil)
 * capelée sur la bitte. Le patron la lance (vol balistique depuis sa main), la boucle tombe
 * sur la bitte, l'amarre se raidit puis reprend un mou paresseux ; au départ, elle est
 * larguée et revient à bord en décrivant un arc.
 */

const SEGMENTS = 22;
const SIDES = 5;
const RADIUS = 0.038;
const ROPE = new Color('#d9bd84');
const ROPE_DARK = new Color('#a98d57');

const MATERIAL = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
MATERIAL.name = 'mooring-rope';
/** L'œil de l'amarre, à plat autour du collet de la bitte (mêmes couleurs que le cordage). */
const EYE = (() => {
  const torus = new TorusGeometry(0.15, 0.036, 5, 14).rotateX(Math.PI / 2);
  const count = torus.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const tone = new Color();
  for (let vertex = 0; vertex < count; vertex++) {
    tone.copy(ROPE).lerp(ROPE_DARK, (vertex % 3) * 0.2);
    tone.toArray(colors, vertex * 3);
  }
  torus.setAttribute('color', new BufferAttribute(colors, 3));
  return torus;
})();

const UP = new Vector3(0, 1, 0);
const start = new Vector3();
const end = new Vector3();
const release = new Vector3();
const lifted = new Vector3();
const point = new Vector3();
const next = new Vector3();
const tangent = new Vector3();
const normal = new Vector3();
const binormal = new Vector3();
const ring = new Vector3();
const centres = Array.from({ length: SEGMENTS + 1 }, () => new Vector3());

/** Point du cordage entre `a` et `b` : corde tendue + flèche (parabole, proche d'une chaînette). */
function ropePoint(a: Vector3, b: Vector3, t: number, sag: number, out: Vector3) {
  out.lerpVectors(a, b, t);
  out.y -= sag * 4 * t * (1 - t);
  return out;
}

export function MooringLine() {
  const rope = useRef<Mesh>(null);
  const eye = useRef<Mesh>(null);
  const memory = useRef({ rest: -1, released: false, lastThrow: -1 });

  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    const count = (SEGMENTS + 1) * SIDES;
    const positions = new BufferAttribute(new Float32Array(count * 3), 3);
    const normals = new BufferAttribute(new Float32Array(count * 3), 3);
    positions.setUsage(DynamicDrawUsage);
    normals.setUsage(DynamicDrawUsage);
    const colors = new Float32Array(count * 3);
    const tone = new Color();
    for (let index = 0; index <= SEGMENTS; index++) {
      for (let side = 0; side < SIDES; side++) {
        // Torons en hélice : une bande sombre qui tourne autour du cordage.
        const twist = 0.5 + 0.5 * Math.cos((side / SIDES) * Math.PI * 2 + index * 1.3);
        tone.copy(ROPE).lerp(ROPE_DARK, twist * 0.55);
        tone.toArray(colors, (index * SIDES + side) * 3);
      }
    }
    const indices: number[] = [];
    for (let index = 0; index < SEGMENTS; index++) {
      for (let side = 0; side < SIDES; side++) {
        const a = index * SIDES + side;
        const b = index * SIDES + ((side + 1) % SIDES);
        const c = a + SIDES;
        const d = b + SIDES;
        indices.push(a, c, b, b, c, d);
      }
    }
    result.setAttribute('position', positions);
    result.setAttribute('normal', normals);
    result.setAttribute('color', new BufferAttribute(colors, 3));
    result.setIndex(indices);
    return result;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const mesh = rope.current;
    const loop = eye.current;
    if (!mesh || !loop) return;
    const time = state.clock.elapsedTime;
    const berth = mooring.berth;
    const memo = memory.current;
    const active = mooring.phase === 'arriving' || mooring.phase === 'moored';
    const casting = mooring.phase === 'leaving' && mooring.castOffAt >= 0 && time - mooring.castOffAt < CAST_OFF_FLIGHT
      && mooring.lineAt >= 0 && mooring.castOffAt >= mooring.lineAt - 0.2;
    if (!berth || !mooring.line || (!active && !casting)) {
      mesh.visible = false;
      loop.visible = false;
      memo.rest = -1;
      return;
    }
    if (memo.lastThrow !== mooring.throwAt) {
      memo.lastThrow = mooring.throwAt;
      memo.released = false;
      memo.rest = -1;
    }
    start.copy(mooring.cleat);
    const bollard = berth.bollard;
    let sag = 0.14;
    let eyeShown = 0;
    let visible = true;

    if (casting) {
      // Largage : la boucle quitte la bitte et revient à bord en arc, le cordage pend.
      const k = clamp((time - mooring.castOffAt) / CAST_OFF_FLIGHT, 0, 1);
      const ease = k * k * (3 - 2 * k);
      end.lerpVectors(bollard, start, ease);
      end.y += (0.25 + 0.75 * Math.sin(k * Math.PI)) * (1 - ease * 0.8);
      sag = 0.4 * (1 - ease) + 0.05;
      eyeShown = 1 - smoothstep(0.55, 1, k);
    } else if (mooring.throwAt >= 0 && time < mooring.lineAt) {
      // Lancer : dans la main du patron pendant l'élan, puis vol balistique vers la bitte.
      const releaseAt = mooring.throwAt + THROW_RELEASE;
      if (time < mooring.throwAt) visible = false;
      else if (time < releaseAt) {
        end.copy(mooring.hand);
        sag = 0.32;
      } else {
        if (!memo.released) {
          memo.released = true;
          release.copy(mooring.hand);
        }
        const k = clamp((time - releaseAt) / LINE_FLIGHT, 0, 1);
        lifted.copy(bollard);
        lifted.y += 0.38;
        const distance = Math.hypot(lifted.x - release.x, lifted.z - release.z);
        end.lerpVectors(release, lifted, k);
        end.y += (0.55 + distance * 0.16) * 4 * k * (1 - k);
        // Le cordage se déroule : grand mou en vol, qui se tend à l'arrivée.
        sag = 0.55 - k * 0.2;
        eyeShown = smoothstep(0.75, 1, k);
      }
    } else {
      // Capelée : la boucle glisse le long de la bitte, l'amarre se raidit (petit claquement),
      // puis garde un mou qui suit les mouvements du bateau.
      const since = mooring.lineAt >= 0 ? time - mooring.lineAt : 10;
      const drop = smoothstep(0, 0.22, since);
      end.copy(bollard);
      end.y += 0.38 * (1 - drop) - Math.sin(Math.min(since, 0.6) * 18) * 0.03 * (1 - smoothstep(0.2, 0.6, since));
      const length = start.distanceTo(bollard);
      if (since > 0.9 && memo.rest < 0) memo.rest = length;
      const rest = memo.rest > 0 ? memo.rest : length;
      const taut = 0.12 + clamp((rest - length) * 0.6, -0.08, 0.3);
      const tighten = smoothstep(0.15, 0.6, since);
      // Claquement : la flèche passe un instant sous sa valeur de repos, puis s'y pose.
      const snap = Math.sin(clamp((since - 0.45) / 0.5, 0, 1) * Math.PI) * 0.07;
      sag = 0.42 + (taut - snap - 0.42) * tighten;
      eyeShown = 1;
    }

    mesh.visible = visible;
    loop.visible = visible && eyeShown > 0.01;
    if (!visible) return;

    for (let index = 0; index <= SEGMENTS; index++) ropePoint(start, end, index / SEGMENTS, sag, centres[index]);
    const positions = geometry.getAttribute('position') as BufferAttribute;
    const normals = geometry.getAttribute('normal') as BufferAttribute;
    for (let index = 0; index <= SEGMENTS; index++) {
      point.copy(centres[index]);
      next.copy(centres[Math.min(index + 1, SEGMENTS)]);
      tangent.subVectors(next, centres[Math.max(index - 1, 0)]).normalize();
      normal.crossVectors(tangent, UP);
      if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
      normal.normalize();
      binormal.crossVectors(normal, tangent).normalize();
      for (let side = 0; side < SIDES; side++) {
        const angle = (side / SIDES) * Math.PI * 2;
        ring.copy(normal).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
        const vertex = index * SIDES + side;
        normals.setXYZ(vertex, ring.x, ring.y, ring.z);
        positions.setXYZ(vertex, point.x + ring.x * RADIUS, point.y + ring.y * RADIUS, point.z + ring.z * RADIUS);
      }
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;

    if (loop.visible) {
      loop.position.copy(end);
      loop.scale.setScalar(0.4 + 0.6 * eyeShown);
      loop.rotation.set(Math.sin(time * 2.1) * 0.05 * (1 - eyeShown), 0, 0);
    }
  });

  return (
    <>
      <mesh ref={rope} geometry={geometry} material={MATERIAL} frustumCulled={false} visible={false} raycast={() => null} />
      <mesh ref={eye} geometry={EYE} material={MATERIAL} visible={false} raycast={() => null} />
    </>
  );
}
