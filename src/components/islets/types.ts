import type { HeightSampler, terrainFeatures } from '@/components/islands/terrain-shape';
import type { IsletConfig, IsletKind } from '@/data/islets';

/** Valeur partagée hors React : 0 = îlot endormi, 1 = réveillé (bateau proche). */
export interface AwakeRef {
  value: number;
}

export interface IsletDecorProps {
  islet: IsletConfig;
  sampler: HeightSampler;
  features: ReturnType<typeof terrainFeatures>;
  awake: AwakeRef;
}

/** Réveil de chaque îlot, partagé hors React (écrit par l'îlot, lu par son décor). */
export const isletAwake: Record<IsletKind, AwakeRef> = {
  breizh: { value: 0 },
  tech: { value: 0 },
  design: { value: 0 },
};
