'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';
import { KrakenRig } from './kraken/KrakenRig';
import { claimHost, currentOwner, subscribeOwner } from './kraken/state';

const serverOwner = () => '';

/**
 * Limite du monde : le kraken de la mer interdite (séquence dans kraken/sequence.ts).
 * Monté à la première alerte par MarineLife, et par BoundaryStorm (aperçus `?solo=`, démo
 * `?demo=kraken`) : un seul hôte possède la séquence et le rig, l'autre ne rend rien.
 */
export function WorldBoundary() {
  const id = useId();
  const owner = useSyncExternalStore(subscribeOwner, currentOwner, serverOwner);
  useEffect(() => claimHost(id), [id]);
  return owner === id ? <KrakenRig /> : null;
}
