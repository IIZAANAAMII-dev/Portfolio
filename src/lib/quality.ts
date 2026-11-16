import { create } from 'zustand';
import {
  cpuCores,
  deviceMemoryGb,
  isMobileDevice,
  prefersReducedMotion,
  prefersSaveData,
  probeGpu,
} from '@/lib/utils/device';

/*
 * Système graphique adaptatif.
 *
 * Deux notions :
 *  - `QualityLevel` ('low' | 'medium' | 'high') : le niveau de CONTENU que lit tout le décor
 *    (`useWorld(s => s.quality)`). Inchangé, pour que chaque fichier continue de fonctionner.
 *  - `GraphicsTier` : le palier graphique réel, qui ajoute 'minimal' sous 'low'. Partout où le
 *    décor lit `quality`, le palier 'minimal' se lit 'low' (il en a donc au moins toutes les
 *    économies) ; les systèmes qui lisent `tier` (`useWorld(s => s.tier)`) allègent encore.
 *
 * Le palier de départ est connu AVANT la première image (`initialTier`) : `?quality=` d'abord,
 * puis le choix enregistré du joueur (« Graphismes »), sinon le profil de l'appareil.
 */

export type QualityLevel = 'low' | 'medium' | 'high';
export type GraphicsTier = 'minimal' | QualityLevel;
/** Choix du joueur : 'auto' laisse le régulateur décider, sinon un palier fixe. */
export type GraphicsMode = 'auto' | GraphicsTier;

export const GRAPHICS_TIERS: readonly GraphicsTier[] = ['minimal', 'low', 'medium', 'high'];

export function tierRank(tier: GraphicsTier) {
  return GRAPHICS_TIERS.indexOf(tier);
}

/** Vrai si `tier` est au plus `limit` (ex. `atMost(tier, 'low')` : 'minimal' ou 'low'). */
export function atMost(tier: GraphicsTier, limit: GraphicsTier) {
  return tierRank(tier) <= tierRank(limit);
}

/** Vrai si `tier` est au moins `limit`. */
export function atLeast(tier: GraphicsTier, limit: GraphicsTier) {
  return tierRank(tier) >= tierRank(limit);
}

/** Niveau de contenu correspondant à un palier ('minimal' → 'low'). */
export function tierQuality(tier: GraphicsTier): QualityLevel {
  return tier === 'minimal' ? 'low' : tier;
}

/** Palier voisin (`step` = -1 plus léger, +1 plus riche), borné. */
export function stepTier(tier: GraphicsTier, step: number): GraphicsTier {
  const index = Math.min(GRAPHICS_TIERS.length - 1, Math.max(0, tierRank(tier) + step));
  return GRAPHICS_TIERS[index];
}

function lowerTier(a: GraphicsTier, b: GraphicsTier) {
  return tierRank(a) <= tierRank(b) ? a : b;
}

function isTier(value: unknown): value is GraphicsTier {
  return typeof value === 'string' && (GRAPHICS_TIERS as readonly string[]).includes(value);
}

/** Libellés du réglage « Graphismes » (interface en français). */
export const TIER_LABELS: Record<GraphicsTier, { name: string; hint: string }> = {
  minimal: { name: 'Très léger', hint: 'Appareils anciens : 30 images/s, résolution et décor réduits.' },
  low: { name: 'Économie', hint: 'Sans ombres ni lueurs, décor allégé au loin. Idéal sur téléphone.' },
  medium: { name: 'Équilibré', hint: 'Ombres et détails, sans post-traitement.' },
  high: { name: 'Élevé', hint: 'Tout le décor, ombres nettes et lueurs.' },
};

interface QualitySettings {
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
}

