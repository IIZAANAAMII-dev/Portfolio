import { create } from 'zustand';
import { isMobileDevice } from '@/lib/utils/device';

export type QualityLevel = 'low' | 'medium' | 'high';

export const QUALITY_LEVELS: Record<QualityLevel, {
  dpr: number;
  fishDensity: number;
  fishDistance: number;
  vegetationDensity: number;
  oceanSegments: number;
  bloom: boolean;
  shadows: boolean;
  /**
   * Portée du décor détaillé des îles (m, du point visé par la caméra au rivage, voir
   * components/islands/lod.ts) : au-delà, une île ne garde que son relief, ses arbres et
   * son ponton. Infinie en haute qualité.
   */
  decorRange: number;
  /** Même portée, à quai : la page est ouverte, seule l'île visitée (et ses voisines
   *  immédiates) garde son décor. */
  dockedDecorRange: number;
}> = {
  high: {
    dpr: 1.5,
    fishDensity: 1,
    fishDistance: 170,
    vegetationDensity: 1,
    oceanSegments: 128,
    bloom: true,
    shadows: true,
    decorRange: Infinity,
    dockedDecorRange: Infinity,
  },
  medium: {
    dpr: 1.25,
    fishDensity: 0.72,
    fishDistance: 135,
    vegetationDensity: 0.78,
    oceanSegments: 96,
    bloom: false,
    shadows: true,
    decorRange: 90,
    dockedDecorRange: 64,
  },
  low: {
    dpr: 1,
    fishDensity: 0.46,
    fishDistance: 95,
    vegetationDensity: 0.56,
    oceanSegments: 64,
    bloom: false,
    shadows: false,
    decorRange: 48,
    dockedDecorRange: 32,
  },
};

/** `?quality=high|medium|low` fige le niveau (captures, démonstrations, tests). */
export function forcedQuality(): QualityLevel | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('quality');
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}

/**
 * Niveau de départ, connu AVANT la première image : un téléphone ne construit jamais le
 * décor de la haute qualité pour le jeter une image plus tard.
 */
export function initialQuality(): QualityLevel {
  return forcedQuality() ?? (isMobileDevice() ? 'low' : 'high');
}

/** Résolution de rendu plafonnée par un niveau de qualité (jamais au-delà de l'écran). */
export function qualityDpr(quality: QualityLevel) {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, QUALITY_LEVELS[quality].dpr);
}

/**
 * Résolution de rendu courante, passée au `<Canvas dpr>` : la seule source de vérité.
 * (R3F réapplique la prop `dpr` du Canvas à chaque rendu de son parent ; une valeur posée
 * à côté, par `setDpr`, serait écrasée au premier accostage.) Le régulateur de performance
 * la fait varier : plafond du niveau de qualité, puis ajustement fin selon les FPS.
 */
export const useRenderDpr = create<{ dpr: number }>(() => ({ dpr: qualityDpr(initialQuality()) }));
