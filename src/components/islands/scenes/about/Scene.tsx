'use client';

import { SubstanceProp } from '../../bell-island';
import { HomeExtras } from '../../Metaphors';
import { facingDock, on, type SceneProps } from '../../kit';

/**
 * ÎLE À PROPOS — racine du décor.
 * (Version actuelle : la maison-butte et le bureau en plein air, en attendant le village breton.)
 */
/* ------------------------------------------------------------------------------------ */
/* ABOUT — la maison-butte de Bell Island : « chez moi ».                               */
/* ------------------------------------------------------------------------------------ */
export default function AboutScene({ island, sampler, features }: SceneProps) {
  const { hillX, hillZ } = features;
  const base = on(sampler, hillX, hillZ, 2.6, 0.25);
  // La façade (fenêtres, porte) du modèle regarde -X : un quart de tour la tourne vers le ponton.
  const rotation = facingDock(island, hillX, hillZ) + Math.PI / 2;
  return (
    <>
      <SubstanceProp name="house-mound" position={base} rotation={rotation} scale={0.92}>
        {/* La cheminée perce le dôme à l'arrière (+X dans le repère du modèle). */}
        <SubstanceProp name="chimney-curved" position={[0.8, 6.0, 0]} scale={0.75} smoke />
      </SubstanceProp>
      <HomeExtras island={island} sampler={sampler} />
    </>
  );
}