export const QUALITY_LEVELS: Record<QualityLevel, QualitySettings> = {
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

export interface TierSettings extends QualitySettings {
  /** Résolution minimale du réglage fin (régulateur) : en dessous, l'image devient floue. */
  dprFloor: number;
  /** Budget de pixels rendus (millions) : plafonne la résolution des grands écrans. */
  pixelBudget: number;
  /** Cadence plafonnée (images/s, 0 = libre) : régulière et économe sur les appareils anciens. */
  frameCap: number;
  /** Part de la vie secondaire conservée (faune, objets flottants, petites animations). */
  life: number;
}

export const TIER_LEVELS: Record<GraphicsTier, TierSettings> = {
  minimal: {
    dpr: 0.85,
    dprFloor: 0.62,
    pixelBudget: 0.9,
    frameCap: 30,
    life: 0.3,
    fishDensity: 0.22,
    fishDistance: 70,
    vegetationDensity: 0.32,
    // Pas moins que « Économie » : la houle (14 m pour la plus courte) crénèlerait les rivages.
    oceanSegments: 64,
    bloom: false,
    shadows: false,
    decorRange: 30,
    dockedDecorRange: 20,
  },
  // Budgets de pixels : les écrans courants gardent leur résolution d'avant (1080p en
  // « Économie », 1440p en « Équilibré », 4K à 1,5 en « Élevé ») ; seuls les écrans démesurés
  // pour le palier sont plafonnés.
  low: { ...QUALITY_LEVELS.low, dprFloor: 0.8, pixelBudget: 2.2, frameCap: 0, life: 0.6 },
  medium: { ...QUALITY_LEVELS.medium, dprFloor: 0.9, pixelBudget: 4, frameCap: 0, life: 0.85 },
  high: { ...QUALITY_LEVELS.high, dprFloor: 1, pixelBudget: 9, frameCap: 0, life: 1 },
};

/**
 * Relevés A/B en développement : `?perf=off` coupe les optimisations d'exécution (shaders
 * préchauffés, lumières constantes, matériaux par signature, sommeil des décors et des
 * réserves d'effets hors champ) pour mesurer leur effet sur la même version du site.
 * Remplacé par `false` à la compilation de production.
 */
export const perfOff = process.env.NODE_ENV !== 'production'
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('perf') === 'off';

/* ------------------------------------------------------------- profil de l'appareil */

export type GpuClass = 'software' | 'weak' | 'mid' | 'strong' | 'unknown';

/**
 * Classe de la carte graphique d'après la chaîne WebGL (WEBGL_debug_renderer_info). Les règles
 * restent prudentes : une carte inconnue garde le comportement par défaut (ordinateur 'high',
 * téléphone 'low'), et le régulateur corrige ensuite d'après les images réellement produites.
 */
export function classifyGpu(renderer: string): GpuClass {
  const r = renderer.toLowerCase();
  if (!r || /^(webkit webgl|mozilla|webgl|generic renderer)$/.test(r.trim())) return 'unknown';
  if (/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|gdi generic|mesa offscreen/.test(r)) return 'software';
  // Apple : puces M (Mac) puissantes ; « Apple GPU » (Safari) ne dit pas laquelle.
  if (/apple m\d/.test(r)) return 'strong';
  if (/apple/.test(r)) return 'mid';
  const adreno = /adreno[^0-9]*(\d{3})/.exec(r);
  if (adreno) {
    const model = Number(adreno[1]);
    if (model >= 650) return 'strong';
    if (model >= 616) return 'mid';
    return 'weak';
  }
  const mali = /mali-?\s*([gt]?)(\d{2,3})/.exec(r);
  if (mali) {
    const family = mali[1];
    const model = Number(mali[2]);
    if (family !== 'g' || model < 60) return 'weak';
    if (model >= 700 || model === 77 || model === 78) return 'strong';
    return 'mid';
  }
  if (/immortalis|xclipse/.test(r)) return 'strong';
  if (/powervr|rogue|videocore|vivante|tegra|maleoon|img /.test(r)) return /maleoon/.test(r) ? 'mid' : 'weak';
  if (/nvidia|geforce|quadro|rtx|tesla/.test(r)) {
    if (/\bmx ?\d{3}\b|\bgt ?\d{3,4}\b|\bgtx ?[4-7]\d{2}\b|\b\d{3}m\b/.test(r)) return 'mid';
    return 'strong';
  }
  if (/radeon|amd|ati /.test(r)) {
    if (/\brx ?\d{3,4}|vega ?(56|64)|radeon pro|radeon vii/.test(r)) return 'strong';
    if (/\bhd ?\d{4}\b|\br[579] ?\d{3}\b/.test(r)) return 'weak';
    return 'mid';
  }
  if (/intel|iris|uhd graphics|hd graphics/.test(r)) {
    if (/\barc\b/.test(r)) return 'strong';
    if (/iris/.test(r)) return 'mid';
    return 'weak';
  }
  return 'unknown';
}

export interface DeviceProfile {
  mobile: boolean;
  /** Chaîne WebGL abrégée (affichée dans le panneau « Graphismes »). */
  gpu: string;
  gpuClass: GpuClass;
  cores: number;
  memory: number;
  saveData: boolean;
  reducedMotion: boolean;
  /** Palier de départ en automatique. */
  start: GraphicsTier;
  /** Plafond du régulateur en automatique : un appareil n'y monte que s'il le soutient. */
  ceiling: GraphicsTier;
  /** Raisons du choix, en français (panneau « Graphismes »). */
  reasons: string[];
}

/**
 * Nom lisible de la carte : « ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11
 * vs_5_0 ps_5_0, D3D11) » → « Intel UHD Graphics 620 ». Chaîne masquée par le navigateur :
 * rien (le panneau dit alors « Carte graphique non communiquée »).
 */
function shortGpu(renderer: string) {
  if (/^(webkit webgl|mozilla|webgl|generic renderer)$/i.test(renderer.trim())) return '';
  const inner = /angle \((.*)\)/i.exec(renderer)?.[1] ?? renderer;
  const parts = inner.split(',').map((part) => part.trim()).filter(Boolean);
  let name = parts.length >= 2 ? parts[1] : parts[0] ?? '';
  // Pilotes Vulkan / OpenGL : le nom de la carte est entre parenthèses (« Vulkan 1.3.0 (…) »).
  const wrapped = /^(?:vulkan|opengl)[^(]*\((.*)\)$/i.exec(name);
  if (wrapped) name = wrapped[1];
  return name
    .replace(/\(0x[0-9a-f]+\)|\(r\)|\(tm\)/gi, '')
    .replace(/direct3d.*|vs_\d.*|opengl.*|vulkan.*|\/pcie.*|metal renderer:\s*/gi, '')
    .replace(/^angle\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

let profileCache: DeviceProfile | null = null;

/** Profil de l'appareil, mesuré une fois (avant la première image) puis mis en cache. */
export function deviceProfile(): DeviceProfile {
  if (profileCache) return profileCache;
  const mobile = isMobileDevice();
  const probe = typeof window === 'undefined' ? null : probeGpu();
  const renderer = probe?.renderer ?? '';
  const gpuClass = classifyGpu(renderer);
  const cores = cpuCores();
  const memory = deviceMemoryGb();
  const saveData = prefersSaveData();
  const reducedMotion = prefersReducedMotion();
  const apple = /apple/i.test(renderer);
  const reasons: string[] = [];
  let start: GraphicsTier = mobile ? 'low' : 'high';
  let ceiling: GraphicsTier = mobile ? 'medium' : 'high';

  switch (gpuClass) {
    case 'software':
      start = 'minimal';
      ceiling = 'low';
      reasons.push('rendu logiciel (sans carte graphique)');
      break;
    case 'weak':
      start = mobile ? 'minimal' : 'low';
      ceiling = mobile ? 'low' : 'medium';
      reasons.push('carte graphique modeste');
      break;
    case 'mid':
      if (!mobile) start = 'medium';
      break;
    default:
      break;
  }
  if (memory > 0 && memory <= 2) {
    start = 'minimal';
    ceiling = lowerTier(ceiling, 'low');
    reasons.push(`${memory} Go de mémoire`);
  } else if (memory > 0 && memory <= 4) {
    start = lowerTier(start, mobile ? 'low' : 'medium');
    ceiling = lowerTier(ceiling, mobile ? 'low' : 'medium');
    reasons.push(`${memory} Go de mémoire`);
  }
  // Les navigateurs d'Apple arrondissent le nombre de cœurs : on ne s'y fie pas.
  if (!apple && cores > 0 && cores <= 2) {
    start = 'minimal';
    ceiling = lowerTier(ceiling, 'low');
    reasons.push(`${cores} cœurs`);
  } else if (!apple && cores > 0 && cores <= 4) {
    start = lowerTier(start, mobile ? 'minimal' : 'medium');
    ceiling = lowerTier(ceiling, mobile ? 'low' : 'high');
    reasons.push(`${cores} cœurs`);
  }
  if (saveData) {
    start = lowerTier(start, 'low');
    ceiling = lowerTier(ceiling, 'low');
    reasons.push('économie de données');
  }
  if (probe && !probe.webgl2) {
    start = lowerTier(start, 'low');
    ceiling = lowerTier(ceiling, 'medium');
    reasons.push('WebGL 1 seulement');
  }
  if (reducedMotion) reasons.push('animations réduites');
  if (tierRank(start) > tierRank(ceiling)) start = ceiling;
  // Navigateur piloté (captures de l'équipe, tests : rendu logiciel) : le choix historique
  // (ordinateur 'high', téléphone 'low') garde les captures comparables. `?autotier=1`
  // réactive la détection pour la tester.
  if (automatedBrowser() && !autotierRequested()) {
    start = mobile ? 'low' : 'high';
    ceiling = mobile ? 'medium' : 'high';
    reasons.splice(0, reasons.length, 'navigateur automatisé');
  }
  profileCache = { mobile, gpu: shortGpu(renderer), gpuClass, cores, memory, saveData, reducedMotion, start, ceiling, reasons };
  return profileCache;
}

/** Navigateur piloté par un outil de test (Playwright, Selenium…). */
export function automatedBrowser() {
  if (typeof navigator === 'undefined') return false;
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

function autotierRequested() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('autotier') === '1';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- choix et persistance */

const STORAGE_KEY = 'archipel:graphismes';

/** `?quality=minimal|low|medium|high` fige le palier (captures, démonstrations, tests). */
export function forcedTier(): GraphicsTier | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('quality');
    return isTier(value) ? value : null;
  } catch {
    return null;
  }
}

/** Ancien accès (niveau de contenu forcé) : toujours valable. */
export function forcedQuality(): QualityLevel | null {
  const tier = forcedTier();
  return tier ? tierQuality(tier) : null;
}

/** Choix enregistré du joueur (« Graphismes »), 'auto' par défaut. */
export function storedGraphicsMode(): GraphicsMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'auto' || isTier(value) ? (value as GraphicsMode) : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveGraphicsMode(mode: GraphicsMode) {
  if (typeof window === 'undefined') return;
  try {
    if (mode === 'auto') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Stockage indisponible (mode privé) : le choix vaut pour cette visite.
  }
}

/** Mode de départ : un `?quality=` forcé compte comme un choix manuel. */
export function initialGraphicsMode(): GraphicsMode {
  return forcedTier() ?? storedGraphicsMode();
}

/**
 * Mémoire du mode automatique, partagée par le régulateur et le réglage « Graphismes » :
 * le dernier palier choisi en automatique (pour y revenir quand le joueur repasse en Auto).
 */
export const graphicsMemory: { autoTier: GraphicsTier | null } = { autoTier: null };

/** Palier que le mode automatique retient (dernier choix du régulateur, sinon le profil). */
export function autoTier(): GraphicsTier {
  return graphicsMemory.autoTier ?? deviceProfile().start;
}

/**
 * Palier de départ, connu AVANT la première image : un téléphone ne construit jamais le
 * décor de la haute qualité pour le jeter une image plus tard.
 */
export function initialTier(): GraphicsTier {
  const mode = initialGraphicsMode();
  return mode === 'auto' ? autoTier() : mode;
}

/** Ancien accès : niveau de contenu de départ. */
export function initialQuality(): QualityLevel {
  return tierQuality(initialTier());
}

/* ------------------------------------------------------------------- résolution */

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Résolution plafond d'un palier : jamais au-delà de l'écran, ni du budget de pixels du
 * palier (un écran 4K ne rend pas 8 millions de pixels d'océan à chaque image).
 */
export function tierDpr(tier: GraphicsTier) {
  if (typeof window === 'undefined') return 1;
  const settings = TIER_LEVELS[tier];
  const device = window.devicePixelRatio || 1;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const budget = Math.sqrt((settings.pixelBudget * 1e6) / area);
  return round2(Math.max(0.5, Math.min(device, settings.dpr, budget)));
}

/** Plancher du réglage fin pour un palier. */
export function tierDprFloor(tier: GraphicsTier) {
  return round2(Math.min(TIER_LEVELS[tier].dprFloor, tierDpr(tier)));
}

/** Ancien accès : résolution plafonnée par un niveau (ou un palier). */
export function qualityDpr(quality: QualityLevel | GraphicsTier) {
  return tierDpr(quality);
}

/**
 * Résolution de rendu courante, passée au `<Canvas dpr>` : la seule source de vérité.
 * (R3F réapplique la prop `dpr` du Canvas à chaque rendu de son parent ; une valeur posée
 * à côté, par `setDpr`, serait écrasée au premier accostage.) Le régulateur de performance
 * la fait varier : plafond du palier, puis ajustement fin selon les temps d'image.
 */
export const useRenderDpr = create<{ dpr: number }>(() => ({ dpr: tierDpr(initialTier()) }));

/**
 * État du régulateur, pour le réglage « Graphismes » : résolution réduite, chaleur (le
 * régulateur a constaté une baisse durable et ne remonte plus pour un moment).
 */
export const useGraphicsStatus = create<{ thermal: boolean; capped: boolean }>(() => ({
  thermal: false,
  capped: TIER_LEVELS[initialTier()].frameCap > 0,
}));
