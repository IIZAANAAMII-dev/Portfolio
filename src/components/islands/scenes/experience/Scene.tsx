'use client';

import { ClearingAt, type SceneProps } from '../../kit';
import { Beak } from './Bec';
import { Gantry } from './Gantry';
import { Gulls } from './Gulls';
import { Harbor } from './Harbor';
import { GRETA, OFFICE, polar, RG } from './layout';
import { SailingPointu, Walker, type Figure } from './Life';
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
/** Figurines : un pêcheur sur le ponton, une promeneuse sur le chemin des années. */
const FISHER: Figure = { shirt: '#2f6fc0', pants: '#3b3f4a', skin: '#e8b48a', hat: 'beret', hatColor: '#26303d', carry: '#2f9a8e' };
const STROLLER: Figure = { shirt: '#e2553f', pants: '#f2e6cf', skin: '#c98d62', hat: 'straw' };
const PIER_WALK = [polar(-1.27, 12.9), polar(-1.27, 15.8)] as const;
const PATH_WALK = [[4.05, -10.25], [5.0, -9.35], [6.15, -7.7]] as const;

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
      <Gulls center={[-10.5, -6.5]} radius={6} height={16} />
      <SailingPointu island={island} center={[-16.5, -19]} radius={3.2} />
      <Walker points={[...PIER_WALK]} sampler={sampler} figure={FISHER} y={0.8} speed={0.5} pause={4} />
      <Walker points={[...PATH_WALK]} sampler={sampler} figure={STROLLER} speed={0.45} pause={3.5} phase={5} />
    </>
  );
}
