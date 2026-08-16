export type QualityLevel = 'low' | 'medium' | 'high';

export const QUALITY_LEVELS: Record<QualityLevel, {
  dpr: number;
  fishDensity: number;
  fishDistance: number;
  vegetationDensity: number;
  oceanSegments: number;
  bloom: boolean;
  shadows: boolean;
}> = {
  high: {
    dpr: 1.5,
    fishDensity: 1,
    fishDistance: 170,
    vegetationDensity: 1,
    oceanSegments: 128,
    bloom: true,
    shadows: true,
  },
  medium: {
    dpr: 1.25,
    fishDensity: 0.72,
    fishDistance: 135,
    vegetationDensity: 0.78,
    oceanSegments: 96,
    bloom: false,
    shadows: true,
  },
  low: {
    dpr: 1,
    fishDensity: 0.46,
    fishDistance: 95,
    vegetationDensity: 0.56,
    oceanSegments: 64,
    bloom: false,
    shadows: false,
  },
};

