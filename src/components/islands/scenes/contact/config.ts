import { lerp, smoothstep } from '@/lib/utils/math';
import type { IslandSceneConfig } from '../types';
import { COTTAGE, DOCK_DIR, DOCK_SIDE, DOCK_STAIRS, hillStairs } from './layout';

/**
 * Île Contact : le phare au sommet, la maison du gardien sur sa terrasse, deux rampes
 * douces où se posent les escaliers (ponton → plateau → phare). Rochers et fleurs sont
 * posés à la main par le décor (pas d'habillage automatique).
 */
const config: IslandSceneConfig = {
  trees: 2,
  grass: 1,
  grassPalette: ['#6f9a3c', '#5f8f3a', '#8aa84a', '#b08fc8'],
  dressing: false,
  cliffTint: '#d9c9c0',
  sculpt: (x, z, height, features) => {
    let h = height;
    const { hillX, hillZ, plateau, summit } = features;
    const flat = plateau + 0.04;
    const top = summit + 0.36;

    // Sommet de la butte aplani : le phare y repose bien droit.
    const dh = Math.hypot(x - hillX, z - hillZ);
    h = lerp(h, top, smoothstep(2.75, 2.05, dh));

    // Terrasse de la maison du gardien.
    const dc = Math.hypot(x - COTTAGE.x, z - COTTAGE.z);
    h = lerp(h, flat, smoothstep(2.95, 2.25, dc));

    // Rampe sous l'escalier du ponton (dans l'axe du ponton).
    const along = x * DOCK_DIR.x + z * DOCK_DIR.z;
    const side = Math.abs(x * DOCK_SIDE.x + z * DOCK_SIDE.z);
    const dockMask = smoothstep(1.75, 1.2, side) * smoothstep(7.0, 7.6, along) * (1 - smoothstep(10.5, 11.1, along));
    const dockRamp = flat - smoothstep(DOCK_STAIRS.top, DOCK_STAIRS.bottom, along) * (flat - 0.7);
    h = lerp(h, dockRamp, dockMask);

    // Rampe sous l'escalier du phare (de la butte vers le haut de l'escalier du ponton).
    const stairs = hillStairs(hillX, hillZ);
    const rx = x - hillX;
    const rz = z - hillZ;
    const a2 = rx * stairs.dirX + rz * stairs.dirZ;
    const s2 = Math.abs(-rx * stairs.dirZ + rz * stairs.dirX);
    const hillMask = smoothstep(1.45, 0.95, s2) * smoothstep(2.1, 2.6, a2) * (1 - smoothstep(5.4, 6.0, a2));
    const hillRamp = lerp(top, flat, smoothstep(stairs.from, stairs.to, a2));
    h = lerp(h, hillRamp, hillMask);
    return h;
  },
};

export default config;
