'use client';

import type { SceneProps } from '../../kit';
import { Harbor } from './Harbor';
import { Lande } from './Lande';
import { Life } from './Life';
import { Lighthouse } from './Lighthouse';
import { Village } from './Village';
import { Workshop } from './Workshop';

/**
 * ÎLE À PROPOS — un hameau de pêcheurs du Morbihan, là où Kyliann a grandi « avec la mer
 * comme horizon » : maisons de granit autour d'un petit port, sinagot aux voiles tannées,
 * grand phare sur son rocher, lande d'ajoncs et de bruyère, chapelle sur la butte… et,
 * parmi les maisons de pêcheurs, l'atelier du développeur (un clic l'ouvre).
 */
export default function AboutScene({ island, sampler, features }: SceneProps) {
  return (
    <>
      <Village sampler={sampler} />
      <Workshop sampler={sampler} />
      <Harbor island={island} sampler={sampler} />
      <Lighthouse sampler={sampler} />
      <Lande sampler={sampler} plateau={features.plateau} />
      <Life sampler={sampler} />
    </>
  );
}
