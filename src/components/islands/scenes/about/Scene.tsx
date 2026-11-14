'use client';

import type { SceneProps } from '../../kit';
import { Harbor } from './Harbor';
import { Lighthouse } from './Lighthouse';
import { Village } from './Village';

/**
 * ÎLE À PROPOS — un hameau de pêcheurs du Morbihan : maisons de granit autour d'un petit
 * port, phare sur son rocher, lande d'ajoncs et de bruyère, et l'atelier de Kyliann.
 */
export default function AboutScene({ island, sampler }: SceneProps) {
  return (
    <>
      <Village sampler={sampler} />
      <Harbor island={island} sampler={sampler} />
      <Lighthouse sampler={sampler} />
    </>
  );
}
