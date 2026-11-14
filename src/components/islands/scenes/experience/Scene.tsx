'use client';

import { ClearingAt, type SceneProps } from '../../kit';
import { Beak } from './Bec';
import { Gantry } from './Gantry';
import { Harbor } from './Harbor';
import { GRETA, OFFICE, RG } from './layout';
import { Office } from './Office';
import { Path } from './Path';
import { Places } from './Places';
import { Vegetation } from './Vegetation';

/**
 * ÎLE EXPÉRIENCES — La Ciotat, là où Kyliann travaille aujourd'hui.
 *
 * Au sommet, l'atelier Feeder SAS – EIZO France ; derrière lui, le grand portique blanc du
 * chantier naval et le Bec de l'Aigle, les deux silhouettes qu'on reconnaît de loin ; au
 * pied du Bec, le petit port et ses pointus. Le chemin des années monte du quai vers le
 * sommet en passant par les étapes précédentes (GRETA, RG Design). Plan et relief :
 * layout.ts et config.ts.
 */
export default function Scene({ island, sampler }: SceneProps) {
  return (
    <>
      <ClearingAt x={OFFICE.x} z={OFFICE.z} radius={4.6} />
      <ClearingAt x={GRETA.at[0]} z={GRETA.at[1]} radius={3.1} />
      <ClearingAt x={RG.at[0]} z={RG.at[1]} radius={2.8} />
      <Beak island={island} />
      <Gantry />
      <Harbor island={island} />
      <Office />
      <Places island={island} />
      <Path sampler={sampler} />
      <Vegetation sampler={sampler} />
    </>
  );
}
