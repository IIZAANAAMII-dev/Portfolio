import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { ecologyState } from '@/lib/ecology';
import { useLogbook } from '@/lib/logbook';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { SoundscapeEngine } from './engine';
import { createInput } from './mix';
import { pageTurn, softClick, stampThump } from './ui';

/**
 * PAYSAGE SONORE VIVANT — branchement sur le monde. Chargé seulement quand le visiteur
 * active le son (voir components/audio/Soundscape.tsx) ; `startSoundscape` renvoie la
 * fonction qui défait tout (minuterie, écouteurs, nœuds audio).
 *
 *  - Mise à jour à 5 Hz (position du bateau, ciel, phase, tempête), arrêtée onglet caché.
 *  - Page qui se tourne à l'ouverture / fermeture d'un panneau ou du carnet de bord.
 *  - Coup de tampon quand un tampon est gagné (après la page, si les deux arrivent ensemble).
 *  - Petit clic sur les boutons de l'interface (`data-sfx="none"` pour s'en passer,
 *    `data-sfx="click"` pour en doter un autre élément).
 */

const TICK_MS = 200;
const CLICKABLE = 'button, a[href], [role="button"], [data-sfx]';

export function startSoundscape() {
  const engine = new SoundscapeEngine();
  const input = createInput();
  let timer = 0;
  let last = performance.now();
  let shade = 1;
  let pageAt = -1e9;
  let clickAt = -1e9;

  const read = () => {
    const world = useWorld.getState();
    input.x = boatState.position.x;
    input.z = boatState.position.z;
    input.heading = boatState.heading;
    input.speed = boatState.speed;
    input.sunAngle = skyState.sunAngle;
    input.night = skyState.dayNight;
    input.phase = world.phase;
    input.gameTransition = world.gameTransition;
    input.activeIsland = world.activeIsland;
    input.quickView = world.quickView;
    input.boundary = ecologyState.boundaryWarning;
    input.panelOpen = world.activeIsland !== null || useLogbook.getState().open;
    engine.lite = world.quality === 'low';
  };

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
    last = now;
    read();
    engine.update(ambience.bus(), input, dt);
    const target = engine.mix.seaShade;
    if (Math.abs(target - shade) > 0.01) {
      shade = target;
      ambience.setSeaShade(shade);
    }
  };

  const start = () => {
    if (timer) return;
    last = performance.now();
    timer = window.setInterval(tick, TICK_MS);
    tick();
  };
  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = 0;
  };

  const onVisibility = () => {
    engine.setHidden(document.hidden);
    if (document.hidden) stop();
    else start();
  };

  const unsubscribeWorld = useWorld.subscribe((state, previous) => {
    if (state.activeIsland === previous.activeIsland) return;
    const bus = ambience.bus();
    if (!bus) return;
    pageTurn(bus, state.activeIsland !== null);
    if (state.activeIsland) pageAt = performance.now();
  });

  const unsubscribeLogbook = useLogbook.subscribe((state, previous) => {
    const bus = ambience.bus();
    if (!bus) return;
    if (state.open !== previous.open) {
      pageTurn(bus, state.open);
      if (state.open) pageAt = performance.now();
    }
    if (state.latest && state.latest !== previous.latest) {
      // À l'accostage, la page s'ouvre et le tampon tombe dans le même instant : le coup
      // de tampon attend que la page soit posée.
      stampThump(bus, performance.now() - pageAt < 400 ? 0.45 : 0);
    }
  });

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null;
    if (!target || target.getAttribute('data-sfx') === 'none') return;
    if (target instanceof HTMLButtonElement && target.disabled) return;
    const now = performance.now();
    if (now - clickAt < 70) return;
    clickAt = now;
    const bus = ambience.bus();
    if (bus) softClick(bus);
  };

  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('click', onClick, true);
  if (!document.hidden) start();

  // Développement : état du paysage pour les tests automatisés (rien en production).
  if (process.env.NODE_ENV !== 'production') {
    (window as unknown as Record<string, unknown>).__soundscape = engine;
  }

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('click', onClick, true);
    unsubscribeWorld();
    unsubscribeLogbook();
    engine.dispose();
    if (shade !== 1) ambience.setSeaShade(1);
    if (process.env.NODE_ENV !== 'production') {
      delete (window as unknown as Record<string, unknown>).__soundscape;
    }
  };
}
