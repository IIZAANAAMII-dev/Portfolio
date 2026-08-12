import { Vector3 } from 'three';
import { homeIsland } from '@/data/islands';

/**
 * Transform du bateau partagé hors de React.
 * La caméra, le sillage et l'océan le lisent à 60 fps : le passer par un state React
 * provoquerait un rendu par frame pour rien.
 */
export const boatState = {
  position: new Vector3(
    homeIsland.position[0] + Math.cos(homeIsland.dockAngle) * (homeIsland.radius + 2.6),
    0,
    homeIsland.position[1] + Math.sin(homeIsland.dockAngle) * (homeIsland.radius + 2.6),
  ),
  /** Cap en radians autour de Y. 0 = face à +X. */
  heading: homeIsland.dockAngle + Math.PI / 2,
  /** Vitesse actuelle en unités/seconde, utilisée pour le sillage et le roulis. */
  speed: 0,
};

export function resetBoat() {
  boatState.position.set(
    homeIsland.position[0] + Math.cos(homeIsland.dockAngle) * (homeIsland.radius + 2.6),
    0,
    homeIsland.position[1] + Math.sin(homeIsland.dockAngle) * (homeIsland.radius + 2.6),
  );
  boatState.heading = homeIsland.dockAngle + Math.PI / 2;
  boatState.speed = 0;
}
