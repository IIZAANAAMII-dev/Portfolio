'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { preview } from '@/lib/preview';

type CaptureWindow = { __preview?: typeof preview; __shotCam?: number[] | null };

/**
 * Outils de capture (développement seulement, jamais monté en production) :
 *  - `window.__preview.time` change l'heure figée de `?time=` sans recharger la page ;
 *  - `window.__shotCam = [x, y, z, tx, ty, tz]` impose une caméra (monde), `null` la rend
 *    au cadrage normal. Plusieurs cadrages identiques d'une capture à l'autre, en un seul
 *    chargement (comparaisons avant / après).
 *
 * Monté en tête de l'atmosphère : il passe après le rig caméra mais avant le dôme du ciel
 * (centré sur la caméra) et le cadrage de l'ombre du soleil.
 */
export function CaptureRig() {
  useEffect(() => {
    (window as unknown as CaptureWindow).__preview = preview;
  }, []);
  useFrame((state) => {
    const cam = (window as unknown as CaptureWindow).__shotCam;
    if (!cam || cam.length !== 6) return;
    state.camera.position.set(cam[0], cam[1], cam[2]);
    state.camera.lookAt(cam[3], cam[4], cam[5]);
    state.camera.updateMatrixWorld();
  });
  return null;
}
