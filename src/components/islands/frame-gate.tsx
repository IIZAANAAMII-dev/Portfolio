'use client';

import { useMemo, type ReactNode } from 'react';
import { context, useStore, type RootState } from '@react-three/fiber';

/**
 * Sommeil d'un sous-arbre : tant que `gate.open` est faux, aucun `useFrame` des composants
 * enfants n'est appelé (le décor d'une île au loin, masqué par le LOD, ne s'anime plus pour
 * rien). Le sous-arbre reçoit une variante du store R3F dont seul `internal.subscribe`
 * change : chaque abonnement est enveloppé d'un test de la porte. Tout le reste (useThree,
 * événements, horloge) est le store d'origine ; à la réouverture, les animations reprennent
 * à l'heure exacte (elles lisent `clock.elapsedTime`).
 */

export interface FrameGate {
  open: boolean;
}

export function createFrameGate(): FrameGate {
  return { open: true };
}

type RootStore = ReturnType<typeof useStore>;
type Internal = RootState['internal'];
type Subscribe = Internal['subscribe'];

function gatedStore(real: RootStore, gate: FrameGate): RootStore {
  const internal = real.getState().internal;
  const subscribe: Subscribe = (ref, priority) => {
    const gated = {
      current: ((state, delta, frame) => {
        if (gate.open) ref.current(state, delta, frame);
      }) as typeof ref.current,
    };
    // L'abonnement réel garde le store d'origine : l'état passé aux rappels est le vrai.
    return internal.subscribe(gated as typeof ref, priority, real);
  };
  const internalView = new Proxy(internal, {
    get: (target, key, receiver) => (key === 'subscribe' ? subscribe : Reflect.get(target, key, receiver)),
  });
  const views = new WeakMap<RootState, RootState>();
  const getState = () => {
    const state = real.getState();
    let view = views.get(state);
    if (!view) {
      view = new Proxy(state, {
        get: (target, key, receiver) => (key === 'internal' ? internalView : Reflect.get(target, key, receiver)),
      });
      views.set(state, view);
    }
    return view;
  };
  const hook = ((selector?: (state: RootState) => unknown, equality?: (a: unknown, b: unknown) => boolean) =>
    (real as unknown as (s?: unknown, e?: unknown) => unknown)(selector, equality)) as unknown as RootStore;
  Object.assign(hook, real, { getState });
  return hook;
}

export function FrameGateScope({ gate, children }: { gate: FrameGate; children: ReactNode }) {
  const real = useStore();
  const store = useMemo(() => gatedStore(real, gate), [real, gate]);
  return <context.Provider value={store}>{children}</context.Provider>;
}
